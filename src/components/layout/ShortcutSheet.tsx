/*
==================================================
  SLAYER TERMINAL - THE KEYS FOR THIS PAGE (components/layout/ShortcutSheet.tsx)

  `?` from any page (2026-10-09, the ideas' keyboard
  pick): the keys that work everywhere, then the keys
  of the page you are on — read from the one list
  Settings › Keyboard prints (keys.ts), so the sheet
  and the page can never disagree. A door at its foot
  opens the whole list.
==================================================
*/

import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Modal from '../ui/Modal';
import { keyGroupsFor, keyJoin } from './keys';

const Key = ({ children }: { children: string }) => (
  <kbd className="inline-flex items-center h-5 px-1.5 rounded border border-borderSubtle bg-chip font-mono text-[11px] text-textSecondary">{children}</kbd>
);

const ShortcutSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { pathname } = useLocation();
  const groups = keyGroupsFor(pathname);
  return (
    <Modal open={open} onClose={onClose} ariaLabel="The keys for this page" header={<h2 className="text-[13px] font-semibold text-textPrimary">The keys for this page</h2>} widthClass="max-w-[560px]">
      <div className="-mx-1" data-key-sheet>
        {groups.map(g => (
          <Fragment key={g.where}>
            <h3 className="px-1 pt-3 pb-1.5 text-[11px] font-semibold text-textMuted first:pt-0">{g.where}</h3>
            <ul className="flex flex-col">
              {g.keys.map(s => (
                <li key={s.does} className="px-1 py-1.5 border-t border-borderSubtle/60 flex items-center justify-between gap-6">
                  <span className="text-[12px] text-textSecondary">{s.does}</span>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    {s.keys.map((k, i) => (
                      <span key={k} className="inline-flex items-center gap-1">
                        {i > 0 && <span className="text-[11px] text-textMuted">{keyJoin(s)}</span>}
                        <Key>{k}</Key>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Fragment>
        ))}
        <div className="px-1 pt-3 flex items-center justify-between gap-4 text-[11px] text-textMuted">
          <span>Every page's keys are in Settings; every word the terminal uses, in the glossary.</span>
          <span className="shrink-0 inline-flex items-center gap-3">
            <Link to="/glossary" onClick={onClose} className="hit text-textSecondary underline decoration-borderMuted underline-offset-4 hover:text-textPrimary" data-key-sheet-glossary>
              Glossary
            </Link>
            <Link to="/settings/keyboard" onClick={onClose} className="hit text-textSecondary underline decoration-borderMuted underline-offset-4 hover:text-textPrimary">
              Settings › Keyboard
            </Link>
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default ShortcutSheet;
