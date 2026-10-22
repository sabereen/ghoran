"""Export separately loadable consumer data from a completed analysis snapshot."""
import gzip
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT.parent


def main():
    data = PACKAGE / 'data'
    for relative, name in [('sources.json', 'sources.json'), ('profiles.json', 'profiles.json'), ('reports/progress.json', 'coverage.json')]:
        data.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / relative, data / name)
    for source in (ROOT / 'measurements').glob('*.jsonl'):
        target = data / 'measurements' / (source.name + '.gz')
        target.parent.mkdir(parents=True, exist_ok=True)
        with gzip.GzipFile(filename=str(target), mode='wb', mtime=0) as f:
            f.write(source.read_bytes())
    for source in (ROOT / 'recommendations').glob('*/*.compact.json.gz'):
        target = data / 'recommendations' / source.parent.name / source.name.replace('.compact', '')
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        with gzip.open(source, 'rt') as f:
            target.with_suffix('').write_text(f.read())
    print(json.dumps({'data': str(data), 'measured_sources': len(list((data / 'measurements').glob('*.gz')))}))


if __name__ == '__main__':
    main()
