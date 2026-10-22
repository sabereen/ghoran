"""Conservative duration hypotheses using same-verse peers and source tempo.

This never treats expressive timing as an established error or changes gain.
"""
from collections import defaultdict
import json
import math

import numpy as np

from pipeline import atomic_json


def review(sources, records, config):
    cfg=config['inference']; peers=defaultdict(dict)
    source_by={s['id']:s for s in sources}
    def family(sid):
        return 'translation' if source_by[sid]['kind']=='translation' else 'recitation'
    for sid,rows in records.items():
        for r in rows:
            duration=r['measured']['duration_s']
            if duration>0:
                peers[(family(sid),r['ordinal'])][sid]=duration
    results=[]; summaries=[]
    for source in sources:
        sid=source['id'];kind=family(sid)
        minimum=cfg.get('duration_minimum_translation_peers',2) if kind=='translation' else cfg.get('duration_minimum_recitation_peers',5)
        observations=[]
        for r in records[sid]:
            others=[d for key,d in peers[(kind,r['ordinal'])].items() if key!=sid]
            duration=r['measured']['duration_s']
            if len(others)>=minimum and duration>0:
                reference=float(np.median(others))
                observations.append((r,reference,len(others),math.log(duration/reference)))
        if len(observations)<30:
            continue
        ratios=np.array([o[3] for o in observations]);offset=float(np.median(ratios))
        scale=max(cfg.get('duration_log_mad_floor',.25),1.4826*float(np.median(np.abs(ratios-offset))))
        summaries.append({'source_id':sid,'n_reference_verses':len(observations),
                          'typical_tempo_ratio_to_peers':math.exp(offset),'log_mad_scale':scale})
        for row,reference,n,ratio in observations:
            residual=ratio-offset;z=abs(residual)/scale;factor=math.exp(residual)
            if z<cfg.get('duration_outlier_z',4) or abs(residual)<math.log(cfg.get('duration_minimum_outlier_factor',4)):
                continue
            results.append({'schema_version':'1.0.0','data_class':'inferred','source_id':sid,
                'ordinal':row['ordinal'],'verse_id':row['verse_id'],'type':'cross_source_duration_outlier',
                'severity':'medium','confidence_score':.6,'confidence_is_calibrated_probability':False,
                'review_priority_score':min(95,55+5*z),'review_required':True,'review_status':'pending',
                'automatic_correction_authorized':False,
                'evidence':{'duration_s':row['measured']['duration_s'],'same_verse_peer_median_s':reference,
                    'peer_count':n,'peer_family':kind,'expected_from_peer_and_source_tempo_s':reference*math.exp(offset),
                    'duration_ratio_to_expected':factor,'robust_log_z':z,
                    'possible_truncation':factor<1,'natural_expression_or_repetition_possible':True,
                    'not_an_independent_check_of_verse_identity':True}})
    return sorted(results,key=lambda r:-r['review_priority_score']),summaries


def write_review(root,sources,records,config):
    rows,summaries=review(sources,records,config)
    path=root/'anomalies/cross-source-duration.jsonl'
    path.parent.mkdir(exist_ok=True)
    with path.open('w') as f:
        for row in rows:
            f.write(json.dumps(row,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n')
    atomic_json(root/'reports/duration-review.json',{'schema_version':'1.0.0','data_class':'inferred',
        'method':'log duration relative to same-verse peer median, corrected for source median tempo; robust MAD',
        'source_summaries':summaries,'candidate_count':len(rows),'candidates':rows,
        'human_review_required':True,'automatic_correction_authorized':False})
    return rows
