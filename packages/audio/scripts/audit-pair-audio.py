"""Download real samples, verify bytes and remeasure gain-applied PCM with FFmpeg.
No MP3 encoding or source modification. Only temporary downloaded originals.
Usage: python scripts/audit-pair-audio.py reports/pair-validation.json
"""
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

report_path = Path(sys.argv[1])
plan = json.loads(report_path.read_text())["renderPlan"]

def measure(row):
    with tempfile.TemporaryDirectory() as tmp:
        data = urllib.request.urlopen(row["url"], timeout=60).read()
        assert hashlib.sha256(data).hexdigest() == row["sha256"], row["url"]
        path = Path(tmp) / "original.mp3"
        path.write_bytes(data)
        upmix = "pan=stereo|c0=c0|c1=c0," if row["channels"] == 1 else ""
        values = {}
        for mode, gain in [("baseline",row["baseGainDb"]),("paired",row["gainDb"])]:
            result = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",str(path),"-af",
                f"{upmix}volume={gain}dB,ebur128=peak=true", "-f","null","-"],capture_output=True,text=True,check=True)
            summary = result.stderr.rsplit("Summary:",1)[1]
            values[mode] = {"integratedLufs":float(re.search(r"I:\s*([-\d.]+) LUFS",summary)[1]),
                "truePeakDbtp":float(re.search(r"Peak:\s*([-\d.]+) dBFS",summary)[1])}
        assert abs(values["paired"]["integratedLufs"] - row["predictedLufs"]) <= .25
        assert values["paired"]["truePeakDbtp"] <= -1.0
        return {**row,"downloadBytes":len(data),"measuredOutputs":values}

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    rows = list(pool.map(measure, plan))
pairs = []
for index in sorted({row["ayahIndex"] for row in rows}):
    r,t = [next(row for row in rows if row["ayahIndex"] == index and row["sourceId"] == sid) for sid in ["motaz","maleki"]]
    pairs.append({"ayahIndex":index,**{mode:t["measuredOutputs"][mode]["integratedLufs"]-r["measuredOutputs"][mode]["integratedLufs"] for mode in ["baseline","paired"]}})
    assert abs(pairs[-1]["paired"]) <= 1.3
output = {"classification":"measured-decoded-pcm-after-static-gain","ffmpegVersion":subprocess.check_output(["ffmpeg","-version"],text=True).splitlines()[0],
    "downloadedFiles":len(rows),"downloadBytes":sum(row["downloadBytes"] for row in rows),"pairs":pairs,"files":rows}
report_path.with_name("pair-audio-validation.json").write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({k:v for k,v in output.items() if k != "files"},ensure_ascii=False))
