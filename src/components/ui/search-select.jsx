// One searchable dropdown for the whole app. Replaces ~30 hand-rolled
// Popover+Command copies and every <datalist>, which could not be searched by
// phone number and offered no keyboard contract.
//
// Lives in ui/ rather than payments/ because it has non-payment callers
// (PlotRegistry, Farmers, DayBook member pickers).
import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from './command';

export function SearchSelect({
  value,
  onChange,
  options = [],
  getKey = (o) => o?.id ?? o,
  getLabel = (o) => o?.label ?? o?.name ?? String(o ?? ''),
  getSearch,
  renderOption,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No match',
  allowCustom = false,
  clearable = true,
  loading = false,
  disabled = false,
  limit = 100,
  id,
  className,
  triggerClassName,
}) {
  const [open, setOpen] = useState(false);
  // Query is internal state: every call site was otherwise forced to own two
  // extra useStates purely to feed the input back to itself.
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);

  const search = getSearch || getLabel;

  // cmdk's own filter is disabled below, so this is the single filter pass.
  // The previous PlotRegistry combo filtered here AND let cmdk filter again,
  // which silently dropped rows whose label and search text disagreed.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, limit);
    const words = q.split(/\s+/).filter(Boolean);
    return options
      .filter((o) => {
        const hay = String(search(o) ?? '').toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => {
        // Prefix matches first — typing "98" should surface 98xxx before x98x.
        const as = String(search(a) ?? '').toLowerCase().startsWith(q) ? 0 : 1;
        const bs = String(search(b) ?? '').toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs;
      })
      .slice(0, limit);
  }, [options, query, search, limit]);

  const selected = useMemo(
    () => options.find((o) => String(getKey(o)) === String(value)) ?? null,
    [options, value, getKey],
  );

  // A custom value that matches no option still has to render as the label.
  const display = selected ? getLabel(selected) : (value ? String(value) : '');

  const close = () => {
    setOpen(false);
    setQuery('');
    // Return focus so the next Enter advances the form instead of falling to body.
    triggerRef.current?.focus();
  };

  const commit = (key, option) => {
    onChange?.(key, option ?? null);
    close();
  };

  const showCustomRow =
    allowCustom &&
    query.trim() &&
    !filtered.some((o) => String(getLabel(o)).toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}
      // modal={false} is mandatory inside a Dialog: the default traps focus in
      // the popover and the dialog's own focus guard then fights it.
      modal={false}
    >
      <PopoverTrigger asChild>
        <button
          id={id}
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          // Enter must NOT open the popover: preventDefault here suppresses the
          // synthesized click, and the keydown still bubbles to the form, which
          // moves focus to the next field. ArrowDown/Space/click open it.
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input',
            'bg-transparent px-3 py-1 text-sm font-normal shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className, triggerClassName,
          )}
        >
          <span className={cn('truncate text-left', !display && 'text-muted-foreground')}>
            {loading ? 'Loading…' : (display || placeholder)}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {clearable && display && !disabled && (
              <X
                role="button"
                aria-label="Clear"
                className="h-3.5 w-3.5 opacity-40 hover:opacity-100"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange?.(null, null); }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="p-0"
        // Inline style, not the w-[--radix-*] shorthand: that is Tailwind v3
        // syntax and this app is on v4.
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!showCustomRow && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup className="max-h-56 overflow-y-auto">
              {filtered.map((o) => {
                const k = getKey(o);
                const isSel = String(k) === String(value);
                return (
                  <CommandItem key={String(k)} value={String(k)} onSelect={() => commit(k, o)}>
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', isSel ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1 truncate">
                      {renderOption ? renderOption(o, isSel) : getLabel(o)}
                    </span>
                  </CommandItem>
                );
              })}
              {showCustomRow && (
                // This row is what lets a SearchSelect replace a <datalist>:
                // free text is still allowed, but it is an explicit choice.
                <CommandItem
                  key="__custom__"
                  value={`__custom__${query}`}
                  onSelect={() => commit(query.trim(), null)}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  <span className="truncate">Use “{query.trim()}”</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default SearchSelect;
