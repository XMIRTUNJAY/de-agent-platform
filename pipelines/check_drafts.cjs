const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { reviewDraft } = require('./lib/review-checks.mjs');

const REGISTRY_PATH = path.join(__dirname, '..', 'src', 'data', 'generated', 'registry.json');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const registryIds = new Set(registry.resources.map(r => r.id));

function walk(dir, fileList = []) {
  const entries = fs.readdirSync(dir);
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, fileList);
    } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const draftsDir = path.join(__dirname, '..', 'data', 'drafts');
const fileList = walk(draftsDir, []);

console.log('Checking drafts...\n');

let passCount = 0;
let failCount = 0;

for (const file of fileList) {
  const content = fs.readFileSync(file, 'utf8');
  const docs = yaml.parseAllDocuments(content).map(doc => doc.toJS());
  
  for (const draft of docs) {
    if (!draft.id || !draft.id.startsWith('ref-')) continue;
    
    const result = reviewDraft({
      ...draft,
      draft_kind: draft.draft_kind || 'brief',
      body: draft.body || '',
      related: draft.related || [],
      description: draft.description || ''
    }, { ids: new Set() });
    
    if (result.score.fail === 0) {
      console.log('PASS:', draft.id, '|', draft.verification, '|', draft.source);
    } else {
      console.log('FAIL:', draft.id, '| fails=', result.score.fail);
    }
  }
}