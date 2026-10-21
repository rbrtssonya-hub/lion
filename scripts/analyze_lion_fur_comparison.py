"""Measure matched lion-fur screenshots without rewarding a simple dimming.

Requires Pillow and NumPy. Inputs must be native canvas PNGs, not resized page
screenshots. The shader mask uses red=(255,0,0), ivory=(0,255,0), other=black.
Before/after masks may differ; paired measurements use their intersection and
report coverage overlap separately. A shared mask is a projected selection,
not proof that the second renderer classifies those pixels identically.
Blender is an optional distribution-only
reference with its own mask, never assumed to have matching pose or pixels.

Example:
  python scripts/analyze_lion_fur_comparison.py --before tmp/before.png
    --after tmp/after.png --before-mask tmp/before-mask.png
    --after-mask tmp/after-mask.png --output tmp/fur-comparison.json
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


PERCENTILES = [1, 5, 25, 50, 75, 95, 99]
LABELS = {"red": np.array([255, 0, 0]), "ivory": np.array([0, 255, 0])}


def quantiles(values):
    if not values.size:
        return None
    return {f"p{p}": float(v) for p, v in zip(PERCENTILES, np.percentile(values, PERCENTILES))}


def load_rgb(path):
    path = Path(path).resolve()
    with Image.open(path) as image:
        if image.format != "PNG":
            raise ValueError(f"Expected lossless PNG: {path}")
        rgba = np.asarray(image.convert("RGBA"))
    return rgba[:, :, :3], {
        "path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "width": int(rgba.shape[1]), "height": int(rgba.shape[0]),
        "nonOpaquePixels": int(np.count_nonzero(rgba[:, :, 3] != 255)),
    }, rgba[:, :, 3]


def masks_from_rgb(rgb):
    # Keep only unambiguous class pixels; MSAA blends at class boundaries are
    # intentionally excluded rather than mistaken for colored fur.
    signed = rgb.astype(np.int16)
    return {name: np.max(np.abs(signed - color), axis=2) <= 5 for name, color in LABELS.items()}


def linear_luminance(rgb):
    srgb = rgb.astype(np.float64) / 255
    linear = np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)
    return linear @ np.array([.2126, .7152, .0722])


def color_summary(colors):
    rgb = colors.astype(np.float64) / 255
    maximum, minimum = rgb.max(axis=1), rgb.min(axis=1)
    chroma = maximum - minimum
    saturation = np.divide(chroma, maximum, out=np.zeros_like(chroma), where=maximum > 0)
    colored = chroma > .02
    hue = np.zeros_like(chroma)
    for channel, offset in [(0, 0), (1, 2), (2, 4)]:
        selected = colored & (np.argmax(rgb, axis=1) == channel)
        hue[selected] = ((rgb[selected, (channel + 1) % 3] - rgb[selected, (channel + 2) % 3]) / chroma[selected] + offset) * 60
    angle = np.deg2rad(hue[colored] % 360)
    weight = chroma[colored]
    circular = None if not angle.size else float(np.rad2deg(np.arctan2(np.sum(np.sin(angle) * weight), np.sum(np.cos(angle) * weight))) % 360)
    return {
        "rgb8Quantiles": {name: quantiles(colors[:, i]) for i, name in enumerate("rgb")},
        "rgb8Mean": colors.mean(axis=0).tolist(),
        "hsvSaturation": quantiles(saturation), "chromaWeightedHueDegrees": circular,
        "coloredPixelRatio": float(colored.mean()),
    }


def neighbor_contrast(y, mask):
    absolute, relative_log = [], []
    for a, b, valid in [
        (y[:, :-1], y[:, 1:], mask[:, :-1] & mask[:, 1:]),
        (y[:-1, :], y[1:, :], mask[:-1, :] & mask[1:, :]),
    ]:
        first, second = a[valid], b[valid]
        absolute.append(np.abs(first - second))
        # Exact scale invariance for positive pixels: replacing all linear
        # luminances with k*Y leaves this unchanged. Black pairs are counted
        # separately, with no arbitrary epsilon turning them into a reward.
        positive = (first > 1e-8) & (second > 1e-8)
        relative_log.append(np.abs(np.log2(second[positive] / first[positive])))
    absolute, relative_log = np.concatenate(absolute), np.concatenate(relative_log)
    return {
        "pairs": int(absolute.size), "positivePairs": int(relative_log.size),
        "absoluteLinearLuminanceDifference": quantiles(absolute),
        "exposureInvariantLog2Difference": quantiles(relative_log),
        "meanExposureInvariantLog2Difference": float(relative_log.mean()) if relative_log.size else None,
    }


def tile_contrast(y, mask, tile=32):
    contrasts = []
    for top in range(0, y.shape[0], tile):
        for left in range(0, y.shape[1], tile):
            block = y[top:top + tile, left:left + tile]
            valid = mask[top:top + tile, left:left + tile]
            if np.count_nonzero(valid) < max(64, block.size * .25):
                continue
            values = block[valid]
            middle = float(np.median(values))
            if middle > 1e-8:
                contrasts.append(float((np.percentile(values, 95) - np.percentile(values, 5)) / middle))
    return {"tileSizePixels": tile, "tiles": len(contrasts), "relativeP5P95Range": quantiles(np.asarray(contrasts))}


def spatial_scales(y, mask):
    """Separate broad illumination bands from high-frequency strand variation."""
    def box_sum(values, width):
        pad = width // 2
        padded = np.pad(values, ((pad, pad), (pad, pad)))
        integral = np.pad(padded.cumsum(axis=0).cumsum(axis=1), ((1, 0), (1, 0)))
        return integral[width:, width:] - integral[:-width, width:] - integral[width:, :-width] + integral[:-width, :-width]

    result = []
    for width in (9, 33, 97):
        count = box_sum(mask.astype(float), width)
        selected = mask & (count >= width * width * .25)
        smooth = box_sum(y * mask, width) / np.maximum(count, 1)
        values = smooth[selected]
        middle = float(np.median(values)) if values.size else 0
        spread = float(np.percentile(values, 95) - np.percentile(values, 5)) if values.size else 0
        result.append({
            "windowPixels": width, "pixels": int(values.size),
            "maskedMeanLuminance": quantiles(values),
            "relativeP5P95Range": spread / middle if middle > 1e-8 else None,
            "coefficientOfVariation": float(values.std() / values.mean()) if values.size and values.mean() > 1e-8 else None,
        })
    return result


def measure(rgb, y, mask):
    count = int(np.count_nonzero(mask))
    if not count:
        return {"pixels": 0}
    colors, values = rgb[mask], y[mask]
    # This is display-referred luma, retained for comparison with earlier audit
    # records. It must not be described as physical linear luminance.
    luma8 = colors.astype(float) @ np.array([.2126, .7152, .0722])
    p5, p50, p95 = np.percentile(values, [5, 50, 95])
    return {
        "pixels": count, **color_summary(colors),
        "linearLuminance": quantiles(values), "displayLuma8": quantiles(luma8),
        "relativeLinearP5P95Range": float((p95 - p5) / p50) if p50 > 1e-8 else None,
        "redChannelUnder30Ratio": float(np.mean(colors[:, 0] < 30)),
        "redChannelUnder60Ratio": float(np.mean(colors[:, 0] < 60)),
        "displayLumaUnder20Ratio": float(np.mean(luma8 < 20)),
        "allChannelsAtLeast245Ratio": float(np.mean(colors.min(axis=1) >= 245)),
        "anyChannelAtLeast250Ratio": float(np.mean(colors.max(axis=1) >= 250)),
        "neighbors": neighbor_contrast(y, mask), "tiles": tile_contrast(y, mask),
        "spatialScales": spatial_scales(y, mask),
    }


def brightness_fit(before, after):
    # If a result merely darkens/brightens all pixels, this residual stays low.
    positive = (before > 1e-8) & (after > 1e-8)
    if not np.any(positive):
        return None
    first, second = before[positive], after[positive]
    ev = float(np.median(np.log2(second / first)))
    gain = 2 ** ev
    residual = np.abs(second - gain * first)
    return {
        "positivePixelPairs": int(first.size), "bestMedianExposureShiftEV": ev,
        "medianRelativeResidualAfterExposureFit": float(np.median(residual) / max(np.median(second), 1e-8)),
        "p95RelativeResidualAfterExposureFit": float(np.percentile(residual, 95) / max(np.median(second), 1e-8)),
        "interpretation": "Small residual with similar normalized contrast is consistent with a simple brightness change, not restored fur layers.",
    }


def compare_pair(before, after, before_masks, after_masks):
    by, ay = linear_luminance(before), linear_luminance(after)
    result = {}
    for label in LABELS:
        bm, am = before_masks[label], after_masks[label]
        common, union = bm & am, bm | am
        common_count, union_count = int(common.sum()), int(union.sum())
        before_measure, after_measure = measure(before, by, common), measure(after, ay, common)
        alerts = []
        if common_count:
            sat_before = before_measure["hsvSaturation"]["p50"]
            sat_after = after_measure["hsvSaturation"]["p50"]
            if label == "red" and sat_after < sat_before - .05:
                alerts.append("Red median saturation fell by more than .05; a lower dark-pixel ratio may be desaturation rather than faithful recovery.")
            hue_before, hue_after = before_measure["chromaWeightedHueDegrees"], after_measure["chromaWeightedHueDegrees"]
            if hue_before is not None and hue_after is not None and abs((hue_after - hue_before + 180) % 360 - 180) > 8:
                alerts.append("Chroma-weighted hue shifted by more than 8 degrees; inspect source color fidelity.")
            if union_count and common_count / union_count < .9:
                alerts.append("Mask overlap is below .9; visible coverage changed, so common-pixel measurements do not prove equivalent silhouettes or coverage.")
        result[label] = {
            "coverage": {"beforePixels": int(bm.sum()), "afterPixels": int(am.sum()), "commonPixels": common_count,
                         "unionPixels": union_count, "intersectionOverUnion": common_count / union_count if union_count else None},
            "beforeCommonPixels": before_measure, "afterCommonPixels": after_measure,
            "beforeAllVisiblePixels": measure(before, by, bm), "afterAllVisiblePixels": measure(after, ay, am),
            "pairedDifference": {
                "rgb8MeanAbsoluteDifference": float(np.abs(after[common].astype(float) - before[common]).mean()),
                "rgb8MeanAbsoluteDifferencePerChannel": np.abs(after[common].astype(float) - before[common]).mean(axis=0).tolist(),
                "linearLuminanceMeanAbsoluteDifference": float(np.abs(ay[common] - by[common]).mean()),
                "scope": "Differences at matching projected pixels only. Changed hair coverage or sampling can contribute; these are not a perceptual quality score.",
            } if common_count else None,
            "brightnessOnlyFit": brightness_fit(by[common], ay[common]), "reviewFlags": alerts,
        }
    return result


def parse_roi(values, size):
    name, *numbers = values
    x, y, width, height = map(int, numbers)
    if min(x, y) < 0 or min(width, height) <= 0 or x + width > size[1] or y + height > size[0]:
        raise ValueError(f"ROI outside image: {values}")
    return name, (slice(y, y + height), slice(x, x + width))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--before", required=True)
    parser.add_argument("--after", required=True)
    parser.add_argument("--mask", help="Shared projected material selection; caller must assess alignment and segmentation limits")
    parser.add_argument("--before-mask")
    parser.add_argument("--after-mask")
    parser.add_argument("--blender")
    parser.add_argument("--blender-mask")
    parser.add_argument("--roi", nargs=5, action="append", default=[], metavar=("NAME", "X", "Y", "WIDTH", "HEIGHT"))
    parser.add_argument("--output", default="tmp/lion-fur-comparison/analysis.json")
    args = parser.parse_args()
    if not (args.mask or (args.before_mask and args.after_mask)):
        parser.error("Provide --mask or both --before-mask and --after-mask")
    if args.mask and (args.before_mask or args.after_mask):
        parser.error("Use a shared mask or separate masks, not both")
    if bool(args.blender) != bool(args.blender_mask):
        parser.error("--blender and --blender-mask must be provided together")
    paths = {"before": args.before, "after": args.after, "beforeMask": args.before_mask or args.mask, "afterMask": args.after_mask or args.mask}
    images, inputs, alpha = {}, {}, {}
    for name, path in paths.items():
        images[name], inputs[name], alpha[name] = load_rgb(path)
    shapes = {value.shape for value in images.values()}
    if len(shapes) != 1:
        raise ValueError("Before/after/masks must have exactly matching native pixel dimensions; no resampling is performed")
    bm, am = masks_from_rgb(images["beforeMask"]), masks_from_rgb(images["afterMask"])
    # Transparent background is valid for the structure renderer and Blender.
    # Exclude partially covered edges instead of compositing them over a chosen
    # color. Only fully opaque labelled pixels in BOTH source images enter the
    # paired statistics, so unrelated background alpha cannot alter them.
    alpha_exclusions = {}
    for name, masks, image_name, mask_name in [
        ("before", bm, "before", "beforeMask"), ("after", am, "after", "afterMask"),
    ]:
        opaque = (alpha[image_name] == 255) & (alpha[mask_name] == 255)
        alpha_exclusions[name] = {key: int(np.count_nonzero(value & ~opaque)) for key, value in masks.items()}
        for key in masks:
            masks[key] &= opaque
    regions = [("full", (slice(None), slice(None)))] + [parse_roi(value, images["before"].shape) for value in args.roi]
    if len({name for name, _ in regions}) != len(regions):
        raise ValueError("ROI names must be unique and cannot use reserved name 'full'")
    report = {
        "version": 1, "inputs": inputs,
        "method": {
            "rgbEncodingAssumption": "8-bit sRGB display output; linear luminance is computed after exact sRGB decoding.",
            "pairedMask": "Pure red/green shader labels, intersection of both visible masks; no pose registration or resampling.",
            "maskSourceMode": "shared-projected-selection" if args.mask else "separate-renderer-classification",
            "sharedMaskLimit": "A shared mask supplies spatial labels from one renderer. Matching projection and alpha do not independently prove the other renderer's material segmentation." if args.mask else None,
            "alpha": "Background may be transparent. Half-covered pixels are excluded unless both the image pixel and its material-mask pixel are fully opaque; no compositing or RGB premultiplication correction is performed.",
            "localContrast": "Adjacent positive pixels use abs(log2(Yb/Ya)); per-tile p5-p95 range divided by median. Both are invariant to a uniform linear exposure multiplier before clipping/quantization.",
            "spatialScales": "Mask-weighted box means at 9/33/97 px separate fine strand variation from broad light/dark bands. Windows require at least 25% labelled coverage. Lower broad-band contrast is only desirable when it approaches the reference; higher fine contrast may also be noise.",
            "limits": "Masks and unchanged pose/camera must come from the renderer. More local contrast can also be noise: native screenshots and motion review remain required. No single pass/fail or quality score is produced.",
        },
        "regions": {},
        "excludedNonOpaqueLabelPixels": alpha_exclusions,
    }
    for name, slices in regions:
        report["regions"][name] = compare_pair(images["before"][slices], images["after"][slices], {k: v[slices] for k, v in bm.items()}, {k: v[slices] for k, v in am.items()})
    if args.blender:
        blender, inputs["blender"], blender_alpha = load_rgb(args.blender)
        blender_mask, inputs["blenderMask"], blender_mask_alpha = load_rgb(args.blender_mask)
        if blender.shape != blender_mask.shape:
            raise ValueError("Blender image and its mask must have the same dimensions")
        by = linear_luminance(blender)
        blender_masks = masks_from_rgb(blender_mask)
        blender_opaque = (blender_alpha == 255) & (blender_mask_alpha == 255)
        report["blenderReference"] = {
            "comparisonScope": "Independent full-image class distributions only; no pixel alignment or equivalence asserted.",
            "excludedNonOpaqueLabelPixels": {k: int(np.count_nonzero(v & ~blender_opaque)) for k, v in blender_masks.items()},
            "materials": {k: measure(blender, by, v & blender_opaque) for k, v in blender_masks.items()},
        }
    output = Path(args.output).resolve()
    if output in {Path(value).resolve() for value in paths.values()} or output in {Path(value).resolve() for value in [args.blender, args.blender_mask] if value}:
        raise ValueError("Output must not overwrite an input image")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "regions": list(report["regions"]), "redCommonPixels": report["regions"]["full"]["red"]["coverage"]["commonPixels"], "ivoryCommonPixels": report["regions"]["full"]["ivory"]["coverage"]["commonPixels"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
