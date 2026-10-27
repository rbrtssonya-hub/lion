import bpy
import sys
from pathlib import Path

# Run with: blender -b world-map.blend -P render-shots.py -- OUTPUT_DIRECTORY
output = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
output.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.resolution_percentage = 50
scene.cycles.samples = 12
scene.render.image_settings.file_format = 'PNG'
for frame, name in [(1, 'guangdong'), (100, 'china'), (200, 'world')]:
    scene.frame_set(frame)
    scene.render.filepath = str(output / (name + '.png'))
    bpy.ops.render.render(write_still=True)
