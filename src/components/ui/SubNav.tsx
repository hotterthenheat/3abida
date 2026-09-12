import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface SubNavItem {
  path: string;
  label: string;
  icon?: LucideIcon;
}

interface SubNavProps {
  items: SubNavItem[];
  ariaLabel?: string;
}

/**
 * Route-driven sub-page tabs. The active tab wears a living holo-silver pill
 * with dark ink — the same animated chrome as the logo, so navigation reads
 * as terminal hardware rather than market color. The pill is a framer-motion
 * shared element, so it slides between tabs instead of blinking.
 */
const SubNav = ({ items, ariaLabel }: SubNavProps) => {
  return (
    <nav
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 border border-borderSubtle bg-panel rounded-md p-0.5"
    >
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `relative px-3 py-1.5 font-mono text-xs whitespace-nowrap transition-colors ${
              isActive
                ? 'text-[#0a0a0a] font-semibold'
                : 'text-textSecondary font-medium hover:text-textPrimary hover:bg-ink/[0.03] rounded-[5px]'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId={`subnav-pill-${ariaLabel ?? 'tabs'}`}
                  className="absolute inset-0 rounded-[5px] holo-bg"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {item.icon && <item.icon className="w-3.5 h-3.5" />}
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default SubNav;
