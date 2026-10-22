import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]


class ResumeTests(unittest.TestCase):
    def test_resume_conditional_get_and_changed_url_bytes(self):
        state = {"requests": 0, "version": 1}
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                state["requests"] += 1
                etag = '"v' + str(state["version"]) + '"'
                if self.headers.get("If-None-Match") == etag:
                    self.send_response(304); self.end_headers(); return
                buffer = io.BytesIO()
                t = np.arange(48000) / 48000
                wavfile.write(buffer, 48000, (state["version"] * .05 * np.sin(2*np.pi*1000*t)).astype(np.float32))
                data = buffer.getvalue()
                self.send_response(200); self.send_header("Content-Length", str(len(data)))
                self.send_header("ETag", etag); self.end_headers(); self.wfile.write(data)
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True); worker.start()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp); (root / "metadata").mkdir()
                (root / "config.json").write_text((ROOT / "config.json").read_text())
                verses = [{"ordinal": i, "surah": 1, "ayah": i, "juz": 1, "verse_id": f"1:{i}", "file_stem": f"00100{i}"} for i in [1, 2]]
                (root / "metadata" / "verses.json").write_text(json.dumps(verses))
                (root / "sources.json").write_text(json.dumps({"sources": [{"id": "fixture", "url_template": f"http://127.0.0.1:{server.server_port}/{{file_stem}}.mp3"}]}))
                command = [sys.executable, str(ROOT / "scripts/pipeline.py"), "run", "--phase", "full", "--root", str(root), "--workers", "2"]
                def run(extra=None):
                    subprocess.run(command + (extra or []), check=True, capture_output=True, timeout=30)
                run(); first = state["requests"]
                run(); self.assertEqual(state["requests"], first)
                run(["--revalidate"]); self.assertEqual(state["requests"], first + 2)
                conn = sqlite3.connect(root / "checkpoints/state.sqlite3")
                old = json.loads(conn.execute("SELECT payload FROM records LIMIT 1").fetchone()[0])
                self.assertIn("last_validation_http", old)
                state["version"] = 2
                run(["--revalidate"])
                new = json.loads(conn.execute("SELECT payload FROM records LIMIT 1").fetchone()[0])
                self.assertTrue(new["content_changed_at_same_url"])
                self.assertEqual(new["previous_sha256"], old["measured"]["sha256"])
                self.assertNotEqual(new["measured"]["sha256"], old["measured"]["sha256"])
                self.assertEqual(conn.execute("SELECT count(*) FROM records").fetchone()[0], 2)
                self.assertEqual(conn.execute("SELECT count(*) FROM events").fetchone()[0], 6)
                conn.close()
        finally:
            server.shutdown(); server.server_close(); worker.join()


if __name__ == "__main__":
    unittest.main()
