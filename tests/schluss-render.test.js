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

/* Befund 2: nur bei Änderung neu bauen, watchDevice */
test('Kachel: identischer hass baut nicht neu, geänderter Zustand schon', () => {
  const { BuschUnraidCpuCard } = ladeKarte(['BuschUnraidCpuCard']); const core = unraidAttrappe();
  const k = rendere(BuschUnraidCpuCard, core), erst = karte(k), hass = k._hass;
  k.hass = hass; k.hass = hass; assert.equal(karte(k), erst, 'kein zweiter Neuaufbau');
  core.entities.get('sensor.tower_cpu').state = '55'; k.hass = hass;
  assert.notEqual(karte(k), erst, 'geänderter Zustand baut neu'); assert.match(k.shadowRoot.textContent, /55 %/);
});
test('Kachel: beobachtet Server- und Kindgeräte, Rückruf rendert, Trennen räumt ab', () => {
  const { BuschUnraidArrayCard } = ladeKarte(['BuschUnraidArrayCard']); const core = mitWatch(unraidAttrappe());
  const k = verbunden(BuschUnraidArrayCard, core);
  for (const id of ['srv', 'd1', 'p1', 'f1']) assert.ok(core.beobachtet.has(id), id);
  const erst = karte(k); core.entities.get('sensor.disk1_temp').state = '61'; core.beobachtet.get('d1')();
  assert.notEqual(karte(k), erst); assert.match(k.shadowRoot.textContent, /61 °C/);
  k.disconnectedCallback(); assert.equal(core.beobachtet.size, 0);
});
test('VM-Liste: identischer hass baut nicht neu; beobachtet Server und VMs', () => {
  const { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard']); const core = mitWatch(unraidAttrappe({ zweiteVm: true }));
  const k = verbunden(BuschUnraidVmCard, core, { device_id: 'srv' }), erst = karte(k);
  k.hass = k._hass; assert.equal(karte(k), erst);
  for (const id of ['srv', 'vm1', 'vm2']) assert.ok(core.beobachtet.has(id), id);
  core.entities.get('sensor.win_cpu').state = '77'; core.beobachtet.get('vm1')(); assert.match(k.shadowRoot.textContent, /77 %/);
  k.disconnectedCallback(); assert.equal(core.beobachtet.size, 0);
});
test('Server: Signatur enthält die Minute; Uhr-Intervall pausiert bei verstecktem Tab', () => {
  let jetzt = Date.parse('2026-10-23T08:36:10Z'); const intervalle = [];
  class D extends Date { constructor(...a) { if (a.length) super(...a); else super(jetzt); } static now() { return jetzt; } }
  const doc = dokument(); doc.hidden = false;
  const { BuschUnraidServerCard } = ladeKarte(['BuschUnraidServerCard'], { Date: D, document: doc, setInterval: fn => { intervalle.push(fn); return intervalle.length; }, clearInterval() {} });
  const k = rendere(BuschUnraidServerCard, unraidAttrappe()), erst = karte(k);
  jetzt += 20000; k._render(); assert.equal(karte(k), erst, 'gleiche Minute: kein Neuaufbau');
  jetzt += 40000; k._render(); assert.notEqual(karte(k), erst, 'neue Minute: Neuaufbau');
  k.connectedCallback(); const tick = intervalle.at(-1); let n = 0; const alt = k._render.bind(k); k._render = () => { n++; alt(); };
  doc.hidden = true; tick(); assert.equal(n, 0, 'versteckt: kein Render'); doc.hidden = false; tick(); assert.equal(n, 1);
});

