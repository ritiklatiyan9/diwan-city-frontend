import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, AreaChart, PieChart, TrendingDown, TrendingUp,
  LineChart, Activity, FileText,
} from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

/** Pick a value text size that keeps long amounts inside the card */
const valueSizeClass = (formatted) => {
  const len = formatted.length;
  if (len <= 12) return 'text-2xl';
  if (len <= 16) return 'text-xl';
  return 'text-lg';
};

const CARD_DEFS = {
  totalIncoming:    { label: 'Total Incoming',    Icon: BarChart3 },
  plotPayments:     { label: 'Plot Payments',     Icon: AreaChart },
  personalLedger:   { label: 'Personal Ledger',   Icon: PieChart,   dynamic: true },
  totalExpense:     { label: 'Total Expenses',    Icon: TrendingDown },
  profit:           { label: 'Profit',            Icon: LineChart,  dynamic: true },
  registryPayments: { label: 'Registry Payments', Icon: FileText },
  siteBalance:      { label: 'Site Balance',      Icon: Activity,   dynamic: true },
};

/** Per-card accent palette — icon chip, top bar gradient, hover glow. */
const ACCENTS = {
  totalIncoming:    { icon: 'bg-indigo-50 text-indigo-600 ring-indigo-100',   bar: 'from-indigo-400 to-violet-500',   glow: 'bg-indigo-300/40' },
  plotPayments:     { icon: 'bg-sky-50 text-sky-600 ring-sky-100',            bar: 'from-sky-400 to-cyan-500',        glow: 'bg-sky-300/40' },
  personalLedger:   { icon: 'bg-violet-50 text-violet-600 ring-violet-100',   bar: 'from-violet-400 to-purple-500',   glow: 'bg-violet-300/40' },
  totalExpense:     { icon: 'bg-rose-50 text-rose-600 ring-rose-100',         bar: 'from-rose-400 to-red-500',        glow: 'bg-rose-300/40' },
  profit:           { icon: 'bg-emerald-50 text-emerald-600 ring-emerald-100', bar: 'from-emerald-400 to-teal-500',   glow: 'bg-emerald-300/40' },
  registryPayments: { icon: 'bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100', bar: 'from-fuchsia-400 to-pink-500',   glow: 'bg-fuchsia-300/40' },
  siteBalance:      { icon: 'bg-cyan-50 text-cyan-600 ring-cyan-100',         bar: 'from-cyan-400 to-sky-500',        glow: 'bg-cyan-300/40' },
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Smoothly counts a number up to its target with an ease-out curve. */
function useCountUp(target, duration = 750) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const to = Number.isFinite(target) ? target : 0;
    const from = fromRef.current;
    if (prefersReducedMotion() || from === to) {
      fromRef.current = to;
      setDisplay(to);
      return undefined;
    }
    let start;
    const step = (ts) => {
      if (start === undefined) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

function KpiCard({ kpiKey, value, loading, onClick, subtitle, details }) {
  const def = CARD_DEFS[kpiKey];
  const accent = ACCENTS[kpiKey] || ACCENTS.totalIncoming;

  const numVal = parseFloat(value) || 0;
  const animated = useCountUp(loading ? 0 : numVal);
  if (!def) return null;

  const isPositive = numVal >= 0;
  const { Icon } = def;

  const shown = loading ? 0 : animated;
  const formatted = `${shown < 0 ? '-' : ''}₹${fmt(Math.abs(shown))}`;
  const sizeClass = valueSizeClass(`${numVal < 0 ? '-' : ''}₹${fmt(Math.abs(numVal))}`);
  const valueTone = def.dynamic && !isPositive ? 'text-rose-600' : 'text-slate-900';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_14px_34px_-14px_rgba(16,24,40,0.22)] hover:border-slate-300/80"
    >
      {/* hover glow */}
      <div className={`pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${accent.glow}`} />
      {/* top accent bar */}
      <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accent.bar} opacity-0 transition-opacity duration-300 group-hover:opacity-90`} />

      <div className="relative z-10 mb-2.5 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110 ${accent.icon}`}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{def.label}</span>
        </div>
        {def.dynamic && !loading && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? 'Positive' : 'Negative'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      ) : (
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <p className={`${sizeClass} break-all font-bold leading-tight tracking-tight tabular-nums ${valueTone}`}>
            {formatted}
          </p>
          {subtitle && (
            <p className="mt-1 truncate text-[11px] text-slate-400" title={subtitle}>{subtitle}</p>
          )}
          {details && (
            <div className="mt-auto space-y-1 border-t border-slate-100 pt-2.5">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="truncate text-slate-500">{d.label}</span>
                  <span className={`whitespace-nowrap font-semibold tabular-nums ${d.color || 'text-slate-700'}`}>{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default KpiCard;
