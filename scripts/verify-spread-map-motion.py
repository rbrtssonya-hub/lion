"""Compare every encoded video frame with the corresponding Blender render.

python scripts/verify-spread-map-motion.py FRAME_DIR FORWARD_MP4 REVERSE_MP4 FFMPEG FFPROBE OUTPUT_JSON [--fps=60]
"""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image

frames, forward, reverse, ffmpeg, ffprobe, output = sys.argv[1:7]
options = sys.argv[7:]
if any(option not in ('--fps=24', '--fps=60') for option in options) or len(options) > 1:
    raise ValueError('Expected optional --fps=24 or --fps=60')
fps = 60 if options == ['--fps=60'] else 24
count = 510 if fps == 60 else 204
frames = Path(frames)
results = {}
for name, path, backwards in [('forward', forward, False), ('reverse', reverse, True)]:
    probe = json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames', '-of', 'json', path]))['streams'][0]
    assert (probe['width'], probe['height'], probe['r_frame_rate'], int(probe['nb_read_frames'])) == (1000, 650, f'{fps}/1', count), probe
    decoder = subprocess.Popen([ffmpeg, '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    scores = []
    for i in range(count):
        size = 1000 * 650 * 3
        decoded = bytearray()
        while len(decoded) < size:
            block = decoder.stdout.read(size - len(decoded))
            if not block:
                raise RuntimeError(f'{name}: truncated at frame {i + 1}')
            decoded.extend(block)
        video = np.frombuffer(decoded, dtype=np.uint8).reshape((650, 1000, 3))
        source_frame = count - i if backwards else i + 1
        with Image.open(frames / f'{source_frame:04d}.png') as image:
            original = np.asarray(image.convert('RGB'))
        mean = float(np.abs(video.astype(np.int16) - original.astype(np.int16)).mean())
        scores.append(mean)
    assert decoder.stdout.read(1) == b'', f'{name}: unexpected extra frames'
    assert decoder.wait() == 0
    assert max(scores) < 5, (name, max(scores))
    sample_frames = [1, 45, 100, 150, 204] if fps == 24 else [1, 52, 53, 250, 400, 510]
    results[name] = {'probe': probe, 'mean_absolute_rgb_error': sum(scores) / len(scores), 'max_frame_mean_absolute_rgb_error': max(scores), 'frames_checked': len(scores), 'samples': {str(n): scores[n - 1] for n in sample_frames}}
comparison = f'decoded RGB versus Blender PNG, mean absolute per-channel error; reverse compares against sequence frame {count + 1}-n'
Path(output).write_bytes((json.dumps({'status': 'passed', 'comparison': comparison, 'videos': results}, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print(json.dumps(results, ensure_ascii=False))
