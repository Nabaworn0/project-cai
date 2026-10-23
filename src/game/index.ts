import Phaser from 'phaser';
import { PALETTE } from './art/palette';
import { currentDpr, pixelView } from './display';
import { ShopScene } from './scenes/ShopScene';

// Pixel-art rendering: the canvas is sized in art pixels and shown `scale` device pixels per art pixel
// (see display.ts). Scenes lay out in art pixels and must keep coordinates whole numbers.
export function startGame(parent: HTMLElement): Phaser.Game {
  const view = pixelView(parent.clientWidth, parent.clientHeight, currentDpr());
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: PALETTE.wall,
    pixelArt: true,
    scale: { mode: Phaser.Scale.NONE, width: view.width, height: view.height, zoom: view.zoom },
    input: { activePointers: 2 },
    banner: false,
    scene: [ShopScene],
  });
  let last = view;
  const fit = () => {
    const v = pixelView(parent.clientWidth, parent.clientHeight, currentDpr());
    if (v.width === last.width && v.height === last.height && v.zoom === last.zoom) return;
    last = v;
    if (v.zoom !== game.scale.zoom) game.scale.setZoom(v.zoom);
    game.scale.resize(v.width, v.height);
  };
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  return game;
}
