// Typed event bus between the Phaser scenes and the HTML/Preact overlay.

import type { Expression } from '../game/art/technician';
import type { ShopLayout } from '../game/scenes/ShopScene';
import type { CustomerMood } from './session';

export interface GameEvents {
  'scene:ready': { scene: string };
  'layout:shop': ShopLayout;
  'character:tap': { expression: Expression };
  /** A customer walks in to the counter (sprites `<id>-<mood>.png`). */
  'customer:enter': { id: string; mood: CustomerMood };
  'customer:mood': { mood: CustomerMood };
  'customer:leave': Record<string, never>;
  /** The scene finished the walk in / out. */
  'customer:arrived': { id: string };
  'customer:left': { id: string };
  'customer:tap': { id: string };
  /** The customer hops for joy (back from a fixed PC, or a good result). */
  'customer:cheer': Record<string, never>;
  /** The senior technician (พี่ช่าง) leaves his bench and walks to the intern's side, or goes back. */
  'senior:come': Record<string, never>;
  'senior:go': Record<string, never>;
  'senior:arrived': Record<string, never>;
  'senior:left': Record<string, never>;
  /** A line of a talk: the speaker shows this face and hops once. */
  'talk:line': { who: 'senior' | 'intern'; face: Expression };
  'ui:open-sim': Record<string, never>;
  'ui:close-sim': Record<string, never>;
  /** The shop laptop on the counter was tapped (Rufus, case 2). */
  'ui:open-laptop': Record<string, never>;
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;

const handlers = new Map<keyof GameEvents, Set<Handler<never>>>();
const lastPayload = new Map<keyof GameEvents, unknown>();

export const bus = {
  on<K extends keyof GameEvents>(event: K, fn: Handler<K>): () => void {
    let set = handlers.get(event);
    if (!set) handlers.set(event, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  },
  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    lastPayload.set(event, payload);
    handlers.get(event)?.forEach((fn) => (fn as Handler<K>)(payload));
  },
  /** The most recent payload of an event, for listeners that subscribe after it fired. */
  last<K extends keyof GameEvents>(event: K): GameEvents[K] | undefined {
    return lastPayload.get(event) as GameEvents[K] | undefined;
  },
};
