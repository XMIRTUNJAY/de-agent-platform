import yaml
import glob
import os

# Find all resources with verification=reviewed
resources_to_fix = []

for f in glob.glob(os.path.join(os.getcwd(), 'data', 'curated', '*', '*.yaml')):
    with open(f, 'r', encoding='utf-8') as fp:
        docs = yaml.safe_load(fp)
    if not docs:
        continue
    for r in docs:
        if isinstance(r, dict) and r.get('verification') == 'reviewed':
            resources_to_fix.append((f, r['id']))

print(f"Found {len(resources_to_fix)} resources to fix")

# Now fix them
for f, rid in resources_to_fix:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    # Replace '  verification: reviewed' with '  verification: community'
    new_content = content.replace('  verification: reviewed', '  verification: community')
    if content != new_content:
        with open(f, 'w', encoding='utf-8') as fp:
            fp.write(new_content)
        print(f'  Fixed {rid} in {f}')

print("Done fixing verification levels")