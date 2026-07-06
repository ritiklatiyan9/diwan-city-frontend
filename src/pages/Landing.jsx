import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2, ArrowRight, BookOpen, LayoutGrid, HandCoins, ShieldCheck,
  BarChart3, Wallet, Sprout, Briefcase, Library, CreditCard, NotebookPen,
  Package, MessageSquare, Sparkles, CheckCircle2, Lock, Users, KeyRound,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { GlowyWavesHero } from '../components/ui/glowy-waves-hero-shadcnui';

const TONES = {
  indigo:  'bg-indigo-50 text-indigo-600 ring-indigo-100',
  teal:    'bg-teal-50 text-teal-600 ring-teal-100',
  violet:  'bg-violet-50 text-violet-600 ring-violet-100',
  amber:   'bg-amber-50 text-amber-600 ring-amber-100',
  rose:    'bg-rose-50 text-rose-600 ring-rose-100',
  sky:     'bg-sky-50 text-sky-600 ring-sky-100',
};

const FEATURES = [
  { icon: Building2, tone: 'indigo', title: 'Multi-site finances', desc: 'Run separate books for every project site and switch context in a click — balances, ledgers and reports stay scoped per site.' },
  { icon: BookOpen, tone: 'teal', title: 'Day Book & ledgers', desc: 'Cash, bank and personal ledgers stay in sync automatically as payments, expenses and transfers flow through the day book.' },
  { icon: LayoutGrid, tone: 'violet', title: 'Plots, payments & registry', desc: 'Track installments, receipts, interest and registry status across every plot — with reminders for overdue collections.' },
  { icon: HandCoins, tone: 'amber', title: 'Commissions & vendors', desc: 'Calculate agent commissions and manage vendor commitments, inventory and payouts without spreadsheets.' },
  { icon: ShieldCheck, tone: 'rose', title: 'Approvals & roles', desc: 'Maker-checker approvals on every financial entry, with granular role-based permissions for admins and sub-admins.' },
  { icon: BarChart3, tone: 'sky', title: 'Analytics & insight', desc: 'Real-time KPIs — incoming, expenses, profit, pending collections and site balance — the moment data changes.' },
];

const MODULES = [
  { icon: BarChart3, label: 'Dashboard' },
  { icon: Sprout, label: 'Farmer Payments' },
  { icon: BookOpen, label: 'Day Book' },
  { icon: NotebookPen, label: 'Personal Ledgers' },
  { icon: Briefcase, label: 'Firm Transactions' },
  { icon: LayoutGrid, label: 'Plot Payments' },
  { icon: Library, label: 'Plot Registry' },
  { icon: CreditCard, label: 'Expenses' },
  { icon: Wallet, label: 'Imprest' },
  { icon: HandCoins, label: 'Commissions' },
  { icon: Package, label: 'Vendors' },
  { icon: MessageSquare, label: 'Internal Chat' },
];

const SECURITY_POINTS = [
  { icon: KeyRound, title: 'Role-based permissions', desc: 'Admins, sub-admins and agents each see exactly what they should — nothing more.' },
  { icon: ShieldCheck, title: 'Maker-checker approvals', desc: 'Every financial entry can require review before it settles into the books.' },
  { icon: Building2, title: 'Per-site data scoping', desc: 'Teams only access the project sites they are explicitly assigned to.' },
  { icon: Lock, title: 'Encrypted access & sessions', desc: 'Secure tokens with controlled login sessions and audit-friendly activity.' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] } }),
};

export const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full scroll-smooth overflow-x-hidden bg-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-500 shadow-sm shadow-indigo-500/25">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">Account Software</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-500 md:flex">
            <a href="#features" className="transition-colors hover:text-slate-900">Features</a>
            <a href="#modules" className="transition-colors hover:text-slate-900">Modules</a>
            <a href="#security" className="transition-colors hover:text-slate-900">Security</a>
          </nav>
          <Button size="sm" onClick={() => navigate('/login')} className="h-9 rounded-lg text-xs sm:text-sm">Sign In</Button>
        </div>
      </header>

      {/* ── Hero (animated canvas) ── */}
      <GlowyWavesHero />

      {/* ── Features ── */}
      <section id="features" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Built for real estate
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Everything your finance team needs</h2>
          <p className="mt-3 text-base text-slate-500">From the first booking to the final registry — one connected system for the whole real-estate money trail.</p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-40px' }}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-300 hover:shadow-[0_20px_44px_-20px_rgba(16,24,40,0.25)]"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-110 ${TONES[f.tone]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Modules ── */}
      <section id="modules" className="relative scroll-mt-20 border-y border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">One suite, every workflow</h2>
            <p className="mt-3 text-base text-slate-500">A dozen tightly-integrated modules that share the same data — so a payment recorded once shows up everywhere it should.</p>
          </motion.div>

          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {MODULES.map((m, i) => {
              const Icon = m.icon;
              return (
                <motion.div
                  key={m.label}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-30px' }}
                  variants={fadeUp}
                  whileHover={{ y: -3 }}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_14px_30px_-16px_rgba(16,24,40,0.22)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-100 transition-all duration-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:ring-indigo-100">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-medium text-slate-700">{m.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Security ── */}
      <section id="security" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeUp}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Enterprise-grade control
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Your money, under lock and key</h2>
            <p className="mt-3 text-base text-slate-500">Fine-grained permissions and review workflows keep every rupee accountable — without slowing your team down.</p>
            <div className="mt-8 space-y-4">
              {SECURITY_POINTS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div key={s.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="flex gap-3.5">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{s.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Decorative permissions mock */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} variants={fadeUp} className="relative">
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-100/50 via-violet-100/30 to-transparent blur-2xl" />
            <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_24px_60px_-24px_rgba(16,24,40,0.3)]">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-[13px] font-semibold text-slate-800">Access & Permissions</span>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-100">Live</span>
              </div>
              <div className="divide-y divide-slate-50">
                {[
                  { name: 'Site Admin', role: 'Full access', on: true, tone: 'bg-indigo-500' },
                  { name: 'Accounts Sub-admin', role: 'Day book · Expenses', on: true, tone: 'bg-violet-500' },
                  { name: 'Sales Agent', role: 'Commissions only', on: true, tone: 'bg-amber-500' },
                  { name: 'Auditor', role: 'Read-only', on: false, tone: 'bg-slate-300' },
                ].map((row) => (
                  <div key={row.name} className="flex items-center gap-3 px-5 py-3.5">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${row.tone}`}>
                      {row.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{row.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{row.role}</p>
                    </div>
                    <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${row.on ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-200'}`}>
                      <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] text-slate-500">Maker-checker enabled · changes require approval</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-6 py-16 text-center shadow-2xl shadow-slate-900/20 sm:px-12"
        >
          <div className="pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Bring your entire finance operation together</h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-slate-300">Sign in to your workspace and start managing sites, payments and approvals from a single, elegant dashboard.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate('/login')} className="h-12 rounded-xl bg-white px-7 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <a href="#features" className="text-sm font-medium text-slate-300 transition-colors hover:text-white">See what's inside →</a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-600 to-violet-500">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Account Software</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-slate-400">
            <a href="#features" className="transition-colors hover:text-slate-600">Features</a>
            <a href="#modules" className="transition-colors hover:text-slate-600">Modules</a>
            <a href="#security" className="transition-colors hover:text-slate-600">Security</a>
            <Link to="/login" className="transition-colors hover:text-slate-600">Sign In</Link>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} Account Software</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
