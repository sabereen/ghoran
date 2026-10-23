import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from scipy.io import wavfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from measure import activity, measure

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "config.json").read_text())


class MeasurementTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "signal.wav"

    def tearDown(self):
        self.tmp.cleanup()

    def analyze(self, samples, rate=48000):
        wavfile.write(self.path, rate, np.asarray(samples, dtype=np.float32))
        return measure(self.path, CONFIG)

    def test_calibrated_sine_and_dual_mono_convention(self):
        t = np.arange(48000 * 4) / 48000
        x = .1 * np.sin(2 * np.pi * 1000 * t)
        mono = self.analyze(x)
        self.assertAlmostEqual(mono["rms_dbfs"], -23.0103, places=3)
        self.assertAlmostEqual(mono["sample_peak_dbfs"], -20, places=3)
        self.assertAlmostEqual(mono["loudness"]["integrated_lufs"], -23.0, delta=.1)
        stereo = self.analyze(np.column_stack([x, x]))
        self.assertAlmostEqual(stereo["loudness"]["integrated_lufs"] - mono["loudness"]["integrated_lufs"], 3.0103, delta=.02)
        self.assertAlmostEqual(stereo["dualmono_playback_lufs"], mono["dualmono_playback_lufs"], delta=.02)
        self.assertIsNone(mono["loudness"]["lra_lu"])

    def test_silence_has_null_loudness_not_zero(self):
        result = self.analyze(np.zeros(48000 * 4))
        self.assertIsNone(result["loudness"]["integrated_lufs"])
        self.assertIsNone(result["loudness"]["true_peak_dbtp"])
        self.assertIsNone(result["rms_dbfs"])
        self.assertEqual(result["activity"]["active_duration_s"], 0)
        self.assertIn("near_silent", result["quality_flags"])

    def test_short_utterance_never_uses_warmup_as_measurement(self):
        t = np.arange(9600) / 48000
        result = self.analyze(.1 * np.sin(2 * np.pi * 1000 * t))
        self.assertIsNone(result["loudness"]["integrated_lufs"])
        self.assertEqual(result["loudness"]["null_reasons"]["integrated_lufs"], "less_than_400ms")
        self.assertEqual(result["loudness"]["momentary_above_absolute_gate_lufs"]["n"], 0)
        self.assertEqual(result["loudness"]["shortterm_above_absolute_gate_lufs"]["n"], 0)

    def test_activity_keeps_quiet_onsets_and_antiphase_channels(self):
        rate = 10000
        x = np.zeros(rate * 5)
        t = np.arange(rate * 3) / rate
        x[rate:4 * rate] = .1 * np.sin(2 * np.pi * 500 * t)
        x[rate:rate + 1500] *= .01
        out, spectral = activity(np.column_stack([x, -x]), rate, CONFIG["activity"])
        self.assertLessEqual(out["audible_start_estimate_s"], 1.1)
        self.assertGreaterEqual(out["audible_end_estimate_s"], 4)
        self.assertGreater(out["active_duration_s"], 2.9)
        self.assertGreaterEqual(out["trailing_low_energy_s"], 0)
        self.assertAlmostEqual(spectral["centroid_hz"], 500, delta=10)

    def test_true_peak_can_exceed_sample_peak_and_decode_errors_fail(self):
        # Quarter-rate sinusoid with phase pi/4 has intersample peaks.
        t = np.arange(48000 * 2)
        x = .8 * np.sin(2 * np.pi * .25 * t + np.pi / 4)
        result = self.analyze(x)
        self.assertGreater(result["loudness"]["true_peak_dbtp"], result["sample_peak_dbfs"] + 1)
        self.path.write_bytes(b"not audio")
        with self.assertRaises(Exception):
            measure(self.path, CONFIG)


if __name__ == "__main__":
    unittest.main()
