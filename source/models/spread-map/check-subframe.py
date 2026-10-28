"""Confirm a Blender still render leaves the requested camera subframe intact.

E:/Blender/blender.exe -b source/models/spread-map/world-map.blend -P source/models/spread-map/check-subframe.py
This renders a small, single-sample image in memory and does not modify the blend.
"""
import bpy
import json

scene = bpy.context.scene
scene.render.resolution_percentage = 10
scene.cycles.samples = 1
scene.cycles.device = 'CPU'

def camera_state():
    bpy.context.view_layer.update()
    camera = scene.camera
    return {
        'frame': scene.frame_current_final,
        'camera_translation': list(camera.matrix_world.translation),
        'ortho_scale': camera.data.ortho_scale,
    }

scene.frame_set(21, subframe=.4)
before = camera_state()
bpy.ops.render.render(write_still=False)
after = camera_state()
scene.frame_set(21, subframe=.8)
next_frame = camera_state()
assert abs(before['frame'] - 21.4) < .001
assert before == after, (before, after)
assert abs(next_frame['frame'] - 21.8) < .001
assert next_frame['camera_translation'] != before['camera_translation']
assert next_frame['ortho_scale'] != before['ortho_scale']
print('SUBFRAME_CHECK ' + json.dumps({'before_render': before, 'after_render': after, 'next_subframe': next_frame}), flush=True)
