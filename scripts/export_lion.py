"""Non-destructive web derivative. Source is never saved. glTF coordinates: x, z, -y."""
import bpy, json, math, hashlib, re
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
MODEL=ROOT/'public/models';DATA=ROOT/'public/data'
MODEL.mkdir(exist_ok=True,parents=True);DATA.mkdir(exist_ok=True,parents=True)
SOURCE_OBJECTS=list(bpy.context.scene.objects)
FULL_HAIR='--with-hair' in __import__('sys').argv

def part(name):
 if name.startswith('Lion_Brow'):return 'brows'
 if name.startswith(('Lion_Crown','Lion_Forehead','Lion_Head')):return 'crown'
 if name.startswith('Lion_Beard') or name in ['粒子系统.001','粒子系统.002']:return 'beard'
 if name.startswith('Lion_Body_Red_Trim'):return 'trim'
 if name.startswith('Lion_Body'):return 'body'
 if name in ['上牙','牙下','立方体']:return 'mouth'
 if name.startswith('Lion_Ear'):return 'ears'
 if name.startswith('Lion_Tail') or name=='粒子系统':return 'tail'
 if name.startswith('Lion_Nose'):return 'head'
 return 'limbs'
def gl(v):return [round(float(v[0]),6),round(float(v[2]),6),round(float(-v[1]),6)]
def bounds(points):
 p=np.asarray(points);mn=p.min(axis=0);mx=p.max(axis=0)
 return {'min':mn.round(6).tolist(),'max':mx.round(6).tolist(),'center':((mn+mx)/2).round(6).tolist(),'size':(mx-mn).round(6).tolist()}
def hull(points):
 p=sorted(set(tuple(p) for p in points))
 def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
 lower=[];upper=[]
 for v in p:
  while len(lower)>=2 and cross(lower[-2],lower[-1],v)<=0:lower.pop()
  lower.append(v)
 for v in reversed(p):
  while len(upper)>=2 and cross(upper[-2],upper[-1],v)<=0:upper.pop()
  upper.append(v)
 return [list(v) for v in lower[:-1]+upper[:-1]]

# Identical packed texture datablocks can be shared without changing pixels.
canonical={}
for i in bpy.data.images:
 if i.packed_file:
  key=hashlib.sha256(i.packed_file.data).hexdigest()
  if key not in canonical:canonical[key]=i
  else:
   for m in bpy.data.materials:
    if m.node_tree:
     for n in m.node_tree.nodes:
      if n.type=='TEX_IMAGE' and n.image==i:n.image=canonical[key]

deps=bpy.context.evaluated_depsgraph_get()
web=bpy.data.collections.new('THE_LION_ATLAS_DERIVED');bpy.context.scene.collection.children.link(web)
objects=[];points_by_part={};new_objects=[];curve_paths=[]
for source in SOURCE_OBJECTS:
 if source.type!='MESH':continue
 mesh=bpy.data.meshes.new_from_object(source.evaluated_get(deps),preserve_all_data_layers=True,depsgraph=deps)
 mesh.validate(verbose=False,clean_customdata=False)
 matrix=source.matrix_world.copy()
 world=[matrix@v.co for v in mesh.vertices]
 center=Vector([sum(v[k] for v in world)/len(world) for k in range(3)])
 # A native object becomes one independently positioned object in the derivative.
 mesh.transform(Matrix.Translation(-center)@matrix)
 name={'上牙':'Upper_Teeth','牙下':'Lower_Teeth','立方体':'Tongue'}.get(source.name,source.name)
 obj=bpy.data.objects.new('web_'+name,mesh);web.objects.link(obj);obj.location=center
 obj['atlasPart']=part(source.name);obj['sourceName']=source.name;obj['sourceParent']=source.parent.name if source.parent else ''
 obj['sourceParticleEmitter']=bool(len(source.particle_systems))
 obj['derivation']='evaluated-native-mesh'
 pts=np.array([gl(v) for v in world]);bb=bounds(pts)
 mesh.calc_loop_triangles()
 row={'name':obj.name,'sourceName':source.name,'sourceParent':obj['sourceParent'],'part':obj['atlasPart'],'bounds':bb,'vertices':len(mesh.vertices),'triangles':len(mesh.loop_triangles),'materials':[m.name if m else None for m in mesh.materials]}
 objects.append(row);new_objects.append(obj)
 points_by_part.setdefault(obj['atlasPart'],[]).append(pts)
 if obj['atlasPart']=='body' and source.name=='Lion_Body' and mesh.uv_layers.active:
  uv=mesh.uv_layers.active.data
  rows=[]
  for ti in range(0,len(mesh.loop_triangles),max(1,len(mesh.loop_triangles)//450)):
   tr=mesh.loop_triangles[ti];rows.append([[round(float(c),5) for c in uv[li].uv] for li in tr.loops])
  (DATA/'body-uv.json').write_text(json.dumps(rows),encoding='utf8')

def ribbons(name,paths,radius,material,category,source_name,root_uvs=None,emitter_names=None):
 verts=[];faces=[]
 for path in paths:
  if len(path)<2:continue
  start=len(verts)
  for j,p in enumerate(path):
   tangent=(path[min(j+1,len(path)-1)]-path[max(0,j-1)])
   if tangent.length<1e-8:tangent=Vector((0,0,1))
   tangent.normalize();ref=Vector((0,1,0))
   if abs(tangent.dot(ref))>.95:ref=Vector((1,0,0))
   normal=tangent.cross(ref).normalized()
   width=radius*(1-.93*j/(len(path)-1))
   verts.extend([p-normal*width,p+normal*width])
   if j:
    a=start+(j-1)*2;b=start+j*2
    faces.append((a,b,b+1,a+1))
 if not verts:return
 center=sum(verts,Vector())/len(verts)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([v-center for v in verts],[],faces);mesh.update()
 mesh.materials.append(material)
 if root_uvs is not None:
  uv=mesh.uv_layers.new(name='UVMap')
  # One root UV per parent hair, held along the strand as in emitter-driven shading.
  # Faces are appended in the same order as valid paths above.
  fi=0
  for pi,path in enumerate(paths):
   if len(path)<2:continue
   for _ in range(len(path)-1):
    for li in mesh.polygons[fi].loop_indices:uv.data[li].uv=root_uvs[pi]
    fi+=1
 for p in mesh.polygons:p.use_smooth=True
 obj=bpy.data.objects.new(name,mesh);web.objects.link(obj);obj.location=center
 obj['atlasPart']=category;obj['sourceName']=source_name;obj['derivation']='sampled-original-hair-ribbon';obj['derivedHair']=True
 if emitter_names:obj['sourceEmitterNames']=';'.join(sorted(emitter_names))
 new_objects.append(obj)

# New Blender hair curves do not export to glTF. Real source paths are sampled,
# not invented. Two-sided tapered ribbons retain their direction and silhouette.
for source in SOURCE_OBJECTS:
 if source.type!='CURVES':continue
 paths=[]
 for ci,c in enumerate(source.data.curves):
  if ci%max(1,len(source.data.curves)//96)==0:
   curve_paths.append({'sourceName':source.name,'part':part(source.name),'points':[gl(source.matrix_world@p.position) for p in c.points]})
  if FULL_HAIR and ci%2==0:paths.append([source.matrix_world@p.position for p in c.points])
 if FULL_HAIR:
  material=bpy.data.materials.get('Fiber_Warm_Ivory')
  if not material:
   material=bpy.data.materials.new('Fiber_Warm_Ivory_Web');material.diffuse_color=(.74,.72,.68,1)
  material.use_backface_culling=False
  ribbons('web_hair_'+part(source.name)+'_'+str(len(new_objects)),paths,.00047,material,part(source.name),source.name)

# Short velvet: export actual parent hair samples; child interpolation is Blender-only.
hair_material_sources=[]
if FULL_HAIR:
 hair_groups={}
 for source in SOURCE_OBJECTS:
  if source.type!='MESH' or not len(source.particle_systems):continue
  evaluated=source.evaluated_get(deps)
  ps=evaluated.particle_systems[0]
  modifier=next(m for m in evaluated.modifiers if m.type=='PARTICLE_SYSTEM')
  slot=ps.settings.material-1
  mat=source.data.materials[slot] if 0<=slot<len(source.data.materials) else None
  if not mat:raise RuntimeError('Missing original particle material: '+source.name)
  key=(part(source.name),mat.name)
  group=hair_groups.setdefault(key,{'paths':[],'uvs':[],'emitters':set(),'material':mat})
  group['emitters'].add(source.name)
  hair_material_sources.append({'sourceName':source.name,'part':part(source.name),'material':mat.name,'materialSlot':slot,'parentHairCount':len(ps.particles),'uvSource':source.data.uv_layers[0].name if len(source.data.uv_layers) else None})
  for pi,p in enumerate(ps.particles):
   path=[source.matrix_world@k.co for k in p.hair_keys]
   if len(path)>=2:
    uv=ps.uv_on_emitter(modifier,p,particle_no=pi,uv_no=0) if len(source.data.uv_layers) else (0,0)
    group['paths'].append(path);group['uvs'].append(tuple(uv))
 for (category,material_name),group in hair_groups.items():
  mat=group['material'];paths=group['paths']
  mat.use_backface_culling=False
  slug=re.sub(r'[^A-Za-z0-9_]','_',material_name)
  ribbons('web_velvet_'+category+'_'+slug,paths,.00025,mat,category,';'.join(sorted(group['emitters'])),root_uvs=group['uvs'],emitter_names=group['emitters'])

parts=[]
for pid,sets in points_by_part.items():
 points=np.concatenate(sets);bb=bounds(points)
 axes=(2,1) if pid in ['body','trim','tail'] else (0,1)
 rows=[o for o in objects if o['part']==pid]
 row={'id':pid,'bounds':bb,'meshNames':[o['name'] for o in rows],'sourceNames':[o['sourceName'] for o in rows],
      'vertices':sum(o['vertices'] for o in rows),'triangles':sum(o['triangles'] for o in rows),
      'objectCount':len(rows),'outline':hull(points[:,axes].round(5).tolist()),'projectionAxes':list(axes),
      'samples':points[::max(1,len(points)//1400)].round(5).tolist(),'structures':rows}
 if pid=='trim':
  bins=np.linspace(points[:,2].min(),points[:,2].max(),49)
  profile=[]
  for a,b in zip(bins[:-1],bins[1:]):
   sample=points[(points[:,2]>=a)&(points[:,2]<=b)]
   if len(sample):profile.append([round(float((a+b)/2),6),round(float(sample[:,1].max()),6),round(float(sample[:,1].min()),6)])
  row['profile']=profile
 parts.append(row)
allpoints=np.concatenate([np.concatenate(v) for v in points_by_part.values()])
report={'coordinateSystem':'glTF Y-up; source [x,y,z] maps to [x,z,-y]; front +Z','bounds':bounds(allpoints),'sourceTriangles':577721,'nativeMeshCount':53,'sourceHairCurves':169801,'hairIncluded':FULL_HAIR,'hairMaterialSources':hair_material_sources,'objects':objects,'parts':parts,'curves':curve_paths,'textures':{'brocade':'/models/brocade.png','head':'/models/head-atlas.png'},'limitations':['Eyes are fused into Lion_Nose.003 (head); brows are native independent meshes.','Short velvet child interpolation is Blender-specific; derivative uses actual parent hair samples.','Hair ribbons are a sampled derivative of the original curves, not the original strand render.']}
(DATA/'model-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
(DATA/'curves.json').write_text(json.dumps(curve_paths,ensure_ascii=False),encoding='utf8')

bpy.ops.object.select_all(action='DESELECT')
for o in new_objects:o.select_set(True)
bpy.context.view_layer.objects.active=new_objects[0]
print('EXPORTING',len(new_objects),'objects; hair',FULL_HAIR,flush=True)
bpy.ops.export_scene.gltf(filepath=str(MODEL/'lion.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=False,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_image_format='AUTO',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
print('SAVED',MODEL/'lion.glb',(MODEL/'lion.glb').stat().st_size,flush=True)
if '--render-derived' in __import__('sys').argv:
 for o in SOURCE_OBJECTS:
  if o.type in ['MESH','CURVES']:o.hide_render=True
 exec((ROOT/'scripts/inspect_render.py').read_text(encoding='utf8').replace("'source-preview.png'","'derived-preview.png'"))
