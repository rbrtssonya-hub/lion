"""Export the supplied Blender theater into the browser's four-screen scene contract.

The source .blend remains byte-identical. Static hall/drum geometry is joined
only in this process to keep the real-time scene's draw-call count bounded.
The lion body and every source hair strand are exported separately by
export_full_lion.py; a metadata node supplies the actor bounds required by the
browser's rotation mount.
"""
import argparse
import hashlib
import inspect
import json
import math
import shutil
import struct
import sys
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]


def sha_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')


def project_path(value, label):
    path = Path(value)
    if not path.is_absolute():
        path = ROOT / path
    path = path.resolve()
    try:
        path.relative_to(ROOT)
    except ValueError as error:
        raise RuntimeError(f'{label} must stay inside the project root') from error
    return path


def source_triangles(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        mesh.calc_loop_triangles()
        return len(mesh.loop_triangles)
    finally:
        evaluated.to_mesh_clear()


def duplicate_mesh(obj, export_collection):
    duplicate = obj.copy()
    duplicate.data = obj.data.copy()
    duplicate.parent = None
    duplicate.matrix_world = obj.matrix_world.copy()
    export_collection.objects.link(duplicate)
    duplicate.animation_data_clear()
    for modifier in list(duplicate.modifiers):
        bpy.context.view_layer.objects.active = duplicate
        duplicate.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        duplicate.select_set(False)
    return duplicate


def join_meshes(objects, name):
    if not objects:
        raise RuntimeError(f'No meshes to export for {name}')
    if len(objects) == 1:
        objects[0].name = name
        objects[0].data.name = f'{name}_Mesh'
        return objects[0]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = f'{name}_Mesh'
    return joined


def main():
    from mathutils import Vector
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--hair-manifest', required=True)
    parser.add_argument('--output', default='source/public/assets/models/lion-action-theater.glb')
    parser.add_argument('--report', default='source/references/2026-10-27-action-theater-warm-gold.json')
    parser.add_argument('--lights-report', default='source/references/2026-10-27-action-theater-warm-gold-lights.json')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if bpy.app.version != (5, 1, 2):
        raise RuntimeError(f'Use the project Blender 5.1.2 runtime; found {bpy.app.version_string}')

    source = Path(args.input).resolve()
    archive = project_path(args.archive, 'Source archive')
    output = project_path(args.output, 'GLB output')
    report_path = project_path(args.report, 'Audit report')
    lights_report_path = project_path(args.lights_report, 'Lighting report')
    hair_manifest_path = project_path(args.hair_manifest, 'Hair manifest')
    if not source.is_file() or not hair_manifest_path.is_file():
        raise RuntimeError('The input .blend and chapter-specific hair manifest must exist')
    archive.parent.mkdir(parents=True, exist_ok=True)
    source_hash = sha_file(source)
    if archive.exists():
        if sha_file(archive) != source_hash:
            raise RuntimeError('Refusing to overwrite a different source archive')
    else:
        shutil.copyfile(source, archive)
    if sha_file(archive) != source_hash:
        raise RuntimeError('Source archive bytes differ from the user-provided .blend')

    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    bpy.context.view_layer.update()
    scene = bpy.context.scene
    collection = lambda name: bpy.data.collections.get(name)
    room_collection = collection('01_Room')
    architecture_collection = collection('02_Red_Gold_Architecture')
    lion_collection = collection('03_Complete_Native_Lion')
    drums_collection = collection('04_Four_User_Drums')
    screens_collection = collection('05_Video_Screens')
    anchors_collection = collection('08_Interaction_Anchors')
    required = [room_collection, architecture_collection, lion_collection, drums_collection, screens_collection, anchors_collection]
    if any(item is None for item in required):
        raise RuntimeError('The source scene is missing a required web handoff collection')

    room_meshes = [o for o in room_collection.objects if o.type == 'MESH']
    architecture_meshes = [o for o in architecture_collection.objects if o.type == 'MESH']
    drum_meshes = [o for o in drums_collection.objects if o.type == 'MESH']
    screen_meshes = [o for o in screens_collection.objects if o.type == 'MESH']
    stage_source = bpy.data.objects.get('Theater_Stage_Polished_Stone_Top')
    if not stage_source or stage_source not in architecture_meshes:
        raise RuntimeError('The imported theater needs Theater_Stage_Polished_Stone_Top')
    for name in ('Screen_Tanqing', 'Screen_Doumao', 'Screen_Tuqiu', 'Screen_Meihuazhuang'):
        if bpy.data.objects.get(name) not in screen_meshes:
            raise RuntimeError(f'The imported theater needs {name}')
    for name in ('Lion_RotationRoot', 'UI_Anchor_Tanqing', 'UI_Anchor_Doumao', 'UI_Anchor_Tuqiu', 'UI_Anchor_Meihuazhuang'):
        if anchors_collection.objects.get(name) is None:
            raise RuntimeError(f'The imported theater needs {name}')
    if len(room_meshes) != 5 or len(screen_meshes) != 4 or len(drum_meshes) != 28:
        raise RuntimeError(f'Unexpected scene handoff counts: room={len(room_meshes)}, screens={len(screen_meshes)}, drum parts={len(drum_meshes)}')

    hair_manifest = json.loads(hair_manifest_path.read_text(encoding='utf-8'))
    if not hair_manifest.get('groups') or not hair_manifest.get('totalStrands'):
        raise RuntimeError('The chapter-specific hair manifest is empty')
    depsgraph = bpy.context.evaluated_depsgraph_get()
    actor_points = []
    for obj in lion_collection.objects:
        if obj.type != 'MESH':
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            actor_points.extend(evaluated.matrix_world @ vertex.co for vertex in mesh.vertices)
        finally:
            evaluated.to_mesh_clear()
    if not actor_points:
        raise RuntimeError('The imported lion has no evaluated mesh vertices')
    mesh_min = [min(point[axis] for point in actor_points) for axis in range(3)]
    mesh_max = [max(point[axis] for point in actor_points) for axis in range(3)]
    actor_min = [mesh_min[0], mesh_min[2], -mesh_max[1]]
    actor_max = [mesh_max[0], mesh_max[2], -mesh_min[1]]
    for group in hair_manifest['groups']:
        for axis in range(3):
            actor_min[axis] = min(actor_min[axis], group['bounds']['min'][axis])
            actor_max[axis] = max(actor_max[axis], group['bounds']['max'][axis])
    actor_height = actor_max[1] - actor_min[1]
    if not math.isfinite(actor_height) or actor_height <= 0:
        raise RuntimeError('The imported lion bounds are not usable')

    output_collection = bpy.data.collections.new('__Web_Export__')
    scene.collection.children.link(output_collection)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    source_meshes = room_meshes + architecture_meshes + drum_meshes + screen_meshes
    expected_triangles = sum(source_triangles(obj, depsgraph) for obj in source_meshes)
    if expected_triangles <= 0:
        raise RuntimeError('The source theater has no evaluated triangles')

    export_objects = list(room_meshes)
    arch_parts = []
    for obj in architecture_meshes:
        if obj == stage_source:
            stage_top = obj
            export_objects.append(stage_top)
        else:
            arch_parts.append(duplicate_mesh(obj, output_collection))
    export_objects.append(join_meshes(arch_parts, 'Theater_Architecture_Combined'))
    export_objects.append(join_meshes([duplicate_mesh(obj, output_collection) for obj in drum_meshes], 'Theater_Four_Drums_Combined'))

    placeholder = bpy.data.materials.new('Video_Screen_Web_Texture_Replacement')
    placeholder.diffuse_color = (0.025, 0.018, 0.012, 1)
    placeholder.use_nodes = True
    bsdf = placeholder.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.025, 0.018, 0.012, 1)
        bsdf.inputs['Roughness'].default_value = 1.0
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (0.025, 0.018, 0.012, 1)
            bsdf.inputs['Emission Strength'].default_value = 0.2
    for obj in screen_meshes:
        obj.data.materials.clear()
        obj.data.materials.append(placeholder)
        export_objects.append(obj)

    root_source = bpy.data.objects['Lion_RotationRoot']
    root_source.location = (0, 0, 0)
    root_source.rotation_mode = 'XYZ'
    root_source.rotation_euler = (0, 0, 0)
    root_source.scale = (1, 1, 1)
    root_source.animation_data_clear()
    root_source['webLionBoundsYUpJson'] = json.dumps({'min': actor_min, 'max': actor_max}, separators=(',', ':'))
    root_source['webLionHeight'] = float(actor_height)
    root_source['webLionBottomYUp'] = float(actor_min[1])
    root_source['webSceneAsset'] = 'southwind-warm-gold-2026-10-27'
    export_objects.append(root_source)

    exported_anchors = []
    for original in anchors_collection.objects:
        if original == root_source or original.type != 'EMPTY':
            continue
        export_objects.append(original)
        exported_anchors.append(original.name)

    light_records = []
    for obj in scene.objects:
        if obj.type != 'LIGHT':
            continue
        data = obj.data
        position = obj.matrix_world.translation
        forward = obj.matrix_world.to_quaternion() @ Vector((0, 0, -1))
        gltf_position = [float(position.x), float(position.z), float(-position.y)]
        gltf_forward = [float(forward.x), float(forward.z), float(-forward.y)]
        light_records.append({
            'name': obj.name,
            'type': data.type,
            'position': gltf_position,
            'direction': gltf_forward,
            'energy': float(data.energy),
            'temperatureK': float(data.temperature) if getattr(data, 'use_temperature', False) else None,
            'shape': getattr(data, 'shape', None),
            'size': float(getattr(data, 'size', 0) or 0),
            'sizeY': float(getattr(data, 'size_y', 0) or 0),
            'spotSize': float(getattr(data, 'spot_size', 0) or 0),
            'spotBlend': float(getattr(data, 'spot_blend', 0) or 0),
            'cutoffDistance': float(getattr(data, 'cutoff_distance', 0) or 0),
        })
    if len(light_records) != 21:
        raise RuntimeError(f'Expected 21 scene lighting records, found {len(light_records)}')
    lighting_node = bpy.data.objects.new('Theater_Warm_Light_Data', None)
    lighting_node['webLightsJson'] = json.dumps(light_records, ensure_ascii=False, separators=(',', ':'))
    output_collection.objects.link(lighting_node)
    export_objects.append(lighting_node)
    scene_manifest_node = bpy.data.objects.new('Theater_Scene_Metadata', None)
    scene_manifest_node['webArchitectureMeshCount'] = len(architecture_meshes)
    scene_manifest_node['webDrumSetCount'] = 4
    scene_manifest_node['webDrumMeshCount'] = len(drum_meshes)
    scene_manifest_node['webSourceLightCount'] = len(light_records)
    output_collection.objects.link(scene_manifest_node)
    export_objects.append(scene_manifest_node)

    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = stage_top
    export_settings = {
        'export_format': 'GLB',
        'use_selection': True,
        'export_yup': True,
        'export_apply': True,
        'export_texcoords': True,
        'export_normals': True,
        'export_materials': 'EXPORT',
        'export_image_format': 'AUTO',
        'export_animations': False,
        'export_extras': True,
        'export_cameras': False,
        'export_lights': False,
    }

    from io_scene_gltf2.blender.exp import nodes as export_nodes
    original_gather_mesh = export_nodes.__gather_mesh
    gather_source = inspect.getsource(original_gather_mesh)
    known_gather_sha = '2bc9847a3fee75e2d3efd8c343f111dc37a3ed783ab45ec05094744619d1523d'
    validate_call = 'res = blender_object.data.validate()'
    if (hashlib.sha256(gather_source.encode()).hexdigest() != known_gather_sha
            or gather_source.count(validate_call) != 1
            or str(inspect.signature(original_gather_mesh)) != '(vnode, blender_object, export_settings)'):
        raise RuntimeError('Unrecognized glTF exporter; refusing to risk automatic topology repair')
    patched_source = gather_source.replace(validate_call, 'res = False  # Preserve authored source triangles')
    try:
        exec(compile(patched_source, '<preserve_action_theater_meshes>', 'exec'), export_nodes.__dict__)
        bpy.ops.export_scene.gltf(filepath=str(output), **export_settings)
    finally:
        export_nodes.__gather_mesh = original_gather_mesh

    data = output.read_bytes()
    if data[:4] != b'glTF':
        raise RuntimeError('The Blender exporter did not produce a GLB container')
    json_length = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20:20 + json_length])
    exported_triangles = sum(
        gltf['accessors'][primitive['indices']]['count'] // 3
        for mesh in gltf.get('meshes', []) for primitive in mesh.get('primitives', [])
    )
    if exported_triangles != expected_triangles:
        raise RuntimeError(f'Exported triangle count {exported_triangles} differs from source {expected_triangles}')
    exported_names = {node.get('name') for node in gltf.get('nodes', [])}
    required_nodes = {'Lion_RotationRoot', 'Theater_Stage_Polished_Stone_Top', 'Theater_Warm_Light_Data',
                      'Screen_Tanqing', 'Screen_Doumao', 'Screen_Tuqiu', 'Screen_Meihuazhuang',
                      'UI_Anchor_Tanqing', 'UI_Anchor_Doumao', 'UI_Anchor_Tuqiu', 'UI_Anchor_Meihuazhuang'}
    missing_nodes = sorted(required_nodes - exported_names)
    if missing_nodes:
        raise RuntimeError(f'Required web scene nodes absent from GLB: {missing_nodes}')
    root_node = next(node for node in gltf['nodes'] if node.get('name') == 'Lion_RotationRoot')
    if root_node.get('extras', {}).get('webLionHeight') is None:
        raise RuntimeError('The exported rotation root is missing its source actor bounds')

    report = {
        'task': 'Replace the action-page theater scene with the user-provided warm-gold Blender scene',
        'blenderVersion': bpy.app.version_string,
        'sourceBlend': str(source),
        'sourceArchive': archive.relative_to(ROOT).as_posix(),
        'sourceBytes': source.stat().st_size,
        'sourceSha256': source_hash,
        'sourceCollections': {
            'roomMeshes': len(room_meshes),
            'architectureMeshes': len(architecture_meshes),
            'drumMeshes': len(drum_meshes),
            'screens': len(screen_meshes),
            'lionMeshObjects': sum(obj.type == 'MESH' for obj in lion_collection.objects),
            'lionCurveObjects': sum(obj.type == 'CURVES' for obj in lion_collection.objects),
            'interactionAnchors': len(exported_anchors),
            'sourceLights': len(light_records),
        },
        'actorBoundsYUp': {'min': actor_min, 'max': actor_max, 'height': actor_height},
        'hairManifest': hair_manifest_path.relative_to(ROOT).as_posix(),
        'sourceEvaluatedTriangles': expected_triangles,
        'exportedTriangles': exported_triangles,
        'exportedNodes': len(gltf.get('nodes', [])),
        'exportedMeshes': len(gltf.get('meshes', [])),
        'exportedMaterials': len(gltf.get('materials', [])),
        'embeddedImages': len(gltf.get('images', [])),
        'exportSettings': export_settings,
        'sourceBlendSaved': False,
        'lighting': 'All 21 original Blender scene lights are carried as node extras and mapped to Three.js area/spot/point lights at runtime; Blender world lighting is supplied by the existing replaceable forest HDRI.',
        'output': {'path': output.relative_to(ROOT).as_posix(), 'bytes': len(data), 'sha256': sha_file(output)},
    }
    write_json(report_path, report)
    write_json(lights_report_path, {'sourceSha256': source_hash, 'lights': light_records})
    if sha_file(source) != source_hash or sha_file(archive) != source_hash:
        raise RuntimeError('The user source or project archive changed during export')
    print(json.dumps({'output': report['output'], 'sourceCollections': report['sourceCollections'],
                      'actorBoundsYUp': report['actorBoundsYUp'], 'triangles': exported_triangles,
                      'lights': len(light_records)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
