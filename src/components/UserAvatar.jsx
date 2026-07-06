import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from './ui/tooltip';

// Deterministic palette picker — same name always gets the same colour so avatars stay
// recognisable across a table without needing lookups.
const PALETTE = [
  { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200' },
  { bg: 'bg-sky-100', text: 'text-sky-700', ring: 'ring-sky-200' },
  { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700', ring: 'ring-indigo-200' },
  { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-200' },
  { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700', ring: 'ring-cyan-200' },
  { bg: 'bg-pink-100', text: 'text-pink-700', ring: 'ring-pink-200' },
  { bg: 'bg-lime-100', text: 'text-lime-700', ring: 'ring-lime-200' },
];

const pickPalette = (name) => {
  const s = String(name || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
};

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-7 h-7 text-[11px]',
};

/**
 * Small circular initial avatar with a tooltip that reveals the full name on hover.
 * Used in "Created By" columns across the app so dense tables stay compact but still
 * attribute every row to a person.
 *
 * Props:
 *   name      — string, full display name (required to show the avatar; falsy → dash).
 *   label     — optional label shown in the tooltip body (e.g. "Created by"). Defaults to nothing extra.
 *   size      — 'xs' | 'sm' | 'md', default 'sm'.
 *   dashClass — tailwind classes applied to the fallback dash when name is empty.
 *   className — extra classes for the outer wrapper.
 */
function UserAvatar({ name, label, size = 'sm', dashClass = 'text-xs text-slate-300', className = '' }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return <span className={dashClass}>—</span>;

  const letter = trimmed.charAt(0).toUpperCase();
  const palette = pickPalette(trimmed);
  const sizeCls = SIZE_MAP[size] || SIZE_MAP.sm;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            aria-label={label ? `${label}: ${trimmed}` : trimmed}
            className={`rounded-full flex items-center justify-center font-bold cursor-default shrink-0 ring-1 ${palette.bg} ${palette.text} ${palette.ring} ${sizeCls} ${className}`}
          >
            {letter}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label ? <p className="text-slate-400">{label}</p> : null}
          <p className="font-semibold">{trimmed}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default UserAvatar;
