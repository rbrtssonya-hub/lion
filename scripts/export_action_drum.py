"""Export the supplied drum to a self-contained web GLB without saving the source.

Blender 5.1+: --background --factory-startup --python-exit-code 1
--python scripts/export_action_drum.py -- --input <gu(1).blend>
Use --overwrite only to rebuild this script's generated GLB and report.
"""
import argparse
import hashlib
import json
import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / 'source/models/action-drum/gu.blend'
OUTPUT = ROOT / 'source/public/assets/models/lion-action-drum.glb'
REPORT = ROOT / 'source/references/action-drum-2026-10-21.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    import bpy
    from mathutils import Vector

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if bpy.app.version < (5, 1, 0):
        raise RuntimeError('Blender 5.1+ is required for this source file')
    source = Path(args.input).resolve()
    source_hash = digest(source)
    for path in [OUTPUT, REPORT]:
        if path.exists() and not args.overwrite:
            raise FileExistsError(f'Refusing to overwrite {path}; pass --overwrite to rebuild generated files')
        path.parent.mkdir(parents=True, exist_ok=True)
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    if ARCHIVE.exists():
        if digest(ARCHIVE) != source_hash:
            raise RuntimeError('Refusing to replace a different source archive')
    else:
        with source.open('rb') as input_file, ARCHIVE.open('xb') as archived:
            shutil.copyfileobj(input_file, archived)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and not obj.hide_render]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangle_count = 0
    source_vertices = 0
    bounds = []
    for obj in meshes:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangle_count += len(mesh.loop_triangles)
        source_vertices += len(mesh.vertices)
        bounds.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
        evaluated.to_mesh_clear()
    source_bounds = [[min(point[i] for point in bounds) for i in range(3)],
                     [max(point[i] for point in bounds) for i in range(3)]]
    images = [{'name': image.name, 'size': list(image.size), 'packed': bool(image.packed_file)}
              for image in bpy.data.images if image.type == 'IMAGE']
    # glTF supports the Principled PBR channels and tangent normal maps. The
    # source's identity VectorMath node obscures UV discovery; reconnect UVs
    # without changing their values. Bump-over-normal is not a glTF channel:
    # export the authored tangent normal instead of silently losing both.
    for material in {obj.data.materials[0] for obj in meshes}:
        tree = material.node_tree
        uv = next((node for node in tree.nodes if node.type == 'TEX_COORD'), None)
        normal = next((node for node in tree.nodes if node.type == 'NORMAL_MAP'), None)
        principled = next((node for node in tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
        for node in tree.nodes:
            if node.type == 'TEX_IMAGE' and uv:
                tree.links.new(uv.outputs['UV'], node.inputs['Vector'])
        if normal and principled:
            tree.links.new(normal.outputs['Normal'], principled.inputs['Normal'])
    # Batch by material. Joining applies the original object transforms, keeps
    # UVs and all evaluated triangles, and reduces 359 object draws to 7.
    batches = {}
    for obj in meshes:
        if len(obj.data.materials) != 1:
            raise RuntimeError(f'Unexpected multi-material source object: {obj.name}')
        batches.setdefault(obj.data.materials[0].name, []).append(obj)
    joined = []
    for name, objects in sorted(batches.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.convert(target='MESH')
        if len(objects) > 1:
            bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        obj.name = f'Drum_PBR_{name}'
        joined.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in joined:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = joined[0]
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_normals=True,
        export_texcoords=True, export_tangents=False, export_materials='EXPORT',
        export_animations=False, export_cameras=False, export_lights=False,
        export_image_format='AUTO', export_extras=False,
    )
    data = OUTPUT.read_bytes()
    json_length, chunk_type = struct.unpack_from('<II', data, 12)
    if chunk_type != 0x4E4F534A:
        raise RuntimeError('Invalid GLB JSON chunk')
    gltf = json.loads(data[20:20 + json_length])
    exported_triangles = sum(gltf['accessors'][primitive['indices']]['count'] // 3
                             for mesh in gltf['meshes'] for primitive in mesh['primitives'])
    if exported_triangles != triangle_count:
        raise RuntimeError(f'Geometry mismatch: {triangle_count} source vs {exported_triangles} GLB triangles')
    if not all('bufferView' in image for image in gltf.get('images', [])):
        raise RuntimeError('Drum GLB contains an external texture')
    if not all('normalTexture' in material for material in gltf['materials']
               if material['name'].startswith(('01 ', '02 ', '03 ', '04 ', '05 '))):
        raise RuntimeError('Expected authored tangent normal maps in GLB')
    if digest(source) != source_hash or digest(ARCHIVE) != source_hash:
        raise RuntimeError('Source archive hash changed')
    report = {
        'date': '2026-10-21', 'blender_version': bpy.app.version_string,
        'source_filename': source.name, 'source_archive': ARCHIVE.relative_to(ROOT).as_posix(),
        'source_bytes': source.stat().st_size, 'source_sha256': source_hash,
        'source_meshes': len(meshes), 'source_evaluated_vertices': source_vertices,
        'source_evaluated_triangles': triangle_count, 'source_bounds_blender_xyz': source_bounds,
        'source_images': images,
        'output': OUTPUT.relative_to(ROOT).as_posix(), 'output_bytes': len(data),
        'output_sha256': digest(OUTPUT), 'output_meshes': len(gltf['meshes']),
        'output_materials': len(gltf['materials']), 'output_embedded_images': len(gltf.get('images', [])),
        'output_triangles': exported_triangles,
        'policy': {'source_saved': False, 'decimation': False, 'texture_resize': False,
                   'batch_by_material': True, 'all_source_triangles_preserved': True},
        'material_limit': 'glTF exports source PBR textures, coat and authored tangent normals; the additional Blender Height/Bump microrelief is not exported. Source packed images remain intact in the archived blend.',
        'placements': {'count': 4, 'height_m': 2.0, 'floor_y': 0.015,
                       'xz': [[-6, -6], [6, -6], [-6, 6], [6, 6]]},
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({key: report[key] for key in ['source_sha256', 'source_meshes', 'source_evaluated_triangles', 'output_bytes', 'output_meshes', 'output_materials', 'output_embedded_images', 'output_triangles']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
