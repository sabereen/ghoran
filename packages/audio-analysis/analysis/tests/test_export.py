"""A release must not bless an empty measurement stream or broken gzip."""
import contextlib
import gzip
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import export_package


class ExportReleaseTest(unittest.TestCase):
    def fixture(self, root):
        for folder in ('reports', 'metadata', 'measurements', 'recommendations/-20', 'segments', 'anomalies'):
            (root / folder).mkdir(parents=True, exist_ok=True)
        (root / 'sources.json').write_text('{}')
        (root / 'profiles.json').write_text('{}')
        (root / 'metadata/verses.json').write_text('[]')
        (root / 'reports/progress.json').write_text(json.dumps({'coverage': [
            {'source_id': 'fixture', 'expected': 1, 'unprocessed': 0}]}))
        (root / 'measurements/fixture.jsonl').write_text('{"ordinal":1}\n')
        (root / 'recommendations/-20/fixture.compact.json.gz').write_bytes(gzip.compress(b'{"values":[]}'))

    def test_closed_gzip_and_manifest_match_the_actual_export(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'analysis'; self.fixture(root)
            output = Path(folder) / 'consumer'
            with patch.object(export_package, 'ROOT', root), contextlib.redirect_stdout(io.StringIO()):
                export_package.main(output)
            files = json.loads((output / 'manifest.sha256.json').read_text())['files']
            for name, digest in files.items():
                content = (output / name).read_bytes()
                self.assertEqual(hashlib.sha256(content).hexdigest(), digest)
                if name.endswith('.gz'):
                    gzip.decompress(content)
            self.assertEqual(gzip.decompress((output / 'measurements/fixture.jsonl.gz').read_bytes()), b'{"ordinal":1}\n')

    def test_empty_measurements_never_publish_a_new_manifest(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'analysis'; self.fixture(root)
            (root / 'measurements/fixture.jsonl').write_text('')
            output = Path(folder) / 'consumer'
            with patch.object(export_package, 'ROOT', root), self.assertRaisesRegex(AssertionError, 'Incomplete measurement'):
                export_package.main(output)
            self.assertFalse((output / 'manifest.sha256.json').exists())


if __name__ == '__main__':
    unittest.main()
