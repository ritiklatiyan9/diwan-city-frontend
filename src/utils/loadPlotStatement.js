const UNAVAILABLE_ENDPOINT_STATUSES = new Set([404, 405, 500, 501]);
const BANK_MODES = new Set(['BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'TRANSFER']);

const record = value => value != null && typeof value === 'object' && !Array.isArray(value);
const id = value => /^\d+$/.test(String(value ?? '')) && Number.isSafeInteger(Number(value)) && Number(value) > 0
  ? String(Number(value)) : null;
const invalid = detail => new Error(`The statement data is incomplete or inconsistent: ${detail}. Please try again.`);
const counted = row => !['BOUNCED', 'RETURNED'].includes(String(row.cheque_status || '').toUpperCase());
const money = value => Math.round(value * 100) / 100;

function requireRows(value, label) {
  if (!Array.isArray(value)) throw invalid(`${label} could not be read`);
  return value;
}

function validateRows(rows, label, plotIds, siteId) {
  const seen = new Set();
  for (const row of rows) {
    if (!record(row) || !id(row.id) || seen.has(id(row.id))) throw invalid(`${label} contains a missing or duplicate ID`);
    seen.add(id(row.id));
    if (!plotIds.has(id(row.plot_id))) throw invalid(`${label} belongs to an unexpected plot`);
    if (row.site_id != null && id(row.site_id) !== siteId) throw invalid(`${label} belongs to another site`);
    if (row.amount == null || row.amount === '' || !Number.isFinite(Number(row.amount))) throw invalid(`${label} contains an invalid amount`);
  }
}

function validatePlots(plots, siteId) {
  const plotIds = new Set();
  for (const plot of requireRows(plots, 'Plots')) {
    if (!record(plot) || !id(plot.id) || plotIds.has(id(plot.id))) throw invalid('plots contain a missing or duplicate ID');
    if (id(plot.site_id) !== siteId) throw invalid('a plot belongs to another site');
    plotIds.add(id(plot.id));
  }
  return plotIds;
}

function validateStatement(data, siteId) {
  if (!record(data) || !record(data.site) || id(data.site.id) !== siteId) throw invalid('the selected site does not match');
  const plotIds = validatePlots(data.plots, siteId);
  validateRows(requireRows(data.payments, 'Plot payments'), 'Plot payments', plotIds, siteId);
  validateRows(requireRows(data.installmentPayments, 'Installment payments'), 'Installment payments', plotIds, siteId);
  validateRows(requireRows(data.installments, 'Installment schedules'), 'Installment schedules', plotIds, siteId);
  if (!data.generatedAt || Number.isNaN(new Date(data.generatedAt).getTime())) throw invalid('the statement generation time is missing');
  return data;
}

function withReceiptTotals(plot, payments, installmentPayments) {
  let total = 0, bank = 0, cash = 0;
  const buyers = new Set(), bookedBy = new Set();
  for (const payment of payments) {
    if (payment.buyer_name) buyers.add(payment.buyer_name);
    if (payment.booked_by) bookedBy.add(payment.booked_by);
    if (!counted(payment)) continue;
    const amount = Number(payment.amount);
    total += amount;
    if (['BANK', 'CHEQUE'].includes(payment.payment_type)) bank += amount;
    if (payment.payment_type === 'CASH') cash += amount;
  }
  for (const payment of installmentPayments) {
    if (!counted(payment)) continue;
    const amount = Number(payment.amount);
    const mode = String(payment.payment_mode ?? 'CASH').toUpperCase();
    total += amount;
    if (BANK_MODES.has(mode)) bank += amount;
    if (mode === 'CASH') cash += amount;
  }
  return {
    ...plot,
    total_received: money(total), received_bank: money(bank), received_cash: money(cash),
    payment_count: payments.length + installmentPayments.length,
    payment_buyer_names: [...buyers].join(', '), payment_booked_bys: [...bookedBy].join(', '),
  };
}

async function loadLegacyStatement({ api, site, fetchPlotDetail }) {
  const siteId = id(site.id);
  const list = await api.get('/plots', { params: { site_id: site.id } });
  const plots = requireRows(list?.data?.plots, 'Plots');
  validatePlots(plots, siteId);
  const detailRows = new Array(plots.length);
  let next = 0, failure;

  async function worker() {
    while (!failure && next < plots.length) {
      const index = next++;
      const plot = plots[index];
      try {
        // Always read historical installment receipts, including disabled plots.
        // Three workers make at most six concurrent requests. Do not call the
        // legacy installments endpoint, which can update statuses during a read.
        const results = await Promise.allSettled([
          Promise.resolve().then(() => fetchPlotDetail(plot.id, site.id)),
          Promise.resolve().then(() => api.get(`/plots/${plot.id}/installment-payments`)),
        ]);
        const failed = results.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
        const detail = results[0].value;
        if (!record(detail) || !record(detail.plot) || id(detail.plot.id) !== id(plot.id) || id(detail.plot.site_id) !== siteId) {
          throw invalid('a plot detail does not match its site and plot');
        }
        const payments = requireRows(detail.payments, 'Plot payments');
        const installmentPayments = requireRows(results[1].value?.data?.payments, 'Installment payments');
        const installments = requireRows(detail.installments, 'Installment schedules');
        const onlyThisPlot = new Set([id(plot.id)]);
        validateRows(payments, 'Plot payments', onlyThisPlot, siteId);
        validateRows(installmentPayments, 'Installment payments', onlyThisPlot, siteId);
        validateRows(installments, 'Installment schedules', onlyThisPlot, siteId);
        detailRows[index] = {
          plot: withReceiptTotals({ ...plot, ...detail.plot }, payments, installmentPayments),
          payments: payments.map(row => ({ ...row, source: 'payment' })),
          installmentPayments: installmentPayments.map(row => ({ ...row, source: 'installment' })),
          installments,
        };
      } catch (error) {
        failure ||= error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, plots.length) }, () => worker()));
  if (failure) throw failure;
  return validateStatement({
    site,
    plots: detailRows.map(row => row.plot),
    payments: detailRows.flatMap(row => row.payments),
    installmentPayments: detailRows.flatMap(row => row.installmentPayments),
    installments: detailRows.flatMap(row => row.installments),
    generatedAt: new Date().toISOString(),
  }, siteId);
}

/**
 * Prefer the current bulk API, but support servers deployed before /statement.
 * A legacy /:id route treats "statement" as an ID and may return HTTP 500.
 * Fall back only after an HTTP endpoint error, and only return a full set of
 * successful reads. Authorization and network failures are never bypassed.
 */
export async function loadPlotStatement({ api, site, fetchPlotDetail }) {
  const capturedSite = { ...site };
  const siteId = id(capturedSite.id);
  if (!siteId) throw invalid('no site is selected');
  let response;
  try {
    response = await api.get('/plots/statement', { params: { site_id: capturedSite.id } });
  } catch (error) {
    if (!UNAVAILABLE_ENDPOINT_STATUSES.has(error?.response?.status)) throw error;
    return loadLegacyStatement({ api, site: capturedSite, fetchPlotDetail });
  }
  // Invalid successful payloads indicate data problems, not an old endpoint.
  return validateStatement(response?.data, siteId);
}
