import { useId } from 'react';
import { LayoutGroup, motion } from 'framer-motion';

interface FilterTabsProps<V extends string> {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
}

/** Soft tab strip (shadcn grammar): sentence-case labels in a faint grouped
    rail, the active option inverted to a solid white pill with black text —
    "white = where you are" at full contrast, without boxes or dividers.
    The pill GLIDES between options (shared-layout), never teleports. */
const FilterTabs = <V extends string>({ options, value, onChange, ariaLabel }: FilterTabsProps<V>) => {
  const scope = useId(); // isolates the pill from other FilterTabs instances

  return (
    <LayoutGroup id={scope}>
      <div role="group" aria-label={ariaLabel} className="inline-flex items-center gap-0.5 rounded-lg bg-ink/[0.04] p-0.5">
        {options.map(opt => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className="relative px-3 py-1 rounded-md text-xs font-medium transition-colors"
            >
              {active && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 rounded-md bg-textPrimary shadow-sm shadow-black/40"
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <span className={`relative z-10 ${active ? 'text-[#0a0a0a] font-semibold' : 'text-textSecondary hover:text-textPrimary'}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

export default FilterTabs;
