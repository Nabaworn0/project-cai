import type { Objectives } from '../content/schema';

/** Objective ids as small tags; the full objective text shows on hover/long-press. */
export function LoTags({ ids, objectives }: { ids: readonly string[]; objectives: Objectives }) {
  return (
    <span class="v-tags">
      {ids.map((id) => (
        <span key={id} class="v-tag" title={objectives.items.find((o) => o.id === id)?.th ?? 'ไม่รู้จัก'}>
          {id}
        </span>
      ))}
    </span>
  );
}
