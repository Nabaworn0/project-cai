import type { Source } from '../core/actions';

/** Where a topic comes from: the textbook (with page), added for Windows 11, or beyond the book. */
export function SourceBadge({ source, page }: { source: Source; page?: string }) {
  if (source === 'book') return <span class="v-badge ok">หนังสือ{page ? ` น.${page}` : ''}</span>;
  if (source === 'win11') return <span class="v-badge">เพิ่มสำหรับ Win 11</span>;
  return <span class="v-badge warn">นอกหนังสือ (ขั้นสูง)</span>;
}
