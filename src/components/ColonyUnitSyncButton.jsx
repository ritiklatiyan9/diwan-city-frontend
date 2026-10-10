import { useRef, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/api';
import { createMissingColonyUnits, missingColonyUnits } from '../utils/colonyUnits';
import { Button } from './ui/button';

export default function ColonyUnitSyncButton({ records, siteId, siteName, loading, onCreated }) {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');
  const running = useRef(false);
  const missing = missingColonyUnits(records);

  const handleSync = async () => {
    if (!siteId || loading || running.current || !missing.length) return;
    if (!window.confirm(`Create ${missing.length} missing units for "${siteName}"?\n\nLayout: P1–P86 (plots), A1–D6 (24 flats), S1–S5 (5 shops). New units start as COMPANY. Flat/shop areas are left unset.`)) return;
    running.current = true;
    setSyncing(true);
    try {
      const result = await createMissingColonyUnits(api, siteId,
        (done, total) => setProgress(`${done}/${total}`));
      await onCreated();
      if (result.failures.length) toast.warning(`${result.created} units created. Could not create: ${result.failures.join(', ')}`);
      else toast.success(result.created ? `${result.created} units created` : 'All layout units already exist');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not sync units. Refresh and try again.');
      await onCreated().catch(() => {});
    } finally {
      running.current = false;
      setSyncing(false);
      setProgress('');
    }
  };

  if (!missing.length && !syncing) return null;
  return (
    <Button size="sm" onClick={handleSync} disabled={syncing || loading || !siteId}
      className="h-8 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
      {syncing
        ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{progress || 'Creating…'}</>
        : <><Plus className="mr-1.5 h-4 w-4" />Create {missing.length} missing units</>}
    </Button>
  );
}
