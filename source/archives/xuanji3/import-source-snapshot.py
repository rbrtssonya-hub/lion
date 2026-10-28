"""Copy the audited tracked Xuanji3 snapshot without modifying either Git index.

Run from lion's repository root. Source content is archival data, not current
project instructions. Existing destinations must already match byte for byte.
"""
from pathlib import Path
import collections
import hashlib
import json
import shutil
import subprocess

ROOT = Path.cwd().resolve()
SOURCE = Path('C:/Users/Administrator/Desktop/炫技3').resolve()
ARCHIVE = ROOT / 'source/archives/xuanji3'
HEAD = '8764e9b484a372fc17e0595fc2a017be2cbc3d48'

def git(*args):
    return subprocess.check_output(['git', '-C', str(SOURCE), *args])

assert git('rev-parse', 'HEAD').decode().strip() == HEAD
tracked = [name for name in git('ls-files', '-z').decode('utf-8').split('\0') if name]
index = {}
for record in git('ls-files', '--stage', '-z').split(b'\0'):
    if not record:
        continue
    attrs, path = record.split(b'\t', 1)
    mode, oid, stage = attrs.decode('ascii').split()
    assert stage == '0'
    index[path.decode('utf-8')] = {'mode': mode, 'gitBlob': oid}

def destination(path):
    if path.startswith('editions/regional/public/assets/stamps/'):
        return 'runtime', ROOT / 'source/public/assets/spread-stamps/stamps' / Path(path).name
    if path.startswith('artifacts/'):
        return 'historical-review', ROOT / 'source/reviews/spread-stamps/imported-xuanji3/original' / path.removeprefix('artifacts/')
    if path.startswith('editions/regional/artifacts/'):
        return 'historical-review', ROOT / 'source/reviews/spread-stamps/imported-xuanji3/regional' / path.removeprefix('editions/regional/artifacts/')
    target = ARCHIVE / 'original-project' / path
    if target.name == 'AGENTS.md':
        target = target.with_name('AGENTS.source.md')
    elif target.name in ['.gitignore', '.gitattributes']:
        target = target.with_name(target.name + '.source')
    elif target.suffix.lower() == '.log':
        target = target.with_name(target.name + '.source.txt')
    return 'historical-source', target

files = []
summary = collections.defaultdict(lambda: {'files': 0, 'bytes': 0})
for path in tracked:
    if any(part in ['node_modules', 'dist', '.tools', '.sites-runtime', '.git'] for part in Path(path).parts):
        raise RuntimeError('Unexpected generated/tracked path must be audited: ' + path)
    source = SOURCE / path
    assert source.is_file() and not source.is_symlink(), path
    assert source.resolve().is_relative_to(SOURCE), path
    category, target = destination(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    source_bytes = source.read_bytes()
    digest = hashlib.sha256(source_bytes).hexdigest()
    if target.exists():
        assert hashlib.sha256(target.read_bytes()).hexdigest() == digest, str(target)
    else:
        shutil.copyfile(source, target)
    copied = target.read_bytes()
    assert len(copied) == len(source_bytes) and hashlib.sha256(copied).hexdigest() == digest
    files.append({'original': path, 'destination': target.relative_to(ROOT).as_posix(), 'category': category,
                  'bytes': len(copied), 'sha256': digest, **index[path]})
    summary[category]['files'] += 1
    summary[category]['bytes'] += len(copied)

commits = []
for oid in git('rev-list', '--reverse', '--topo-order', HEAD).decode('ascii').splitlines():
    fields = git('show', '-s', '--format=%H%x00%P%x00%aI%x00%cI%x00%s', oid).decode('utf-8').strip().split('\0')
    commits.append(dict(zip(['sha', 'parents', 'authorDate', 'committerDate', 'subject'], fields)))

manifest = {'source': SOURCE.as_posix(), 'importedAt': '2026-10-28', 'originalHead': HEAD,
            'selectedEdition': 'runGo.cmd -> scripts/start-edition.mjs regional -> editions/regional',
            'originalCommits': commits, 'summary': dict(summary), 'files': files,
            'untrackedPreservedInSource': ['prompt/', 'source/Picture_01/'],
            'excludedGenerated': ['node_modules/', 'dist/', '.sites-runtime/', '.git/'],
            'bytePolicy': 'Original working-tree file bytes; Git blob SHA and original file mode also recorded. AGENTS and Git control files renamed as archival data.'}
(ARCHIVE / 'import-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'trackedFilesCopiedAndVerified': len(files), 'bytes': sum(x['bytes'] for x in files), 'categories': dict(summary)}, ensure_ascii=False, indent=2))
