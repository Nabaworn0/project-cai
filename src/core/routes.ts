// The game's pages and their addresses (docs/pages-plan.md, approved 29 Oct 2026): #/learn, #/pre, #/post,
// #/order, #/shop. An address can be typed, shared, reloaded or reached with Back, so whether its page may open is
// decided here from the learning path, the same way the menu's cards are.

import type { PathView } from './path';

export const ROUTES = ['learn', 'pre', 'post', 'order', 'shop'] as const;
export type Route = (typeof ROUTES)[number];

/** Page names, for "กำลังไปที่ …" while the shutter is down. */
export const ROUTE_TH: Record<Route, string> = {
  learn: 'เส้นทางเรียน',
  pre: 'แบบทดสอบก่อนเรียน',
  post: 'แบบทดสอบหลังเรียน',
  order: 'เรียงขั้นตอนการติดตั้ง',
  shop: 'ร้านซ่อมคอม',
};

export const routeHash = (r: Route) => `#/${r}`;

/** The page an address names; anything else is the learning page. */
export function parseRoute(hash: string): Route {
  const m = /^#\/([a-z]+)$/.exec(hash);
  return (ROUTES as readonly string[]).includes(m?.[1] ?? '') ? (m![1] as Route) : 'learn';
}

/** The page an address may open now: itself if its card could be tapped on the learning page (the shop: the cases
 *  card), else the learning page. Nothing opens before the learner has given a name. */
export function allowedRoute(r: Route, hasLearner: boolean, view: PathView): Route {
  if (r === 'learn' || !hasLearner) return 'learn';
  const step = view.steps.find((s) => s.id === (r === 'shop' ? 'cases' : r));
  return step?.canEnter ? r : 'learn';
}
