/*
==================================================
  SLAYER TERMINAL - PUT IT ON THE HOME SCREEN (components/layout/InstallPrompt.tsx)

  The Logo System's install prompt (Web and App · Legal and install): "Put the terminal on your home screen. It opens
  full screen. [Install] [Not now]". It shows only when the browser itself offers to install the terminal (the
  `beforeinstallprompt` event — Chrome and Edge, once the manifest qualifies); "Not now" keeps it away for a month.
  The long-press shortcuts — Pulse, Trace, Pinpoint — are the manifest's (public/site.webmanifest).
==================================================
*/

import { useEffect, useState } from 'react';
import SlayerMark from '../../brand/SlayerMark';
import { EMBEDDED } from '../../embed';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'slayer_install_not_now';
const MONTH = 30 * 86_400_000;
const recentlyDeclined = (): boolean => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < MONTH;
  } catch {
    return false;
  }
};

const InstallPrompt = () => {
  const [offer, setOffer] = useState<InstallEvent | null>(null);
  useEffect(() => {
    if (EMBEDDED || recentlyDeclined()) return;
    const take = (e: Event) => {
      e.preventDefault();
      setOffer(e as InstallEvent);
    };
    const done = () => setOffer(null);
    window.addEventListener('beforeinstallprompt', take);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', take);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  if (!offer) return null;
  const notNow = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* private mode — for this visit */
    }
    setOffer(null);
  };
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-4 z-[85] w-[min(420px,calc(100vw-24px))] rounded-2xl border border-borderSubtle bg-panel/95 backdrop-blur-md shadow-2xl shadow-black/40 p-4 flex items-start gap-3 animate-fade-in" role="dialog" aria-label="Install Slayer" data-install-prompt>
      <SlayerMark size={44} label="" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-textPrimary">Slayer</p>
        <p className="mt-0.5 text-[13px] leading-snug text-textSecondary">Put the terminal on your home screen. It opens full screen.</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await offer.prompt();
              setOffer(null);
            }}
            className="h-8 px-4 rounded-full bg-textPrimary text-canvas text-[13px] font-medium"
            data-install-yes
          >
            Install
          </button>
          <button type="button" onClick={notNow} className="h-8 px-4 rounded-full border border-borderMuted text-[13px] text-textPrimary hover:bg-ink/[0.05]" data-install-no>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
