// The lesson video studio (?view=studio&lesson=lesson-os, docs/lessons-plan.md "ส่วนต่อ 2"): one 1280 x 720 frame of
// the cartoon at any moment of src/core/video.ts's running order. Nothing moves by itself: tools/video.ts sets the
// moment through window.studio, takes a picture of each frame and joins them with the voice into an mp4.

import { useEffect, useState } from 'preact/hooks';
import { loadContent } from '../content';
import { VOICE } from '../content/voice';
import { blinking, boardText, mouthAt, subtitle } from '../core/lesson';
import { audioCues, countdown, demoAt, frames, shotAt, timeline, FPS } from '../core/video';
import { Demo } from './demos';
import './studio.css';

const sprites = import.meta.glob<string>('../assets/sprites/{teach,tech}-*.png', { eager: true, query: '?url', import: 'default' });
const sprite = (name: string) => sprites[`../assets/sprites/${name}.png`]!;

declare global {
  interface Window {
    studio?: { ready: boolean; ms: number; frames: number; fps: number; cues: { file: string; at: number }[]; seek: (t: number) => Promise<void> };
  }
}

const content = loadContent();
/** The seek waiting for its frame to be drawn. */
let drawn: (() => void) | null = null;

export function Studio({ lessonId }: { lessonId: string }) {
  const lesson = content.lessons.lessons.find((l) => l.id === lessonId) ?? content.lessons.lessons[0]!;
  const tl = timeline(lesson, VOICE);
  // Each seek is a new frame object, even to the moment already shown (as a number it would not draw, nor answer).
  const [frame, setFrame] = useState({ time: 0 });
  const time = frame.time;

  useEffect(() => {
    window.studio = {
      ready: true,
      ms: tl.ms,
      frames: frames(tl),
      fps: FPS,
      cues: audioCues(tl),
      // Resolves once the frame for `t` is on screen.
      seek: (t) =>
        new Promise<void>((resolve) => {
          drawn = resolve;
          setFrame({ time: t });
        }),
    };
  }, []);
  // After the frame for the new moment is rendered and painted.
  useEffect(() => {
    requestAnimationFrame(() => {
      drawn?.();
      drawn = null;
    });
  }, [frame]);

  const { shot, t } = shotAt(tl, time);
  const lastLine = tl.shots.filter((s) => s.kind === 'line' && s.start <= time).at(-1);
  const line = lesson.lines[lastLine && lastLine.kind === 'line' ? lastLine.at : 0]!;
  const q = shot.kind === 'ask' || shot.kind === 'reveal' ? lesson.questions[shot.q]! : null;
  const speaking = shot.kind === 'line' || shot.kind === 'reveal' ? shot : null;
  const mouth = speaking ? mouthAt(speaking.words, t) : 'closed';
  const pose =
    shot.kind === 'line'
      ? line.pose
      : shot.kind === 'ask'
        ? 'point-left'
        : shot.kind === 'reveal'
          ? 'explain'
          : shot.kind === 'end'
            ? 'thumbs'
            : 'stand';
  // His face: the script's for a line; thinking while a question waits, smiling otherwise.
  const face = shot.kind === 'line' ? line.face : shot.kind === 'ask' ? 'thinking' : 'happy';
  const demo = demoAt(tl, lesson, time);
  const intern = shot.kind === 'line' ? line.intern : shot.kind === 'ask' ? 'thinking' : shot.kind === 'reveal' ? 'happy' : 'happy';
  const sub =
    shot.kind === 'line'
      ? subtitle(line, content.lessons.subtitles)
      : shot.kind === 'reveal' && q
        ? subtitle(q.wrong, content.lessons.subtitles)
        : '';

  return (
    <div class="studio" data-kind={shot.kind} data-mouth={mouth} data-pose={pose} data-face={face} data-demo={demo?.demo ?? ''}>
      <div class="studio-screen" data-testid="studio-screen">
        {shot.kind === 'title' || shot.kind === 'end' ? null : q ? (
          <div class="studio-quiz">
            <p class="studio-q">{q.stemTh}</p>
            <ol>
              {q.choicesTh.map((c, i) => (
                <li key={c} class={shot.kind === 'reveal' && i === q.answer ? 'right' : ''}>
                  <b>{'กขค'[i]}.</b> {c}
                </li>
              ))}
            </ol>
            {shot.kind === 'ask' && (
              <p class="studio-count">
                หยุดคลิปแล้วลองตอบ <b>{countdown(t)}</b>
              </p>
            )}
          </div>
        ) : demo ? (
          <Demo id={demo.demo} p={demo.p} part={demo.part} time={time} />
        ) : (
          <p class="studio-board">{line.board}</p>
        )}
      </div>
      {/* The script's words for the line, as a tag over the screen while the screen shows the working. */}
      {demo && shot.kind === 'line' && <p class="studio-caption">{boardText(line.board, t, shot.ms)}</p>}
      <img class="studio-intern" src={sprite(`tech-${intern}`)} alt="" />
      <div class={`studio-senior${mouth === 'wide' ? ' bob' : ''}`}>
        <img src={sprite(`teach-${pose}`)} alt="" data-frame={pose} />
        {face !== 'neutral' && <img src={sprite(`teach-face-${face}`)} alt="" data-frame={`face-${face}`} />}
        {mouth !== 'closed' && <img src={sprite(`teach-mouth-${mouth}`)} alt="" data-frame={`mouth-${mouth}`} />}
        {blinking(time) && <img src={sprite('teach-eyes-shut')} alt="" data-frame="eyes-shut" />}
      </div>
      {sub && <p class="studio-sub">{sub}</p>}

      {shot.kind === 'title' && (
        <div class="studio-card">
          <p class="studio-shop">ร้านซ่อมคอม · บทเรียน</p>
          <h1>{lesson.titleTh}</h1>
          <p>สอนโดยพี่ช่าง</p>
        </div>
      )}
      {shot.kind === 'end' && (
        <div class="studio-card">
          <h1>จบบทเรียน</h1>
          <p>ภาพสร้างด้วย AI (ChatGPT) · เสียงพากย์สร้างด้วย AI (Microsoft Edge TTS)</p>
          <p class="studio-shop">เกมร้านซ่อมคอม · รายวิชา 21910-2001</p>
        </div>
      )}
    </div>
  );
}
