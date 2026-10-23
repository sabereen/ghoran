"""Export separately loadable consumer data from a completed analysis snapshot."""
import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT.parent


def atomic_bytes(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as f:
        temporary = Path(f.name)
        f.write(content)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def atomic_gzip(path, content):
    # Keep a stable logical filename and header across Python versions. This
    # also preserves existing, unchanged consumer streams byte-for-byte.
    buffer = io.BytesIO()
    with gzip.GzipFile(filename=path.name.removesuffix('.gz'), mode='wb', fileobj=buffer, mtime=0) as output:
        output.write(content)
    compressed = buffer.getvalue()
    assert gzip.decompress(compressed) == content
    atomic_bytes(path, compressed)


def build_export(data):
    for relative, name in [('sources.json', 'sources.json'), ('profiles.json', 'profiles.json'), ('reports/progress.json', 'coverage.json')]:
        data.mkdir(parents=True, exist_ok=True)
        atomic_bytes(data / name, (ROOT / relative).read_bytes())
    atomic_gzip(data/'verses.json.gz', (ROOT/'metadata/verses.json').read_bytes())
    coverage = {r['source_id']: r for r in json.loads((ROOT/'reports/progress.json').read_text())['coverage']}
    publication = ROOT / 'reports/replacement-publication.json'
    if publication.exists():
        atomic_bytes(data / 'replacement-publication.json', publication.read_bytes())
    for source in (ROOT / 'measurements').glob('*.jsonl'):
        target = data / 'measurements' / (source.name + '.gz')
        target.parent.mkdir(parents=True, exist_ok=True)
        content = source.read_bytes()
        expected = coverage[source.stem]['expected'] - coverage[source.stem]['unprocessed']
        assert len(content.splitlines()) == expected, 'Incomplete measurement export: ' + source.stem
        atomic_gzip(target, content)
    for source in (ROOT / 'recommendations').glob('*/*.compact.json.gz'):
        target = data / 'recommendations' / source.parent.name / source.name.replace('.compact', '')
        target.parent.mkdir(parents=True, exist_ok=True)
        compressed = source.read_bytes()
        content = gzip.decompress(compressed)
        json.loads(content)
        atomic_bytes(target, compressed)
        atomic_bytes(target.with_suffix(''), content)
    for source in (ROOT / 'segments').glob('*.json'):
        target=data/'segments'/source.name;target.parent.mkdir(parents=True,exist_ok=True)
        atomic_bytes(target, source.read_bytes())
    for source in (ROOT / 'anomalies').glob('*.jsonl'):
        target=data/'anomalies'/(source.name+'.gz');target.parent.mkdir(parents=True,exist_ok=True)
        atomic_gzip(target, source.read_bytes())
    manifest={'schema_version':'1.0.0','files':{str(p.relative_to(data)):hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(data.rglob('*')) if p.is_file() and p.name!='manifest.sha256.json'}}
    # Publish the manifest last, after checking closed bytes on disk. A partially
    # written gzip or empty source stream must never become a valid release.
    for path in data.rglob('*.gz'):
        gzip.decompress(path.read_bytes())
    atomic_bytes(data/'manifest.sha256.json', (json.dumps(manifest,indent=2)+'\n').encode())
    return manifest


def main(output=None):
    package_file = PACKAGE/'package.json'
    in_ghoran = package_file.exists() and json.loads(package_file.read_text()).get('name') == '@ghoran/audio'
    destination = output.resolve() if output else PACKAGE/'data' if in_ghoran else ROOT/'consumer-data'
    # Build and validate in private storage, then install closed bytes. Keep the
    # staged hashes rather than blessing whatever happens to be at destination.
    with tempfile.TemporaryDirectory(prefix='quran-consumer-export-') as folder:
        staging = Path(folder)
        manifest = build_export(staging)
        for name, expected in manifest['files'].items():
            content = (staging/name).read_bytes()
            assert hashlib.sha256(content).hexdigest() == expected
            atomic_bytes(destination/name, content)
        for name, expected in manifest['files'].items():
            assert hashlib.sha256((destination/name).read_bytes()).hexdigest() == expected, 'Export changed while installing: ' + name
        atomic_bytes(destination/'manifest.sha256.json', (staging/'manifest.sha256.json').read_bytes())
    print(json.dumps({'data': str(destination), 'measured_sources': len(list((destination/'measurements').glob('*.gz')))}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path)
    main(parser.parse_args().output)
