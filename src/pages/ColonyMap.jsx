import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { Map as MapIcon, RefreshCw, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import {
  COLONY_PLOTS, ROADS, ROAD_LABELS, CHAKROAD_BANDS, PARKS, TEMPLE, GATE, COMPASS, BYPASS_ROAD, VIEWBOX, FLAT_SHOP_AREAS,
} from '../constants/colonyLayout';
import { FLAT_SHOP_UNITS, FLAT_SHOP_COMMON_AREAS } from '../constants/flatShopLayout';
import { colonyUnitNo, indexColonyUnits } from '../utils/colonyUnits';
import ColonyUnitSyncButton from '../components/ColonyUnitSyncButton';

const ROAD_FILL = '#6d3f50';
const PARK_FILL = '#d9f4d0';

// Map fill per plot status — COMPANY green, BOOKED yellow, REGISTRY red (per layout convention)
const STATUS_FILL = {
  COMPANY: '#4ade80',
  CREATED: '#4ade80',
  BOOKED: '#facc15',
  BOOKING: '#facc15',
  AGREEMENT: '#facc15',
  REGISTRY: '#f87171',
  REGISTERED: '#f87171',
  RESALE: '#fb923c',
  CANCEL: '#cbd5e1',
  CANCELLATION: '#cbd5e1',
  CANCELLED: '#cbd5e1',
  'UNDER CANCELLATION': '#cbd5e1',
  TRANSFERRED: '#93c5fd',
};
const OTHER_FILL = '#ddd6fe';   // exists in DB with an unmapped status
const MISSING_FILL = '#ffffff'; // no DB record yet

const LEGEND = [
  { label: 'Company', color: STATUS_FILL.COMPANY, match: (s) => ['COMPANY', 'CREATED'].includes(s) },
  { label: 'Booked', color: STATUS_FILL.BOOKED, match: (s) => ['BOOKED', 'BOOKING', 'AGREEMENT'].includes(s) },
  { label: 'Registry', color: STATUS_FILL.REGISTRY, match: (s) => ['REGISTRY', 'REGISTERED'].includes(s) },
  { label: 'Resale', color: STATUS_FILL.RESALE, match: (s) => s === 'RESALE' },
  { label: 'Cancelled', color: STATUS_FILL.CANCEL, match: (s) => s.includes('CANCEL') },
  { label: 'Not created', color: MISSING_FILL, match: null },
];

function PlotShape({ pl, rec, hovered, onHover, onClick }) {
  const status = String(rec?.status || '').toUpperCase();
  const fill = rec ? (STATUS_FILL[status] || OTHER_FILL) : MISSING_FILL;
  const label = pl.block === 'P' ? `{${pl.no}}` : colonyUnitNo(pl);
  const size = Number(pl.size || rec?.plot_size) > 0 ? Number(pl.size || rec.plot_size).toFixed(2) : '';
  const cx = pl.x + pl.w / 2, cy = pl.y + pl.h / 2;
  const sideBySide = pl.w >= 40;
  const tiny = pl.h < 20 || pl.w < 20;
  const fs = sideBySide ? 7 : tiny ? 4.2 : pl.w >= 24 ? 5.5 : 6;
  return (
    <g
      role="button" tabIndex={0}
      aria-label={`${pl.type || 'Plot'} ${colonyUnitNo(pl)}, ${rec ? status : 'not created'}`}
      onFocus={() => onHover({ pl, rec })}
      onBlur={() => onHover(null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(pl, rec);
        }
      }}
      onMouseEnter={() => onHover({ pl, rec })}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(pl, rec)}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={pl.x} y={pl.y} width={pl.w} height={pl.h}
        fill={fill} fillOpacity={rec ? 0.9 : 1}
        stroke={hovered ? '#0f172a' : '#1e293b'} strokeWidth={hovered ? 1.6 : 0.55}
      />
      {pl.type ? (
        <text x={cx} y={cy} fontSize={pl.w > 60 ? 7 : 5.8} fill="#1d4ed8" fontWeight="700" textAnchor="middle" dominantBaseline="central">{label}</text>
      ) : sideBySide ? (
        <>
          <text x={pl.x + pl.w * 0.3} y={cy} fontSize={fs} fill="#1d4ed8" fontWeight="700" textAnchor="middle" dominantBaseline="central">{label}</text>
          <text x={pl.x + pl.w * 0.68} y={cy} fontSize={fs} fill="#be185d" fontWeight="600" textAnchor="middle" dominantBaseline="central">{size}</text>
        </>
      ) : tiny ? (
        <>
          <text x={cx} y={cy - (pl.h > 14 ? 4 : 2.4)} fontSize={fs} fill="#1d4ed8" fontWeight="700" textAnchor="middle" dominantBaseline="central">{label}</text>
          <text x={cx} y={cy + (pl.h > 14 ? 4 : 2.6)} fontSize={fs} fill="#be185d" fontWeight="600" textAnchor="middle" dominantBaseline="central">{size}</text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 6} fontSize={fs} fill="#1d4ed8" fontWeight="700" textAnchor="middle" dominantBaseline="central">{label}</text>
          <text x={cx} y={cy + 6} fontSize={fs} fill="#be185d" fontWeight="600" textAnchor="middle" dominantBaseline="central">{size}</text>
        </>
      )}
    </g>
  );
}

export default function ColonyMap() {
  const navigate = useNavigate();
  const { currentSite, hasPermission } = useAuth();
  const siteId = currentSite?.id;
  const canWrite = hasPermission('plot_payments', 'write');

  const [dbPlots, setDbPlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(null);
  const [zoom, setZoom] = useState(1);

  const fetchPlots = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const { data } = await api.get('/plots', { params: { site_id: siteId } });
      setDbPlots(data.plots || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load plots');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchPlots(); }, [fetchPlots]);

  const plotIndex = useMemo(() => indexColonyUnits(dbPlots), [dbPlots]);

  const legendCounts = useMemo(() => {
    const counts = {};
    for (const item of LEGEND) counts[item.label] = 0;
    for (const pl of COLONY_PLOTS) {
      const rec = plotIndex.get(colonyUnitNo(pl));
      if (!rec) { counts['Not created']++; continue; }
      const s = String(rec.status || '').toUpperCase();
      const hit = LEGEND.find((l) => l.match && l.match(s));
      if (hit) counts[hit.label]++;
    }
    return counts;
  }, [plotIndex]);

  const handlePlotClick = useCallback((pl, rec) => {
    if (rec) navigate(`/plot-payments/${rec.id}`);
    else toast.info(`${pl.type || 'Plot'} ${colonyUnitNo(pl)} has no record yet${canWrite ? ' — use "Create missing units"' : ''}`);
  }, [navigate, canWrite]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-1">
      <Motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white via-emerald-50/40 to-white shadow-[0_2px_24px_-10px_rgba(30,41,59,0.18)]"
      >
        <div className="relative flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-500/25">
                <MapIcon className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Colony Map</h1>
                <p className="text-[13px] text-slate-500">
                  {currentSite?.name || 'No site selected'} — 86 plots · 24 flats · 5 shops
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[12px] text-slate-600">
                  <span className="inline-block h-3 w-3 rounded-[4px] border border-slate-400" style={{ background: l.color }} />
                  {l.label}
                  <span className="font-semibold text-slate-800">{legendCounts[l.label] ?? 0}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.25).toFixed(2)))} title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs font-medium text-slate-600">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPlots} disabled={loading || !siteId}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Refresh
            </Button>
            {canWrite && (
              <ColonyUnitSyncButton key={siteId} records={dbPlots} siteId={siteId}
                siteName={currentSite?.name} loading={loading} onCreated={fetchPlots} />
            )}
          </div>
        </div>
      </Motion.div>

      <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_2px_24px_-10px_rgba(30,41,59,0.18)]">
        {!siteId ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">Select a site to view its colony map</div>
        ) : (
          <div className="max-h-[calc(100vh-220px)] overflow-auto p-3">
            <svg
              viewBox={VIEWBOX}
              style={{ width: `${zoom * 100}%`, minWidth: 640 }}
              className="mx-auto block"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Roads */}
              {ROADS.map((r, i) => (
                <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={ROAD_FILL} />
              ))}

              {/* Chakroad bands */}
              {CHAKROAD_BANDS.map((b, i) => (
                <g key={i}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fff" stroke="#1e293b" strokeWidth={0.7} />
                  {b.labels.map((l, j) => (
                    <text
                      key={j} x={l.x} y={l.y} fontSize={7.5} fontWeight="700" fill="#0f172a"
                      textAnchor="middle" dominantBaseline="central" letterSpacing={1.5}
                      transform={b.vertical ? `rotate(-90 ${l.x} ${l.y})` : undefined}
                    >
                      CHAKROAD
                    </text>
                  ))}
                </g>
              ))}

              {/* Parks */}
              {PARKS.map((p, i) => p.kind === 'rect' ? (
                <g key={i}>
                  <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={PARK_FILL} stroke="#1e293b" strokeWidth={0.7} />
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 - 5} fontSize={7} fontWeight="700" fill="#15803d" textAnchor="middle">{p.label}</text>
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 6} fontSize={6.5} fontWeight="600" fill="#be185d" textAnchor="middle">{p.size.toFixed(2)}</text>
                </g>
              ) : (
                <g key={i}>
                  <polygon points={p.points} fill={PARK_FILL} stroke="#1e293b" strokeWidth={0.7} />
                  <text x={p.lx} y={p.ly} fontSize={7} fontWeight="700" fill="#15803d" textAnchor="middle" transform={`rotate(-90 ${p.lx} ${p.ly})`}>{p.label}</text>
                </g>
              ))}

              {/* Temple + Gate */}
              <rect x={TEMPLE.x} y={TEMPLE.y} width={TEMPLE.w} height={TEMPLE.h} fill="#fff" stroke="#1e293b" strokeWidth={0.7} />
              <text x={TEMPLE.x + TEMPLE.w / 2} y={TEMPLE.y + TEMPLE.h / 2} fontSize={4.5} fontWeight="700" fill="#0f172a" textAnchor="middle" dominantBaseline="central">TEM.</text>
              <rect x={GATE.x} y={GATE.y} width={GATE.w} height={GATE.h} fill="#fff" stroke="#1e293b" strokeWidth={0.9} />
              <text x={GATE.x + GATE.w / 2} y={GATE.y + GATE.h / 2} fontSize={7} fontWeight="700" fill="#0f172a" textAnchor="middle" dominantBaseline="central" letterSpacing={1.2}>GATE</text>

              {/* Road name plates */}
              {ROAD_LABELS.map((l, i) => {
                const w = l.text.length * 4.4 + 6, h = 10;
                return (
                  <g key={i} transform={l.vertical ? `rotate(-90 ${l.x} ${l.y})` : undefined}>
                    <rect x={l.x - w / 2} y={l.y - h / 2} width={w} height={h} fill="#fff" opacity={0.95} />
                    <text x={l.x} y={l.y} fontSize={6.5} fontWeight="700" fill="#0f172a" textAnchor="middle" dominantBaseline="central" letterSpacing={0.6}>{l.text}</text>
                  </g>
                );
              })}

              {/* Goharni bypass road */}
              <line x1={BYPASS_ROAD.x1} y1={BYPASS_ROAD.y - 4} x2={BYPASS_ROAD.x2} y2={BYPASS_ROAD.y - 4} stroke="#1d4ed8" strokeWidth={0.8} />
              <line x1={BYPASS_ROAD.x1} y1={BYPASS_ROAD.y + 4} x2={BYPASS_ROAD.x2} y2={BYPASS_ROAD.y + 4} stroke="#1d4ed8" strokeWidth={0.8} />
              <text x={(BYPASS_ROAD.x1 + BYPASS_ROAD.x2) / 2} y={BYPASS_ROAD.y} fontSize={7} fontWeight="700" fill="#0f172a" textAnchor="middle" dominantBaseline="central" letterSpacing={1.4}>{BYPASS_ROAD.label}</text>

              {/* Compass */}
              <g transform={`translate(${COMPASS.x} ${COMPASS.y})`}>
                <line x1={0} y1={26} x2={0} y2={-26} stroke="#dc2626" strokeWidth={1.4} />
                <line x1={-26} y1={0} x2={26} y2={0} stroke="#dc2626" strokeWidth={1.4} />
                <line x1={-15} y1={-15} x2={15} y2={15} stroke="#ec4899" strokeWidth={1} />
                <line x1={-15} y1={15} x2={15} y2={-15} stroke="#ec4899" strokeWidth={1} />
                <circle r={5} fill="#fff" stroke="#dc2626" strokeWidth={1.4} />
                <text x={0} y={-32} fontSize={13} fontWeight="800" fill="#1d4ed8" textAnchor="middle">N</text>
                <text x={32} y={0} fontSize={9} fontWeight="700" fill="#1d4ed8" textAnchor="middle" dominantBaseline="central">E</text>
                <text x={0} y={36} fontSize={9} fontWeight="700" fill="#1d4ed8" textAnchor="middle">S</text>
                <text x={-32} y={0} fontSize={9} fontWeight="700" fill="#1d4ed8" textAnchor="middle" dominantBaseline="central">W</text>
              </g>

              {/* Flats, office and stairs replace the former S1–S15 strip. */}
              {FLAT_SHOP_AREAS.map((area) => (
                <g key={area.id}>
                  <rect x={area.x} y={area.y} width={area.w} height={area.h}
                    fill={area.id === 'office' ? '#dbeafe' : '#e2e8f0'} stroke="#1e293b" strokeWidth={0.55} />
                  <text x={area.x + area.w / 2} y={area.y + area.h / 2}
                    fontSize={area.id === 'office' ? 7 : 4.8} fontWeight="700" fill="#475569"
                    textAnchor="middle" dominantBaseline="central">{area.label}</text>
                </g>
              ))}

              {/* Plots and flat/shop units */}
              {COLONY_PLOTS.map((pl) => (
                <PlotShape
                  key={colonyUnitNo(pl)}
                  pl={pl}
                  rec={plotIndex.get(colonyUnitNo(pl))}
                  hovered={hover?.pl === pl}
                  onHover={setHover}
                  onClick={handlePlotClick}
                />
              ))}
              <g transform="translate(-3 850) scale(0.29)">
                <text x={628} y={18} fontSize={22} fontWeight="700" fill="#334155" textAnchor="middle">FLATS &amp; SHOPS — LAYOUT DETAIL</text>
                {FLAT_SHOP_COMMON_AREAS.map((area) => (
                  <g key={area.id}>
                    <rect x={area.x} y={area.y} width={area.w} height={area.h}
                      fill={area.id === 'office' ? '#dbeafe' : '#e2e8f0'} stroke="#64748b" strokeWidth={2} />
                    <text x={area.x + area.w / 2} y={area.y + area.h / 2} fontSize={area.vertical ? 14 : 20}
                      fontWeight="700" fill="#475569" textAnchor="middle" dominantBaseline="central"
                      transform={area.vertical ? `rotate(-90 ${area.x + area.w / 2} ${area.y + area.h / 2})` : undefined}>{area.label}</text>
                  </g>
                ))}
                {FLAT_SHOP_UNITS.map((unit) => {
                  const rec = plotIndex.get(colonyUnitNo(unit));
                  const status = String(rec?.status || '').toUpperCase();
                  return (
                    <g key={colonyUnitNo(unit)} role="button" tabIndex={0}
                      aria-label={`${unit.type} ${colonyUnitNo(unit)}, ${rec ? status : 'not created'}`}
                      onMouseEnter={() => setHover({ pl: unit, rec })} onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ pl: unit, rec })} onBlur={() => setHover(null)}
                      onClick={() => handlePlotClick(unit, rec)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault(); handlePlotClick(unit, rec);
                        }
                      }} style={{ cursor: 'pointer' }}>
                      <rect x={unit.x} y={unit.y} width={unit.w} height={unit.h}
                        fill={rec ? STATUS_FILL[status] || OTHER_FILL : MISSING_FILL}
                        stroke={hover?.pl === unit ? '#0f172a' : '#64748b'} strokeWidth={hover?.pl === unit ? 5 : 2} />
                      <text x={unit.x + unit.w / 2} y={unit.y + unit.h / 2} fontSize={22}
                        fontWeight="700" fill="#1d4ed8" textAnchor="middle" dominantBaseline="central">{colonyUnitNo(unit)}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        )}

        {/* Hover info card */}
        {hover && (
          <div className="pointer-events-none absolute right-4 top-4 z-20 w-60 rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                {hover.pl.type || 'Plot'} {colonyUnitNo(hover.pl)}
              </span>
              <span
                className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                style={{ background: hover.rec ? (STATUS_FILL[String(hover.rec.status || '').toUpperCase()] || OTHER_FILL) : MISSING_FILL }}
              >
                {hover.rec ? String(hover.rec.status || '—').toUpperCase() : 'NOT CREATED'}
              </span>
            </div>
            <div className="mt-2 space-y-1 text-[12px] text-slate-600">
              <div className="flex justify-between"><span>Size</span><span className="font-semibold text-slate-800">{Number(hover.pl.size || hover.rec?.plot_size) > 0 ? `${Number(hover.pl.size || hover.rec.plot_size).toFixed(2)} gaj` : 'Not entered'}</span></div>
              {hover.rec?.buyer_name && (
                <div className="flex justify-between"><span>Buyer</span><span className="max-w-[130px] truncate font-semibold text-slate-800">{hover.rec.buyer_name}</span></div>
              )}
              {hover.rec?.booking_by && (
                <div className="flex justify-between"><span>Booked by</span><span className="max-w-[130px] truncate font-semibold text-slate-800">{hover.rec.booking_by}</span></div>
              )}
              {hover.rec && Number(hover.rec.total_received) > 0 && (
                <div className="flex justify-between"><span>Received</span><span className="font-semibold text-emerald-700">₹{Number(hover.rec.total_received).toLocaleString('en-IN')}</span></div>
              )}
              <p className="pt-1 text-[11px] text-slate-400">{hover.rec ? 'Click to open unit payments' : 'No record in plot payments yet'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
