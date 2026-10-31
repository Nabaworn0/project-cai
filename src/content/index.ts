// Game-side content loader: every JSON file under ./data is bundled at build time.

import {
  BrandSchema,
  CaseSchema,
  CourseTestSchema,
  ReflectSchema,
  OrderSchema,
  LessonsSchema,
  CustomersSchema,
  CutscenesSchema,
  ObjectivesSchema,
  ProblemsSchema,
  Win11CheckSchema,
  type Brand,
  type Case,
  type CourseTest,
  type Reflect,
  type Order,
  type Lessons,
  type Customer,
  type Cutscenes,
  type Objectives,
  type Problem,
  type Win11Check,
} from './schema';
import type { ContentFile } from './validate';

const raw = import.meta.glob<unknown>('./data/**/*.json', { eager: true, import: 'default' });
/** Every bundled content file, in the shape the validator takes (paths relative to data/). */
export function contentFiles(): ContentFile[] {
  return Object.entries(raw).map(([path, data]) => ({ path: path.replace('./data/', ''), data }));
}

const pick = (prefix: string) =>
  Object.entries(raw)
    .filter(([p]) => p.startsWith(`./data/${prefix}`))
    .map(([, d]) => d);

export interface Content {
  objectives: Objectives;
  problems: Problem[];
  brands: Brand[];
  cases: Case[];
  customers: Customer[];
  win11Check: Win11Check;
  cutscenes: Cutscenes;
  /** The course test taken before and after learning (docs/quiz-plan.md). */
  test: CourseTest;
  /** The step-ordering game (docs/order-plan.md). */
  order: Order;
  /** The lesson cartoons (docs/lessons-plan.md). */
  lessons: Lessons;
  /** The reflection and satisfaction form after learning (docs/reflect-plan.md). */
  reflect: Reflect;
}

/** Parses (and so applies schema defaults to) the bundled content. Bad content fails loudly at startup. */
export function loadContent(): Content {
  return {
    objectives: ObjectivesSchema.parse(raw['./data/objectives.json']),
    problems: ProblemsSchema.parse(raw['./data/problems.json']),
    brands: pick('brands/').map((d) => BrandSchema.parse(d)),
    cases: pick('cases/')
      .map((d) => CaseSchema.parse(d))
      .sort((a, b) => a.order - b.order),
    customers: CustomersSchema.parse(raw['./data/customers.json']),
    win11Check: Win11CheckSchema.parse(raw['./data/win11-check.json']),
    cutscenes: CutscenesSchema.parse(raw['./data/cutscenes.json']),
    test: CourseTestSchema.parse(raw['./data/test.json']),
    order: OrderSchema.parse(raw['./data/order.json']),
    lessons: LessonsSchema.parse(raw['./data/lessons.json']),
    reflect: ReflectSchema.parse(raw['./data/reflect.json']),
  };
}
