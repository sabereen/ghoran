#!/usr/bin/env python3
"""Optional check against EBU's published -23 LUFS mono reference signal."""
import hashlib
import argparse
import json
from pathlib import Path
import tempfile
import shutil
import urllib.request

from measure import measure
from pipeline import ROOT, atomic_json, now

URL = "https://tech.ebu.ch/files/live/sites/tech/files/shared/testmaterial/EBU-reference_listening_signal_pinknoise_500Hz_2kHz_R128.wav"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="reuse an already downloaded EBU reference WAV")
    args = parser.parse_args()
    cfg = json.loads((ROOT / "config.json").read_text())
    with tempfile.TemporaryDirectory(prefix="ebu-reference-") as temp:
        path = Path(temp) / "reference.wav"
        try:
            if args.input:
                shutil.copyfile(args.input, path)
            else:
                request = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://tech.ebu.ch/loudness"})
                with urllib.request.urlopen(request, timeout=60) as response, path.open("wb") as out:
                    while True:
                        chunk = response.read(131072)
                        if not chunk:
                            break
                        out.write(chunk)
        except Exception as exc:
            report = {"checked_at": now(), "source_url": URL, "expected_native_lufs": -23,
                      "status": "reference_download_unavailable", "passed": None,
                      "error": {"type": type(exc).__name__, "message": str(exc)},
                      "not_full_ebu_conformance_certification": True}
            atomic_json(ROOT / "reports/calibration-reference.json", report)
            print(json.dumps(report), flush=True)
            raise SystemExit(2)
        result = measure(path, cfg)
        value = result["loudness"]["integrated_lufs"]
        report = {"checked_at": now(), "source_url": URL, "publisher": "EBU Technology & Innovation",
                  "expected_native_lufs": -23, "tolerance_lu": .2,
                  "measured_native_lufs": value, "passed": value is not None and abs(value + 23) <= .2,
                  "not_full_ebu_conformance_certification": True, "measured": result}
        atomic_json(ROOT / "reports/calibration-reference.json", report)
        print(json.dumps({k: v for k, v in report.items() if k != "measured"}), flush=True)
        if not report["passed"]:
            raise SystemExit(1)


if __name__ == "__main__":
    main()
