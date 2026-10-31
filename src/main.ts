import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/700.css';
import './ui/theme.css';

import { h, render } from 'preact';
import { registerPwa } from './pwa';

async function bootGame(): Promise<void> {
  // The learning page comes first; the shop scene (Phaser) is loaded when the learner goes to the shop (src/ui/App.tsx).
  const { App } = await import('./ui/App');

  // Canvas text is drawn once, so the Thai fonts must be loaded before Phaser renders it (and the page reads better).
  await Promise.all([document.fonts.load('700 32px "Chakra Petch"', 'ร้านซ่อมคอม'), document.fonts.load('400 16px "Noto Sans Thai"', 'ก')]).catch(
    () => undefined,
  );

  render(h(App, {}), document.getElementById('ui')!);
  const splash = document.getElementById('splash');
  splash?.classList.add('gone');
  setTimeout(() => splash?.remove(), 400);
}

/** ?view=content: the content viewer for people making the game (src/viewer). */
async function bootViewer(): Promise<void> {
  document.documentElement.classList.add('viewer-page');
  document.title = 'เนื้อหาเกม · ร้านซ่อมคอม';
  const { ContentViewer } = await import('./viewer/ContentViewer');
  render(h(ContentViewer, {}), document.getElementById('ui')!);
}

/** ?view=studio&lesson=…: one frame of a lesson video at a time, filmed by tools/video.ts (src/studio). */
async function bootStudio(lesson: string): Promise<void> {
  document.documentElement.classList.add('studio-page');
  const { Studio } = await import('./studio/Studio');
  await Promise.all([document.fonts.load('700 40px "Chakra Petch"', 'OS'), document.fonts.load('400 30px "Noto Sans Thai"', 'ก')]).catch(
    () => undefined,
  );
  render(h(Studio, { lessonId: lesson }), document.getElementById('ui')!);
  document.getElementById('splash')?.remove();
}

/** ?view=teacher: the teacher's page, a class's results brought together (src/teacher). */
async function bootTeacher(): Promise<void> {
  document.documentElement.classList.add('teacher-page');
  document.title = 'หน้าครู · ร้านซ่อมคอม';
  const { TeacherScreen } = await import('./teacher/TeacherScreen');
  render(h(TeacherScreen, {}), document.getElementById('ui')!);
  document.getElementById('splash')?.remove();
}

const params = new URLSearchParams(location.search);
const view = params.get('view');
void (view === 'content'
  ? bootViewer()
  : view === 'studio'
    ? bootStudio(params.get('lesson') ?? '')
    : view === 'teacher'
      ? bootTeacher()
      : bootGame());
registerPwa();
