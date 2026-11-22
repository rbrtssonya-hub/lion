"""Derive the deployed WebP illustrations from the preserved PNG originals."""
from argparse import ArgumentParser
from io import BytesIO
from pathlib import Path

from PIL import Image


SOURCE = Path(__file__).resolve().parents[1] / "source"
PUBLIC = SOURCE / "public" / "assets"
STATES = ("joy", "anger", "sorrow", "delight", "motion", "stillness", "surprise", "doubt")


def illustration_paths():
    for name in ("zha", "pu", "hua", "zhuang"):
        yield f"design/lion-head-craft/2026-10-28/{name}.png", f"craft/{name}.webp"
    for name in ("foshan", "heshan", "fut-hok"):
        yield f"design/home-heritage/2026-10-19/{name}.png", f"lion-types/{name}.webp"
    for state in STATES:
        yield f"design/expression/2026-10-15-eight-poses/generated/lion-{state}-original.png", f"expression/lion-{state}-v2.webp"
        yield f"design/expression-calligraphy/2026-10-22/{state}.png", f"expression/calligraphy/{state}.webp"


def prepare(check):
    outputs = []
    original_bytes = 0
    for archive, destination in illustration_paths():
        source = SOURCE / archive
        target = PUBLIC / destination
        with Image.open(source) as original:
            rendering_metadata = {"transparency", "gamma", "srgb", "chromaticity", "icc_profile"}
            if original.mode not in ("RGB", "RGBA") or rendering_metadata.intersection(original.info):
                raise ValueError(f"Expected an RGB(A) PNG without rendering metadata: {source}")
            if check:
                data = target.read_bytes()
            else:
                stream = BytesIO()
                original.save(stream, format="WEBP", lossless=True, method=6, exact=True)
                data = stream.getvalue()
            with Image.open(BytesIO(data)) as result:
                if result.format != "WEBP" or result.size != original.size or result.convert(original.mode).tobytes() != original.tobytes():
                    raise ValueError(f"Decoded pixels changed: {target}")
        size = source.stat().st_size
        if len(data) >= size:
            raise ValueError(f"Encoding did not reduce the file size: {target}")
        original_bytes += size
        outputs.append((target, data))
    if not check:
        for target, data in outputs:
            target.write_bytes(data)
    print(f"{len(outputs)} pixel-exact WebP files, {original_bytes} -> {sum(len(data) for _, data in outputs)} bytes")


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the existing WebP files without writing")
    prepare(parser.parse_args().check)
