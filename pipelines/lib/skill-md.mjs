/**
 * SKILL.MD EMISSION — build a spec-valid Agent Skills file from a record.
 *
 * Frontmatter carries name + description (the two fields agents read for
 * auto-activation). Body is assembled ONLY from the record's own fields:
 * description, learning objectives, and body/rules text. Sources and the
 * registry page are linked; nothing is rephrased or invented.
 */
export function skillName(slug) {
  return String(slug).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

export function buildSkillMd(record, { siteUrl = 'https://emanisha.in/de-agent' } = {}) {
  const name = skillName(record.slug);
  const desc = String(record.description ?? record.tagline ?? record.title)
    .replace(/\s+/g, ' ').trim().slice(0, 500);
  const lines = ['---', `name: ${name}`, `description: ${desc}`];
  if (record.license) lines.push(`license: ${record.license}`);
  lines.push('---', '');
  lines.push(`# ${record.title}`, '');
  if (record.tagline) lines.push(`> ${record.tagline}`, '');
  if (record.description) lines.push(record.description.trim(), '');
  if ((record.learning_objectives ?? []).length > 0) {
    lines.push('## You will learn', '');
    for (const o of record.learning_objectives) lines.push(`- ${o}`);
    lines.push('');
  }
  if (record.when_to_use) {
    lines.push('## When to use', '');
    const items = Array.isArray(record.when_to_use) ? record.when_to_use : [record.when_to_use];
    for (const w of items) lines.push(`- ${w}`);
    lines.push('');
  }
  if (record.body && typeof record.body === 'string' && record.body.trim()) {
    lines.push('## Reference', '', record.body.trim().slice(0, 8000), '');
  }
  if (record.install_command) lines.push('## Install', '', '```', record.install_command, '```', '');
  const page = `${siteUrl}/${record.url ?? ''}`.replace(/([^:])\/{2,}/g, '$1/');
  lines.push('---', '', `Source record: ${page}`);
  if (record.source_refs?.length > 0) lines.push(`Built from: ${record.source_refs.join(', ')}`);
  return lines.join('\n') + '\n';
}
