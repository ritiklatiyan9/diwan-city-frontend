// Run: node src/utils/colonyUnits.check.js
import assert from 'node:assert/strict';
import { COLONY_PLOTS } from '../constants/colonyLayout.js';
import {
  colonyUnitNo, colonyUnitKey, indexColonyUnits, filterColonyUnits,
  missingColonyUnits, createMissingColonyUnits,
} from './colonyUnits.js';

assert.equal(COLONY_PLOTS.filter(p => p.block === 'P').length, 86);
assert.equal(new Set(COLONY_PLOTS.map(colonyUnitNo)).size, 115);
for (const [i, a] of COLONY_PLOTS.entries()) {
  for (const b of COLONY_PLOTS.slice(i + 1)) {
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    assert.ok(overlapX < 0.001 || overlapY < 0.001, `${colonyUnitNo(a)} overlaps ${colonyUnitNo(b)}`);
  }
}

// P1, A1 and S1 must link to different financial records; prefer active resales.
const linked = [
  { id: 1, plot_no: 'P1', block: 'P', total_received: '100' },
  { id: 2, plot_no: 'A1', block: 'P', total_received: '200' },
  { id: 3, plot_no: 's-1', block: 'S', total_received: '300' },
  { id: 4, plot_no: 'A1', block: 'A', plot_tag: 'OLD', total_received: '400' },
  { id: 5, plot_no: '1', block: 'A', plot_tag: 'NEW 2', total_received: '500' },
  { id: 6, plot_no: 'OFFICE 1', total_received: '600' },
];
const snapshot = structuredClone(linked);
const index = indexColonyUnits(linked);
assert.equal(index.get('P1').id, 1);
assert.equal(index.get('A1').id, 5);
assert.equal(index.get('S1').id, 3);
assert.equal(colonyUnitKey({ plot_no: ' A-01 ' }), 'A1');
assert.equal(colonyUnitKey({ plot_no: 'OFFICE 1', block: 'A' }), '');
assert.deepEqual(filterColonyUnits(linked, 'all'), linked);
assert.deepEqual(filterColonyUnits(linked, 'plots').map(p => p.id), [1]);
assert.deepEqual(filterColonyUnits(linked, 'flats').map(p => p.id), [2, 4, 5]);
assert.deepEqual(filterColonyUnits(linked, 'shops').map(p => p.id), [3]);
assert.deepEqual(linked, snapshot);

// Read the latest inventory before creating, so stale UI data cannot duplicate A4.
const inventory = COLONY_PLOTS.map((p, i) => ({ id: i + 1, plot_no: colonyUnitNo(p), block: p.block }));
const latest = inventory.filter(p => !['A5', 'A6'].includes(p.plot_no));
latest.find(p => p.plot_no === 'A4').plot_no = 'A-4';
assert.deepEqual(missingColonyUnits(latest).map(colonyUnitNo), ['A5', 'A6']);
const posts = [];
const client = {
  get: async (_url, options) => {
    assert.equal(options.params.site_id, 1);
    return { data: { plots: latest } };
  },
  post: async (_url, body) => {
    posts.push(body);
    latest.push({ id: 1000 + posts.length, ...body });
  },
};
assert.deepEqual(await createMissingColonyUnits(client, 1), { created: 2, failures: [] });
assert.deepEqual(posts.map(p => p.plot_no), ['A5', 'A6']);
assert.ok(posts.every(p => p.status === 'COMPANY' && p.plot_size === 0));
assert.deepEqual(await createMissingColonyUnits(client, 1), { created: 0, failures: [] });
assert.equal(posts.length, 2);

// A concurrent create is harmless; other failures stay visible and retryable.
const absent = inventory.filter(p => !['A5', 'A6'].includes(p.plot_no));
const failing = {
  get: async () => ({ data: { plots: absent } }),
  post: async (_url, body) => { throw { response: { status: body.plot_no === 'A5' ? 409 : 503 } }; },
};
assert.deepEqual(await createMissingColonyUnits(failing, 1), { created: 0, failures: ['A6'] });
console.log('Colony checks passed: original plots, unique units, payment links, filters and safe repeated creation.');
