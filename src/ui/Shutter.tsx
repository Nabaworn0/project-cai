// The shop's rolling shutter between pages (docs/pages-plan.md task B): it rolls down over the page, the page
// changes behind it, and it rolls up on the new one. The plate says where the learner is going, with a turning
// pixel gear. With less motion asked for, it fades instead. App.tsx runs the phases; this only draws them.

import type { Route } from '../core/routes';
import { ROUTE_TH } from '../core/routes';
import './shutter.css';

export type ShutterPhase = 'idle' | 'down' | 'closed' | 'up';

/** How long rolling down and up take (ms); a fade is quicker. */
export const SHUTTER_MS = { roll: { down: 300, up: 350 }, fade: { down: 150, up: 150 } } as const;

/** A 12×12 gear drawn in art pixels. */
const GEAR = [
  '....##.##...',
  '...######...',
  '.##########.',
  '.###....###.',
  '###......###',
  '.##......##.',
  '.##......##.',
  '###......###',
  '.###....###.',
  '.##########.',
  '...######...',
  '....##.##...',
];

export function Shutter({ phase, to, fade }: { phase: ShutterPhase; to: Route; fade: boolean }) {
  if (phase === 'idle') return null;
  return (
    <div class={`shutter ${phase}${fade ? ' fade' : ''}`} data-testid="shutter" aria-live="polite">
      <div class="shutter-plate">
        <svg class="shutter-gear" viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges">
          {GEAR.flatMap((row, y) => [...row].map((c, x) => (c === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
        </svg>
        <span>กำลังไปที่ {ROUTE_TH[to]}…</span>
      </div>
    </div>
  );
}
