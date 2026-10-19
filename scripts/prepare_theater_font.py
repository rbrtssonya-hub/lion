"""Build the packed theater-label font from the existing OFL Slideqiuhong TTF.

Usage: python scripts/prepare_theater_font.py path/to/Slideqiuhong-Regular.ttf
Requires fontTools. The source font and the website navigation font stay intact.
"""
import argparse
import hashlib
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'source/fonts/immersive-theater/nanfeng-theater-labels.ttf'
SOURCE_GIT_BLOB = 'ff0353c03b1dae981861d3d8b94effd31c9d8a8b'
LABELS = '探青采青抖毛狮子吐球踩梅花桩真实动作视频待替换'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    source = args.source.read_bytes()
    blob = hashlib.sha1(b'blob ' + str(len(source)).encode('ascii') + b'\0' + source).hexdigest()
    if blob != SOURCE_GIT_BLOB:
        raise ValueError('Source must match the Slideqiuhong TTF recorded in source/fonts/navigation-brush/README.md')
    font = TTFont(args.source, recalcTimestamp=False)
    available = font.getBestCmap()
    # The upstream font omits '*'; that character is not used by these labels.
    required = set(LABELS + '0123456789 /:.xBLOCKOUT PLACEHOLDER TANQING CAIQING DOUMAO SHIZI TUQIU MEIHUAZHUANGm')
    missing = required - {chr(code) for code in available}
    if missing:
        raise ValueError(f'Source font is missing required glyphs: {sorted(missing)}')
    required.update(chr(code) for code in range(32, 127) if code in available)
    options = subset.Options()
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    worker = subset.Subsetter(options=options)
    worker.populate(text=''.join(sorted(required)))
    worker.subset(font)
    names = {1: 'Nanfeng Theater Labels', 2: 'Regular',
             3: 'Nanfeng Theater Labels Regular 1.0', 4: 'Nanfeng Theater Labels Regular',
             6: 'NanfengTheaterLabels-Regular', 16: 'Nanfeng Theater Labels', 17: 'Regular'}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open('xb') as stream:
        font.save(stream)
    print(f'Wrote {OUTPUT.relative_to(ROOT).as_posix()}: {len(required)} codepoints, {OUTPUT.stat().st_size} bytes')


if __name__ == '__main__':
    main()
