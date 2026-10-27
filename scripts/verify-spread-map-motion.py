"""Compare every encoded video frame with the corresponding Blender render.

python scripts/verify-spread-map-motion.py FRAME_DIR FORWARD_MP4 REVERSE_MP4 FFMPEG FFPROBE OUTPUT_JSON
"""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image

frames, forward, reverse, ffmpeg, ffprobe, output = sys.argv[1:]
frames = Path(frames)
results = {}
for name, path, backwards in [('forward', forward, False), ('reverse', reverse, True)]:
    probe = json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_frames', '-of', 'json', path]))['streams'][0]
    assert (probe['width'], probe['height'], probe['r_frame_rate'], int(probe['nb_read_frames'])) == (1000, 650, '24/1', 204), probe
    decoder = subprocess.Popen([ffmpeg, '-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    scores = []
    for i in range(204):
        size = 1000 * 650 * 3
        decoded = bytearray()
        while len(decoded) < size:
            block = decoder.stdout.read(size - len(decoded))
            if not block:
                raise RuntimeError(f'{name}: truncated at frame {i + 1}')
            decoded.extend(block)
        video = np.frombuffer(decoded, dtype=np.uint8).reshape((650, 1000, 3))
        source_frame = 204 - i if backwards else i + 1
        with Image.open(frames / f'{source_frame:04d}.png') as image:
            original = np.asarray(image.convert('RGB'))
        mean = float(np.abs(video.astype(np.int16) - original.astype(np.int16)).mean())
        scores.append(mean)
    assert decoder.stdout.read(1) == b'', f'{name}: unexpected extra frames'
    assert decoder.wait() == 0
    assert max(scores) < 5, (name, max(scores))
    results[name] = {'probe': probe, 'mean_absolute_rgb_error': sum(scores) / len(scores), 'max_frame_mean_absolute_rgb_error': max(scores), 'frames_checked': len(scores), 'samples': {str(n): scores[n - 1] for n in [1, 45, 100, 150, 204]}}
Path(output).write_bytes((json.dumps({'status': 'passed', 'comparison': 'decoded RGB versus Blender PNG, mean absolute per-channel error; reverse compares against source frame 205-n', 'videos': results}, ensure_ascii=False, indent=2) + '\n').encode('utf-8'))
print(json.dumps(results, ensure_ascii=False))
