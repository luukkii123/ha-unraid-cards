'use strict';
// M26 (#1317, W2/E6): text colours of buttons, badges, error text and the danger menu item reach 4.5:1 in the light and dark
// theme values the render scripts use (THEMA_CSS of regeln.py). Computed from the declared CSS (color-mix in srgb), the same
// formula as hacs/scripts/kontrast_touch.py; the final render run measures it in the browser (docs/render/anzeige.py).
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');

const K = ladeKarte(['BUSCH_UNRAID_STYLE', 'UNRAID_CONFIRM_STYLE', 'BUSCH_UNRAID_DOCKER_MENU_STYLE', 'BUSCH_UNRAID_DOCKER_STYLE', 'UNRAID_TILE_STYLE', 'BuschUI']);
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

// Etappe H follow-up (#1312): the status line of a Docker tile with its menu open (12 % primary over the card, also on a
// child tile with 6 %) and on hover (5 % text colour) reaches 4.5:1; it was 4.29:1 in light.
test('M26 Docker tile status text reaches 4.5:1 on the open-menu, child and hover surfaces', () => {
  const D = K.BUSCH_UNRAID_DOCKER_STYLE, fg = wert(regel(D, '.tile-status'), 'color');
  const misch = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
  for (const [name, t] of Object.entries(THEMA)) {
    const text = farbe(fg, t, D), karte = hex(t['card-background-color']), blau = hex(t['primary-color']);
    const flaechen = { offen: misch(blau, karte, 0.12), kind_offen: misch(blau, misch(blau, karte, 0.06), 0.12), hover: misch(hex(t['primary-text-color']), karte, 0.05), karte };
    for (const [f, bg] of Object.entries(flaechen)) { const q = quote(text, bg); assert.ok(q >= 4.5, `tile-status ${f} ${name}: ${q.toFixed(2)}:1`); }
  }
});

// M79 (#1322): the render runs draw real MDI glyphs now and kontrast_touch measures them as non-text contrast (WCAG
// 1.4.11, 3:1). Grey icons (secondary text colour) reach 3:1 on every surface they sit on, in light and dark.
test('M79 grey icons reach 3:1 on their surfaces (menu item and hover, neutral state, state block, notice)', () => {
  const S = K.BUSCH_UNRAID_STYLE, M = K.BUSCH_UNRAID_DOCKER_MENU_STYLE, D = K.BUSCH_UNRAID_DOCKER_STYLE;
  const misch = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
  for (const [name, t] of Object.entries(THEMA)) {
    const karte = hex(t['card-background-color']), grau2 = hex(t['secondary-background-color']);
    const faelle = [
      [M, '.item ha-icon', { karte, hover: misch(hex(t['primary-text-color']), karte, 0.07) }],
      [D, '.sem-neutral ha-icon,.sem-unknown ha-icon', { karte }],
      [S, '.busch-state-icon', { karte }],
      [S, ':where(.busch-notice-icon)', { notiz: grau2 }],
    ];
    for (const [css, sel, flaechen] of faelle) {
      const fg = farbe(wert(regel(css, sel), 'color'), t, css);
      for (const [f, bg] of Object.entries(flaechen)) { const q = quote(fg, bg); assert.ok(q >= 3, `${sel} ${f} ${name}: ${q.toFixed(2)}:1`); }
    }
  }
});

// M79 (#1320, user decision 19.11.): coloured icons are non-text graphics too and reach 3:1 on every surface they sit on,
// light and dark, also next to a text. Status/theme colour mixed with the text colour like the texts (60 %).
test('M79 coloured icons reach 3:1 on their surfaces (card/row/tile icon, badge, Docker status, danger menu item, status dots)', () => {
  const S = K.BUSCH_UNRAID_STYLE, M = K.BUSCH_UNRAID_DOCKER_MENU_STYLE, D = K.BUSCH_UNRAID_DOCKER_STYLE, T = K.UNRAID_TILE_STYLE;
  const misch = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
  const faelle = [];
  for (const [name, t] of Object.entries(THEMA)) {
    const karte = hex(t['card-background-color']), blau = hex(t['primary-color']), text = hex(t['primary-text-color']);
    const kachel = { karte, offen: misch(blau, karte, 0.12), kind: misch(blau, karte, 0.06), kind_offen: misch(blau, misch(blau, karte, 0.06), 0.12), hover: misch(text, karte, 0.05) };
    const liste = [
      [S, '.card-icon,.row-icon', { grau: hex(t['secondary-background-color']) }],
      [D, '.tile-main .tile-icon', { grau: hex(t['secondary-background-color']) }],
      [S, '.status-warning>ha-icon', { badge: farbe(wert(regel(S, '.status-warning'), 'background'), t, S) }],
      [D, '.sem-success ha-icon', kachel], [D, '.sem-warning ha-icon', kachel], [D, '.sem-error ha-icon,.sem-unavailable ha-icon', kachel],
      [M, '.item.danger ha-icon', { karte, hover: misch(text, karte, 0.07) }],
      // Status dots (aria-hidden next to the status text): the badge dot and the value-grid dot.
      [S, '.status-success::before', { badge: farbe(wert(regel(S, '.status-success'), 'background'), t, S) }, 'background'],
      [S, '.status-warning::before', { badge: farbe(wert(regel(S, '.status-warning'), 'background'), t, S) }, 'background'],
      [S, '.status-error::before,.status-unavailable::before', { badge: farbe(wert(regel(S, '.status-error,.status-unavailable'), 'background'), t, S) }, 'background'],
      [T, '.dot.sem-ok', { karte }, 'background'], [T, '.dot.sem-warning', { karte }, 'background'], [T, '.dot.sem-error', { karte }, 'background'],
    ];
    for (const [css, sel, flaechen, prop = 'color'] of liste) {
      const fg = farbe(wert(regel(css, sel), prop), t, css);
      for (const [f, bg] of Object.entries(flaechen)) { const q = quote(fg, bg); faelle.push(`${sel} ${f} ${name}: ${q.toFixed(2)}:1`); assert.ok(q >= 3, faelle.at(-1)); }
    }
  }
  assert.equal(faelle.length, 52);
});

// #1320 (Etappe I, Kontrast-Rest, user decision: no exception for graphics): information-carrying graphics reach 3:1 in
// light and dark (WCAG 1.4.11): the bar and ring fill (normal, warning, critical) against the card and against its own track,
// the CPU history line and the native progress bars (accent colour) against the card. The track itself is the 100 % frame;
// the value stays readable next to it (bar text, ring value), so only the fill carries the amount.
test('#1320 bar and ring fills, the CPU history line and progress bars reach 3:1 on the card and the fills on their track', () => {
  const S = K.BUSCH_UNRAID_STYLE, T = K.UNRAID_TILE_STYLE, faelle = [];
  const DIVIDER = { light: '#e0e0e0', dark: '#474747' };
  for (const [name, basis] of Object.entries(THEMA)) {
    const t = { ...basis, 'divider-color': DIVIDER[name] }, karte = hex(t['card-background-color']);
    const spur = farbe(wert(regel(T, '.bar-track'), 'background'), t, T), ring = farbe(wert(regel(T, '.ring-bg'), 'stroke'), t, T);
    const liste = [
      ['.bar-fill', 'background', { karte, spur }], ['.bar.warn .bar-fill', 'background', { karte, spur }], ['.bar.crit .bar-fill', 'background', { karte, spur }],
      ['.ring-fg', 'stroke', { karte, spur: ring }], ['.ring.warn .ring-fg', 'stroke', { karte, spur: ring }], ['.ring.crit .ring-fg', 'stroke', { karte, spur: ring }],
      ['.line path', 'stroke', { karte }], ['.metric progress', 'accent-color', { karte }],
    ];
    for (const [sel, prop, flaechen] of liste) {
      const fg = farbe(wert(regel(T, sel), prop), t, T);
      for (const [f, bg] of Object.entries(flaechen)) { const q = quote(fg, bg); faelle.push(`${sel} ${f} ${name}: ${q.toFixed(2)}:1`); assert.ok(q >= 3, faelle.at(-1)); }
    }
    const nackt = S.match(/\}progress\{([^}]*)\}/); assert.ok(nackt, 'plain progress rule');
    const q = quote(farbe(wert(nackt[1], 'accent-color'), t, S), karte); faelle.push(`progress karte ${name}: ${q.toFixed(2)}:1`); assert.ok(q >= 3, faelle.at(-1));
  }
  assert.equal(faelle.length, 30);
});
