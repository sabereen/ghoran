"""Post-decode validity audit. Preserve diagnostics; quarantine partial decodes."""
import json
import sqlite3

from pipeline import connect, now

HARD_ERRORS = ("error while decoding", "error submitting packet to decoder",
               "invalid data found when processing input", "corrupt decoded frame",
               "invalid frame size", "header missing")


def hard_decode_errors(warnings):
    return [w for w in warnings if any(marker in w.lower() for marker in HARD_ERRORS)]


def audit(root):
    conn = connect(root); changed = []
    rows = conn.execute("SELECT source,verse,config_hash,payload FROM records WHERE status='success'").fetchall()
    for source, verse, fingerprint, payload in rows:
        record = json.loads(payload)
        evidence = hard_decode_errors(record["measured"].get("decoder_warnings", []))
        if not evidence:
            continue
        record["status"] = "invalid"
        record["quality_audit"] = {"version": "1.0.0", "audited_at": now(), "previous_status": "success",
                                    "classification": "partial_decode_error",
                                    "diagnostic_measurements_only": True, "error_evidence": evidence,
                                    "exclude_from_inference_and_recommendations": True}
        record["error"] = {"type": "PartialDecodeError", "message": "FFmpeg returned PCM but reported corrupt/undecodable frames"}
        updated = json.dumps(record, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        conn.execute("UPDATE records SET status='invalid',payload=? WHERE source=? AND verse=?", (updated, source, verse))
        event = dict(record); event["operation"] = "quality_audit"; event["processing_wall_s"] = 0
        event["downloaded_bytes_this_event"] = 0
        conn.execute("INSERT INTO events(at,source,verse,status,payload) VALUES (?,?,?,?,?)",
                     (now(), source, verse, "invalid", json.dumps(event, ensure_ascii=False, allow_nan=False, separators=(",", ":"))))
        conn.commit(); changed.append({"source_id": source, "verse_id": record["verse_id"]})
    conn.close()
    return changed
