#!/usr/bin/env python3
"""Run the unchanged analyzer in isolated processes; retain its exact fingerprint.

Only measurement scheduling changes. The downloader, native PCM and BS.1770
implementation are the original pipeline/measure functions. Each input path
stays alive until the measurement future finishes. No audio is re-encoded.
"""
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
import argparse
import hashlib
import json
import multiprocessing
import os
from pathlib import Path
import sqlite3
import sys

from measure import measure as original_measure
import pipeline

POOL = None


def isolated_measure(path, config):
    try:
        return POOL.submit(original_measure, path, config).result()
    except BrokenProcessPool as error:
        # A lost worker is an infrastructure failure, never an invalid MP3.
        raise SystemExit('Measurement worker failed; resume the saved checkpoint') from error


def event_id(root):
    db = root/'checkpoints/state.sqlite3'
    if not db.exists():
        return 0
    with sqlite3.connect(db) as conn:
        return conn.execute('SELECT coalesce(max(id),0) FROM events').fetchone()[0]


def main():
    global POOL
    parser=argparse.ArgumentParser(add_help=False)
    parser.add_argument('--root',type=Path,default=pipeline.ROOT)
    options,_=parser.parse_known_args();root=options.root.resolve()
    workers = int(os.environ.get('QURAN_DSP_PROCESSES', '6'))
    if not 1 <= workers <= 16:
        raise ValueError('QURAN_DSP_PROCESSES must be between 1 and 16')
    script = Path(__file__)
    digest = hashlib.sha256(script.read_bytes()).hexdigest()
    folder = root/'execution-runs'; folder.mkdir(exist_ok=True)
    ident = pipeline.now().replace(':','-')
    record = {'schema_version':'1.0.0','kind':'execution_provenance',
              'started_at':pipeline.now(),'scheduler_sha256':digest,
              'measurement_processes':workers,'multiprocessing_context':'spawn',
              'argv':sys.argv[1:],'openblas_num_threads':os.environ.get('OPENBLAS_NUM_THREADS'),
              'event_id_before':event_id(root),
              'measurement_function':'unchanged measure.measure',
              'download_parameters':json.loads((root/'config.json').read_text())['download']}
    (folder/(digest+'.py')).write_bytes(script.read_bytes())
    target=folder/(ident+'.json'); pipeline.atomic_json(target,record)
    try:
        with ProcessPoolExecutor(max_workers=workers,mp_context=multiprocessing.get_context('spawn')) as pool:
            POOL=pool
            pipeline.measure=isolated_measure
            pipeline.main()
    finally:
        record.update(ended_at=pipeline.now(),event_id_after=event_id(root))
        pipeline.atomic_json(target,record)


if __name__ == '__main__':
    main()
