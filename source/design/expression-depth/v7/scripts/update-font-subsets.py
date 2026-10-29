"""Check local font coverage; pass --update once after Chinese copy is final.

Uses Python stdlib, existing fontTools and installed Node's native Brotli.
No dependencies are installed. Default/check mode never accesses the network.
"""

import argparse
from copy import deepcopy
from datetime import datetime, timezone
from io import BytesIO
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
from types import SimpleNamespace
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "reference" / "TYPOGRAPHY-SOURCES.json"
FONTTOOLS_FALLBACK = Path(r"F:\AI-Tools\xiaoxing-tts\.venv-cpu\Lib\site-packages")
PUNCTUATION = "！？（）《》【】：“”‘’、。…·—–−↗←→↓℃×"


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def current_sources():
    files = sorted(
        path for path in (ROOT / "src").rglob("*")
        if path.suffix in {".ts", ".tsx", ".js", ".jsx", ".css"}
    )
    if (ROOT / "index.html").exists():
        files.insert(0, ROOT / "index.html")
    text = "".join(path.read_text(encoding="utf-8") for path in files)
    characters = set(character for character in text if ord(character) >= 32)
    characters.update(chr(code) for code in range(32, 127))
    characters.update(PUNCTUATION)
    return files, "".join(sorted(characters))


def load_fonttools(site_packages):
    if importlib.util.find_spec("fontTools") is None:
        location = Path(site_packages) if site_packages else FONTTOOLS_FALLBACK
        if not (location / "fontTools").is_dir():
            raise RuntimeError("Use an existing fontTools Python environment or --fonttools-site-packages PATH")
        sys.path.insert(0, str(location))
    import fontTools
    from fontTools.ttLib import TTFont, woff2

    def decompress(data):
        return subprocess.run(
            ["node", "-e", "process.stdout.write(require('node:zlib').brotliDecompressSync(require('node:fs').readFileSync(0)))"],
            input=data, capture_output=True, check=True,
        ).stdout

    # Only the Brotli decoder is needed: font binaries are never converted.
    woff2.haveBrotli = True
    woff2.brotli = SimpleNamespace(decompress=decompress)
    return TTFont, fontTools.__version__


def verify_font(item, binary, characters, ttfont, version):
    if binary[:4] != b"wOF2" or struct.unpack(">I", binary[8:12])[0] != len(binary):
        raise RuntimeError(f"Invalid/truncated WOFF2: {item['local_file']}")
    font = ttfont(BytesIO(binary))
    cmap = font.getBestCmap()
    missing = [character for character in characters if ord(character) not in cmap]
    missing_chinese = [character for character in missing if "\u3400" <= character <= "\u9fff"]
    axes = [
        {"tag": axis.axisTag, "min": axis.minValue, "default": axis.defaultValue, "max": axis.maxValue}
        for axis in font["fvar"].axes
    ] if "fvar" in font else []
    lower, upper = item["declared_css_weight_range"]
    if lower != upper and not any(axis["tag"] == "wght" and axis["min"] <= lower <= upper <= axis["max"] for axis in axes):
        raise RuntimeError(f"Actual weight axis does not cover declared range: {item['family']}")
    if lower == upper and not axes and font["OS/2"].usWeightClass != lower:
        raise RuntimeError(f"Static weight mismatch: {item['family']}")
    if font["OS/2"].fsType != 0:
        raise RuntimeError(f"Unexpected embedding restriction flags: {item['family']}")
    result = {
        "tool": f"fontTools {version}; existing Python environment; installed Node native Brotli",
        "num_glyphs": font["maxp"].numGlyphs,
        "cmap_entries": len(cmap),
        "missing_requested_characters": missing,
        "missing_current_src_chinese_characters": missing_chinese,
        "intrinsic_variable_axes": axes,
        "os2_weight_class": font["OS/2"].usWeightClass,
        "os2_embedding_flags": font["OS/2"].fsType,
        "font_family": font["name"].getDebugName(1),
    }
    font.close()
    # Brush punctuation may fall back to Noto Sans; every Chinese glyph is required.
    passed = not missing_chinese if item["family"] == "Ma Shan Zheng" else not missing
    return result, passed


def download(url):
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    })
    with urlopen(request, timeout=50) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Read-only local coverage/hash check (default)")
    mode.add_argument("--update", action="store_true", help="Download one official subset per family and update provenance")
    parser.add_argument("--fonttools-site-packages", help="Existing site-packages directory containing fontTools")
    args = parser.parse_args()
    ttfont, version = load_fonttools(args.fonttools_site_packages)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    files, characters = current_sources()
    entries, staged, results = [], [], []
    passed = True
    for existing in manifest["fonts"]:
        item = deepcopy(existing)
        license_bytes = (ROOT / item["license_file"]).read_bytes()
        if sha256(license_bytes) != item["license_sha256"] or b"SIL OPEN FONT LICENSE Version 1.1" not in license_bytes:
            raise RuntimeError(f"License verification failed: {item['license_file']}")
        if args.update:
            weights = item["declared_css_weight_range"]
            weight = str(weights[0]) if weights[0] == weights[1] else f"{weights[0]}..{weights[1]}"
            css_url = "https://fonts.googleapis.com/css2?" + urlencode({
                "family": item["family"] + ":wght@" + weight, "display": "swap", "text": characters,
            })
            css = download(css_url).decode("utf-8")
            match = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)\s+format\('woff2'\)", css)
            if not match or f"font-weight: {weight.replace('..', ' ')};" not in css:
                raise RuntimeError(f"Unexpected official CSS response: {item['family']}")
            binary = download(match.group(1))
            item.update(source_css_url=css_url, source_css=css, download_url=match.group(1),
                        bytes=len(binary), sha256=sha256(binary))
            item.pop("browser_validation", None)
            # Google CSS range can overstate glyph coverage; cmap below is authoritative.
            item.pop("requested_not_in_official_css_range", None)
        else:
            binary = (ROOT / item["local_file"]).read_bytes()
            if sha256(binary) != item["sha256"]:
                raise RuntimeError(f"Font hash mismatch: {item['local_file']}")
        validation, font_passed = verify_font(item, binary, characters, ttfont, version)
        item["fonttools_validation"] = validation
        passed = passed and font_passed
        entries.append(item)
        staged.append((ROOT / item["local_file"], binary))
        results.append({"family": item["family"], "passed": font_passed, "bytes": len(binary), **validation})
    if args.update and passed:
        # Download and validate all three in memory before changing any local font.
        for path, binary in staged:
            path.write_bytes(binary)
        manifest.update(
            last_verified_utc=datetime.now(timezone.utc).isoformat(),
            subset_character_count=len(characters), subset_characters=characters,
            subset_characters_sha256=sha256(characters.encode("utf-8")),
            subset_source_files=[path.relative_to(ROOT).as_posix() for path in files], fonts=entries,
            method="Official Google Fonts CSS2 text subsetting from final current src and index.html; unmodified local WOFF2 binaries. No dependency installation.",
            validation=[
                "All original OFL license hashes verified",
                "All WOFF2 signatures, declared lengths and SHA256 hashes verified",
                "fontTools cmap verifies all current Chinese characters in every family; Noto covers every requested character",
                "Ma Shan Zheng missing symbols are recorded per-font and require Noto Sans SC fallback",
                "Browser font decoding must be checked after regeneration; previous browser results were removed",
            ],
        )
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "PASS" if passed else "FAIL", "updated": bool(args.update and passed),
                      "source_character_count": len(characters), "fonts": results}, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
