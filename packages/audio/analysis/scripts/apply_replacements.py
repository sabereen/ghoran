"""Adopt explicitly accepted local audio revisions without pretending the URL was fetched."""
import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import time

from measure import VERSION, measure
from pipeline import ROOT, atomic_json, connect, export, now
from quality_audit import hard_decode_errors


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def apply(root, manifest_path, acceptance):
    if not acceptance.strip():
        raise ValueError("Explicit acceptance note required")
    manifest_path = Path(manifest_path).resolve()
    manifest = json.loads(manifest_path.read_text())
    config = json.loads((root / "config.json").read_text())
    code = {name: sha(root / "scripts" / name) for name in ("measure.py", "pipeline.py")}
    ffmpeg = subprocess.check_output(["ffmpeg", "-version"], text=True)
    core = {"activity": config["activity"], "loudness": config["loudness"],
            "analyzer": VERSION, "code": code, "ffmpeg": ffmpeg}
    fingerprint = hashlib.sha256(json.dumps(core, sort_keys=True).encode()).hexdigest()
    run = root / "measurement-runs" / (fingerprint + ".json")
    if not run.exists():
        atomic_json(run, {"measurement_config_sha256": fingerprint, "parameters": core,
                         "environment": {"ffmpeg": ffmpeg, "ffprobe": subprocess.check_output(["ffprobe", "-version"], text=True)}})
    conn = connect(root)
    changed = []
    seen = set()
    try:
        for item in manifest["files"]:
            key = item["source_id"], item["verse_id"]
            if key in seen:
                raise ValueError("Duplicate replacement: " + str(key))
            seen.add(key)
            rows = conn.execute("SELECT verse,payload FROM records WHERE source=?", (key[0],)).fetchall()
            matches = [(ordinal, json.loads(payload)) for ordinal, payload in rows if json.loads(payload)["verse_id"] == key[1]]
            if len(matches) != 1:
                raise ValueError("Unknown canonical source/verse: " + str(key))
            ordinal, old = matches[0]
            expected = item["measured"]["sha256"]
            if old.get("measured", {}).get("sha256") == expected and old.get("content_replacement"):
                continue
            path = (manifest_path.parent / item["path"]).resolve()
            if not path.is_relative_to(manifest_path.parent):
                raise ValueError("Audio path outside package")
            if sha(path) != expected:
                raise ValueError("Replacement hash mismatch: " + str(key))
            if old["url"] != item["replacement_for_url"] or old["file_stem"] != item["stem"]:
                raise ValueError("Canonical URL/stem mismatch: " + str(key))
            started = time.monotonic()
            measured = measure(path, config)
            if hard_decode_errors(measured.get("decoder_warnings", [])):
                raise ValueError("Replacement contains corrupt frames: " + str(key))
            if measured["loudness"]["integrated_lufs"] is None or measured["loudness"]["true_peak_dbtp"] is None:
                raise ValueError("Replacement is unmeasurable: " + str(key))
            if measured["sha256"] != expected:
                raise ValueError("Audio changed during measurement")
            previous = old.get("measured", {}).get("sha256") or old.get("download_sha256") or old.get("invalid_recheck", {}).get("response_sha256")
            archive = root / "replacement-history" / key[0] / (old["file_stem"] + "-" + (previous or "unknown") + ".json")
            if not archive.exists():
                atomic_json(archive, old)
            replacement = {"accepted_at": now(), "acceptance": acceptance,
                           "approval_basis": "user accepted supplied replacement package; not an independent listening certification",
                           "manifest_sha256": sha(manifest_path), "previous_status": old["status"],
                           "previous_sha256": previous, "input_sha256": expected,
                           "origin_url": item["url"], "preparation": item["method"],
                           "origin_download_sha256": item["reference_download_sha256"],
                           "start_s": item.get("start_s"), "end_s": item.get("end_s"),
                           "canonical_url_publication": {"status": "pending_user_upload", "verified": False},
                           "review_notes": item.get("evidence"), "review_category": item.get("review")}
            record = {key: old[key] for key in ("schema_version", "source_id", "ordinal", "surah", "ayah", "verse_id", "file_stem", "juz", "url")}
            record.update(status="success", analyzer_version=VERSION, measurement_config_sha256=fingerprint,
                          measured_at=now(), measured=measured, content_replacement=replacement,
                          measurement_input="accepted_local_replacement", processing_wall_s=time.monotonic()-started)
            payload = json.dumps(record, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
            with conn:
                conn.execute("INSERT OR REPLACE INTO records VALUES (?,?,?,?,?)", (key[0], ordinal, "success", fingerprint, payload))
                event = dict(record, operation="apply_accepted_local_replacement", downloaded_bytes_this_event=0)
                conn.execute("INSERT INTO events(at,source,verse,status,payload) VALUES (?,?,?,?,?)",
                             (now(), key[0], ordinal, "success", json.dumps(event, ensure_ascii=False, allow_nan=False, separators=(",", ":"))))
            changed.append({"source_id": key[0], "verse_id": key[1], "sha256": expected})
    finally:
        conn.close()
    export(root)
    from publication import write_publication
    write_publication(root)
    return changed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--acceptance", required=True)
    args = parser.parse_args()
    print(json.dumps({"adopted": apply(args.root.resolve(), args.manifest, args.acceptance)}, ensure_ascii=False))
