'use strict';
// M62 (#1317, W12): one button component (.busch-btn from BuschUI.styles) for every Unraid action button, no own button
// variants in the family CSS, and the editors use the shared editor primitives (editorStyles, fieldText, validateConfig).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { ladeKarte } = require('./laden.js');
const { inventoryFixture, familienKarte, dockerKarte } = require('./familie-attrappe.js');
const { unraidAttrappe } = require('./attrappe.js');

const KACHELN = ['BuschUnraidServerCard', 'BuschUnraidArrayCard', 'BuschUnraidParityCard', 'BuschUnraidCpuCard', 'BuschUnraidVmCard'];
const K = ladeKarte([...KACHELN, 'BUSCH_UNRAID_STYLE', 'UNRAID_TILE_STYLE', 'BuschUI', 'BuschUnraidArrayCardEditor', 'BuschUnraidStackEditor', 'BuschUnraidVmEditor', 'BuschUnraidDockerEditor']);
function kachel(name, core, config = {}) { const k = new K[name](); k._core = core; k._hass = { locale: { language: 'de' }, user: { is_admin: true }, callService: async () => {} }; k.setConfig({ device_id: 'demo', show_clock: false, ...config }); k._render(); return k; }
// Docker tiles (.tile-main/.tile-toggle) are list surfaces, not buttons in the sense of M62.
const knoepfe = k => k.shadowRoot.querySelectorAll('button').filter(b => !/\btile-(main|toggle)\b/.test(b.className));

test('M62 every action button of tiles, VM list, family and Docker cards is a .busch-btn with a shared variant', () => {
  const karten = [...KACHELN.map(n => kachel(n, inventoryFixture())), kachel('BuschUnraidVmCard', unraidAttrappe(), { device_id: 'srv' }),
    familienKarte('stack', { start_expanded: true }), familienKarte('container'), dockerKarte()];
  const off = unraidAttrappe(); off.entities.get('sensor.tower_cpu').state = 'unavailable'; off.entities.get('sensor.tower_array').state = 'unavailable';
  karten.push(kachel('BuschUnraidArrayCard', off, { device_id: '' }));
  let n = 0;
  for (const k of karten) for (const b of knoepfe(k)) {
    n++;
    assert.match(b.className, /\bbusch-btn\b/, `${b.textContent || b.getAttribute('aria-label')}: busch-btn`);
    assert.doesNotMatch(b.className, /\b(busch-ui-action|danger|quiet)\b/, `${b.className}: no second button look`);
    assert.ok(['primary', 'secondary', 'text', 'destructive', 'danger'].includes(b.getAttribute('data-variant')), `${b.className}: variant ${b.getAttribute('data-variant')}`);
  }
  assert.ok(n >= 20, `buttons checked: ${n}`);
  const stop = knoepfe(familienKarte('container')).find(b => b.textContent === 'Stoppen');
  assert.ok(stop, 'container stop button'); assert.equal(stop.getAttribute('data-variant'), 'danger', 'stop keeps the destructive look');
  const mover = knoepfe(kachel('BuschUnraidServerCard', inventoryFixture())).find(b => b.dataset.focusKey === 'mover_start');
  assert.equal(mover.getAttribute('data-variant'), 'secondary', 'tile header actions are neutral; the confirmation shows the risk');
});

test('M62 the family CSS defines no own button variant and the generic button rule paints nothing', () => {
  for (const css of [K.BUSCH_UNRAID_STYLE, K.UNRAID_TILE_STYLE]) {
    assert.doesNotMatch(css, /\.(danger|quiet)\{/, 'no .danger/.quiet');
    const generisch = css.match(/(?:^|[}\n])button\{([^}]*)\}/)?.[1] ?? '';
    assert.doesNotMatch(generisch, /(^|;)(color|background|border|border-radius|padding|min-height):/, 'generic button: ' + generisch);
  }
});

test('M62 editors take editorStyles, fieldText and validateConfig from shared UI', () => {
  const hass = { locale: { language: 'de' }, states: {} };
  for (const Editor of [K.BuschUnraidArrayCardEditor, K.BuschUnraidStackEditor, K.BuschUnraidVmEditor, K.BuschUnraidDockerEditor]) {
    const e = new Editor(); e._core = { devices: new Map(), entities: new Map(), getDeviceEntities: () => [], retain: () => () => {}, watch: () => () => {}, attach() {} };
    e.setConfig({ title: 'X' }); e._release = () => {}; e.hass = hass;
    const style = e.childNodes.find(n => n.tagName === 'STYLE'); assert.ok(style, Editor.name + ': editor style'); assert.equal(style.textContent, K.BuschUI.editorStyles);
    assert.equal(e._form.computeLabel({ name: 'title' }), 'Titel'); assert.equal(e._form.computeLabel({ name: 'unbekannt_x' }), 'unbekannt_x', 'fieldText falls back to the name');
    assert.match(e._form.computeHelper({ name: 'title' }), /\./);
  }
  const quelle = fs.readFileSync(path.join(__dirname, '../dist/unraid-cards.js'), 'utf8').replace(/\/\* BEGIN BUSCH SHARED UI[\s\S]*?\/\* END BUSCH SHARED UI \*\//, '');
  // Same check as shared-ui/tests/primitives.test.cjs, without the former PRIMITIVE_GAPS entry for unraid-cards.js.
  for (const api of ['header', 'action', 'editorStyles', 'cardStyles', 'language', 'fieldText', 'validateConfig']) assert.match(quelle, new RegExp('BuschUI\\.' + api + '\\b'), api);
});
