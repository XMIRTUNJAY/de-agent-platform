import sys
sys.path.insert(0, '.')

import yaml
import glob
import json
from pipelines.lib.review_checks import reviewDraft

with open('src/data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)
registry_ids = set(r['id'] for r in reg['resources'])

for f in glob.glob('data/drafts/**/*.yaml', recursive=True):
    with open(f, 'r', encoding='utf-8') as fp:
        docs = yaml.safe_load(fp)
    if not docs:
        continue
    for r in docs:
        if r.get('id') and r.get('id').startswith('ref-'):
            result = reviewDraft({**r, 'draft_kind': r.get('draft_kind', 'brief'), 'body': r.get('body', ''), 'related': r.get('related', []), 'description': r.get('description', '')}, {'ids': registry_ids})
            if result.score.fail == 0:
                print('PASS:', r['id'], '|', r.get('verification'), '|', r.get('source'))
            else:
                print('FAIL:', r['id'], '| fails=', result.score.fail)