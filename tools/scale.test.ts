// npm run test:unit — how much bigger the HTML over the game is drawn on a big screen (src/ui/scale.ts).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BASE, HOME_BOOST, homeBoost, MAX_UI, uiScale } from '../src/ui/scale';

test('phones and laptops up to the base size are drawn as they are', () => {
  for (const [w, h] of [
    [360, 640],
    [412, 915],
    [915, 412],
    [1024, 768],
    [BASE.w, BASE.h],
  ] as const)
    assert.equal(uiScale(w, h), 1, `${w}×${h}`);
});

test('bigger screens grow by the tighter of their width and height', () => {
  assert.equal(uiScale(1920, 1080), 1.69);
  assert.equal(uiScale(1366, 768), 1.2);
  assert.equal(uiScale(1280, 800), 1.16);
  // A wide but short window grows only as much as its height allows.
  assert.equal(uiScale(2560, 700), 1.09);
});

test('never more than MAX_UI, however big the screen', () => {
  assert.equal(uiScale(3840, 2160), MAX_UI);
  assert.equal(uiScale(7680, 4320), MAX_UI);
});

test('the learning path grows a little more: none on a laptop-sized screen, 2× in all on 1920×1080, never past MAX_UI', () => {
  assert.equal(homeBoost(1), 1);
  assert.equal(homeBoost(uiScale(1920, 1080)), HOME_BOOST);
  assert.ok(Math.abs(uiScale(1920, 1080) * homeBoost(uiScale(1920, 1080)) - 2) < 0.01);
  assert.ok(homeBoost(1.2) > 1 && homeBoost(1.2) < HOME_BOOST);
  assert.equal(homeBoost(MAX_UI), 1);
});
