import { useState } from 'react';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import api from '../api/api';
import { toast } from 'sonner';

const STATUS_STYLES = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  CLEARED: 'bg-green-100 text-green-700 border-green-300',
  BOUNCED: 'bg-red-100 text-red-700 border-red-300',
  RETURNED: 'bg-orange-100 text-orange-700 border-orange-300',
};

/**
 * Shows cheque_status badge. If isAdmin, allows changing status via dropdown.
 * @param {{ chequeStatus: string, source: string, entryId: number, isAdmin: boolean, onStatusChange?: () => void }} props
 */
export default function ChequeStatusControl({ chequeStatus, source, entryId, isAdmin, onStatusChange }) {
  const [updating, setUpdating] = useState(false);

  if (!chequeStatus) return null;

  const handleChange = async (newStatus) => {
    if (newStatus === chequeStatus || updating) return;
    const label = newStatus === 'BOUNCED' || newStatus === 'RETURNED'
      ? `This will NULLIFY the cheque amount (no credit/no debit). Continue?`
      : newStatus === 'CLEARED'
      ? `Mark this cheque as CLEARED?`
      : `Change cheque status to ${newStatus}?`;
    if (!window.confirm(label)) return;

    setUpdating(true);
    try {
      await api.patch('/approvals/cheque-status', {
        id: entryId,
        source,
        cheque_status: newStatus,
      });
      toast.success(`Cheque status updated to ${newStatus}`);
      onStatusChange?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update cheque status');
    } finally {
      setUpdating(false);
    }
  };

  if (!isAdmin) {
    return (
      <Badge variant="outline" className={`text-[9px] ${STATUS_STYLES[chequeStatus] || ''}`}>
        CHQ: {chequeStatus}
      </Badge>
    );
  }

  return (
    <Select value={chequeStatus} onValueChange={handleChange} disabled={updating}>
      <SelectTrigger className={`h-5 w-auto min-w-[90px] text-[9px] font-semibold px-1.5 border ${STATUS_STYLES[chequeStatus] || ''}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="PENDING">⏳ PENDING</SelectItem>
        <SelectItem value="CLEARED">✅ CLEARED</SelectItem>
        <SelectItem value="BOUNCED">❌ BOUNCED</SelectItem>
        <SelectItem value="RETURNED">↩️ RETURNED</SelectItem>
      </SelectContent>
    </Select>
  );
}
