import gzip, hashlib, json, math, pathlib, re, statistics, subprocess, tempfile, urllib.request
ARCHIVE = "https://raw.githubusercontent.com/sabereen/ghoran/fbd55d0fe9c3cf5559a0af9e0b6ca1e9da37d365/packages/audio/data/"
root = pathlib.Path("packages/audio/data")
ids = ["motaz", "maleki"]
samples = [(0,"001001"),(1,"001002"),(2,"001003"),(261,"002255"),(6221,"112001"),(6222,"112002")]
def download(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"Quran-audio-listening-audit/1.0"}), timeout=60) as response:
        return response.read()
def measure(path, filters):
    p = subprocess.run(["ffmpeg","-hide_banner","-nostats","-i",str(path),"-af",filters+",ebur128=peak=true","-f","null","-"],capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-2000:])
    loud = re.findall(r"Integrated loudness:\s+I:\s+([-\d.]+) LUFS", p.stderr)
    peak = re.findall(r"True peak:\s+Peak:\s+([-\d.]+) dBFS", p.stderr)
    return {"integrated_lufs":float(loud[-1]) if loud else None,"true_peak_dbtp":float(peak[-1]) if peak else None}
print("FFMPEG "+subprocess.check_output(["ffmpeg","-version"],text=True).splitlines()[0],flush=True)
results={}
for sid in ids:
    source=json.loads((root/"sources"/(sid+".json")).read_text())
    records=[json.loads(line) for line in gzip.decompress(download(ARCHIVE+"measurements/"+sid+".jsonl.gz")).decode().splitlines()]
    by={r["ordinal"]-1:r for r in records}
    print("ARCHIVED_FIRST_RECORD "+sid+" "+json.dumps(by[0]["measured"]),flush=True)
    print("ARCHIVED_FIRST_30 "+sid+" "+json.dumps([{"index":i,"loudness":by[i]["measured"]["loudness"],"activity":by[i]["measured"].get("activity")} for i in range(30)]),flush=True)
    policy=source["policies"]["-20"]; exceptions={i:(gain,limited) for i,gain,limited in policy["overrides"]}
    outputs=[]
    for index,stem in samples:
        payload=download(source["metadata"]["urlTemplate"].replace("{file_stem}",stem))
        expected=(root/"hashes"/(sid+".bin")).read_bytes()[index*32:(index+1)*32].hex()
        assert hashlib.sha256(payload).hexdigest()==expected, (sid,index,"changed source")
        gain=(exceptions.get(index,(policy["base"],False))[0])/100
        with tempfile.TemporaryDirectory() as directory:
            path=pathlib.Path(directory)/"audio.mp3"; path.write_bytes(payload)
            probe=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(path)],text=True))
            stream=next(s for s in probe["streams"] if s["codec_type"]=="audio")
            channels=stream["channels"]
            pan="pan=stereo|c0=c0|c1=c0" if channels==1 else "anull"
            native=measure(path,"anull")
            rendered=measure(path,pan+",volume="+str(gain)+"dB")
            outputs.append({"index":index,"stem":stem,"channels":channels,"duration":float(probe["format"]["duration"]),"applied_gain_db":gain,"native":native,"normalized_stereo":rendered,"archived_integrated":by[index]["measured"]["loudness"]["integrated_lufs"]})
            print("SAMPLE "+sid+" "+json.dumps(outputs[-1]),flush=True)
    results[sid]=outputs
differences=[]
for m,k in zip(results["motaz"],results["maleki"]):
    differences.append({"index":m["index"],"stem":m["stem"],"maleki_minus_motaz_lu":round(k["normalized_stereo"]["integrated_lufs"]-m["normalized_stereo"]["integrated_lufs"],2)})
print("PAIR_DIFFERENCES "+json.dumps(differences),flush=True)
pathlib.Path("listening-audit.json").write_text(json.dumps({"samples":results,"pair_differences":differences},indent=2))
