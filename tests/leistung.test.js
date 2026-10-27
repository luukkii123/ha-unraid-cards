'use strict';
// #641: Unraid-Karten rendern bei aktivem Stream nur neu, wenn sich gelesene Geräte, Sprache/Zeitzone oder die
// Konfiguration geändert haben (U1); `kinder` kommt aus dem config_entry_id-Index ohne Container/Stacks (U2/U3).
const test = require('node:test');
const assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');

const ZEIT = '2026-10-27T10:00:00+00:00';
const geraet = (id, name, model, entry, via = 'srv') => ({ id, name, name_by_user: null, model, manufacturer: 'x', config_entries: [entry], via_device_id: via, area_id: null, labels: [] });
const eintrag = (entity_id, device_id, config_entry_id, platform = 'unraid_ssh') => ({ entity_id, unique_id: config_entry_id + '_' + entity_id, platform, config_entry_id, device_id, disabled_by: null, hidden_by: null, entity_category: null, labels: [], area_id: null });
const zustand = (entity_id, state, attributes = {}) => ({ entity_id, state: String(state), attributes, last_changed: ZEIT, last_updated: ZEIT, context: { id: entity_id } });

/** Roher HA-Zustand (states, Register, hass.entities/devices) aus der Unraid-Attrappe plus Container, Stack und fremdem Gerät. */
function rohdaten() {
  const fake = unraidAttrappe({ parity: true, zweiteVm: true, zweiterServer: true });
  const devices = [...fake.devices.values()].map(d => ({ area_id: null, labels: [], ...d }));
  const entities = [...fake.entities.values()].map(e => ({ area_id: null, ...e.registry }));
  const states = {};
  for (const e of fake.entities.values()) if (e.stateObject) states[e.entity_id] = zustand(e.entity_id, e.state, e.attributes);
  // Container und Stack desselben Eintrags (die Kacheln fragen sie nicht ab) und ein fremdes Gerät.
  devices.push(geraet('ct1', 'plex', 'Docker container', 'e1'), geraet('stk1', 'media', 'Compose stack', 'e1'), geraet('fremd', 'Lampe', 'Hue', 'hue1', null));
  entities.push(eintrag('switch.plex', 'ct1', 'e1'), eintrag('switch.media', 'stk1', 'e1'), eintrag('light.fremd', 'fremd', 'hue1', 'hue'));
  states['switch.plex'] = zustand('switch.plex', 'on', { kind: 'container', container_key: 'plex', config_entry_id: 'e1' });
  states['switch.media'] = zustand('switch.media', 'on', { kind: 'stack', stack_key: 'media', config_entry_id: 'e1' });
  states['light.fremd'] = zustand('light.fremd', 'on');
  return { devices, entities, states };
}

/** hass mit (optional) Stream; `aendern` schickt ein state_changed und liefert das neue hass. */
function umgebung({ stream = true } = {}) {
  const roh = rohdaten(), subs = {};
  const listen = { entity: roh.entities, device: roh.devices, area: [], floor: [], label: [] };
  let hass = {
    states: roh.states, entities: Object.fromEntries(roh.entities.map(e => [e.entity_id, e])), devices: Object.fromEntries(roh.devices.map(d => [d.id, d])), areas: {}, floors: {},
    locale: { language: 'de', number_format: 'language', time_format: 'language' }, language: 'de', config: { time_zone: 'Europe/Berlin' }, user: { is_admin: true },
    connection: stream ? { subscribeEvents(cb, type) { subs[type] = cb; return Promise.resolve(() => {}); } } : {},
    async callWS(msg) {
      if (msg.type === 'get_states') return Object.values(hass.states);
      const m = /^config\/(\w+)_registry\/list$/.exec(msg.type); return m ? listen[m[1]] : [];
    },
    callService: async () => {},
  };
  const aendern = (id, state) => {
    const ns = { ...hass.states[id], state: String(state), last_updated: new Date().toISOString() };
    subs.state_changed?.({ data: { entity_id: id, new_state: ns, old_state: hass.states[id] } });
    hass = { ...hass, states: { ...hass.states, [id]: ns } };
    return hass;
  };
  return { get hass() { return hass; }, set hass(v) { hass = v; }, aendern };
}

function lade() {
  return ladeKarte(['ensureBuschCore', 'BuschUnraidArrayCard', 'BuschUnraidVmCard', 'BuschUnraidServerCard', 'BuschUnraidCpuCard', 'unraidServer'], { setTimeout, clearTimeout, performance });
}
const ruhe = () => new Promise(r => setImmediate(r));

/** Verbundene Karte mit Renderzähler; wartet, bis Register und Stream bereit sind. */
async function karte(Klasse, config, u) {
  const k = new Klasse(); k.isConnected = true; k.setConfig(config); k.hass = u.hass;
  await k._core.ready; await ruhe(); await ruhe();
  k.hass = u.hass; // erster Render mit fertigem Index
  const orig = k._render.bind(k); k.renders = 0; k._render = (...a) => { k.renders++; return orig(...a); };
  return k;
}

test('U1: fremde Zustandsänderung baut die Kachel nicht neu, eigene schon', async () => {
  const { BuschUnraidArrayCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidArrayCard, { device_id: 'srv' }, u);
  assert.equal(k._core.streaming, true, 'Stream aktiv');
  k.hass = u.aendern('light.fremd', 'off');
  assert.equal(k.renders, 0, 'fremde Entität: kein Render');
  k.hass = u.aendern('sensor.disk1_temp', 46);
  assert.ok(k.renders >= 1, 'Platte des eigenen Servers: Render');
  const text = k.shadowRoot.textContent; assert.match(text, /46/);
});

test('U1/U3: Container- und Stackänderung baut die Platten-Kachel nicht neu', async () => {
  const { BuschUnraidArrayCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidArrayCard, { device_id: 'srv' }, u);
  k.hass = u.aendern('switch.plex', 'off'); k.hass = u.aendern('switch.media', 'off');
  assert.equal(k.renders, 0);
});

test('U1: Einzel-VM-Karte (Basis-Karte) ignoriert fremde Änderungen', async () => {
  const { BuschUnraidVmCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidVmCard, { device_id: 'vm1' }, u);
  k.hass = u.aendern('light.fremd', 'off');
  assert.equal(k.renders, 0, 'fremde Entität: kein Render');
  k.hass = u.aendern('sensor.win_cpu', 41);
  assert.ok(k.renders >= 1, 'eigene VM: Render');
});

test('U1: Sprachwechsel und Zeitzonenwechsel bauen neu', async () => {
  const { BuschUnraidServerCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidServerCard, { device_id: 'srv' }, u);
  k.hass = { ...u.hass, locale: { ...u.hass.locale, language: 'en' }, language: 'en' };
  assert.equal(k.renders, 1, 'Sprache');
  k.hass = { ...u.hass, locale: k.hass.locale, language: 'en', config: { time_zone: 'UTC' } };
  assert.equal(k.renders, 2, 'Zeitzone');
});

test('U1: ohne Stream wird weiter jedes Mal gerendert', async () => {
  const { BuschUnraidArrayCard } = lade(), u = umgebung({ stream: false });
  const k = await karte(BuschUnraidArrayCard, { device_id: 'srv' }, u);
  assert.ok(!k._core.streaming);
  k.hass = u.aendern('light.fremd', 'off'); k.hass = u.aendern('light.fremd', 'on');
  assert.equal(k.renders, 2);
});

test('U1: nach einem Konfigurationswechsel zählen die Geräte des neuen Servers', async () => {
  const { BuschUnraidArrayCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidArrayCard, { device_id: 'srv' }, u);
  k.setConfig({ device_id: 'srv2' }); k.renders = 0;
  k.hass = u.aendern('sensor.backupdisk_temp', 35);
  assert.ok(k.renders >= 1, 'neuer Server wird verfolgt');
  assert.match(k.shadowRoot.textContent, /35/);
});

test('U2/U3: kinder aus dem Index liefert dieselben Kachelgeräte wie vorher, ohne Container/Stacks', async () => {
  const { ensureBuschCore, unraidServer } = lade(), u = umgebung();
  const core = ensureBuschCore(1); core.attach(u.hass); await core.ready; await ruhe();
  // Referenz: frühere Bestimmung über alle Geräte.
  const alt = (srv, entry) => [...core.devices.values()].filter(d => d.id !== srv && core.getDeviceEntities(d.id).some(e => e?.platform === 'unraid_ssh' && e.config_entry_id === entry));
  for (const [srv, entry] of [['srv', 'e1'], ['srv2', 'e2']]) {
    const s = unraidServer(core, { device_id: srv }), vorher = alt(srv, entry);
    for (const modell of ['Data disk', 'Parity disk', 'Cache disk', 'Boot disk', 'Flash disk', 'Unraid share', 'Virtual machine'])
      assert.deepEqual([...s.geraete(modell).map(d => d.id)].sort(), [...vorher.filter(d => d.model === modell).map(d => d.id)].sort(), `${srv} ${modell}`);
    const erwartet = [srv, ...vorher.filter(d => !['Docker container', 'Compose stack'].includes(d.model)).map(d => d.id)];
    assert.deepEqual([...s.ids].sort(), erwartet.sort(), `${srv}: ids ohne Container/Stacks`);
  }
  // Abfrage über den Index: kein Durchlauf über alle Geräte.
  const ids = new Set(); const orig = core.getDeviceEntities.bind(core); core.getDeviceEntities = id => { ids.add(id); return orig(id); };
  unraidServer(core, { device_id: 'srv' });
  assert.ok(!ids.has('fremd') && !ids.has('ct1') && !ids.has('stk1') && !ids.has('d2'), [...ids].join(','));
  core.dispose();
});

// #642 Phase B: Einklappen muss trotz #641 sofort rendern; die Kompaktzeile liest nichts zusätzlich.
test('Schritt 11: Einklappen rendert sofort, unveränderter hass danach nicht', async () => {
  const { BuschUnraidCpuCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidCpuCard, { device_id: 'srv', collapsed_items: ['load'] }, u);
  k._umschalten();
  assert.ok(k.shadowRoot.querySelector('.compact-line'), 'Kompaktzeile sofort da');
  const n = k.renders; k.hass = u.hass; assert.equal(k.renders, n, 'gleicher hass: kein Render');
  k.hass = u.aendern('sensor.tower_cpu', 55);
  assert.match(k.shadowRoot.querySelector('.compact-line').textContent, /55 %/, 'eigener Wert aktualisiert die Kompaktzeile');
  k._umschalten(); assert.ok(k.shadowRoot.querySelector('.tile-body'), 'Ausklappen sofort');
});
test('Schritt 11: Kompaktzeile verfolgt keine zusätzlichen Geräte', async () => {
  const { BuschUnraidCpuCard, BuschUnraidServerCard } = lade();
  for (const [Klasse, ids] of [[BuschUnraidCpuCard, ['temperature', 'load_average', 'load', 'power']], [BuschUnraidServerCard, ['uptime', 'array', 'mover']]]) {
    const u = umgebung(), offen = await karte(Klasse, { device_id: 'srv' }, u);
    const zu = await karte(Klasse, { device_id: 'srv', title: 'x', collapsed_items: ids }, u);
    zu._umschalten(); zu.hass = u.aendern('sensor.tower_cpu', 12);
    const schluessel = k => k._deps.versions.map(([key]) => key).sort();
    assert.deepEqual(schluessel(zu), schluessel(offen));
    assert.ok(zu.shadowRoot.querySelector('.compact-line'));
  }
});
test('Schritt 13: Einzel-VM klappt trotz Stream sofort ein; unveränderter hass rendert nicht, eigene Änderung schon', async () => {
  const { BuschUnraidVmCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidVmCard, { device_id: 'vm1', collapsed_items: ['cpu'] }, u);
  k._umschalten();
  assert.match(k.shadowRoot.querySelector('.compact-line')?.textContent || '', /36 %/, 'sofort eingeklappt mit Kompaktzeile');
  const n = k.renders; k.hass = u.hass; k.hass = u.aendern('light.fremd', 'off'); assert.equal(k.renders, n, 'gleicher/fremder hass: kein Render');
  k.hass = u.aendern('sensor.win_cpu', 41); assert.match(k.shadowRoot.querySelector('.compact-line').textContent, /41 %/);
  const offen = await karte(BuschUnraidVmCard, { device_id: 'vm1' }, u), keys = x => x._deps.versions.map(([key]) => key).sort();
  k.hass = u.aendern('sensor.win_cpu', 42); offen.hass = u.hass; assert.deepEqual(keys(k), keys(offen), 'keine zusätzlichen Lesungen');
});
test('Schritt 14: VM-Liste klappt trotz Stream sofort ein; unveränderter hass rendert nicht', async () => {
  const { BuschUnraidVmCard } = lade(), u = umgebung();
  const k = await karte(BuschUnraidVmCard, { device_id: 'srv', collapsed_items: ['vms'] }, u);
  k._umschalten(); assert.ok(k.shadowRoot.querySelector('.compact-line'), 'sofort');
  const n = k.renders; k.hass = u.hass; k.hass = u.aendern('light.fremd', 'on'); assert.equal(k.renders, n);
});
