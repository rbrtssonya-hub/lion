"""Render the complete source animation to a lossless image sequence.

E:/Blender/blender.exe -b source/models/spread-map/world-map.blend -P source/models/spread-map/render-motion.py -- tmp/spread-map-motion
Then encode the sequence with the commands in the accompanying README.
Pass --cpu after the output path to render without an NVIDIA OptiX device.
"""
import bpy
import sys
import time
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
output = Path(args[0]).resolve()
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.resolution_percentage = 50
scene.cycles.samples = 12
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
if '--cpu' not in args:
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'OPTIX'
    preferences.get_devices()
    devices = [device for device in preferences.devices if device.type == 'OPTIX']
    if not devices:
        raise RuntimeError('No OptiX device found; retry with --cpu')
    for device in preferences.devices:
        device.use = device.type == 'OPTIX'
    scene.cycles.device = 'GPU'
else:
    scene.cycles.device = 'CPU'
start = time.monotonic()
frame_range = next((arg.split('=', 1)[1] for arg in args if arg.startswith('--frames=')), None)
first, last = (map(int, frame_range.split(':')) if frame_range else (scene.frame_start, scene.frame_end))
for frame in range(first, last + 1):
    target = output / f'{frame:04d}.png'
    if target.exists():
        with target.open('rb') as existing:
            signature = existing.read(8)
            existing.seek(-12, 2)
            end = existing.read(12)
        if signature == b'\x89PNG\r\n\x1a\n' and end == b'\x00\x00\x00\x00IEND\xaeB`\x82':
            print(f'SKIP {frame} {target}', flush=True)
            continue
        raise RuntimeError(f'Incomplete frame: {target}')
    scene.frame_set(frame)
    scene.render.filepath = str(target)
    bpy.ops.render.render(write_still=True)
    print(f'FRAME {frame}/{scene.frame_end} elapsed={time.monotonic() - start:.1f}s', flush=True)
