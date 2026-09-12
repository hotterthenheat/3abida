import { useId } from 'react';
import { LayoutGroup, motion } from 'framer-motion';

/** The CHILD tab tier (Noah, 2026-08-17: "parent and child should [not] be
    sharing button design" — page-level mode switches own the FilterTabs pill
    rail). Controls that live INSIDE a panel — card sections, layout toggles,
    metric pickers — wear this instead: mono caps whispers with a white
    hairline that GLIDES between them on the house ease. White = "where you
    are", one tier quieter than the parent's solid pill. */
const CardTabs = <V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
  ariaLabel?: string;
}) => {
  const scope = useId(); // isolates the line from other CardTabs instances
  return (
    <LayoutGroup id={scope}>
      <div role="group" aria-label={ariaLabel} className="inline-flex items-center gap-4">
        {options.map(opt => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className="relative py-1 font-mono text-[10px] uppercase tracking-widest transition-colors"
            >
              <span className={active ? 'text-textPrimary' : 'text-textMuted hover:text-textSecondary'}>{opt.label}</span>
              {active && (
                <motion.span
                  layoutId="card-tab-line"
                  className="absolute left-0 right-0 bottom-0 h-px bg-textPrimary"
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
};

export default CardTabs;
