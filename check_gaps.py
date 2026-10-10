import json
with open('src/data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)

from collections import Counter
gaps = Counter(r.get('evidence_summary', {}).get('gap', 0) for r in reg['resources'])
print('Gap distribution:', dict(gaps))

# Check first 10
for r in reg['resources'][:5]:
    es = r.get('evidence_summary', {})
    print(f"{r['id']}: ver={r.get('verification')}, earned={es.get('earned')}, claimed={es.get('claimed')}, gap={es.get('gap')}, depth={r.get('depth',{}).get('level')}")