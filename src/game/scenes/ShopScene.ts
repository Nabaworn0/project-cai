// The shop counter in 16-bit pixel art: wall, window, parts shelf, sign board, the technician behind
// the counter, and the customer's PC. Laid out in art pixels from the current canvas size, so phones
// (portrait) and PCs (landscape) both fit. All coordinates stay whole numbers to keep pixels square.

import Phaser from 'phaser';
import { bus } from '../../core/bus';
import { hex, PALETTE as P } from '../art/palette';
import { paintRows, type PixelRows } from '../art/pixels';
import { MONITOR } from '../art/props';
import { characterIds, spriteSet, spriteUrl } from '../art/sprites';
import { EXPRESSIONS, technicianRows, TECH_FACE, type Expression } from '../art/technician';
import type { CustomerMood } from '../../core/session';

const MOODS: readonly CustomerMood[] = ['neutral', 'worried', 'happy', 'angry'];
/** Walking speed in art pixels per second, and how often the walker bobs a pixel. */
const WALK_SPEED = 90;
const BOB_MS = 140;
/** A happy hop: the customer's height above the floor (art px) frame by frame; whole pixels only.
 *  Players who asked for less motion get one small hop instead of two: the hop is the only sign of joy
 *  at the counter, and it moves one small figure, not the screen. */
const HOP = [2, 4, 5, 4, 2, 0, 2, 4, 5, 4, 2, 0];
const HOP_GENTLE = [1, 2, 2, 1, 0];
const HOP_MS = 50;

type CustomerState = 'away' | 'walking-in' | 'here' | 'walking-out';

/** HUD chip footprint in CSS px (see .hud in theme.css); the sign must not sit under the chips. */
const HUD_CHIP = { width: 170, height: 56 };

export interface ShopLayout {
  /** Sign board rectangle in CSS px, for the HTML shop name drawn over it. */
  sign: { x: number; y: number; w: number; h: number };
}

export class ShopScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private front!: Phaser.GameObjects.Graphics;
  private tech!: Phaser.GameObjects.Image;
  private monitor!: Phaser.GameObjects.Image;
  private windowImg?: Phaser.GameObjects.Image;
  private shelfImg?: Phaser.GameObjects.Image;
  private expression: Expression = 'neutral';
  private techBaseY = 0;
  /** Real pixelized technician frames (missing expressions reuse neutral), or null for the placeholder. */
  private techSprites = spriteSet(EXPRESSIONS.map((e) => `tech-${e}`), 'tech-neutral');
  /** The senior technician (พี่ช่าง) who teaches the intern. He works at his bench in the back and walks behind
   *  the counter to the intern's right shoulder when there is something to say (docs/learning-page-plan.md);
   *  absent until his art exists (docs/art-prompts.md 2.1). */
  private senior?: Phaser.GameObjects.Image;
  private seniorState: 'away' | 'walking' | 'here' = 'away';
  /** Where he stands beside the intern (set by layout). */
  private seniorSpot = { x: 0, y: 0 };
  private seniorWalk?: Phaser.Tweens.Tween;
  private seniorSprites = spriteSet(['senior-neutral', 'senior-happy', 'senior-thinking'], 'senior-neutral');
  /** Pixelized props; each falls back to its code-drawn version when its file does not exist. */
  private props = {
    monitor: spriteUrl('monitor'),
    window: spriteUrl('window'),
    shelf: spriteUrl('shelf'),
    laptop: spriteUrl('laptop'),
    // The back-room window where the senior works (docs/art-prompts.md 4.2); it replaces the plain window.
    'workshop-busy': spriteUrl('workshop-busy'),
    'workshop-empty': spriteUrl('workshop-empty'),
  };
  /** The back-room window is in use (both its frames exist). */
  private workshop = !!(this.props['workshop-busy'] && this.props['workshop-empty']);
  /** The shop's own laptop (Rufus), on the counter right of the customer's PC; absent without its sprite. */
  private laptop?: Phaser.GameObjects.Image;
  /** Customer frames by id; a missing mood reuses that customer's neutral frame. */
  private customerSprites = new Map(
    characterIds().flatMap((id) => {
      const set = spriteSet(MOODS.map((m) => `${id}-${m}`), `${id}-neutral`);
      return set ? [[id, set] as const] : [];
    }),
  );
  private customer!: Phaser.GameObjects.Image;
  private customerId: string | null = null;
  private customerMood: CustomerMood = 'neutral';
  private customerState: CustomerState = 'away';
  /** Where the customer stands in front of the counter (set by layout). */
  private stand = { x: 0, y: 0 };
  private walk?: Phaser.Tweens.Tween;
  private bob?: Phaser.Time.TimerEvent;
  private hop?: Phaser.Time.TimerEvent;

  constructor() {
    super('shop');
  }

  preload(): void {
    this.techSprites?.forEach((url, key) => this.load.image(key, url));
    this.seniorSprites?.forEach((url, key) => this.load.image(key, url));
    for (const [key, url] of Object.entries(this.props)) if (url) this.load.image(key, url);
    for (const set of this.customerSprites.values()) set.forEach((url, key) => this.load.image(key, url));
  }

  create(): void {
    if (!this.techSprites) for (const e of EXPRESSIONS) this.addPixelTexture(`tech-${e}`, technicianRows(e));
    if (!this.props.monitor) this.addPixelTexture('monitor', MONITOR);

    this.bg = this.add.graphics();
    if (this.workshop) {
      this.windowImg = this.add.image(0, 0, 'workshop-busy').setOrigin(0, 0);
      document.body.dataset.workshop = 'busy';
    }
    else if (this.props.window) this.windowImg = this.add.image(0, 0, 'window').setOrigin(0, 0);
    if (this.props.shelf) this.shelfImg = this.add.image(0, 0, 'shelf').setOrigin(0, 0);
    // He stands a step behind the intern, so he is drawn first.
    if (this.seniorSprites) this.senior = this.add.image(0, 0, 'senior-neutral').setOrigin(0, 0).setVisible(false);
    this.tech = this.add.image(0, 0, 'tech-neutral').setOrigin(0, 0);
    this.tech.setInteractive({ useHandCursor: true, pixelPerfect: true });
    this.tech.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCanvas(p) && this.react());
    this.front = this.add.graphics();
    this.monitor = this.add.image(0, 0, 'monitor').setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.monitor.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCanvas(p) && bus.emit('ui:open-sim', {}));
    if (this.props.laptop) {
      this.laptop = this.add.image(0, 0, 'laptop').setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this.laptop.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCanvas(p) && bus.emit('ui:open-laptop', {}));
    }
    // The customer stands in front of the counter, so it is drawn last.
    this.customer = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setVisible(false);
    this.customer.setInteractive({ useHandCursor: true, pixelPerfect: true });
    this.customer.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCanvas(p) && this.customerId && bus.emit('customer:tap', { id: this.customerId }));
    const offs = [
      bus.on('customer:enter', ({ id, mood }) => this.enterCustomer(id, mood)),
      bus.on('customer:mood', ({ mood }) => this.setCustomerMood(mood)),
      bus.on('customer:leave', () => this.leaveCustomer()),
      bus.on('customer:cheer', () => this.cheer()),
      bus.on('senior:come', () => this.seniorTo('here')),
      bus.on('senior:go', () => this.seniorTo('away')),
      bus.on('talk:line', ({ who, face }) => this.speak(who, face)),
    ];
    this.events.once('shutdown', () => offs.forEach((off) => off()));

    // Idle: a one-pixel breath every 0.7 s.
    this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => {
        if (!this.tweens.isTweening(this.tech)) this.tech.y = this.tech.y === this.techBaseY ? this.techBaseY - 1 : this.techBaseY;
      },
    });

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout();

    this.setExpression('neutral');
    document.body.dataset.scene = 'shop';
    bus.emit('scene:ready', { scene: 'shop' });
  }

  /**
   * Phaser also hears presses anywhere on the page (window events), so a tap on an HTML screen over the
   * canvas (a button in Rufus, say) could land on the PC or laptop behind it. Only taps on the canvas count.
   */
  private onCanvas(p: Phaser.Input.Pointer): boolean {
    return !p.event || p.event.target === this.game.canvas;
  }

  private addPixelTexture(key: string, rows: PixelRows): void {
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, rows[0]!.length, rows.length)!;
    paintRows(tex.getContext(), rows);
    tex.refresh();
  }

  /** Tap reaction: next expression plus a little hop. */
  private react(): void {
    const next = EXPRESSIONS[(EXPRESSIONS.indexOf(this.expression) + 1) % EXPRESSIONS.length]!;
    this.setExpression(next);
    this.tweens.killTweensOf(this.tech);
    this.tech.y = this.techBaseY;
    this.tweens.add({ targets: this.tech, y: this.techBaseY - 4, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    bus.emit('character:tap', { expression: next });
  }

  private setExpression(e: Expression): void {
    this.expression = e;
    this.tech.setTexture(`tech-${e}`);
    document.body.dataset.expression = e;
  }

  private layout(): void {
    const W = this.scale.gameSize.width;
    const H = this.scale.gameSize.height;
    const zoom = this.scale.zoom; // CSS px per art px
    this.cameras.main.setSize(W, H);
    const portrait = H > W;
    // Tall phones: the case panel takes the bottom half of the screen, so the counter and the people move up
    // into what would be empty wall (see .case-panel in case.css). Landscape keeps the panel at the side.
    const tall = H / W >= 1.6;
    const floorY = Math.round(H * (tall ? 0.56 : portrait ? 0.74 : 0.8));
    const counterTop = floorY - (portrait ? 28 : 24);

    // Wall: stripes, then a wainscot rail; floor planks with staggered seams.
    const g = this.bg.clear();
    g.fillStyle(hex(P.wall)).fillRect(0, 0, W, floorY);
    g.fillStyle(hex(P.wallStripe));
    for (let x = 2; x < W; x += 12) g.fillRect(x, 0, 4, floorY);
    g.fillStyle(hex(P.wood)).fillRect(0, floorY - 3, W, 2);
    g.fillStyle(hex(P.woodDark)).fillRect(0, floorY - 1, W, 1);
    g.fillStyle(hex(P.floor)).fillRect(0, floorY, W, H - floorY);
    g.fillStyle(hex(P.floorDark));
    for (let y = floorY + 6, row = 0; y < H; y += 6, row++) {
      g.fillRect(0, y, W, 1);
      for (let x = (row % 2) * 16; x < W; x += 32) g.fillRect(x, y - 5, 1, 5);
    }

    // Sign board, kept clear of the HUD chips (which are HTML, sized in CSS px).
    const signW = Math.min(W - 16, 96);
    const signH = 16;
    const sideRoom = (W - signW) / 2;
    const signY = sideRoom * zoom < HUD_CHIP.width ? Math.ceil(HUD_CHIP.height / zoom) + 2 : 6;
    const signX = Math.floor((W - signW) / 2);
    g.fillStyle(hex(P.navy)).fillRect(signX, signY, signW, signH);
    g.fillStyle(hex(P.yellow)).fillRect(signX + 2, signY + 2, signW - 4, 1).fillRect(signX + 2, signY + signH - 3, signW - 4, 1);
    g.fillRect(signX + 2, signY + 2, 1, signH - 4).fillRect(signX + signW - 3, signY + 2, 1, signH - 4);
    g.fillStyle(hex(P.navyMid)).fillRect(signX + 4, signY + signH, 2, 3).fillRect(signX + signW - 6, signY + signH, 2, 3);

    // Window (left) and parts shelf (right) on the wall; the window is dropped when both do not fit.
    const margin = Math.max(8, Math.floor(W * 0.06));
    const wy = signY + signH + 10;
    const winW = this.windowImg?.width ?? 32;
    const shelfW = this.shelfImg?.width ?? 36;
    const showWindow = W >= winW + shelfW + margin * 3;
    if (this.windowImg) this.windowImg.setPosition(margin, wy).setVisible(showWindow);
    else if (showWindow) this.drawWindow(g, margin, wy, 32, 24);
    if (this.shelfImg) this.shelfImg.setPosition(W - margin - shelfW, wy);
    else this.drawShelf(g, W - margin - shelfW, wy, 36);

    // Technician behind the counter: the counter front hides everything below their hands.
    const techW = this.tech.width;
    const techH = this.tech.height;
    // With the senior beside the intern, a narrow (portrait) shop moves them left to fit the PC and laptop.
    let techX = Math.round(W * (portrait ? (this.senior ? 0.3 : 0.38) : 0.42) - techW / 2);
    // Phones on their side: the case panel covers the right part of the screen (from about 54%, case.css),
    // so the intern, the senior and the customer's PC all keep to the left of it.
    if (!portrait && H * zoom < 520) {
      const row = techW - 4 + (this.senior ? this.senior.width + 4 : 10) + this.monitor.width;
      techX = Math.max(4, Math.min(techX, Math.floor(W * 0.54) - row - 2));
    }
    this.techBaseY = counterTop - techH + Math.round(techH * 0.1);
    this.tech.setPosition(techX, this.techBaseY);
    // The senior's frame runs from head to thigh: 70% of it shows above the counter, which puts his head
    // level with the intern's.
    if (this.senior) {
      this.seniorSpot = { x: techX + techW - 4, y: counterTop - Math.round(this.senior.height * 0.7) };
      this.senior.setY(this.seniorSpot.y);
      if (this.seniorState === 'here') this.senior.setX(this.seniorSpot.x);
    }

    // Counter (drawn over the technician).
    const f = this.front.clear();
    const cx = 6;
    const cw = W - 12;
    f.fillStyle(hex(P.navy)).fillRect(cx, counterTop + 4, cw, floorY - counterTop);
    f.fillStyle(hex(P.navyMid)).fillRect(cx + 2, counterTop + 6, cw - 4, floorY - counterTop - 6);
    f.fillStyle(hex(P.teal)).fillRect(cx + 2, counterTop + 12, cw - 4, 2);
    f.fillStyle(hex(P.tealShade)).fillRect(cx + 2, counterTop + 14, cw - 4, 1);
    f.fillStyle(hex(P.navy)).fillRect(cx - 2, counterTop, cw + 4, 5);
    f.fillStyle(hex(P.yellow)).fillRect(cx - 1, counterTop + 1, cw + 2, 3);
    f.fillStyle(hex(P.white)).fillRect(cx, counterTop + 1, cw, 1);

    // Customer's PC sits on the counter to the technician's right (past the senior when he is there).
    // His spot stays free whether he is at the counter or at his bench.
    const beside = this.senior ? this.seniorSpot.x + this.senior.width + 4 : techX + techW + 10;
    const mx = Math.min(beside, W - this.monitor.width - 6);
    this.monitor.setPosition(mx, counterTop - this.monitor.height + 1);

    // The customer stands on the floor in front of the counter, to the technician's left (the PC is on the right).
    const custW = this.customerId ? this.customer.width : 34;
    const custH = this.customerId ? this.customer.height : 80;
    this.stand = { x: Math.max(4, techX - custW - (portrait ? 4 : 10)), y: floorY + (portrait ? 10 : 6) - custH };
    this.placeCustomer();

    // The shop laptop: right of the PC in portrait; in landscape the case panel covers the right side,
    // so it goes to the free left end of the counter, clear of the customer standing in front.
    if (this.laptop) {
      const lx = portrait
        ? Math.min(mx + this.monitor.width + 4, W - this.laptop.width - 8)
        : Math.max(8, Math.min(Math.round(W * 0.06), this.stand.x - this.laptop.width - 12));
      this.laptop.setPosition(lx, counterTop - this.laptop.height + 1);
    }

    // Positions in CSS px: tap targets for the Playwright tests, and the sign rectangle for the HTML label.
    const css = (v: number) => Math.round(v * zoom);
    const face = this.techSprites ? { x: Math.round(techW / 2), y: Math.round(techH * 0.3) } : TECH_FACE;
    document.body.dataset.techAt = `${css(techX + face.x)},${css(this.techBaseY + face.y)}`;
    if (this.senior) document.body.dataset.seniorAt = `${css(this.seniorSpot.x + this.senior.width / 2)},${css(this.seniorSpot.y + this.senior.height * 0.25)}`;
    document.body.dataset.pcAt = `${css(mx + this.monitor.width / 2)},${css(this.monitor.y + 6)}`;
    if (this.laptop) document.body.dataset.laptopAt = `${css(this.laptop.x + this.laptop.width / 2)},${css(this.laptop.y + 6)}`;
    const layout: ShopLayout = { sign: { x: css(signX), y: css(signY), w: css(signW), h: css(signH) } };
    bus.emit('layout:shop', layout);
  }

  // ---- the customer at the counter ----

  private enterCustomer(id: string, mood: CustomerMood): void {
    if (!this.customerSprites.has(id)) {
      // The case still has to go on: answer at once, with nobody drawn at the counter.
      console.warn(`No sprites for customer "${id}" yet; nobody walks in.`);
      bus.emit('customer:arrived', { id });
      return;
    }
    this.stopWalk();
    this.customerId = id;
    this.customerMood = mood;
    this.customer.setTexture(`${id}-${mood}`).setVisible(true);
    this.layout(); // the stand position depends on this customer's size
    this.walkTo(-this.customer.width - 2, this.stand.x, 'walking-in', () => {
      this.customerState = 'here';
      this.syncCustomerData();
      bus.emit('customer:arrived', { id });
    });
  }

  private setCustomerMood(mood: CustomerMood): void {
    if (!this.customerId) return;
    this.customerMood = mood;
    this.customer.setTexture(`${this.customerId}-${mood}`);
    this.syncCustomerData();
  }

  // ---- the senior technician ----

  private showBench(state: 'busy' | 'empty'): void {
    this.windowImg?.setTexture(`workshop-${state}`);
    document.body.dataset.workshop = state;
  }

  /** Where he steps out of the back room: under its window when it is on the wall, else off the left edge. */
  private benchX(): number {
    const w = this.windowImg;
    const sw = this.senior?.width ?? 0;
    return this.workshop && w?.visible ? Math.round(w.x + w.width / 2 - sw / 2) : -sw - 2;
  }

  /** Walks him from his bench to the intern's side, or back; each end is announced. The back-room window shows
   *  his empty stool while he is away from it. */
  private seniorTo(where: 'here' | 'away'): void {
    const s = this.senior;
    const done = () => {
      this.seniorState = where;
      s?.setVisible(where === 'here');
      if (where === 'away' && this.workshop) this.showBench('busy');
      document.body.dataset.senior = where;
      bus.emit(where === 'here' ? 'senior:arrived' : 'senior:left', {});
    };
    if (!s || this.seniorState === where) return done();
    this.seniorWalk?.stop();
    const away = this.benchX();
    if (where === 'here' && this.workshop) this.showBench('empty');
    const from = this.seniorState === 'walking' ? s.x : where === 'here' ? away : this.seniorSpot.x;
    const to = where === 'here' ? this.seniorSpot.x : away;
    this.seniorState = 'walking';
    document.body.dataset.senior = 'walking';
    if (where === 'here') s.setTexture('senior-neutral');
    s.setVisible(true).setX(Math.round(from));
    const pos = { x: from };
    this.seniorWalk = this.tweens.add({
      targets: pos,
      x: to,
      duration: Math.max(200, (Math.abs(to - from) / WALK_SPEED) * 1000),
      onUpdate: () => s.setX(Math.round(pos.x)).setY(this.seniorSpot.y - (Math.floor(pos.x / 4) % 2)),
      onComplete: () => {
        this.seniorWalk = undefined;
        s.setPosition(Math.round(to), this.seniorSpot.y);
        done();
      },
    });
  }

  /** One line of a talk: the speaker's face, and a small hop so it is clear who is talking. */
  private speak(who: 'senior' | 'intern', face: Expression): void {
    const target = who === 'senior' ? this.senior : this.tech;
    if (!target) return;
    if (who === 'senior') {
      target.setTexture(this.textures.exists(`senior-${face}`) ? `senior-${face}` : 'senior-neutral');
      document.body.dataset.seniorFace = face;
    } else this.setExpression(face);
    const baseY = who === 'senior' ? this.seniorSpot.y : this.techBaseY;
    this.tweens.killTweensOf(target);
    target.y = baseY;
    this.tweens.add({ targets: target, y: baseY - 3, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Little hops for joy while the customer stands at the counter. */
  private cheer(): void {
    if (this.customerState !== 'here') return;
    const hop = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? HOP_GENTLE : HOP;
    this.hop?.remove();
    let i = 0;
    this.hop = this.time.addEvent({
      delay: HOP_MS,
      repeat: hop.length - 1,
      callback: () => {
        if (this.customerState !== 'here') return;
        this.customer.setY(this.stand.y - hop[i++]!);
        document.body.dataset.customerHop = i < hop.length ? 'up' : '';
      },
    });
  }

  private leaveCustomer(): void {
    const id = this.customerId;
    if (this.customerState === 'walking-out') return; // already leaving: customer:left comes when the walk ends
    if (!id || this.customerState === 'away') {
      // Nobody (or an undrawn customer) at the counter: the case can still move on.
      bus.emit('customer:left', { id: id ?? '' });
      return;
    }
    this.stopWalk();
    this.hop?.remove();
    this.walkTo(this.customer.x, -this.customer.width - 2, 'walking-out', () => {
      this.customerState = 'away';
      this.customerId = null;
      this.customer.setVisible(false);
      this.syncCustomerData();
      bus.emit('customer:left', { id });
    });
  }

  /** Slides between two x positions on whole pixels, bobbing a pixel per step (there are no walk frames). */
  private walkTo(fromX: number, toX: number, state: CustomerState, onDone: () => void): void {
    this.customerState = state;
    this.syncCustomerData();
    const pos = { x: fromX };
    this.customer.setPosition(Math.round(fromX), this.stand.y);
    let up = false;
    this.bob = this.time.addEvent({
      delay: BOB_MS,
      loop: true,
      callback: () => this.customer.setY(this.stand.y - ((up = !up) ? 1 : 0)),
    });
    this.walk = this.tweens.add({
      targets: pos,
      x: toX,
      duration: Math.max(200, (Math.abs(toX - fromX) / WALK_SPEED) * 1000),
      onUpdate: () => this.customer.setX(Math.round(pos.x)),
      onComplete: () => {
        this.stopWalk();
        this.customer.setPosition(Math.round(toX), this.stand.y);
        onDone();
      },
    });
  }

  private stopWalk(): void {
    this.walk?.stop();
    this.bob?.remove();
    this.walk = undefined;
    this.bob = undefined;
  }

  /** After a resize: a standing customer moves to the new spot; a walk in progress finishes at once. */
  private placeCustomer(): void {
    if (!this.customer) return;
    this.walk?.complete(); // ends at the old spot, so the line below moves them to the new one
    if (this.customerState === 'here') this.customer.setPosition(this.stand.x, this.stand.y);
    this.syncCustomerData();
  }

  /** State for the Playwright tests: who is here, their mood, and where to tap them (CSS px). */
  private syncCustomerData(): void {
    const d = document.body.dataset;
    d.customer = this.customerId && this.customerState === 'here' ? this.customerId : '';
    d.customerMood = this.customerId ? this.customerMood : '';
    const zoom = this.scale.zoom;
    d.customerAt = this.customerId
      ? `${Math.round((this.stand.x + this.customer.width / 2) * zoom)},${Math.round((this.stand.y + this.customer.height * 0.25) * zoom)}`
      : '';
  }

  private drawWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(hex(P.navy)).fillRect(x, y, w, h);
    g.fillStyle(hex(P.wood)).fillRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle(hex(P.sky)).fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle(hex(P.skyShade)).fillRect(x + 3, y + h - 6, w - 6, 3);
    g.fillStyle(hex(P.white)).fillRect(x + 6, y + 7, 5, 2).fillRect(x + 5, y + 8, 8, 2);
    g.fillRect(x + w - 13, y + 11, 4, 1).fillRect(x + w - 14, y + 12, 7, 2);
    g.fillStyle(hex(P.wood)).fillRect(x + Math.floor(w / 2) - 1, y + 1, 2, h - 2);
    g.fillStyle(hex(P.woodDark)).fillRect(x - 1, y + h, w + 2, 2);
  }

  private drawShelf(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number): void {
    const boxes = [P.teal, P.coral, P.yellow, P.purple, P.navyMid, P.green];
    for (let i = 0; i < 3; i++) {
      const sy = y + 10 + i * 14;
      for (let b = 0; b < 3; b++) {
        const bx = x + 3 + b * 11;
        g.fillStyle(hex(P.navy)).fillRect(bx, sy - 9, 9, 9);
        g.fillStyle(hex(boxes[(i * 2 + b) % boxes.length]!)).fillRect(bx + 1, sy - 8, 7, 8);
        g.fillStyle(hex(P.white)).fillRect(bx + 2, sy - 7, 2, 1);
      }
      g.fillStyle(hex(P.wood)).fillRect(x, sy, w, 2);
      g.fillStyle(hex(P.woodDark)).fillRect(x, sy + 2, w, 1);
    }
  }
}
