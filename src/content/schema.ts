// Shapes of every content file (cases, problems, BIOS brands, quizzes, cards, objectives).
// Content stays in JSON so teachers/designers can edit it without touching code;
// tools/validate-content.ts checks it against these schemas and against the game rules.

import { z } from 'zod';
import { WIN11_CHECK_IDS } from '../core/win11check';
import { EDITIONS } from '../core/setup';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase-kebab-case');
const loId = z.string().regex(/^LO\d+$/, 'objective ids look like LO1');
const th = z.string().min(1);
/** Where a topic comes from: the textbook, what Windows 11 adds to it, or beyond the book (advanced). */
export const SourceSchema = z.enum(['book', 'win11', 'extra']);

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
    usbScheme: z.enum(['mbr', 'gpt']),
    cpu: z.string(),
    cpuWin11: z.boolean(),
    ramGB: z.number().int().positive(),
    storageGB: z.number().int().positive(),
    diskStyle: z.enum(['mbr', 'gpt']),
    diskHasData: z.boolean(),
    productKey: z.boolean(),
    activateLater: z.boolean(),
    missingDrivers: z.array(z.string()),
  })
  .partial()
  .strict();

export const ObjectivesSchema = z.object({
  draft: z.boolean(),
  items: z.array(z.object({ id: loId, th })).min(1),
});

export const ProblemSchema = z
  .object({
    id,
    lo: z.array(loId).min(1),
    source: SourceSchema,
    /** Textbook page(s) that teach this. */
    bookPage: z.string().optional(),
    /** Blocker from src/core/requirements.ts that this problem must produce. */
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
  })
  .strict();
export const ProblemsSchema = z.array(ProblemSchema);

const range = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).refine(([a, b]) => a <= b, 'range must be [min, max]');

/** A multiple-choice question inside a case (guess the cause, or explain to the customer). */
const CaseQuestionSchema = z.object({
  /** For customer questions: what the customer asks. Omitted for the "guess the cause" step. */
  askTh: th.optional(),
  choicesTh: z.array(th).min(2).max(5),
  answer: z.number().int().nonnegative(),
  /** Shown after answering, right or wrong. */
  explainTh: th,
});
export type CaseQuestion = z.infer<typeof CaseQuestionSchema>;

/** Recurring customers (customers.json); sprites are `<id>-<expression>.png`. */
export const CustomersSchema = z.array(
  z.object({
    id,
    nameTh: th,
    roleTh: th,
    personalityTh: th,
  }),
);
export type Customer = z.infer<typeof CustomersSchema>[number];

/** What the customer says as the repair goes (case1-plan task F). Missing lines use generic ones (src/core/reactions.ts). */
const ReactionsSchema = z
  .object({
    /** The PC booted the old Windows again (a mistake); said in turn, one per time. */
    oldWindowsTh: z.array(th).min(1).optional(),
    /** The PC found nothing to boot ("Reboot and Select proper Boot device"). */
    noBootTh: th.optional(),
    /** The USB held the wrong image: the Windows 10 installer or Ubuntu came up (case 2). */
    wrongImageTh: th.optional(),
    /** Windows 11 Setup said "This PC can't run Windows 11" (booted in legacy/CSM mode, or TPM / Secure Boot off). */
    cantRunTh: th.optional(),
    /** The same refusal again with the same reasons: nothing was fixed (case 4). */
    stillCantRunTh: th.optional(),
    /** The USB booted: the problem is fixed. */
    fixedTh: th.optional(),
    /** Setup came up, but the job goes on to the install (cases whose goal is "install"). */
    reachedSetupTh: th.optional(),
    /** Answer to "are your files backed up?" (asked before wiping the disk in Setup). */
    backupTh: th.optional(),
    /** The disk was wiped before the technician asked about a backup (a mistake). */
    noBackupTh: th.optional(),
    /** The install USB's own partition was deleted in Setup (a mistake). */
    lostInstallerTh: th.optional(),
    /** Windows is installed, but the job goes on to first-time setup (cases whose goal is "desktop"). */
    installedTh: th.optional(),
    /** The technician handed the PC over to sign in to the customer's own account (first-time setup). */
    handedOverTh: th.optional(),
    /** The technician typed the customer's account for them or asked for the password (a mistake). */
    accountTrapTh: th.optional(),
    /** Asked which privacy settings they want: the customer's answer. */
    privacyAskedTh: th.optional(),
    /** The desktop came up without a Thai keyboard layout. */
    noThaiKeyboardTh: th.optional(),
    /** Goodbye on the summary, by stars: [1 star, 2 stars, 3 stars]. */
    goodbyeTh: z.tuple([th, th, th]).optional(),
  })
  .strict();
export type Reactions = z.infer<typeof ReactionsSchema>;

/** Teaching aids for a practice case: while present, the POST screen also gets a Thai subtitle and its
 *  setup/boot-menu keys light up on the key bar. */
const CoachSchema = z
  .object({
    /** The senior technician's tip in the panel, until the player first opens the customer's PC. */
    beforePcTh: th,
    /** A free nudge after the first mistake (unlike a hint it costs nothing). */
    firstMistakeTh: th,
  })
  .strict();

/** The Windows 11 requirements table on the work ticket (win11-check.json, case4-plan section 3). */
export const Win11CheckSchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            id: z.enum(WIN11_CHECK_IDS),
            /** What Windows 11 needs, in Thai. */
            requirementTh: th,
            /** How to tell from the ticket, or why only the BIOS can tell. */
            explainTh: th,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type Win11Check = z.infer<typeof Win11CheckSchema>;

export const CaseSchema = z
  .object({
    id,
    order: z.number().int().positive(),
    difficulty: z.number().int().min(1).max(5),
    titleTh: th,
    lo: z.array(loId).min(1),
    customer: z
      .object({
        /** Id in customers.json. */
        id,
        lineTh: th,
        /** The customer wants their files kept: destructive repairs lose points. */
        keepData: z.boolean(),
        /** The customer said when they came in that the old files are not needed (case 5): no backup question,
         *  and deleting the old partitions is not a mistake. */
        filesNotNeeded: z.boolean().default(false),
        reactionsTh: ReactionsSchema.default({}),
      })
      .strict(),
    /** Step 2 of a case: the player guesses the cause before touching anything. */
    diagnosis: CaseQuestionSchema,
    /** Step 4: the customer asks "why?" and the player picks the right explanation. */
    customerQuestions: z.array(CaseQuestionSchema).min(1),
    coach: CoachSchema.optional(),
    /** When the repair is done: the USB reaches Setup's first page (cases 1–2), Windows is installed (cases 3–4:
     *  the problem shows on a later Setup page), or first-time setup reaches the desktop (case 5). */
    goal: z.enum(['setup', 'install', 'desktop']).default('setup'),
    /** The PC's name on the ticket, typed on first-time setup's "Let's name your device" (goal "desktop"). */
    deviceName: z.string().optional(),
    /** What the panel asks for during the repair, when the generic "make it boot from the USB" does not fit. */
    repairTh: th.optional(),
    /** A photo the customer brings of the error (stage "guess the cause"): the screen text of one of its fixed problems. */
    diagnosisPhoto: z.object({ problem: id, captionTh: th }).strict().optional(),
    /** Notes for whoever builds/plays the case (traps, what to watch); not shown to students. */
    designNotesTh: z.array(th).default([]),
    brands: z.array(id).min(1),
    machine: z
      .object({
        ramGB: z.array(z.number().int().positive()).min(1),
        storageGB: z.array(z.number().int().positive()).min(1),
        cpu: z.array(z.string()).min(1),
        /** The disk still holds the old Windows (needed for mbr2gpt). Separate from keepData:
         *  a customer may have an old install yet have backed their files up. */
        diskHasData: z.boolean().default(true),
        /** The Windows edition on the ticket (what Setup must be told without a key). Default Windows 11 Home. */
        windowsEdition: z.enum(EDITIONS).optional(),
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
  })
  .strict();
export type Case = z.infer<typeof CaseSchema>;

const BiosItemSchema = z.object({
  label: z.string().min(1),
  setting: BiosSetting,
  /** Only visible after switching to Advanced Mode (ASUS-style). */
  advancedOnly: z.boolean().default(false),
  helpTh: th.optional(),
});

/**
 * One line of a BIOS menu screen (src/core/pc.ts runs it). Text stays English like the real screen.
 * info: read-only line · submenu: Enter opens `menu` · option: a setting with fixed choices ·
 * bootDevice / drive: a slot in Boot Device Priority / Hard Disk Drives (AMIBIOS 8, textbook p.49–51) ·
 * exit: opens the save or discard dialog.
 */
const MenuRowSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('info'), label: z.string().min(1), value: z.string().default(''), help: z.string().optional() }),
  z.object({ type: z.literal('submenu'), label: z.string().min(1), menu: id, help: z.string().optional() }),
  z.object({
    type: z.literal('option'),
    label: z.string().min(1),
    setting: BiosSetting,
    choices: z.array(z.object({ label: z.string().min(1), value: z.union([z.string(), z.boolean()]) })).min(2),
    help: z.string().optional(),
  }),
  z.object({ type: z.literal('bootDevice'), label: z.string().min(1), slot: z.number().int().nonnegative(), help: z.string().optional() }),
  z.object({ type: z.literal('drive'), label: z.string().min(1), slot: z.number().int().nonnegative(), help: z.string().optional() }),
  z.object({ type: z.literal('exit'), label: z.string().min(1), action: z.enum(['save', 'discard']), help: z.string().optional() }),
]);
export type MenuRow = z.infer<typeof MenuRowSchema>;

/** The playable BIOS screen of a brand: tabs, menus (flat, linked by id), and the real on-screen wording. */
const BiosMenuSchema = z.object({
  title: z.string().min(1),
  tabs: z.array(z.object({ label: z.string().min(1), menu: id })).min(1),
  menus: z.record(id, z.object({ title: z.string().min(1), rows: z.array(MenuRowSchema).min(1) })),
  /** Key help shown at the bottom right, one entry per line. */
  legend: z.array(z.string().min(1)).min(1),
  saveDialog: z.string().min(1),
  discardDialog: z.string().min(1),
});
export type BiosMenu = z.infer<typeof BiosMenuSchema>;

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
  pages: z.array(z.object({ id, label: z.string().min(1), items: z.array(BiosItemSchema) })).min(1),
  /** The playable screen; brands without it can be listed but not played yet. */
  menu: BiosMenuSchema.optional(),
  notesTh: z.array(th).default([]),
});
export type Brand = z.infer<typeof BrandSchema>;

/** The course test (docs/quiz-plan.md): the 10 items of the content analysis document, taken before and after
 *  learning in a shuffled order. `objective` is one of the four course objectives (4 is measured by the cases). */
export const CourseTestSchema = z.object({
  draft: z.boolean(),
  /** Where the items come from, for people checking the content. */
  source: z.string().optional(),
  items: z
    .array(
      z.object({
        id,
        objective: z.number().int().min(1).max(4),
        stemTh: th,
        choicesTh: z.array(th).min(2).max(5),
        answer: z.number().int().nonnegative(),
        explainTh: th,
      }),
    )
    .min(1),
});
export type CourseTest = z.infer<typeof CourseTestSchema>;

/** The reflection after learning (docs/reflect-plan.md): how well the learner thinks they can do each of the four
 *  objectives (1-5 stars), three short written answers, and a satisfaction form of five-level items in groups. */
export const ReflectSchema = z
  .object({
    draft: z.boolean(),
    source: z.string().optional(),
    /** What the senior says at the top of the page. */
    introTh: th.max(120),
    /** Said once it is sent. */
    thanksTh: th.max(100),
    self: z.array(z.object({ id, objective: z.number().int().min(1).max(4), th: th.max(100) }).strict()).min(1),
    /** What 1 to 5 stars mean, from one star up. */
    starsTh: z.array(th.max(40)).length(5),
    write: z.array(z.object({ id, th: th.max(80), hintTh: th.max(80) }).strict()).min(1),
    groups: z.array(z.object({ id, th: th.max(60) }).strict()).min(1),
    satisfaction: z.array(z.object({ id, group: id, th: th.max(100) }).strict()).min(1),
    suggestTh: th.max(80),
  })
  .strict();
export type Reflect = z.infer<typeof ReflectSchema>;

/** The start page before the name form (docs/start-page-plan.md): ChatGPT's wording, each text kept to the length
 *  the page has room for. {class} and {typed} are filled in by the page. */
const withSlot = (max: number, ...slots: string[]) =>
  th.max(max).refine((s) => slots.every((k) => s.includes(`{${k}}`)), { message: `needs ${slots.map((k) => `{${k}}`).join(' and ')}` });
export const StartSchema = z
  .object({
    source: z.string().optional(),
    tagline: th.max(40),
    greeting: th.max(90),
    goalsTitle: th.max(25),
    /** The four objectives in the learners' words, in order. */
    goals: z.array(th.max(45)).length(4),
    stepsTitle: th.max(25),
    /** The seven steps of the path (the results page is not one), in order. */
    steps: z.array(th.max(22)).length(7),
    time: th.max(50),
    howTo: z.array(th.max(40)).length(3),
    classBadge: withSlot(40, 'class'),
    notMyClass: th.max(18),
    notMyClassDone: th.max(70),
    roomMismatch: withSlot(80, 'typed', 'class'),
    start: th.max(12),
    aboutLink: th.max(15),
    teacherLink: th.max(15),
    soundOn: th.max(12),
    soundOff: th.max(12),
  })
  .strict();
export type Start = z.infer<typeof StartSchema>;

/** The step-ordering game (docs/order-plan.md): rounds of steps to put in order (the colour-hint part), the
 *  boss belt's full sequence (one overview step opened up into another round), and traps that should never be
 *  done. Each step has a hint (said when it is the first one still wrong) and a reason (said in the answer). */
const OrderStepSchema = z.object({ id, th: z.string().min(1).max(60), hintTh: th, whyTh: th }).strict();
export const OrderSchema = z
  .object({
    draft: z.boolean(),
    source: z.string().optional(),
    rounds: z.array(z.object({ id, titleTh: th, steps: z.array(OrderStepSchema).min(4).max(10) }).strict()).min(1),
    /** The belt plays the first round with step `expand` replaced by the steps of round `into`. */
    boss: z.object({ expand: id, into: id }).strict(),
    traps: z.array(z.object({ id, th: z.string().min(1).max(60), whyTh: th }).strict()),
  })
  .strict();
export type Order = z.infer<typeof OrderSchema>;
export type OrderStep = z.infer<typeof OrderStepSchema>;

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

/** Faces each speaker has (sprites `senior-<face>.png`, `tech-<face>.png`). */
export const CUTSCENE_FACES = { senior: ['neutral', 'happy', 'thinking'], intern: ['neutral', 'happy', 'thinking', 'surprised'] } as const;

/** Talks between the senior technician and the intern (docs/learning-page-plan.md): `intro` the first time in
 *  the shop, and one per case id before its customer walks in. */
export const CutscenesSchema = z.object({
  draft: z.boolean(),
  scenes: z
    .array(
      z.object({
        id,
        lines: z
          .array(
            z.object({
              who: z.enum(['senior', 'intern']),
              face: z.enum(CUTSCENE_FACES.intern).default('neutral'),
              /** About two lines on a phone. */
              th: th.max(120),
            }),
          )
          .min(1)
          .max(12),
      }),
    )
    .min(1),
});
export type Cutscenes = z.infer<typeof CutscenesSchema>;

/** The lesson cartoons (docs/lessons-plan.md): the senior's poses (sprites `teach-<pose>.png`, docs/art-prompts.md
 *  6.1) and the sets the camera shows. */
export const LESSON_POSES = ['stand', 'point-left', 'point-right', 'explain', 'thumbs', 'chin'] as const;
export const LESSON_SETS = ['desk', 'screen', 'printer', 'board', 'servers'] as const;
/** What the screen in the lesson video shows during a line (src/studio/demos.tsx). */
export const LESSON_DEMOS = [
  'welcome',
  'os-core',
  'layers',
  'boot',
  'app',
  'os-vs-app',
  'cpu',
  'memory',
  'driver',
  'files',
  'login',
  'print',
  'no-boot',
  'functions',
  // Clip 2: the kinds of operating system.
  'types-intro',
  'three-types',
  'pc',
  'pc-os',
  'mobile',
  'server',
  'server-os',
  'linux-both',
  'license',
  'two-ways',
  'look-alike',
] as const;
/** Something the senior says: `say` is read by the voice (English words spelt as Thai say them), `th` is shown
 *  under it when the lesson's subtitles cannot make it from `say`. */
const spoken = { say: th.max(160), th: th.max(160).optional() };
export const LessonsSchema = z
  .object({
    draft: z.boolean(),
    source: z.string().optional(),
    /** Words the voice says in Thai letters, written as on screen in the subtitles (วินโดวส์ -> Windows). */
    subtitles: z.record(th, th),
    lessons: z
      .array(
        z
          .object({
            id,
            titleTh: th,
            objective: z.number().int().min(1).max(4),
            lines: z
              .array(
                z
                  .object({
                    ...spoken,
                    /** The words written on screen with the line (ChatGPT's "ข้อความบนจอ"). */
                    board: z.string().max(200),
                    /** What happens on screen, as the script says it (for whoever stages it). */
                    cue: z.string(),
                    set: z.enum(LESSON_SETS),
                    pose: z.enum(LESSON_POSES),
                    face: z.enum(CUTSCENE_FACES.senior),
                    intern: z.enum(CUTSCENE_FACES.intern),
                    /** The demonstration on the video's screen; lines in a row with the same one share it. */
                    demo: z.enum(LESSON_DEMOS).optional(),
                  })
                  .strict(),
              )
              .min(1),
            /** Each asked once line `after` (1-based) has been said; a wrong answer can go back to line `replay`. */
            questions: z.array(
              z
                .object({
                  after: z.number().int().min(1),
                  replay: z.number().int().min(1),
                  stemTh: th,
                  choicesTh: z.array(th).min(2).max(4),
                  answer: z.number().int().nonnegative(),
                  right: z.object(spoken).strict(),
                  wrong: z.object(spoken).strict(),
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type Lessons = z.infer<typeof LessonsSchema>;
export type Lesson = Lessons['lessons'][number];
