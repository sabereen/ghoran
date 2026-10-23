import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from analyze import changes, constrained_gain, profile, recommend

CONFIG = json.loads((Path(__file__).resolve().parents[1] / "config.json").read_text())


def record(i, level):
    return {"status": "success", "source_id": "fixture", "ordinal": i, "verse_id": f"2:{i}", "surah": 2, "juz": 1,
            "_kind": "translation", "measured": {"dualmono_playback_lufs": level,
                "sha256": "a"*64,
                "loudness": {"integrated_lufs": level, "true_peak_dbtp": -3},
                "activity": {"active_duration_s": 10, "near_silent": False,
                    "leading_low_energy_s": .1, "trailing_low_energy_s": .2,
                    "noise_floor_proxy_dbfs": level - 30},
                "spectral": {"centroid_hz": 900}, "media": {"channels": 2, "sample_rate_hz": 44100}}}


class AnalysisTests(unittest.TestCase):
    def test_isolated_jump_is_not_recording_session(self):
        rs = [record(i, -20 + (12 if i == 50 else 0)) for i in range(1, 101)]
        segs, pts = changes(rs, profile(rs, CONFIG), CONFIG)
        self.assertEqual(pts, [])
        self.assertEqual(len(segs), 1)

    def test_sustained_jump_is_detected_near_boundary(self):
        rs = [record(i, -24 if i <= 50 else -18) for i in range(1, 101)]
        segs, pts = changes(rs, profile(rs, CONFIG), CONFIG)
        self.assertEqual(len(pts), 1)
        self.assertLessEqual(abs(pts[0]["at_ordinal"] - 51), 5)
        self.assertEqual(len(segs), 2)
        self.assertTrue(pts[0]["review_required"])

    def test_sparse_sampling_never_bridges_unobserved_verses(self):
        rs = [record(i, -24 if i < 100 else -18) for i in list(range(1, 21)) + list(range(100, 120))]
        segs, pts = changes(rs, profile(rs, CONFIG), CONFIG)
        self.assertEqual(pts, [])
        self.assertEqual(len(segs), 2)

    def test_gain_obeys_true_peak_and_limits(self):
        cfg = CONFIG["recommendation"]
        out = constrained_gain(8, -3, cfg)
        self.assertAlmostEqual(out["gain_db"], 1.85)
        self.assertLessEqual(out["predicted_true_peak_dbtp"], -1)
        self.assertAlmostEqual(out["gain_linear"], 10 ** (out["gain_db"] / 20))
        self.assertIsNone(constrained_gain(2, 30, cfg)["gain_db"])
        self.assertIsNone(constrained_gain(2, None, cfg)["gain_db"])
        self.assertEqual(constrained_gain(-40, -10, cfg)["gain_db"], -18)

    def test_inferred_corrections_require_exact_reviewed_content(self):
        rs = [record(i, -20) for i in range(1, 4)]
        prof = profile(rs, CONFIG)
        segments = [{"id": "segment-0001-0003", "content_set_sha256": "b"*64,
                     "start_ordinal": 1, "end_ordinal": 3, "status": "recording_condition_hypothesis", "baseline_playback_lufs": -24}]
        anomalies = [{"ordinal": 2, "type": "local_loudness_outlier", "evidence": {"residual_lu": 8}}]
        bad = {"segments": ["fixture:segment-0001-0003"], "files": [{"source_id": "fixture", "verse_id": "2:2", "content_sha256": "wrong"}]}
        out = recommend(rs, prof, segments, anomalies, CONFIG, -20, bad)
        self.assertEqual(out[1]["gain_db"], 0)
        self.assertFalse(out[1]["review_candidates_applied"])
        good = {"segments": [{"source_id": "fixture", "segment_id": "segment-0001-0003", "content_set_sha256": "b"*64}],
                "files": [{"source_id": "fixture", "verse_id": "2:2", "content_sha256": "a"*64}]}
        out = recommend(rs, prof, segments, anomalies, CONFIG, -20, good)
        self.assertEqual(out[1]["gain_db"], 1)
        self.assertTrue(out[1]["review_candidates_applied"])


if __name__ == "__main__":
    unittest.main()
