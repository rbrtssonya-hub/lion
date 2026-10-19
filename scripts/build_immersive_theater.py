"""Author the independent SouthWindLion cinema blockout with Blender 5.

Run from the repository root with Blender's bundled Python::
    F:/Blender/blender.exe --background --factory-startup --python scripts/build_immersive_theater.py

The source lion and every existing media file are read only.  The destination is
refused unless --overwrite is explicitly supplied.  --render-only reopens the
saved deliverable and renders its real cameras without resaving it.
"""
import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'source/models/immersive-theater/SouthWindLion_Immersive_Theater_Blockout.blend'
REPORT = ROOT / 'source/references/2026-10-19-immersive-theater.json'
REVIEWS = ROOT / 'source/reviews/immersive-theater/2026-10-19'
SOURCE = ROOT / 'model/醒狮_保留UV_三角转四边_优化.blend'
WEB_LOD = ROOT / 'source/public/assets/models/lion-structure-optimized.glb'
WEB_OUTPUT = OUTPUT.with_name('SouthWindLion_Immersive_Theater.glb')
SOURCE_EXPECTED_SHA256 = '2230dbce24b0d9bead0b6781410cfbb9acf6d249c99113210f21ba0b16991bd2'
COLLECTIONS = [
    '00_Environment', '01_Stage', '02_Lion', '03_Screens',
    '04_Screen_Frames', '05_Lighting', '06_Cameras',
    '07_Interaction_Anchors', '08_Proxies',
]
SCREENS = [
    ('Tanqing', '探青采青', 'TANQING / CAIQING', (0, 9.55, 5.3), (1, 0, 0), (0, -1, 0), 1.0),
    ('Doumao', '抖毛', 'DOUMAO', (9.55, 0, 5.3), (0, -1, 0), (-1, 0, 0), .25),
    ('Tuqiu', '狮子吐球', 'SHIZI TUQIU', (0, -9.55, 5.3), (-1, 0, 0), (0, 1, 0), .25),
    ('Meihuazhuang', '踩梅花桩', 'MEIHUAZHUANG', (-9.55, 0, 5.3), (0, 1, 0), (1, 0, 0), .25),
]
PREVIEW_CAMERAS = {
    'Front': 'Camera_Main', 'Left': 'Camera_Left', 'Right': 'Camera_Right',
    'Back': 'Camera_Back', 'Overview': 'Camera_Overview',
}


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path):
    return path.resolve().relative_to(ROOT).as_posix()


def move_to(obj, collection):
    for original in list(obj.users_collection):
        original.objects.unlink(obj)
    bpy.data.collections[collection].objects.link(obj)
    return obj


def prop(obj, **values):
    for key, value in values.items():
        obj[key] = value if value is not None else ''


def empty(name, collection, location=(0, 0, 0), display='PLAIN_AXES'):
    obj = bpy.data.objects.new(name, None)
    bpy.data.collections[collection].objects.link(obj)
    obj.location = location
    obj.empty_display_type = display
    obj.empty_display_size = .25
    return obj


def principled(name, color, roughness=.5, metallic=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return material


def emission(name, color, strength=1):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    out = nodes.new('ShaderNodeOutputMaterial')
    emit = nodes.new('ShaderNodeEmission')
    emit.name = 'Video_Emission'
    emit.inputs['Color'].default_value = (*color, 1)
    value = nodes.new('ShaderNodeValue')
    value.name = 'Screen_Brightness'
    value.label = 'PRIMARY 1.00 / SECONDARY 0.25 — web-controlled'
    value.outputs[0].default_value = strength
    material.node_tree.links.new(value.outputs[0], emit.inputs['Strength'])
    material.node_tree.links.new(emit.outputs[0], out.inputs['Surface'])
    return material


def box(name, location, scale, material, collection, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = move_to(bpy.context.object, collection)
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft stone / joinery edge', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    obj.data.materials.append(material)
    return obj


def cylinder(name, radius, depth, z, material, collection, vertices=128):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    obj = move_to(bpy.context.object, collection)
    obj.name = name
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    bevel = obj.modifiers.new('Restrained stone edge', 'BEVEL')
    bevel.width = .015
    bevel.segments = 2
    return obj


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def area(name, location, target, power, color, size, shape='DISK', size_y=None):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = color
    data.shape = shape
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    obj = bpy.data.objects.new(name, data)
    bpy.data.collections['05_Lighting'].objects.link(obj)
    obj.location = location
    look_at(obj, target)
    return obj


def camera(name, location, target, lens=24, panorama=False):
    data = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, data)
    bpy.data.collections['06_Cameras'].objects.link(obj)
    obj.location = location
    look_at(obj, target)
    data.lens = lens
    data.clip_start = .1
    data.clip_end = 65
    if panorama:
        data.type = 'PANO'
        data.panorama_type = 'EQUIRECTANGULAR'
        data.longitude_min = -math.pi
        data.longitude_max = math.pi
        prop(obj, purpose='360-degree relation overview: all four screens from inside the room; not the initial web lens')
    else:
        prop(obj, purpose='Indoor orbit reference; no automatic camera animation')
    return obj


def screen_matrix(center, right, normal):
    up = Vector((0, 0, 1))
    r, n, c = Vector(right), Vector(normal), Vector(center)
    return Matrix(((r.x, up.x, n.x, c.x), (r.y, up.y, n.y, c.y), (r.z, up.z, n.z, c.z), (0, 0, 0, 1)))


def text_on_screen(name, text, xy, size, matrix, material, font, align='LEFT'):
    curve = bpy.data.curves.new(name, type='FONT')
    curve.body = text
    curve.font = font
    curve.size = size
    curve.align_x = align
    curve.resolution_u = 3
    curve.space_character = 1.1
    obj = bpy.data.objects.new(name, curve)
    bpy.data.collections['08_Proxies'].objects.link(obj)
    obj.matrix_world = matrix @ Matrix.Translation((xy[0], xy[1], .018))
    obj.data.materials.append(material)
    prop(obj, is_placeholder=True, purpose='Explicit missing-video label; replace with real video texture, not an action reconstruction')
    return obj


def create_screen(index, spec, font, frame_material):
    key, title, romanized, center, right, normal, brightness = spec
    matrix = screen_matrix(center, right, normal)
    material = emission(f'Video_{key}_Replaceable', (.23, .145, .085), brightness)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    tex = nodes.new('ShaderNodeTexCoord')
    gradient = nodes.new('ShaderNodeTexGradient')
    gradient.gradient_type = 'SPHERICAL'
    mapping = nodes.new('ShaderNodeVectorMath')
    mapping.operation = 'SUBTRACT'
    mapping.inputs[1].default_value = (.5, .5, 0)
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.name = 'PROXY_No_Real_Action_Video'
    ramp.color_ramp.elements[0].position = 0
    ramp.color_ramp.elements[0].color = (.035, .023, .017, 1)
    ramp.color_ramp.elements[1].position = .7
    ramp.color_ramp.elements[1].color = (.20, .115, .065, 1)
    links.new(tex.outputs['UV'], mapping.inputs[0])
    links.new(mapping.outputs[0], gradient.inputs[0])
    links.new(gradient.outputs[0], ramp.inputs[0])
    links.new(ramp.outputs['Color'], nodes.get('Video_Emission').inputs['Color'])
    mesh = bpy.data.meshes.new(f'Screen_{key}_16x9_Surface')
    mesh.from_pydata([(-8, -4.5, 0), (8, -4.5, 0), (8, 4.5, 0), (-8, 4.5, 0)], [], [(0, 1, 2, 3)])
    mesh.uv_layers.new(name='VideoUV_16_9')
    for loop, uv in zip(mesh.uv_layers.active.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = uv
    obj = bpy.data.objects.new(f'Screen_{key}', mesh)
    bpy.data.collections['03_Screens'].objects.link(obj)
    obj.matrix_world = matrix
    obj.data.materials.append(material)
    prop(obj, action_title=title, video_resource_key=f'video_{key.lower()}', video_path='',
         primary_state='PRIMARY' if brightness == 1 else 'SECONDARY', display_brightness=brightness,
         primary_brightness=1.0, secondary_brightness=.25, is_placeholder=True,
         screen_width_m=16.0, screen_height_m=9.0, screen_front_normal=json.dumps(normal),
         resource_status='MISSING_VERIFIED_ACTION_VIDEO', video_uv_policy='16:9 full frame; never stretch/crop unverified footage')
    frame = box(f'Screen_{key}_Frame', (0, 0, 0), (16.12, 9.12, .10), frame_material, '04_Screen_Frames', .012)
    frame.matrix_world = matrix @ Matrix.Translation((0, 0, -.075))
    for suffix, position in [('Anchor', (-5.8, -4.15, .3)), ('Direction', (0, 0, .4))]:
        anchor_name = f'UI_Anchor_{key}' if suffix == 'Anchor' else f'Screen_{key}_Direction'
        anchor = empty(anchor_name, '07_Interaction_Anchors')
        anchor.matrix_world = matrix @ Matrix.Translation(position)
        prop(anchor, screen_object=obj.name, purpose='DOM action explanation reference' if suffix == 'Anchor' else 'Screen inward-facing direction reference')
    label_mat = emission(f'PROXY_{key}_Typography', (.65, .47, .29), brightness)
    small_mat = emission(f'PROXY_{key}_Secondary_Type', (.33, .29, .25), brightness)
    text_on_screen(f'PROXY_{key}_Index', f'{index:02d} / 04', (-6.75, 3.55), .19, matrix, small_mat, font)
    text_on_screen(f'PROXY_{key}_Title', title, (0, .8), .92, matrix, label_mat, font, 'CENTER')
    text_on_screen(f'PROXY_{key}_Romanized', romanized, (0, .25), .24, matrix, small_mat, font, 'CENTER')
    text_on_screen(f'PROXY_{key}_MissingVideo', '真实动作视频待替换  /  BLOCKOUT PLACEHOLDER', (0, -.6), .24, matrix, label_mat, font, 'CENTER')
    text_on_screen(f'PROXY_{key}_Aspect', '16 : 9    /    16.0 x 9.0 m', (6.75, -3.9), .18, matrix, small_mat, font, 'RIGHT')
    return obj


def action_curves(action):
    if hasattr(action, 'fcurves'):
        return list(action.fcurves)
    return [curve for layer in action.layers for strip in layer.strips for bag in strip.channelbags for curve in bag.fcurves]


def create_lion():
    if sha(SOURCE) != SOURCE_EXPECTED_SHA256:
        raise RuntimeError('Native source changed: repeat the duplicate/fidelity audit before importing')
    with bpy.data.libraries.load(str(SOURCE), link=False) as (available, loaded):
        loaded.objects = list(available.objects)
    imported = [obj for obj in loaded.objects if obj is not None]
    for obj in imported:
        move_to(obj, '02_Lion')
    bpy.context.view_layer.update()
    duplicate_report = json.loads((ROOT / 'source/references/lion-structure-model.json').read_text(encoding='utf-8'))
    if duplicate_report['source_sha256'] != SOURCE_EXPECTED_SHA256:
        raise RuntimeError('Duplicate audit does not match the protected source')
    duplicate_pairs = duplicate_report['duplicate_verification']['duplicates']
    duplicate_names = {pair['excluded'] for pair in duplicate_pairs}
    # Native curves were attached to duplicate surface objects. Keep their world
    # transform while reattaching to the rigorously verified identical surface.
    for pair in duplicate_pairs:
        duplicate, original = bpy.data.objects[pair['excluded']], bpy.data.objects[pair['identical_to']]
        for child in list(duplicate.children):
            world = child.matrix_world.copy()
            child.parent = original
            child.matrix_world = world
    excluded = [obj for obj in imported if obj.type == 'LIGHT' or obj.name in duplicate_names]
    imported = [obj for obj in imported if obj not in excluded]
    for obj in excluded:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    meshes = [obj for obj in imported if obj.type == 'MESH']
    points = [obj.matrix_world @ Vector(point) for obj in meshes for point in obj.bound_box]
    mins = [min(point[k] for point in points) for k in range(3)]
    maxs = [max(point[k] for point in points) for k in range(3)]
    center = [(mins[k] + maxs[k]) / 2 for k in range(3)]
    scale = 2.05
    root = empty('Lion_RotationRoot', '02_Lion', (0, 0, .22), 'CIRCLE')
    prop(root, rotation_axis='Z', rotation_period_seconds=36.0, rotation_enabled=True,
         web_rotation_speed_rad_s=2 * math.pi / 36, purpose='Only animated object: full lion rigid uniform vertical rotation')
    model = empty('Lion_Model', '02_Lion')
    model.parent = root
    model.location = (-center[0] * scale, -center[1] * scale, -mins[2] * scale)
    model.scale = (scale,) * 3
    prop(model, source_path=bpy.path.relpath(str(SOURCE), start=str(OUTPUT.parent)), source_sha256=sha(SOURCE),
         source_representation='Native user Blender source: 23 unique meshes, 18 full hair CURVES, 41 source empties; 15 exact coincident mesh duplicates excluded',
         original_source='model/醒狮_保留UV_三角转四边_优化.blend', original_untouched=True,
         source_native_imported=True, mesh_count=len(meshes), native_hair_curve_count=18, uniform_display_scale=scale)
    radius_corrections = []
    for obj in imported:
        original_world = obj.matrix_world.copy()
        original_parent = obj.parent
        obj.animation_data_clear()
        if original_parent not in imported:
            obj.parent = model
            obj.matrix_parent_inverse = Matrix.Identity(4)
            obj.matrix_basis = original_world
        prop(obj, theater_role='existing_lion_part', source_object_name=obj.name)
        if obj.type == 'CURVES' and 'fiber_world_radius_max' in obj:
            raw_max = max(item.value for item in obj.data.attributes['radius'].data)
            authored_world_max = float(obj['fiber_world_radius_max'])
            if raw_max > authored_world_max * 100:
                factor = authored_world_max / raw_max
                group = bpy.data.node_groups.new(f'NativeRadiusRecovery_{obj.name}', 'GeometryNodeTree')
                group.interface.new_socket(name='Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
                group.interface.new_socket(name='Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
                incoming = group.nodes.new('NodeGroupInput')
                outgoing = group.nodes.new('NodeGroupOutput')
                radius = group.nodes.new('GeometryNodeInputRadius')
                multiply = group.nodes.new('ShaderNodeMath')
                multiply.operation = 'MULTIPLY'
                multiply.inputs[1].default_value = factor
                set_radius = group.nodes.new('GeometryNodeSetCurveRadius')
                group.links.new(incoming.outputs['Geometry'], set_radius.inputs['Curve'])
                group.links.new(radius.outputs['Radius'], multiply.inputs[0])
                group.links.new(multiply.outputs[0], set_radius.inputs['Radius'])
                group.links.new(set_radius.outputs['Curve'], outgoing.inputs['Geometry'])
                modifier = obj.modifiers.new('Native_Fiber_Radius_Unit_Recovery', 'NODES')
                modifier.node_group = group
                prop(obj, theater_native_radius_recovery_factor=factor,
                     theater_radius_note='Source radius data unmodified; evaluate normalized field in meters using source fiber_world_radius_max')
                radius_corrections.append({'object': obj.name, 'source_radius_max': raw_max,
                                           'authored_world_radius_max_m': authored_world_max, 'factor': factor})
    bpy.context.scene.frame_set(1)
    root.rotation_euler = (0, 0, 0)
    root.keyframe_insert(data_path='rotation_euler', index=2, frame=1)
    root.rotation_euler.z = math.tau
    root.keyframe_insert(data_path='rotation_euler', index=2, frame=865)
    root.animation_data.action.name = 'Lion_Uniform_Z_Rotation_36s'
    for curve in action_curves(root.animation_data.action):
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'
        curve.modifiers.new('CYCLES')
    bpy.context.scene.frame_set(1)
    return {'source_path': relative(SOURCE), 'source_sha256': sha(SOURCE), 'source_bytes': SOURCE.stat().st_size,
            'mesh_count': len(meshes), 'native_hair_curves': sum(obj.type == 'CURVES' for obj in imported),
            'source_empties': sum(obj.type == 'EMPTY' for obj in imported),
            'source_bounds_blender': {'min': mins, 'max': maxs},
            'uniform_scale': scale, 'display_dimensions_m': [(maxs[k] - mins[k]) * scale for k in range(3)],
            'stage_contact_z_m': .22, 'rotation_seconds': 36, 'frames': [1, 865], 'fps': 24,
            'excluded_source_objects': {'exact_duplicate_meshes': duplicate_pairs, 'lights': 3},
            'native_curve_radius_recoveries': radius_corrections,
            'fidelity_boundary': 'Full native mesh/UV/material and curve-point/radius data appended. Fifteen verified exact coincident mesh duplicates and three source lights excluded. Curve geometry is not sampled or replaced; 17 normalized radius fields evaluate in physical source units through explicit non-destructive modifiers.'}


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = 'SouthWindLion_Immersive_Theater_Blockout'
    for name in COLLECTIONS:
        scene.collection.children.link(bpy.data.collections.new(name))
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.film_transparent = False
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 864
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = .35
    world = bpy.data.worlds.new('Theater_Warm_Low_Ambient')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (.11, .075, .05, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .06
    scene.world = world
    prop(scene, coordinate_system='BLENDER_METERS_Z_UP_FRONT_PLUS_Y', room_width_m=20.0, room_depth_m=20.0,
         room_clear_height_m=10.4, screen_dimensions_m='16 x 9', screen_bottom_m=.8,
         design_note='16 x 6.5 is not 16:9. The strict 16:9 requirement takes priority: 16 x 9 m screens, room height 10.4 m.',
         stage_reference_status='Existing project design/action hero+detail references visually checked: stone floor, dark-red columns and a single drum/stand. No dedicated reference attachment found in current request.',
         delivery_phase='BLENDER_BLOCKOUT_AND_WEB_HANDOFF_ONLY', main_screen='Screen_Tanqing',
         screen_state_transition_s=.45, primary_brightness=1.0, secondary_brightness=.25,
         web_orbit_limits=json.dumps({'target': [0, 0, 2.8], 'radius_min': 5.3, 'radius_max': 7.2,
             'camera_height_min': 2.6, 'camera_height_max': 4.6, 'polar_angle_degrees': [72, 92],
             'auto_orbit': False, 'screen_switch_hysteresis_degrees': 12, 'switch_dwell_ms': 180,
             'brightness_transition_ms': 450, 'keep_video_time_on_switch': True, 'audio_single_primary_only': True}),
         web_interactions_implemented=False)
    wall = principled('Environment_BlackRed_Plaster', (.012, .0045, .004), .84)
    ceiling = principled('Environment_Dark_Quiet_Ceiling', (.008, .006, .005), .93)
    floor = principled('Floor_Polished_BrownBlack_Stone', (.034, .019, .014), .42, .09)
    # Fine stone mottling stays below the video/lion hierarchy; no emissive floor.
    nodes, links = floor.node_tree.nodes, floor.node_tree.links
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.8
    noise.inputs['Detail'].default_value = 2.4
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.012, .007, .005, 1)
    ramp.color_ramp.elements[1].color = (.046, .028, .02, 1)
    links.new(noise.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
    stage = principled('Stage_DeepWarm_Stone', (.043, .023, .018), .46, .08)
    gold = principled('Trim_Restrained_AntiqueGold', (.18, .095, .035), .48, .55)
    red = principled('Pillar_DeepOxideRed', (.075, .009, .006), .48, .1)
    seam = principled('Stone_Quiet_Joint', (.008, .005, .004), .84)
    box('Lion_Stage_Floor', (0, 0, -.15), (20, 20, .3), floor, '00_Environment')
    box('Room_Wall_Front', (0, 10.1, 5.2), (20.4, .2, 10.4), wall, '00_Environment')
    box('Room_Wall_Back', (0, -10.1, 5.2), (20.4, .2, 10.4), wall, '00_Environment')
    box('Room_Wall_Left', (-10.1, 0, 5.2), (.2, 20, 10.4), wall, '00_Environment')
    box('Room_Wall_Right', (10.1, 0, 5.2), (.2, 20, 10.4), wall, '00_Environment')
    box('Room_Ceiling', (0, 0, 10.5), (20.4, 20.4, .2), ceiling, '00_Environment')
    for index in range(-4, 5):
        for axis in ['X', 'Y']:
            loc = (index * 2, 0, .001) if axis == 'X' else (0, index * 2, .001)
            dim = (.009, 20, .002) if axis == 'X' else (20, .009, .002)
            box(f'Floor_Joint_{axis}_{index:+d}', loc, dim, seam, '00_Environment')
    cylinder('Lion_Stage_Base', 2.5, .22, .11, stage, '01_Stage')
    # A single 13 mm antique-gold lip, never a light source.
    cylinder('Lion_Stage_AntiqueGold_Lip', 2.507, .013, .19, gold, '01_Stage')
    cylinder('Lion_Stage_Stone_Top', 2.49, .022, .209, stage, '01_Stage')
    for x in [-9.1, 9.1]:
        for y in [-9.1, 9.1]:
            pillar = cylinder(f'Pillar_DarkRed_{x:+.1f}_{y:+.1f}', .23, 10.25, 5.125, red, '00_Environment', 24)
            pillar.location.x, pillar.location.y = x, y
            collar = cylinder(f'Pillar_Base_Trim_{x:+.1f}_{y:+.1f}', .26, .055, .18, gold, '00_Environment', 24)
            collar.location.x, collar.location.y = x, y
    # One quiet traditional drum and timber stand, derived from the existing
    # action design references. It is background context, never a fifth screen.
    timber = principled('Drum_Stand_DarkTimber', (.036, .012, .007), .7)
    hide = principled('Drum_Hide_MutedWarm', (.21, .15, .09), .68)
    drum = cylinder('Traditional_Drum_Body', .54, .58, 1.0, red, '00_Environment', 64)
    drum.location.x, drum.location.y = -7.9, 7.65
    drum.rotation_euler.x = math.pi / 2
    for side in [-1, 1]:
        head = cylinder(f'Traditional_Drum_Hide_{side:+d}', .535, .025, 0, hide, '00_Environment', 64)
        head.rotation_euler.x = math.pi / 2
        head.location = (-7.9, 7.65 + side * .3, 1.0)
    for x in [-8.3, -7.5]:
        stand = box(f'Traditional_Drum_Stand_{x}', (x, 7.65, .38), (.1, .66, .76), timber, '00_Environment', .015)
    box('Traditional_Drum_Stand_Crossbar', (-7.9, 7.65, .5), (.98, .12, .12), timber, '00_Environment', .01)
    font = bpy.data.fonts.load(str(ROOT / 'source/fonts/immersive-theater/nanfeng-theater-labels.ttf'))
    font.pack()
    for index, spec in enumerate(SCREENS, 1):
        create_screen(index, spec, font, gold)
    # Screen-shaped area proxies carry their own role; no lamp geometry is visible.
    for key, _, _, center, _, normal, brightness in SCREENS:
        position = Vector(center) + Vector(normal) * .1
        light = area(f'Light_ScreenBounce_{key}', position, (0, 0, 1.3), 900 * brightness,
                     (1, .73, .5), 12, 'RECTANGLE', 6.75)
        prop(light, screen_object=f'Screen_{key}', role='Preview screen diffuse-light proxy; web lighting requires its own implementation')
    area('Light_Lion_SoftWarm_Key', (-3, -4, 5.8), (0, 0, 1.4), 520, (1, .81, .66), 4)
    area('Light_Lion_Quiet_Fill', (3.8, 1.5, 5), (0, 0, 1.6), 350, (.76, .82, 1), 3.5)
    area('Light_Stage_Rim_Warm', (1, 4, 4.8), (0, 0, 1.6), 250, (1, .64, .33), 3)
    lion_report = create_lion()
    target = empty('Camera_Target', '06_Cameras', (0, 0, 2.8))
    center = empty('Camera_OrbitCenter', '06_Cameras', (0, 0, 2.8), 'CIRCLE')
    prop(center, independent_of_lion_rotation=True, web_auto_orbit=False, radius_min_m=5.3, radius_max_m=7.2)
    prop(target, purpose='Independent orbit look target; live camera pitch/clamps require web implementation')
    for name, loc, aim in [
        ('Camera_Main', (0, -7, 2.8), (0, 1.0, 2.7)),
        ('Camera_Right', (-7, 0, 2.8), (1.0, 0, 2.7)),
        ('Camera_Back', (0, 7, 2.8), (0, -1.0, 2.7)),
        ('Camera_Left', (7, 0, 2.8), (-1.0, 0, 2.7)),
    ]:
        camera(name, loc, aim, 22.5)
    camera('Camera_Overview', (0, -5.8, 4), (0, 1, 3.6), panorama=True)
    scene.camera = bpy.data.objects['Camera_Main']
    # Open the file in its useful initial camera composition.
    for area_ui in bpy.context.screen.areas if bpy.context.screen else []:
        if area_ui.type == 'VIEW_3D':
            area_ui.spaces.active.region_3d.view_perspective = 'CAMERA'
    for image in bpy.data.images:
        if image.source != 'MOVIE' and not image.packed_file:
            image.pack()
    bpy.ops.file.pack_all()
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=False, do_recursive=True)
    # The native file stores several byte-identical packed image copies. Reuse
    # identical bytes/colorspaces without changing pixels or material nodes.
    seen_images, image_deduplication = {}, []
    for image in sorted(list(bpy.data.images), key=lambda item: item.name):
        if not image.packed_file:
            continue
        key = (hashlib.sha256(image.packed_file.data).hexdigest(), image.colorspace_settings.name, image.alpha_mode)
        if key in seen_images:
            canonical = seen_images[key]
            image_deduplication.append({'removed_datablock': image.name, 'identical_to': canonical.name, 'sha256': key[0]})
            image.user_remap(canonical)
            bpy.data.images.remove(image)
        else:
            seen_images[key] = image
    lion_report['packed_image_deduplication'] = image_deduplication
    bpy.context.view_layer.objects.active = bpy.data.objects['Lion_RotationRoot']
    bpy.ops.object.select_all(action='DESELECT')
    bpy.data.objects['Lion_RotationRoot'].select_set(True)
    scene.frame_set(1)
    return lion_report


def choose_cycles_device():
    try:
        preferences = bpy.context.preferences.addons['cycles'].preferences
        for backend in ['OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL']:
            try:
                preferences.compute_device_type = backend
                preferences.get_devices()
                devices = [device for device in preferences.devices if device.type != 'CPU']
                if devices:
                    for device in preferences.devices:
                        device.use = device.type != 'CPU'
                    bpy.context.scene.cycles.device = 'GPU'
                    return {'backend': backend, 'devices': [device.name for device in devices]}
            except (TypeError, RuntimeError):
                pass
    except Exception as error:
        print('CYCLES_GPU_FALLBACK', str(error))
    bpy.context.scene.cycles.device = 'CPU'
    return {'backend': 'CPU'}


def register_render_evidence(record_path):
    """Index only actual renders proven to come from the current saved file."""
    evidence = json.loads(record_path.read_text(encoding='utf-8'))
    current_hash = sha(OUTPUT)
    report = json.loads(REPORT.read_text(encoding='utf-8'))
    if evidence['source_blend_sha256'] != current_hash or report['blend']['sha256'] != current_hash:
        raise RuntimeError('Render evidence must bind the current saved deliverable and report')
    screenshots = {item['path']: item for item in report.get('screenshots', [])
                   if item.get('source_blend_sha256') == current_hash}
    for item in evidence['renders']:
        target = ROOT / item['path']
        if not target.is_file() or target.stat().st_size != item['bytes'] or sha(target) != item['sha256']:
            raise RuntimeError(f'Render evidence does not match its actual screenshot: {target}')
        screenshots[item['path']] = {**item, 'source_blend_sha256': current_hash,
                                      'render_evidence': relative(record_path)}
    report['screenshots'] = list(screenshots.values())
    indexed = {item['path']: item for item in report.get('render_evidence', [])
               if item.get('source_blend_sha256') == current_hash}
    indexed[relative(record_path)] = {'path': relative(record_path), 'sha256': sha(record_path),
                                    'source_blend_sha256': current_hash,
                                    'reopened_from_disk': evidence['reopened_from_disk']}
    report['render_evidence'] = list(indexed.values())
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def render_saved(options):
    bpy.ops.wm.open_mainfile(filepath=str(OUTPUT))
    scene = bpy.context.scene
    scene.frame_set(1)
    device = choose_cycles_device()
    print('RENDER_DEVICE', json.dumps(device), flush=True)
    REVIEWS.mkdir(parents=True, exist_ok=True)
    completed = []
    for preview in options.render.split(','):
        if preview not in PREVIEW_CAMERAS:
            raise ValueError(f'Unknown preview {preview}')
        scene.camera = bpy.data.objects[PREVIEW_CAMERAS[preview]]
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = options.samples
        scene.render.resolution_x = options.resolution
        scene.render.resolution_y = options.resolution // 2 if preview == 'Overview' else round(options.resolution * 9 / 16)
        target = REVIEWS / f'Preview_{preview}.png'
        scene.render.filepath = str(target)
        print('RENDER_START', preview, flush=True)
        bpy.ops.render.render(write_still=True)
        completed.append({'path': relative(target), 'bytes': target.stat().st_size, 'sha256': sha(target),
                          'camera': scene.camera.name, 'engine': scene.render.engine, 'samples': options.samples,
                          'resolution': [scene.render.resolution_x, scene.render.resolution_y], 'frame': 1,
                          'screen_state': 'Saved default: Tanqing PRIMARY, three SECONDARY; no view-direction web logic runs in Blender'})
        print('RENDER_DONE', preview, flush=True)
    record_path = REVIEWS / ('render-evidence-' + options.render.replace(',', '-').lower() + '.json')
    record_path.write_text(json.dumps({'source_blend': relative(OUTPUT), 'source_blend_sha256': sha(OUTPUT),
                                     'reopened_from_disk': True, 'device': device, 'renders': completed}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    register_render_evidence(record_path)
    return completed


def glb_json(path):
    data = path.read_bytes()
    size = struct.unpack_from('<I', data, 12)[0]
    return data, json.loads(data[20:20 + size]), size


def export_web(options):
    """Create a static, replaceable web LOD in memory; never resave the native file."""
    if WEB_OUTPUT.exists() and not options.overwrite:
        raise FileExistsError(f'Refusing to overwrite {WEB_OUTPUT}; explicitly pass --overwrite')
    bpy.ops.wm.open_mainfile(filepath=str(OUTPUT))
    bpy.context.scene.frame_set(1)
    native_hash = sha(OUTPUT)
    # Scene extras travel with glTF too. They must describe the exported axes,
    # rather than retaining the Blender-space target under an unqualified key.
    scene = bpy.context.scene
    authoring_coordinates = str(scene['coordinate_system'])
    authoring_limits = str(scene['web_orbit_limits'])
    exported_limits = json.loads(authoring_limits)
    tx, ty, tz = exported_limits['target']
    exported_limits['target'] = [tx, tz, -ty]
    prop(scene, authoring_coordinate_system=authoring_coordinates,
         authoring_web_orbit_limits=authoring_limits,
         coordinate_system='GLTF_METERS_Y_UP_FRONT_MINUS_Z',
         web_orbit_limits=json.dumps(exported_limits))
    for obj in list(bpy.data.collections['02_Lion'].objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=False, do_recursive=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(WEB_LOD))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    points = [obj.matrix_world @ Vector(point) for obj in imported if obj.type == 'MESH' for point in obj.bound_box]
    mins = [min(point[k] for point in points) for k in range(3)]
    maxs = [max(point[k] for point in points) for k in range(3)]
    root = empty('Lion_RotationRoot', '02_Lion', (0, 0, .22), 'CIRCLE')
    prop(root, rotation_axis='Y', authoring_rotation_axis='Z', rotation_period_seconds=36.0, web_rotation_speed_rad_s=math.tau / 36,
         rotation_enabled=True, native_source_sha256=SOURCE_EXPECTED_SHA256,
         export_representation='Existing validated web LOD: source curves approximated as sampled thin ribbons')
    model = empty('Lion_Model', '02_Lion')
    model.parent = root
    model.scale = (2.05,) * 3
    model.location = (-.5 * (mins[0] + maxs[0]) * 2.05, -.5 * (mins[1] + maxs[1]) * 2.05, -mins[2] * 2.05)
    prop(model, source_path=relative(WEB_LOD), source_sha256=sha(WEB_LOD), web_lod=True, mesh_count=41)
    for obj in imported:
        world = obj.matrix_world.copy()
        original_parent = obj.parent
        move_to(obj, '02_Lion')
        if original_parent not in imported:
            obj.parent = model
            obj.matrix_parent_inverse = Matrix.Identity(4)
            obj.matrix_basis = world
    # Procedural screen gradients are Blender-only. Explicit emissive colors and
    # extras remain independently controllable until real video textures replace them.
    for key, _, _, _, _, normal, brightness in SCREENS:
        screen = bpy.data.objects[f'Screen_{key}']
        exported_normal = json.dumps([normal[0], normal[2], -normal[1]])
        prop(screen, authoring_screen_front_normal=str(screen['screen_front_normal']),
             screen_front_normal=exported_normal, front_normal_gltf=exported_normal,
             coordinate_note='screen_front_normal and front_normal_gltf use exported glTF +Y up; authoring_screen_front_normal retains Blender +Z up')
        material = bpy.data.materials[f'Video_{key}_Replaceable']
        material.node_tree.nodes.clear()
        output = material.node_tree.nodes.new('ShaderNodeOutputMaterial')
        emit = material.node_tree.nodes.new('ShaderNodeEmission')
        emit.inputs['Color'].default_value = (.23 * brightness, .145 * brightness, .085 * brightness, 1)
        emit.inputs['Strength'].default_value = 1
        material.node_tree.links.new(emit.outputs[0], output.inputs['Surface'])
        prop(material, primary_brightness=1.0, secondary_brightness=.25, source_is_placeholder=True)
    bpy.ops.object.select_all(action='DESELECT')
    export_collections = {'00_Environment', '01_Stage', '02_Lion', '03_Screens', '04_Screen_Frames', '07_Interaction_Anchors'}
    chosen = []
    for obj in bpy.data.objects:
        if any(collection.name in export_collections for collection in obj.users_collection) or obj.name in ['Camera_Target', 'Camera_OrbitCenter']:
            if obj.type in ['MESH', 'EMPTY']:
                obj.select_set(True)
                chosen.append(obj.name)
    bpy.ops.export_scene.gltf(filepath=str(WEB_OUTPUT), export_format='GLB', use_selection=True,
                              export_animations=False, export_cameras=False, export_lights=False,
                              export_extras=True, export_yup=True, export_image_format='AUTO',
                              export_apply=True, export_materials='EXPORT')
    source_data, source_gltf, _ = glb_json(WEB_LOD)
    raw, gltf, json_length = glb_json(WEB_OUTPUT)
    source_materials = {material['name']: material for material in source_gltf.get('materials', [])}
    sheen_restored = []
    for material in gltf.get('materials', []):
        reference = source_materials.get(material.get('name'))
        sheen = reference.get('extensions', {}).get('KHR_materials_sheen') if reference else None
        if sheen:
            material.setdefault('extensions', {})['KHR_materials_sheen'] = sheen
            sheen_restored.append(material['name'])
    if sheen_restored:
        gltf['extensionsUsed'] = sorted(set(gltf.get('extensionsUsed', [])) | {'KHR_materials_sheen'})
    gltf['asset']['extras'] = {'native_scene_sha256': native_hash, 'web_lion_source_sha256': sha(WEB_LOD),
                              'phase': 'Offline handoff LOD; video playback, camera interaction and screen selection are not implemented',
                              'coordinate_system': 'glTF +Y up; Blender front +Y maps to glTF -Z',
                              'shader_boundary': 'Procedural stone/screen gradients approximated by constant PBR/emissive colors; source lion sheen extension restored exactly'}
    encoded = json.dumps(gltf, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    remaining = raw[20 + json_length:]
    WEB_OUTPUT.write_bytes(struct.pack('<4sII', b'glTF', 2, 20 + len(encoded) + len(remaining)) + struct.pack('<I4s', len(encoded), b'JSON') + encoded + remaining)
    if sha(OUTPUT) != native_hash:
        raise RuntimeError('Native deliverable changed during the read-only LOD export')
    record = {'path': relative(WEB_OUTPUT), 'bytes': WEB_OUTPUT.stat().st_size, 'sha256': sha(WEB_OUTPUT),
              'source_blend_sha256': native_hash, 'source_lion_lod': relative(WEB_LOD), 'source_lion_lod_sha256': sha(WEB_LOD),
              'selected_objects': chosen, 'lion_mesh_count': len(imported), 'animations_exported': False,
              'restored_sheen_materials': sheen_restored, 'shader_boundary': gltf['asset']['extras']['shader_boundary']}
    report = json.loads(REPORT.read_text(encoding='utf-8'))
    report['web_export'] = record
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('WEB_EXPORT_DONE', json.dumps({key: value for key, value in record.items() if key != 'selected_objects'}, ensure_ascii=False), flush=True)
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--overwrite', action='store_true')
    parser.add_argument('--render-only', action='store_true')
    parser.add_argument('--export-web', action='store_true')
    parser.add_argument('--render', default='')
    parser.add_argument('--resolution', type=int, default=1600)
    parser.add_argument('--samples', type=int, default=48)
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not 640 <= options.resolution <= 4096 or not 8 <= options.samples <= 512:
        parser.error('resolution must be 640..4096 and samples 8..512')
    if options.render_only:
        if not options.render:
            parser.error('--render-only requires --render Front,Left,Right,Back,Overview')
        render_saved(options)
        return
    if options.export_web:
        export_web(options)
        return
    if not SOURCE.is_file():
        raise FileNotFoundError(SOURCE)
    if OUTPUT.exists() and not options.overwrite:
        raise FileExistsError(f'Refusing to overwrite {OUTPUT}; choose explicit --overwrite for this generated deliverable only')
    source_hash = sha(SOURCE)
    lion_report = setup_scene()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT), compress=True, relative_remap=True)
    if sha(SOURCE) != source_hash:
        raise RuntimeError('Read-only lion source changed unexpectedly')
    report = {
        'schema_version': 1, 'date': '2026-10-19', 'phase': 'Independent Blender blockout; no website route/code changes',
        'blend': {'path': relative(OUTPUT), 'bytes': OUTPUT.stat().st_size, 'sha256': sha(OUTPUT), 'blender_version': bpy.app.version_string},
        'collections': COLLECTIONS, 'coordinates': 'Blender meters, +Z up, +Y front; glTF export maps (x,y,z) to (x,z,-y)',
        'room': {'footprint_m': [20, 20], 'clear_height_m': 10.4},
        'screen_dimensions_m': [16, 9], 'screen_bottom_m': .8,
        'aspect_decision': '16 x 6.5 is not 16:9; use the explicitly required 16:9 at 16 x 9 m, raise room height accordingly.',
        'lion': lion_report,
        'screens': [{'object': f'Screen_{s[0]}', 'action': s[1], 'center_m': s[3], 'front_normal': s[5],
                     'material': f'Video_{s[0]}_Replaceable', 'brightness': s[6], 'video_path': None,
                     'status': 'MISSING_VERIFIED_ACTION_VIDEO', 'ui_anchor': f'UI_Anchor_{s[0]}'} for s in SCREENS],
        'cameras': PREVIEW_CAMERAS,
        'stage_references': ['source/design/action/action-hero-reference.png', 'source/design/action/action-detail-reference.png'],
        'missing_resources': ['No dedicated stage image attached to this request; reused the existing project design references', 'Four verified named real action video clips'],
        'web_pending': ['Mouse orbit and collision/clamp logic', 'View direction hysteresis', 'HTML video textures and primary/secondary fades',
                        'Exactly one active audio source and user audio gesture', 'Action DOM text synchronized to selected screen',
                        'Web-controlled independent lion spin; camera must not auto-orbit'],
        'packed_resources': [{'name': image.name, 'size': list(image.size), 'packed': bool(image.packed_file)} for image in bpy.data.images],
        'native_source_untouched': True, 'screenshots': [],
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('DELIVERABLE_SAVED', json.dumps(report['blend'], ensure_ascii=False), flush=True)
    if options.render:
        render_saved(options)


if __name__ == '__main__':
    main()
