"""Decode and measure the eight local narration WAVs using Python's standard library."""

from array import array
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]
IDS = ['joy', 'anger', 'sorrow', 'delight', 'motion', 'stillness', 'surprise', 'doubt']
results = []

for state_id in IDS:
    path = ROOT / 'public' / 'audio' / f'{state_id}.wav'
    with wave.open(str(path), 'rb') as reader:
        frame_count = reader.getnframes()
        sample_rate = reader.getframerate()
        channels = reader.getnchannels()
        sample_width = reader.getsampwidth()
        compression = reader.getcomptype()
        frames = reader.readframes(frame_count)
    assert sample_width == 2, f'{state_id}: expected 16-bit PCM'
    assert len(frames) == frame_count * channels * sample_width, f'{state_id}: truncated WAV'
    samples = array('h', frames)
    if sys.byteorder != 'little':
        samples.byteswap()
    peak = max(abs(sample) for sample in samples)
    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    duration = frame_count / sample_rate
    active_samples = sum(abs(sample) > 327 for sample in samples)
    clipping_samples = sum(abs(sample) >= 32767 for sample in samples)
    result = {
        'id': state_id,
        'file': str(path.relative_to(ROOT)).replace('\\', '/'),
        'decode': 'PASS: Python wave read all PCM frames',
        'durationSeconds': round(duration, 4),
        'sampleRateHz': sample_rate,
        'channels': channels,
        'bitDepth': sample_width * 8,
        'frameCount': frame_count,
        'compression': compression,
        'peakDbfs': round(20 * math.log10(peak / 32768), 2) if peak else None,
        'rmsDbfs': round(20 * math.log10(rms / 32768), 2) if rms else None,
        'activeSampleRatioAboveMinus40Dbfs': round(active_samples / len(samples), 4),
        'clippedSamples': clipping_samples,
        'bytes': path.stat().st_size,
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'checks': {
            'duration8To15Seconds': 8 <= duration <= 15,
            'duration8To12Point5Seconds': 8 <= duration <= 12.5,
            'pcm24kHz16BitMono': sample_rate == 24000 and channels == 1 and sample_width == 2 and compression == 'NONE',
            'nonSilent': rms > 327 and active_samples / len(samples) > 0.1,
            'noDigitalClipping': clipping_samples == 0,
        },
    }
    result['passed'] = all(result['checks'].values())
    results.append(result)

report = {
    'validatedAt': datetime.now(timezone.utc).isoformat(),
    'method': 'Full PCM decode via Python standard-library wave; sample-level RMS and peak dBFS, duration, silence ratio, digital clipping and SHA-256. RMS is measured over the entire clip including pauses; no LUFS claim.',
    'samplePlayback': 'public/audio/joy.wav',
    'allPassed': all(result['passed'] for result in results),
    'files': results,
}
destination = ROOT / 'review' / 'v5' / 'audio-validation.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
sys.exit(0 if report['allPassed'] else 1)
