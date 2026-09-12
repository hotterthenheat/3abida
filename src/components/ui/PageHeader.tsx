import React from 'react';
import { useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../layout/nav';

interface PageHeaderProps {
  breadcrumb: string[];
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const PageHeader = ({ breadcrumb, title, subtitle, actions }: PageHeaderProps) => {
  const { pathname } = useLocation();
  // Every page carries its section icon — resolved from the nav registry, so
  // no page has to pass one and nav/page identity can never drift apart.
  const section = `/${pathname.split('/')[1] ?? ''}`;
  const Icon = NAV_ITEMS.find(i => i.path === section)?.icon;

  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      {/* Keyed on the title so pages that swap views in place (Compass modes)
          fade their wording instead of hard-cutting it. Actions are OUTSIDE
          this block on purpose — re-mounting them would kill the FilterTabs
          pill glide on the very control you just clicked. */}
      <div key={title} className="min-w-0 animate-soft-in">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-textMuted uppercase tracking-widest mb-1.5">
          {breadcrumb.map((part, i) => (
            <React.Fragment key={part}>
              {i > 0 && <span>/</span>}
              <span className={i === breadcrumb.length - 1 ? 'text-textSecondary' : ''}>{part}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="inline-flex w-6 h-6 rounded-md border border-borderSubtle bg-inset items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-textSecondary" />
            </span>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-textPrimary leading-none">{title}</h1>
        </div>
        {subtitle && <p className="text-xs text-textSecondary mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};

export default PageHeader;
