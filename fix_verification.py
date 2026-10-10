import json

with open('src/data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)

# Fix 1: Lower reviewed -> community where gap=1 (only metadata_validated evidence)
fixed = 0
for r in reg['resources']:
    es = r.get('evidence_summary', {})
    gap = es.get('gap', 0)
    verification = r.get('verification', 'community')
    if verification == 'reviewed' and gap == 1:
        # Only has metadata_validated, lower to community
        r['verification'] = 'community'
        fixed += 1

# Fix 2: Lower tested -> community if gap > 0
for r in reg['resources']:
    es = r.get('evidence_summary', {})
    gap = es.get('gap', 0)
    verification = r.get('verification', 'community')
    if verification == 'tested' and gap > 0:
        r['verification'] = 'community'

print(f"Fixed {fixed} reviewed->community")

# Save back
with open('src/data/generated/registry.json', 'w', encoding='utf-8') as f:
    json.dump(reg, f, ensure_ascii=False, indent=2)

print("Done fixing verification levels")