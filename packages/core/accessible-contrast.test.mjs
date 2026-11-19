import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(import.meta.dirname, '..', 'pc-rescues/src/routes/global.css');
const css = readFileSync(file, 'utf8');
const darkStart = css.indexOf(":root[data-theme='dark'] {");
const light = css.slice(css.indexOf('/* Neutral-first palette.'), darkStart);
const dark = css.slice(darkStart, css.indexOf("body { background:", darkStart));
const get = (text, key) => {
  const match = new RegExp('\\-\\-rh-' + key + ':\\s*(#[a-fA-F0-9]{6})\\s*;').exec(text);
  assert.ok(match, 'Missing palette token: ' + key);
  return match[1];
};
function luminance(hex) {
  const rgba = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgba[0] * .2126 + rgba[1] * .7152 + rgba[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a,b) => b-a);
  return (values[0] + .05) / (values[1] + .05);
}
for (const [theme, palette] of [['light', light], ['dark', dark]]) {
  test(theme + ' text, muted and disabled states meet WCAG AA without changing colours', () => {
    const check = (foreground, background, minimum) => {
      const ratio = contrast(get(palette, foreground), get(palette, background));
      assert.ok(ratio >= minimum,
        theme + ' ' + foreground + ' on ' + background + ': ' + ratio.toFixed(2));
    };
    check('text', 'surface', 7);
    check('text', 'surface-soft', 7);
    check('muted', 'surface-soft', 4.5);
    check('muted', 'surface', 4.5);
    check('on-primary', 'primary', 4.5);
    check('on-primary', 'primary-hover', 4.5);
    check('danger-text', 'surface', 4.5);
  });
}
test('chat disabled controls use readable text rather than opacity reduction', () => {
  const chat = readFileSync(resolve(import.meta.dirname,
    '../pc-rescues/src/routes/chats/+page.svelte'), 'utf8');
  assert.match(chat, /\.chat-layout button:disabled\{opacity:1;color:var\(--rh-muted\);/);
});
