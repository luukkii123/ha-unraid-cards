'use strict';
// M26 (#1317, W2/E6): text colours of buttons, badges, error text and the danger menu item reach 4.5:1 in the light and dark
// theme values the render scripts use (THEMA_CSS of regeln.py). Computed from the declared CSS (color-mix in srgb), the same
// formula as hacs/scripts/kontrast_touch.py; the final render run measures it in the browser (docs/render/anzeige.py).
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');

const K = ladeKarte(['BUSCH_UNRAID_STYLE', 'UNRAID_CONFIRM_STYLE', 'BUSCH_UNRAID_DOCKER_MENU_STYLE', 'BuschUI']);
const THEMA = {
  light: { 'primary-color': '#03a9f4', 'primary-text-color': '#212121', 'secondary-text-color': '#727272', 'card-background-color': '#ffffff', 'secondary-background-color': '#e5e5e5', 'error-color': '#db4437', 'success-color': '#43a047', 'warning-color': '#ffa600', 'text-primary-color': '#ffffff' },
  dark: { 'primary-color': '#03a9f4', 'primary-text-color': '#e1e1e1', 'secondary-text-color': '#9b9b9b', 'card-background-color': '#1c1c1c', 'secondary-background-color': '#202020', 'error-color': '#db4437', 'success-color': '#43a047', 'warning-color': '#ffa600', 'text-primary-color': '#212121' },
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function farbe(wert, t, css) {
  wert = wert.trim();
  let m = wert.match(/^var\(--([\w-]+)(?:,[^()]*)?\)$/);
  if (m) { if (t[m[1]]) return hex(t[m[1]]); const def = css.match(new RegExp('--' + m[1] + ':(color-mix\\([^;}]*\\)\\)|[^;}]*)'))?.[1]; assert.ok(def, 'unknown token ' + m[1]); return farbe(def, t, css); }
  m = wert.match(/^color-mix\(in srgb,(var\([^()]*\)) (\d+)%,(var\([^()]*\))\)$/);
  if (m) { const a = farbe(m[1], t, css), b = farbe(m[3], t, css), p = Number(m[2]) / 100; return a.map((v, i) => v * p + b[i] * (1 - p)); }
  if (/^#[0-9a-f]{6}$/i.test(wert)) return hex(wert);
  throw new Error('colour not understood: ' + wert);
}
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const quote = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const regel = (css, sel) => { const i = css.indexOf(sel + '{'); assert.ok(i >= 0, 'rule ' + sel); return css.slice(i + sel.length + 1, css.indexOf('}', i)); };
const wert = (block, prop) => block.match(new RegExp('(?:^|;)' + prop + ':((?:color-mix\\([^;]*\\)\\))|[^;]*)'))?.[1];

test('M26 Unraid text colours reach 4.5:1 in light and dark (buttons, badges, error text, danger menu item)', () => {
  const S = K.BUSCH_UNRAID_STYLE, M = K.BUSCH_UNRAID_DOCKER_MENU_STYLE, B = K.BuschUI.styles;
  const faelle = [
    // [css, rule, background (rule property or token)]
    // Button variants come from Shared UI 0.5.0 (BuschUI.styles, in the cards and the confirmation dialog).
    [B, ':where(.busch-btn[data-variant=primary])', 'background'],
    [B, ':where(.busch-btn[data-variant=destructive][data-filled]),:where(.busch-btn[data-variant=danger][data-filled])', 'background'],
    [B, ':where(.busch-btn[data-variant=destructive]),:where(.busch-btn[data-variant=danger])', 'var(--card-background-color)'],
    [S, '.status-success', 'background'], [S, '.status-error,.status-unavailable', 'background'], [S, '.status-neutral,.status-unknown', 'var(--secondary-background-color)'],
    [S, '.error', 'var(--card-background-color)'], [M, '.item.danger', 'var(--card-background-color)'],
  ];
  for (const [css, sel, grund] of faelle) for (const [name, t] of Object.entries(THEMA)) {
    const block = regel(css, sel), fg = farbe(wert(block, 'color'), t, css), bg = farbe(grund === 'background' ? wert(block, 'background') : grund, t, css);
    const q = quote(fg, bg); assert.ok(q >= 4.5, `${sel} ${name}: ${q.toFixed(2)}:1`);
  }
});

test('M26 the button colours come from Shared UI only: no own busch-btn variant rule in the cards or the confirmation dialog', () => {
  for (const [name, css] of [['BUSCH_UNRAID_STYLE', K.BUSCH_UNRAID_STYLE], ['UNRAID_CONFIRM_STYLE', K.UNRAID_CONFIRM_STYLE]]) {
    const eigen = css.replace(K.BuschUI.cardStyles, '').replace(K.BuschUI.styles, '');
    assert.doesNotMatch(eigen, /\.busch-btn\[data-variant=(primary|destructive|danger)\][^{]*\{/, name + ': own button variant rule');
  }
  assert.ok(K.UNRAID_CONFIRM_STYLE.includes(K.BuschUI.styles), 'confirmation dialog carries the shared button styles');
});
