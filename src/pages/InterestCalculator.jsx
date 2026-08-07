import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  Calculator, ArrowDownLeft, ArrowUpRight, CalendarDays, Percent,
  TrendingUp, Users, RotateCcw, Info,
} from 'lucide-react';
import { projectLoan, inr, inrShort, fmtDate, humanTenure, toISODate } from '../utils/interest';

const AMOUNT_CHIPS = [50000, 100000, 500000, 1000000];
const TENURE_CHIPS = [
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
  { label: '2 Years', months: 24 },
  { label: '5 Years', months: 60 },
];

const InterestCalculator = () => {
  const navigate = useNavigate();

  const [direction, setDirection] = useState('BORROWED');
  const [principal, setPrincipal] = useState('100000');
  const [rate, setRate] = useState('10');
  const [rateBasis, setRateBasis] = useState('YEARLY');
  const [method, setMethod] = useState('SIMPLE');
  const [compounding, setCompounding] = useState('YEARLY');
  const [tenureValue, setTenureValue] = useState('1');
  const [tenureUnit, setTenureUnit] = useState('YEARS');
  const [startDate, setStartDate] = useState(() => toISODate(new Date()));

  const tenureMonths = Math.round(
    (parseFloat(tenureValue) || 0) * (tenureUnit === 'YEARS' ? 12 : 1)
  );

  const result = useMemo(
    () => projectLoan({
      principal, rate, rateBasis, method, compounding, tenureMonths, startDate,
    }),
    [principal, rate, rateBasis, method, compounding, tenureMonths, startDate]
  );

  // Cumulative interest at each milestone. Monthly rows read well up to two
  // years; past that they turn into a wall, so switch to yearly.
  const schedule = useMemo(() => {
    if (tenureMonths <= 0) return [];
    const stepMonths = tenureMonths <= 24 ? 1 : 12;
    const rows = [];
    for (let m = stepMonths; m <= tenureMonths; m += stepMonths) {
      const at = projectLoan({ principal, rate, rateBasis, method, compounding, tenureMonths: m, startDate });
      rows.push({
        months: m,
        date: at.maturityDate,
        interest: at.interest,
        total: at.total,
        gained: at.interest - (rows[rows.length - 1]?.interest ?? 0),
      });
    }
    // Always close the table on the real maturity date, even if the loop's
    // last step fell short of it (e.g. a 30-month tenure stepping by 12).
    if (rows[rows.length - 1]?.months !== tenureMonths) {
      rows.push({
        months: tenureMonths,
        date: result.maturityDate,
        interest: result.interest,
        total: result.total,
        gained: result.interest - (rows[rows.length - 1]?.interest ?? 0),
      });
    }
    return rows;
  }, [principal, rate, rateBasis, method, compounding, tenureMonths, startDate, result]);

  const borrowing = direction === 'BORROWED';
  const accent = borrowing
    ? { text: 'text-rose-700', bg: 'from-rose-50 via-rose-50/60 to-white', ring: 'border-rose-100', chip: 'bg-rose-100 text-rose-700' }
    : { text: 'text-emerald-700', bg: 'from-emerald-50 via-emerald-50/60 to-white', ring: 'border-emerald-100', chip: 'bg-emerald-100 text-emerald-700' };

  const reset = () => {
    setPrincipal('100000'); setRate('10'); setRateBasis('YEARLY');
    setMethod('SIMPLE'); setCompounding('YEARLY');
    setTenureValue('1'); setTenureUnit('YEARS'); setStartDate(toISODate(new Date()));
  };

  const effectiveAnnualPct = result.principal > 0 && result.days > 0
    ? (result.interest / result.principal) * (365 / result.days) * 100
    : 0;

  return (
    <div className="w-full max-w-full md:max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Interest Calculator</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Work out interest and total payable before you commit to a deal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={reset} className="text-slate-600">
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
          </Button>
          <Button size="sm" onClick={() => navigate('/interest')}>
            <Users className="w-4 h-4 mr-1.5" /> Parties
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Inputs ── */}
        <Card className="lg:col-span-3 shadow-none border-slate-200">
          <CardContent className="p-4 sm:p-5 space-y-5">
            {/* Direction */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                What is happening?
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDirection('BORROWED')}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                    borrowing
                      ? 'border-rose-300 bg-rose-50/70 ring-1 ring-rose-200'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${borrowing ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
                    <ArrowDownLeft className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-semibold ${borrowing ? 'text-rose-800' : 'text-slate-700'}`}>
                      Money Received
                    </span>
                    <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                      I borrowed — I pay interest
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDirection('LENT')}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                    !borrowing
                      ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!borrowing ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[13px] font-semibold ${!borrowing ? 'text-emerald-800' : 'text-slate-700'}`}>
                      Money Given
                    </span>
                    <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                      I lent — I earn interest
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Principal Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base font-medium">₹</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="h-12 pl-8 text-lg font-semibold tabular-nums"
                  placeholder="100000"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AMOUNT_CHIPS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setPrincipal(String(amt))}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                      String(amt) === principal
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ₹{inrShort(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Interest Rate
                </Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="h-10 pl-9 text-sm font-medium tabular-nums"
                    placeholder="10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Rate Applies
                </Label>
                <Select value={rateBasis} onValueChange={setRateBasis}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEARLY">Per Year (annual)</SelectItem>
                    <SelectItem value="MONTHLY">Per Month (monthly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tenure */}
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                Time Period
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={tenureValue}
                  onChange={(e) => setTenureValue(e.target.value)}
                  className="h-10 text-sm font-medium tabular-nums"
                  placeholder="1"
                />
                <Select value={tenureUnit} onValueChange={setTenureUnit}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YEARS">Years</SelectItem>
                    <SelectItem value="MONTHS">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TENURE_CHIPS.map((t) => (
                  <button
                    key={t.months}
                    type="button"
                    onClick={() => {
                      setTenureUnit(t.months % 12 === 0 ? 'YEARS' : 'MONTHS');
                      setTenureValue(String(t.months % 12 === 0 ? t.months / 12 : t.months));
                    }}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                      tenureMonths === t.months
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Method + start date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Interest Type
                </Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLE">Simple Interest</SelectItem>
                    <SelectItem value="COMPOUND">Compound Interest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {method === 'COMPOUND' ? (
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Compounded
                  </Label>
                  <Select value={compounding} onValueChange={setCompounding}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              )}
            </div>

            {method === 'COMPOUND' && (
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Result ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className={`relative overflow-hidden rounded-2xl border ${accent.ring} bg-gradient-to-br ${accent.bg} p-5`}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent.chip}`}>
                <Calculator className="w-4 h-4" />
              </span>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-none">
                  {borrowing ? 'You Will Pay' : 'You Will Receive'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  ₹{inr(result.principal)} · {rate || 0}% {rateBasis === 'MONTHLY' ? 'p.m.' : 'p.a.'} · {humanTenure(tenureMonths)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/70 border border-white px-3.5 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {borrowing ? 'Interest to Pay' : 'Interest to Earn'}
                </p>
                <p className={`text-2xl font-extrabold ${accent.text} mt-1 tabular-nums leading-none`}>
                  ₹{inr(result.interest)}
                </p>
              </div>

              <div className="rounded-xl bg-white/70 border border-white px-3.5 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {borrowing ? 'Total Payable' : 'Total Receivable'}
                </p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1 tabular-nums leading-none">
                  ₹{inr(result.total)}
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  ₹{inr(result.principal)} principal + ₹{inr(result.interest)} interest
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/70 border border-white px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Per Month</p>
                  <p className="text-sm font-bold text-slate-800 mt-1 tabular-nums">₹{inr(result.perMonth)}</p>
                </div>
                <div className="rounded-xl bg-white/70 border border-white px-3 py-2.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Per Day</p>
                  <p className="text-sm font-bold text-slate-800 mt-1 tabular-nums">₹{inr(result.perDay)}</p>
                </div>
              </div>

              <div className="rounded-xl bg-white/70 border border-white px-3.5 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> Maturity
                  </span>
                  <span className="text-[12px] font-semibold text-slate-800">{fmtDate(result.maturityDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> Duration
                  </span>
                  <span className="text-[12px] font-semibold text-slate-800">{result.days} days</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Effective annual
                  </span>
                  <span className="text-[12px] font-semibold text-slate-800 tabular-nums">
                    {effectiveAnnualPct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Interest is counted on real days (365-day year), so a leap year costs one day more.
              Part-payments made mid-term are handled on the party's loan page — record them there
              to see the reducing balance.
            </p>
          </div>
        </div>
      </div>

      {/* ── Schedule ── */}
      {schedule.length > 0 && (
        <Card className="shadow-none border-slate-200">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Growth Schedule</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Interest accumulated if nothing is paid until maturity
                </p>
              </div>
              <span className="text-[11px] text-slate-400">
                {schedule.length <= 24 ? 'Month by month' : 'Year by year'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs">Period</TableHead>
                    <TableHead className="text-xs">On Date</TableHead>
                    <TableHead className="text-xs text-right">Interest This Step</TableHead>
                    <TableHead className="text-xs text-right">Interest So Far</TableHead>
                    <TableHead className="text-xs text-right">Total {borrowing ? 'Payable' : 'Receivable'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((row) => (
                    <TableRow key={row.months} className="hover:bg-slate-50/80">
                      <TableCell className="text-sm text-slate-700 font-medium whitespace-nowrap">
                        {humanTenure(row.months)}
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-500 whitespace-nowrap">{fmtDate(row.date)}</TableCell>
                      <TableCell className="text-[13px] text-slate-500 text-right tabular-nums">
                        ₹{inr(row.gained)}
                      </TableCell>
                      <TableCell className={`text-[13px] font-medium text-right tabular-nums ${accent.text}`}>
                        ₹{inr(row.interest)}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-slate-800 text-right tabular-nums">
                        ₹{inr(row.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InterestCalculator;
