import assert from 'node:assert/strict';
import { getAvailableSites, resolveCurrentSite } from './siteSelection.js';

const disabled = { id: 1, name: 'Disabled site', status: 'inactive' };
const active = { id: 2, name: 'Updated name', status: 'active' };
const completed = { id: 3, name: 'Historical site', status: 'completed' };
const available = getAvailableSites([disabled, active, completed]);

assert.deepEqual(available, [active, completed], 'disabled sites leave the selector; completed records remain accessible');
assert.equal(resolveCurrentSite(available, { id: 1, status: 'active' }), active, 'stale disabled selection switches to an available site');
assert.equal(resolveCurrentSite(available, { id: '2', name: 'Old name' }), active, 'refresh replaces stored metadata and handles string IDs');
assert.equal(resolveCurrentSite(available, { id: 999 }), active, 'deleted or unassigned site cannot remain selected');
assert.equal(resolveCurrentSite(getAvailableSites([disabled]), disabled), null, 'disabling the sole site clears the current site');
assert.equal(resolveCurrentSite(getAvailableSites([{ ...disabled, status: 'active' }]), null)?.id, 1, 'reactivation restores selection when no site is available');
console.log('Site selection regression checks passed.');
