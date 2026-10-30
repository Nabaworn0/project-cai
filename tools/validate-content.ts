// npm run validate — checks every file in src/content/data. Exits 1 on any error.
// Warnings (drafts, unverified BIOS screens) are printed but do not fail the run.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent, type ContentFile } from '../src/content/validate';

const root = fileURLToPath(new URL('../src/content/data', import.meta.url));
const voiceDir = fileURLToPath(new URL('../src/assets/voice', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : name.endsWith('.json') ? [full] : [];
  });
}

const files: ContentFile[] = [];
const parseErrors: string[] = [];
for (const full of walk(root)) {
  const path = relative(root, full).split(sep).join('/');
  try {
    files.push({ path, data: JSON.parse(readFileSync(full, 'utf8')) });
  } catch (e) {
    parseErrors.push(`${path}: invalid JSON (${(e as Error).message})`);
  }
}

const seeds = Number(process.env.SEEDS ?? 200);
const voice = existsSync(voiceDir)
  ? {
      index: existsSync(join(voiceDir, 'index.json')) ? JSON.parse(readFileSync(join(voiceDir, 'index.json'), 'utf8')) : null,
      files: readdirSync(voiceDir).filter((f) => f.endsWith('.mp3')),
    }
  : { index: null, files: [] };
const report = validateContent(files, { seedsPerCase: seeds, voice });
const errors = [...parseErrors, ...report.errors];

for (const w of report.warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
const s = report.stats;
console.log(
  `\n${errors.length ? 'FAILED' : 'OK'}: ${s.cases} cases (${s.machinesChecked} machines), ${s.problems} problems, ` +
    `${s.brands} brands, ${s.testItems} test items, ${s.orderSteps} order steps, ${s.lessonLines} lesson lines, ${s.cards} cards — ${errors.length} errors, ${report.warnings.length} warnings`,
);
process.exit(errors.length ? 1 : 0);
