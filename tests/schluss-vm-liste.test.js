"use strict";
// Schluss-Nachbesserung nach dem Gesamtreview (#564, Befunde 2–9 und Kleinigkeiten).
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { dokument } = require('./dom-attrappe.js');
function rendere(Klasse, core, config = {}) { const k = new Klasse(); k._core = core; k._hass = { locale: { language: 'de' }, callService: async () => {} }; k.setConfig(config); k._render(); return k; }
const karte = k => k.shadowRoot.childNodes[1];
// Attrappe mit watchDevice: merkt sich die beobachteten Geräte und ihre Rückrufe.
function mitWatch(core) { core.beobachtet = new Map(); core.watchDevice = (id, fn) => { core.beobachtet.set(id, fn); return () => { if (core.beobachtet.get(id) === fn) core.beobachtet.delete(id); }; }; return core; }
function verbunden(Klasse, core, config = {}) { const k = new Klasse(); k._core = core; k._release = () => {}; k._hass = { locale: { language: 'de' }, states: {}, callService: async () => {} }; k.isConnected = true; k.setConfig(config); k._render(); return k; }

/* Befund 7: show_restart im Listenmodus */
test('VM-Editor: show_restart im Listenmodus frei, nur gesperrt ohne Restart-Button', () => {
  const { buschUnraidSchema } = ladeKarte(['buschUnraidSchema']); const c = unraidAttrappe({ zweiteVm: true });
  const f = (core, cfg) => buschUnraidSchema(core, cfg, 'vm').find(x => x.name === 'show_restart');
  assert.equal(!!f(c, { device_id: 'srv' }).disabled, false); assert.equal(!!f(c, {}).disabled, false);
  const ohne = unraidAttrappe(); ohne.entities.delete('button.win_restart'); const alt = ohne.getDeviceEntities; ohne.getDeviceEntities = id => alt(id).filter(e => e.entity_id !== 'button.win_restart');
  assert.equal(f(ohne, { device_id: 'srv' }).disabled, true);
  assert.equal(!!f(c, { device_id: 'vm1' }).disabled, false, 'Einzel-VM wie bisher');
});

/* Befund 9: VM-Liste einklappen */
test('VM-Liste: Einklappen gemerkt unter unraid-cards:vm:<device_id>:<title>', () => {
  const speicher = new Map(); const { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard'], { localStorage: { getItem: k => speicher.get(k) ?? null, setItem: (k, v) => speicher.set(k, String(v)) } });
  const k = rendere(BuschUnraidVmCard, unraidAttrappe(), { device_id: 'srv', title: 'Gäste' }); const t = k.shadowRoot.querySelector('[data-focus-key="toggle"]');
  assert.equal(t.getAttribute('aria-expanded'), 'true'); t.click(); assert.equal(speicher.get('unraid-cards:vm:srv:Gäste'), '1');
  assert.equal(k.shadowRoot.querySelectorAll('.vm-row').length, 0); assert.equal(k.getCardSize(), 1);
  const k2 = rendere(BuschUnraidVmCard, unraidAttrappe(), { device_id: 'srv', title: 'Gäste' }); assert.equal(k2.shadowRoot.querySelector('[data-focus-key="toggle"]').getAttribute('aria-expanded'), 'false');
});

/* Kleinigkeiten (R21) */
test('Kacheln: Geräteselektor einheitlich mit filter', () => {
  const { UNRAID_KACHELN } = ladeKarte(['UNRAID_KACHELN']);
  for (const [tag, , Editor] of UNRAID_KACHELN) assert.deepEqual(JSON.parse(JSON.stringify(new Editor()._schema.find(f => f.name === 'device_id').selector)), { device: { filter: [{ integration: 'unraid_ssh', model: 'Unraid' }] } }, tag);
});
test('Titel tragen den vollen Text als title (Kachel, Familie, VM-Liste)', () => {
  const { BuschUnraidCpuCard, BuschUnraidVmCard } = ladeKarte(['BuschUnraidCpuCard', 'BuschUnraidVmCard']);
  const a = rendere(BuschUnraidCpuCard, unraidAttrappe(), { title: 'Sehr langer Titel' }).shadowRoot.querySelector('.tile-title'); assert.equal(a.title, 'Sehr langer Titel');
  const l = rendere(BuschUnraidVmCard, unraidAttrappe(), { device_id: 'srv' }).shadowRoot.querySelector('.tile-title'); assert.equal(l.title, 'Virtuelle Maschinen');
  const e = rendere(BuschUnraidVmCard, unraidAttrappe(), { device_id: 'vm1' }).shadowRoot.querySelector('.tile-title'); assert.equal(e.title, e.textContent);
});
test('Airflow: Einzahl „1 Lüfter“ über count_one', () => {
  const { BuschUnraidAirflowCard, TEXTE_BUSCH_UNRAID_AIRFLOW_CARD: T } = ladeKarte(['BuschUnraidAirflowCard', 'TEXTE_BUSCH_UNRAID_AIRFLOW_CARD']);
  for (const l of ['de', 'en']) assert.ok(T[l].count_one && T[l].count_many, l);
  const c = unraidAttrappe(); const alt = c.getDeviceEntities; c.getDeviceEntities = id => alt(id).filter(e => !['sensor.fan4'].includes(e.entity_id));
  assert.equal(rendere(BuschUnraidAirflowCard, c).shadowRoot.querySelector('.tile-sub').textContent, '1 Lüfter');
  assert.equal(rendere(BuschUnraidAirflowCard, unraidAttrappe()).shadowRoot.querySelector('.tile-sub').textContent, '2 Lüfter');
});
test('Scrim-Farbe über Theme-Variable', () => {
  const { UNRAID_CONFIRM_STYLE } = ladeKarte(['UNRAID_CONFIRM_STYLE']); assert.match(UNRAID_CONFIRM_STYLE, /\.scrim\{[^}]*background:var\(--mdc-dialog-scrim-color,rgba\(0,0,0,\.32\)\)/);
});
test('Docker: Kopf-Icon ohne Kasten, eigene Klasse statt .tile-icon', () => {
  const { BuschUnraidDockerCard, UNRAID_FAMILIE_STYLE } = ladeKarte(['BuschUnraidDockerCard', 'UNRAID_FAMILIE_STYLE']);
  const k = new BuschUnraidDockerCard(); k._core = unraidAttrappe(); k._hass = { locale: { language: 'de' } }; k.setConfig({}); k._render();
  const icon = k.shadowRoot.querySelector('.header').childNodes[0]; assert.ok(String(icon.className).split(' ').includes('head-icon')); assert.ok(!String(icon.className).split(' ').includes('tile-icon'));
  assert.match(UNRAID_FAMILIE_STYLE, /\.header>\.card-icon\.head-icon\{[^}]*background:none/);
});
