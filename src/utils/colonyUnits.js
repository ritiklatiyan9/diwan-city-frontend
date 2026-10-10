import { COLONY_PLOTS } from '../constants/colonyLayout.js';
import { FLAT_SHOP_UNITS } from '../constants/flatShopLayout.js';

export const colonyUnitNo = (unit) => `${unit.block}${unit.no}`;

// Accept full identifiers (A1, A-1, s 1), or separate block + numeric number.
// Prefer the identifier so an old or incorrect block cannot misroute a payment.
export function colonyUnitKey(record) {
  const number = String(record.plot_no || '').trim().toUpperCase();
  const full = number.match(/^([ABCDPS])[\s-]*0*([1-9]\d*)$/);
  if (full) return `${full[1]}${Number(full[2])}`;
  const block = String(record.block || '').trim().toUpperCase();
  if (/^[ABCDPS]$/.test(block) && /^\d+$/.test(number) && Number(number) > 0) {
    return `${block}${Number(number)}`;
  }
  return '';
}

const unitNumbers = new Set(COLONY_PLOTS.map(colonyUnitNo));
const flatShopNumbers = new Set(FLAT_SHOP_UNITS.map(colonyUnitNo));
export const isColonyUnit = (record) => flatShopNumbers.has(colonyUnitKey(record));

export function filterColonyUnits(records, filter) {
  if (filter === 'all') return records;
  return records.filter((record) => {
    if (filter === 'plots') return colonyUnitKey(record).startsWith('P');
    const inLayout = isColonyUnit(record);
    if (filter === 'other') return !inLayout;
    if (!inLayout) return false;
    const shop = colonyUnitKey(record).startsWith('S');
    return filter === 'flats' ? !shop : filter === 'shops' ? shop : true;
  });
}

export function indexColonyUnits(records) {
  const index = new Map();
  const isOld = (r) => /^OLD\b/i.test(String(r.plot_tag || '').trim());
  for (const record of records) {
    const key = colonyUnitKey(record);
    if (!unitNumbers.has(key)) continue;
    const previous = index.get(key);
    if (!previous || (isOld(previous) && !isOld(record)) ||
      (isOld(previous) === isOld(record) && Number(record.id) > Number(previous.id))) {
      index.set(key, record);
    }
  }
  return index;
}

export const missingColonyUnits = (records) => {
  const index = indexColonyUnits(records);
  return COLONY_PLOTS.filter((unit) => !index.has(colonyUnitNo(unit)));
};

// Refresh first, then create only absent units. Existing sales and payments stay
// attached to their original IDs. Zero is accepted by the API as an unset area.
export async function createMissingColonyUnits(client, siteId, onProgress = () => {}) {
  const { data } = await client.get('/plots', { params: { site_id: siteId } });
  const missing = missingColonyUnits(data.plots || []);
  let created = 0;
  const failures = [];
  for (const [i, unit] of missing.entries()) {
    try {
      await client.post('/plots', {
        site_id: siteId, plot_no: colonyUnitNo(unit), block: unit.block,
        plot_size: unit.size || 0,
        ...(unit.size ? { plot_size_mtr: +(unit.size * 0.83612736).toFixed(2) } : {}),
        status: 'COMPANY',
        notes: unit.size ? 'Created from colony layout map' : `${unit.type} created from the Diwan City layout; area to be entered`,
      });
      created++;
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) throw error;
      if (error.response?.status !== 409) failures.push(colonyUnitNo(unit));
    }
    onProgress(i + 1, missing.length);
  }
  return { created, failures };
}
