from pathlib import Path
import shutil

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Image.open(ROOT / 'site/assets/entry/home-cover.png').convert('RGBA')
HEAD = Image.open(ROOT / 'site/assets/live2d/source-v2/Lion_Head.png').convert('RGBA')
REPAIR = Image.open(ROOT / 'site/assets/live2d/source-v2/Background_Repair.png').convert('RGBA')
OUT = ROOT / 'site/assets/live2d/source-v4'
PREVIEW = ROOT / 'tmp/lion-v4-eye-preview.png'


EYES = {
    'L': {
        'outer': [(841, 323), (873, 285), (935, 267), (1005, 282), (1057, 329),
                  (1067, 391), (1030, 444), (972, 472), (902, 459), (854, 418)],
        'pupil': (928, 327, 1000, 397),
        'lid': [(835, 326), (868, 281), (934, 263), (1008, 278), (1065, 321),
                (1046, 354), (1004, 335), (950, 323), (894, 331), (851, 363)],
        'center': (950, 370),
    },
    'R': {
        'outer': [(1238, 394), (1268, 365), (1310, 354), (1360, 366), (1400, 401),
                  (1418, 451), (1402, 495), (1360, 521), (1305, 513), (1261, 480)],
        'pupil': (1288, 413, 1344, 469),
        'lid': [(1236, 398), (1264, 363), (1310, 350), (1362, 362), (1404, 397),
                (1390, 425), (1350, 407), (1305, 401), (1260, 416)],
        'center': (1310, 445),
    },
}


def mask_for(points, blur=1.2):
    mask = Image.new('L', SOURCE.size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(blur))


def layer_from_mask(mask, *, source=SOURCE):
    layer = source.copy()
    layer.putalpha(mask)
    return layer


def subtract_mask(image, masks):
    alpha = image.getchannel('A')
    for mask in masks:
        alpha = alpha.copy()
        alpha = alpha.point(lambda value: value)
        alpha = Image.fromarray(__import__('numpy').minimum(__import__('numpy').array(alpha), 255 - __import__('numpy').array(mask)).astype('uint8'))
    image.putalpha(alpha)
    return image


def make_eye_layers(side, spec):
    outer = mask_for(spec['outer'], 1.0)
    pupil = Image.new('L', SOURCE.size, 0)
    ImageDraw.Draw(pupil).ellipse(spec['pupil'], fill=255)
    pupil = pupil.filter(ImageFilter.GaussianBlur(1.0))
    # The complete eye artwork excludes only the movable black pupil.
    eye_mask = Image.fromarray(__import__('numpy').maximum(0, __import__('numpy').array(outer) - __import__('numpy').array(pupil)).astype('uint8'))
    lid_mask = mask_for(spec['lid'], 1.0)
    return {
        f'Eye_{side}': layer_from_mask(eye_mask),
        f'Pupil_{side}': layer_from_mask(pupil),
        f'Eyelid_{side}': layer_from_mask(lid_mask),
    }


def main():
    import numpy as np

    OUT.mkdir(parents=True, exist_ok=True)
    base = HEAD.copy()
    eye_masks = []
    layers = {}
    for side, spec in EYES.items():
        generated = make_eye_layers(side, spec)
        layers.update(generated)
        eye_masks.append(mask_for(spec['outer'], 2.0))

    # Remove the original eye pixels from the head base so the independent eye
    # and upper-eyelid layers can move without leaving a duplicate eye behind.
    alpha = np.array(base.getchannel('A'), dtype=np.uint8)
    for mask in eye_masks:
        alpha = np.minimum(alpha, 255 - np.array(mask, dtype=np.uint8))
    base.putalpha(Image.fromarray(alpha, mode='L'))

    shutil.copy2(ROOT / 'site/assets/live2d/source-v2/Background_Repair.png', OUT / 'Background_Repair.png')
    base.save(OUT / 'Lion_Head_Base.png')
    for name, image in layers.items():
        image.save(OUT / f'{name}.png')

    # Preview: base -> eyes -> pupils (open state), then eyelids dropped over both eyes.
    preview = Image.alpha_composite(REPAIR, base)
    for name in ('Eye_L', 'Eye_R', 'Pupil_L', 'Pupil_R'):
        preview = Image.alpha_composite(preview, layers[name])
    open_preview = preview.copy()
    for name in ('Eyelid_L', 'Eyelid_R'):
        preview = Image.alpha_composite(preview, layers[name])
    preview.save(PREVIEW)
    open_preview.save(ROOT / 'tmp/lion-v4-eye-open-preview.png')
    print(f'wrote {OUT}')
    print(f'preview={PREVIEW}')


if __name__ == '__main__':
    main()
