#!/usr/bin/env python3
"""Consistency validation and pilot acceptance; never substitutes for listening."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import sys

from pipeline import ROOT, PILOT, atomic_json, now
from quality_audit import hard_decode_errors


def verify(root, pilot=False):
    config = json.loads((root / "config.json").read_text())
    verses = json.loads((root / "metadata/verses.json").read_text())
    assert len(verses) == 6236 and len({v["file_stem"] for v in verses}) == 6236
    assert [v["ordinal"] for v in verses] == list(range(1, 6237))
    provenance = json.loads((root / "metadata/provenance.json").read_text())
    assert provenance["internal_checks_passed"] and provenance["independent_crosscheck_passed"]
    assert provenance["primary_sha256"] == hashlib.sha256((root / "metadata/quran-data.xml").read_bytes()).hexdigest()
    source_ids = {s["id"] for s in json.loads((root / "sources.json").read_text())["sources"]}
    assert len(source_ids) == 13
    conn = sqlite3.connect(root / "checkpoints/state.sqlite3")
    rows = [json.loads(p) for p, in conn.execute("SELECT payload FROM records")]
    integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
    assert integrity == "ok"; conn.close()
    errors = []; warnings = []; counts = {s: {"observed": 0, "success": 0} for s in source_ids}
    validators = {}
    try:
        from jsonschema import Draft202012Validator
        for name in ("measurement", "recommendation", "inference"):
            schema = json.loads((root / "schemas" / (name + ".schema.json")).read_text())
            Draft202012Validator.check_schema(schema)
            validators[name] = Draft202012Validator(schema)
    except ImportError:
        warnings.append("jsonschema not installed; semantic checks run but JSON Schema validation skipped")
    for r in rows:
        try:
            if "measurement" in validators:
                validators["measurement"].validate(r)
            canonical = verses[r["ordinal"] - 1]
            assert r["source_id"] in source_ids
            assert all(r[k] == canonical[k] for k in ("verse_id", "file_stem", "juz", "surah", "ayah"))
            run = json.loads((root / "measurement-runs" / (r["measurement_config_sha256"] + ".json")).read_text())
            counts[r["source_id"]]["observed"] += 1
            if r["status"] != "success":
                continue
            counts[r["source_id"]]["success"] += 1
            m = r["measured"]; d = m["duration_s"]; a = m["activity"]
            assert not hard_decode_errors(m.get("decoder_warnings", [])), "partial decode must be quarantined before validation"
            assert d > 0 and 0 <= a["active_duration_s"] <= d + 1e-5
            assert len(m["sha256"]) == 64 and m["media"]["file_size_bytes"] > 0
            assert m["decoded_samples_per_channel"] / m["media"]["sample_rate_hz"] == d
            for side in ("leading", "trailing"):
                value = a[side + "_low_energy_s"]
                assert value is None or 0 <= value <= d + 1e-5
            intervals = a["active_intervals_s"]
            assert all(0 <= x <= y <= d + 1e-5 for x, y in intervals)
            assert all(intervals[i][1] <= intervals[i+1][0] for i in range(len(intervals)-1))
            loud = m["loudness"]
            if d < .4:
                assert loud["integrated_lufs"] is None
            if d < run["parameters"]["loudness"]["minimum_lra_duration_s"]:
                assert loud["lra_lu"] is None
            if loud["true_peak_dbtp"] is not None and m["sample_peak_dbfs"] is not None:
                assert loud["true_peak_dbtp"] >= m["sample_peak_dbfs"] - .2
            assert m["sample_peak_linear"] >= 0
            def finite(obj):
                if isinstance(obj, dict):
                    return all(finite(x) for x in obj.values())
                if isinstance(obj, list):
                    return all(finite(x) for x in obj)
                return not isinstance(obj, float) or math.isfinite(obj)
            assert finite(r)
        except Exception as exc:
            errors.append({"source_id": r.get("source_id"), "verse_id": r.get("verse_id"), "type": type(exc).__name__, "message": str(exc)})
    recommendations_checked = 0
    for file in (root / "recommendations").glob("*/*.jsonl"):
        for line in file.read_text().splitlines():
            rec = json.loads(line); recommendations_checked += 1
            try:
                if "recommendation" in validators:
                    validators["recommendation"].validate(rec)
                if rec["gain_db"] is not None:
                    assert math.isfinite(rec["gain_db"]) and rec["gain_linear"] > 0
                    assert abs(rec["gain_linear"] - 10 ** (rec["gain_db"] / 20)) < 1e-9
                    assert rec["predicted_true_peak_dbtp"] <= config["recommendation"]["true_peak_ceiling_dbtp"] + 1e-7
                assert rec["limiting_or_compression_used"] is False
            except Exception as exc:
                errors.append({"source_id": rec.get("source_id"), "verse_id": rec.get("verse_id"), "type": type(exc).__name__, "message": str(exc)})
    inferences_checked=0
    inference_files=[root/'profiles.json']+sorted((root/'segments').glob('*.json'))+sorted((root/'anomalies').glob('*.jsonl'))
    for file in inference_files:
        if not file.exists():
            continue
        for line in (file.read_text().splitlines() if file.suffix=='.jsonl' else [file.read_text()]):
            item=json.loads(line);inferences_checked+=1
            try:
                if 'inference' in validators:
                    validators['inference'].validate(item)
                assert item['data_class']=='inferred'
                assert item.get('automatic_correction_authorized',False) is False
            except Exception as exc:
                errors.append({'file':str(file.relative_to(root)),'type':type(exc).__name__,'message':str(exc)})
    pilot_rows = [r for r in rows if r["verse_id"] in PILOT]
    pilot_counts = {s: sum(r["status"] == "success" and r["source_id"] == s for r in pilot_rows) for s in source_ids}
    if pilot:
        if len(pilot_rows) != 390:
            errors.append({"type": "pilot_incomplete", "observed": len(pilot_rows), "expected": 390})
        if min(pilot_counts.values()) < 20:
            errors.append({"type": "pilot_insufficient_source_success", "success_counts": pilot_counts})
        for r in pilot_rows:
            run = json.loads((root / "measurement-runs" / (r["measurement_config_sha256"] + ".json")).read_text())
            for filename, digest in run["parameters"]["code"].items():
                if hashlib.sha256((root / "scripts" / filename).read_bytes()).hexdigest() != digest:
                    errors.append({"type": "pilot_analyzer_revision_mismatch", "source_id": r["source_id"], "verse_id": r["verse_id"]})
    result = {"checked_at": now(), "pilot_required": pilot, "rows_checked": len(rows), "counts": counts,
              "pilot_success_counts": pilot_counts, "errors": errors, "warnings": warnings,
              "passed": not errors, "json_schema_validation_performed": bool(validators),
              "recommendations_checked": recommendations_checked,
              "inferences_checked": inferences_checked,
              "not_a_listening_review": True, "not_ebu_conformance_certification": True}
    atomic_json(root / "reports" / ("pilot-validation.json" if pilot else "dataset-validation.json"), result)
    print(json.dumps({"passed": result["passed"], "rows_checked": len(rows), "error_count": len(errors), "pilot_success": pilot_counts}))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__); p.add_argument("--root", type=Path, default=ROOT); p.add_argument("--pilot", action="store_true")
    args = p.parse_args(); sys.exit(verify(args.root.resolve(), args.pilot))
