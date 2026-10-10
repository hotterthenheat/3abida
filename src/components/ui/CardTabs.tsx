import { useId } from 'react';
import { LayoutGroup, motion } from 'framer-motion';

/** The CHILD tab tier (Noah, 2026-08-17: "parent and child should [not] be
    sharing button design" — page-level mode switches own the FilterTabs pill
    rail). Controls that live INSIDE a panel — card sections, layout toggles,
    metric pickers — wear this instead: mono caps whispers with a white
    hairline that GLIDES between them on the house ease. White = "where you
    are", one tier quieter than the parent's solid pill.
    ON PAPER every tab is black (Noah, 2026-09-19, on the setup page: "setup,
    contract, and why we chose this all need to be black not gray") and where
    you are is the RULE, cut twice as thick — `tabRest` and `--tab-rule` are
    tokens, so a tab inside a dark chart on a light page keeps the dark set. */
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
      {/* flex-wrap: a row of tabs that does not fit folds to a second line instead of running off the box (the phone pass, 2026-09-13 — the news feed's five tabs at 390); the hairline glides to wherever the tab landed */}
      <div role="group" aria-label={ariaLabel} className="inline-flex items-center gap-4 flex-wrap">
        {options.map(opt => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className="hit relative py-1 font-mono text-[11px] uppercase tracking-widest transition-colors"
            >
              <span className={active ? 'text-textPrimary' : 'text-tabRest hover:text-textPrimary'}>{opt.label}</span>
              {active && (
                <motion.span
                  layoutId="card-tab-line"
                  className="absolute left-0 right-0 bottom-0 h-[var(--tab-rule)] bg-textPrimary"
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
