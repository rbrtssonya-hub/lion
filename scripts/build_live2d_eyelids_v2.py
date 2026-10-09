from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source/public/assets/entry/home-cover.png'
LAYER_DIR = ROOT / 'source/live2d/source-v2'
PREVIEW_DIR = ROOT / 'source/reviews/live2d'

EYELIDS = {
    'Eyelid_L': [
        (765, 178), (815, 115), (880, 95), (960, 105),
        (1020, 145), (1070, 225), (1090, 322), (1050, 370),
        (1015, 320), (950, 285), (870, 260), (800, 230),
    ],
    'Eyelid_R': [
        (1170, 295), (1200, 255), (1275, 220), (1380, 205),
        (1460, 235), (1505, 305), (1490, 375), (1435, 410),
        (1360, 385), (1290, 350), (1220, 340),
    ],
}


def make_layer(source, head_alpha, points):
    mask = Image.new('L', source.size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    layer = source.copy()
    layer.putalpha(ImageChops.multiply(mask, head_alpha))
    return layer


def shifted(layer, offset):
    result = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    result.alpha_composite(layer, offset)
    return result


def main():
    source = Image.open(SOURCE).convert('RGBA')
    head = Image.open(LAYER_DIR / 'Lion_Head.png').convert('RGBA')
    background = Image.open(LAYER_DIR / 'Background_Repair.png').convert('RGBA')
    if source.size != head.size or source.size != background.size:
        raise ValueError('Live2D layers must share the cover canvas size')

    eyelids = {}
    for name, points in EYELIDS.items():
        eyelids[name] = make_layer(source, head.getchannel('A'), points)
        eyelids[name].save(LAYER_DIR / f'{name}.png')

    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    neutral = Image.alpha_composite(background, head)
    neutral.save(PREVIEW_DIR / 'lion-v2-neutral.png')
    closed = Image.alpha_composite(neutral, shifted(eyelids['Eyelid_L'], (0, 80)))
    closed = Image.alpha_composite(closed, shifted(eyelids['Eyelid_R'], (0, 65)))
    closed.save(PREVIEW_DIR / 'lion-v2-blink-probe.png')


if __name__ == '__main__':
    main()
