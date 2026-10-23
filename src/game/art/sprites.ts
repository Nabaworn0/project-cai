// Pixelized sprites (npm run pixelize -> src/assets/sprites/*.png), bundled at build time.
// A scene uses a real sprite when it exists and falls back to the code-drawn placeholder otherwise,
// so dropping new art in is enough to see it in the game.

const files = import.meta.glob<string>('../../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });

const byName = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

export function spriteUrl(name: string): string | undefined {
  return byName.get(name);
}

/**
 * URLs for a set of frames (e.g. every expression). Frames that do not exist yet reuse `fallback`
 * (e.g. the neutral face), so the character never switches to a differently drawn placeholder.
 * Returns null when not even the fallback exists.
 */
export function spriteSet(names: readonly string[], fallback: string): Map<string, string> | null {
  const base = spriteUrl(fallback);
  if (!base) return null;
  const missing = names.filter((n) => !spriteUrl(n));
  if (missing.length) console.info(`Sprites not drawn yet, showing ${fallback} instead: ${missing.join(', ')}`);
  return new Map(names.map((n) => [n, spriteUrl(n) ?? base]));
}
