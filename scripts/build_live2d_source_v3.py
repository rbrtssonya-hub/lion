from pathlib import Path
import shutil

import numpy as np
from PIL import Image
from pytoshop import enums, layers
import pytoshop


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'site/assets/live2d/source-v2'
OUTPUT_DIR = ROOT / 'site/assets/live2d/source-v3'
PSD_PATH = ROOT / 'tmp/nanfeng-lion-v3.psd'


def record(path: Path, name: str):
    image = Image.open(path).convert('RGBA')
    rgba = np.asarray(image, dtype=np.uint8)
    channels = {
        0: layers.ChannelImageData(image=rgba[:, :, 0]),
        1: layers.ChannelImageData(image=rgba[:, :, 1]),
        2: layers.ChannelImageData(image=rgba[:, :, 2]),
        -1: layers.ChannelImageData(image=rgba[:, :, 3]),
    }
    return layers.LayerRecord(
        top=0,
        left=0,
        bottom=image.height,
        right=image.width,
        name=name,
        channels=channels,
        color_mode=enums.ColorMode.rgb,
    ), image


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    names = [
        ('Background_Repair.png', 'Background_Repair'),
        ('Lion_Head.png', 'Lion_Head'),
        ('EyeClosed_L.png', 'EyeClosed_L'),
        ('EyeClosed_R.png', 'EyeClosed_R'),
    ]
    records = []
    base = None
    for filename, name in names:
        source = SOURCE_DIR / filename
        target = OUTPUT_DIR / filename
        shutil.copy2(source, target)
        current_record, image = record(target, name)
        records.append(current_record)
        base = image if base is None else base

    if base is None or base.size != (2048, 1152):
        raise ValueError('Expected full-cover 2048x1152 layers')

    full = np.asarray(base, dtype=np.uint8)
    image_data = pytoshop.image_data.ImageData(
        channels=np.stack([full[:, :, 0], full[:, :, 1], full[:, :, 2]]),
        compression=enums.Compression.raw,
    )
    layer_info = layers.LayerInfo(list(reversed(records)), use_alpha_channel=True)
    psd = pytoshop.PsdFile(
        num_channels=3,
        height=base.height,
        width=base.width,
        color_mode=enums.ColorMode.rgb,
        layer_and_mask_info=layers.LayerAndMaskInfo(layer_info=layer_info),
        image_data=image_data,
        compression=enums.Compression.raw,
    )
    with PSD_PATH.open('wb') as handle:
        psd.write(handle)
    print(f'wrote {PSD_PATH}')
    print(f'layers={len(records)} canvas={base.width}x{base.height}')


if __name__ == '__main__':
    main()
