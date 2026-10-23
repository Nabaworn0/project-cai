import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/700.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/700.css';
import './ui/theme.css';

import { h, render } from 'preact';
import { bus } from './core/bus';
import { startGame } from './game';
import { App } from './ui/App';
import { registerPwa } from './pwa';

async function boot(): Promise<void> {
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
  registerPwa();
}

void boot();
