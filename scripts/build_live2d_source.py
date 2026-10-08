from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import pytoshop
from pytoshop import enums, layers


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "site" / "assets" / "entry" / "home-cover.png"
OUTPUT = ROOT / "site" / "assets" / "live2d" / "source"
PSD_PATH = OUTPUT / "nanfeng-lion-layered-rgb.psd"
LAYER_DIR = OUTPUT / "layers"


def polygon_mask(size, points, blur=1.2):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(blur))


def ellipse_mask(size, box, blur=1.0):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(blur))


def rectangle_mask(size, box, blur=1.0):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=24, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(blur))


def make_layer(base, name, rect, mask):
    left, top, right, bottom = rect
    crop = base.crop((left, top, right, bottom)).convert("RGBA")
    crop.putalpha(mask)
    LAYER_DIR.mkdir(parents=True, exist_ok=True)
    crop.save(LAYER_DIR / f"{name}.png")
    rgba = np.asarray(crop, dtype=np.uint8)
    channels = {
        0: layers.ChannelImageData(image=rgba[:, :, 0]),
        1: layers.ChannelImageData(image=rgba[:, :, 1]),
        2: layers.ChannelImageData(image=rgba[:, :, 2]),
        -1: layers.ChannelImageData(image=rgba[:, :, 3]),
    }
    return layers.LayerRecord(
        top=top,
        left=left,
        bottom=bottom,
        right=right,
        name=name,
        channels=channels,
        color_mode=enums.ColorMode.rgb,
    )


def rect_for_points(points, padding=10):
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return (
        max(0, min(xs) - padding),
        max(0, min(ys) - padding),
        min(2048, max(xs) + padding),
        min(1152, max(ys) + padding),
    )


def build():
    base = Image.open(SOURCE).convert("RGBA")
    if base.size != (2048, 1152):
        raise ValueError(f"Expected 2048x1152 cover, got {base.size}")

    full_mask = Image.new("L", base.size, 255)
    empty_mask = Image.new("L", base.size, 0)
    definitions = []

    definitions.append(("Background", (0, 0, 2048, 1152), full_mask))
    definitions.append(("Background_Repair", (690, 90, 1690, 1040), empty_mask.crop((690, 90, 1690, 1040))))

    body_points = [(690, 720), (760, 540), (970, 500), (1210, 560), (1430, 690), (1650, 1035), (710, 1050)]
    body_rect = rect_for_points(body_points, 12)
    definitions.append(("Lion_Body", body_rect, polygon_mask((body_rect[2] - body_rect[0], body_rect[3] - body_rect[1]), [(x - body_rect[0], y - body_rect[1]) for x, y in body_points])))

    head_points = [(715, 210), (850, 105), (1110, 110), (1350, 220), (1480, 470), (1340, 720), (990, 790), (760, 620)]
    head_rect = rect_for_points(head_points, 16)
    definitions.append(("Lion_Head", head_rect, polygon_mask((head_rect[2] - head_rect[0], head_rect[3] - head_rect[1]), [(x - head_rect[0], y - head_rect[1]) for x, y in head_points])))

    mane_points = [(690, 185), (830, 80), (1130, 90), (1420, 175), (1515, 465), (1375, 750), (980, 835), (700, 650)]
    mane_rect = rect_for_points(mane_points, 18)
    definitions.append(("Lion_Mane", mane_rect, polygon_mask((mane_rect[2] - mane_rect[0], mane_rect[3] - mane_rect[1]), [(x - mane_rect[0], y - mane_rect[1]) for x, y in mane_points])))

    beard_points = [(790, 510), (920, 470), (1260, 500), (1350, 670), (1240, 900), (950, 900), (805, 740)]
    beard_rect = rect_for_points(beard_points, 14)
    definitions.append(("Lion_Beard", beard_rect, polygon_mask((beard_rect[2] - beard_rect[0], beard_rect[3] - beard_rect[1]), [(x - beard_rect[0], y - beard_rect[1]) for x, y in beard_points])))

    eye_rect = (820, 270, 1410, 565)
    definitions.append(("Lion_Eyes", eye_rect, rectangle_mask((eye_rect[2] - eye_rect[0], eye_rect[3] - eye_rect[1]), (35, 35, 555, 270), 2.0)))
    pupil_rect = (850, 300, 1390, 535)
    pupil_mask = Image.new("L", (pupil_rect[2] - pupil_rect[0], pupil_rect[3] - pupil_rect[1]), 0)
    pupil_mask = ellipse_mask(pupil_mask.size, (35, 25, 150, 145), 1.0)
    right_pupil = ellipse_mask(pupil_mask.size, (380, 65, 505, 190), 1.0)
    pupil_mask = Image.fromarray(np.maximum(np.asarray(pupil_mask), np.asarray(right_pupil)).astype("uint8"))
    definitions.append(("Lion_Pupils", pupil_rect, pupil_mask))
    definitions.append(("Lion_Eyelids", eye_rect, rectangle_mask((eye_rect[2] - eye_rect[0], eye_rect[3] - eye_rect[1]), (20, 20, 570, 285), 2.0)))

    mouth_points = [(860, 500), (1030, 485), (1280, 500), (1370, 700), (1280, 815), (1010, 820), (875, 700)]
    mouth_rect = rect_for_points(mouth_points, 12)
    definitions.append(("Lion_Mouth", mouth_rect, polygon_mask((mouth_rect[2] - mouth_rect[0], mouth_rect[3] - mouth_rect[1]), [(x - mouth_rect[0], y - mouth_rect[1]) for x, y in mouth_points])))

    tassel_rect = (680, 170, 1510, 700)
    definitions.append(("Lion_Tassels", tassel_rect, rectangle_mask((tassel_rect[2] - tassel_rect[0], tassel_rect[3] - tassel_rect[1]), (15, 15, 815, 515), 3.0)))

    # Photoshop stores layer records top-to-bottom; the background sits at the bottom.
    records = []
    for name, rect, mask in reversed(definitions):
        records.append(make_layer(base, name, rect, mask))

    full = np.asarray(base, dtype=np.uint8)
    image_data = pytoshop.image_data.ImageData(
        channels=np.stack([full[:, :, 0], full[:, :, 1], full[:, :, 2]]),
        compression=enums.Compression.raw,
    )
    layer_info = layers.LayerInfo(records, use_alpha_channel=True)
    psd = pytoshop.PsdFile(
        num_channels=3,
        height=1152,
        width=2048,
        color_mode=enums.ColorMode.rgb,
        layer_and_mask_info=layers.LayerAndMaskInfo(layer_info=layer_info),
        image_data=image_data,
        compression=enums.Compression.raw,
    )
    with PSD_PATH.open("wb") as fd:
        psd.write(fd)
    print(f"wrote {PSD_PATH}")
    print(f"layers={len(records)}")


if __name__ == "__main__":
    build()
