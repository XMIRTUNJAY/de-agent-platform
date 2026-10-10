import json
with open('src/data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)

for r in reg['resources']:
    if r.get('page_eligibility', {}).get('state') == 'needs_review':
        es = r.get('evidence_summary', {})
        print(f'Needs review: {r["id"]}: ver={r.get("verification")}, earned={es.get("earned")}, claimed={es.get("claimed")}, gap={es.get("gap")}, depth={r.get("depth",{}).get("level")}')