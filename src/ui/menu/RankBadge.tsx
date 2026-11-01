// A rank's badge (docs/phase3-prompts.md part 3): ChatGPT's pixel picture, src/assets/ranks/<id>.png, or else the
// rank's icon. Beside the rank's name wherever it shows, so the picture itself says nothing to a screen reader.

import type { Rank } from '../../core/rank';

const pictures = import.meta.glob<string>('../../assets/ranks/*.png', { eager: true, query: '?url', import: 'default' });

export function RankBadge({ rank, big = false }: { rank: Pick<Rank, 'id' | 'icon'>; big?: boolean }) {
  const src = pictures[`../../assets/ranks/${rank.id}.png`];
  const cls = `rank-badge${big ? ' big' : ''}`;
  return src ? (
    <img class={cls} src={src} alt="" data-rank={rank.id} />
  ) : (
    <span class={cls} aria-hidden="true" data-rank={rank.id}>
      {rank.icon}
    </span>
  );
}
