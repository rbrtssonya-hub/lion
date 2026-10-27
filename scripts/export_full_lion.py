"""Export the user's complete lion, with every rendered hair and no mesh LOD.

Run with Blender 5.1+ --background --factory-startup --python-exit-code 1
--python scripts/export_full_lion.py -- --input <source.blend>.
An alternate byte-identical source archive can be set with --archive <project-path>.
Optional collection and output arguments support chapter-specific model exports.
Never saves a Blender file. The byte-identical local source archive is ignored
by Git because it exceeds GitHub's ordinary-file limit.
"""
import argparse
import gzip
import hashlib
import inspect
import json
import math
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'source/public/assets/models'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def material_info(material):
    info = {'name': material.name if material else 'Blender_Default', 'color': [.8, .8, .8], 'roughness': .5, 'metalness': 0., 'useSourceMaterial': bool(material)}
    if material and material.node_tree:
        node = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if node:
            info.update(color=list(node.inputs['Base Color'].default_value)[:3], roughness=float(node.inputs['Roughness'].default_value), metalness=float(node.inputs['Metallic'].default_value))
    return info


def main():
    sys.path.insert(0, str(ROOT / 'scripts'))
    from export_lion_structure import correct_exported_sheen
    import bpy
    import numpy as np
    from mathutils import Vector

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--archive', default='source/models/user-lion-2026-10-20.blend',
                        help='Project-relative path for the byte-identical local source archive')
    parser.add_argument('--collection', default=None,
                        help='Export only meshes, curves and particle hair from this collection')
    parser.add_argument('--output-stem', default='lion-user',
                        help='Output model/manifest/hair filename stem (without extension)')
    parser.add_argument('--hair-key-prefix', default='lionHair',
                        help='Runtime asset-key prefix used by the hair manifest')
    parser.add_argument('--report', default='source/references/lion-structure-model.json',
                        help='Repository-relative JSON audit report path')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if bpy.app.version < (5, 1, 0):
        raise RuntimeError('Use Blender 5.1+ to read this source without the older-version data-loss warning')
    source = Path(args.input).resolve()
    source_bytes = source.read_bytes()
    source_hash = sha(source_bytes)
    archive = Path(args.archive)
    if not archive.is_absolute():
        archive = ROOT / archive
    archive = archive.resolve()
    try:
        archive.relative_to(ROOT)
    except ValueError as error:
        raise RuntimeError('The project source archive must stay inside the project root') from error
    archive.parent.mkdir(parents=True, exist_ok=True)
    if archive.exists() and sha(archive.read_bytes()) != source_hash:
        raise RuntimeError('Refusing to overwrite a different archived source')
    if not archive.exists():
        shutil.copyfile(source, archive)
    assert sha(archive.read_bytes()) == source_hash
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    bpy.context.view_layer.update()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for value, label in ((args.output_stem, 'output stem'), (args.hair_key_prefix, 'hair key prefix')):
        if not value or any(char not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for char in value):
            raise RuntimeError(f'Invalid {label}: {value!r}')
    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = ROOT / report_path
    report_path = report_path.resolve()
    try:
        report_path.relative_to(ROOT)
    except ValueError as error:
        raise RuntimeError('The audit report must stay inside the project root') from error
    collection = bpy.data.collections.get(args.collection) if args.collection else None
    if args.collection and collection is None:
        raise RuntimeError(f'Source collection not found: {args.collection}')
    source_objects = list(collection.all_objects) if collection else list(bpy.context.scene.objects)
    meshes = [o for o in source_objects if o.type == 'MESH']
    curves = [o for o in source_objects if o.type == 'CURVES']
    if not meshes:
        raise RuntimeError('The selected source contains no mesh objects')

    def mesh_fingerprint(obj):
        # Compare the authored arrays before and after every export operation.
        # Normal caches are derived; topology, UVs and material assignments are not.
        mesh = obj.data
        digest = hashlib.sha256()
        counts = {'vertices': len(mesh.vertices), 'edges': len(mesh.edges),
                  'polygons': len(mesh.polygons), 'loops': len(mesh.loops)}
        digest.update(json.dumps(counts, sort_keys=True).encode())
        arrays = [
            ('vertex_positions', mesh.vertices, 'co', 3, '<f4'),
            ('edge_vertices', mesh.edges, 'vertices', 2, '<i4'),
            ('loop_vertices', mesh.loops, 'vertex_index', 1, '<i4'),
            ('loop_edges', mesh.loops, 'edge_index', 1, '<i4'),
            ('polygon_loop_starts', mesh.polygons, 'loop_start', 1, '<i4'),
            ('polygon_loop_totals', mesh.polygons, 'loop_total', 1, '<i4'),
            ('polygon_materials', mesh.polygons, 'material_index', 1, '<i4'),
            ('polygon_smoothing', mesh.polygons, 'use_smooth', 1, '?'),
        ]
        arrays.extend(('uv:'+layer.name, layer.data, 'uv', 2, '<f4')
                      for layer in mesh.uv_layers)
        for label, collection, prop, width, dtype in arrays:
            values = np.empty(len(collection)*width, dtype=dtype)
            collection.foreach_get(prop, values)
            digest.update(label.encode('utf-8')+b'\0')
            digest.update(values.tobytes())
        digest.update(json.dumps([m.name if m else None for m in mesh.materials],
                                 ensure_ascii=False).encode('utf-8'))
        return dict(counts, geometry_sha256=digest.hexdigest())

    source_mesh_before = {o.name: mesh_fingerprint(o) for o in meshes}
    report = {'blender_version': bpy.app.version_string, 'source': archive.relative_to(ROOT).as_posix(), 'source_filename': source.name, 'source_bytes': len(source_bytes), 'source_sha256': source_hash, 'scene_object_counts': {t: sum(o.type == t for o in bpy.context.scene.objects) for t in sorted({o.type for o in bpy.context.scene.objects})}, 'mesh_objects': [], 'hair_source': [], 'source_render':{'engine':bpy.context.scene.render.engine,'hair_type':bpy.context.scene.render.hair_type,'hair_subdiv':bpy.context.scene.render.hair_subdiv},'policy': {'mesh_decimation': False, 'mesh_deduplication': False, 'mesh_repair': False, 'hair_sampling': False, 'hair_point_simplification': False, 'quantization': False, 'texture_resize': False, 'source_saved': False}, 'images': [{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file), 'packed_sha256':sha(bytes(i.packed_file.data)) if i.packed_file else None} for i in bpy.data.images]}
    for o in meshes:
        corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
        gltf = [(v.x, v.z, -v.y) for v in corners]
        report['mesh_objects'].append({'name':o.name,'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),'uv_layers':[u.name for u in o.data.uv_layers],'materials':[m.name if m else None for m in o.data.materials], 'modifiers':[{'name':m.name,'type':m.type} for m in o.modifiers], 'gltf_bounds':{'min':[min(v[a] for v in gltf) for a in range(3)],'max':[max(v[a] for v in gltf) for a in range(3)]}})
    manifest = {'version':1,'coordinateSystem':'GLTF_Y_UP','sourceSha256':source_hash,'groups':[]}

    def save_hair(name, kind, positions, radii, material, source_meta, uv=None):
        # Float32 positions/radii and optional root UVs, without quantization.
        count, points, _ = positions.shape
        data = np.empty((count, points, 4), dtype='<f4')
        data[:,:,:3] = positions
        data[:,:,3] = radii
        raw = data.tobytes()
        if uv is not None:
            raw += np.asarray(uv, dtype='<f4').tobytes()
        compressed = gzip.compress(raw, compresslevel=6, mtime=0)
        number = len(manifest['groups']) + 1
        filename = f'{args.output_stem}-hair-{number:02d}.bin.gz'
        (PUBLIC / filename).write_bytes(compressed)
        radius = data[:,:,3].max(axis=1).max()
        group = {'id':f'hair-{number:02d}','name':name,'kind':kind,'assetKey':f'{args.hair_key_prefix}{number:02d}','path':f'assets/models/{filename}','strands':count,'pointsPerStrand':points,'bytes':len(compressed),'rawBytes':len(raw),'sha256':sha(compressed),'rawSha256':sha(raw),'hasRootUV':uv is not None,'displayMode':'STRAND','interpolation':'CATMULL_ROM' if kind=='CURVES' else 'LINEAR','segmentsPerSourceSegment':12 if kind=='CURVES' else 1,'bounds':{'min':(positions.min(axis=(0,1))-radius).tolist(),'max':(positions.max(axis=(0,1))+radius).tolist()},'material':material_info(material)}
        manifest['groups'].append(group)
        report['hair_source'].append(dict(group, **source_meta))
        print(f'FULL_HAIR {number:02d}: {name}: {count} strands x {points}, gzip {len(compressed)} bytes', flush=True)

    # Preserve every authored point of all three Curves objects. Missing radius
    # uses the CurvesGeometry default; the runtime STRAND adapter draws centerlines.
    for o in curves:
        counts = np.array([c.points_length for c in o.data.curves])
        if len(set(counts.tolist())) != 1:
            raise RuntimeError(f'{o.name}: variable strand lengths require separate groups; never discard points')
        points = int(counts[0])
        xyz = np.empty(len(o.data.points)*3, dtype=np.float32)
        o.data.attributes['position'].data.foreach_get('vector', xyz)
        xyz = xyz.reshape(-1,3)
        matrix = np.array(o.matrix_world, dtype=np.float32)
        xyz = xyz @ matrix[:3,:3].T + matrix[:3,3]
        xyz = xyz[:,[0,2,1]] * np.array([1,1,-1],dtype=np.float32)
        radius_attribute = o.data.attributes.get('radius')
        radii = np.full(len(o.data.points), .01, dtype=np.float32)
        if radius_attribute:
            radius_attribute.data.foreach_get('value',radii)
        material = o.data.materials[0] if len(o.data.materials) else None
        save_hair(o.name,'CURVES',xyz.reshape(len(counts),points,3),radii.reshape(len(counts),points),material,{'source_curves':len(counts),'source_points':len(o.data.points),'radius_attribute':bool(radius_attribute),'radius_default_m':None if radius_attribute else .01,'curve_types':sorted(set(int(c.type) if hasattr(c,'type') and isinstance(c.type,int) else str(getattr(c,'type','CATMULL_ROM')) for c in o.data.curves))})

    # Evaluate particle paths at the SOURCE render resolution. Blender's own
    # modifier conversion exports all rendered children (parents are guides when
    # interpolated children exist). This is not density reduction or an LOD.
    # Restore the temporary viewport evaluation overrides before the GLB export.
    for o in meshes:
        for system in o.particle_systems:
            settings = system.settings
            if settings.type != 'HAIR':
                raise RuntimeError(f'Unhandled particle type on {o.name}; refusing incomplete export')
            original = (settings.display_step, settings.child_percent, settings.display_percentage)
            guide_keys = [[list(k.co)+[float(k.time),float(k.weight)] for k in p.hair_keys] for p in system.particles]
            source_meta = {'emitter':o.name,'particle_system':system.name,'settings':settings.name,'source_parent_guides':len(system.particles),'source_guide_key_counts':sorted(set(len(p.hair_keys) for p in system.particles)),'source_guide_keys_sha256':sha(json.dumps(guide_keys,separators=(',',':')).encode()),'source_child_count':settings.rendered_child_count,'source_render_step':settings.render_step,'source_child_type':settings.child_type,'source_root_radius':settings.root_radius,'source_tip_radius':settings.tip_radius,'source_radius_scale':settings.radius_scale,'source_shape':settings.shape,'source_close_tip':settings.use_close_tip,'source_viewport_values':list(original),'source_material_slot':settings.material}
            try:
                settings.display_step = settings.render_step
                settings.child_percent = settings.rendered_child_count
                settings.display_percentage = 100
                bpy.context.view_layer.update()
                depsgraph = bpy.context.evaluated_depsgraph_get()
                evaluated = o.evaluated_get(depsgraph)
                ep = evaluated.particle_systems[system.name]
                children, parents = len(ep.child_particles), len(ep.particles)
                strand_count = children if children else parents
                first = parents if children else 0
                count_points = (1 << settings.render_step) + 1
                if settings.kink == 'SPIRAL':
                    raise RuntimeError('Spiral particle paths require explicit extra step support')
                pmod = next(m for m in evaluated.modifiers if m.type=='PARTICLE_SYSTEM' and m.particle_system.name==system.name)
                material = o.data.materials[settings.material-1] if 0<settings.material<=len(o.data.materials) else None
                uv = None
                # Retain per-child emitter UVs, including for materials currently
                # using only a constant color; the source attachment is useful.
                if len(o.data.uv_layers):
                    uv = np.array([ep.uv_on_emitter(pmod,ep.particles[min(i,parents-1)],particle_no=i) for i in range(first,parents+children)],dtype=np.float32)
                    uv[:,1] = 1 - uv[:,1]  # glTF uses the flipped texture V.
                bpy.ops.object.select_all(action='DESELECT')
                o.select_set(True)
                bpy.context.view_layer.objects.active=o
                modifier=next(m for m in o.modifiers if m.type=='PARTICLE_SYSTEM' and m.particle_system.name==system.name)
                bpy.ops.object.modifier_convert(modifier=modifier.name)
                converted=bpy.context.view_layer.objects.active
                if converted is o or len(converted.data.vertices) != strand_count*count_points:
                    raise RuntimeError(f'{o.name}: particle conversion count mismatch, refusing to drop hairs')
                xyz=np.empty(len(converted.data.vertices)*3,dtype=np.float32)
                converted.data.vertices.foreach_get('co',xyz)
                xyz=xyz.reshape(-1,3)
                matrix=np.array(converted.matrix_world,dtype=np.float32)
                xyz=xyz @ matrix[:3,:3].T+matrix[:3,3]
                xyz=(xyz[:,[0,2,1]] * np.array([1,1,-1],dtype=np.float32)).reshape(strand_count,count_points,3)
                # EEVEE uses the authored cached path time = key / segments.
                times=np.broadcast_to(np.linspace(0,1,count_points,dtype=np.float32),(strand_count,count_points))
                taper=1-times
                if settings.shape<0: taper=np.power(taper,1+settings.shape)
                elif settings.shape>0: taper=np.power(taper,1/(1-settings.shape))
                radius_scale=.5*settings.radius_scale
                radii=radius_scale*(taper*(settings.root_radius-settings.tip_radius)+settings.tip_radius)
                if settings.use_close_tip: radii[:,-1]=0
                # Account for the object's authored uniform transform. The user
                # source currently has unit scale; reject unhandled anisotropy.
                scales=np.linalg.norm(np.array(o.matrix_world)[:3,:3],axis=0)
                if max(scales)-min(scales)>1e-6:
                    raise RuntimeError('Anisotropic emitter transforms require vector-width attributes')
                radii*=scales[0]
                source_meta.update(evaluated_parent_guides=parents,evaluated_rendered_children=children,evaluated_rendered_strands=strand_count,rendered_parents=0 if children else parents)
                save_hair(o.name+' / '+system.name,'PARTICLE_HAIR',xyz,radii,material,source_meta,uv)
                temp_mesh=converted.data
                bpy.data.objects.remove(converted,do_unlink=True)
                bpy.data.meshes.remove(temp_mesh)
            finally:
                settings.display_step,settings.child_percent,settings.display_percentage=original
                bpy.context.view_layer.update()

    manifest['totalStrands']=sum(g['strands'] for g in manifest['groups'])
    manifest['totalPoints']=sum(g['strands']*g['pointsPerStrand'] for g in manifest['groups'])
    manifest_path = PUBLIC / f'{args.output_stem}-hair.json'
    write_json(manifest_path,manifest)
    bpy.ops.object.select_all(action='DESELECT')
    export_objects = [o for o in source_objects if o.type in ('MESH','EMPTY')]
    for o in export_objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    target=PUBLIC/f'{args.output_stem}-full.glb'
    export_settings={'export_format':'GLB','use_selection':True,'export_yup':True,'export_apply':True,'export_texcoords':True,'export_normals':True,'export_materials':'EXPORT','export_image_format':'AUTO','export_animations':True,'export_extras':True,'export_cameras':False,'export_lights':False}

    # Blender's bundled exporter otherwise calls Mesh.validate(), which repairs
    # authored topology in memory and removes 72 triangles from this source.
    # Disable only that call in this process, with an exact known-source guard.
    # Never edit Blender's installation, the .blend, or any mesh to accommodate it.
    from io_scene_gltf2.blender.exp import nodes as export_nodes
    original_gather_mesh = export_nodes.__gather_mesh
    gather_source = inspect.getsource(original_gather_mesh)
    known_gather_sha = '2bc9847a3fee75e2d3efd8c343f111dc37a3ed783ab45ec05094744619d1523d'
    validate_call = 'res = blender_object.data.validate()'
    if (bpy.app.version != (5, 1, 2) or sha(gather_source.encode()) != known_gather_sha
            or gather_source.count(validate_call) != 1
            or str(inspect.signature(original_gather_mesh)) != '(vnode, blender_object, export_settings)'):
        raise RuntimeError('Unrecognized glTF exporter; refusing automatic mesh validation or an unverified patch')
    patched_source = gather_source.replace(validate_call, 'res = False  # Preserve every authored triangle')
    report['exporter_mesh_validation_disabled'] = True
    report['exporter_compatibility'] = {'blender_version': bpy.app.version_string,
        'function': 'io_scene_gltf2.blender.exp.nodes.__gather_mesh',
        'original_function_sha256': known_gather_sha,
        'patched_function_sha256': sha(patched_source.encode()),
        'scope': 'Current process only; skip Mesh.validate() without changing source geometry or installation'}
    report['evaluated_source_meshes'] = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            report['evaluated_source_meshes'].append({'name': obj.name,
                'vertices': len(mesh.vertices), 'polygons': len(mesh.polygons),
                'triangles': len(mesh.loop_triangles)})
        finally:
            evaluated.to_mesh_clear()
    report['evaluated_source_triangles'] = sum(m['triangles'] for m in report['evaluated_source_meshes'])
    try:
        exec(compile(patched_source, '<preserve_authored_gltf_mesh>', 'exec'), export_nodes.__dict__)
        bpy.ops.export_scene.gltf(filepath=str(target),**export_settings)
    finally:
        export_nodes.__gather_mesh = original_gather_mesh
    source_mesh_after = {o.name: mesh_fingerprint(o) for o in meshes}
    report['source_mesh_invariants'] = [{'name': o.name,
        'before': source_mesh_before[o.name], 'after': source_mesh_after[o.name],
        'unchanged': source_mesh_before[o.name] == source_mesh_after[o.name]} for o in meshes]
    if not all(row['unchanged'] for row in report['source_mesh_invariants']):
        raise RuntimeError('An export operation changed authored mesh arrays; refusing altered model data')
    weights={}
    for material in bpy.data.materials:
        if not material.node_tree: continue
        node=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if node:
            weights[material.name]={'weight':float(node.inputs['Sheen Weight'].default_value),'tint':list(node.inputs['Sheen Tint'].default_value)[:3]}
    report['material_sheen_corrections']=correct_exported_sheen(target,weights)
    data=target.read_bytes()
    gltf=json.loads(data[20:20+struct.unpack_from('<I',data,12)[0]])
    exported_names={n.get('name') for n in gltf['nodes'] if 'mesh' in n}
    missing=[o.name for o in meshes if o.name not in exported_names]
    if missing: raise RuntimeError(f'Source meshes absent from GLB: {missing}')
    exported_triangles = {node['name']: sum(gltf['accessors'][p['indices']]['count']//3
        for p in gltf['meshes'][node['mesh']]['primitives'])
        for node in gltf['nodes'] if 'mesh' in node}
    expected_triangles = {m['name']: m['triangles'] for m in report['evaluated_source_meshes']}
    if exported_triangles != expected_triangles:
        raise RuntimeError('GLB triangle counts differ from evaluated source meshes; refusing incomplete export')
    report['export']={'path':target.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':sha(data),'settings':export_settings,'gltf_nodes':len(gltf['nodes']),'gltf_meshes':len(gltf['meshes']),'gltf_materials':len(gltf['materials']),'gltf_triangles':sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives']),'mesh_object_names':[o.name for o in meshes],'hair_manifest':manifest_path.relative_to(ROOT).as_posix(),'hair_groups':len(manifest['groups']),'hair_strands':manifest['totalStrands'],'hair_points':manifest['totalPoints']}
    report['source_unchanged']=sha(source.read_bytes())==source_hash==sha(archive.read_bytes())
    if not report['source_unchanged']: raise RuntimeError('Source or archive bytes changed')
    write_json(report_path,report)
    print(json.dumps({'source_unchanged':True,'export':report['export']},ensure_ascii=False),flush=True)


if __name__=='__main__':
    main()
