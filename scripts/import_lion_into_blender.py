"""Import a GLB into Blender and save an editable project.

Run with Blender's Python: blender --background --python
scripts/import_lion_into_blender.py -- --input <file.glb> --output <file.blend>
Relative paths are resolved from this repository root.
"""

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def project_path(value):
    path = Path(value).expanduser()
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', default='source/models/img23d_21199_优化版.glb')
    parser.add_argument('--output', default='source/models/lion-overall.blend')
    arguments = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    options = parser.parse_args(arguments)
    source = project_path(options.input)
    target = project_path(options.output)

    if not source.is_file():
        raise FileNotFoundError(f'GLB not found: {source}')

    import bpy  # Available inside Blender's bundled Python.

    bpy.ops.import_scene.gltf(filepath=str(source))
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            obj.name = 'LionHead_Overall'
            obj.data.name = 'LionHead_Overall_Mesh'

    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    print(f'Imported: {source}')
    print(f'Saved: {target}')


if __name__ == '__main__':
    main()
