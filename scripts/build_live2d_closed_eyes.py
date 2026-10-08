from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'site/assets/entry/home-cover.png'
LAYER_DIR = ROOT / 'site/assets/live2d/source-v2'
PREVIEW = ROOT / 'tmp/lion-v2-closed-eyes-preview.png'

# Only the eye sockets move; the brows, forehead ornaments, and original head stay fixed.
EYES = {
    'EyeClosed_L': {
        'bounds': (900, 338, 1015, 403),
        'outline': [(902, 368), (920, 346), (952, 338), (987, 345),
                    (1012, 368), (1001, 393), (964, 402), (925, 397)],
        'texture': (1015, 225, 1110, 285),
        'seam': [(914, 370), (936, 377), (961, 378), (989, 373), (1003, 368)],
    },
    'EyeClosed_R': {
        'bounds': (1282, 420, 1348, 470),
        'outline': [(1284, 443), (1295, 427), (1315, 421), (1336, 430),
                    (1346, 444), (1337, 462), (1314, 469), (1294, 461)],
        'texture': (1385, 325, 1470, 390),
        'seam': [(1290, 445), (1305, 451), (1320, 451), (1334, 446), (1342, 442)],
    },
}


def build_eye(source, spec):
    x0, y0, x1, y1 = spec['bounds']
    width, height = x1 - x0, y1 - y0
    mask = Image.new('L', (width, height), 0)
    ImageDraw.Draw(mask).polygon([(x - x0, y - y0) for x, y in spec['outline']], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2.5))
    # A controlled warm-red eyelid is more coherent than copying nearby facial
    # ornament pixels into the eye socket. The original open eye is fully hidden.
    texture = Image.new('RGBA', (width, height), (112, 22, 18, 255))
    highlight = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.ellipse((width * 0.1, height * 0.1, width * 0.9, height * 0.72), fill=(184, 39, 27, 150))
    highlight = highlight.filter(ImageFilter.GaussianBlur(9))
    texture = Image.alpha_composite(texture, highlight)
    texture.putalpha(mask)

    seam = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    line = [(x - x0, y - y0) for x, y in spec['seam']]
    drawer = ImageDraw.Draw(seam)
    drawer.line(line, fill=(64, 15, 12, 220), width=7, joint='curve')
    drawer.line([(x, y - 3) for x, y in line], fill=(172, 43, 30, 220), width=5, joint='curve')
    texture = Image.alpha_composite(texture, seam)
    layer = Image.new('RGBA', source.size, (0, 0, 0, 0))
    layer.alpha_composite(texture, (x0, y0))
    return layer


def main():
    source = Image.open(SOURCE).convert('RGBA')
    background = Image.open(LAYER_DIR / 'Background_Repair.png').convert('RGBA')
    head = Image.open(LAYER_DIR / 'Lion_Head.png').convert('RGBA')
    preview = Image.alpha_composite(background, head)
    for name, spec in EYES.items():
        layer = build_eye(source, spec)
        layer.save(LAYER_DIR / f'{name}.png')
        preview = Image.alpha_composite(preview, layer)
    preview.save(PREVIEW)
    print(PREVIEW)


if __name__ == '__main__':
    main()
