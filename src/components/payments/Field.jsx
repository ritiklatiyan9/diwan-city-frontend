// The fixed-height grid cell every payment-modal row is built from. Exists as a
// component because the no-scroll layout depends on every field being exactly
// 56px (16px label + 4px gap + 36px control) and it is rendered ~20x per modal.
import { cn } from '@/lib/utils';
import { Label } from '../ui/label';

// col-span-${n} does not survive Tailwind's JIT scan — it only emits classes it
// can see as literal strings. Hence the map.
const SPAN = {
  3: 'sm:col-span-3',
  4: 'sm:col-span-4',
  6: 'sm:col-span-6',
  8: 'sm:col-span-8',
  12: 'sm:col-span-12',
};

export function Field({ label, htmlFor, required, hint, error, span = 4, children, className }) {
  return (
    <div className={cn('col-span-12 min-w-0', SPAN[span] || SPAN[4], className)}>
      <Label
        htmlFor={htmlFor}
        className="mb-1 block truncate text-[11px] font-medium leading-4 text-muted-foreground"
      >
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {/* Reserve no height when clean: an always-rendered <p> would cost 16px
          on every one of ~20 rows and blow the no-scroll budget. */}
      {(error || hint) && (
        <p className={cn('mt-0.5 truncate text-[10px] leading-3', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export default Field;
