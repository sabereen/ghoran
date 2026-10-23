import copy
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from duration_review import review


class DurationReviewTests(unittest.TestCase):
    def corpus(self):
        sources=[{'id':str(i),'kind':'recitation'} for i in range(7)]
        rows={s['id']:[{'ordinal':o,'verse_id':f'2:{o}','measured':{'duration_s':(10+o%17)*(4 if s['id']=='6' else 1)}} for o in range(1,61)] for s in sources}
        return sources,rows,{'inference':{}}

    def test_natural_source_tempo_is_not_a_duration_error(self):
        sources,rows,config=self.corpus()
        candidates,_=review(sources,rows,config)
        self.assertEqual(candidates,[])

    def test_isolated_short_file_is_review_only_and_preserves_measurement(self):
        sources,rows,config=self.corpus();rows['0'][24]['measured']['duration_s']*=.1
        before=copy.deepcopy(rows)
        candidates,_=review(sources,rows,config)
        self.assertEqual([(r['source_id'],r['ordinal']) for r in candidates],[('0',25)])
        self.assertFalse(candidates[0]['automatic_correction_authorized'])
        self.assertEqual(rows,before)

    def test_insufficient_peer_coverage_does_not_infer_normality(self):
        sources,rows,config=self.corpus();rows={s:rs for s,rs in rows.items() if int(s)<3}
        candidates,summaries=review(sources, {s['id']:rows.get(s['id'],[]) for s in sources},config)
        self.assertEqual(candidates,[]);self.assertEqual(summaries,[])
