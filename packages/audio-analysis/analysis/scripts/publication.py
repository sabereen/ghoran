"""Keep accepted local revisions distinct from verified canonical-URL publication."""
import json
import sqlite3
from collections import Counter
from pipeline import atomic_json


def write_publication(root):
    with sqlite3.connect(root / 'checkpoints/state.sqlite3') as conn:
        replacements = []
        for payload, in conn.execute("SELECT payload FROM records ORDER BY source,verse"):
            r = json.loads(payload)
            revision = r.get('content_replacement')
            if revision:
                replacements.append({'source_id': r['source_id'], 'verse_id': r['verse_id'],
                                     'ordinal': r['ordinal'], 'url': r['url'], 'sha256': r['measured']['sha256'],
                                     **revision})
    pending = [r for r in replacements if not r['canonical_url_publication'].get('verified', False)]
    result = {'schema_version': '1.0.0', 'data_class': 'provenance',
              'accepted_replacement_count': len(replacements), 'pending_publication_count': len(pending),
              'all_accepted_replacements_published_and_verified': not pending,
              'pending_by_source': dict(Counter(r['source_id'] for r in pending)),
              'coverage_basis': 'latest accepted audio content; local revisions do not imply that canonical URLs already serve these bytes',
              'replacements': replacements}
    atomic_json(root / 'reports/replacement-publication.json', result)
    progress_path = root / 'reports/progress.json'
    if progress_path.exists():
        progress = json.loads(progress_path.read_text())
        progress['replacement_publication'] = {k:v for k,v in result.items() if k != 'replacements'}
        atomic_json(progress_path, progress)
    return result
