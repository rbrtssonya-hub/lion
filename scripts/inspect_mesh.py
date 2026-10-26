import bpy,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
o=bpy.data.objects['Lion_Nose.003'];mesh=o.data
parents=list(range(len(mesh.vertices)))
def find(x):
 while parents[x]!=x:
  parents[x]=parents[parents[x]];x=parents[x]
 return x
for e in mesh.edges:
 a,b=map(find,e.vertices)
 if a!=b:parents[b]=a
groups={}
for i,v in enumerate(mesh.vertices):groups.setdefault(find(i),[]).append(i)
rows=[]
for inds in groups.values():
 vs=[o.matrix_world@mesh.vertices[i].co for i in inds]
 mn=[min(v[k] for v in vs) for k in range(3)];mx=[max(v[k] for v in vs) for k in range(3)]
 rows.append({'count':len(inds),'min':mn,'max':mx,'center':[(a+b)/2 for a,b in zip(mn,mx)],'indices':inds})
rows.sort(key=lambda x:-x['count'])
(ROOT/'public/data/head-components.json').write_text(json.dumps(rows),encoding='utf8')
print(json.dumps([{k:v for k,v in r.items() if k!='indices'} for r in rows[:40]]),flush=True)
print('total components',len(rows),flush=True)
for name in ['Brocade_Clear_Tile_Cloth_Study','HighDetail_Head_Atlas_PBR.003']:
 m=bpy.data.materials[name]
 print('LINKS',name,[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_tree.links],flush=True)
for key,name in [('brocade_reference_synthesis.png','brocade.png'),('Lion_Atlas_Color_Refined.003','head-atlas.png')]:
 i=bpy.data.images.get(key)
 if i and i.packed_file:(ROOT/'public/models'/name).write_bytes(i.packed_file.data)
