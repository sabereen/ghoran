#!/usr/bin/env python3
"""Build a consistent, resumable snapshot even while the source runner is active."""
import argparse
from contextlib import closing
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import zipfile

from pipeline import ROOT, atomic_json, now


def package(root, destination):
    destination = destination.resolve(); destination.parent.mkdir(parents=True, exist_ok=True)
    # Only immutable inputs / source code are copied. All generated views are
    # rebuilt against a single transactional SQLite backup, never mixed live reads.
    with tempfile.TemporaryDirectory(prefix="quran-snapshot-", dir=destination.parent) as tmp:
        snapshot = Path(tmp) / "quran-audio-analysis"; snapshot.mkdir()
        for name in ("scripts", "tests", "schemas", "metadata", "measurement-runs"):
            shutil.copytree(root / name, snapshot / name, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        for name in ("README.md", "requirements.txt", "sources.json", "config.json", "approvals.json", "DATA_DICTIONARY.fa.md"):
            if (root / name).exists():
                shutil.copy2(root / name, snapshot / name)
        (snapshot / "checkpoints").mkdir(); (snapshot / "reports").mkdir()
        for name in ("pilot-validation.json", "unit-tests.txt", "execution-notes.fa.md", "calibration-reference.json"):
            if (root / "reports" / name).exists():
                shutil.copy2(root / "reports" / name, snapshot / "reports" / name)
        with closing(sqlite3.connect(root / "checkpoints/state.sqlite3")) as source, closing(sqlite3.connect(snapshot / "checkpoints/state.sqlite3")) as target:
            source.backup(target)
        # Capture exact measurement code if this revision is still in use.
        for runfile in (snapshot / "measurement-runs").glob("*.json"):
            run = json.loads(runfile.read_text())
            src = snapshot / "measurement-runs" / run["measurement_config_sha256"] / "scripts"
            src.mkdir(parents=True, exist_ok=True)
            for filename, digest in run["parameters"]["code"].items():
                current = snapshot / "scripts" / filename
                if hashlib.sha256(current.read_bytes()).hexdigest() == digest:
                    shutil.copy2(current, src / filename)
                elif not (src / filename).exists() or hashlib.sha256((src / filename).read_bytes()).hexdigest() != digest:
                    raise ValueError("Missing exact historical analyzer source: " + filename + ":" + run["measurement_config_sha256"])
        for script in ("analyze.py", "verify.py", "distribution_report.py"):
            subprocess.run([sys.executable, str(snapshot / "scripts" / script), "--root", str(snapshot)], check=True)
        hashes = {str(p.relative_to(snapshot)): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in sorted(snapshot.rglob("*")) if p.is_file() and p.suffix not in (".pyc",)
                  and "__pycache__" not in p.parts and p.name not in ("run.lock", "state.sqlite3-wal", "state.sqlite3-shm")}
        atomic_json(snapshot / "manifest.sha256.json", {"schema_version": "1.0.0", "created_at": now(), "files": hashes})
        with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for relative in hashes:
                p = snapshot / relative
                z.write(p, "quran-audio-analysis/" + relative)
            z.write(snapshot / "manifest.sha256.json", "quran-audio-analysis/manifest.sha256.json")
        # A directly downloadable report is available beside the archive.
        report_dir = destination.parent / (destination.stem + "-report")
        report_dir.mkdir(exist_ok=True)
        for p in (snapshot / "reports").iterdir():
            if p.is_dir():
                shutil.copytree(p, report_dir / p.name, dirs_exist_ok=True)
                continue
            if p.suffix in (".html", ".md", ".png", ".csv", ".json"):
                shutil.copy2(p, report_dir / p.name)
        print(json.dumps({"archive": str(destination), "bytes": destination.stat().st_size,
                          "report": str(report_dir / "report.fa.md"), "coverage": json.loads((snapshot / "reports/progress.json").read_text())}), flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=ROOT)
    p.add_argument("--output", type=Path, default=ROOT.parent / "quran-audio-analysis-partial.zip")
    args = p.parse_args(); package(args.root.resolve(), args.output)
