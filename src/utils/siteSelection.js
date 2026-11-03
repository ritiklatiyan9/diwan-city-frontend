// Completed sites remain available for their historical records. Inactive sites
// are switched off and must never be restored from an old browser selection.
export const getAvailableSites = (sites = []) => sites.filter(site => site.status !== 'inactive');

export const resolveCurrentSite = (sites, previousSite) => (
  sites.find(site => String(site.id) === String(previousSite?.id)) || sites[0] || null
);
