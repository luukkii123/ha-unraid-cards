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

/* Befund 3: Server nicht verfügbar, Parität unbekannt, VM-Zustand nicht verfügbar */
function ausgefallen() { const c = unraidAttrappe(); c.entities.get('sensor.tower_cpu').state = 'unavailable'; c.entities.get('sensor.tower_array').state = 'unavailable'; return c; }
test('Server nicht verfügbar: Kopf bleibt, Inhalt „Nicht verfügbar“', () => {
  const { unraidServer, BuschUnraidSystemCard, BuschUnraidGpuCard } = ladeKarte(['unraidServer', 'BuschUnraidSystemCard', 'BuschUnraidGpuCard']);
  assert.equal(unraidServer(unraidAttrappe(), {}).verfuegbar, true); assert.equal(unraidServer(unraidAttrappe({ ausfall: true }), {}).verfuegbar, true, 'nur CPU weg: noch verfügbar');
  assert.equal(unraidServer(ausgefallen(), {}).verfuegbar, false);
  for (const K of [BuschUnraidSystemCard, BuschUnraidGpuCard]) { const k = rendere(K, ausgefallen()); assert.ok(k.shadowRoot.querySelector('.tile-title').textContent); assert.equal(k.shadowRoot.querySelector('.tile-body').textContent, 'Nicht verfügbar'); }
});
test('Parität: parity_running nicht verfügbar → „Unbekannt“, nicht „Keine Prüfung aktiv“', () => {
  const { BuschUnraidParityCard } = ladeKarte(['BuschUnraidParityCard']); const c = unraidAttrappe({ parity: true }); c.entities.get('binary_sensor.tower_parity_running').state = 'unavailable';
  const k = rendere(BuschUnraidParityCard, c), txt = k.shadowRoot.textContent; assert.doesNotMatch(txt, /Keine Prüfung aktiv/); assert.match(txt, /Unbekannt/);
  assert.ok(k.shadowRoot.querySelector(".sem-unknown"));
});
test('VM-Nutzung und VM-Liste: VM-Zustand nicht verfügbar → kein „Keine laufenden VMs“', () => {
  const { BuschUnraidVmUsageCard, BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmUsageCard', 'BuschUnraidVmCard']);
  const c = unraidAttrappe(); c.entities.get('sensor.win_state').state = 'unavailable'; c.entities.get('switch.win').state = 'unavailable';
  const u = rendere(BuschUnraidVmUsageCard, c).shadowRoot.textContent; assert.doesNotMatch(u, /Keine laufenden VMs/); assert.match(u, /Nicht verfügbar/);
  const l = rendere(BuschUnraidVmCard, c, { device_id: 'srv' }).shadowRoot.textContent; assert.doesNotMatch(l, /Keine laufenden VMs/); assert.match(l, /Nicht verfügbar/);
});

/* Befund 4: vor dem Registerladen kein falscher Leerzustand */
function ohneRegister() { const c = unraidAttrappe({ parity: false }); for (const e of c.entities.values()) { e.config_entry_id = undefined; e.registry = { entity_id: e.entity_id, platform: 'unraid_ssh', device_id: e.device_id }; } return c; }
test('vor dem Registerladen zeigen Kacheln „Wird geladen“ statt Leerzuständen', () => {
  const n = ['BuschUnraidGpuCard', 'BuschUnraidArrayCard', 'BuschUnraidAirflowCard', 'BuschUnraidParityCard', 'BuschUnraidSharesCard'], K = ladeKarte(n);
  for (const name of n) { const txt = rendere(K[name], ohneRegister()).shadowRoot.textContent; assert.match(txt, /Wird geladen/, name); assert.doesNotMatch(txt, /Keine/, name); }
  const c = ohneRegister(); c.lastErrors = new Map([['entity', new Error('x')]]); assert.doesNotMatch(rendere(K.BuschUnraidGpuCard, c).shadowRoot.textContent, /Wird geladen/, 'Registerfehler: kein ewiges Laden');
});
test('VM-Karte mit device_id vor der Kern-Ladung: Ladezustand statt Einzelpfad', () => {
  const { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard']); const k = new BuschUnraidVmCard(); k._hass = { locale: { language: 'de' } }; k.setConfig({ device_id: 'srv' }); k._render();
  assert.match(k.shadowRoot.textContent, /Wird geladen/); assert.doesNotMatch(k.shadowRoot.textContent, /Kein passendes Unraid-Gerät/);
});

