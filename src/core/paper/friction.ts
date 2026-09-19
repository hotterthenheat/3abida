/*
==================================================
  SLAYER TERMINAL - THE MARKET'S FRICTION
  (core/paper/friction.ts)

  ONE fill model, composed from the reader's
  choices, handed to the engine through its seam
  (setFillModel). Two things live in it:

    FREE REIN'S TOGGLES   bypass the spread (fill at
                          the mid), bypass slippage
                          (the whole size at one
                          price), zero fees. Each is
                          a deliberate LIE about the
                          market, which is why they
                          only exist in the sandbox
                          and the desk says so on
                          screen while they are on.
    THE QUEUE             realistic limit fills
                          (core/paper/queue.ts),
                          available in every mode.

  Standard mode installs no model at all, so the
  engine runs its own arithmetic untouched.
==================================================
*/

import { setFillModel, type FillModel } from './engine';
import { getModes } from './modes';
import { clearQueues, limitFillQty } from './queue';
import type { Instrument } from './instruments';
import type { Quote } from './market';
import type { Side } from './engine';

let installed = false;

/** Rebuild the model from the current modes — called whenever they change */
export function applyFriction(): void {
  const m = getModes();
  const free = m.mode === 'free' ? m.free : null;
  const queue = m.realisticFills;
  if (!free?.bypassSpread && !free?.bypassSlippage && !free?.zeroFees && !queue) {
    setFillModel(null);
    installed = false;
    clearQueues();
    return;
  }
  const model: FillModel = {};
  if (free?.bypassSpread) model.touch = (_side: Side, q: Quote, _inst: Instrument) => q.mark;
  if (free?.bypassSlippage) model.maxWalk = () => 0;
  if (free?.zeroFees) model.fee = () => 0;
  if (queue) model.limitFillQty = limitFillQty;
  if (!queue) clearQueues();
  setFillModel(model);
  installed = true;
}

export const frictionInstalled = (): boolean => installed;

/** What the desk prints while the market is not being told the truth */
export function frictionWords(): string[] {
  const m = getModes();
  const out: string[] = [];
  if (m.mode === 'free') {
    if (m.free.bypassSpread) out.push('filling at the mid');
    if (m.free.bypassSlippage) out.push('no slippage');
    if (m.free.zeroFees) out.push('no fees');
  }
  if (m.realisticFills) out.push('queued limit fills');
  return out;
}
