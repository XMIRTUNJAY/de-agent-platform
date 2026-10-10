/**
 * EXEC-POLICY — the gate in front of every command the engine runs.
 *
 * Pure and offline. A manifest executes only when it is curator-approved,
 * offline, workdir-jailed, and well-formed. Anything else is blocked with a
 * reason BEFORE anything spawns. Untrusted input (including anything an LLM
 * suggested) never reaches a shell: there is no shell (`shell: false`).
 */
const VALID = {
  trust: ['curator-approved'],
  network: ['off'],
  filesystem: ['workdir-only'],
};

export function evaluatePolicy(manifest) {
  const reasons = [];
  const block = (code, detail) => reasons.push({ code, detail });
  if (!VALID.trust.includes(manifest.trust)) block('untrusted-manifest', `trust is ${JSON.stringify(manifest.trust)}; must be curator-approved by a human`);
  if (!VALID.network.includes(manifest.capabilities?.network)) block('network-not-supported', 'only network: off is supported; no backend grants network access yet');
  if (!VALID.filesystem.includes(manifest.capabilities?.filesystem)) block('unsupported-filesystem', 'only filesystem: workdir-only is supported');
  if (typeof manifest.workdir === 'string' && (isAbsolute(manifest.workdir) || manifest.workdir.split(/[\\/]/).includes('..'))) {
    block('path-escape', `workdir ${JSON.stringify(manifest.workdir)} must be repo-relative without ..`);
  }
  for (const c of manifest.commands ?? []) {
    const bin = c.argv?.[0] ?? '';
    if (isAbsolute(bin) || String(bin).split(/[\\/]/).includes('..')) block('path-escape', `command ${c.name ?? bin}: binary must be a bare name or repo-relative path`);
    if (!c.name || !Array.isArray(c.argv) || c.argv.length === 0) block('malformed-command', 'every command needs a name and a non-empty argv');
  }
  if ((manifest.commands ?? []).length === 0) block('no-commands', 'manifest declares no commands');
  return { eligible: reasons.length === 0, reasons };
}

function isAbsolute(p) {
  return /^[a-zA-Z]:[\\/]/.test(String(p)) || String(p).startsWith('/') || String(p).startsWith('\\\\');
}

const TRANSITIONS = {
  discovered: ['collect'],
  collected: ['normalize'],
  normalized: ['mark-eligible'],
  eligible_for_execution: ['start'],
  running: ['pass', 'fail', 'timeout', 'block'],
  passed: [],
  failed: [],
  blocked: [],
};
const EVENT_STATE = { collect: 'collected', normalize: 'normalized', 'mark-eligible': 'eligible_for_execution', start: 'running', pass: 'passed', fail: 'failed', timeout: 'failed', block: 'blocked' };

export function nextState(state, event) {
  if ((TRANSITIONS[state] ?? []).includes(event)) return { ok: true, state: EVENT_STATE[event] };
  return { ok: false, state };
}

export function classifyFailure(outcome) {
  if (outcome.timedOut) return { category: 'timeout', detail: `exceeded ${outcome.timeoutMs}ms` };
  if (outcome.overflow) return { category: 'output-overflow', detail: `exceeded ${outcome.maxBytes} bytes of output` };
  if (outcome.error?.code === 'ENOENT') return { category: 'missing-executable', detail: `binary not found: ${outcome.error.path ?? outcome.argv0 ?? 'unknown'}` };
  if (outcome.error) return { category: 'spawn-error', detail: String(outcome.error.message ?? outcome.error) };
  return { category: 'nonzero-exit', detail: `exit code ${outcome.exitCode}` };
}
