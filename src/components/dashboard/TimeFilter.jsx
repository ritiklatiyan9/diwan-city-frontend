import { useMemo } from 'react';

const PRESETS = [
  { key: 'today',      label: 'Today' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year',  label: 'This Year' },
  { key: 'overall',    label: 'Overall' },
];

/** Returns { start, end } date strings (YYYY-MM-DD) for each preset */
function computeRange(key) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let start;
  let end;
  switch (key) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'this_week': {
      const day = now.getDay(); // 0=Sun
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 7);
      break;
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      end   = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'overall':
    default:
      // Include everything — past and future-dated entries alike. Capped at
      // year 2100 rather than a true infinity so the string serialises cleanly.
      start = new Date(2000, 0, 1);
      end   = new Date(2100, 0, 1);
  }
  return {
    start: toDateStr(start),
    end: toDateStr(end),
  };
}

export function useTimeRange(preset) {
  return useMemo(() => computeRange(preset), [preset]);
}

export default function TimeFilter({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {PRESETS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all
            ${value === key
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
