"""Target-independent measurements. No original media is modified."""
import hashlib
import json
import math
import re
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from scipy import ndimage, signal

VERSION = "0.1.0"


def db(x):
    return float(20 * math.log10(x)) if x > 0 and math.isfinite(x) else None


def stats(values):
    a = np.asarray([v for v in values if v is not None and math.isfinite(v)], dtype=float)
    if not len(a):
        return {"n": 0, "min": None, "p05": None, "median": None, "p95": None, "max": None, "mad": None}
    return {"n": len(a), "min": float(a.min()), "p05": float(np.percentile(a, 5)),
            "median": float(np.median(a)), "p95": float(np.percentile(a, 95)),
            "max": float(a.max()), "mad": float(np.median(np.abs(a - np.median(a))))}


def activity(pcm, rate, cfg):
    """Conservative, adaptive, channel-safe energy segmentation, not speech recognition."""
    hop = max(1, round(rate * cfg["frame_ms"] / 1000))
    n = len(pcm)
    count = math.ceil(n / hop)
    padded = np.pad(pcm.astype(np.float64), ((0, count * hop - n), (0, 0)))
    squares = padded.reshape(count, hop, -1) ** 2
    energies = squares.sum(axis=1) / hop
    if n % hop:
        energies[-1] *= hop / (n % hop)
    levels = 10 * np.log10(np.maximum(energies.max(axis=1), 1e-16))
    smooth = ndimage.median_filter(levels, size=3, mode="nearest")
    p10, p20, p80, p95 = np.percentile(smooth, [10, 20, 80, 95])
    # The quiet component may be a quiet phoneme; never identify it as certain noise.
    noise = float(np.median(smooth[smooth <= p20]))
    separation = float(p80 - p20)
    high = min(noise + cfg["noise_margin_db"], p95 - cfg["relative_onset_db"])
    high = max(cfg["absolute_floor_dbfs"], float(high))
    low = max(cfg["absolute_floor_dbfs"] - 6, high - cfg["hysteresis_db"])
    strong = smooth >= high
    weak = smooth >= low
    labels, _ = ndimage.label(weak)
    selected = np.unique(labels[strong]); selected = selected[selected > 0]
    mask = np.isin(labels, selected)
    # Bridge brief breaths / gaps, then retain quiet onsets and reverb with padding.
    close_frames = max(1, round(cfg["bridge_ms"] / cfg["frame_ms"]))
    # Explicit runs avoid binary_closing's erosion at the file boundaries.
    inv_labels, _ = ndimage.label(~mask)
    for lab in np.unique(inv_labels):
        if lab == 0:
            continue
        ix = np.flatnonzero(inv_labels == lab)
        if ix[0] > 0 and ix[-1] < count - 1 and len(ix) <= close_frames:
            mask[ix] = True
    pad = math.ceil(cfg["padding_ms"] / cfg["frame_ms"])
    if mask.any() and pad:
        mask = ndimage.maximum_filter1d(mask.astype(np.uint8), size=2 * pad + 1, mode="constant").astype(bool)
    # Operational silence floor, not a perceptual audibility guarantee.
    silent = float(np.max(levels)) < cfg["near_silent_peak_frame_dbfs"]
    if silent:
        mask[:] = False
    edges = np.diff(np.r_[False, mask, False].astype(int))
    runs = [(int(a * hop), int(min(b * hop, n))) for a, b in zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1))]
    intervals = [[round(a / rate, 6), round(b / rate, 6)] for a, b in runs]
    frames = np.repeat(mask, hop)[:n]
    active_pcm = pcm[frames]
    active_rms = db(float(np.sqrt(np.mean(active_pcm.astype(np.float64) ** 2)))) if len(active_pcm) else None
    active_s = sum(b - a for a, b in runs) / rate
    uncertain = separation < cfg["min_separation_db"] or count < 10
    result = {"method": "adaptive-energy-hysteresis-v1", "frame_ms": cfg["frame_ms"],
              "noise_floor_proxy_dbfs": noise, "energy_separation_db": separation,
              "threshold_on_dbfs": high, "threshold_off_dbfs": low,
              "boundary_confidence": "low" if uncertain else "moderate",
              "not_a_speech_vad": True, "near_silent": silent,
              "active_duration_s": active_s, "active_rms_dbfs": active_rms,
              "audible_start_estimate_s": intervals[0][0] if intervals else None,
              "audible_end_estimate_s": intervals[-1][1] if intervals else None,
              "leading_low_energy_s": intervals[0][0] if intervals else None,
              "trailing_low_energy_s": n / rate - intervals[-1][1] if intervals else None,
              "active_intervals_s": intervals,
              "whole_file_low_energy_s": n / rate if silent else None,
              "automatic_trim_authorized": False}
    # Quietest 10% is only a noise proxy; spectral features are duration independent.
    mono_energy = pcm.astype(np.float64).mean(axis=1)
    # Use the most energetic channel to avoid phase cancellation.
    ch = int(np.argmax(np.mean(pcm.astype(np.float64) ** 2, axis=0)))
    x = pcm[:, ch].astype(np.float64)
    if len(x) >= 256 and not silent:
        freq, psd = signal.welch(x, fs=rate, nperseg=min(2048, len(x)))
        den = float(psd.sum())
        spectral = {"centroid_hz": float(np.sum(freq * psd) / den) if den else None,
                    "high_band_fraction_above_4khz": float(psd[freq >= 4000].sum() / den) if den else None,
                    "low_band_fraction_below_200hz": float(psd[freq < 200].sum() / den) if den else None,
                    "channel_used": ch, "method": "welch-hann-native-rate"}
    else:
        spectral = {"centroid_hz": None, "reason": "too_short_or_near_silent"}
    return result, spectral


def parse_r128(meta, stderr, duration, cfg):
    frames = []
    current = None
    for line in meta.splitlines():
        if line.startswith("frame:"):
            m = re.search(r"pts_time:([\d.e+-]+)", line)
            current = {"end_s": float(m[1]) + .1} if m else None
            if current:
                frames.append(current)
        elif current is not None and line.startswith("lavfi.r128."):
            key, _, value = line.partition("=")
            try:
                current[key.removeprefix("lavfi.r128.")] = float(value)
            except ValueError:
                pass
    # FFmpeg summary is authoritative for complete-file true peak; metadata peaks
    # are rounded linear values and lose resolution for quiet files.
    summary = stderr.rsplit("Summary:", 1)[-1]
    p = re.search(r"True peak:\s*Peak:\s*([-+\w.]+)", summary)
    tp = float(p[1]) if p else None
    if tp is not None and not math.isfinite(tp):
        tp = None
    momentary = [f["M"] for f in frames if f["end_s"] >= .4 - 1e-7 and "M" in f and f["M"] > -70]
    shortterm = [f["S"] for f in frames if f["end_s"] >= 3 - 1e-7 and "S" in f and f["S"] > -70]
    last = frames[-1] if frames else {}
    integ = last.get("I")
    reasons = {}
    if duration < .4:
        integ = None; reasons["integrated_lufs"] = "less_than_400ms"
    elif not momentary or integ is None or integ <= -70:
        integ = None; reasons["integrated_lufs"] = "no_blocks_above_absolute_gate"
    lra = last.get("LRA")
    if duration < cfg["minimum_lra_duration_s"] or len(shortterm) < cfg["minimum_lra_windows"]:
        lra = None; reasons["lra_lu"] = "insufficient_duration_or_valid_3s_windows_project_policy"
    if not momentary:
        reasons["momentary"] = "no_complete_400ms_windows_above_minus70"
    if not shortterm:
        reasons["shortterm"] = "no_complete_3s_windows_above_minus70"
    if tp is None:
        reasons["true_peak_dbtp"] = "digital_silence_or_unavailable"
    return {"integrated_lufs": integ, "true_peak_dbtp": tp, "lra_lu": lra,
            "momentary_above_absolute_gate_lufs": stats(momentary),
            "shortterm_above_absolute_gate_lufs": stats(shortterm),
            "null_reasons": reasons}, frames


def measure(path, config):
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
                           capture_output=True, text=True, timeout=60, check=True)
    info = json.loads(probe.stdout)
    streams = [s for s in info["streams"] if s["codec_type"] == "audio"]
    if not streams:
        raise ValueError("no_audio_stream")
    stream = streams[0]; channels = stream["channels"]; rate = int(stream["sample_rate"])
    with tempfile.TemporaryDirectory(prefix="r128-") as work:
        meta_path = Path(work) / "r128.txt"
        command = ["ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-threads", "1", "-filter_threads", "1",
                   "-err_detect", "explode", "-i", str(path), "-map", "0:a:0", "-vn", "-sn", "-dn",
                   "-af", f"ebur128=metadata=1:peak=true:dualmono=false,ametadata=print:file={meta_path}",
                   "-c:a", "pcm_f32le", "-f", "f32le", "pipe:1"]
        proc = subprocess.run(command, capture_output=True, timeout=config["decode_timeout_s"])
        log = proc.stderr.decode("utf-8", errors="replace")
        if proc.returncode:
            raise ValueError("decode_failed: " + log[-3000:])
        pcm = np.frombuffer(proc.stdout, dtype="<f4")
        if not len(pcm) or len(pcm) % channels or not np.isfinite(pcm).all():
            raise ValueError("empty_or_invalid_decoded_pcm")
        pcm = pcm.reshape(-1, channels)
        duration = len(pcm) / rate
        loudness, frames = parse_r128(meta_path.read_text(), log, duration, config["loudness"])
    active, spectral = activity(pcm, rate, config["activity"])
    # Existing 400ms K-weighted windows are classified by their overlap with the
    # activity mask. This is NOT BS.1770 on concatenated/gap-removed speech.
    intervals = active["active_intervals_s"]
    selected_m = []
    for f in frames:
        if f["end_s"] < .4 - 1e-7 or f.get("M", -120) <= -70:
            continue
        overlap = sum(max(0, min(b, f["end_s"]) - max(a, f["end_s"] - .4)) for a, b in intervals)
        if overlap >= .3:
            selected_m.append(f["M"])
    active["active_momentary_lufs"] = stats(selected_m)
    active["active_loudness_definition"] = "400ms K-weighted windows with >=75% activity overlap; not integrated loudness"
    if not selected_m:
        loudness["null_reasons"]["active_momentary_lufs"] = "no_valid_active_400ms_windows"
    sample_peak = float(np.abs(pcm).max())
    rms = float(np.sqrt(np.mean(pcm.astype(np.float64) ** 2)))
    fmt = info["format"]
    container_duration = float(fmt["duration"]) if fmt.get("duration") else None
    flags = []
    if duration < 3:
        flags.append("short_utterance_loudness_less_representative")
    if active["near_silent"]:
        flags.append("near_silent")
    if active["boundary_confidence"] == "low":
        flags.append("uncertain_activity_boundaries")
    if loudness["true_peak_dbtp"] is not None and loudness["true_peak_dbtp"] >= -1:
        flags.append("true_peak_above_minus1_dbtp")
    above = int(np.count_nonzero(np.abs(pcm) >= 1))
    near_rail = int(np.count_nonzero(np.abs(pcm) >= .999))
    if above or near_rail:
        flags.append("possible_clipping_requires_review")
    warning_lines = [l for l in log.splitlines() if re.search(r"invalid|corrupt|error|overread|truncat", l, re.I)]
    if warning_lines:
        flags.append("decoder_warning")
    if container_duration and abs(container_duration - duration) > max(.5, duration * .02):
        flags.append("container_decoded_duration_mismatch")
    size = Path(path).stat().st_size
    native = loudness["integrated_lufs"]
    return {"loudness": loudness, "duration_s": duration, "container_duration_s": container_duration,
            "sample_peak_dbfs": db(sample_peak), "sample_peak_linear": sample_peak,
            "rms_dbfs": db(rms), "channel_rms_dbfs": [db(float(np.sqrt(np.mean(pcm[:, i].astype(np.float64) ** 2)))) for i in range(channels)],
            "decoded_samples_per_channel": len(pcm), "samples_at_or_above_full_scale": above,
            "samples_near_full_scale": near_rail, "sample_count_all_channels": int(pcm.size),
            "activity": active, "spectral": spectral,
            "media": {"codec": stream["codec_name"], "sample_rate_hz": rate, "channels": channels,
                      "channel_layout": stream.get("channel_layout"), "file_size_bytes": size,
                      "reported_bitrate_bps": int(fmt["bit_rate"]) if fmt.get("bit_rate") else None,
                      "effective_bitrate_bps": 8 * size / duration, "audio_stream_count": len(streams)},
            "channel_convention": "native BS.1770; mono counted once; no dualmono compensation",
            "dualmono_playback_lufs": native + 10 * math.log10(2) if native is not None and channels == 1 else native,
            "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest(),
            "decoded_pcm_sha256": hashlib.sha256(proc.stdout).hexdigest(),
            "quality_flags": flags, "decoder_warnings": warning_lines[:20]}
