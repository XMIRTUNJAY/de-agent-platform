import yaml
import glob

# Find all resources with verification=reviewed
resources_to_fix = []

for f in glob.glob('data/curated/*/*.yaml'):
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
    lines = content.split('\n')
    new_lines = []
    in_resource = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('id:') and rid in line:
            in_resource = True
        if in_resource and stripped.startswith('verification: reviewed'):
            line = line.replace('verification: reviewed', 'verification: community')
            print(f'  Fixed {rid} in {f}')
        if in_resource and stripped == '' and not line.startswith(' '):
            # End of resource (empty line at root level)
            in_resource = False
        new_lines.append(line)
    
    with open(f, 'w', encoding='utf-8') as fp:
        fp.write('\n'.join(new_lines))

print("Done fixing verification levels")