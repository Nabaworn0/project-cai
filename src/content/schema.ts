// Shapes of every content file (cases, problems, BIOS brands, quizzes, cards, objectives).
// Content stays in JSON so teachers/designers can edit it without touching code;
// tools/validate-content.ts checks it against these schemas and against the game rules.

import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase-kebab-case');
const loId = z.string().regex(/^LO\d+$/, 'objective ids look like LO1');
const th = z.string().min(1);

export const BIOS_SETTINGS = ['bootOrder', 'bootMode', 'secureBoot', 'supervisorPassword', 'tpm', 'sataMode'] as const;
export const BiosSetting = z.enum(BIOS_SETTINGS);
export type BiosSetting = z.infer<typeof BiosSetting>;

/** Field names and value types a problem may set or require on a Machine. */
export const MachinePatchSchema = z
  .object({
    bootMode: z.enum(['uefi', 'legacy']),
    secureBoot: z.boolean(),
    supervisorPassword: z.boolean(),
    tpm: z.enum(['none', '1.2', '2.0']),
    tpmEnabled: z.boolean(),
    sataMode: z.enum(['ahci', 'raid']),
    raidDriverLoaded: z.boolean(),
    usbFirst: z.boolean(),
    cpu: z.string(),
    cpuWin11: z.boolean(),
    ramGB: z.number().int().positive(),
    storageGB: z.number().int().positive(),
    diskStyle: z.enum(['mbr', 'gpt']),
    diskHasData: z.boolean(),
    missingDrivers: z.array(z.string()),
  })
  .partial()
  .strict();

export const ObjectivesSchema = z.object({
  draft: z.boolean(),
  items: z.array(z.object({ id: loId, th })).min(1),
});

export const ProblemSchema = z.object({
  id,
  lo: z.array(loId).min(1),
  /** Blocker from src/core/win11.ts that this problem must produce. */
  blocker: z.string(),
  /** Conditions on the machine for this problem to make sense. */
  requires: MachinePatchSchema.default({}),
  patch: MachinePatchSchema,
  /** Action ids (src/core/actions.ts) that each repair this problem on their own. */
  fixes: z.array(z.string()).min(1),
  /** What the customer tells the technician, in Thai. */
  symptomTh: th,
  /** The message exactly as the real screen shows it (English), when there is one. */
  screenText: z.string().min(1).optional(),
  explainTh: th,
  hintsTh: z.array(th).min(1).max(2),
});
export const ProblemsSchema = z.array(ProblemSchema);

const range = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).refine(([a, b]) => a <= b, 'range must be [min, max]');

export const CaseSchema = z.object({
  id,
  order: z.number().int().positive(),
  difficulty: z.number().int().min(1).max(5),
  titleTh: th,
  lo: z.array(loId).min(1),
  customer: z.object({
    nameTh: th,
    lineTh: th,
    /** The customer wants their files kept: destructive repairs lose points. */
    keepData: z.boolean(),
  }),
  brands: z.array(id).min(1),
  machine: z
    .object({
      ramGB: z.array(z.number().int().positive()).min(1),
      storageGB: z.array(z.number().int().positive()).min(1),
      cpu: z.array(z.string()).min(1),
      /** The disk still holds the old Windows (needed for mbr2gpt). Separate from keepData:
       *  a customer may have an old install yet have backed their files up. */
      diskHasData: z.boolean().default(true),
    })
    .strict(),
  problems: z.object({
    fixed: z.array(id).default([]),
    pool: z.array(id).default([]),
    /** How many extra problems to draw from `pool`. */
    extra: range.default([0, 0]),
  }),
  minigames: z.array(id).default([]),
  timeLimitSec: z.number().int().positive().default(300),
});
export type Case = z.infer<typeof CaseSchema>;

const BiosItemSchema = z.object({
  label: z.string().min(1),
  setting: BiosSetting,
  /** Only visible after switching to Advanced Mode (ASUS-style). */
  advancedOnly: z.boolean().default(false),
  helpTh: th.optional(),
});

export const BrandSchema = z.object({
  id,
  name: z.string().min(1),
  /** Compared against photos of real lab machines? Unverified brands show a warning. */
  verified: z.boolean(),
  phase: z.enum(['mvp', 'next']),
  style: z.enum(['graphical', 'classic-blue', 'startup-menu']),
  keys: z.object({
    setup: z.array(z.string()).min(1),
    bootMenu: z.array(z.string()).min(1),
    /** HP-style: a menu key first, then a second key picks setup or boot menu. */
    startupMenu: z.string().optional(),
  }),
  quirks: z.object({
    secureBootNeedsSupervisorPassword: z.boolean().default(false),
    bootMenuMustBeEnabled: z.boolean().default(false),
    hasAdvancedMode: z.boolean().default(false),
  }),
  pages: z
    .array(z.object({ id, label: z.string().min(1), items: z.array(BiosItemSchema) }))
    .min(1),
  notesTh: z.array(th).default([]),
});
export type Brand = z.infer<typeof BrandSchema>;

export const QuizSchema = z.object({
  id,
  kind: z.enum(['pre', 'mid', 'post']),
  form: z.enum(['A', 'B']),
  draft: z.boolean(),
  items: z
    .array(
      z.object({
        id,
        /** Items with the same pair id in form A and form B are parallel versions. */
        pair: id,
        lo: loId,
        stemTh: th,
        choicesTh: z.array(th).min(2).max(5),
        answer: z.number().int().nonnegative(),
        explainTh: th,
      }),
    )
    .min(1),
});
export type Quiz = z.infer<typeof QuizSchema>;

export const CardsSchema = z.object({
  draft: z.boolean(),
  sets: z.array(z.object({ id, nameTh: th })).min(1),
  cards: z.array(
    z.object({
      id,
      set: id,
      nameTh: th,
      rarity: z.enum(['common', 'rare', 'epic']),
      /** Opening a mystery box after fixing one of these problems can drop this card. */
      linkedProblems: z.array(id).min(1),
      textTh: th,
    }),
  ),
});

export type Problem = z.infer<typeof ProblemSchema>;
export type Objectives = z.infer<typeof ObjectivesSchema>;
export type Cards = z.infer<typeof CardsSchema>;
