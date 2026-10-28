"""Render a 60 fps version of the original 24 fps Blender camera animation.

E:/Blender/blender.exe -b source/models/spread-map/world-map.blend -P source/models/spread-map/render-motion-60.py -- tmp/spread-map-motion-60 --cache=tmp/spread-map-motion

The cache must contain the 204 frames from render-motion.py. Integer source
frames and the source's proven still ranges reuse those lossless images;
other samples are evaluated and rendered at their actual Blender subframes.
The 510 images cover the original 204/24 second duration at 60 fps. Index i
(zero based) corresponds to source frame 1 + i * 24 / 60. The final sample is
in the last still range. Use --cpu without an OptiX device, or --indices=1:510
to split or resume a render. Image files are named 0001.png through 0510.png.
"""
import bpy
import math
import os
import shutil
import sys
import time
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
output = Path(args[0]).resolve()
cache_arg = next((arg.split('=', 1)[1] for arg in args if arg.startswith('--cache=')), None)
if not cache_arg:
    raise ValueError('Specify --cache=<directory of original 204 PNG frames>')
cache = Path(cache_arg).resolve()
for frame in range(1, 205):
    if not (cache / f'{frame:04d}.png').is_file():
        raise FileNotFoundError(f'Missing original frame: {frame:04d}.png')
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
if scene.render.fps / scene.render.fps_base != 24 or scene.frame_start != 1 or scene.frame_end != 204:
    raise ValueError('Expected source timeline frames 1–204 at 24 fps')
scene.render.resolution_percentage = 50
scene.cycles.samples = 12
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
if '--cpu' not in args:
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'OPTIX'
    preferences.get_devices()
    if not any(device.type == 'OPTIX' for device in preferences.devices):
        raise RuntimeError('No OptiX device found; retry with --cpu')
    for device in preferences.devices:
        device.use = device.type == 'OPTIX'
    scene.cycles.device = 'GPU'
else:
    scene.cycles.device = 'CPU'

range_arg = next((arg.split('=', 1)[1] for arg in args if arg.startswith('--indices=')), '1:510')
first, last = map(int, range_arg.split(':'))
if not (1 <= first <= last <= 510):
    raise ValueError('Expected output indices in 1:510')

start = time.monotonic()
for index in range(first, last + 1):
    target = output / f'{index:04d}.png'
    if target.exists():
        with target.open('rb') as existing:
            signature = existing.read(8)
            existing.seek(-12, 2)
            end = existing.read(12)
        if signature == b'\x89PNG\r\n\x1a\n' and end == b'\x00\x00\x00\x00IEND\xaeB`\x82':
            print(f'SKIP {index}', flush=True)
            continue
        raise RuntimeError(f'Incomplete frame: {target}')
    # Integer arithmetic keeps exact integer samples from being rounded away.
    numerator = 5 + 2 * (index - 1)
    source_frame = numerator / 5
    cached_frame = (1 if source_frame <= 19 else
                    100 if 93 <= source_frame <= 111 else
                    200 if source_frame >= 186 else
                    numerator // 5 if numerator % 5 == 0 else None)
    if cached_frame is not None:
        original = cache / f'{cached_frame:04d}.png'
        try:
            os.link(original, target)
        except OSError:
            shutil.copyfile(original, target)
        action = f'CACHE {cached_frame}'
    else:
        whole = math.floor(source_frame)
        scene.frame_set(whole, subframe=source_frame - whole)
        scene.render.filepath = str(target)
        bpy.ops.render.render(write_still=True)
        action = f'RENDER {source_frame:.1f}'
    print(f'FRAME {index}/510 {action} elapsed={time.monotonic() - start:.1f}s', flush=True)
