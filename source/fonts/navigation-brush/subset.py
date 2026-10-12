"""Create the navigation WOFF from an unmodified Slideqiuhong-Regular.ttf.

Requires fontTools. Run from the project root; see README.md for the source.
"""
import argparse
import re
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("font", type=Path, help="Path to Slideqiuhong-Regular.ttf")
args = parser.parse_args()

# Keep the text editable in React. Include every Chinese character used by
# the chapter configuration, settings entry and brand, plus ordinary ASCII.
sources = [
    ROOT / "src/config/chapters.js",
    ROOT / "src/components/ChapterNav.jsx",
    ROOT / "src/components/BrandLockup.jsx",
]
characters = set("0123456789")
for source in sources:
    characters.update(re.findall(r"[\u3400-\u9fff]", source.read_text(encoding="utf-8")))

font = TTFont(args.font, recalcTimestamp=False)
available = set(map(chr, font.getBestCmap()))
missing = characters - available
if missing:
    raise ValueError(f"Source font is missing required characters: {sorted(missing)}")
characters.update(chr(code) for code in range(32, 127) if chr(code) in available)

options = subset.Options()
options.name_IDs = ["*"]
options.name_legacy = True
options.name_languages = ["*"]
subsetter = subset.Subsetter(options=options)
subsetter.populate(text="".join(sorted(characters)))
subsetter.subset(font)

# Identify this subset independently while preserving copyright and license.
names = {1: "Nanfeng Navigation Brush", 2: "Regular",
         3: "Nanfeng Navigation Brush Regular 1.0", 4: "Nanfeng Navigation Brush Regular",
         6: "NanfengNavigationBrush-Regular", 16: "Nanfeng Navigation Brush", 17: "Regular"}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font.flavor = "woff"
output = ROOT / "source/public/assets/fonts/nanfeng-navigation-brush.woff"
output.parent.mkdir(parents=True, exist_ok=True)
font.save(output)
print(f"Wrote {output.name}: {len(characters)} characters, {output.stat().st_size} bytes")
