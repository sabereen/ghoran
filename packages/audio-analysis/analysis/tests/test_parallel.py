import json
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np
from scipy.io import wavfile

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from measure import measure


class ParallelMeasurementTests(unittest.TestCase):
    def test_spawn_worker_preserves_all_measurements_bit_for_bit(self):
        config=json.loads((Path(__file__).resolve().parents[1]/'config.json').read_text())
        rate=16000; time=np.arange(rate*4)/rate
        signal=.15*np.sin(2*np.pi*997*time)
        signal[:rate//2]=0;signal[-rate//2:]=0
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'test.wav';wavfile.write(path,rate,np.column_stack([signal,-signal]).astype(np.float32))
            expected=measure(path,config)
            with ProcessPoolExecutor(max_workers=1,mp_context=multiprocessing.get_context('spawn')) as pool:
                actual=pool.submit(measure,path,config).result()
            self.assertEqual(actual,expected)
