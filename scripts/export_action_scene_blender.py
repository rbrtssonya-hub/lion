"""Build the current action page as an editable Blender 5.0 scene.

First run capture_action_scene.mjs against the local Vite app, then:
  F:/Blender/blender.exe -b --factory-startup --python-exit-code 1
    --python scripts/export_action_scene_blender.py --
    --snapshot tmp/action-blender-export/snapshot/scene.json --output <new.blend>

The native lion is read only. Existing output files are refused. Runtime
instances become linked editable objects; source lion meshes, particles and
curves retain their native data. Movies are copied beside the deliverable.
"""

import argparse
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'source/models/user-lion-2026-10-20.blend'
SOURCE_SHA = 'dcfd8b97a27c371381aa7a0b1c26f5081fc4a35976a571979596aec353d6f770'
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
CI = C.inverted()


def sha(path):
    result = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def matrix(values):
    if len(values) != 16 or not all(math.isfinite(v) for v in values):
        raise ValueError('Expected finite column-major 4x4 matrix')
    return Matrix([[values[col * 4 + row] for col in range(4)] for row in range(4)])


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def empty(name, owner):
    obj = bpy.data.objects.new(name, None)
    owner.objects.link(obj)
    return obj


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if bpy.app.version[:2] != (5, 0):
        raise RuntimeError('Use Blender 5.0 to produce the requested file version')
    output = args.output.resolve()
    snapshot_path = args.snapshot.resolve()
    if output.suffix.lower() != '.blend' or output.exists():
        raise FileExistsError('Output must be a new .blend file: ' + str(output))
    if sha(SOURCE) != SOURCE_SHA:
        raise RuntimeError('Native lion source SHA256 does not match the action page')
    capture = json.loads(snapshot_path.read_text(encoding='utf-8-sig'))
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE), load_ui=False)
    scene = bpy.context.scene
    original_objects = list(scene.objects)
    lion_objects = [obj for obj in original_objects if obj.type in {'MESH', 'CURVES', 'EMPTY'}]
    counts = {kind: sum(obj.type == kind for obj in lion_objects) for kind in ('MESH', 'CURVES', 'EMPTY')}
    if counts['MESH'] != 53 or counts['CURVES'] != 3:
        raise RuntimeError('Native lion mesh/curves object counts differ from the source audit')
    particle_count = sum(len(obj.particle_systems) for obj in lion_objects if obj.type == 'MESH')
    if particle_count != 30:
        raise RuntimeError('Expected all 30 native particle hair systems')
    source_materials = {material.name for obj in lion_objects for material in getattr(obj.data, 'materials', []) if material}
    for obj in original_objects:
        if obj not in lion_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    owners = {key: collection(name) for key, name in {
        'room': '01_Room', 'architecture': '02_Red_Gold_Architecture',
        'lion': '03_Complete_Native_Lion', 'drums': '04_Four_User_Drums',
        'screens': '05_Video_Screens', 'lights': '06_Lighting',
        'cameras': '07_Cameras', 'anchors': '08_Interaction_Anchors',
    }.items()}
    source_world = {obj.name: obj.matrix_world.copy() for obj in lion_objects}
    roots = [obj for obj in lion_objects if obj.parent not in lion_objects]
    for obj in lion_objects:
        for old in list(obj.users_collection):
            old.objects.unlink(obj)
        owners['lion'].objects.link(obj)
    for old in list(bpy.data.collections):
        if old not in owners.values() and not old.objects and not old.children:
            bpy.data.collections.remove(old)
    lion_parent = empty('Lion_Web_36s_Rotation', owners['lion'])
    lion_parent.matrix_world = CI @ matrix(capture['lion']['matrixWorld']) @ C
    pivot = empty('Lion_Stage_Centre_Rotation_Pivot', owners['lion'])
    pivot.location = (0, 0, capture.get('architecture', {}).get('parameters', {}).get('stageTop', .4))
    bpy.context.view_layer.update()
    lion_world = lion_parent.matrix_world.copy()
    lion_parent.parent = pivot
    lion_parent.matrix_parent_inverse = Matrix.Identity(4)
    lion_parent.matrix_basis = pivot.matrix_world.inverted() @ lion_world
    lion_parent['source_sha256'] = SOURCE_SHA
    lion_parent['hair_groups'] = 33
    lion_parent['render_strands'] = capture['lion']['statistics']['strands']
    lion_parent['source_mesh_objects'] = counts['MESH']
    lion_parent['source_particle_systems'] = particle_count
    for obj in roots:
        obj.parent = lion_parent
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = source_world[obj.name]
    # The browser auto-rotates the complete lion once every 36 seconds.
    # Animate its outer parent while leaving every native object transform intact.
    pivot.rotation_mode = 'XYZ'
    for frame, rotation in [(1, 0), (865, 2 * math.pi)]:
        pivot.rotation_euler.z = rotation
        pivot.keyframe_insert(data_path='rotation_euler', index=2, frame=frame)
    action = pivot.animation_data.action
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for curve in channelbag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = 'LINEAR'
                    curve.modifiers.new('CYCLES')

    image_cache = {}
    texture_info = {}
    for entry in capture.get('textures', []):
        texture_info[entry['id']] = entry
        texture_info[entry['path']] = entry

    def image_texture(nodes, links, value, color_data=False):
        if not value:
            return None
        info = texture_info.get(value, value) if isinstance(value, str) else value
        if isinstance(info, str):
            info = {'path': info}
        path = (snapshot_path.parent / (info.get('path') or info.get('file'))).resolve()
        key = (str(path), color_data)
        if key not in image_cache:
            img = bpy.data.images.load(str(path), check_existing=False)
            if color_data:
                img.colorspace_settings.name = 'Non-Color'
            img.pack()
            image_cache[key] = img
        node = nodes.new('ShaderNodeTexImage')
        node.image = image_cache[key]
        node.extension = 'REPEAT'
        uv = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeMapping')
        repeat = info.get('repeat', [1, 1])
        offset = info.get('offset', [0, 0])
        # PNGs and movie images have top-origin rows; Blender UVs are bottom-origin.
        flip = not info.get('flipY', True)
        mapping.inputs['Scale'].default_value = (repeat[0], -repeat[1] if flip else repeat[1], 1)
        mapping.inputs['Location'].default_value = (offset[0], 1 - offset[1] if flip else offset[1], 0)
        links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], node.inputs['Vector'])
        return node

    materials = {}
    for entry in capture['materials']:
        material = bpy.data.materials.new(entry.get('name') or 'Web_Material')
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        principled = nodes.get('Principled BSDF')
        color = entry.get('color', [.8, .8, .8])
        principled.inputs['Base Color'].default_value = (*color[:3], entry.get('opacity', 1))
        for source, target in [('metalness', 'Metallic'), ('roughness', 'Roughness'),
                               ('clearcoat', 'Coat Weight'), ('clearcoatRoughness', 'Coat Roughness'),
                               ('specularIntensity', 'Specular IOR Level')]:
            if source in entry and entry[source] is not None:
                principled.inputs[target].default_value = entry[source]
        if entry.get('specularColor'):
            principled.inputs['Specular Tint'].default_value = (*entry['specularColor'][:3], 1)
        if entry.get('emissive'):
            principled.inputs['Emission Color'].default_value = (*entry['emissive'][:3], 1)
            principled.inputs['Emission Strength'].default_value = entry.get('emissiveIntensity', 1)
        texture = image_texture(nodes, links, entry.get('map'))
        if texture:
            multiply = nodes.new('ShaderNodeMixRGB')
            multiply.blend_type = 'MULTIPLY'
            multiply.inputs[0].default_value = 1
            multiply.inputs[2].default_value = (*color[:3], 1)
            links.new(texture.outputs['Color'], multiply.inputs[1])
            links.new(multiply.outputs[0], principled.inputs['Base Color'])
        roughness = image_texture(nodes, links, entry.get('roughnessMap'), True)
        if roughness:
            separate = nodes.new('ShaderNodeSeparateColor')
            links.new(roughness.outputs['Color'], separate.inputs['Color'])
            multiply = nodes.new('ShaderNodeMath')
            multiply.operation = 'MULTIPLY'
            multiply.inputs[1].default_value = entry.get('roughness', 1)
            links.new(separate.outputs['Green'], multiply.inputs[0])
            links.new(multiply.outputs[0], principled.inputs['Roughness'])
        metallic = image_texture(nodes, links, entry.get('metalnessMap'), True)
        if metallic:
            separate = nodes.new('ShaderNodeSeparateColor')
            links.new(metallic.outputs['Color'], separate.inputs['Color'])
            multiply = nodes.new('ShaderNodeMath')
            multiply.operation = 'MULTIPLY'
            multiply.inputs[1].default_value = entry.get('metalness', 1)
            links.new(separate.outputs['Blue'], multiply.inputs[0])
            links.new(multiply.outputs[0], principled.inputs['Metallic'])
        normal = image_texture(nodes, links, entry.get('normalMap'), True)
        if normal:
            normal_map = nodes.new('ShaderNodeNormalMap')
            normal_map.uv_map = 'Web_Tangent_UV'
            normal_map.inputs['Strength'].default_value = (entry.get('normalScale') or [1, 1])[0]
            links.new(normal.outputs['Color'], normal_map.inputs['Color'])
            links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])
        materials[entry['id']] = material

    geometry_records = {item['id']: item for item in capture['geometries']}
    meshes = {}
    imported_objects = []
    for record in capture['meshes']:
        material_ids = record['material'] if isinstance(record['material'], list) else [record['material']]
        key = (record['geometry'], tuple(material_ids))
        if key not in meshes:
            geometry = geometry_records[record['geometry']]
            positions = np.asarray(geometry['position'], dtype=np.float32).reshape(-1, 3)
            indices = geometry.get('index')
            triangles = np.asarray(indices if indices is not None else np.arange(len(positions)), dtype=np.int32).reshape(-1, 3)
            mesh = bpy.data.meshes.new(record['name'] + '_Geometry')
            mesh.vertices.add(len(positions))
            mesh.vertices.foreach_set('co', positions.ravel())
            mesh.loops.add(triangles.size)
            mesh.loops.foreach_set('vertex_index', triangles.ravel())
            mesh.polygons.add(len(triangles))
            mesh.polygons.foreach_set('loop_start', np.arange(len(triangles), dtype=np.int32) * 3)
            mesh.polygons.foreach_set('loop_total', np.full(len(triangles), 3, dtype=np.int32))
            mesh.polygons.foreach_set('use_smooth', np.ones(len(triangles), dtype=bool))
            if geometry.get('uv'):
                uv = np.asarray(geometry['uv'], dtype=np.float32).reshape(-1, 2)
                layer = mesh.uv_layers.new(name='Web_UV')
                layer.data.foreach_set('uv', uv[triangles.ravel()].ravel())
                tangent_uv = uv.copy()
                tangent_uv[:, 1] = 1 - tangent_uv[:, 1]
                tangent_layer = mesh.uv_layers.new(name='Web_Tangent_UV')
                tangent_layer.data.foreach_set('uv', tangent_uv[triangles.ravel()].ravel())
                mesh.uv_layers.active_index = 0
            for material_id in material_ids:
                mesh.materials.append(materials[material_id])
            for group in geometry.get('groups', []):
                if len(material_ids) > 1:
                    first = group['start'] // 3
                    last = min(len(triangles), (group['start'] + group['count']) // 3)
                    for poly in mesh.polygons[first:last]:
                        poly.material_index = group['materialIndex']
            mesh.update()
            if geometry.get('normal'):
                mesh.normals_split_custom_set_from_vertices(np.asarray(geometry['normal']).reshape(-1, 3).tolist())
            meshes[key] = mesh
        name = record['name']
        target = 'screens' if name.startswith('Screen_') else 'drums' if name.startswith('Theater_Drum_') else 'room' if name.startswith('Room_') else 'architecture'
        obj = bpy.data.objects.new(name, meshes[key])
        owners[target].objects.link(obj)
        obj.matrix_world = CI @ matrix(record['matrixWorld'])
        obj['web_geometry_id'] = record['geometry']
        if 'instanceIndex' in record:
            obj['web_instance_index'] = record['instanceIndex']
        imported_objects.append(obj)
    print('IMPORTED_WEB_OBJECTS=' + str(len(imported_objects)), flush=True)

    # Four native video textures. Keep their byte-identical MP4s in a relative
    # folder because Blender cannot pack movie sources into .blend files.
    movies = []
    for screen in capture.get('screens', []):
        name = screen.get('objectName') or screen.get('name')
        obj = next((obj for obj in imported_objects if obj.name == name), None)
        if obj is None:
            raise RuntimeError('Captured screen not found: ' + str(name))
        screen_id = screen.get('id') or name.replace('Screen_', '').lower()
        movie_source = ROOT / ('source/public/assets/action/videos/' + screen_id + '.mp4')
        movie_target = output.parent / 'assets' / 'videos' / movie_source.name
        movie_target.parent.mkdir(parents=True, exist_ok=True)
        if movie_target.exists() and sha(movie_target) != sha(movie_source):
            raise FileExistsError('Refusing to overwrite different movie: ' + str(movie_target))
        if not movie_target.exists():
            shutil.copy2(movie_source, movie_target)
        material = bpy.data.materials.new(name + '_Movie_Emission')
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        nodes.clear()
        out = nodes.new('ShaderNodeOutputMaterial')
        emission = nodes.new('ShaderNodeEmission')
        emission.inputs['Strength'].default_value = screen.get('brightness', 1 if screen_id == 'tanqing' else .25)
        texture = nodes.new('ShaderNodeTexImage')
        texture.name = 'Video_Playback'
        texture.image = bpy.data.images.load(str(movie_target), check_existing=False)
        texture.image.source = 'MOVIE'
        # Resolve metadata while the image still has its valid absolute path.
        # The relative path belongs to the new output, not the open source .blend.
        movie_frames = int(texture.image.frame_duration)
        if movie_frames <= 1:
            raise RuntimeError('Movie metadata is not loaded: ' + str(movie_target))
        texture.image.filepath = '//assets/videos/' + movie_target.name
        texture.image_user.use_auto_refresh = True
        texture.image_user.use_cyclic = True
        texture.image_user.frame_start = 1
        texture.image_user.frame_duration = movie_frames
        texture.extension = 'CLIP'
        uv = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeMapping')
        contain = screen.get('contain', [1, 1])
        mapping.inputs['Scale'].default_value = (1 / contain[0], -1 / contain[1], 1)
        mapping.inputs['Location'].default_value = (.5 - .5 / contain[0], .5 + .5 / contain[1], 0)
        links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], texture.inputs['Vector'])
        links.new(texture.outputs['Color'], emission.inputs['Color'])
        links.new(emission.outputs[0], out.inputs['Surface'])
        obj.data.materials.clear()
        obj.data.materials.append(material)
        obj['video_source'] = '//assets/videos/' + movie_target.name
        obj['content_title'] = screen.get('title', screen_id)
        movies.append({'screen': name, 'path': 'assets/videos/' + movie_target.name, 'sha256': sha(movie_target)})

    for record in capture.get('lights', []):
        kind = record['type']
        if kind == 'HemisphereLight':
            obj = empty('Web_Hemisphere_Ambient_Metadata', owners['lights'])
            obj['intensity'] = record['intensity']
            obj['implementation'] = 'Ambient environment supplied by the packed forest HDRI'
            continue
        light = bpy.data.lights.new(record.get('name') or kind, 'SUN' if kind == 'DirectionalLight' else 'SPOT' if kind == 'SpotLight' else 'POINT')
        light.color = record['color'][:3]
        # Keep directional strength; approximate the browser's punctual-light
        # intensity as total power. Different falloff/BRDFs remain documented.
        light.energy = record['intensity'] if light.type == 'SUN' else record['intensity'] * 4 * math.pi
        if light.type == 'SUN':
            light.angle = math.radians(2)
        if light.type == 'SPOT':
            light.spot_size = 2 * record.get('angle', math.pi / 3)
            light.spot_blend = record.get('penumbra', .7)
            light.shadow_soft_size = .15
        obj = bpy.data.objects.new(light.name, light)
        owners['lights'].objects.link(obj)
        obj.matrix_world = CI @ matrix(record['matrixWorld'])
        if record.get('target'):
            look_at(obj, CI @ Vector(record['target']))
        obj['web_intensity'] = record['intensity']
        obj['web_type'] = kind
        for field in ('decay', 'distance', 'penumbra', 'angle'):
            if record.get(field) is not None:
                obj['web_' + field] = record[field]

    world = bpy.data.worlds.new('Packed_Forest_HDRI')
    world.use_nodes = True
    scene.world = world
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    environment = nodes.new('ShaderNodeTexEnvironment')
    environment.image = bpy.data.images.load(str(ROOT / 'source/public/assets/environments/forest.exr'), check_existing=False)
    environment.image.pack()
    background = nodes.new('ShaderNodeBackground')
    background.inputs['Strength'].default_value = 1
    links.new(environment.outputs['Color'], background.inputs['Color'])
    dark = nodes.new('ShaderNodeBackground')
    dark.inputs['Color'].default_value = (.00243, .00182, .00152, 1)
    ray = nodes.new('ShaderNodeLightPath')
    mix = nodes.new('ShaderNodeMixShader')
    links.new(ray.outputs['Is Camera Ray'], mix.inputs[0])
    links.new(background.outputs[0], mix.inputs[1])
    links.new(dark.outputs[0], mix.inputs[2])
    out = nodes.new('ShaderNodeOutputWorld')
    links.new(mix.outputs[0], out.inputs['Surface'])

    viewport = capture.get('viewport', {'width': 1920, 'height': 1080})
    width, height = viewport['width'], viewport['height']
    projection = matrix(capture['camera']['projectionMatrix'])
    data = bpy.data.cameras.new('Action_Web_Projection')
    camera = bpy.data.objects.new('Camera_Action_Page', data)
    owners['cameras'].objects.link(camera)
    camera.matrix_world = CI @ matrix(capture['camera']['matrixWorld'])
    data.sensor_fit = 'VERTICAL'
    data.sensor_height = 36
    data.lens = .5 * data.sensor_height * projection[1][1]
    data.shift_x = .5 * projection[0][2] * width / height
    data.shift_y = .5 * projection[1][2]
    data.clip_start = capture['camera'].get('near', .05)
    data.clip_end = capture['camera'].get('far', 100)
    scene.camera = camera
    for name, position, target, lens in [
        ('Camera_Overview', (7.6, -7.6, 8.8), (0, 0, 2.5), 15),
        ('Camera_Interior_Wide', (6.8, -7, 4.1), (0, 1.8, 3.8), 20),
    ]:
        data = bpy.data.cameras.new(name)
        obj = bpy.data.objects.new(name, data)
        owners['cameras'].objects.link(obj)
        obj.location = position
        data.lens = lens
        data.clip_end = 150
        look_at(obj, target)
    for anchor in capture.get('anchors', []):
        obj = empty(anchor['name'], owners['anchors'])
        obj.matrix_world = CI @ matrix(anchor['matrixWorld'])
        obj.empty_display_size = .15

    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 64
    scene.eevee.use_raytracing = True
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.resolution_percentage = 100
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 864
    scene.frame_set(1)
    scene.render.use_simplify = False
    scene.render.use_sequencer = False
    scene.render.use_compositing = False
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    bpy.context.view_layer.update()
    calculated = camera.calc_matrix_camera(bpy.context.evaluated_depsgraph_get(), x=width, y=height)
    projection_error = max(abs(calculated[r][c] - projection[r][c]) for r in range(4) for c in range(4))
    if projection_error > 2e-5:
        raise RuntimeError('Blender camera projection differs from the captured page: ' + str(projection_error))
    # File opens immediately in the real camera, with materials, lights and
    # environment enabled when the user selects rendered viewport mode.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                space = area.spaces.active
                space.clip_end = 150
                space.region_3d.view_perspective = 'CAMERA'
                space.shading.type = 'MATERIAL'
                space.shading.use_scene_world = True
                space.shading.use_scene_lights = True
    text = bpy.data.texts.new('README_动作页完整场景')
    text.write('动作页完整三维场景 · Blender 5.0\n\n'
               '保留原醒狮53网格、3曲线对象、30粒子毛发系统，合计33组完整毛发。\n'
               '红金建筑与鼓来自当前网页真实几何，实例转换为可编辑的链接对象。\n'
               'Camera_Action_Page还原1920×1080页面镜头，另附室内广角与全景镜头。\n'
               '时间轴24fps，醒狮36秒自转；四面视频屏幕按原8秒时长循环。\n'
               '图像/HDRI已内嵌；请保留同目录assets/videos中的四个原视频。\n'
               '地面使用原生EEVEE光线追踪反射；网页专用GLSL不直接存入Blender。\n'
               '材质与光照在EEVEE中原生求值，与网页截图不会逐像素相同。\n'
               '网页导航、说明文字和播放控件属于二维React界面，不是三维物体。\n')
    scene['export_origin'] = 'Current React action page runtime scene'
    scene['source_revision'] = capture.get('revision', '')
    scene['runtime_mesh_objects'] = len(imported_objects)
    scene['architecture_components'] = json.dumps(capture.get('architecture', {}), ensure_ascii=False)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True, relative_remap=False)
    report = {
        'blender_version': bpy.app.version_string, 'output': str(output),
        'output_bytes': output.stat().st_size, 'source_sha256': SOURCE_SHA,
        'source_sha256_after': sha(SOURCE), 'snapshot_sha256': sha(snapshot_path),
        'native_lion_counts': counts, 'particle_hair_systems': particle_count,
        'native_lion_materials': sorted(source_materials),
        'runtime_mesh_objects': len(imported_objects), 'unique_runtime_meshes': len(meshes),
        'native_hair_statistics': capture['lion']['statistics'],
        'movies': movies, 'projection_max_error': projection_error,
        'collections': {key: len(owner.objects) for key, owner in owners.items()},
        'limits': ['Three.js custom GLSL becomes native EEVEE shading/reflections.',
                   '2D React controls are not scene geometry.',
                   'Movies stay in the accompanying relative assets/videos folder.'],
    }
    if report['source_sha256_after'] != SOURCE_SHA:
        raise RuntimeError('Native source file unexpectedly changed')
    report_path = output.with_suffix('.export.json')
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('ACTION_BLEND_EXPORT=' + json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
