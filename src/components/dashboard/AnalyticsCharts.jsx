import { memo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@apollo/client/react';
import { GET_REVENUE_VS_EXPENSE, GET_PROFIT_TREND, GET_EXPENSES_BY_CATEGORY } from '../../graphql/queries';
import { Skeleton } from '../ui/skeleton';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}K`;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const fmtTooltip = (v) => {
  const n = parseFloat(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const fmtFull = (v) => parseFloat(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/* ── Premium glassy tooltip shared across charts ── */
const PremiumTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-[0_10px_30px_-10px_rgba(16,24,40,0.35)] backdrop-blur-sm">
      {label != null && <p className="mb-1 text-[11px] font-semibold text-slate-700">{label}</p>}
      <div className="space-y-1">
        {payload.map((p, i) => {
          const [val, name] = formatter ? formatter(p.value, p.name, p) : [p.value, p.name];
          return (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
              <span className="text-slate-500">{name}</span>
              <span className="ml-auto font-semibold tabular-nums text-slate-800">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ChartLoader = () => (
  <div className="space-y-3 p-2">
    <Skeleton className="h-4 w-36" />
    <Skeleton className="h-52 w-full rounded-xl" />
    <div className="flex gap-3">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-16" />
    </div>
  </div>
);

const ChartEmpty = () => (
  <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-slate-400">
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-300"><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </div>
    No data for this period
  </div>
);

/* ── Animated surface wrapper (scroll-in fade-up + hover lift) ── */
const ChartCard = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className={`group relative overflow-hidden rounded-2xl border shadow-[0_2px_16px_-8px_rgba(16,24,40,0.12)] transition-shadow duration-300 hover:shadow-[0_18px_40px_-18px_rgba(16,24,40,0.28)] ${className}`}
  >
    {children}
  </motion.div>
);

const ChartHeading = ({ title, subtitle, dot }) => (
  <div className="mb-3 flex items-start justify-between">
    <div>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-sm font-semibold text-slate-800">{title}</span>
      </div>
      <p className="ml-4 mt-0.5 text-[10px] text-slate-400">{subtitle}</p>
    </div>
  </div>
);

/* ── Revenue vs Expense Bar Chart ── */
export const RevenueVsExpenseChart = memo(function RevenueVsExpenseChart({ siteId, range, resolution = 'MONTH', excludeOldPlots = false }) {
  const { data, loading } = useQuery(GET_REVENUE_VS_EXPENSE, {
    variables: { siteId: String(siteId), range, resolution, excludeOldPlots },
    skip: !siteId,
  });

  const chartData = data?.revenueVsExpense || [];
  const isYearly = resolution === 'YEAR';
  const barSize = isYearly ? Math.min(44, Math.max(14, Math.floor(560 / (chartData.length || 1)))) : undefined;

  return (
    <ChartCard className="border-sky-100/70 bg-gradient-to-br from-sky-50/40 via-white to-indigo-50/20">
      <div className="relative p-5">
        <ChartHeading
          title="Revenue vs Expenses"
          dot="bg-gradient-to-r from-emerald-400 to-rose-400"
          subtitle={isYearly ? 'Yearly totals' : resolution === 'DAY' ? 'Daily breakdown' : 'Monthly totals'}
        />
        {loading ? <ChartLoader /> : chartData.length === 0 ? <ChartEmpty /> : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4} barCategoryGap={isYearly ? '30%' : '22%'}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={1} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: isYearly ? 11 : 10, fill: '#64748b', fontWeight: isYearly ? 600 : 400 }} axisLine={false} tickLine={false} interval={chartData.length > 20 ? Math.ceil(chartData.length / 12) - 1 : 0} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
                <RechartsTooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} content={<PremiumTooltip formatter={(value, name) => [fmtTooltip(value), name]} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                <Bar dataKey="revenue" name="Revenue" fill="url(#revGrad)" radius={[6, 6, 0, 0]} maxBarSize={barSize} animationDuration={900} animationEasing="ease-out" />
                <Bar dataKey="expense" name="Expense" fill="url(#expGrad)" radius={[6, 6, 0, 0]} maxBarSize={barSize} animationDuration={900} animationBegin={120} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartCard>
  );
});

/* ── Profit Trend Area Chart ── */
export const ProfitTrendChart = memo(function ProfitTrendChart({ siteId, range, resolution = 'MONTH', excludeOldPlots = false }) {
  const { data, loading } = useQuery(GET_PROFIT_TREND, {
    variables: { siteId: String(siteId), range, resolution, excludeOldPlots },
    skip: !siteId,
  });

  const chartData = data?.profitTrend || [];
  const isYearly = resolution === 'YEAR';
  const lastVal = chartData.length ? chartData[chartData.length - 1]?.value ?? 0 : 0;
  const trendColor = lastVal >= 0 ? '#10b981' : '#f43f5e';
  const gradId = lastVal >= 0 ? 'profitGradPos' : 'profitGradNeg';

  return (
    <ChartCard className="border-emerald-100/70 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20">
      <div className="relative p-5">
        <ChartHeading
          title="Profit Trend"
          dot={lastVal >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}
          subtitle={isYearly ? 'Yearly net profit' : resolution === 'DAY' ? 'Daily net profit' : 'Monthly net profit'}
        />
        {loading ? <ChartLoader /> : chartData.length === 0 ? <ChartEmpty /> : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="profitGradPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: isYearly ? 11 : 10, fill: '#64748b', fontWeight: isYearly ? 600 : 400 }} axisLine={false} tickLine={false} interval={chartData.length > 20 ? Math.ceil(chartData.length / 12) - 1 : 0} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={fmt} width={52} />
                <RechartsTooltip cursor={{ stroke: trendColor, strokeOpacity: 0.3, strokeWidth: 1 }} content={<PremiumTooltip formatter={(value) => [fmtTooltip(value), 'Net Profit']} />} />
                <Area
                  type={isYearly ? 'step' : 'monotone'}
                  dataKey="value"
                  stroke={trendColor}
                  strokeWidth={isYearly ? 3 : 2.5}
                  fillOpacity={1}
                  fill={`url(#${gradId})`}
                  dot={isYearly ? { r: 5, fill: trendColor, strokeWidth: 2, stroke: '#fff' } : { r: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartCard>
  );
});

/* ── Expense By Category Radar Chart ── */
export const ExpenseByCategoryRadar = memo(function ExpenseByCategoryRadar({ siteId, range }) {
  const { data, loading } = useQuery(GET_EXPENSES_BY_CATEGORY, {
    variables: { siteId: String(siteId), range, top: 8 },
    skip: !siteId,
  });

  const chartData = data?.expensesByCategory || [];

  return (
    <ChartCard className="border-rose-100/70 bg-gradient-to-br from-rose-50/40 via-white to-pink-50/20">
      <div className="relative p-5">
        <ChartHeading title="Expense Radar" dot="bg-rose-400" subtitle="Top categories by spend" />
        {loading ? <ChartLoader /> : chartData.length === 0 ? <ChartEmpty /> : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                <defs>
                  <linearGradient id="radarFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <PolarGrid stroke="#eef2f7" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => v.length > 10 ? v.slice(0, 9) + '…' : v} />
                <PolarRadiusAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Radar name="Expense" dataKey="amount" stroke="#f43f5e" strokeWidth={2} fill="url(#radarFill)" fillOpacity={1} dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} animationDuration={900} animationEasing="ease-out" />
                <RechartsTooltip content={<PremiumTooltip formatter={(value) => [`₹${fmtFull(value)}`, 'Expense']} />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </ChartCard>
  );
});
