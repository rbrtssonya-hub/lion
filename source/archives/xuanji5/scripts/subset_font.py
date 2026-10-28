"""Subset the installed open-source LXGW WenKai font to the interface text."""
from pathlib import Path
from fontTools import subset

root = Path(__file__).resolve().parents[1]
source = Path('C:/Windows/Fonts/LXGWWenKai-Regular.ttf')
text = ''.join(p.read_text(encoding='utf-8') for p in (root/'src').rglob('*') if p.suffix in ['.jsx', '.js', '.css', '.mjs'])
options = subset.Options()
options.flavor = 'woff2'
font = subset.load_font(str(source), options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=text)
subsetter.subset(font)
target = root/'public/fonts/atlas-serif.woff2'
target.parent.mkdir(parents=True, exist_ok=True)
subset.save_font(font, str(target), options)
print(f'{target}: {target.stat().st_size:,} bytes')
