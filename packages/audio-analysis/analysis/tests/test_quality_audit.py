import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from quality_audit import audit, hard_decode_errors
from pipeline import connect


class QualityAuditTests(unittest.TestCase):
    def test_metadata_errors_are_not_partial_audio_decodes(self):
        self.assertEqual(hard_decode_errors(["Error reading comment frame, skipped", "Error reading lyrics, skipped"]), [])
        self.assertEqual(len(hard_decode_errors(["Error while decoding MPEG audio frame."])), 1)

    def test_quarantine_is_idempotent_and_preserves_original_event(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); conn = connect(root)
            record = {"source_id": "fixture", "verse_id": "4:94", "status": "success", "http": {"downloaded_bytes": 123},
                      "measured": {"decoder_warnings": ["Error while decoding MPEG audio frame."], "sha256": "a"*64}}
            original = json.dumps(record)
            conn.execute("INSERT INTO records VALUES (?,?,?,?,?)", ("fixture", 1, "success", "fp", original))
            conn.execute("INSERT INTO events(at,source,verse,status,payload) VALUES (?,?,?,?,?)", ("test", "fixture", 1, "success", original))
            conn.commit(); conn.close()
            self.assertEqual(len(audit(root)), 1)
            self.assertEqual(audit(root), [])
            conn = connect(root)
            new = json.loads(conn.execute("SELECT payload FROM records").fetchone()[0])
            self.assertEqual(new["status"], "invalid")
            self.assertEqual(new["measured"]["sha256"], "a"*64)
            self.assertEqual(conn.execute("SELECT count(*) FROM events").fetchone()[0], 2)
            self.assertEqual(conn.execute("SELECT payload FROM events ORDER BY id LIMIT 1").fetchone()[0], original)
            conn.close()


if __name__ == "__main__":
    unittest.main()
