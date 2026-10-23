#!/usr/bin/env python3
"""One targeted late recheck of invalid files; never refetch confirmed successes."""
import argparse
import fcntl
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time

from measure import measure
from pipeline import ROOT, Downloader, connect, export, now
from quality_audit import audit


def recheck(root, force=False):
    cfg=json.loads((root/'config.json').read_text())
    # First include partially decoded records in the invalid-only inventory.
    audit(root)
    conn=connect(root)
    rows=[json.loads(p) for p, in conn.execute("SELECT payload FROM records WHERE status='invalid' ORDER BY source,verse")]
    downloader=Downloader(cfg['download']);summary=[]
    try:
        for old in rows:
            if old.get('invalid_recheck') and not force:
                continue
            started=time.monotonic()
            previous=old.get('measured',{}).get('sha256',old.get('download_sha256'))
            run=json.loads((root/'measurement-runs'/(old['measurement_config_sha256']+'.json')).read_text())['parameters']
            assert run['activity']==cfg['activity'] and run['loudness']==cfg['loudness'], 'Resume the current measurement revision before rechecking'
            assert all(hashlib.sha256((root/'scripts'/name).read_bytes()).hexdigest()==digest for name,digest in run['code'].items())
            assert run['ffmpeg']==subprocess.check_output(['ffmpeg','-version'],text=True)
            with tempfile.TemporaryDirectory(prefix='quran-recheck-') as folder:
                path=Path(folder)/'input.mp3';http=downloader.get(old['url'],path)
                current=hashlib.sha256(path.read_bytes()).hexdigest() if http['status']=='downloaded' else None
                record=dict(old);record['last_validation_http']=http;record['revalidated_at']=now()
                record['invalid_recheck']={'previous_status':'invalid','previous_sha256':previous,
                    'response_sha256':current,'same_content':current==previous if current is not None else None,
                    'purpose':'confirm invalid content after the full extraction, with no success refetch'}
                if current is not None:
                    probe=subprocess.run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)],capture_output=True,text=True,timeout=60)
                    record['invalid_recheck'].update(probe_returncode=probe.returncode,probe_stderr=probe.stderr[-3000:])
                    if current!=previous:
                        record.pop('measured',None);record.pop('quality_audit',None);record.pop('error',None);record.pop('download_sha256',None)
                        record['http']=http;record['measured_at']=now();record['previous_sha256']=previous
                        record['content_changed_at_same_url']=previous is not None
                        try:
                            record['measured']=measure(path,cfg);record['status']='success'
                        except Exception as error:
                            record['status']='invalid';record['download_sha256']=current
                            record['error']={'type':type(error).__name__,'message':str(error)}
                    else:
                        record['invalid_recheck']['analysis_reused_identical_invalid_sha256']=True
                record['processing_wall_s']=time.monotonic()-started
                payload=json.dumps(record,ensure_ascii=False,allow_nan=False,separators=(',',':'))
                conn.execute('UPDATE records SET status=?,payload=? WHERE source=? AND verse=?',(record['status'],payload,record['source_id'],record['ordinal']))
                event=dict(record,operation='invalid_content_recheck')
                conn.execute('INSERT INTO events(at,source,verse,status,payload) VALUES (?,?,?,?,?)',(now(),record['source_id'],record['ordinal'],record['status'],json.dumps(event,ensure_ascii=False,allow_nan=False,separators=(',',':'))))
                conn.commit()
                summary.append({'source_id':record['source_id'],'verse_id':record['verse_id'],'status':record['status'],'same_content':record['invalid_recheck']['same_content']})
    finally:
        downloader.close();conn.close()
    audit(root);export(root)
    print(json.dumps({'rechecked_invalid_files':summary}),flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--force',action='store_true')
    args=parser.parse_args();root=args.root.resolve()
    with (root/'checkpoints/run.lock').open('a') as lock:
        fcntl.flock(lock.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        recheck(root,args.force)
