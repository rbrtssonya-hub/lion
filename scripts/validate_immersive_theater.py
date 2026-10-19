"""Independently inspect the saved immersive-theater Blender deliverable.

Inspect the native source in a fresh process, then reopen the delivered .blend::

    blender --background --factory-startup --python scripts/validate_immersive_theater.py -- --baseline-only
    blender --background --factory-startup source/models/immersive-theater/SouthWindLion_Immersive_Theater_Blockout.blend --python scripts/validate_immersive_theater.py

This is read-only toward the source model and final .blend. Only the requested
JSON report/baseline is written. Visual composition is audited separately using
the five actual renders; numerical checks do not substitute for that review.
"""

import argparse
import array
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE_BLEND = ROOT / "model/醒狮_保留UV_三角转四边_优化.blend"
SOURCE_GLB = ROOT / "source/public/assets/models/lion-structure-optimized.glb"
FINAL_BLEND = ROOT / "source/models/immersive-theater/SouthWindLion_Immersive_Theater_Blockout.blend"
PREVIEWS = ROOT / "source/reviews/immersive-theater/2026-10-19"
REPORT = ROOT / "source/references/2026-10-19-immersive-theater-validation.json"
BASELINE = ROOT / "tmp/immersive-theater-native-source-baseline.json"
SOURCE_REPORT = ROOT / "source/references/lion-structure-model.json"
SOURCE_BLEND_SHA256 = "2230dbce24b0d9bead0b6781410cfbb9acf6d249c99113210f21ba0b16991bd2"
COLLECTIONS = [
    "00_Environment", "01_Stage", "02_Lion", "03_Screens", "04_Screen_Frames",
    "05_Lighting", "06_Cameras", "07_Interaction_Anchors", "08_Proxies",
]
SCREENS = {
    "Screen_Tanqing": ("探青采青", "video_tanqing", Vector((0, 1, 0))),
    "Screen_Doumao": ("抖毛", "video_doumao", Vector((1, 0, 0))),
    "Screen_Tuqiu": ("狮子吐球", "video_tuqiu", Vector((0, -1, 0))),
    "Screen_Meihuazhuang": ("踩梅花桩", "video_meihuazhuang", Vector((-1, 0, 0))),
}


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative(path):
    path = Path(path).resolve()
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def vector(value):
    return [round(float(component), 7) for component in value]


def flatten_matrix(value):
    return [float(component) for row in value for component in row]


def array_digest(collection, prop, width, code="f"):
    values = array.array(code, [0]) * (len(collection) * width)
    collection.foreach_get(prop, values)
    return hashlib.sha256(values.tobytes()).hexdigest()


def mesh_record(obj):
    mesh = obj.data
    return {
        "vertices": len(mesh.vertices),
        "polygons": len(mesh.polygons),
        "triangles": sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons),
        "positions_sha256": array_digest(mesh.vertices, "co", 3),
        "indices_sha256": array_digest(mesh.loops, "vertex_index", 1, "I"),
        "polygon_sizes_sha256": array_digest(mesh.polygons, "loop_total", 1, "I"),
        "material_indices_sha256": array_digest(mesh.polygons, "material_index", 1, "I"),
        "smooth_flags_sha256": array_digest(mesh.polygons, "use_smooth", 1, "b"),
        "uv_layers": {layer.name: array_digest(layer.data, "uv", 2) for layer in mesh.uv_layers},
        "material_names": [slot.material.name if slot.material else None for slot in obj.material_slots],
    }


def curves_record(obj):
    data = obj.data
    attributes = {}
    for attribute in data.attributes:
        kind = attribute.data_type
        if kind == "FLOAT_VECTOR":
            prop, width, code = "vector", 3, "f"
        elif kind in {"FLOAT_COLOR", "BYTE_COLOR"}:
            prop, width, code = "color", 4, "f"
        elif kind in {"INT", "INT8"}:
            prop, width, code = "value", 1, "i"
        elif kind == "BOOLEAN":
            prop, width, code = "value", 1, "b"
        elif kind == "FLOAT":
            prop, width, code = "value", 1, "f"
        else:
            raise ValueError("Unverified curve attribute type: " + kind)
        attributes[attribute.name] = {
            "type": kind, "domain": attribute.domain, "count": len(attribute.data),
            "sha256": array_digest(attribute.data, prop, width, code),
        }
    radii = array.array("f", [0]) * len(data.points)
    data.attributes["radius"].data.foreach_get("value", radii)
    return {
        "points": len(data.points), "curves": len(data.curves),
        "curve_offsets_sha256": array_digest(data.curves, "first_point_index", 1, "i"),
        "curve_lengths_sha256": array_digest(data.curves, "points_length", 1, "i"),
        "attributes": attributes,
        "radius_min": min(radii), "radius_max": max(radii),
        "surface": data.surface.name if data.surface else None,
        "material_names": [material.name if material else None for material in data.materials],
    }


def json_value(value):
    if value is None or isinstance(value, (str, bool, int, float)):
        return value
    if isinstance(value, bpy.types.ID):
        return {"id": value.name, "type": value.bl_rna.identifier}
    if hasattr(value, "items"):
        return {key: json_value(item) for key, item in value.items()}
    try:
        return [json_value(item) for item in value]
    except TypeError:
        return str(value)


def modifier_record(modifier):
    result = {"name": modifier.name, "type": modifier.type}
    for prop in modifier.bl_rna.properties:
        if prop.identifier in {"rna_type", "name", "type"} or prop.is_readonly or prop.type == "COLLECTION":
            continue
        result[prop.identifier] = json_value(getattr(modifier, prop.identifier))
    return result


def constraint_record(constraint):
    result = {"name": constraint.name, "type": constraint.type}
    for prop in constraint.bl_rna.properties:
        if prop.identifier in {"rna_type", "name", "type"} or prop.is_readonly or prop.type == "COLLECTION":
            continue
        result[prop.identifier] = json_value(getattr(constraint, prop.identifier))
    return result


def object_record(obj):
    return {
        "type": obj.type,
        "modifiers": [modifier_record(modifier) for modifier in obj.modifiers],
        "custom_properties": json_value(dict(obj.items())),
        "geometry": mesh_record(obj) if obj.type == "MESH" else curves_record(obj),
    }


def image_record(image):
    packed = image.packed_file
    return {
        "size": list(image.size),
        "source": image.source,
        "colorspace": image.colorspace_settings.name,
        "alpha_mode": image.alpha_mode,
        "packed": bool(packed),
        "packed_sha256": hashlib.sha256(bytes(packed.data)).hexdigest() if packed else None,
        "filepath": image.filepath,
    }


def material_record(material):
    nodes = []
    tree = material.node_tree
    for node in sorted(tree.nodes if tree else [], key=lambda item: item.name):
        inputs = {}
        for socket in node.inputs:
            if not hasattr(socket, "default_value") or socket.is_linked:
                continue
            value = socket.default_value
            if isinstance(value, (str, bool, int, float)):
                inputs[socket.identifier] = value
            else:
                try:
                    inputs[socket.identifier] = list(value)
                except TypeError:
                    pass
        settings = {key: json_value(getattr(node, key)) for key in (
            "operation", "blend_type", "gradient_type", "noise_dimensions", "noise_type", "normalize",
            "voronoi_dimensions", "feature", "distance", "projection", "projection_blend", "extension",
            "interpolation", "space", "uv_map", "attribute_name", "distribution", "subsurface_method",
            "vector_type", "convert_from", "convert_to", "clamp", "use_clamp", "target", "data_type",
        ) if hasattr(node, key)}
        if hasattr(node, "color_ramp"):
            ramp = node.color_ramp
            settings["color_ramp"] = {"color_mode": ramp.color_mode, "interpolation": ramp.interpolation, "hue_interpolation": ramp.hue_interpolation, "elements": [{"position": item.position, "color": list(item.color)} for item in ramp.elements]}
        nodes.append({
            "name": node.name, "type": node.bl_idname, "inputs": inputs,
            "settings": settings,
            "image_content": {key: value for key, value in image_record(node.image).items() if key in {"size", "source", "colorspace", "alpha_mode", "packed_sha256"}} if getattr(node, "image", None) else None,
        })
    links = sorted([
        [link.from_node.name, link.from_socket.identifier, link.to_node.name, link.to_socket.identifier]
        for link in tree.links
    ]) if tree else []
    return {"nodes": nodes, "links": links, "diffuse_color": list(material.diffuse_color), "render_settings": {key: json_value(getattr(material, key)) for key in ("use_backface_culling", "surface_render_method", "use_transparency_overlap") if hasattr(material, key)}}


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        obj = stack.pop()
        result.append(obj)
        stack.extend(obj.children)
    return result


def corners_world(obj):
    return [obj.matrix_world @ Vector(point) for point in obj.bound_box]


def object_bounds(objects):
    points = [point for obj in objects for point in corners_world(obj)]
    return {
        "min": [min(point[axis] for point in points) for axis in range(3)],
        "max": [max(point[axis] for point in points) for axis in range(3)],
    }


def action_fcurves(action):
    if not action:
        return []
    result = []
    # Blender 4.4+ layered Actions; retain compatibility with older legacy data.
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for channelbag in getattr(strip, "channelbags", []):
                result.extend(channelbag.fcurves)
    if not result and hasattr(action, "fcurves"):
        result.extend(action.fcurves)
    return result


def create_baseline(args):
    bpy.ops.wm.open_mainfile(filepath=str(args.source_blend), load_ui=False)
    bpy.context.view_layer.update()
    verification = json.loads(SOURCE_REPORT.read_text(encoding="utf-8"))
    excluded = {item["excluded"]: item["identical_to"] for item in verification["duplicate_verification"]["duplicates"]}
    objects = [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVES"} and obj.name not in excluded]
    material_names = {slot.material.name for obj in objects for slot in obj.material_slots if slot.material}
    image_names = {
        node.image.name
        for name in material_names for node in bpy.data.materials[name].node_tree.nodes
        if getattr(node, "image", None)
    }
    data = {
        "source_glb": {"path": relative(args.source_glb), "sha256": sha256(args.source_glb)},
        "source_blend": {"path": relative(args.source_blend), "sha256": sha256(args.source_blend)},
        "blender_version": bpy.app.version_string,
        "source_original_object_counts": {kind: sum(obj.type == kind for obj in bpy.context.scene.objects) for kind in {obj.type for obj in bpy.context.scene.objects}},
        "coincident_mesh_exclusions": excluded,
        "objects": {obj.name: object_record(obj) for obj in objects},
        "matrices": {obj.name: flatten_matrix(obj.matrix_world) for obj in objects},
        "source_helpers": {obj.name: {"custom_properties": json_value(dict(obj.items())), "constraints": [constraint_record(constraint) for constraint in obj.constraints], "matrix": flatten_matrix(obj.matrix_world)} for obj in bpy.context.scene.objects if obj.type == "EMPTY"},
        "materials": {name: material_record(bpy.data.materials[name]) for name in material_names},
        "images": {name: image_record(bpy.data.images[name]) for name in image_names},
    }
    args.baseline.parent.mkdir(parents=True, exist_ok=True)
    args.baseline.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("THEATER_BASELINE", json.dumps({"path": relative(args.baseline), "mesh_count": sum(obj.type == "MESH" for obj in objects), "curve_object_count": sum(obj.type == "CURVES" for obj in objects), "materials": len(material_names), "images": len(image_names)}))


def inspect_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if (magic, version, length) != (b"glTF", 2, len(data)):
        raise ValueError("Invalid GLB header/length")
    offset, gltf, binary = 12, None, b""
    while offset < len(data):
        size, kind = struct.unpack_from("<I4s", data, offset)
        payload = data[offset + 8:offset + 8 + size]
        if kind == b"JSON":
            gltf = json.loads(payload)
        elif kind == b"BIN\x00":
            binary = payload
        offset += 8 + size
    if not gltf:
        raise ValueError("GLB has no JSON chunk")
    nodes = gltf.get("nodes", [])
    names = [node.get("name") for node in nodes]
    parent = {child: index for index, node in enumerate(nodes) for child in node.get("children", [])}
    formats = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
    widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

    def accessor_values(index):
        accessor = gltf["accessors"][index]
        if "sparse" in accessor or "bufferView" not in accessor:
            raise ValueError("Unexpected sparse/implicit accessor requires separate validation")
        view = gltf["bufferViews"][accessor["bufferView"]]
        code, component_bytes = formats[accessor["componentType"]]
        width = widths[accessor["type"]]
        stride = view.get("byteStride", component_bytes * width)
        start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
        end = start + max(0, accessor["count"] - 1) * stride + component_bytes * width
        if end > view.get("byteOffset", 0) + view["byteLength"] or end > len(binary):
            raise ValueError("Accessor extends beyond its binary buffer view")
        values = [struct.unpack_from("<" + code * width, binary, start + row * stride) for row in range(accessor["count"])]
        if accessor.get("normalized") and accessor["componentType"] != 5126:
            maximum = {5120: 127, 5121: 255, 5122: 32767, 5123: 65535, 5125: 4294967295}[accessor["componentType"]]
            values = [tuple(max(-1, value / maximum) for value in row) for row in values]
        return values

    world_matrices = {}

    def world_matrix(index):
        if index in world_matrices:
            return world_matrices[index]
        node = nodes[index]
        if "matrix" in node:
            values = node["matrix"]
            local = Matrix([[values[row + column * 4] for column in range(4)] for row in range(4)])
        else:
            rotation = node.get("rotation", [0, 0, 0, 1])
            local = Matrix.Translation(node.get("translation", [0, 0, 0])) @ Quaternion((rotation[3], rotation[0], rotation[1], rotation[2])).to_matrix().to_4x4() @ Matrix.Diagonal([*node.get("scale", [1, 1, 1]), 1])
        result = world_matrix(parent[index]) @ local if index in parent else local
        world_matrices[index] = result
        return result

    mesh_errors = []
    decoded_positions = {}
    triangle_count = 0
    for mesh_index, mesh in enumerate(gltf.get("meshes", [])):
        for primitive_index, primitive in enumerate(mesh["primitives"]):
            positions = accessor_values(primitive["attributes"]["POSITION"])
            decoded_positions[(mesh_index, primitive_index)] = positions
            if not all(math.isfinite(value) for row in positions for value in row):
                mesh_errors.append({"mesh": mesh_index, "primitive": primitive_index, "reason": "nonfinite positions"})
            if primitive.get("mode", 4) != 4:
                mesh_errors.append({"mesh": mesh_index, "primitive": primitive_index, "reason": "unexpected nontriangle primitive"})
            indices = accessor_values(primitive["indices"]) if "indices" in primitive else [(index,) for index in range(len(positions))]
            triangle_count += len(indices) // 3
            if len(indices) % 3 or any(index[0] < 0 or index[0] >= len(positions) for index in indices):
                mesh_errors.append({"mesh": mesh_index, "primitive": primitive_index, "reason": "invalid indices"})
            for key in ("NORMAL", "TEXCOORD_0"):
                if key in primitive["attributes"]:
                    values = accessor_values(primitive["attributes"][key])
                    if len(values) != len(positions) or not all(math.isfinite(value) for row in values for value in row):
                        mesh_errors.append({"mesh": mesh_index, "primitive": primitive_index, "reason": "invalid " + key})
    screen_details = {}
    for name in SCREENS:
        index = names.index(name)
        node = nodes[index]
        primitive = gltf["meshes"][node["mesh"]]["primitives"][0]
        matrix = world_matrix(index)
        positions = [matrix @ Vector(row) for row in decoded_positions[(node["mesh"], 0)]]
        normals = accessor_values(primitive["attributes"]["NORMAL"])
        normal = (matrix.to_3x3().inverted().transposed() @ Vector(normals[0])).normalized()
        center = sum(positions, Vector()) / len(positions)
        inward = Vector((-center.x, 0, -center.z)).normalized()
        extent = [[min(row[axis] for row in positions), max(row[axis] for row in positions)] for axis in range(3)]
        width, height = max(extent[0][1] - extent[0][0], extent[2][1] - extent[2][0]), extent[1][1] - extent[1][0]
        uv = accessor_values(primitive["attributes"]["TEXCOORD_0"])
        material = gltf["materials"][primitive["material"]]
        emission_strength = material.get("extensions", {}).get("KHR_materials_emissive_strength", {}).get("emissiveStrength", 1)
        emission = [value * emission_strength for value in material.get("emissiveFactor", [0, 0, 0])]
        screen_details[name] = {"center_y_up": vector(center), "normal_y_up": vector(normal), "normal_dot_inward": normal.dot(inward), "width": width, "height": height, "bottom_y": extent[1][0], "unit_uv_corners": sorted(set(uv)), "material": material.get("name"), "effective_emission": emission, "extras": node.get("extras", {})}
    root_index = names.index("Lion_RotationRoot")
    lion_indices, pending = [], list(nodes[root_index].get("children", []))
    while pending:
        index = pending.pop()
        lion_indices.append(index)
        pending.extend(nodes[index].get("children", []))
    lion_points = [world_matrix(index) @ Vector(row) for index in lion_indices if "mesh" in nodes[index] for primitive_index in range(len(gltf["meshes"][nodes[index]["mesh"]]["primitives"])) for row in decoded_positions[(nodes[index]["mesh"], primitive_index)]]
    lion_bounds = {"min": [min(row[axis] for row in lion_points) for axis in range(3)], "max": [max(row[axis] for row in lion_points) for axis in range(3)]}
    source_data = SOURCE_GLB.read_bytes()
    source_gltf = json.loads(source_data[20:20 + struct.unpack_from("<I", source_data, 12)[0]])
    source_sheens = {material["name"]: material["extensions"]["KHR_materials_sheen"] for material in source_gltf["materials"] if "KHR_materials_sheen" in material.get("extensions", {})}
    exported_materials = {material.get("name"): material for material in gltf["materials"]}
    sheen_mismatches = [name for name, sheen in source_sheens.items() if exported_materials.get(name, {}).get("extensions", {}).get("KHR_materials_sheen") != sheen]
    images = gltf.get("images", [])
    image_bytes = []
    for image in images:
        view = gltf.get("bufferViews", [])[image["bufferView"]] if "bufferView" in image else None
        image_bytes.append(view.get("byteLength", 0) if view else 0)
    return {
        "path": relative(path), "sha256": sha256(path), "bytes": len(data),
        "node_names": names, "node_count": len(nodes), "mesh_count": len(gltf.get("meshes", [])),
        "scene_extras": [scene.get("extras", {}) for scene in gltf.get("scenes", [])],
        "asset_extras": gltf.get("asset", {}).get("extras", {}),
        "orbit_anchor_world_positions": {name: vector(world_matrix(names.index(name)).translation) for name in ("Camera_Target", "Camera_OrbitCenter") if name in names},
        "image_count": len(images), "embedded_image_bytes": image_bytes,
        "external_uris": [entry["uri"] for kind in ("buffers", "images") for entry in gltf.get(kind, []) if "uri" in entry and not entry["uri"].startswith("data:")],
        "camera_count": len(gltf.get("cameras", [])),
        "animation_count": len(gltf.get("animations", [])),
        "triangle_count": triangle_count,
        "geometry_errors": mesh_errors,
        "screens": screen_details,
        "lion_descendant_mesh_count": sum("mesh" in nodes[index] for index in lion_indices),
        "lion_bounds_y_up": lion_bounds,
        "root_extras": nodes[root_index].get("extras", {}),
        "model_extras": nodes[names.index("Lion_Model")].get("extras", {}),
        "source_sheen_material_count": len(source_sheens),
        "source_sheen_mismatches": sheen_mismatches,
        "parent_names": {names[child]: names[index] for child, index in parent.items()},
        "extensions_used": gltf.get("extensionsUsed", []),
        "binary_bytes": len(binary),
    }


def validate(args):
    scene = bpy.context.scene
    report = {
        "schema_version": 1,
        "validation_method": "Fresh Blender process reopened the final saved .blend; a separate process reopened the original native source .blend for geometry/UV/curve-attribute/modifier/material/image hashes and original transforms. No .blend is saved by this validator.",
        "blender_version": bpy.app.version_string,
        "opened_blend": relative(bpy.data.filepath),
        "checks": [], "observations": {}, "limitations": [
            "This Blockout prepares later web interaction; it does not implement browser camera dragging, video direction switching, brightness/audio crossfades, or DOM explanations.",
            "The main .blend uses the native source lion: 23 unique mesh objects and all 18 native hair-curve objects. Fifteen independently documented coincident mesh copies and three source lights are omitted; the user's original source is unchanged.",
            "Render composition, model visibility, dark-room balance and reference fidelity require the separate visual review of the actual five preview images.",
        ],
    }

    def check(name, passed, details=None):
        report["checks"].append({"name": name, "passed": bool(passed), "details": details})

    check("final_blend_exists_and_reopened", args.blend.is_file() and Path(bpy.data.filepath).resolve() == args.blend.resolve())
    source_hash = sha256(args.source_blend)
    check("original_blend_unchanged", source_hash == SOURCE_BLEND_SHA256, {"path": relative(args.source_blend), "sha256": source_hash, "bytes": args.source_blend.stat().st_size})
    baseline = json.loads(args.baseline.read_text(encoding="utf-8"))
    report["observations"]["independent_source_baseline"] = {"sha256": sha256(args.baseline), "original_object_counts": baseline["source_original_object_counts"], "native_meshes": sum(record["type"] == "MESH" for record in baseline["objects"].values()), "native_curve_objects": sum(record["type"] == "CURVES" for record in baseline["objects"].values()), "used_materials": len(baseline["materials"]), "used_source_image_datablocks": len(baseline["images"]), "documented_coincident_mesh_exclusions": baseline["coincident_mesh_exclusions"]}
    check("validated_web_source_unchanged", sha256(args.source_glb) == baseline["source_glb"]["sha256"], baseline["source_glb"])
    check("nine_collections", all(name in bpy.data.collections for name in COLLECTIONS), [name for name in COLLECTIONS if name not in bpy.data.collections])
    check("all_scene_objects_organized", all(obj.users_collection and all(collection.name in COLLECTIONS for collection in obj.users_collection) for obj in scene.objects))
    check("metric_units", scene.unit_settings.system == "METRIC" and math.isclose(scene.unit_settings.scale_length, 1.0))
    floor = scene.objects.get("Lion_Stage_Floor")
    ceiling = scene.objects.get("Room_Ceiling")
    floor_bounds = object_bounds([floor]) if floor else None
    ceiling_bounds = object_bounds([ceiling]) if ceiling else None
    check("room_20m_square_and_10_4m_clear_height", floor is not None and ceiling is not None and math.isclose(floor.dimensions.x, 20, abs_tol=0.01) and math.isclose(floor.dimensions.y, 20, abs_tol=0.01) and math.isclose(ceiling_bounds["min"][2] - floor_bounds["max"][2], 10.4, abs_tol=0.01), {"floor_bounds": floor_bounds, "ceiling_bounds": ceiling_bounds})

    # Four independent, inward-facing, exact-ratio screens, not a merged wall.
    screen_info = {}
    used_materials = []
    for name, (title, key, direction) in SCREENS.items():
        obj = scene.objects.get(name)
        check(name + "_exists", obj is not None and obj.type == "MESH")
        if obj is None:
            continue
        bounds = object_bounds([obj])
        sizes = [bounds["max"][axis] - bounds["min"][axis] for axis in range(3)]
        width, height = max(sizes[:2]), sizes[2]
        center = sum(corners_world(obj), Vector()) / 8
        normal = (obj.matrix_world.to_3x3().inverted().transposed() @ obj.data.polygons[0].normal).normalized()
        inward = Vector((-center.x, -center.y, 0)).normalized()
        check(name + "_16_by_9", math.isclose(width / height, 16 / 9, rel_tol=1e-5), {"width": width, "height": height})
        check(name + "_large_and_aligned", width >= 15.9 and math.isclose(height, 9, abs_tol=0.01) and math.isclose(bounds["min"][2], 0.8, abs_tol=0.01))
        check(name + "_correct_direction", center.normalized().dot(direction) > 0.85)
        check(name + "_faces_inward", normal.dot(inward) > 0.99, {"normal": vector(normal), "dot": normal.dot(inward)})
        check(name + "_action_mapping", obj.get("action_title") == title and obj.get("video_resource_key") == key, {"title": obj.get("action_title"), "key": obj.get("video_resource_key")})
        check(name + "_screen_collection", any(collection.name == "03_Screens" for collection in obj.users_collection))
        uv = [tuple(loop.uv) for loop in obj.data.uv_layers.active.data] if obj.data.uv_layers.active else []
        check(name + "_full_frame_unit_uvs", len(uv) == 4 and set(uv) == {(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)}, uv)
        material = obj.active_material
        used_materials.append(material.name if material else None)
        brightness_node = material.node_tree.nodes.get("Screen_Brightness") if material and material.node_tree else None
        brightness = brightness_node.outputs[0].default_value if brightness_node else None
        expected = 1.0 if name == "Screen_Tanqing" else 0.25
        check(name + "_primary_secondary_brightness", brightness is not None and math.isclose(brightness, expected, abs_tol=1e-5), brightness)
        video_emission = material.node_tree.nodes.get("Video_Emission") if material and material.node_tree else None
        check(name + "_brightness_controls_emission", video_emission is not None and any(link.from_node == brightness_node and link.to_node == video_emission and link.to_socket.name == "Strength" for link in material.node_tree.links))
        check(name + "_primary_secondary_state", obj.get("primary_state") == ("PRIMARY" if name == "Screen_Tanqing" else "SECONDARY"))
        video_path = obj.get("video_path", "")
        check(name + "_video_path_or_explicit_placeholder", bool(obj.get("is_placeholder")) if not video_path else Path(bpy.path.abspath(video_path)).is_file(), {"video_path": video_path, "is_placeholder": obj.get("is_placeholder")})
        suffix = name.removeprefix("Screen_")
        ui = scene.objects.get("UI_Anchor_" + suffix)
        direction_obj = scene.objects.get("Screen_" + suffix + "_Direction")
        check(name + "_interaction_anchors", ui is not None and direction_obj is not None and ui.type == "EMPTY" and direction_obj.type == "EMPTY")
        screen_info[name] = {"bounds": bounds, "center": vector(center), "normal": vector(normal), "material": material.name if material else None, "brightness": brightness, "custom_properties": {key: value for key, value in obj.items() if key != "_RNA_UI"}}
    check("four_distinct_screen_materials", len(used_materials) == 4 and len(set(used_materials)) == 4, used_materials)
    check("exactly_four_screen_surfaces", len([obj for obj in bpy.data.collections["03_Screens"].objects if obj.type == "MESH"]) == 4)
    report["observations"]["screens"] = screen_info

    root = scene.objects.get("Lion_RotationRoot")
    model = scene.objects.get("Lion_Model")
    stage = scene.objects.get("Lion_Stage_Base")
    check("lion_hierarchy_roots", root is not None and model is not None and model.parent == root and root.parent is None)
    lion_objects = descendants(root) if root else []
    lion_meshes = [obj for obj in lion_objects if obj.type == "MESH"]
    lion_curves = [obj for obj in lion_objects if obj.type == "CURVES"]
    lion_geometry = lion_meshes + lion_curves
    check("all_native_unique_meshes_and_hair_curves_preserved", len(lion_meshes) == 23 and len(lion_curves) == 18 and len(lion_geometry) == len(baseline["objects"]), {"meshes": len(lion_meshes), "hair_curve_objects": len(lion_curves), "baseline": len(baseline["objects"])})
    geometry_mismatches, modifier_mismatches, property_mismatches, transform_mismatches = [], [], [], []
    scene.frame_set(1)
    bpy.context.view_layer.update()
    placement = None
    for name, expected in baseline["objects"].items():
        obj = scene.objects.get(name)
        if obj is None or obj not in lion_geometry:
            geometry_mismatches.append({"name": name, "reason": "missing from lion hierarchy"})
            continue
        actual = object_record(obj)
        if actual["geometry"] != expected["geometry"] or actual["type"] != expected["type"]:
            geometry_mismatches.append({"name": name, "fields": [key for key in expected["geometry"] if expected["geometry"][key] != actual["geometry"].get(key)]})
        original_modifiers = [modifier for modifier in actual["modifiers"] if not (obj.type == "CURVES" and modifier["name"] == "Native_Fiber_Radius_Unit_Recovery")]
        if original_modifiers != expected["modifiers"]:
            modifier_mismatches.append(name)
        if any(value != actual["custom_properties"].get(key) for key, value in expected["custom_properties"].items()):
            property_mismatches.append(name)
        matrix_values = baseline["matrices"][name]
        original_matrix = Matrix([matrix_values[index:index + 4] for index in range(0, 16, 4)])
        this_placement = obj.matrix_world @ original_matrix.inverted()
        if placement is None:
            placement = this_placement
        difference = max(abs(a - b) for a, b in zip(flatten_matrix(this_placement), flatten_matrix(placement)))
        if difference > 1e-4:
            transform_mismatches.append({"name": name, "max_matrix_delta": difference})
    check("source_geometry_uv_material_slots_exact", not geometry_mismatches, geometry_mismatches)
    check("source_modifiers_preserved", not modifier_mismatches, modifier_mismatches)
    check("source_object_metadata_preserved", not property_mismatches, property_mismatches)
    helper_mismatches = []
    for name, expected in baseline["source_helpers"].items():
        obj = scene.objects.get(name)
        if obj is None or obj.type != "EMPTY" or obj not in lion_objects:
            helper_mismatches.append({"name": name, "reason": "missing source helper"})
            continue
        metadata = json_value(dict(obj.items()))
        constraints = [constraint_record(constraint) for constraint in obj.constraints]
        if constraints != expected["constraints"] or any(value != metadata.get(key) for key, value in expected["custom_properties"].items()):
            helper_mismatches.append({"name": name, "reason": "source helper metadata/constraints changed"})
    check("all_41_source_helpers_and_constraints_preserved", len(baseline["source_helpers"]) == 41 and not helper_mismatches, helper_mismatches)
    check("single_rigid_uniform_model_placement", not transform_mismatches, {"mismatches": transform_mismatches, "source_to_final_matrix": flatten_matrix(placement) if placement else None})
    material_mismatches = []
    for name, expected in baseline["materials"].items():
        actual = bpy.data.materials.get(name)
        if actual is None or material_record(actual) != expected:
            material_mismatches.append(name)
    check("source_material_graphs_preserved", not material_mismatches, material_mismatches)
    image_mismatches = []
    current_image_content = {
        (tuple(record["size"]), record["colorspace"], record["packed_sha256"])
        for image in bpy.data.images if image.packed_file
        for record in [image_record(image)]
    }
    for name, expected in baseline["images"].items():
        signature = (tuple(expected["size"]), expected["colorspace"], expected["packed_sha256"])
        if signature not in current_image_content:
            image_mismatches.append({"source_name": name, "expected_content": expected})
    check("source_texture_content_preserved", not image_mismatches, image_mismatches)

    radius_recovery = []
    for obj in lion_curves:
        raw = baseline["objects"][obj.name]["geometry"]["radius_max"]
        intended = float(obj.get("fiber_world_radius_max", raw))
        needs_recovery = raw > intended * 100
        recovery = [modifier for modifier in obj.modifiers if modifier.name == "Native_Fiber_Radius_Unit_Recovery"]
        valid = len(recovery) == (1 if needs_recovery else 0)
        factor = 1.0
        if needs_recovery and len(recovery) == 1:
            group = recovery[0].node_group
            nodes = list(group.nodes) if group else []
            types = [node.bl_idname for node in nodes]
            valid = valid and sorted(types) == sorted(["NodeGroupInput", "NodeGroupOutput", "GeometryNodeInputRadius", "ShaderNodeMath", "GeometryNodeSetCurveRadius"])
            multiply = next((node for node in nodes if node.bl_idname == "ShaderNodeMath"), None)
            setter = next((node for node in nodes if node.bl_idname == "GeometryNodeSetCurveRadius"), None)
            if multiply and setter:
                factor = multiply.inputs[1].default_value
                valid = valid and multiply.operation == "MULTIPLY" and math.isclose(factor, intended / raw, rel_tol=1e-5)
                links = {(link.from_node.bl_idname, link.from_socket.name, link.to_node.bl_idname, link.to_socket.name) for link in group.links}
                expected_links = {
                    ("NodeGroupInput", "Geometry", "GeometryNodeSetCurveRadius", "Curve"),
                    ("GeometryNodeInputRadius", "Radius", "ShaderNodeMath", "Value"),
                    ("ShaderNodeMath", "Value", "GeometryNodeSetCurveRadius", "Radius"),
                    ("GeometryNodeSetCurveRadius", "Curve", "NodeGroupOutput", "Geometry"),
                }
                valid = valid and links == expected_links and setter.inputs["Selection"].default_value and not setter.inputs["Selection"].is_linked
            else:
                valid = False
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        effective_max = max(item.value for item in evaluated.data.attributes["radius"].data)
        target_max = intended if needs_recovery else raw
        valid = valid and math.isclose(effective_max, target_max, rel_tol=2e-4)
        scale = obj.matrix_world.to_scale()
        entry = {"object": obj.name, "source_radius_attribute_max": raw, "source_authored_radius_max_m": intended, "recovery_factor": factor, "evaluated_radius_max": effective_max, "world_radius_max_with_display_scale": effective_max * max(scale), "world_scale": vector(scale), "modified": needs_recovery}
        radius_recovery.append(entry)
        check(obj.name + "_native_radius_evaluation", valid, entry)
    check("exactly_17_radius_unit_recoveries", sum(item["modified"] for item in radius_recovery) == 17)
    report["observations"]["native_hair_radius_evaluation"] = radius_recovery

    # One action curve; evaluation is sampled before, at and after the repeat.
    animation = root.animation_data if root else None
    curves = action_fcurves(animation.action if animation else None)
    check("only_root_z_rotation_curve", len(curves) == 1 and curves[0].data_path == "rotation_euler" and curves[0].array_index == 2, [{"path": curve.data_path, "index": curve.array_index} for curve in curves])
    curve = curves[0] if len(curves) == 1 else None
    points = list(curve.keyframe_points) if curve else []
    check("rotation_36_seconds_linear_cycles", curve is not None and len(points) == 2 and math.isclose(points[0].co.x, 1) and math.isclose(points[1].co.x, 865) and math.isclose(points[1].co.y - points[0].co.y, math.tau, abs_tol=1e-5) and all(point.interpolation == "LINEAR" for point in points) and any(modifier.type == "CYCLES" for modifier in curve.modifiers) and math.isclose(scene.render.fps / scene.render.fps_base, 24), {"fps": scene.render.fps / scene.render.fps_base, "points": [list(point.co) for point in points], "modifiers": [modifier.type for modifier in curve.modifiers] if curve else []})
    animated_others = [obj.name for obj in lion_objects if obj.animation_data and (obj.animation_data.action or len(obj.animation_data.drivers) or len(obj.animation_data.nla_tracks))]
    check("no_lion_part_actions_or_drivers", not animated_others, animated_others)
    check("only_original_static_local_rotation_limits", all(constraint.type == "LIMIT_ROTATION" and constraint.owner_space == "LOCAL" and constraint.name == "Local_Design_Rotation_Limits" for obj in lion_objects for constraint in obj.constraints))
    stage_bounds = object_bounds([stage]) if stage else None
    stage_top = stage_bounds["max"][2] if stage_bounds else None
    radius = max(stage.dimensions.x, stage.dimensions.y) / 2 if stage else 0
    check("stage_diameter_5m", stage is not None and math.isclose(stage.dimensions.x, 5, abs_tol=0.01) and math.isclose(stage.dimensions.y, 5, abs_tol=0.01), stage_bounds)
    samples = []
    reference_heights = None
    steady = True
    relative_matrices = {obj.name: root.matrix_world.inverted() @ obj.matrix_world for obj in lion_objects}
    relative_deltas = []
    for frame in (1, 109, 217, 325, 433, 541, 649, 757, 865, 973, 1081, 1297):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        bound = object_bounds(lion_meshes)
        radial = max(math.hypot(point.x, point.y) for obj in lion_meshes for point in corners_world(obj))
        heights = (bound["min"][2], bound["max"][2])
        if reference_heights is None:
            reference_heights = heights
        if max(abs(a - b) for a, b in zip(heights, reference_heights)) > 1e-4:
            steady = False
        maximum_relative_delta = max(max(abs(a - b) for a, b in zip(flatten_matrix(root.matrix_world.inverted() @ obj.matrix_world), flatten_matrix(relative_matrices[obj.name]))) for obj in lion_objects)
        relative_deltas.append({"frame": frame, "maximum_local_to_rotation_root_matrix_delta": maximum_relative_delta})
        samples.append({"frame": frame, "rotation_euler": vector(root.rotation_euler) if root else None, "bounds": bound, "conservative_bound_radius": radial, "stage_top": stage_top})
    check("model_never_leaves_stage_or_changes_height", steady and all(abs(item["bounds"]["min"][2] - stage_top) < 0.015 and item["conservative_bound_radius"] < radius - 0.05 for item in samples), samples)
    check("all_source_parts_remain_rigid_during_two_rotation_cycles", all(item["maximum_local_to_rotation_root_matrix_delta"] < 1e-4 for item in relative_deltas), relative_deltas)
    check("root_does_not_tilt_or_translate", root is not None and abs(root.rotation_euler.x) < 1e-6 and abs(root.rotation_euler.y) < 1e-6 and abs(root.location.x) < 1e-6 and abs(root.location.y) < 1e-6)
    foot_contact = {}
    for name in ("Lion_Forepaw_L", "Lion_Forepaw_R", "Lion_Hindpaw_L", "Lion_Hindpaw_R"):
        paw = scene.objects.get(name)
        minimum = min((paw.matrix_world @ vertex.co).z for vertex in paw.data.vertices) if paw else None
        foot_contact[name] = {"minimum_z": minimum, "stage_top": stage_top, "gap": minimum - stage_top if minimum is not None else None}
    check("four_paws_natural_contact_without_source_deformation", all(item["gap"] is not None and -0.001 < item["gap"] < 0.025 for item in foot_contact.values()), foot_contact)
    report["observations"]["lion"] = {"native_meshes": len(lion_meshes), "native_curve_objects": len(lion_curves), "native_strands": sum(len(obj.data.curves) for obj in lion_curves), "native_curve_points": sum(len(obj.data.points) for obj in lion_curves), "vertices": sum(len(obj.data.vertices) for obj in lion_meshes), "base_cage_triangles": sum(mesh_record(obj)["triangles"] for obj in lion_meshes), "stage_radius": radius, "rotation_samples": samples}
    scene.frame_set(1)
    bpy.context.view_layer.update()

    cameras = [obj for obj in scene.objects if obj.type == "CAMERA"]
    camera_details = []
    for camera in cameras:
        location = camera.matrix_world.translation
        lineage = []
        current = camera
        while current.parent:
            current = current.parent
            lineage.append(current.name)
        independent = root is None or root.name not in lineage
        inside = abs(location.x) < 9.5 and abs(location.y) < 9.5 and 0.3 < location.z < 10.3
        check(camera.name + "_inside_and_independent", inside and independent and not camera.animation_data, {"position": vector(location), "parents": lineage})
        targets = [constraint.target.name if getattr(constraint, "target", None) else None for constraint in camera.constraints]
        check(camera.name + "_not_driven_by_rotating_lion", all(target not in {obj.name for obj in [root] + lion_objects if obj} for target in targets))
        camera_details.append({"name": camera.name, "location": vector(location), "type": camera.data.type, "lens": camera.data.lens, "constraints": targets})
        if camera.data.type == "PERSP":
            projected = [world_to_camera_view(scene, camera, point) for obj in lion_geometry for point in corners_world(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))]
            extent = {"min_x": min(point.x for point in projected), "max_x": max(point.x for point in projected), "min_y": min(point.y for point in projected), "max_y": max(point.y for point in projected), "min_depth": min(point.z for point in projected)}
            check(camera.name + "_complete_lion_inside_frame", extent["min_depth"] > 0 and extent["min_x"] >= 0 and extent["max_x"] <= 1 and extent["min_y"] >= 0 and extent["max_y"] <= 1, extent)
    check("main_camera_and_orbit_references", scene.objects.get("Camera_Main") is not None and scene.objects.get("Camera_Target") is not None and scene.objects.get("Camera_OrbitCenter") is not None)
    check("main_camera_initially_active", scene.camera is not None and scene.camera.name == "Camera_Main", scene.camera.name if scene.camera else None)
    report["observations"]["cameras"] = camera_details
    orbit = json.loads(scene.get("web_orbit_limits", "{}"))
    check("web_interaction_bounds_prepared_and_not_claimed_implemented", scene.get("web_interactions_implemented") is False and orbit.get("auto_orbit") is False and 5 <= orbit.get("radius_min", 0) < orbit.get("radius_max", 0) <= 8 and orbit.get("screen_switch_hysteresis_degrees", 0) > 0 and orbit.get("switch_dwell_ms", 0) > 0 and 300 <= orbit.get("brightness_transition_ms", 0) <= 600 and orbit.get("keep_video_time_on_switch") is True and orbit.get("audio_single_primary_only") is True, orbit)
    missing_images = []
    for image in bpy.data.images:
        if image.source in {"VIEWER", "GENERATED"} or image.packed_file:
            continue
        if not image.filepath or not Path(bpy.path.abspath(image.filepath)).is_file():
            missing_images.append({"name": image.name, "filepath": image.filepath, "source": image.source})
    check("no_missing_external_image_resources", not missing_images, missing_images)
    fonts = [{"name": font.name, "filepath": font.filepath, "packed": bool(font.packed_file)} for font in bpy.data.fonts]
    check("preview_fonts_are_packed_or_builtin", all(font["packed"] or font["filepath"] == "<builtin>" for font in fonts), fonts)
    check("no_volume_world_or_scene_fog", not any(node.type in {"VOLUME_SCATTER", "VOLUME_ABSORPTION", "PRINCIPLED_VOLUME"} for material in bpy.data.materials if material.node_tree for node in material.node_tree.nodes))
    report["observations"]["scene_custom_properties"] = {key: value for key, value in scene.items() if key != "_RNA_UI"}
    report["observations"]["lights"] = [{"name": obj.name, "type": obj.data.type, "energy": obj.data.energy, "color": vector(obj.data.color)} for obj in scene.objects if obj.type == "LIGHT"]

    previews = []
    for view in ("Front", "Left", "Right", "Back", "Overview"):
        path = args.preview_dir / ("Preview_" + view + ".png")
        exists = path.is_file()
        width = height = 0
        if exists:
            data = path.read_bytes()
            if data.startswith(b"\x89PNG\r\n\x1a\n"):
                width, height = struct.unpack_from(">II", data, 16)
        check("preview_" + view + "_exists", exists and width >= 1000 and height >= 500, {"path": relative(path), "width": width, "height": height, "bytes": path.stat().st_size if exists else 0})
        if exists:
            previews.append({"path": relative(path), "sha256": sha256(path), "bytes": path.stat().st_size, "width": width, "height": height})
    report["observations"]["previews"] = previews
    provenance = []
    for path in args.preview_dir.glob("render-evidence-*.json"):
        record = json.loads(path.read_text(encoding="utf-8"))
        for render in record.get("renders", []):
            if record.get("reopened_from_disk") and record.get("source_blend_sha256") == sha256(args.blend):
                provenance.append({"evidence_file": relative(path), **render})
    for preview in previews:
        match = next((entry for entry in provenance if entry.get("path") == preview["path"] and entry.get("sha256") == preview["sha256"]), None)
        check("preview_" + Path(preview["path"]).stem + "_final_blend_provenance", match is not None, match)
    report["observations"]["render_provenance"] = provenance
    if args.glb:
        export = inspect_glb(args.glb)
        report["observations"]["glb"] = export
        check("glb_stable_named_screens_and_lion", all(name in export["node_names"] for name in [*SCREENS, "Lion_RotationRoot", "Lion_Model", "Lion_Stage_Base"]))
        check("glb_no_external_uris", not export["external_uris"], export["external_uris"])
        check("glb_embedded_textures", export["image_count"] >= 6 and all(size > 0 for size in export["embedded_image_bytes"]))
        allowed_camera_anchors = {"Camera_OrbitCenter", "Camera_Target"}
        check("glb_no_preview_cameras", export["camera_count"] == 0 and all(not name or not name.startswith("Camera_") or name in allowed_camera_anchors for name in export["node_names"]))
        check("glb_lion_hierarchy", export["parent_names"].get("Lion_Model") == "Lion_RotationRoot")
        check("glb_all_geometry_accessors_indices_finite", not export["geometry_errors"], export["geometry_errors"])
        check("glb_independent_41_mesh_lion_web_lod", export["lion_descendant_mesh_count"] == 41 and export["animation_count"] == 0)
        check("glb_source_sheen_preserved_exactly", not export["source_sheen_mismatches"], {"count": export["source_sheen_material_count"], "mismatches": export["source_sheen_mismatches"]})
        check("glb_y_up_rotation_axis_metadata", export["root_extras"].get("rotation_axis") == "Y" and export["root_extras"].get("authoring_rotation_axis") == "Z", export["root_extras"])
        scene_extras = export["scene_extras"][0] if len(export["scene_extras"]) == 1 else {}
        coordinate_system = scene_extras.get("coordinate_system", "")
        coordinate_matches = "Y_UP" in coordinate_system and "MINUS_Z" in coordinate_system and "BLENDER" not in coordinate_system
        check("glb_scene_declares_exported_y_up_front_minus_z", coordinate_matches, coordinate_system)
        orbit_limits = scene_extras.get("web_orbit_limits", {})
        orbit_limits = json.loads(orbit_limits) if isinstance(orbit_limits, str) else orbit_limits
        declared_target = orbit_limits.get("target", [])
        anchors = export["orbit_anchor_world_positions"]
        anchor_matches = len(declared_target) == 3 and len(anchors) == 2 and all(len(position) == 3 and all(math.isclose(a, b, abs_tol=1e-5) for a, b in zip(declared_target, position)) for position in anchors.values())
        check("glb_orbit_target_metadata_matches_both_actual_world_anchors", anchor_matches, {"declared": declared_target, "actual": anchors})
        check("glb_scene_rotation_and_video_interaction_boundary", scene_extras.get("web_interactions_implemented") is False and orbit_limits.get("auto_orbit") is False and 5 <= orbit_limits.get("radius_min", 0) < orbit_limits.get("radius_max", 0) <= 8 and orbit_limits.get("audio_single_primary_only") is True and orbit_limits.get("keep_video_time_on_switch") is True, orbit_limits)
        authoring_limits = scene_extras.get("authoring_web_orbit_limits", {})
        authoring_limits = json.loads(authoring_limits) if isinstance(authoring_limits, str) else authoring_limits
        source_target = authoring_limits.get("target", [])
        expected_limits = dict(authoring_limits)
        expected_limits["target"] = [source_target[0], source_target[2], -source_target[1]] if len(source_target) == 3 else []
        check("glb_authoring_metadata_separate_and_coordinate_conversion_exact", scene_extras.get("authoring_coordinate_system") == "BLENDER_METERS_Z_UP_FRONT_PLUS_Y" and authoring_limits == orbit and expected_limits == orbit_limits, {"source": authoring_limits, "export": orbit_limits})
        asset_provenance = export["asset_extras"]
        model_extras = export["model_extras"]
        check("glb_provenance_matches_actual_native_and_lod_sources", asset_provenance.get("native_scene_sha256") == sha256(args.blend) and asset_provenance.get("web_lion_source_sha256") == sha256(args.source_glb) and export["root_extras"].get("native_source_sha256") == SOURCE_BLEND_SHA256 and model_extras.get("source_sha256") == sha256(args.source_glb) and model_extras.get("web_lod") is True and model_extras.get("mesh_count") == 41, {"asset": asset_provenance, "model": model_extras})
        expected_centers = {"Screen_Tanqing": [0, 5.3, -9.55], "Screen_Doumao": [9.55, 5.3, 0], "Screen_Tuqiu": [0, 5.3, 9.55], "Screen_Meihuazhuang": [-9.55, 5.3, 0]}
        for name, details in export["screens"].items():
            check(name + "_glb_geometry_normal_uv_and_coordinates", math.isclose(details["width"], 16, abs_tol=1e-4) and math.isclose(details["height"], 9, abs_tol=1e-4) and math.isclose(details["bottom_y"], .8, abs_tol=1e-4) and details["normal_dot_inward"] > .99 and set(details["unit_uv_corners"]) == {(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)} and all(math.isclose(a, b, abs_tol=1e-4) for a, b in zip(details["center_y_up"], expected_centers[name])), details)
            extras = details["extras"]
            declared_normal = extras.get("front_normal_gltf", [])
            declared_normal = json.loads(declared_normal) if isinstance(declared_normal, str) else declared_normal
            actual_normal = details["normal_y_up"]
            check(name + "_glb_declared_normal_matches_actual_exported_normal", len(declared_normal) == 3 and all(math.isclose(a, b, abs_tol=1e-5) for a, b in zip(declared_normal, actual_normal)), {"declared": declared_normal, "actual": actual_normal})
            front_normal = extras.get("screen_front_normal", [])
            front_normal = json.loads(front_normal) if isinstance(front_normal, str) else front_normal
            source_normal = extras.get("authoring_screen_front_normal", [])
            source_normal = json.loads(source_normal) if isinstance(source_normal, str) else source_normal
            mapped_source_normal = [source_normal[0], source_normal[2], -source_normal[1]] if len(source_normal) == 3 else []
            normal_note = extras.get("coordinate_note", "")
            check(name + "_glb_source_normal_is_clearly_labeled_and_consistent", "authoring_screen_front_normal" in normal_note and "Blender" in normal_note and "glTF" in normal_note and len(mapped_source_normal) == 3 and len(front_normal) == 3 and all(math.isclose(a, b, abs_tol=1e-5) and math.isclose(c, b, abs_tol=1e-5) for a, b, c in zip(mapped_source_normal, actual_normal, front_normal)), {"note": normal_note, "source": source_normal, "export": front_normal})
            title, resource_key, _ = SCREENS[name]
            check(name + "_glb_action_resource_and_display_state_metadata", extras.get("action_title") == title and extras.get("video_resource_key") == resource_key and extras.get("is_placeholder") is True and extras.get("video_path") == "" and extras.get("resource_status") == "MISSING_VERIFIED_ACTION_VIDEO" and extras.get("primary_state") == ("PRIMARY" if name == "Screen_Tanqing" else "SECONDARY") and math.isclose(extras.get("display_brightness", 0), 1 if name == "Screen_Tanqing" else .25), extras)
        primary = export["screens"]["Screen_Tanqing"]["effective_emission"]
        check("glb_one_primary_three_dim_nonblack", all(all(0 < value and math.isclose(value, main * .25, rel_tol=1e-5) for value, main in zip(details["effective_emission"], primary)) for name, details in export["screens"].items() if name != "Screen_Tanqing"))
        check("glb_lion_floor_contact_and_bounded_size", abs(export["lion_bounds_y_up"]["min"][1] - .22) < .005 and export["lion_bounds_y_up"]["max"][1] < 2.3 and export["lion_bounds_y_up"]["max"][1] > 2.2, export["lion_bounds_y_up"])
    report["blend_file"] = {"path": relative(args.blend), "sha256": sha256(args.blend), "bytes": args.blend.stat().st_size}
    report["passed"] = all(item["passed"] for item in report["checks"])
    report["check_count"] = len(report["checks"])
    report["failed_checks"] = [item["name"] for item in report["checks"] if not item["passed"]]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("THEATER_VALIDATION", json.dumps({"passed": report["passed"], "checks": report["check_count"], "failed": report["failed_checks"], "report": relative(args.output)}))
    if not report["passed"]:
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-only", action="store_true")
    parser.add_argument("--baseline", type=Path, default=BASELINE)
    parser.add_argument("--source-glb", type=Path, default=SOURCE_GLB)
    parser.add_argument("--source-blend", type=Path, default=SOURCE_BLEND)
    parser.add_argument("--blend", type=Path, default=FINAL_BLEND)
    parser.add_argument("--preview-dir", type=Path, default=PREVIEWS)
    parser.add_argument("--output", type=Path, default=REPORT)
    parser.add_argument("--glb", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if args.baseline_only:
        create_baseline(args)
    else:
        validate(args)


if __name__ == "__main__":
    main()
