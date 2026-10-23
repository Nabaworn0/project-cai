// Game-side content loader: every JSON file under ./data is bundled at build time.

import { BrandSchema, CaseSchema, ObjectivesSchema, ProblemsSchema, type Brand, type Case, type Objectives, type Problem } from './schema';
import type { ContentFile } from './validate';

const raw = import.meta.glob<unknown>('./data/**/*.json', { eager: true, import: 'default' });
/** Every bundled content file, in the shape the validator takes (paths relative to data/). */
export function contentFiles(): ContentFile[] {
  return Object.entries(raw).map(([path, data]) => ({ path: path.replace('./data/', ''), data }));
}

const pick = (prefix: string) => Object.entries(raw).filter(([p]) => p.startsWith(`./data/${prefix}`)).map(([, d]) => d);

export interface Content {
  objectives: Objectives;
  problems: Problem[];
  brands: Brand[];
  cases: Case[];
}

/** Parses (and so applies schema defaults to) the bundled content. Bad content fails loudly at startup. */
export function loadContent(): Content {
  return {
    objectives: ObjectivesSchema.parse(raw['./data/objectives.json']),
    problems: ProblemsSchema.parse(raw['./data/problems.json']),
    brands: pick('brands/').map((d) => BrandSchema.parse(d)),
    cases: pick('cases/').map((d) => CaseSchema.parse(d)).sort((a, b) => a.order - b.order),
  };
}
