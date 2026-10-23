"""Accepted local content must not masquerade as a verified HTTP download."""
import json
import hashlib
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import apply_replacements
from pipeline import connect


class ReplacementTest(unittest.TestCase):
    def fixture(self, root):
        (root/'scripts').mkdir(parents=True)
        for name in ('measure.py', 'pipeline.py'):
            (root/'scripts'/name).write_text('historical analyzer')
        (root/'config.json').write_text(json.dumps({'activity': {}, 'loudness': {}}))
        audio = root/'new.mp3'; audio.write_bytes(b'accepted audio bytes')
        digest = hashlib.sha256(audio.read_bytes()).hexdigest()
        old = dict(schema_version='1.0.0', source_id='maleki', ordinal=384, surah=3, ayah=91,
                   verse_id='3:91', file_stem='003091', juz=3, url='https://example.test/003091.mp3',
                   status='invalid', download_sha256='e'*64, http={'http_status': 200, 'response_bytes': 0})
        conn=connect(root)
        with conn:conn.execute('INSERT INTO records VALUES (?,?,?,?,?)', ('maleki',384,'invalid','old',json.dumps(old)))
        conn.close()
        item=dict(source_id='maleki', verse_id='3:91', stem='003091', path='new.mp3',
                  replacement_for_url=old['url'], measured={'sha256':digest}, url='https://example.test/full.mp3',
                  method='stream_copy_excerpt', reference_download_sha256='f'*64)
        manifest=root/'manifest.json';manifest.write_text(json.dumps({'files':[item]}))
        measured={'sha256':digest, 'loudness':{'integrated_lufs':-20,'true_peak_dbtp':-4},'decoder_warnings':[]}
        return manifest, measured

    def adopt(self, root, manifest, measured):
        with patch.object(apply_replacements,'measure',return_value=measured), \
             patch.object(apply_replacements.subprocess,'check_output',return_value='same tool version'), \
             patch.object(apply_replacements,'export'):
            return apply_replacements.apply(root, manifest, 'User explicitly accepted this package')

    def test_acceptance_preserves_history_and_does_not_claim_publication(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);manifest,measured=self.fixture(root)
            self.assertEqual(len(self.adopt(root,manifest,measured)),1)
            with sqlite3.connect(root/'checkpoints/state.sqlite3') as conn:
                record=json.loads(conn.execute('SELECT payload FROM records').fetchone()[0])
                self.assertEqual(conn.execute('SELECT count(*) FROM events').fetchone()[0],1)
            self.assertEqual(record['status'],'success')
            self.assertNotIn('http',record)
            self.assertFalse(record['content_replacement']['canonical_url_publication']['verified'])
            self.assertEqual(record['content_replacement']['previous_status'],'invalid')
            history=list((root/'replacement-history/maleki').glob('*.json'))
            self.assertEqual(len(history),1)
            self.assertEqual(json.loads(history[0].read_text())['http']['response_bytes'],0)
            publication=json.loads((root/'reports/replacement-publication.json').read_text())
            self.assertEqual(publication['pending_publication_count'],1)
            self.assertEqual(self.adopt(root,manifest,measured),[])
            with sqlite3.connect(root/'checkpoints/state.sqlite3') as conn:
                self.assertEqual(conn.execute('SELECT count(*) FROM events').fetchone()[0],1)

    def test_changed_bytes_and_corrupt_decodes_do_not_replace_the_record(self):
        for mode in ('hash','decoder'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as folder:
                root=Path(folder);manifest,measured=self.fixture(root)
                if mode=='hash':(root/'new.mp3').write_bytes(b'wrong bytes')
                else:measured['decoder_warnings']=['Error while decoding MPEG audio frame']
                with self.assertRaises(ValueError):self.adopt(root,manifest,measured)
                with sqlite3.connect(root/'checkpoints/state.sqlite3') as conn:
                    self.assertEqual(conn.execute('SELECT status FROM records').fetchone()[0],'invalid')
                    self.assertEqual(conn.execute('SELECT count(*) FROM events').fetchone()[0],0)


if __name__=='__main__':unittest.main()
