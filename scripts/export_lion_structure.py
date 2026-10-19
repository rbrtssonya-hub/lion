"""Inspect/export the user supplied Blender lion without saving over the source.

Run with Blender 5's bundled Python, for example::

    blender --background --factory-startup --python scripts/export_lion_structure.py -- --inspect-only

The optional --input/--output/--report paths are relative to the repository root.
"""

import argparse
import array
import hashlib
import json
import math
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STRUCTURE_GROUPS = {
    'outer_shell': ['Lion_Nose', 'Lion_Ear_L', 'Lion_Ear_R'],
    'eyes': ['Lion_Brow_L', 'Lion_Brow_R'],
    'mirror': ['Lion_Crown', 'Lion_Forehead_Bead_09', 'Lion_Head.001'],
    'mouth': ['上牙', '牙下', '立方体'],
    'fur_and_bells': ['Lion_Beard'],
    'lion_cloth': ['Lion_Body', 'Lion_Body_Red_Trim', 'Lion_Tail', 'Lion_Foreleg_L', 'Lion_Foreleg_R', 'Lion_Forepaw_L', 'Lion_Forepaw_R', 'Lion_Hindleg_L', 'Lion_Hindleg_R', 'Lion_Hindpaw_L', 'Lion_Hindpaw_R'],
}


def project_path(value):
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def digest(path):
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(block)
    return hasher.hexdigest()


def readable_json(value):
    """Keep coordinate/name arrays on one line in the machine-readable report."""
    result = json.dumps(value, ensure_ascii=False, indent=2)
    scalar = r'(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*"|true|false|null)'
    pattern = r'\[\n\s+(' + scalar + r'(?:,\n\s+' + scalar + r')*)\n\s*\]'
    return re.sub(pattern, lambda match: '[' + re.sub(r'\n\s+', ' ', match.group(1)) + ']', result) + '\n'


_MATERIAL_FINGERPRINTS = {}


def material_fingerprint(material):
    if not material:
        return None
    identity = material.as_pointer()
    if identity in _MATERIAL_FINGERPRINTS:
        return _MATERIAL_FINGERPRINTS[identity]
    nodes = list(material.node_tree.nodes) if material.node_tree else []
    node_data = []
    for node in nodes:
        inputs = []
        for socket in node.inputs:
            if not hasattr(socket, 'default_value'):
                continue
            value = socket.default_value
            if value is None or isinstance(value, (bool, int, float, str)):
                serialized = value
            else:
                try:
                    serialized = list(value)
                except TypeError:
                    serialized = str(type(value))
            inputs.append([socket.identifier, serialized])
        settings = {key: getattr(node, key) for key in ('operation', 'blend_type', 'distribution', 'subsurface_method', 'uv_map', 'projection', 'interpolation', 'extension', 'space', 'invert') if hasattr(node, key)}
        image_signature = None
        if node.type == 'TEX_IMAGE' and node.image:
            image = node.image
            image_signature = {'size': list(image.size), 'colorspace': image.colorspace_settings.name, 'bytes': hashlib.sha256(image.packed_file.data).hexdigest() if image.packed_file else image.filepath}
        node_data.append({'type': node.type, 'inputs': inputs, 'settings': settings, 'image': image_signature})
    links = sorted([nodes.index(link.from_node), link.from_socket.identifier, nodes.index(link.to_node), link.to_socket.identifier] for link in material.node_tree.links) if material.node_tree else []
    data = {'diffuse_color': list(material.diffuse_color), 'backface_culling': material.use_backface_culling, 'nodes': node_data, 'links': links}
    signature = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    _MATERIAL_FINGERPRINTS[identity] = signature
    return signature


def mesh_fingerprint(obj):
    """Exclude exact coincident copies, retaining the first named source mesh."""
    positions = array.array('f', [0]) * (len(obj.data.vertices) * 3)
    loops = array.array('i', [0]) * len(obj.data.loops)
    obj.data.vertices.foreach_get('co', positions)
    obj.data.loops.foreach_get('vertex_index', loops)
    hasher = hashlib.sha256(positions.tobytes() + loops.tobytes())
    hasher.update(array.array('f', [value for row in obj.matrix_world for value in row]).tobytes())
    for attribute in ('loop_total', 'material_index', 'use_smooth'):
        values = array.array('i', [0]) * len(obj.data.polygons)
        obj.data.polygons.foreach_get(attribute, values)
        hasher.update(values.tobytes())
    for uv in obj.data.uv_layers:
        values = array.array('f', [0]) * (len(uv.data) * 2)
        uv.data.foreach_get('uv', values)
        hasher.update(uv.name.encode())
        hasher.update(values.tobytes())
    hasher.update(json.dumps([material_fingerprint(slot.material) for slot in obj.material_slots]).encode())
    return hasher.hexdigest()


def web_bounds(points):
    """Blender's glTF Y-up axis conversion is (x, z, -y)."""
    transformed = [(point.x, point.z, -point.y) for point in points]
    minimum = [min(point[axis] for point in transformed) for axis in range(3)]
    maximum = [max(point[axis] for point in transformed) for axis in range(3)]
    return {'min': minimum, 'max': maximum, 'center': [(a + b) / 2 for a, b in zip(minimum, maximum)]}


def structure_groups(objects):
    groups = {}
    for identifier, names in STRUCTURE_GROUPS.items():
        bounds = [obj['gltf_bounds'] for obj in objects if obj['name'] in names]
        minimum = [min(bound['min'][axis] for bound in bounds) for axis in range(3)]
        maximum = [max(bound['max'][axis] for bound in bounds) for axis in range(3)]
        groups[identifier] = {'names': names, 'gltf_bounds': {'min': minimum, 'max': maximum, 'center': [(a + b) / 2 for a, b in zip(minimum, maximum)]}}
    return groups


def approximate_fibers(obj, stride):
    """Sample authored hair centerlines as tiny, double-sided web mesh ribbons.

    glTF does not carry Blender hair curves. Source curve radius attributes in
    most objects are normalized factors (roughly 0.03–1.0); their authored
    fiber_world_radius_max property restores the intended world-space width.
    The short muzzle groom already stores radii in world units.
    This is an explicit web approximation, not a claim of lossless hair export.
    """
    import bpy
    from mathutils import Vector

    vertices, faces = [], []
    retained = 0
    authored_radius = obj.get('fiber_world_radius_max')
    radius_scale = float(authored_radius) if authored_radius else 1.0
    for curve_index in range(0, len(obj.data.curves), stride):
        curve = obj.data.curves[curve_index]
        start, count = curve.first_point_index, curve.points_length
        if count < 2:
            continue
        points = [obj.data.points[start + offset] for offset in range(count)]
        positions = [Vector(point.position) for point in points]
        tangent = positions[-1] - positions[0]
        if tangent.length < 1e-9:
            continue
        tangent.normalize()
        axis = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((0, 1, 0))
        side = tangent.cross(axis).normalized()
        other = tangent.cross(side).normalized()
        angle = curve_index * 2.399963229728653
        direction = side * math.cos(angle) + other * math.sin(angle)
        base = len(vertices)
        for point, position in zip(points, positions):
            halfwidth = max(0.0000005, point.radius * radius_scale)
            vertices.extend((tuple(position - direction * halfwidth), tuple(position + direction * halfwidth)))
        for offset in range(count - 1):
            index = base + offset * 2
            faces.append((index, index + 1, index + 3, index + 2))
        retained += 1
    mesh = bpy.data.meshes.new(obj.name + '_WebRibbons')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    result = bpy.data.objects.new(obj.name + '_WebFibers', mesh)
    bpy.context.scene.collection.objects.link(result)
    result.matrix_world = obj.matrix_world.copy()
    for material in obj.data.materials:
        if material and material.name.startswith('Lion_PhotoGroom'):
            material = bpy.data.materials.get('Fiber_Red_Scarlet')
        if material:
            mesh.materials.append(material)
    result['source_object'] = obj.name
    result['web_approximation'] = 'Sampled double-sided ribbon mesh from authored Blender hair centerlines'
    result['sample_stride'] = stride
    return result, {'source_object': obj.name, 'export_object': result.name, 'source_curves': len(obj.data.curves), 'retained_curves': retained, 'stride': stride, 'radius_scale': radius_scale, 'triangles': len(faces) * 2}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', default='model/醒狮_保留UV_三角转四边_优化.blend')
    parser.add_argument('--output', default='source/public/assets/models/lion-structure-optimized.glb')
    parser.add_argument('--report', default='source/references/lion-structure-model.json')
    parser.add_argument('--inspect-only', action='store_true')
    parser.add_argument('--fiber-stride', type=int, default=12)
    parser.add_argument('--overwrite', action='store_true', help='Explicitly replace an existing web export; the .blend source is always protected.')
    parser.add_argument('--skip-quantization', action='store_true', help='Skip the pinned, offline-compatible glTF vertex quantization stage (requires npm).')
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    options = parser.parse_args(arguments)
    source, target, report_path = map(project_path, (options.input, options.output, options.report))
    if not source.is_file():
        raise FileNotFoundError(f'Blender source not found: {source}')
    if source == target or source == report_path:
        raise ValueError('Export and report must not overwrite the Blender source')
    if target == report_path:
        raise ValueError('Export and report need different output paths')
    if target.exists() and not options.inspect_only and not options.overwrite:
        raise FileExistsError(f'Export already exists: {target}; use --overwrite only when replacement is intended')

    import bpy
    from mathutils import Vector

    original_hash = digest(source)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    if options.fiber_stride < 1:
        raise ValueError('Fiber stride must be a positive integer')
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    objects = []
    for obj in meshes:
        coordinates = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        objects.append({
            'name': obj.name,
            'mesh': obj.data.name,
            'vertices': len(obj.data.vertices),
            'edges': len(obj.data.edges),
            'polygons': len(obj.data.polygons),
            'triangles': sum(max(0, len(face.vertices) - 2) for face in obj.data.polygons),
            'uv_layers': [uv.name for uv in obj.data.uv_layers],
            'materials': [slot.material.name if slot.material else None for slot in obj.material_slots],
            'modifiers': [{'name': modifier.name, 'type': modifier.type} for modifier in obj.modifiers],
            'world_bounds': {
                'min': [min(point[axis] for point in coordinates) for axis in range(3)],
                'max': [max(point[axis] for point in coordinates) for axis in range(3)],
            },
            'gltf_bounds': web_bounds(coordinates),
            'location': list(obj.location),
            'rotation_euler': list(obj.rotation_euler),
            'scale': list(obj.scale),
        })
    images = [{
        'name': img.name,
        'size': list(img.size),
        'channels': img.channels,
        'source': img.source,
        'original_filename': Path(img.filepath).name,
        'packed': bool(img.packed_file),
        'colorspace': img.colorspace_settings.name,
    } for img in bpy.data.images]
    materials = [material.name for material in bpy.data.materials]
    report = {
        'blender_version': bpy.app.version_string,
        'source': source.relative_to(ROOT).as_posix() if source.is_relative_to(ROOT) else str(source),
        'source_bytes': source.stat().st_size,
        'source_sha256': original_hash,
        'scene_object_counts': {kind: sum(obj.type == kind for obj in bpy.context.scene.objects) for kind in sorted({obj.type for obj in bpy.context.scene.objects})},
        'mesh_objects': objects,
        'structure_groups': structure_groups(objects),
        'materials': materials,
        'images': images,
        'geometry_status': 'Full lion with real named body/head submeshes; eyes are painted into the main head mesh and are not independent geometry.',
        'compatibility': 'Source header is Blender 5.1; Blender 5.0.0 reads it with a newer-version warning. Source is never saved by this script.',
        'source_provenance': {
            'source_assets_in_custom_properties': sorted({str(obj['source_asset']) for obj in bpy.data.objects if 'source_asset' in obj}),
            'part_partition_status': 'Custom properties describe spatial/UV color selection of existing source triangles, uncapped cuts, and unreconstructed topology; named parts are appearance partitions, not complete craft internals or rigged joints.',
            'ai_provenance_status': 'No explicit Lux3D/AI provider attribution was found in the inspected scene/object/mesh/material custom properties. Do not infer the new model generation method from generic asset IDs.',
            'material_inference': sorted({str(material['appearance_inference']) for material in bpy.data.materials if 'appearance_inference' in material}),
        },
    }
    seen, unique_meshes, duplicates = {}, [], []
    for obj in meshes:
        fingerprint = mesh_fingerprint(obj)
        if fingerprint in seen:
            duplicates.append({'excluded': obj.name, 'identical_to': seen[fingerprint]})
        else:
            seen[fingerprint] = obj.name
            unique_meshes.append(obj)
    report['duplicate_verification'] = {'criteria': 'Exact positions, indices, polygon lengths, smooth flags, per-face material indices, every UV layer, numeric world transform, shader node input values/links/settings, and packed texture bytes (material names ignored).', 'duplicates': duplicates}
    if not options.inspect_only:
        target.parent.mkdir(parents=True, exist_ok=True)
        mesh_repairs = []
        for obj in unique_meshes:
            before = {'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons)}
            repaired = obj.data.validate(verbose=False, clean_customdata=False)
            if repaired:
                mesh_repairs.append({'object': obj.name, 'before': before, 'after': {'vertices': len(obj.data.vertices), 'polygons': len(obj.data.polygons)}})
        report['mesh_objects'] = [{key: value for key, value in data.items() if key in ('name', 'vertices', 'triangles', 'uv_layers', 'materials', 'gltf_bounds')} for data in objects if data['name'] in {obj.name for obj in unique_meshes}]
        material_adaptations = []
        for material in bpy.data.materials:
            if not material.node_tree:
                continue
            for node in material.node_tree.nodes:
                if node.type != 'BSDF_PRINCIPLED':
                    continue
                normal = node.inputs.get('Normal')
                for link in list(normal.links) if normal else []:
                    if link.from_node.type == 'BUMP':
                        # The glTF exporter treats an upstream grayscale weave
                        # mask as RGB normals, producing large dark fragments on
                        # the legs. Procedural bump is not a portable normal map.
                        material.node_tree.links.remove(link)
                        material_adaptations.append({'material': material.name, 'adaptation': 'Omit unsupported procedural Bump output from the web export; preserve color, roughness, metallic, UV and actual Normal Map nodes.'})
        fibers, fiber_reports = [], []
        for obj in list(bpy.context.scene.objects):
            if obj.type == 'CURVES':
                # Keep all special short muzzle strands; sample the dense fur.
                stride = 1 if 'PhotoGroom' in obj.name else options.fiber_stride
                result, fiber_report = approximate_fibers(obj, stride)
                fibers.append(result)
                fiber_reports.append(fiber_report)
        # Hair ribbons must remain visible from both sides when orbiting.
        for obj in fibers:
            for material in obj.data.materials:
                material.use_backface_culling = False
        bpy.ops.object.select_all(action='DESELECT')
        for obj in unique_meshes + fibers:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = unique_meshes[0]
        settings = {
            'export_format': 'GLB',
            'use_selection': True,
            'export_yup': True,
            'export_apply': True,
            'export_texcoords': True,
            'export_normals': True,
            'export_materials': 'EXPORT',
            'export_image_format': 'JPEG',
            'export_image_quality': 90,
            'export_animations': False,
            'export_extras': True,
        }
        with tempfile.TemporaryDirectory(prefix='lion-structure-export-') as temporary:
            raw = Path(temporary) / 'lion-structure-raw.glb'
            bpy.ops.export_scene.gltf(filepath=str(raw), **settings)
            if options.skip_quantization:
                shutil.copyfile(raw, target)
            else:
                npm = shutil.which('npm.cmd') or shutil.which('npm')
                if not npm:
                    raise RuntimeError('npm is required for standard glTF quantization; use --skip-quantization only for an unoptimized inspection export')
                base_command = [npm, 'exec', '--yes', '--package=@gltf-transform/cli@4.2.1', '--', 'gltf-transform']
                quantized, pruned, welded = [Path(temporary) / (name + '.glb') for name in ('quantized', 'pruned', 'welded')]
                commands = [
                    ['quantize', str(raw), str(quantized), '--quantize-position', '16', '--quantize-normal', '8', '--quantize-texcoord', '16'],
                    ['prune', str(quantized), str(pruned)],
                    ['weld', str(pruned), str(welded)],
                ]
                for command in commands:
                    subprocess.run(base_command + command, check=True, cwd=ROOT)
                shutil.copyfile(welded, target)
        data = target.read_bytes()
        gltf = json.loads(data[20:20 + struct.unpack_from('<I', data, 12)[0]])
        image_info = [{'name': image.get('name'), 'mime_type': image['mimeType'], 'bytes': gltf['bufferViews'][image['bufferView']]['byteLength']} for image in gltf.get('images', [])]
        report['export'] = {
            'path': target.relative_to(ROOT).as_posix() if target.is_relative_to(ROOT) else str(target),
            'bytes': target.stat().st_size,
            'sha256': digest(target),
            'settings': settings,
            'coincident_meshes_excluded': duplicates,
            'mesh_object_names': [obj.name for obj in unique_meshes],
            'mesh_repairs_in_memory': mesh_repairs,
            'material_adaptations_in_memory': material_adaptations,
            'gltf_meshes': len(gltf['meshes']),
            'gltf_nodes': len(gltf['nodes']),
            'gltf_materials': len(gltf['materials']),
            'gltf_triangles': sum(gltf['accessors'][primitive['indices']]['count'] // 3 for mesh in gltf['meshes'] for primitive in mesh['primitives']),
            'gltf_vertices': sum(gltf['accessors'][primitive['attributes']['POSITION']]['count'] for mesh in gltf['meshes'] for primitive in mesh['primitives']),
            'gltf_images': image_info,
            'quantization': None if options.skip_quantization else {'tool': '@gltf-transform/cli@4.2.1', 'steps': ['quantize', 'prune unused attributes', 'weld bitwise identical vertices'], 'position_bits': 16, 'normal_bits': 8, 'texcoord_bits': 16, 'tiling_uvs_outside_unit_square': 'Preserved as Float32', 'runtime_extension': 'KHR_mesh_quantization', 'external_decoder': False},
            'hair_approximation': {
                'method': 'Deterministic sampled centerlines become double-sided ribbon meshes; normalized radii use each source object fiber_world_radius_max (about 0.14–0.16 mm), and muzzle radii keep source world units. Groom BSDF uses the existing scarlet Principled material for web compatibility.',
                'objects': fiber_reports,
            },
        }
    if digest(source) != original_hash:
        raise RuntimeError('Source hash changed during export')
    report['source_unchanged'] = True
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(readable_json(report), encoding='utf-8')
    print(readable_json({'source_sha256': original_hash, 'source_unchanged': True, 'export': report.get('export'), 'report': str(report_path)}))


if __name__ == '__main__':
    main()
