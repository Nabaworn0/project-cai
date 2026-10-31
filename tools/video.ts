// npm run video -- lesson-os [--from 0 --to 20] [--still 1.5,12,40] [--out public/videos]
//
// Films a lesson video (docs/lessons-plan.md "ส่วนต่อ 2"): the studio page (src/studio, ?view=studio) is opened at
// 1280 x 720 in a browser nobody sees, set to each frame's moment in turn and photographed; ffmpeg (ffmpeg-static)
// joins the pictures at 30 a second with the voice, every recording placed where the running order says, into an mp4.
//   --from/--to: only that part (seconds), for a quick look · --still: those moments (seconds) as pngs

import { chromium } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const from = Number(flag('--from') ?? 0) * 1000;
const toArg = flag('--to');
const still = flag('--still');
const out = flag('--out') ?? 'public/videos';
const lesson = args[0] ?? 'lesson-os';

// No reloading while filming: a file saved meanwhile must not change the frames still to come.
const server = await createServer({ logLevel: 'error', server: { port: 5199, strictPort: false, hmr: false, watch: null } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(`${server.resolvedUrls!.local[0]}?view=studio&lesson=${lesson}`);
  await page.waitForFunction(() => window.studio?.ready, null, { timeout: 60_000 });
  console.log('video: studio open');
  const info = await page.evaluate(() => ({ ms: window.studio!.ms, fps: window.studio!.fps, cues: window.studio!.cues }));
  mkdirSync(out, { recursive: true });

  if (still !== undefined) {
    for (const s of still.split(',')) {
      await page.evaluate((t) => window.studio!.seek(t), Number(s) * 1000);
      writeFileSync(`${out}/${lesson}-${s}s.png`, await page.screenshot());
      console.log(`video: ${out}/${lesson}-${s}s.png`);
    }
  } else {
    const to = Math.min(info.ms, toArg ? Number(toArg) * 1000 : info.ms);
    const first = Math.floor((from * info.fps) / 1000);
    const last = Math.ceil((to * info.fps) / 1000);
    const file = `${out}/${lesson}${toArg || from ? `-${from / 1000}-${to / 1000}` : ''}.mp4`;
    // The voice first, on its own: every recording delayed to its place (shifted by --from), mixed into one track.
    // (Mixed while filming, ffmpeg waited on the two dozen recordings and never read the pictures.)
    const cues = info.cues.filter((c) => c.at < to).map((c) => ({ ...c, at: c.at - from }));
    const audio = cues.filter((c) => c.at >= 0);
    const seconds = String((last - first) / info.fps);
    const voiceTrack = `${file}.voice.wav`;
    const run = (argv: string[]) => execFileSync(ffmpeg as unknown as string, ['-y', '-nostdin', '-loglevel', 'error', ...argv], { stdio: ['ignore', 'inherit', 'inherit'] });
    console.log(`video: mixing ${audio.length} recordings…`);
    if (audio.length)
      run([
        ...audio.flatMap((c) => ['-i', `src/assets/voice/${c.file}`]),
        '-filter_complex',
        audio.map((c, i) => `[${i}:a]adelay=${Math.round(c.at)}:all=1[a${i}]`).join(';') +
          `;${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0:duration=longest[voice]`,
        '-map',
        '[voice]',
        '-t',
        seconds,
        voiceTrack,
      ]);
    // Then the pictures, piped in as they are taken, with that track.
    const ff = spawn(
      ffmpeg as unknown as string,
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        String(info.fps),
        '-i',
        '-',
        ...(audio.length ? ['-i', voiceTrack, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '128k'] : []),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        '20',
        '-preset',
        'medium',
        '-t',
        seconds,
        file,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const done = new Promise<number>((resolve) => ff.on('close', resolve));
    const started = Date.now();
    for (let f = first; f < last; f++) {
      await page.evaluate((t) => window.studio!.seek(t), (f * 1000) / info.fps);
      const png = await page.screenshot();
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((f - first) % 300 === 0) console.log(`video: frame ${f - first}/${last - first} (${Math.round((Date.now() - started) / 1000)} s)`);
    }
    ff.stdin.end();
    const code = await done;
    if (audio.length) rmSync(voiceTrack);
    if (code !== 0) throw new Error(`ffmpeg stopped with ${code}`);
    console.log(`video: ${file} · ${((last - first) / info.fps).toFixed(1)} s · ${audio.length} recordings`);
  }
} finally {
  await browser.close();
  await server.close();
}
