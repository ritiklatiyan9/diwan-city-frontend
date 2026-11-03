// Run: node src/utils/loadPlotStatement.check.js
import assert from 'node:assert/strict';
import { loadPlotStatement } from './loadPlotStatement.js';

const site = { id: 7, name: 'Selected Site' };
const plots = [11, 12, 13, 14].map(value => ({ id: value, site_id: site.id, plot_no: `A${value}`, company_price: 700, installments_enabled: false }));
const payment = (value, amount, payment_type, extra = {}) => ({ id: value, plot_id: 11, site_id: 7, amount, payment_type, ...extra });
const payments = [payment(1, '100.00', 'CASH', { buyer_name: 'Buyer', booked_by: 'Agent', status: 'PENDING' }), payment(2, 50, 'BANK'), payment(3, 90, 'BANK', { cheque_status: 'BOUNCED' })];
const installmentPayments = [
  { id: 1, plot_id: 11, installment_id: 21, amount: 25, payment_mode: 'UPI' },
  { id: 2, plot_id: 11, installment_id: 21, amount: 30, payment_mode: 'CASH', cheque_status: 'RETURNED' },
  { id: 3, plot_id: 12, installment_id: 22, amount: 60, payment_mode: null },
];
const installments = [{ id: 21, plot_id: 11, amount: 250 }, { id: 22, plot_id: 12, amount: 60 }];
const full = { site, plots, payments, installmentPayments, installments, generatedAt: '2026-11-03T07:00:00Z' };
const httpError = status => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

// A current backend requires just one request, with no dependency on visible rows.
{
  const calls = [];
  const output = await loadPlotStatement({
    site,
    api: { get: async (...args) => { calls.push(args); return { data: full }; } },
    fetchPlotDetail: () => { throw new Error('Bulk success must not fetch individual details'); },
  });
  assert.equal(output, full);
  assert.deepEqual(calls, [['/plots/statement', { params: { site_id: 7 } }]]);
}

// The deployed legacy /:id route can return 500 for the new path. Complete
// fallback reads still include empty plots and disabled historical installments.
{
  let active = 0, peak = 0;
  const calls = [];
  const request = async (name, result) => {
    calls.push(name);
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    return result;
  };
  const output = await loadPlotStatement({
    site,
    api: { get: async (path, options) => {
      if (path === '/plots/statement') throw httpError(500);
      if (path === '/plots') { assert.deepEqual(options, { params: { site_id: 7 } }); return { data: { plots } }; }
      const match = path.match(/^\/plots\/(\d+)\/installment-payments$/);
      assert.ok(match, `Unexpected endpoint: ${path}`);
      return request(path, { data: { payments: installmentPayments.filter(row => row.plot_id === +match[1]) } });
    } },
    fetchPlotDetail: async (plotId, siteId) => {
      assert.equal(siteId, 7);
      return request(`detail:${plotId}`, {
        plot: { id: String(plotId), site_id: siteId, total_received: 9999 },
        payments: payments.filter(row => row.plot_id === plotId),
        installments: installments.filter(row => row.plot_id === plotId),
      });
    },
  });
  assert.equal(peak, 6, 'At most three detail/receipt pairs run concurrently');
  assert.equal(active, 0);
  assert.equal(calls.length, plots.length * 2);
  assert.deepEqual(output.plots.map(row => +row.id), [11, 12, 13, 14]);
  assert.equal(output.plots[0].company_price, 700, 'Retain fields absent from GraphQL');
  assert.equal(output.plots[0].total_received, 175, 'Exclude bounced and returned receipts from both sources');
  assert.equal(output.plots[0].received_bank, 75);
  assert.equal(output.plots[0].received_cash, 100);
  assert.equal(output.plots[0].payment_count, 5);
  assert.equal(output.plots[0].payment_buyer_names, 'Buyer');
  assert.equal(output.plots[0].payment_booked_bys, 'Agent');
  assert.equal(output.plots[1].total_received, 60, 'Historical receipts remain when installment management is disabled');
  assert.equal(output.plots[2].total_received, 0);
  assert.equal(output.plots[2].payment_count, 0);
  assert.equal(output.payments.length, 3, 'Include bounced transactions in the exported history');
  assert.equal(output.installmentPayments.length, 3, 'Include returned installment receipts in the history');
  assert.equal(output.installments.length, 2);
  assert.ok(output.generatedAt);
  assert.equal(output.payments[0].source, 'payment');
  assert.equal(output.installmentPayments[0].source, 'installment');
}

// Permissions and transport errors stop immediately, without trying legacy APIs.
for (const error of [httpError(401), httpError(403), new Error('Network Error'), httpError(429)]) {
  let calls = 0;
  await assert.rejects(loadPlotStatement({ site, api: { get: async () => { calls++; throw error; } } }), cause => cause === error);
  assert.equal(calls, 1);
}

// Malformed bulk responses never trigger a fallback that could hide corruption.
for (const data of [
  { ...full, payments: null },
  { ...full, site: { id: 8 } },
  { ...full, plots: [...plots, plots[0]] },
  { ...full, payments: [{ ...payments[0], plot_id: 999 }] },
  { ...full, installments: [{ ...installments[0], amount: 'invalid' }] },
]) {
  let calls = 0;
  await assert.rejects(loadPlotStatement({ site, api: { get: async () => { calls++; return { data }; } } }), /incomplete or inconsistent/);
  assert.equal(calls, 1);
}

// Any failed or mismatched plot prevents producing a partial statement.
for (const failureMode of ['request', 'wrong-site', 'missing-array']) {
  await assert.rejects(loadPlotStatement({
    site,
    api: { get: async path => {
      if (path === '/plots/statement') throw httpError(404);
      if (path === '/plots') return { data: { plots: [plots[0]] } };
      if (failureMode === 'request') throw new Error('Unable to read installment receipts');
      return { data: { payments: [] } };
    } },
    fetchPlotDetail: async () => ({
      plot: { ...plots[0], site_id: failureMode === 'wrong-site' ? 8 : 7 },
      payments: failureMode === 'missing-array' ? undefined : [], installments: [],
    }),
  }));
}

// Endpoint absence with an empty site still yields a complete, empty statement.
for (const status of [404, 405, 501]) {
  const output = await loadPlotStatement({ site, api: { get: async path => {
    if (path === '/plots/statement') throw httpError(status);
    return { data: { plots: [] } };
  } }, fetchPlotDetail: () => { throw new Error('Empty site has no plot details'); } });
  assert.equal(output.plots.length, 0);
  assert.deepEqual(output.payments, []);
  assert.deepEqual(output.installmentPayments, []);
  assert.deepEqual(output.installments, []);
}

console.log('loadPlotStatement: all checks passed');
