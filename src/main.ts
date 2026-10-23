import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/700.css';
import './ui/theme.css';

import { h, render } from 'preact';
import { registerPwa } from './pwa';

async function bootGame(): Promise<void> {
  // Loaded on demand so the content viewer does not download Phaser.
  const [{ bus }, { startGame }, { App }] = await Promise.all([import('./core/bus'), import('./game'), import('./ui/App')]);

  // Canvas text is drawn once, so the Thai fonts must be loaded before Phaser renders it.
  await Promise.all([
    document.fonts.load('700 32px "Chakra Petch"', 'ร้านซ่อมคอม'),
    document.fonts.load('400 16px "Noto Sans Thai"', 'ก'),
  ]).catch(() => undefined);

  render(h(App, {}), document.getElementById('ui')!);
  bus.on('scene:ready', () => {
    const splash = document.getElementById('splash');
    splash?.classList.add('gone');
    setTimeout(() => splash?.remove(), 400);
  });
  startGame(document.getElementById('game')!);
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
