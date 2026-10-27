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
  await Promise.all([
    document.fonts.load('700 32px "Chakra Petch"', 'ร้านซ่อมคอม'),
    document.fonts.load('400 16px "Noto Sans Thai"', 'ก'),
  ]).catch(() => undefined);

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

void (new URLSearchParams(location.search).get('view') === 'content' ? bootViewer() : bootGame());
registerPwa();
