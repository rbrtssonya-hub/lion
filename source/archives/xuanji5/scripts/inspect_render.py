import bpy, json, os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
for o in bpy.data.objects:
 if o.type=='CURVES':
  print('HAIR',o.name,'curves',len(o.data.curves),'points',len(o.data.points),'modifiers',[(m.name,m.type) for m in o.modifiers],flush=True)
 if o.type=='MESH' and o.modifiers: print('MODIFIERS',o.name,[(m.name,m.type) for m in o.modifiers],flush=True)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=12
scene.cycles.use_denoising=True
scene.render.resolution_x=1100
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.render.film_transparent=False
scene.world.color=(.7,.7,.7)
cam=scene.camera
cam.location=(1.65,-2.65,1.35)
cam.rotation_euler=(Vector((0,0,.48))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=1.95
scene.render.filepath=str(ROOT/'public'/'models'/'source-preview.png')
Path(scene.render.filepath).parent.mkdir(parents=True,exist_ok=True)
bpy.ops.render.render(write_still=True)
