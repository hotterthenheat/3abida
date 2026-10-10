import type { ComponentProps } from 'react';
import ScopeChip from '../ui/ScopeChip';
import { useSpot } from '../../context/marketStore';

/** The scope chip with its own-name quote kept live (2026-10-10, the speed store): the chip prints the price it reads
    as it renders, and its hosts — Pulse's desk, Pinpoint's boxes — no longer render on every tick. A chip that follows
    the terminal prints no quote, and reads nothing. */
const LiveScopeChip = (props: ComponentProps<typeof ScopeChip>) => {
  useSpot(props.quote && (props.linked !== true || props.full) ? props.ticker : '');
  return <ScopeChip {...props} />;
};

export default LiveScopeChip;
