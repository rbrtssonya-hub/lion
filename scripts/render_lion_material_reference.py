"""Render the untouched Blender lion with a camera captured from the web viewer.

Blender 5.1+: --background --factory-startup --python-exit-code 1
--python scripts/render_lion_material_reference.py -- --capture <capture.json>
--output tmp/lion-material-reference/reference.png [--render] [--overwrite]

Without --render, validate the geometry/projection and write metadata only.
The .blend is opened read-only and is never saved. This script changes only
in-memory scene setup and a new parent transform, not model data/materials.

Capture schema (all matrices are Three.js column-major arrays):
{
  "camera": {"matrixWorld": [16 numbers], "projectionMatrix": [16 numbers]},
  "lion": {"matrixWorld": [16 numbers]},
  "viewport": {"width": 1920, "height": 1080},
  "environment": {"path": ".../forest.exr", "intensity": 1,
                  "rotationDegrees": 0, "exposure": 0}
}

viewport width/height are the output image dimensions, not a second DPR
multiplier. lion.matrixWorld is the complete asset root's world matrix, before
its individual exported object nodes; it includes all theater/mount/animation
parents. Its matching source is user-lion-2026-10-20.blend.
"""

import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'source/models/user-lion-2026-10-20.blend'
FOREST = ROOT / 'source/public/assets/environments/forest.exr'
SOURCE_SHA256 = 'dcfd8b97a27c371381aa7a0b1c26f5081fc4a35976a571979596aec353d6f770'


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def finite_number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{label} must be a finite number')
    return float(value)


def matrix_from_three(values, label, Matrix):
    if not isinstance(values, list) or len(values) != 16:
        raise ValueError(f'{label} must contain 16 column-major numbers')
    values = [finite_number(value, label) for value in values]
    return Matrix([[values[column * 4 + row] for column in range(4)] for row in range(4)])


def matrix_rows(matrix):
    return [list(row) for row in matrix]


def max_error(first, second):
    return max(abs(first[row][column] - second[row][column]) for row in range(4) for column in range(4))


def main():
    import bpy
    from mathutils import Matrix

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--metadata', type=Path)
    parser.add_argument('--source', type=Path, default=SOURCE)
    parser.add_argument('--samples', type=int, default=64)
    parser.add_argument('--render', action='store_true')
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if bpy.app.version < (5, 1, 0):
        raise RuntimeError('Blender 5.1+ is required to preserve this source')
    if not 1 <= args.samples <= 512:
        raise ValueError('--samples must be between 1 and 512')
    source = args.source.resolve()
    capture_path = args.capture.resolve()
    output = args.output.resolve()
    metadata_path = (args.metadata or output.with_suffix('.json')).resolve()
    if output.suffix.lower() != '.png' or metadata_path.suffix.lower() != '.json':
        raise ValueError('Output must be PNG and metadata must be JSON')
    if source in (output, metadata_path) or capture_path in (output, metadata_path):
        raise ValueError('Source and capture files cannot be output targets')
    for path in (output, metadata_path):
        if path.exists() and not args.overwrite:
            raise FileExistsError(f'Refusing to overwrite {path}; pass --overwrite explicitly')
    source_hash = sha256(source)
    if source_hash != SOURCE_SHA256:
        raise RuntimeError('Source SHA256 differs from the complete lion used by the viewer')
    capture = json.loads(capture_path.read_text(encoding='utf-8-sig'))
    camera_world = matrix_from_three(capture['camera']['matrixWorld'], 'camera.matrixWorld', Matrix)
    projection = matrix_from_three(capture['camera']['projectionMatrix'], 'camera.projectionMatrix', Matrix)
    asset_world = matrix_from_three(capture['lion']['matrixWorld'], 'lion.matrixWorld', Matrix)
    viewport = capture['viewport']
    width, height = viewport['width'], viewport['height']
    if any(isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 8192 for value in (width, height)):
        raise ValueError('viewport width/height must be integer output dimensions from 1 through 8192')
    for label, matrix in [('camera.matrixWorld', camera_world), ('lion.matrixWorld', asset_world)]:
        if max(abs(matrix[3][column] - (1 if column == 3 else 0)) for column in range(4)) > 1e-6:
            raise ValueError(f'{label} must be affine')
        if abs(matrix.determinant()) < 1e-12:
            raise ValueError(f'{label} must be invertible')
    camera_basis = camera_world.to_3x3()
    if max_error(camera_basis.transposed().to_4x4() @ camera_basis.to_4x4(), Matrix.Identity(4)) > 1e-5 or camera_basis.determinant() < 0:
        raise ValueError('Captured camera must have unit scale and no shear/reflection')
    allowed = {(0, 0), (1, 1), (0, 2), (1, 2), (2, 2), (2, 3), (3, 2)}
    if any(abs(projection[row][column]) > 1e-6 for row in range(4) for column in range(4) if (row, column) not in allowed):
        raise ValueError('Only a standard perspective projection (including lens shift) is supported')
    if abs(projection[3][2] + 1) > 1e-6 or min(projection[0][0], projection[1][1]) <= 0:
        raise ValueError('Projection must use Three.js/WebGL perspective conventions')
    aspect = width / height
    if abs(projection[1][1] / projection[0][0] - aspect) > 2e-5 * max(1, aspect):
        raise ValueError('Captured projection aspect differs from output dimensions; do not crop/stretch the capture')
    near = projection[2][3] / (projection[2][2] - 1)
    far = projection[2][3] / (projection[2][2] + 1)
    if not 0 < near < far < 1e8:
        raise ValueError('Captured near/far clip distances are invalid')
    environment = capture.get('environment', {})
    forest = Path(environment.get('path', FOREST)).resolve()
    if not forest.is_file():
        raise FileNotFoundError(forest)
    intensity = finite_number(environment.get('intensity', 1), 'environment.intensity')
    rotation = finite_number(environment.get('rotationDegrees', 0), 'environment.rotationDegrees')
    exposure = finite_number(environment.get('exposure', 0), 'environment.exposure')
    if intensity < 0:
        raise ValueError('Environment intensity cannot be negative')

    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    scene = bpy.context.scene
    original_objects = list(scene.objects)
    model_objects = [obj for obj in original_objects if obj.type in {'MESH', 'CURVES', 'EMPTY'}]
    roots = [obj for obj in model_objects if obj.parent not in model_objects]
    source_material_count = len(bpy.data.materials)
    source_counts = {kind: sum(obj.type == kind for obj in original_objects) for kind in ('MESH', 'CURVES', 'EMPTY', 'LIGHT')}
    source_particle_systems = sum(len(obj.particle_systems) for obj in original_objects if obj.type == 'MESH')
    source_view = {'engine': scene.render.engine, 'view_transform': scene.view_settings.view_transform,
                   'look': scene.view_settings.look, 'exposure': scene.view_settings.exposure,
                   'gamma': scene.view_settings.gamma, 'hair_type': scene.render.hair_type,
                   'hair_subdiv': scene.render.hair_subdiv}

    # C maps native Blender world positions to the exported asset's Y-up world:
    # C(x,y,z)=(x,z,-y). Convert the capture's entire world back to Z-up.
    # (C^-1 Camera)^-1 (C^-1 Asset C) p == Camera^-1 Asset C p.
    conversion = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
    source_to_capture = conversion.inverted() @ asset_world @ conversion
    parent = bpy.data.objects.new('Reference_Captured_Asset_Transform', None)
    scene.collection.objects.link(parent)
    parent.matrix_world = source_to_capture
    original_root_matrices = {obj.name: obj.matrix_world.copy() for obj in roots}
    for obj in roots:
        source_world = original_root_matrices[obj.name]
        obj.parent = parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = source_world
    # Source studio Area lights are not enabled in its material-preview baseline.
    for obj in original_objects:
        if obj.type in {'LIGHT', 'CAMERA'}:
            obj.hide_render = True

    camera_data = bpy.data.cameras.new('Reference_Captured_Perspective')
    camera = bpy.data.objects.new('Reference_Captured_Camera', camera_data)
    scene.collection.objects.link(camera)
    camera.matrix_world = conversion.inverted() @ camera_world
    camera_data.type = 'PERSP'
    camera_data.sensor_fit = 'VERTICAL'
    camera_data.sensor_height = 36
    camera_data.lens = 0.5 * camera_data.sensor_height * projection[1][1]
    camera_data.shift_x = 0.5 * projection[0][2] * aspect
    camera_data.shift_y = 0.5 * projection[1][2]
    camera_data.clip_start = near
    camera_data.clip_end = far
    camera_data.dof.use_dof = False
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
    bpy.context.view_layer.update()
    calculated = camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(), x=width, y=height, scale_x=1, scale_y=1)
    projection_error = max_error(calculated, projection)
    if projection_error > 2e-5:
        raise RuntimeError(f'Blender projection does not match captured Three.js projection: {projection_error}')
    actual_clip = calculated @ camera.matrix_world.inverted() @ source_to_capture
    expected_clip = projection @ camera_world.inverted() @ asset_world @ conversion
    clip_error = max_error(actual_clip, expected_clip)
    if clip_error > 2e-4:
        raise RuntimeError(f'Source-to-clip transform failed validation: {clip_error}')
    # Additional independently captured object nodes validate that the caller
    # supplied the complete asset root rather than a model/mount parent twice.
    node_checks = []
    for captured_node in capture.get('nodes', []):
        obj = scene.objects.get(captured_node.get('name', ''))
        if obj is None or obj not in model_objects:
            continue  # GLTFLoader sanitizes some source names; do not guess aliases.
        captured_world = matrix_from_three(captured_node['matrixWorld'], 'nodes.matrixWorld', Matrix)
        rendered_world = conversion @ obj.matrix_world @ conversion.inverted()
        error = max_error(rendered_world, captured_world)
        node_checks.append({'name': obj.name, 'world_matrix_max_error': error})
        if error > 2e-4:
            raise RuntimeError(f'Captured/source world transform mismatch for {obj.name}: {error}')

    world = bpy.data.worlds.new('Reference_Forest_Only')
    world.use_nodes = True
    scene.world = world
    nodes = world.node_tree.nodes
    nodes.clear()
    texture = nodes.new('ShaderNodeTexEnvironment')
    texture.image = bpy.data.images.load(str(forest), check_existing=False)
    texture.projection = 'EQUIRECTANGULAR'
    # For d_B=C^-1*d_Three, Blender's -atan(y,x) equals Three's atan(z,x).
    # A negative Z rotation therefore samples original longitude + web yaw.
    texture.texture_mapping.rotation[2] = -math.radians(rotation)
    background = nodes.new('ShaderNodeBackground')
    background.inputs['Strength'].default_value = intensity
    output_node = nodes.new('ShaderNodeOutputWorld')
    world.node_tree.links.new(texture.outputs['Color'], background.inputs['Color'])
    world.node_tree.links.new(background.outputs['Background'], output_node.inputs['Surface'])
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = args.samples
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.use_file_extension = True
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.render.use_simplify = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = exposure
    scene.view_settings.gamma = 1
    scene.render.filepath = str(output)
    assert len(bpy.data.materials) == source_material_count
    assert all(obj in scene.objects[:] for obj in original_objects)
    report = {
        'mode': 'render' if args.render else 'validate-only',
        'rendered': False, 'blender_version': bpy.app.version_string,
        'source': str(source), 'source_sha256': source_hash,
        'capture': str(capture_path), 'capture_sha256': sha256(capture_path),
        'output': str(output), 'resolution': [width, height],
        'source_settings': source_view, 'source_object_counts': source_counts,
        'source_particle_systems': source_particle_systems,
        'source_material_count': source_material_count,
        'source_root_names': sorted(original_root_matrices),
        'conversion_blender_to_gltf_row_major': matrix_rows(conversion),
        'asset_transform_blender_row_major': matrix_rows(source_to_capture),
        'camera_world_blender_row_major': matrix_rows(camera.matrix_world),
        'projection_expected_row_major': matrix_rows(projection),
        'projection_blender_row_major': matrix_rows(calculated),
        'projection_max_error': projection_error,
        'source_to_clip_max_error': clip_error,
        'captured_node_cross_checks': node_checks,
        'camera': {'lens': camera_data.lens, 'sensor_fit': camera_data.sensor_fit,
                   'shift_x': camera_data.shift_x, 'shift_y': camera_data.shift_y,
                   'clip_start': camera_data.clip_start, 'clip_end': camera_data.clip_end},
        'environment': {'path': str(forest), 'sha256': sha256(forest),
                        'intensity': intensity, 'web_rotation_degrees': rotation,
                        'blender_texture_rotation_z': texture.texture_mapping.rotation[2],
                        'image_color_space': texture.image.colorspace_settings.name},
        'render_settings': {'engine': scene.render.engine, 'samples': args.samples,
                            'transparent': True, 'auxiliary_lights': False,
                            'view_transform': 'AgX', 'look': 'None',
                            'exposure': exposure, 'gamma': 1, 'simplify': False},
        'policy': {'save_source': False, 'change_geometry': False,
                   'change_source_materials': False, 'change_hair_density': False,
                   'change_source_color': False, 'compositing': False},
        'limits': ['Native EEVEE full curves/particles are retained, not converted to the web line shader.',
                   'Exact projection/pose matching does not imply equal BRDF, IBL prefilter, AgX, or sampling.',
                   'Background is transparent; compare after using the same background for both outputs.'],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    if args.render:
        started = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        if not output.is_file():
            raise RuntimeError('Blender did not create the requested reference PNG')
        report.update(rendered=True, render_seconds=time.perf_counter() - started,
                      output_sha256=sha256(output), output_bytes=output.stat().st_size)
    report['source_sha256_after'] = sha256(source)
    if report['source_sha256_after'] != source_hash:
        raise RuntimeError('Source file bytes unexpectedly changed')
    with metadata_path.open('w' if args.overwrite else 'x', encoding='utf-8') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print('LION_MATERIAL_REFERENCE=' + json.dumps({
        'rendered': report['rendered'], 'metadata': str(metadata_path),
        'projection_max_error': projection_error, 'source_to_clip_max_error': clip_error,
        'source_unchanged': True,
    }, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
