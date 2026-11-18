'use strict';
// M36 (#1299, N11): the CPU history loads its window once and then follows the live state. Each render appends the
// current cpu_percent state as a point and trims points older than the window; a full history/history_during_period
// runs again only for a new period, after a reconnect or after a gap. No history/stream. Real core, testkit hass with
// counters and virtual time.
const test = require('node:test'), assert = require('node:assert/strict');
const { createClock, createHass } = require('./_testkit.cjs');
const { ladeKarte } = require('./laden.js');

const CPU = 'sensor.tower_cpu', TAKT = 30000, ABRUF = 'history/history_during_period';
const SERVER = { id: 'srv', name: 'Tower', name_by_user: null, model: 'Unraid', manufacturer: 'Lime Technology', config_entries: ['e1'], via_device_id: null, area_id: null, labels: [] };
const EINTRAG = { entity_id: CPU, unique_id: 'e1_cpu_percent', platform: 'unraid_ssh', config_entry_id: 'e1', device_id: 'srv', disabled_by: null, hidden_by: null, entity_category: null, labels: [], area_id: null };

/** Testkit hass with a server-side recorder: every state change lands in the history the handler answers from.
 *  setState, not patchState: patchState keeps the old last_updated. */
function umgebung() {
  const clock = createClock(), verlauf = [];
  for (let i = 20; i >= 1; i--) verlauf.push({ s: String(10 + i), lu: (clock.now - i * TAKT) / 1000 });
  const ctrl = createHass({ clock, language: 'de', states: { [CPU]: { state: '50' } }, devices: { srv: SERVER }, entities: { [CPU]: EINTRAG } });
  verlauf.push({ s: '50', lu: clock.now / 1000 });
  ctrl.respond(ABRUF, msg => ({ [CPU]: verlauf.filter(r => r.lu * 1000 >= Date.parse(msg.start_time)) }));
  const setze = v => { ctrl.setState(CPU, { state: String(v) }); verlauf.push({ s: String(v), lu: clock.now / 1000 }); return ctrl.hass; };
  const lib = ladeKarte(['BuschUnraidCpuCard'], { Date: clock.Date, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, setInterval: clock.setInterval, clearInterval: clock.clearInterval, performance });
  return { clock, ctrl, setze, lib };
}

async function karte(u, config = { device_id: 'srv' }) {
  const k = new u.lib.BuschUnraidCpuCard(); k.isConnected = true; k.setConfig(config); k.hass = u.ctrl.hass;
  await k._core.ready; await u.clock.advance(0); k.hass = u.ctrl.hass; await u.clock.advance(0);
  assert.ok(k._linie?.punkte?.length > 1, 'line loaded');
  return k;
}

/** Last point of the line equals the current state (time and value), also in the drawn SVG path. */
function letzterPunktIstZustand(u, k) {
  const zustand = u.ctrl.hass.states[CPU], letzter = k._linie.punkte.at(-1);
  assert.deepEqual({ t: letzter.t, v: letzter.v }, { t: Date.parse(zustand.last_updated), v: Number(zustand.state) });
  const d = k.shadowRoot.querySelector('.history').childNodes[0].childNodes[0].getAttribute('d');
  assert.ok(d.endsWith(`L100.00,${(30 - Number(zustand.state) * 0.3).toFixed(2)}`), d);
}

const wert = i => 20 + (i % 7) * 5;

test('M36: 10 min sichtbare Karte → genau ein history_during_period, letzter Punkt = Zustand, alte Punkte abgeschnitten', async () => {
  const u = umgebung(), k = await karte(u);
  for (let i = 1; i <= 20; i++) { await u.clock.advance(TAKT); k.hass = u.setze(wert(i)); await u.clock.advance(0); }
  assert.equal(u.ctrl.count(ABRUF), 1);
  assert.equal(u.ctrl.count('history/stream'), 0, 'no history/stream');
  letzterPunktIstZustand(u, k);
  const punkte = k._linie.punkte, grenze = u.clock.now - 10 * 60000;
  assert.ok(punkte.every(p => p.t >= grenze), 'no point before the window');
  assert.equal(punkte.length, 21, 'window start point plus 20 live points');
});

test('M36: Reconnect → neuer Vollabruf, danach wieder live', async () => {
  const u = umgebung(), k = await karte(u);
  for (let i = 1; i <= 3; i++) { await u.clock.advance(TAKT); k.hass = u.setze(wert(i)); await u.clock.advance(0); }
  assert.equal(u.ctrl.count(ABRUF), 1);
  u.ctrl.reconnect(); await u.clock.advance(TAKT); k.hass = u.setze(33); await u.clock.advance(0);
  assert.equal(u.ctrl.count(ABRUF), 2, 'reconnect loads the window again');
  letzterPunktIstZustand(u, k);
  for (let i = 1; i <= 3; i++) { await u.clock.advance(TAKT); k.hass = u.setze(wert(i)); await u.clock.advance(0); }
  assert.equal(u.ctrl.count(ABRUF), 2, 'live again after the reload');
  letzterPunktIstZustand(u, k);
});

test('M36: Lücke (Karte unsichtbar, Zustände verpasst) → neuer Vollabruf mit den verpassten Punkten', async () => {
  const u = umgebung(), k = await karte(u);
  await u.clock.advance(TAKT); k.hass = u.setze(41); await u.clock.advance(0);
  k.disconnectedCallback(); k.isConnected = false;
  for (let i = 1; i <= 6; i++) { await u.clock.advance(TAKT); u.setze(60 + i); }
  assert.equal(u.ctrl.count(ABRUF), 1);
  k.isConnected = true; k.connectedCallback(); await u.clock.advance(TAKT); k.hass = u.setze(77); await u.clock.advance(0);
  assert.equal(u.ctrl.count(ABRUF), 2, 'gap loads the window again');
  assert.deepEqual(k._linie.punkte.slice(-7).map(p => p.v), [61, 62, 63, 64, 65, 66, 77], 'missed points from the server');
  letzterPunktIstZustand(u, k);
});

test('M36: Fensterwechsel → neuer Vollabruf mit dem neuen Zeitraum', async () => {
  const u = umgebung(), k = await karte(u);
  await u.clock.advance(TAKT); k.hass = u.setze(44); await u.clock.advance(0);
  k.setConfig({ device_id: 'srv', history_minutes: '30' }); await u.clock.advance(0);
  assert.equal(u.ctrl.count(ABRUF), 2);
  const letzte = u.ctrl.log.filter(e => e.type === ABRUF).at(-1);
  assert.equal(Math.round((u.clock.now - Date.parse(letzte.message.start_time)) / 60000), 30);
});
