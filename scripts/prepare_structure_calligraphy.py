"""Apply the requested transparent-edge crop and consistent PNG display size.

No glyph pixels are painted or recolored. ImageGen originals stay untouched.
"""
from pathlib import Path
import hashlib
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'source/design/structure-atlas/2026-10-21'
OUTPUT = ROOT / 'source/public/assets/structure/calligraphy'


def prepare():
    manifest = json.loads((ARCHIVE / 'imagegen.json').read_text(encoding='utf-8'))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = []
    for entry in manifest['generations']:
        source = ROOT / entry['original']
        image = Image.open(source).convert('RGBA')
        alpha = image.getchannel('A')
        if alpha.getextrema() != (0, 255):
            raise ValueError(f'Expected real generated alpha in {source}')
        bounds = alpha.getbbox()
        if not bounds:
            raise ValueError(f'Empty calligraphy: {source}')
        trimmed = image.crop(bounds)
        ratio = 880 / max(trimmed.size)
        size = tuple(round(side * ratio) for side in trimmed.size)
        resized = trimmed.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (1024, 1024))
        canvas.paste(resized, ((1024 - size[0]) // 2, (1024 - size[1]) // 2))
        target = OUTPUT / entry['filename']
        canvas.save(target, optimize=True)
        colors = [pixel[:3] for pixel in canvas.getdata() if pixel[3] >= 128]
        medians = [sorted(pixel[channel] for pixel in colors)[len(colors) // 2] for channel in range(3)]
        results.append({
            'character': entry['character'], 'originalSize': list(image.size),
            'originalCrop': list(bounds), 'output': target.relative_to(ROOT).as_posix(),
            'size': [1024, 1024], 'alphaRange': list(canvas.getchannel('A').getextrema()),
            'alphaBounds': list(canvas.getchannel('A').getbbox()), 'opaqueInkMedianRGB': medians,
            'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        })
    (ARCHIVE / 'prepared-assets.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    prepare()
