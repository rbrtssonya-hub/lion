"""Independent Blender read-only source/complete-sidecar audit; never save .blend."""
import argparse, sys
import bpy, gzip, hashlib, json, struct, random, math, time
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--original', type=Path, required=True, help='The original user Blender file, read only')
parser.add_argument('--source', type=Path, default=ROOT/'source/models/user-lion-2026-10-20.blend')
parser.add_argument('--output', type=Path, default=ROOT/'tmp/full-lion-source-verification.json')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
SOURCE=args.source.resolve()
ORIGINAL=args.original.resolve()
PUBLIC=ROOT/'source/public/assets/models'
OUT=args.output.resolve()
if bpy.app.version < (5,1,0):
    raise RuntimeError('Blender 5.1+ is required to read this source safely')
if OUT.suffix.lower() != '.json' or OUT in (SOURCE, ORIGINAL):
    raise ValueError('Audit output must be a separate .json file')
OUT.parent.mkdir(parents=True,exist_ok=True)
EXPECTED='dcfd8b97a27c371381aa7a0b1c26f5081fc4a35976a571979596aec353d6f770'
REPORT={'method':'Independent read-only Blender 5.1.2 audit. No modifier_convert or source saving. Every authored Curves point compared; independently sampled complete particle paths using co_hair.', 'checks':[], 'curves':[], 'particle_systems':[], 'groups':[], 'meshes':[], 'errors':[]}

def sha(data): return hashlib.sha256(data).hexdigest()
def check(label, condition, **details):
    row={'name':label,'pass':bool(condition),**details}; REPORT['checks'].append(row)
    if not condition: REPORT['errors'].append(row)
def flush(): OUT.write_text(json.dumps(REPORT,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def convert(xyz,matrix):
    xyz=xyz @ matrix[:3,:3].T+matrix[:3,3]
    return xyz[..., [0,2,1]] * np.array([1,1,-1],dtype=np.float32)
def accessor(gltf, blob, number):
    a=gltf['accessors'][number]; view=gltf['bufferViews'][a['bufferView']]
    dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    assert not view.get('byteStride'), 'Interleaved GLB requires accessor support'
    return np.frombuffer(blob,dtype=dtype,count=a['count']*size,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(a['count'],size)
def triangle_rows(xyz):
    # Preserve winding; only cyclic rotation and triangle order are irrelevant.
    xyz=xyz.copy(); xyz[xyz==0]=0
    first=np.lexsort((xyz[:,:,2],xyz[:,:,1],xyz[:,:,0]),axis=1)[:,0]
    order=(first[:,None]+np.arange(3))%3
    canonical=np.take_along_axis(xyz,order[:,:,None],axis=1)
    return np.sort(np.ascontiguousarray(canonical).reshape(-1,9).view('V36').reshape(-1))

try:
    before=sha(SOURCE.read_bytes()); original_before=sha(ORIGINAL.read_bytes())
    check('source_original_archive_expected_sha',before==original_before==EXPECTED,archive_sha256=before,original_sha256=original_before)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False)
    bpy.context.view_layer.update()
    manifest=json.loads((PUBLIC/'lion-user-hair.json').read_text(encoding='utf-8'))
    export=json.loads((ROOT/'source/references/lion-structure-model.json').read_text(encoding='utf-8'))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    curves=[o for o in bpy.context.scene.objects if o.type=='CURVES']
    data=(PUBLIC/'lion-user-full.glb').read_bytes()
    json_size=struct.unpack_from('<I',data,12)[0]
    gltf=json.loads(data[20:20+json_size]); binary=data[28+json_size:]
    names=[n['name'] for n in gltf['nodes'] if 'mesh' in n]
    check('GLB_53_meshes_102_nodes',len(gltf['meshes'])==53 and len(gltf['nodes'])==102,meshes=len(gltf['meshes']),nodes=len(gltf['nodes']))
    check('GLB_all_53_source_mesh_names',len(meshes)==53 and set(names)=={o.name for o in meshes},missing=sorted({o.name for o in meshes}-set(names)),extra=sorted(set(names)-{o.name for o in meshes}))
    dg=bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        evaluated=o.evaluated_get(dg); mesh=evaluated.to_mesh(); mesh.calc_loop_triangles()
        node=next(n for n in gltf['nodes'] if n.get('name')==o.name and 'mesh' in n)
        gm=gltf['meshes'][node['mesh']]
        triangles=sum(gltf['accessors'][p['indices']]['count']//3 for p in gm['primitives'])
        source_xyz=np.empty(len(mesh.vertices)*3,dtype=np.float32)
        mesh.vertices.foreach_get('co',source_xyz)
        source_xyz=source_xyz.reshape(-1,3)[:,[0,2,1]] * np.array([1,1,-1],dtype=np.float32)
        gltf_xyz=np.concatenate([accessor(gltf,binary,p['attributes']['POSITION']) for p in gm['primitives']])
        # Full vertex-position coverage, allowing glTF's UV/normal/material splits.
        # Rounded integer keys are used only for audit lookup, never written to assets.
        rounded_source={tuple(np.round(v,5)) for v in source_xyz}
        rounded_export={tuple(np.round(v,5)) for v in gltf_xyz}
        source_used=set(i for tri in mesh.loop_triangles for i in tri.vertices)
        rounded_source_used={tuple(np.round(source_xyz[i],5)) for i in source_used}
        coverage=rounded_source_used==rounded_export
        source_indices=np.empty(len(mesh.loop_triangles)*3,dtype=np.int32)
        mesh.loop_triangles.foreach_get('vertices',source_indices)
        source_triangle_rows=triangle_rows(source_xyz[source_indices.reshape(-1,3)])
        exported_triangle_xyz=np.concatenate([accessor(gltf,binary,p['attributes']['POSITION'])[accessor(gltf,binary,p['indices']).reshape(-1,3)] for p in gm['primitives']])
        exported_triangle_rows=triangle_rows(exported_triangle_xyz)
        triangles_exact=np.array_equal(source_triangle_rows,exported_triangle_rows)
        row={'name':o.name,'source_evaluated_vertices':len(mesh.vertices),'source_evaluated_triangles':len(mesh.loop_triangles),'gltf_triangles':triangles,'gltf_split_vertices':len(gltf_xyz),'all_used_position_keys_equal_at_1e_5':coverage,'source_unique_position_keys':len(rounded_source_used),'gltf_unique_position_keys':len(rounded_export),'all_triangle_coordinates_and_winding_exact_float32':triangles_exact,'source_sorted_oriented_triangles_sha256':sha(source_triangle_rows.tobytes()),'gltf_sorted_oriented_triangles_sha256':sha(exported_triangle_rows.tobytes())}
        REPORT['meshes'].append(row)
        check('mesh_geometry_'+o.name,triangles==len(mesh.loop_triangles) and coverage and triangles_exact,**row)
        evaluated.to_mesh_clear()
    check('GLB_total_triangles',sum(m['gltf_triangles'] for m in REPORT['meshes'])==657831 and sum(m['source_evaluated_triangles'] for m in REPORT['meshes'])==657831,triangles=sum(m['gltf_triangles'] for m in REPORT['meshes']))
    check('hair_group_and_total_counts',len(manifest['groups'])==33 and manifest['totalStrands']==2295421 and manifest['totalPoints']==19957105,groups=len(manifest['groups']),strands=manifest['totalStrands'],points=manifest['totalPoints'])
    groups={g['name']:g for g in manifest['groups']}
    sources={g['name']:g for g in export['hair_source']}
    for g in manifest['groups']:
        compressed=(ROOT/'source/public'/g['path']).read_bytes(); raw=gzip.decompress(compressed)
        expected=g['strands']*g['pointsPerStrand']*16+(g['strands']*8 if g['hasRootUV'] else 0)
        ok=len(compressed)==g['bytes'] and len(raw)==g['rawBytes']==expected and sha(compressed)==g['sha256'] and sha(raw)==g['rawSha256']
        REPORT['groups'].append({'id':g['id'],'name':g['name'],'strands':g['strands'],'points_per_strand':g['pointsPerStrand'],'compressed_bytes':len(compressed),'raw_bytes':len(raw),'all_checks_pass':ok})
        check('sidecar_lengths_gzip_hashes_'+g['id'],ok)
    for o in curves:
        g=groups[o.name]; raw=gzip.decompress((ROOT/'source/public'/g['path']).read_bytes())
        side=np.frombuffer(raw,dtype='<f4',count=g['strands']*g['pointsPerStrand']*4).reshape(-1,4)
        xyz=np.array([list(p.position) for p in o.data.points],dtype=np.float32)
        xyz=convert(xyz,np.array(o.matrix_world,dtype=np.float32))
        radius=o.data.attributes.get('radius')
        radii=np.array([v.value for v in radius.data],dtype=np.float32) if radius else np.full(len(xyz),.01,dtype=np.float32)
        max_error=float(np.abs(xyz-side[:,:3]).max())
        exact=np.array_equal(xyz,side[:,:3]) and np.array_equal(radii,side[:,3])
        row={'name':o.name,'source_strands':len(o.data.curves),'source_points':len(o.data.points),'all_points_exact_float32':exact,'max_position_error_m':max_error,'radius_attribute':bool(radius),'default_radius_m':None if radius else .01}
        REPORT['curves'].append(row)
        check('CURVES_all_points_'+o.name,exact and len(o.data.curves)==g['strands'] and len(o.data.points)==g['strands']*g['pointsPerStrand'],**row)
        flush()
    rng=random.Random(20261020)
    for o in meshes:
        for ps in o.particle_systems:
            settings=ps.settings; original=(settings.display_step,settings.child_percent,settings.display_percentage)
            name=o.name+' / '+ps.name; g=groups[name]; sr=sources[name]
            guides=[[list(k.co)+[float(k.time),float(k.weight)] for k in p.hair_keys] for p in ps.particles]
            guide_hash=sha(json.dumps(guides,separators=(',',':')).encode())
            try:
                settings.display_step=settings.render_step; settings.child_percent=settings.rendered_child_count; settings.display_percentage=100
                bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get(); eo=o.evaluated_get(dg); ep=eo.particle_systems[ps.name]
                parents=len(ep.particles); children=len(ep.child_particles); point_count=(1<<settings.render_step)+1
                check('particle_source_counts_'+name,g['strands']==children and parents==1000 and point_count==g['pointsPerStrand']==9 and guide_hash==sr['source_guide_keys_sha256'],parents=parents,children=children,guide_sha256=guide_hash)
                raw=gzip.decompress((ROOT/'source/public'/g['path']).read_bytes())
                count=g['strands']*point_count*4; side=np.frombuffer(raw,dtype='<f4',count=count).reshape(g['strands'],point_count,4)
                uvs=np.frombuffer(raw,dtype='<f4',offset=count*4).reshape(g['strands'],2) if g['hasRootUV'] else None
                indices=sorted({0,1,children//2,children-2,children-1,*[rng.randrange(children) for _ in range(16)]})
                pmod=next(m for m in eo.modifiers if m.type=='PARTICLE_SYSTEM' and m.particle_system.name==ps.name)
                max_error=0.; max_uv_error=0.; samples=[]
                for i in indices:
                    particle_no=parents+i
                    xyz=np.array([list(ep.co_hair(o,particle_no=particle_no,step=j)) for j in range(point_count)],dtype=np.float32)
                    # co_hair returns cached paths in world coordinates.
                    expected_xyz=xyz[:,[0,2,1]] * np.array([1,1,-1],dtype=np.float32)
                    err=float(np.abs(expected_xyz-side[i,:,:3]).max()); max_error=max(max_error,err)
                    if uvs is not None:
                        uv=np.array(ep.uv_on_emitter(pmod,ep.particles[min(particle_no,parents-1)],particle_no=particle_no),dtype=np.float32); uv[1]=1-uv[1]
                        max_uv_error=max(max_uv_error,float(np.abs(uv-uvs[i]).max()))
                    samples.append({'child_index':i,'max_position_error_m':err})
                scales=np.linalg.norm(np.array(o.matrix_world)[:3,:3],axis=0)
                radius_scale=np.float32(.5*settings.radius_scale)*np.float32(scales[0])
                times=np.linspace(0,1,point_count,dtype=np.float32)
                taper=1-times
                if settings.shape<0: taper=np.power(taper,1+settings.shape)
                elif settings.shape>0: taper=np.power(taper,1/(1-settings.shape))
                expected_radius=(np.float32(.5*settings.radius_scale)*(taper*(settings.root_radius-settings.tip_radius)+settings.tip_radius))*scales[0]
                if settings.use_close_tip: expected_radius[-1]=0
                radius_error=float(np.abs(side[:,:,3]-expected_radius).max())
                row={'name':name,'source_parents':parents,'evaluated_children':children,'points_per_strand':point_count,'source_guide_keys_sha256':guide_hash,'independent_complete_sample_strands':len(indices),'samples':samples,'max_sampled_position_error_m':max_error,'max_sampled_root_uv_error':max_uv_error,'all_child_radii_max_error_m':radius_error,'source_shape':settings.shape,'source_render_step':settings.render_step}
                REPORT['particle_systems'].append(row)
                check('particle_paths_UVs_radii_'+name,max_error<1e-5 and max_uv_error<1e-6 and radius_error<1e-9,**row)
                print('VERIFIED',name,'children',children,'path_error',max_error,'uv_error',max_uv_error,'radius_error',radius_error,flush=True)
                flush()
            finally:
                settings.display_step,settings.child_percent,settings.display_percentage=original
                bpy.context.view_layer.update()
    check('all_particle_children_total',len(REPORT['particle_systems'])==30 and sum(r['evaluated_children'] for r in REPORT['particle_systems'])==2120000,systems=len(REPORT['particle_systems']),children=sum(r['evaluated_children'] for r in REPORT['particle_systems']))
    after=sha(SOURCE.read_bytes()); original_after=sha(ORIGINAL.read_bytes())
    check('source_hash_unchanged_after_audit',before==after==original_before==original_after==EXPECTED,archive_after_sha256=after,original_after_sha256=original_after)
    REPORT['pass']=not REPORT['errors']; REPORT['source_saved']=False
    flush()
    print('AUDIT_FINISHED',REPORT['pass'],'errors',len(REPORT['errors']),flush=True)
except Exception as exc:
    REPORT['exception']=repr(exc); REPORT['pass']=False; flush(); raise
