// A lesson (docs/lessons-plan.md part 2, V4): the cartoon video made by tools/video.ts (public/videos), then its two
// review questions. Each answer is explained in the senior's words; a wrong one can be tried again or that part of
// the video watched again. Done once both are answered right; the first answers are kept for the teacher.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lesson, Lessons } from '../../content/schema';
import { VOICE } from '../../content/voice';
import { allSolved, answerQuestion, firstAnswers, noAnswers, solved, subtitle } from '../../core/lesson';
import type { LessonRecord } from '../../core/path';
import { END_MS, lineStart, timeline } from '../../core/video';
import { LearnPage } from '../menu/MenuScreen';
import './lesson.css';

interface Props {
  lesson: Lesson;
  subtitles: Lessons['subtitles'];
  saved: LessonRecord | undefined;
  onSave: (r: { at: number; first: number[]; done: boolean }) => void;
  onBack: () => void;
}

/** The lesson's video in the built game. */
export const videoUrl = (id: string) => `${import.meta.env.BASE_URL}videos/${id}.mp4`;

export function LessonScreen({ lesson, subtitles, saved, onSave, onBack }: Props) {
  // Watched before (saved as at = 1, or answers already given): the questions are open straight away.
  const [watched, setWatched] = useState(() => (saved?.at ?? 0) > 0 || (saved?.first ?? []).some((a) => a >= 0));
  const [answers, setAnswers] = useState(() => noAnswers(lesson));
  const video = useRef<HTMLVideoElement>(null);
  const done = allSolved(lesson, answers);

  useEffect(() => {
    if (watched || answers.some((a) => a.length)) onSave({ at: watched ? 1 : 0, first: firstAnswers(answers), done });
  }, [watched, answers, done]);

  // Reaching the end card counts as watched to the end, even without waiting for its last seconds.
  const onTime = () => {
    const v = video.current;
    if (v && v.duration && v.currentTime >= v.duration - END_MS / 1000) setWatched(true);
  };
  const replay = (q: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = lineStart(timeline(lesson, VOICE), lesson.questions[q]!.replay - 1) / 1000;
    v.scrollIntoView({ block: 'center' });
    void v.play().catch(() => undefined);
  };

  return (
    <LearnPage
      title={lesson.titleTh}
      testid="lesson"
      scrollKey={lesson.id}
      tall
      wide
      scene="room"
      aside={
        <button class="chip" type="button" onClick={onBack}>
          ☰ เมนู
        </button>
      }
    >
      <div class="lesson" data-watched={watched} data-done={done}>
        <video
          ref={video}
          class="lesson-video"
          src={videoUrl(lesson.id)}
          controls
          playsInline
          preload="metadata"
          onTimeUpdate={onTime}
          onEnded={() => setWatched(true)}
        />
        <p class="lesson-ai">ภาพสร้างด้วย AI (ChatGPT) · เสียงพากย์สร้างด้วย AI (Microsoft Edge TTS) · มีซับไทยในคลิป</p>

        {!watched ? (
          <p class="lesson-hint" role="status">
            ดูคลิปให้จบ แล้วตอบคำถามทบทวน {lesson.questions.length} ข้อด้านล่าง
          </p>
        ) : (
          <>
            {lesson.questions.map((q, i) => {
              const tries = answers[i]!;
              const last = tries.at(-1);
              const right = solved(lesson, answers, i);
              return (
                <div key={q.stemTh} class="lesson-q" data-testid="lesson-q" data-solved={right}>
                  <p class="lesson-stem">
                    {i + 1}. {q.stemTh}
                  </p>
                  <div class="lesson-choices">
                    {q.choicesTh.map((c, k) => (
                      <button
                        key={c}
                        type="button"
                        class={`lesson-choice${last === k ? (right ? ' right' : ' wrong') : ''}`}
                        disabled={right}
                        onClick={() => setAnswers((a) => answerQuestion(lesson, a, i, k))}
                      >
                        <b>{'กขคง'[k]}.</b> {c}
                      </button>
                    ))}
                  </div>
                  {last !== undefined && (
                    <p class={`lesson-why ${right ? 'right' : 'wrong'}`} role="status">
                      <b>{right ? 'ถูกต้อง!' : 'ยังไม่ถูก'}</b> {subtitle(right ? q.right : q.wrong, subtitles)}
                    </p>
                  )}
                  {last !== undefined && !right && (
                    <div class="lesson-retry">
                      <span>เลือกคำตอบใหม่ได้เลย หรือ</span>
                      <button class="chip" type="button" onClick={() => replay(i)}>
                        ▶ ดูช่วงนั้นในคลิปอีกครั้ง
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {done && (
              <div class="lesson-end" role="status">
                <p class="lesson-done">จบบทเรียนแล้ว เก่งมาก!</p>
                <button class="btn" type="button" onClick={onBack}>
                  กลับเส้นทางเรียน
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </LearnPage>
  );
}
