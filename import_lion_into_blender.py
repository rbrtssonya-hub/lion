import bpy
from pathlib import Path

source = Path(r"F:\数媒竞赛\模型\lux3d_model_exports\img23d_21199.glb")
target = Path(r"F:\数媒竞赛\模型\img23d_21199_导入版.blend")

if not source.is_file():
    raise FileNotFoundError(f"GLB not found: {source}")

bpy.ops.import_scene.gltf(filepath=str(source))

for obj in bpy.context.selected_objects:
    if obj.type == "MESH":
        obj.name = "LionHead_Overall"
        obj.data.name = "LionHead_Overall_Mesh"

bpy.ops.wm.save_as_mainfile(filepath=str(target))
print(f"Imported: {source}")
print(f"Saved: {target}")
