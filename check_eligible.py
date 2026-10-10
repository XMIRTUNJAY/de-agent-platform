import json
reg = json.load(open('src/data/generated/registry.json', 'r', encoding='utf-8'))
eligible = [r for r in reg['resources'] if r.get('page_eligibility', {}).get('state') == 'eligible']
print('Eligible:', len(eligible))
for r in eligible[:5]:
    d = r.get('depth', {})
    es = r.get('evidence_summary', {})
    print(f"  {r['id']}: depth={d.get('level')}, score={d.get('score')}, gap={es.get('gap')}, stale={r.get('stale')}")