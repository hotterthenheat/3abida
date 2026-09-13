/*
==================================================
  SLAYER TERMINAL - A SETUP'S PAGE (pages/compass/SetupPage.tsx)

  /compass/<id> — the setup the board's card opens
  (the walk, 2026-09-11). The id is the setup's
  address (name · strike · side · kind · tenor), so
  the Tracker's door, the Weigher's, the tape's
  drilldown and the browser's Back all land here
  by URL; the trail Noah ruled on 2026-08-19 ("from
  a driver contract, Back is the previous contract,
  not the board — and the board gets its own door
  beside it") rides in the navigation state: a
  driver row opens the next contract with `from`
  = the one it came from.

  The setup is rebuilt live every tick from its
  address (the engine's makeSetup — untouched); the
  page's own history walks in behind the skeleton
  when the name is new to the session.
==================================================
*/

import { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import Simulator from '../../core/simulator';
import { useMarketData } from '../../context/MarketDataContext';
import { useSeeded } from '../../components/gex/useSeeded';
import { makeSetup, parseSetupId, setupIdOf } from '../../data/compass';
import { setCompassView } from '../../data/compassView';
import type { OptionRight, SleeveKey } from '../../types/compass';
import CampaignAnalysis from '../../components/compass/CampaignAnalysis';
import { CampaignSkeleton } from '../compassSkeleton';

const SetupPage = () => {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeTicker, marketData, changeTicker } = useMarketData();
  const from = (location.state as { from?: string } | null)?.from ?? null;
  const address = useMemo(() => parseSetupId(id), [id]);

  /* The desk REPOINTS to the contract's underlying — a QQQ setup over an SPY
     chain was the monitor pricing the wrong market (Noah's screenshot, 2026-08) */
  useEffect(() => {
    if (address && address.ticker !== activeTicker) changeTicker(address.ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address?.ticker]);
  /* Being on a contract's page IS having chosen it — the sidebar's "Inside the
     contract" row points here from now on (Noah, 2026-09-12), whichever door
     the reader came through (the board, the Tracker, the Weigher, a link). */
  useEffect(() => {
    if (address) setCompassView({ chosenId: id, selectedId: id });
  }, [id, address]);

  /* The page greets the reader at its top (Noah, 2026-08-09: opening a setup
     from a scrolled board dropped him mid-chart) — every page does since
     2026-09-11: the Compass shell's ScrollHome lands each route at its head. */

  // Bumps every simulator tick — drives incremental candle updates on the chart
  const revRef = useRef(0);
  const revision = useMemo(() => ++revRef.current, [marketData]);
  /* Found at: the moment this page opened — the numbers that earned the click
     are frozen inside CampaignAnalysis from this bar on */
  const gradedAt = useMemo(() => new Date().toLocaleTimeString('en-GB'), [id]);

  const seeded = useSeeded(address?.ticker ?? null);
  const setup = useMemo(() => {
    if (!address) return null;
    Simulator.register(address.ticker);
    const cfg = Simulator.TICKERS[address.ticker];
    if (!cfg) return null;
    return makeSetup(address.ticker, cfg.currentPrice, address.strike, address.right, address.scanner, cfg.iv, address.sleeve, address.dte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, marketData]);
  const spot = address ? (Simulator.TICKERS[address.ticker]?.currentPrice ?? 0) : 0;

  const back = (
    <div className="flex items-center gap-4" data-setup-back>
      <button
        type="button"
        onClick={() => (from ? navigate(-1) : navigate('/compass'))}
        className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" /> {from ?? 'The board'}
      </button>
      {from && (
        <Link to="/compass" className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-textSecondary hover:text-textPrimary transition-colors">
          <LayoutGrid className="w-3.5 h-3.5" /> The board
        </Link>
      )}
    </div>
  );

  if (!address) {
    return (
      <>
        {back}
        <div className="border border-borderSubtle rounded-md bg-panel h-40 flex flex-col items-center justify-center gap-2" data-setup-missing>
          <span className="font-mono text-[13px] font-bold text-textPrimary">{id}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-textMuted">no setup at this address</span>
        </div>
      </>
    );
  }

  if (!seeded || !setup) {
    return (
      <>
        {back}
        <CampaignSkeleton />
      </>
    );
  }

  /* A driver row or the capsule's pick opens the next contract on the same
     name — its own page, with this one named as the way back. A pick can
     carry ITS OWN tenor (the capsule spans tenors): the page follows. */
  const openContract = (strike: number, right: OptionRight, pickSleeve?: SleeveKey, pickDte?: number) => {
    const next = setupIdOf({ ticker: address.ticker, strike, right, scanner: address.scanner, sleeve: pickSleeve ?? address.sleeve, dte: pickDte ?? address.dte });
    if (next === id) return;
    navigate(`/compass/${next}`, { state: { from: setup.contract } });
  };

  return (
    <>
      {back}
      <div key={id} className="animate-soft-in-slow" data-setup-page={id}>
        <CampaignAnalysis setup={setup} revision={revision} spot={spot} scanner={address.scanner} sleeve={address.sleeve} dte={address.dte} gradedAt={gradedAt} onOpenContract={openContract} />
      </div>
    </>
  );
};

export default SetupPage;
