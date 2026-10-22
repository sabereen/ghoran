"""Export separately loadable consumer data from a completed analysis snapshot."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT.parent


def main(output=None):
    package_file=PACKAGE/'package.json'
    in_ghoran=package_file.exists() and json.loads(package_file.read_text()).get('name')=='@ghoran/audio-analysis'
    data = output.resolve() if output else PACKAGE/'data' if in_ghoran else ROOT/'consumer-data'
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
    for source in (ROOT / 'segments').glob('*.json'):
        target=data/'segments'/source.name;target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,target)
    for source in (ROOT / 'anomalies').glob('*.jsonl'):
        target=data/'anomalies'/(source.name+'.gz');target.parent.mkdir(parents=True,exist_ok=True)
        with gzip.GzipFile(filename=str(target),mode='wb',mtime=0) as f:
            f.write(source.read_bytes())
    manifest={'schema_version':'1.0.0','files':{str(p.relative_to(data)):hashlib.sha256(p.read_bytes()).hexdigest()
              for p in sorted(data.rglob('*')) if p.is_file() and p.name!='manifest.sha256.json'}}
    (data/'manifest.sha256.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'data': str(data), 'measured_sources': len(list((data / 'measurements').glob('*.gz')))}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path)
    main(parser.parse_args().output)
