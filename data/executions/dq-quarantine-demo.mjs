/**
 * DQ quarantine demo — runnable companion to the data-quality starter guide.
 * Seeds 5 rows (3 bad), applies one quarantine rule, and asserts the three
 * quarantine invariants: every row accounted for, published rows clean,
 * nothing silently dropped. No dependencies, no network, deterministic.
 */
const rows = [
  { order_id: 'a1', amount: 10 },
  { order_id: null, amount: 5 },
  { order_id: 'a3', amount: -1 },
  { order_id: 'a4', amount: 7 },
  { order_id: null, amount: 0 },
];

const isBad = (r) => r.order_id === null || !(r.amount > 0);
const published = rows.filter((r) => !isBad(r));
const quarantined = rows.filter(isBad);

function assert(cond, message) {
  if (!cond) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(
  published.length + quarantined.length === rows.length,
  'every row is either published or quarantined'
);
assert(
  published.length === 2 && quarantined.length === 3,
  `expected 2 published + 3 quarantined, got ${published.length} + ${quarantined.length}`
);
assert(
  published.every((r) => r.order_id && r.amount > 0),
  'every published row has a business key and a positive amount'
);

console.log(`PASS: ${published.length} published, ${quarantined.length} quarantined, 0 lost`);
