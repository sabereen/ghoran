#!/usr/bin/env python3
"""Resumable, auditable audio measurement runner; Python 3.11+."""
import argparse
import concurrent.futures as futures
import contextlib
import datetime as dt
import hashlib
import itertools
import json
import os
from pathlib import Path
import random
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from measure import VERSION, measure

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "1.0.0"
STOP = threading.Event()


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def atomic_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(value, f, ensure_ascii=False, allow_nan=False, indent=2)
        f.write("\n"); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path)


def connect(root):
    path = root / "checkpoints" / "state.sqlite3"; path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=60)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=FULL")
    conn.execute("CREATE TABLE IF NOT EXISTS records (source TEXT, verse INTEGER, status TEXT, config_hash TEXT, payload TEXT NOT NULL, PRIMARY KEY(source,verse))")
    conn.execute("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, at TEXT, source TEXT, verse INTEGER, status TEXT, payload TEXT)")
    return conn


def initialize(root):
    root.mkdir(parents=True, exist_ok=True)
    meta = root / "metadata"; meta.mkdir(exist_ok=True)
    url = "https://tanzil.net/res/text/metadata/quran-data.xml"
    xml = meta / "quran-data.xml"
    if not xml.exists():
        with urllib.request.urlopen(url, timeout=45) as response:
            xml.write_bytes(response.read())
    tree = ET.fromstring(xml.read_bytes())
    suras = tree.findall("suras/sura")
    assert len(suras) == 114
    verses = []; offsets = {}
    for expected, sura in enumerate(suras, 1):
        s = int(sura.attrib["index"]); n = int(sura.attrib["ayas"])
        assert s == expected and int(sura.attrib["start"]) == len(verses) and n > 0
        offsets[s] = len(verses)
        for a in range(1, n + 1):
            verses.append({"ordinal": len(verses) + 1, "surah": s, "ayah": a,
                           "verse_id": f"{s}:{a}", "file_stem": f"{s:03}{a:03}"})
    assert len(verses) == 6236 and len({v["verse_id"] for v in verses}) == 6236
    assert verses[0]["verse_id"] == "1:1" and verses[-1]["verse_id"] == "114:6"
    juzs = tree.findall("juzs/juz"); assert len(juzs) == 30
    starts = [(offsets[int(j.attrib["sura"])] + int(j.attrib["aya"]), int(j.attrib["index"])) for j in juzs]
    for verse in verses:
        verse["juz"] = max(j for start, j in starts if start <= verse["ordinal"])
    # Separate upstream publisher cross-check; no invented verification on failure.
    cross_path = meta / "quran-com-chapters.json"
    cross_error = None
    try:
        if not cross_path.exists():
            with urllib.request.urlopen("https://api.quran.com/api/v4/chapters?language=en", timeout=40) as response:
                cross_path.write_bytes(response.read())
        other = json.loads(cross_path.read_text())["chapters"]
        assert len(other) == 114
        assert [(x["id"], x["verses_count"]) for x in other] == [(int(x.attrib["index"]), int(x.attrib["ayas"])) for x in suras]
        cross_ok = True
    except Exception as exc:
        cross_ok = False; cross_error = str(exc)
    atomic_json(meta / "verses.json", verses)
    atomic_json(meta / "provenance.json", {"schema_version": SCHEMA, "retrieved_at": now(),
                "primary_url": url, "primary_sha256": hashlib.sha256(xml.read_bytes()).hexdigest(),
                "attribution": "Quran structure metadata: Tanzil Project, CC-BY, https://tanzil.net/docs/Quran_Metadata",
                "total_verses": len(verses), "surahs": 114, "juzs": 30,
                "internal_checks_passed": True, "independent_crosscheck_passed": cross_ok,
                "crosscheck_url": "https://api.quran.com/api/v4/chapters?language=en", "crosscheck_error": cross_error,
                "crosscheck_sha256": hashlib.sha256(cross_path.read_bytes()).hexdigest() if cross_path.exists() else None})
    names = [("parhizgar", "پرهیزگار", "Parhizgar", "recitation"),
             ("ghamadi", "غامدی", "Ghamadi", "recitation"),
             ("husary", "حصری", "Husary", "recitation"),
             ("minshawy-murattal", "منشاوی ترتیل", "Minshawy_Murattal", "recitation"),
             ("minshawy-mujawwad", "منشاوی مجوّد", "Minshawy_Mujawwad", "mujawwad"),
             ("motaz", "معتز آقایی", "Motaz", "recitation"),
             ("abdulbasit", "عبدالباسط", "Abdulbasit", "recitation"),
             ("almuiqly", "معیقلی", "AlMuiqly", "recitation"),
             ("jafarpour", "جعفرپور", "jafarpour", "recitation"),
             ("ansarian", "انصاریان", "translation/ansarian-iranseda", "translation"),
             ("maleki", "ملکی", "maleki", "translation"),
             ("makarem-kabiri", "مکارم شیرازی", "Makarem_Kabiri", "translation"),
             ("fooladvand-hedayatfar", "فولادوند", "Fooladvand_Hedayatfar", "translation")]
    sources = []
    for sid, name, folder, kind in names:
        host = "https://qmad.s3.ir-central1.arvanstorage.ir/" if sid in ("jafarpour", "ansarian") else "https://asset.nasimrezvan.com/data/"
        sources.append({"id": sid, "name_fa": name, "kind": kind, "expected_files": 6236,
                        "url_template": host + folder + "/{file_stem}.mp3",
                        "content_rights": "not_verified; original media excluded from deliverables"})
    atomic_json(root / "sources.json", {"schema_version": SCHEMA, "sources": sources})
    defaults = {"schema_version": SCHEMA, "analyzer_version": VERSION,
                "download": {"workers": 6, "per_host": 2, "timeout_s": 35, "attempts": 4,
                             "backoff_base_s": 1, "max_file_bytes": 100000000, "minimum_host_interval_s": .10},
                "decode_timeout_s": 240,
                "loudness": {"minimum_lra_duration_s": 30, "minimum_lra_windows": 100,
                             "absolute_gate_lufs": -70, "relative_gate_lu": -10,
                             "dualmono": False, "metadata_interval_s": .1, "true_peak_precision_db": .1},
                "activity": {"frame_ms": 20, "noise_margin_db": 10, "relative_onset_db": 30,
                             "hysteresis_db": 6, "absolute_floor_dbfs": -75, "bridge_ms": 180,
                             "padding_ms": 120, "min_separation_db": 8, "near_silent_peak_frame_dbfs": -70},
                "inference": {"rolling_radius_verses": 15, "minimum_neighbors": 8,
                              "minimum_active_s": 1, "minimum_segment_verses": 20,
                              "minimum_change_lu": 3, "maximum_ordinal_gap": 1,
                              "translation_outlier_z": 3.5, "recitation_outlier_z": 4.5,
                              "mujawwad_outlier_z": 6, "mad_floor_lu": 1},
                "recommendation": {"targets_lufs": [-23, -20, -18, -16], "true_peak_ceiling_dbtp": -1,
                                   "maximum_boost_db": 8, "maximum_cut_db": 18,
                                   "maximum_segment_correction_db": 2, "maximum_file_correction_db": 1,
                                   "segment_strength": .5, "file_strength": .25,
                                   "automatic_inferred_corrections": False}}
    if not (root / "config.json").exists():
        atomic_json(root / "config.json", defaults)
    print(json.dumps({"initialized": str(root), "expected": len(verses) * len(sources), "crosscheck_passed": cross_ok}), flush=True)


class Downloader:
    def __init__(self, cfg):
        self.cfg = cfg; self.lock = threading.Lock(); self.hosts = {}; self.last = {}

    def get(self, url, path, validators=None):
        host = urllib.parse.urlsplit(url).netloc
        with self.lock:
            sem = self.hosts.setdefault(host, threading.Semaphore(self.cfg["per_host"]))
        errors = []; total_bytes = 0
        for attempt in range(1, self.cfg["attempts"] + 1):
            try:
                with sem:
                    with self.lock:
                        delay = max(0, self.last.get(host, 0) + self.cfg["minimum_host_interval_s"] - time.monotonic())
                        self.last[host] = time.monotonic() + delay
                    if delay:
                        time.sleep(delay)
                    headers = {"User-Agent": "QuranAudioAnalysis/" + VERSION, "Accept-Encoding": "identity"}
                    headers.update(validators or {})
                    req = urllib.request.Request(url, headers=headers)
                    with urllib.request.urlopen(req, timeout=self.cfg["timeout_s"]) as r:
                        length = r.headers.get("Content-Length")
                        size = 0
                        with path.open("wb") as f:
                            while True:
                                chunk = r.read(131072)
                                if not chunk:
                                    break
                                size += len(chunk); total_bytes += len(chunk)
                                if size > self.cfg["max_file_bytes"]:
                                    raise ValueError("file_exceeds_configured_byte_limit")
                                f.write(chunk)
                        if length is not None and size != int(length):
                            raise OSError(f"content_length_mismatch:{length}:{size}")
                        return {"status": "downloaded", "http_status": r.status, "attempts": attempt,
                                "downloaded_bytes": total_bytes, "response_bytes": size,
                                "etag": r.headers.get("ETag"), "last_modified": r.headers.get("Last-Modified"),
                                "content_type": r.headers.get("Content-Type"), "errors": errors}
            except urllib.error.HTTPError as exc:
                if exc.code == 304:
                    return {"status": "not_modified", "http_status": 304, "attempts": attempt, "downloaded_bytes": total_bytes, "errors": errors}
                errors.append({"attempt": attempt, "http_status": exc.code, "error": str(exc)})
                if exc.code in (404, 410):
                    return {"status": "missing", "http_status": exc.code, "attempts": attempt, "downloaded_bytes": total_bytes, "errors": errors}
                if exc.code not in (408, 425, 429) and not 500 <= exc.code < 600:
                    return {"status": "http_error", "http_status": exc.code, "attempts": attempt, "downloaded_bytes": total_bytes, "errors": errors}
            except Exception as exc:
                errors.append({"attempt": attempt, "error": str(exc), "type": type(exc).__name__})
            if attempt < self.cfg["attempts"]:
                retry_after = 0
                # Never retry permanent 404/410; temporary errors get bounded jittered backoff.
                if errors[-1].get("http_status") == 429:
                    retry_after = 10
                time.sleep(max(retry_after, min(30, self.cfg["backoff_base_s"] * 2 ** (attempt - 1))) + random.uniform(0, .3))
        return {"status": "temporary_error", "attempts": attempt, "downloaded_bytes": total_bytes, "errors": errors}


def process(source, verse, cfg, fingerprint, downloader, old, revalidate):
    started = time.monotonic()
    url = source["url_template"].format(**verse)
    record = {"schema_version": SCHEMA, "source_id": source["id"], **verse, "url": url,
              "analyzer_version": VERSION, "measurement_config_sha256": fingerprint, "measured_at": now()}
    with tempfile.TemporaryDirectory(prefix="quran-audio-") as tmp:
        path = Path(tmp) / "input.mp3"
        headers = {}
        if revalidate and old and old.get("status") == "success" and old.get("measurement_config_sha256") == fingerprint:
            previous_http = old.get("http", {})
            if previous_http.get("etag"):
                headers["If-None-Match"] = previous_http["etag"]
            elif previous_http.get("last_modified"):
                headers["If-Modified-Since"] = previous_http["last_modified"]
        http = downloader.get(url, path, headers)
        if http["status"] == "not_modified":
            record = dict(old); record["revalidated_at"] = now(); record["last_validation_http"] = http
            record["processing_wall_s"] = time.monotonic() - started
            return record
        record["http"] = http
        if http["status"] != "downloaded":
            record["status"] = http["status"]
        else:
            sha = hashlib.sha256(path.read_bytes()).hexdigest()
            if old and old.get("status") == "success" and old.get("measured", {}).get("sha256") == sha and old.get("measurement_config_sha256") == fingerprint:
                record = dict(old); record["http"] = http; record["revalidated_at"] = now()
                record["analysis_reused_identical_sha256"] = True
            else:
                try:
                    record["measured"] = measure(path, cfg)
                    record["status"] = "success"
                    if old and old.get("measured", {}).get("sha256") != sha:
                        record["previous_sha256"] = old.get("measured", {}).get("sha256")
                        record["content_changed_at_same_url"] = record["previous_sha256"] is not None
                except Exception as exc:
                    record["status"] = "invalid"; record["error"] = {"type": type(exc).__name__, "message": str(exc)}
                    record["download_sha256"] = sha
        record["processing_wall_s"] = time.monotonic() - started
    return record


PILOT = ["1:1", "1:7", "2:1", "2:2", "2:3", "2:4", "2:5", "2:255", "2:282", "3:1", "3:92", "4:1", "5:3", "9:1", "12:1", "18:1", "19:1", "20:1", "24:35", "36:1", "36:2", "55:13", "67:1", "78:1", "93:1", "97:1", "103:1", "108:1", "112:1", "114:6"]


def snapshot(root, conn, sources):
    coverage = []; total = 0
    for source in sources:
        counts = dict(conn.execute("SELECT status,count(*) FROM records WHERE source=? GROUP BY status", (source["id"],)).fetchall())
        processed = sum(counts.values()); total += processed
        coverage.append({"source_id": source["id"], "expected": 6236, "success": counts.get("success", 0),
                         "missing": counts.get("missing", 0), "invalid": counts.get("invalid", 0),
                         "temporary_error": counts.get("temporary_error", 0), "http_error": counts.get("http_error", 0),
                         "unprocessed": 6236 - processed})
    atomic_json(root / "reports" / "progress.json", {"updated_at": now(), "schema_version": SCHEMA,
                "expected_total": 6236 * len(sources), "attempted_unique": total,
                "complete_inventory": total == 6236 * len(sources), "coverage": coverage})
    conn.commit()


def export(root):
    conn = connect(root)
    sources = json.loads((root / "sources.json").read_text())["sources"]
    for source in sources:
        out = root / "measurements" / (source["id"] + ".jsonl"); out.parent.mkdir(exist_ok=True)
        tmp = out.with_suffix(".jsonl.tmp")
        with tmp.open("w") as f:
            for payload, in conn.execute("SELECT payload FROM records WHERE source=? ORDER BY verse", (source["id"],)):
                f.write(payload + "\n")
        os.replace(tmp, out)
    snapshot(root, conn, sources)
    backup = root / "checkpoints" / "portable.sqlite3"
    with sqlite3.connect(backup) as target:
        conn.backup(target)
    conn.close()


def run(args, root):
    cfg = json.loads((root / "config.json").read_text())
    versions = {"ffmpeg": subprocess.check_output(["ffmpeg", "-version"], text=True),
                "ffprobe": subprocess.check_output(["ffprobe", "-version"], text=True),
                "python": sys.version}
    code_hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in Path(__file__).parent.glob("*.py") if p.name in ("measure.py", "pipeline.py")}
    # Download/recommendation changes must not force repeat audio measurements.
    core = {"activity": cfg["activity"], "loudness": cfg["loudness"], "analyzer": VERSION,
            "code": code_hashes, "ffmpeg": versions["ffmpeg"]}
    fingerprint = hashlib.sha256(json.dumps(core, sort_keys=True).encode()).hexdigest()
    atomic_json(root / "measurement-runs" / (fingerprint + ".json"), {"measurement_config_sha256": fingerprint, "parameters": core, "environment": versions})
    sources = json.loads((root / "sources.json").read_text())["sources"]
    if args.sources:
        selected = set(args.sources.split(",")); sources = [s for s in sources if s["id"] in selected]
        if len(selected) != len(sources):
            raise ValueError("unknown source ID")
    verses = json.loads((root / "metadata" / "verses.json").read_text())
    if args.phase == "pilot":
        verses = [v for v in verses if v["verse_id"] in PILOT]
        assert len(verses) == 30
    conn = connect(root)
    existing = {(s, v): (status, conf) for s, v, status, conf in conn.execute("SELECT source,verse,status,config_hash FROM records")}
    def tasks():
        for verse, source in itertools.product(verses, sources):
            key = source["id"], verse["ordinal"]
            old_status, old_conf = existing.get(key, (None, None))
            if old_status in ("success", "missing", "invalid", "http_error") and old_conf == fingerprint and not args.revalidate:
                continue
            old = None
            if key in existing:
                old = json.loads(conn.execute("SELECT payload FROM records WHERE source=? AND verse=?", key).fetchone()[0])
            yield source, verse, old
    downloader = Downloader(cfg["download"])
    pending = {}; iterator = iter(tasks()); finished = 0; start = time.monotonic()
    deadline = start + args.max_seconds if args.max_seconds else float("inf")
    maximum = args.max_files or float("inf")
    workers = args.workers or cfg["download"]["workers"]
    def enqueue(pool):
        if time.monotonic() >= deadline or finished + len(pending) >= maximum or STOP.is_set():
            return False
        try:
            source, verse, old = next(iterator)
        except StopIteration:
            return False
        f = pool.submit(process, source, verse, cfg, fingerprint, downloader, old, args.revalidate)
        pending[f] = (source, verse)
        return True
    try:
        with futures.ThreadPoolExecutor(max_workers=workers) as pool:
            for _ in range(workers):
                enqueue(pool)
            while pending:
                done, _ = futures.wait(pending, timeout=1, return_when=futures.FIRST_COMPLETED)
                for f in done:
                    source, verse = pending.pop(f)
                    try:
                        record = f.result()
                    except Exception as exc:
                        record = {"schema_version": SCHEMA, "source_id": source["id"], **verse,
                                  "status": "temporary_error", "measured_at": now(),
                                  "measurement_config_sha256": fingerprint,
                                  "error": {"type": type(exc).__name__, "message": str(exc)}}
                    payload = json.dumps(record, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
                    # Success measurements remain available if a later validation fails.
                    oldrow = conn.execute("SELECT status FROM records WHERE source=? AND verse=?", (source["id"], verse["ordinal"])).fetchone()
                    if not oldrow or oldrow[0] != "success" or record["status"] == "success":
                        conn.execute("INSERT OR REPLACE INTO records VALUES (?,?,?,?,?)", (source["id"], verse["ordinal"], record["status"], fingerprint, payload))
                    conn.execute("INSERT INTO events(at,source,verse,status,payload) VALUES (?,?,?,?,?)", (now(), source["id"], verse["ordinal"], record["status"], payload))
                    conn.commit(); finished += 1
                    if finished % 25 == 0:
                        snapshot(root, conn, json.loads((root / "sources.json").read_text())["sources"])
                        print(json.dumps({"phase": args.phase, "newly_processed": finished, "elapsed_s": round(time.monotonic() - start), "last_source": source["id"], "last_status": record["status"]}), flush=True)
                    enqueue(pool)
    except KeyboardInterrupt:
        STOP.set()
        print("Interrupted; committed rows are safe. Export and resume with the same command.", file=sys.stderr)
    finally:
        conn.commit(); conn.close(); export(root)
        print(json.dumps({"phase": args.phase, "processed_this_run": finished, "elapsed_s": round(time.monotonic() - start), "checkpoint": str(root / "checkpoints/state.sqlite3")}), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["init", "run", "export"])
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--phase", choices=["pilot", "full"], default="pilot")
    parser.add_argument("--workers", type=int)
    parser.add_argument("--sources")
    parser.add_argument("--max-seconds", type=float)
    parser.add_argument("--max-files", type=int)
    parser.add_argument("--revalidate", action="store_true", help="conditional GET with ETag/Last-Modified; same SHA skips analysis")
    args = parser.parse_args(); root = args.root.resolve()
    if args.command == "init":
        initialize(root)
    elif args.command == "export":
        export(root)
    else:
        # Prevent two writers from duplicating downloads; lock releases on process exit.
        import fcntl
        (root / "checkpoints").mkdir(parents=True, exist_ok=True)
        with (root / "checkpoints" / "run.lock").open("w") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            run(args, root)


if __name__ == "__main__":
    main()
