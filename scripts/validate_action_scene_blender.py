"""Reopen an action-scene delivery in Blender 5.0 and audit its actual data.

  blender -b --factory-startup --python-exit-code 1
    --python scripts/validate_action_scene_blender.py --
    --input <delivery.blend> --snapshot <scene.json> --output <audit.json>
    [--render <preview.png>]

Only the audit JSON and optional PNG are written. The input and native lion
are never saved. The source is independently opened first to fingerprint all
mesh topology/UVs, authored curve points and native particle settings.
"""

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source/models/user-lion-2026-10-20.blend'
SOURCE_SHA = 'dcfd8b97a27c371381aa7a0b1c26f5081fc4a35976a571979596aec353d6f770'
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
CI = C.inverted()


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def matrix(values):
    return Matrix([[values[column * 4 + row] for column in range(4)] for row in range(4)])


def matrix_error(first, second):
    return max(abs(first[row][column] - second[row][column]) for row in range(4) for column in range(4))


def array(collection, prop, width=1, dtype='<f4'):
    result = np.empty(len(collection) * width, dtype=dtype)
    collection.foreach_get(prop, result)
    return result


def data_sha(data):
    return hashlib.sha256(data).hexdigest()


def mesh_fingerprint(obj):
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
    arrays.extend(('uv:' + layer.name, layer.data, 'uv', 2, '<f4') for layer in mesh.uv_layers)
    for label, values, prop, width, dtype in arrays:
        digest.update(label.encode('utf-8') + b'\0')
        digest.update(array(values, prop, width, dtype).tobytes())
    digest.update(json.dumps([m.name if m else None for m in mesh.materials], ensure_ascii=False).encode('utf-8'))
    return dict(counts, geometry_sha256=digest.hexdigest())


def curves_fingerprint(obj):
    data = obj.data
    positions = array(data.points, 'position', 3)
    attributes = {}
    for attribute in data.attributes:
        # Selection attributes belong to the authoring UI, and are included
        # where serializable so conversion cannot silently lose authored data.
        width, prop, dtype = {
            'FLOAT_VECTOR': (3, 'vector', '<f4'), 'FLOAT': (1, 'value', '<f4'),
            'BOOLEAN': (1, 'value', '?'), 'INT': (1, 'value', '<i4'),
            'FLOAT2': (2, 'vector', '<f4'),
        }.get(attribute.data_type, (None, None, None))
        if prop:
            attributes[attribute.name] = {
                'type': attribute.data_type, 'domain': attribute.domain,
                'sha256': data_sha(array(attribute.data, prop, width, dtype).tobytes()),
            }
    return {'curves': len(data.curves), 'points': len(data.points),
            'positions_sha256': data_sha(positions.tobytes()), 'attributes': attributes,
            'materials': [m.name if m else None for m in data.materials]}


def particle_fingerprint(system):
    settings = system.settings
    properties = {}
    for prop in settings.bl_rna.properties:
        if prop.identifier in {'name', 'name_full', 'users', 'session_uid', 'is_updated', 'is_updated_data', 'is_updated_transform', 'is_runtime_data'}:
            continue
        if prop.type not in {'BOOLEAN', 'INT', 'FLOAT', 'STRING', 'ENUM'}:
            continue
        try:
            value = getattr(settings, prop.identifier)
            if getattr(prop, 'is_array', False):
                value = list(value)
            elif isinstance(value, set):
                value = sorted(value)
            json.dumps(value, allow_nan=False)
            properties[prop.identifier] = value
        except (TypeError, ValueError, AttributeError):
            pass
    guides = [[list(key.co) + [float(key.time), float(key.weight)] for key in particle.hair_keys]
              for particle in system.particles]
    return {'settings': properties, 'settings_sha256': data_sha(json.dumps(properties, sort_keys=True).encode()),
            'guide_keys_sha256': data_sha(json.dumps(guides, separators=(',', ':')).encode()),
            'parent_guides': len(system.particles), 'render_children': settings.count * settings.rendered_child_count,
            'points_per_strand': (1 << settings.render_step) + 1}


def native_fingerprint(objects):
    return {
        'meshes': {obj.name: mesh_fingerprint(obj) for obj in objects if obj.type == 'MESH'},
        'curves': {obj.name: curves_fingerprint(obj) for obj in objects if obj.type == 'CURVES'},
        'particles': {obj.name + ' / ' + system.name: particle_fingerprint(system)
                      for obj in objects if obj.type == 'MESH' for system in obj.particle_systems},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--snapshot', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--render', type=Path, metavar='PREVIEW_PNG')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if bpy.app.version[:2] != (5, 0):
        raise RuntimeError('This verifier must run in the requested Blender 5.0')
    deliverable, snapshot_path, output = args.input.resolve(), args.snapshot.resolve(), args.output.resolve()
    if output in {deliverable, SOURCE.resolve(), snapshot_path} or output.suffix.lower() != '.json':
        raise ValueError('Audit output must be a separate JSON file')
    if args.render and (args.render.resolve() in {deliverable, SOURCE.resolve(), snapshot_path, output} or args.render.suffix.lower() != '.png'):
        raise ValueError('Preview must be a separate PNG file')
    capture = json.loads(snapshot_path.read_text(encoding='utf-8-sig'))
    report = {'blender_version': bpy.app.version_string, 'input': str(deliverable),
              'snapshot': str(snapshot_path), 'checks': [], 'errors': [], 'native': {}, 'runtime': [],
              'pass': False, 'status': 'running'}
    output.parent.mkdir(parents=True, exist_ok=True)

    def check(name, passed, **details):
        entry = {'name': name, 'pass': bool(passed), **details}
        report['checks'].append(entry)
        if not passed:
            report['errors'].append(entry)

    def flush():
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    # An interrupted run must leave an explicitly incomplete report rather
    # than the successful result of an older invocation at the same path.
    flush()
    start = time.monotonic()
    source_before, delivery_before = sha(SOURCE), sha(deliverable)
    check('native_source_expected_sha256', source_before == SOURCE_SHA, actual=source_before)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False)
    bpy.context.view_layer.update()
    baseline = native_fingerprint(list(bpy.context.scene.objects))
    historical = json.loads((ROOT / 'source/references/lion-structure-model.json').read_text(encoding='utf-8'))
    historical_mesh = {item['name']: item['before'] for item in historical['source_mesh_invariants']}
    check('5_0_source_meshes_match_5_1_export_invariants', baseline['meshes'] == historical_mesh,
          mesh_objects=len(baseline['meshes']))
    bpy.ops.wm.open_mainfile(filepath=str(deliverable), load_ui=False)
    scene = bpy.context.scene
    scene.frame_set(1)
    bpy.context.view_layer.update()
    check('saved_blend_version_is_5_0', bpy.data.version[:2] == (5, 0), file_version=list(bpy.data.version))
    lion_owner = bpy.data.collections.get('03_Complete_Native_Lion')
    if lion_owner is None:
        raise RuntimeError('Required native lion collection is missing')
    lion_objects = list(lion_owner.all_objects)
    native = native_fingerprint(lion_objects)
    report['native'] = native
    counts = dict(Counter(obj.type for obj in lion_objects))
    check('native_lion_objects_and_hair_groups', counts.get('MESH') == 53 and counts.get('CURVES') == 3 and len(native['particles']) == 30,
          counts=counts, particle_systems=len(native['particles']))
    for kind in ['meshes', 'curves', 'particles']:
        check('native_' + kind + '_names_preserved', set(native[kind]) == set(baseline[kind]))
        for name, expected in baseline[kind].items():
            check('native_' + kind + '_data_' + name, native[kind].get(name) == expected)
    strands = sum(item['curves'] for item in native['curves'].values()) + sum(item['render_children'] for item in native['particles'].values())
    points = sum(item['points'] for item in native['curves'].values()) + sum(item['render_children'] * item['points_per_strand'] for item in native['particles'].values())
    check('complete_hair_render_counts', strands == 2295421 and points == 19957105,
          strands=strands, points=points, groups=len(native['curves']) + len(native['particles']))
    parent = bpy.data.objects.get('Lion_Web_36s_Rotation')
    check('lion_world_transform', parent is not None and matrix_error(parent.matrix_world, CI @ matrix(capture['lion']['matrixWorld']) @ C) < 2e-5)
    fps = scene.render.fps / scene.render.fps_base
    check('24fps_864_frame_timeline', abs(fps - 24) < 1e-8 and scene.frame_start == 1 and scene.frame_end == 864,
          fps=fps, frame_start=scene.frame_start, frame_end=scene.frame_end)
    pivot = scene.objects.get('Lion_Stage_Centre_Rotation_Pivot')
    rotation_curves = []
    if pivot and pivot.animation_data and pivot.animation_data.action:
        for layer in pivot.animation_data.action.layers:
            for strip in layer.strips:
                for channelbag in strip.channelbags:
                    rotation_curves.extend(curve for curve in channelbag.fcurves
                                           if curve.data_path == 'rotation_euler' and curve.array_index == 2)
    keys = [(float(key.co.x), float(key.co.y)) for key in rotation_curves[0].keyframe_points] if len(rotation_curves) == 1 else []
    expected_keys = [(1, 0), (865, 2 * math.pi)]
    check('stage_pivot_36_second_linear_cyclic_keys', len(keys) == 2 and
          all(abs(a - c) < 1e-5 and abs(b - d) < 1e-5 for (a, b), (c, d) in zip(keys, expected_keys)) and
          all(key.interpolation == 'LINEAR' for key in rotation_curves[0].keyframe_points) and
          any(modifier.type == 'CYCLES' for modifier in rotation_curves[0].modifiers), keys=keys)
    rotation_samples = {}
    if pivot:
        for frame in (1, 433, 865):
            scene.frame_set(frame)
            rotation_samples[frame] = float(pivot.rotation_euler.z)
        scene.frame_set(1)
        bpy.context.view_layer.update()
    check('stage_pivot_evaluated_0_pi_2pi', len(rotation_samples) == 3 and
          all(abs(rotation_samples[frame] - angle) < 1e-5 for frame, angle in [(1, 0), (433, math.pi), (865, 2 * math.pi)]),
          radians=rotation_samples)

    expected_collections = ['01_Room', '02_Red_Gold_Architecture', '03_Complete_Native_Lion', '04_Four_User_Drums',
                            '05_Video_Screens', '06_Lighting', '07_Cameras', '08_Interaction_Anchors']
    report['collections'] = {name: len(bpy.data.collections[name].all_objects) if name in bpy.data.collections else None for name in expected_collections}
    check('all_scene_collections', all(name in bpy.data.collections for name in expected_collections), actual=report['collections'])
    expected_counts = {'01_Room': 5, '02_Red_Gold_Architecture': 1445, '04_Four_User_Drums': 28, '05_Video_Screens': 4}
    check('complete_room_architecture_drums_and_screens', all(report['collections'].get(name) == count for name, count in expected_counts.items()),
          expected=expected_counts, actual={name: report['collections'].get(name) for name in expected_counts})
    runtime = [obj for obj in scene.objects if obj.type == 'MESH' and 'web_geometry_id' in obj]
    check('runtime_mesh_object_count', len(runtime) == len(capture['meshes']), actual=len(runtime), expected=len(capture['meshes']))
    candidates = defaultdict(list)
    for obj in runtime:
        candidates[(obj['web_geometry_id'], obj.get('web_instance_index'))].append(obj)
    geometry = {entry['id']: entry for entry in capture['geometries']}
    verified_mesh_data = set()
    drum_materials = {}
    for record in capture['meshes']:
        key = (record['geometry'], record.get('instanceIndex'))
        expected_world = CI @ matrix(record['matrixWorld'])
        choices = candidates[key]
        if not choices:
            check('runtime_object_' + record['name'], False, reason='No matching geometry/instance')
            continue
        obj = min(choices, key=lambda item: matrix_error(item.matrix_world, expected_world))
        choices.remove(obj)
        if record['name'].startswith('Theater_Drum_'):
            material_ids = record['material'] if isinstance(record['material'], list) else [record['material']]
            for material_id, material in zip(material_ids, obj.data.materials):
                drum_materials[material_id] = material
        error = matrix_error(obj.matrix_world, expected_world)
        check('runtime_transform_' + obj.name, error < 2e-5, matrix_max_error=error)
        expected = geometry[record['geometry']]
        positions = np.asarray(expected['position'], dtype='<f4')
        indices = np.asarray(expected['index'] if expected.get('index') is not None else np.arange(len(positions) // 3), dtype='<i4')
        triangle_count = len(indices) // 3
        report['runtime'].append({'object': obj.name, 'source_name': record['name'], 'geometry': record['geometry'],
                                  'instance': record.get('instanceIndex'), 'triangles': triangle_count, 'matrix_max_error': error})
        if obj.data.as_pointer() in verified_mesh_data:
            continue
        verified_mesh_data.add(obj.data.as_pointer())
        actual_positions = array(obj.data.vertices, 'co', 3)
        actual_indices = array(obj.data.loops, 'vertex_index', dtype='<i4')
        check('runtime_geometry_' + obj.data.name,
              np.array_equal(actual_positions, positions) and np.array_equal(actual_indices, indices) and len(obj.data.polygons) == triangle_count,
              source_triangles=triangle_count, stored_triangles=len(obj.data.polygons),
              positions_sha256=data_sha(actual_positions.tobytes()), indices_sha256=data_sha(actual_indices.tobytes()))
        if expected.get('uv'):
            uv = np.asarray(expected['uv'], dtype='<f4').reshape(-1, 2)[indices]
            actual_uv = array(obj.data.uv_layers['Web_UV'].data, 'uv', 2)
            check('runtime_uv_' + obj.data.name, np.array_equal(actual_uv, uv.ravel()))
    check('all_runtime_instances_consumed', not any(candidates.values()))
    textured_drum_materials = [entry for entry in capture['materials'] if entry['id'] in drum_materials and entry.get('metalnessMap') and entry.get('normalMap')]
    check('five_textured_drum_material_groups', len(textured_drum_materials) == 5, count=len(textured_drum_materials))
    for entry in textured_drum_materials:
        material = drum_materials[entry['id']]
        principled = next((node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None) if material and material.node_tree else None
        check('drum_metallic_and_normal_links_' + entry['name'], principled is not None and
              principled.inputs['Metallic'].is_linked and principled.inputs['Normal'].is_linked,
              material=material.name if material else None)

    lights = [obj for obj in scene.objects if obj.type == 'LIGHT']
    expected_lights = [record for record in capture['lights'] if record['type'] != 'HemisphereLight']
    check('eight_captured_native_lights', len(lights) == len(expected_lights) == 8, actual=len(lights), source=len(expected_lights))
    remaining_lights = list(lights)
    report['lights'] = []
    for record in expected_lights:
        position = (CI @ matrix(record['matrixWorld'])).translation
        choices = [obj for obj in remaining_lights if obj.get('web_type') == record['type']]
        if not choices:
            check('native_light_' + record['name'], False, reason='No matching native light type')
            continue
        obj = min(choices, key=lambda item: (item.matrix_world.translation - position).length)
        remaining_lights.remove(obj)
        position_error = (obj.matrix_world.translation - position).length
        direction_error = 0.0
        if record.get('target'):
            desired = (CI @ Vector(record['target']) - position).normalized()
            actual = (obj.matrix_world.to_quaternion() @ Vector((0, 0, -1))).normalized()
            direction_error = (actual - desired).length
        check('native_light_position_and_target_' + obj.name, position_error < 2e-5 and direction_error < 2e-5,
              position_error=position_error, direction_unit_vector_error=direction_error)
        report['lights'].append({'name': obj.name, 'source_name': record['name'], 'type': obj.data.type,
                                 'position_error': position_error, 'direction_unit_vector_error': direction_error})

    report['movies'] = []
    for screen in capture['screens']:
        name = screen.get('objectName') or screen.get('name')
        obj = scene.objects.get(name)
        movie_nodes = [node for material in obj.data.materials if material and material.node_tree
                       for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image and node.image.source == 'MOVIE'] if obj else []
        check('screen_movie_texture_' + name, len(movie_nodes) == 1)
        if len(movie_nodes) != 1:
            continue
        node = movie_nodes[0]
        filepath = node.image.filepath
        actual = Path(bpy.path.abspath(filepath)).resolve()
        source = ROOT / 'source/public/assets/action/videos' / (screen['id'] + '.mp4')
        actual_sha = sha(actual) if actual.is_file() else None
        expected_sha = sha(source)
        row = {'screen': name, 'relative_path': filepath, 'bytes': actual.stat().st_size if actual.is_file() else None,
               'sha256': actual_sha, 'source_sha256': expected_sha}
        report['movies'].append(row)
        check('screen_movie_relative_and_original_bytes_' + name,
              filepath.startswith('//') and actual.is_file() and actual.is_relative_to(deliverable.parent) and actual_sha == expected_sha, **row)
        check('screen_movie_loop_' + name, node.image_user.use_cyclic and node.image_user.use_auto_refresh)
        duration = node.image.frame_duration / fps
        check('screen_movie_original_eight_seconds_' + name,
              node.image.frame_duration == node.image_user.frame_duration == 192 and abs(fps - 24) < 1e-8 and abs(duration - 8) < 1e-8,
              movie_frames=node.image.frame_duration, playback_frames=node.image_user.frame_duration,
              playback_fps=fps, seconds=duration)
    check('four_independent_movie_screens', len(report['movies']) == 4)
    images = [image for image in bpy.data.images if image.source == 'FILE' and image.users > 0]
    report['images'] = [{'name': image.name, 'packed': bool(image.packed_file), 'size': list(image.size)} for image in images]
    check('all_used_still_images_packed', all(image.packed_file for image in images), image_count=len(images))
    capture_textures = {(snapshot_path.parent / entry['path']).resolve(): entry for entry in capture.get('textures', [])}
    report['capture_pngs'] = []
    matched_textures = set()
    for image in bpy.data.images:
        original = Path(bpy.path.abspath(image.filepath)).resolve() if image.filepath else None
        if original not in capture_textures:
            continue
        expected_sha = sha(original)
        packed_sha = data_sha(image.packed_file.data) if image.packed_file else None
        matched_textures.add(original)
        check('captured_png_packed_original_bytes_' + image.name, packed_sha == expected_sha,
              packed_sha256=packed_sha, source_sha256=expected_sha)
        report['capture_pngs'].append({'name': image.name, 'source': capture_textures[original]['path'],
                                       'packed_sha256': packed_sha, 'source_sha256': expected_sha})
    check('all_captured_pngs_preserved', matched_textures == set(capture_textures),
          captured=len(capture_textures), matched=len(matched_textures))
    hdri_nodes = [node for node in scene.world.node_tree.nodes if node.type == 'TEX_ENVIRONMENT' and node.image] if scene.world and scene.world.node_tree else []
    check('forest_hdri_packed_original_bytes', len(hdri_nodes) == 1 and bool(hdri_nodes[0].image.packed_file) and
          data_sha(hdri_nodes[0].image.packed_file.data) == sha(ROOT / 'source/public/assets/environments/forest.exr'))
    undefined = [material.name + '/' + node.name for material in bpy.data.materials if material.node_tree
                 for node in material.node_tree.nodes if node.bl_idname == 'NodeUndefined']
    check('no_undefined_material_nodes', not undefined, undefined=undefined)

    width, height = capture['viewport']['width'], capture['viewport']['height']
    expected_projection = matrix(capture['camera']['projectionMatrix'])
    actual_projection = scene.camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(), x=width, y=height, scale_x=1, scale_y=1)
    projection_error = matrix_error(actual_projection, expected_projection)
    check('captured_camera_projection', projection_error < 2e-5, max_error=projection_error)
    check('captured_camera_world', matrix_error(scene.camera.matrix_world, CI @ matrix(capture['camera']['matrixWorld'])) < 2e-5)
    check('source_and_delivery_never_resaved', sha(SOURCE) == source_before and sha(deliverable) == delivery_before,
          source_sha256=source_before, delivery_sha256=delivery_before)
    report['pass'] = not report['errors']
    report['status'] = 'completed'
    report['elapsed_seconds'] = time.monotonic() - start
    flush()
    print('ACTION_BLEND_AUDIT=' + json.dumps({'pass': report['pass'], 'checks': len(report['checks']), 'errors': len(report['errors']),
                                           'native_strands': strands, 'native_points': points, 'runtime_objects': len(runtime),
                                           'projection_error': projection_error, 'output': str(output)}, ensure_ascii=False), flush=True)
    if report['errors']:
        print('AUDIT_ERRORS=' + json.dumps(report['errors'], ensure_ascii=False), flush=True)
        raise RuntimeError('Action-scene audit failed')
    if args.render:
        preview = args.render.resolve()
        preview.parent.mkdir(parents=True, exist_ok=True)
        scene.render.resolution_x = 1280
        scene.render.resolution_y = round(1280 * height / width)
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.render.filepath = str(preview)
        bpy.ops.render.render(write_still=True)
        report['preview'] = {'path': str(preview), 'bytes': preview.stat().st_size,
                             'width': scene.render.resolution_x, 'height': scene.render.resolution_y}
        report['source_and_delivery_sha256_unchanged_after_render'] = sha(SOURCE) == source_before and sha(deliverable) == delivery_before
        flush()
        print('ACTION_BLEND_PREVIEW=' + str(preview), flush=True)


if __name__ == '__main__':
    main()
