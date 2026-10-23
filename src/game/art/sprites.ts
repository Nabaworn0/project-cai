// Pixelized sprites (npm run pixelize -> src/assets/sprites/*.png), bundled at build time.
// A scene uses a real sprite when it exists and falls back to the code-drawn placeholder otherwise,
// so dropping new art in is enough to see it in the game.

const files = import.meta.glob<string>('../../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' });

const byName = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!.replace(/\.png$/, ''), url]));

export function spriteUrl(name: string): string | undefined {
  return byName.get(name);
}

/** URLs for a whole set (e.g. every expression), or null unless all of them exist: a mixed set would jump. */
export function spriteSet(names: readonly string[]): Map<string, string> | null {
  const urls = names.map((n) => [n, spriteUrl(n)] as const);
  if (urls.some(([, u]) => !u)) {
    const have = urls.filter(([, u]) => u).map(([n]) => n);
    if (have.length) console.warn(`Sprite set incomplete (have ${have.join(', ')}); using placeholders until all ${names.length} exist.`);
    return null;
  }
  return new Map(urls as [string, string][]);
}
