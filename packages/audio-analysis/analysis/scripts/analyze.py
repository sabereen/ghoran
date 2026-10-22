#!/usr/bin/env python3
"""Inferences and gain policies, strictly separate from measurements."""
import argparse
from collections import defaultdict
import csv
import gzip
import hashlib
import json
import math
from pathlib import Path
import sqlite3

import numpy as np

from measure import stats
from pipeline import ROOT, SCHEMA, atomic_json, connect, export, now


def median(values):
    a = [v for v in values if v is not None and math.isfinite(v)]
    return float(np.median(a)) if a else None


def weighted_median(values, weights):
    if not values:
        return None
    order = np.argsort(values)
    v = np.asarray(values)[order]; w = np.asarray(weights)[order]
    return float(v[np.searchsorted(np.cumsum(w), w.sum() / 2)])


def playback(record):
    return record["measured"]["dualmono_playback_lufs"]


def eligible(record, cfg):
    return (record["status"] == "success" and playback(record) is not None
            and record["measured"]["activity"]["active_duration_s"] >= cfg["minimum_active_s"]
            and not record["measured"]["activity"]["near_silent"])


def duration_bin(record):
    d = record["measured"]["activity"]["active_duration_s"]
    return int(np.searchsorted([3, 10, 30, 120], d))


def profile(records, config):
    cfg = config["inference"]
    valid = [r for r in records if eligible(r, cfg)]
    vals = [playback(r) for r in valid]
    weights = [min(20, r["measured"]["activity"]["active_duration_s"]) for r in valid]
    bins = {}
    for i in range(5):
        group = [playback(r) for r in valid if duration_bin(r) == i]
        bins[str(i)] = stats(group)
    return {"schema_version": SCHEMA, "data_class": "inferred", "n_success": len(records),
            "n_eligible": len(valid), "expected": 6236, "success_coverage": len(records) / 6236,
            "provisional": len(records) < 6236,
            "native_integrated_lufs": stats([r["measured"]["loudness"]["integrated_lufs"] for r in records]),
            "dualmono_playback_lufs": stats(vals), "baseline_playback_lufs": weighted_median(vals, weights),
            "baseline_method": "active-duration-weighted median; duration weights capped at 20s; mono +3.0103 LU playback convention",
            "duration_bin_playback_lufs": bins,
            "true_peak_dbtp": stats([r["measured"]["loudness"]["true_peak_dbtp"] for r in records]),
            "active_duration_s": stats([r["measured"]["activity"]["active_duration_s"] for r in records]),
            "leading_low_energy_s": stats([r["measured"]["activity"]["leading_low_energy_s"] for r in records]),
            "trailing_low_energy_s": stats([r["measured"]["activity"]["trailing_low_energy_s"] for r in records]),
            "surahs_observed": len({r["surah"] for r in records}),
            "largest_contiguous_success_run": max([len(run) for run in contiguous(records)], default=0)}


def contiguous(records):
    runs = []; run = []
    for r in sorted(records, key=lambda x: x["ordinal"]):
        if run and r["ordinal"] != run[-1]["ordinal"] + 1:
            runs.append(run); run = []
        run.append(r)
    if run:
        runs.append(run)
    return runs


def residual(record, prof):
    value = playback(record)
    b = prof["duration_bin_playback_lufs"][str(duration_bin(record))]
    global_med = prof["dualmono_playback_lufs"]["median"]
    # Sparse bins are not trusted to estimate systematic duration differences.
    offset = b["median"] - global_med if b["n"] >= 20 else 0
    return value - offset


def changes(records, prof, config):
    cfg = config["inference"]; window = cfg["minimum_segment_verses"]
    segments = []; change_points = []
    for run_index, run in enumerate(contiguous(records)):
        candidates = []
        for i in range(window, len(run) - window + 1):
            left = run[i-window:i]; right = run[i:i+window]
            # Require enough valid utterances in each adjacent, gap-free window.
            lv = [residual(r, prof) for r in left if eligible(r, cfg)]
            rv = [residual(r, prof) for r in right if eligible(r, cfg)]
            if min(len(lv), len(rv)) < math.ceil(window * .8):
                continue
            delta = median(rv) - median(lv)
            sensitivity = cfg.get('recording_change_multiplier_by_kind',{'mujawwad':1.5}).get(run[i].get('_kind','recitation'),1)
            if abs(delta) < cfg["minimum_change_lu"] * sensitivity:
                continue
            # A stable shift must survive splitting both windows into halves.
            quarter_meds = [median(v) for v in (lv[:len(lv)//2], lv[len(lv)//2:], rv[:len(rv)//2], rv[len(rv)//2:])]
            if max(abs(quarter_meds[0] - quarter_meds[1]), abs(quarter_meds[2] - quarter_meds[3])) > abs(delta) * .65:
                continue
            lm = median(lv); rm = median(rv)
            spread = max(cfg["mad_floor_lu"], 1.4826 * median([abs(v - lm) for v in lv] + [abs(v - rm) for v in rv]))
            z = abs(delta) / spread
            if z < 2:
                continue
            def feature(group, *keys):
                out = []
                for r in group:
                    x = r["measured"]
                    for k in keys:
                        x = x.get(k) if isinstance(x, dict) else None
                    if x is not None:
                        out.append(x)
                return median(out)
            noise_l = feature(left, "activity", "noise_floor_proxy_dbfs")
            noise_r = feature(right, "activity", "noise_floor_proxy_dbfs")
            spec_l = feature(left, "spectral", "centroid_hz")
            spec_r = feature(right, "spectral", "centroid_hz")
            noise_delta = noise_r - noise_l if noise_r is not None and noise_l is not None else None
            spec_ratio = spec_r / spec_l if spec_l and spec_r else None
            supporting_noise = noise_delta is not None and abs(noise_delta) >= 2 and delta * noise_delta > 0
            supporting_spectrum = spec_ratio is not None and abs(math.log(spec_ratio)) > math.log(1.2)
            fmt_l = {(r["measured"]["media"]["sample_rate_hz"], r["measured"]["media"]["channels"]) for r in left}
            fmt_r = {(r["measured"]["media"]["sample_rate_hz"], r["measured"]["media"]["channels"]) for r in right}
            corroborated = supporting_noise or supporting_spectrum or fmt_l.isdisjoint(fmt_r)
            confidence = min(.95, .45 + .07 * min(z, 4) + .15 * corroborated)
            candidates.append({"index": i, "at_ordinal": run[i]["ordinal"], "at_verse_id": run[i]["verse_id"],
                               "delta_lu": delta, "robust_effect_size": z, "confidence_score": confidence,
                               "confidence_is_calibrated_probability": False, "review_required": True,
                               "status": "hypothesis", "evidence": {"left_n": len(lv), "right_n": len(rv),
                                   "noise_proxy_delta_db": noise_delta, "spectral_centroid_ratio": spec_ratio,
                                   "corroborated": corroborated, "at_surah_boundary": run[i]["surah"] != run[i-1]["surah"],
                                   "auxiliary_features_are_not_independent_evidence": True,
                                   "at_juz_boundary": run[i]["juz"] != run[i-1]["juz"]}})
        selected = []
        # Nonmaximum suppression prevents a broad change being counted many times.
        for c in sorted(candidates, key=lambda x: x["robust_effect_size"], reverse=True):
            if all(abs(c["index"] - s["index"]) >= window for s in selected):
                selected.append(c)
        selected.sort(key=lambda x: x["index"])
        change_points.extend(selected)
        boundaries = [0] + [c["index"] for c in selected] + [len(run)]
        for j, (a, b) in enumerate(zip(boundaries, boundaries[1:])):
            group = run[a:b]; good = [r for r in group if eligible(r, cfg)]
            if not group:
                continue
            content_set = hashlib.sha256(json.dumps([(r["ordinal"], r["measured"].get("sha256")) for r in group], separators=(",", ":")).encode()).hexdigest()
            segments.append({"id": f"segment-{group[0]['ordinal']:04}-{group[-1]['ordinal']:04}",
                             "content_set_sha256": content_set, "start_ordinal": group[0]["ordinal"],
                             "end_ordinal": group[-1]["ordinal"], "start_verse_id": group[0]["verse_id"],
                             "end_verse_id": group[-1]["verse_id"], "n_success": len(group), "n_eligible": len(good),
                             "baseline_playback_lufs": weighted_median([playback(r) for r in good], [min(20, r["measured"]["activity"]["active_duration_s"]) for r in good]),
                             "status": "recording_condition_hypothesis" if selected else "observed_contiguous_run_no_change_established",
                             "confidence_score": min([c["confidence_score"] for c in selected]) if selected else None,
                             "review_required": bool(selected), "historical_session_confirmed": False})
    return segments, change_points


def find_anomalies(records, prof, segments, source, config):
    cfg = config["inference"]; results = []
    by_ordinal = {r["ordinal"]: r for r in records}
    threshold = cfg[source["kind"] + "_outlier_z"] if source["kind"] in ("mujawwad", "translation") else cfg["recitation_outlier_z"]
    seg_by_id = {}
    for seg in segments:
        for i in range(seg["start_ordinal"], seg["end_ordinal"] + 1):
            seg_by_id[i] = seg["id"]
    for r in records:
        def add(kind, severity, confidence, evidence):
            review_priority = {"high": 80, "medium": 50, "low": 10}[severity]
            if kind == "high_true_peak":
                review_priority = min(100, review_priority + max(0, evidence["true_peak_dbtp"]) * 2)
            elif kind == "local_loudness_outlier":
                review_priority = min(99, review_priority + abs(evidence["residual_lu"]))
            results.append({"schema_version": SCHEMA, "data_class": "inferred", "source_id": source["id"],
                            "ordinal": r["ordinal"], "verse_id": r["verse_id"], "type": kind,
                            "severity": severity, "confidence_score": confidence,
                            "confidence_is_calibrated_probability": False, "evidence": evidence,
                            "review_priority_score": review_priority,
                            "review_required": True, "review_status": "pending", "automatic_correction_authorized": False})
        m = r["measured"]; active = m["activity"]
        if m['media']['codec']!='mp3' and r['url'].lower().endswith('.mp3'):
            add('codec_does_not_match_mp3_extension','medium',.95,
                {'codec':m['media']['codec'],'url':r['url'],'decode_succeeded':True,
                 'not_audio_corruption_by_itself':True,'player_format_and_mime_compatibility_requires_review':True})
        for flag in m["quality_flags"]:
            if flag in ("near_silent", "possible_clipping_requires_review", "container_decoded_duration_mismatch", "decoder_warning"):
                metadata_only = flag == "decoder_warning" and m["decoder_warnings"] and all(
                    "Error reading comment frame, skipped" in w or "Error reading lyrics, skipped" in w
                    for w in m["decoder_warnings"])
                add("container_metadata_warning" if metadata_only else flag,
                    "low" if metadata_only else "high" if flag == "near_silent" else "medium", .8,
                    {"measured_flag": flag, "decoder_warnings": m["decoder_warnings"],
                     "audio_corruption_not_established": bool(metadata_only)})
        tp = m["loudness"]["true_peak_dbtp"]
        if tp is not None and tp > -1:
            add("high_true_peak", "high" if tp > 0 else "medium", .95, {"true_peak_dbtp": tp, "clipping_is_not_proven": True})
        for side in ("leading", "trailing"):
            value = active[side + "_low_energy_s"]
            if value is not None and value > max(2, m["duration_s"] * .3):
                add("excess_" + side + "_low_energy", "medium", .6, {"duration_s": value, "boundary_confidence": active["boundary_confidence"]})
        dur = m["duration_s"]
        if dur < .25 or dur > 600:
            add("unusual_duration", "high", .7, {"duration_s": dur, "verse_length_not_available": True})
        if not eligible(r, cfg):
            continue
        sid = seg_by_id.get(r["ordinal"])
        neighbors = [by_ordinal[o] for o in range(r["ordinal"] - cfg["rolling_radius_verses"], r["ordinal"] + cfg["rolling_radius_verses"] + 1)
                     if o != r["ordinal"] and o in by_ordinal
                     and seg_by_id.get(o) == sid and eligible(by_ordinal[o], cfg)]
        if len(neighbors) < cfg["minimum_neighbors"]:
            continue
        # Duration conditioning is used only when a bin has adequate support.
        values = [residual(n, prof) for n in neighbors]
        center = median(values)
        scale = max(cfg["mad_floor_lu"], 1.4826 * median([abs(v - center) for v in values]))
        diff = residual(r, prof) - center; z = abs(diff) / scale
        if z >= threshold and abs(diff) >= 4:
            short = active["active_duration_s"] < 3
            add("local_loudness_outlier", "high" if z > threshold * 1.5 else "medium", min(.9, .45 + .05*z) * (.7 if short else 1),
                {"residual_lu": diff, "rolling_median_lufs": center, "robust_z": z, "neighbor_n": len(neighbors),
                 "segment_id": sid, "duration_bin": duration_bin(r), "active_duration_s": active["active_duration_s"],
                 "natural_expression_possible": True})
    # Duplicate bytes and identical decoded PCM are distinct evidence classes.
    for key, name in (("sha256", "duplicate_file_bytes"), ("decoded_pcm_sha256", "duplicate_decoded_audio")):
        groups = defaultdict(list)
        for r in records:
            groups[r["measured"][key]].append(r)
        for digest, group in groups.items():
            if len(group) > 1:
                results.append({"schema_version": SCHEMA, "data_class": "inferred", "source_id": source["id"],
                                "type": name, "severity": "medium", "confidence_score": 1,
                                "evidence": {key: digest, "verses": [r["verse_id"] for r in group],
                                             "shared_basmala_or_refrain_may_be_intentional": True},
                                "review_required": True, "review_status": "pending", "automatic_correction_authorized": False})
    priority = {"high": 0, "medium": 1, "low": 2}
    return sorted(results, key=lambda a: (priority[a["severity"]], -a.get("review_priority_score", 50), -a["confidence_score"]))


def constrained_gain(requested, tp, cfg):
    if requested is None or tp is None:
        return {"gain_db": None, "gain_linear": None, "reason": "missing_loudness_or_true_peak", "ceiling_limited": None}
    lower = -cfg["maximum_cut_db"]; upper = cfg["maximum_boost_db"]
    ceiling_upper = cfg["true_peak_ceiling_dbtp"] - tp - .15
    feasible_upper = min(upper, ceiling_upper)
    if feasible_upper < lower:
        return {"gain_db": None, "gain_linear": None, "reason": "true_peak_requires_cut_beyond_configured_limit", "ceiling_limited": True}
    g = max(lower, min(feasible_upper, requested))
    return {"gain_db": g, "gain_linear": 10 ** (g / 20), "ceiling_limited": requested > ceiling_upper,
            "gain_limit_applied": requested < lower or requested > upper,
            "predicted_true_peak_dbtp": tp + g, "reason": None}


def recommend(records, prof, segments, anomalies, config, target, approvals):
    cfg = config["recommendation"]
    baseline = prof["baseline_playback_lufs"]
    base = target - baseline if baseline is not None else None
    segmap = {}; segs = {s["id"]: s for s in segments}
    for s in segments:
        for o in range(s["start_ordinal"], s["end_ordinal"] + 1):
            segmap[o] = s["id"]
    local = {a["ordinal"]: a for a in anomalies if a["type"] == "local_loudness_outlier"}
    out = []
    for r in records:
        m = r["measured"]; sid = segmap.get(r["ordinal"]); seg = segs.get(sid)
        seg_c = 0
        if baseline is not None and seg and seg["status"] == "recording_condition_hypothesis" and seg["baseline_playback_lufs"] is not None:
            seg_c = float(np.clip(cfg["segment_strength"] * (baseline - seg["baseline_playback_lufs"]), -cfg["maximum_segment_correction_db"], cfg["maximum_segment_correction_db"]))
        file_c = float(np.clip(-local[r["ordinal"]]["evidence"]["residual_lu"] * cfg["file_strength"], -cfg["maximum_file_correction_db"], cfg["maximum_file_correction_db"])) if r["ordinal"] in local else 0
        seg_approved = seg and any(isinstance(a, dict) and a.get("source_id") == r["source_id"] and a.get("segment_id") == sid
                                   and a.get("content_set_sha256") == seg["content_set_sha256"] for a in approvals.get("segments", []))
        file_approved = any(isinstance(a, dict) and a.get("source_id") == r["source_id"] and a.get("verse_id") == r["verse_id"]
                            and a.get("content_sha256") == m["sha256"] for a in approvals.get("files", []))
        approved_seg = seg_c if seg_approved else 0
        approved_file = file_c if file_approved else 0
        applied_request = base + approved_seg + approved_file if base is not None else None
        peak = m["loudness"]["true_peak_dbtp"]
        safe = constrained_gain(applied_request, peak, cfg)
        # Do not emit playback advice for silence / failed loudness measurements.
        if playback(r) is None or m["activity"]["near_silent"]:
            safe = constrained_gain(None, peak, cfg)
        hypothetical = constrained_gain(base + seg_c + file_c if base is not None else None, peak, cfg)
        predicted = playback(r) + safe["gain_db"] if playback(r) is not None and safe["gain_db"] is not None else None
        out.append({"schema_version": SCHEMA, "data_class": "recommended", "source_id": r["source_id"],
                    "ordinal": r["ordinal"], "verse_id": r["verse_id"], "content_sha256": m["sha256"],
                    "target_playback_lufs": target, "baseline_gain_requested_db": base,
                    "segment_id": sid, "segment_correction_candidate_db": seg_c,
                    "file_correction_candidate_db": file_c, "segment_correction_approved_db": approved_seg,
                    "file_correction_approved_db": approved_file, "review_candidates_applied": bool(approved_seg or approved_file),
                    **safe, "predicted_playback_lufs": predicted,
                    "file_target_shortfall_lu": target - predicted if predicted is not None else None,
                    "file_target_shortfall_is_not_an_error": True,
                    "hierarchical_preview_not_authorized": hypothetical,
                    "provisional": prof["provisional"], "limiting_or_compression_used": False})
    return out


def write_jsonl(path, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n")


def analyze(root):
    from quality_audit import audit
    audit(root)
    export(root)
    cfg = json.loads((root / "config.json").read_text())
    sources = json.loads((root / "sources.json").read_text())["sources"]
    approvals_path = root / "approvals.json"
    approvals = json.loads(approvals_path.read_text()) if approvals_path.exists() else {"segments": [], "files": []}
    conn = connect(root); profiles = {}; all_records = {}; all_anomalies = {}; policy_stats = []; predictions = {}
    for source in sources:
        sid = source["id"]
        records = [json.loads(p) for p, in conn.execute("SELECT payload FROM records WHERE source=? AND status='success' ORDER BY verse", (sid,))]
        all_records[sid] = records
        for r in records:
            r["_kind"] = source["kind"]
        prof = profile(records, cfg); profiles[sid] = prof
        attempted=conn.execute('SELECT count(*) FROM records WHERE source=?',(sid,)).fetchone()[0]
        prof.update(n_attempted=attempted,inventory_complete=attempted==6236,provisional=attempted<6236)
        segs, points = changes(records, prof, cfg)
        atomic_json(root / "segments" / (sid + ".json"), {"schema_version": SCHEMA, "data_class": "inferred", "source_id": sid, "segments": segs, "change_points": points})
        anomalies = find_anomalies(records, prof, segs, source, cfg)
        all_anomalies[sid] = anomalies
        write_jsonl(root / "anomalies" / (sid + ".jsonl"), anomalies)
        for target in cfg["recommendation"]["targets_lufs"]:
            recs = recommend(records, prof, segs, anomalies, cfg, target, approvals)
            predictions[(sid, target)] = {r["ordinal"]: r["predicted_playback_lufs"] for r in recs if r["predicted_playback_lufs"] is not None}
            write_jsonl(root / "recommendations" / str(target) / (sid + ".jsonl"), recs)
            compact = {"schema_version": SCHEMA, "source_id": sid, "target_playback_lufs": target,
                       "provisional": prof["provisional"], "fields": ["ordinal", "gain_db", "content_sha256"],
                       "values": [[r["ordinal"], round(r["gain_db"], 3) if r["gain_db"] is not None else None, r["content_sha256"]] for r in recs]}
            compact_path = root / "recommendations" / str(target) / (sid + ".compact.json.gz")
            with gzip.GzipFile(filename=str(compact_path), mode="wb", mtime=0) as f:
                f.write(json.dumps(compact, separators=(",", ":")).encode())
            after = [r["predicted_playback_lufs"] for r in recs if r["predicted_playback_lufs"] is not None]
            preview = [playback(o) + r["hierarchical_preview_not_authorized"]["gain_db"] for o, r in zip(records, recs)
                       if playback(o) is not None and r["hierarchical_preview_not_authorized"]["gain_db"] is not None]
            policy_stats.append({"source_id": sid, "target_lufs": target, "baseline_gain_requested_db": target - prof["baseline_playback_lufs"] if prof["baseline_playback_lufs"] is not None else None,
                                 "n": len(recs), "n_usable": len(after), "n_peak_limited": sum(bool(r["ceiling_limited"]) for r in recs),
                                 "n_gain_limited": sum(bool(r.get("gain_limit_applied")) for r in recs),
                                 "predicted_playback_lufs": stats(after), "hierarchical_unapproved_preview_lufs": stats(preview),
                                 "n_inferred_correction_candidates": sum(bool(r["segment_correction_candidate_db"] or r["file_correction_candidate_db"]) for r in recs)})
    atomic_json(root / "profiles.json", {"schema_version": SCHEMA, "data_class": "inferred", "created_at": now(), "profiles": profiles})
    atomic_json(root / "reports" / "policy-comparison.json", {"schema_version": SCHEMA, "data_class": "recommended", "policies": policy_stats})
    pairs = []
    reciters = [s for s in sources if s["kind"] != "translation"]
    translators = [s for s in sources if s["kind"] == "translation"]
    for rec in reciters:
        for tr in translators:
            a = {r["ordinal"]: playback(r) for r in all_records[rec["id"]] if eligible(r, cfg["inference"])}
            b = {r["ordinal"]: playback(r) for r in all_records[tr["id"]] if eligible(r, cfg["inference"])}
            common = sorted(a.keys() & b.keys()); diff = [b[o] - a[o] for o in common]
            pairs.append({"reciter": rec["id"], "translator": tr["id"], "n_matched_verses": len(common),
                          "median_translator_minus_reciter_lu": median(diff), "difference_distribution_lu": stats(diff),
                          "median_absolute_mismatch_lu": median([abs(d) for d in diff]),
                          "fraction_above_6lu": sum(abs(d) > 6 for d in diff) / len(diff) if diff else None,
                          "provisional": profiles[rec['id']]['provisional'] or profiles[tr['id']]['provisional']})
    atomic_json(root / "reports" / "pairing-matrix.json", {"data_class": "inferred", "schema_version": SCHEMA, "pairs": pairs})
    pair_policies = []
    for target in cfg["recommendation"]["targets_lufs"]:
        for rec in reciters:
            for tr in translators:
                a = predictions[(rec["id"], target)]; b = predictions[(tr["id"], target)]
                common = sorted(a.keys() & b.keys())
                differences = [b[o] - a[o] for o in common]
                pair_policies.append({"target_lufs": target, "reciter": rec["id"], "translator": tr["id"], "n_matched_verses": len(common),
                                      "median_difference_lu": median(differences), "median_absolute_mismatch_lu": median([abs(d) for d in differences]),
                                      "fraction_above_6lu": sum(abs(d) > 6 for d in differences) / len(differences) if differences else None})
    aggregate = []
    for target in cfg["recommendation"]["targets_lufs"]:
        group = [p for p in policy_stats if p["target_lufs"] == target]
        n = sum(p["n_usable"] for p in group)
        aggregate.append({"target_lufs": target, "n_usable": n,
                          "peak_limited_fraction": sum(p["n_peak_limited"] for p in group) / n if n else None,
                          "gain_limited_fraction": sum(p["n_gain_limited"] for p in group) / n if n else None,
                          "median_pairwise_absolute_mismatch_lu": median([p["median_absolute_mismatch_lu"] for p in pair_policies if p["target_lufs"] == target])})
    peak_budget = cfg["recommendation"].get("target_selection_maximum_peak_limited_fraction", .05)
    mismatch_budget = cfg["recommendation"].get("target_selection_maximum_extra_pair_mismatch_lu", .25)
    best_mismatch = min((a["median_pairwise_absolute_mismatch_lu"] for a in aggregate if a["median_pairwise_absolute_mismatch_lu"] is not None), default=None)
    acceptable = [a for a in aggregate if best_mismatch is not None and a["peak_limited_fraction"] is not None
                  and a["peak_limited_fraction"] <= peak_budget
                  and a["median_pairwise_absolute_mismatch_lu"] <= best_mismatch + mismatch_budget]
    selection = {"suggested_trial_target_lufs": max((a["target_lufs"] for a in acceptable), default=None),
                 "method": "highest tested target with peak-limited fraction within budget and pair mismatch close to best",
                 "maximum_peak_limited_fraction": peak_budget, "maximum_extra_pair_mismatch_lu": mismatch_budget,
                 "provisional_not_a_listening_verdict": True}
    atomic_json(root / "reports" / "pairing-policy-comparison.json", {"schema_version": SCHEMA, "data_class": "recommended",
                "aggregate": aggregate, "pairs": pair_policies, "target_selection": selection, "observed_only_provisional": True})
    # Cross-source duplicate evidence; source/channel/rate are retained for PCM hashes.
    duplicates = defaultdict(list)
    for sid, records in all_records.items():
        for r in records:
            duplicates[r["measured"]["sha256"]].append({"source_id": sid, "verse_id": r["verse_id"]})
    atomic_json(root / "reports" / "cross-source-duplicates.json", {"schema_version": SCHEMA, "data_class": "inferred", "groups": [{"sha256": h, "files": g} for h, g in duplicates.items() if len({x["source_id"] for x in g}) > 1]})
    totals = {"completed_at": now(), "events": conn.execute("SELECT count(*) FROM events").fetchone()[0],
              "downloaded_bytes_all_attempts": 0, "sum_file_processing_wall_s": 0,
              "note": "sum of per-file wall time includes concurrent work; not elapsed session time"}
    for payload, in conn.execute("SELECT payload FROM events"):
        r = json.loads(payload)
        h = r.get("last_validation_http", r.get("http", {}))
        totals["downloaded_bytes_all_attempts"] += r.get("downloaded_bytes_this_event", h.get("downloaded_bytes", 0))
        totals["sum_file_processing_wall_s"] += r.get("processing_wall_s", 0)
    first, last = conn.execute("SELECT min(at),max(at) FROM events").fetchone()
    from datetime import datetime
    totals["first_event_at"] = first; totals["last_event_at"] = last
    totals["event_span_elapsed_s"] = (datetime.fromisoformat(last) - datetime.fromisoformat(first)).total_seconds() if first and last else None
    totals["unique_successful_file_bytes"] = sum(r["measured"]["media"]["file_size_bytes"] for rs in all_records.values() for r in rs)
    totals["unique_decoded_audio_duration_s"] = sum(r["measured"]["duration_s"] for rs in all_records.values() for r in rs)
    totals['download_byte_accounting']='registered response-body bytes; partial transfers that fail before returning the payload may be uncounted; excludes protocol overhead'
    totals['registered_response_body_bytes']=totals['downloaded_bytes_all_attempts']
    totals['network_bytes_are_a_lower_bound']=True
    totals["status_counts"] = dict(conn.execute("SELECT status,count(*) FROM records GROUP BY status"))
    failures = [json.loads(p) for p, in conn.execute("SELECT payload FROM records WHERE status!='success' ORDER BY source,verse")]
    for r in failures:
        if r.get("quality_audit", {}).get("classification") == "partial_decode_error":
            r["failure_classification"] = "partial_decode_error; diagnostic_metrics_not_valid_for_gain"
        elif r.get("http", {}).get("http_status") == 200 and r.get("http", {}).get("response_bytes") == 0:
            r["failure_classification"] = "http_200_empty_file"
        else:
            r["failure_classification"] = r["status"]
    write_jsonl(root / "reports" / "failures.jsonl", failures)
    quality = []
    for source in sources:
        rs = all_records[source["id"]]
        quality.append({"source_id": source["id"], "n_success": len(rs),
                        'codec_counts':{codec:sum(r['measured']['media']['codec']==codec for r in rs) for codec in sorted({r['measured']['media']['codec'] for r in rs})},
                        'codec_extension_mismatch':sum(r['measured']['media']['codec']!='mp3' and r['url'].lower().endswith('.mp3') for r in rs),
                        "true_peak_above_0_dbtp": sum(r["measured"]["loudness"]["true_peak_dbtp"] is not None and r["measured"]["loudness"]["true_peak_dbtp"] > 0 for r in rs),
                        "possible_clipping": sum("possible_clipping_requires_review" in r["measured"]["quality_flags"] for r in rs),
                        "near_silent": sum(r["measured"]["activity"]["near_silent"] for r in rs),
                        "decoder_warning": sum("decoder_warning" in r["measured"]["quality_flags"] for r in rs)})
    atomic_json(root / "reports" / "quality-summary.json", {"schema_version": SCHEMA, "sources": quality})
    atomic_json(root / "reports" / "processing-statistics.json", totals)
    from duration_review import write_review
    write_review(root,sources,all_records,cfg)
    conn.close()
    from report import build_report
    build_report(root, sources, all_records, profiles, all_anomalies, policy_stats, pairs)
    print(json.dumps({"analyzed_success": sum(len(v) for v in all_records.values()), "reports": str(root / "reports")}), flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__); p.add_argument("--root", type=Path, default=ROOT)
    analyze(p.parse_args().root.resolve())
