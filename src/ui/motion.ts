// The device asks for less motion (an accessibility setting): the belt starts slow, the shutter fades instead of
// rolling. Read once; never throws where matchMedia is missing.

export function prefersLessMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
