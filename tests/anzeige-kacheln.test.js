"use strict";
// #642 Phase A, Schritt 5: Abschnitte der 13 Kacheln über visible_items (je Karte: abgewählt fehlt,
// Altschalter = gleiche Ansicht, alles abgewählt = nur Kopf und Aktionen).
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { inventoryFixture } = require('./familie-attrappe.js');
const { festesDatum } = require('./dom-attrappe.js');

const KARTEN = {
  server: ['BuschUnraidServerCard', inventoryFixture], system: ['BuschUnraidSystemCard', inventoryFixture], cpu: ['BuschUnraidCpuCard', inventoryFixture],
  gpu: ['BuschUnraidGpuCard', unraidAttrappe], array: ['BuschUnraidArrayCard', unraidAttrappe], parity: ['BuschUnraidParityCard', inventoryFixture],
  airflow: ['BuschUnraidAirflowCard', unraidAttrappe], shares: ['BuschUnraidSharesCard', inventoryFixture], 'vm-usage': ['BuschUnraidVmUsageCard', inventoryFixture],
  interface: ['BuschUnraidInterfaceCard', inventoryFixture], users: ['BuschUnraidUsersCard', inventoryFixture], usb: ['BuschUnraidUsbCard', inventoryFixture],
  coral: ['BuschUnraidCoralCard', inventoryFixture],
};
const l = ladeKarte(['UNRAID_ANZEIGE', ...Object.values(KARTEN).map(([n]) => n)], { Date: festesDatum('2026-10-23T08:36:00Z') });
function rendere(art, config = {}) {
  const [name, fixture] = KARTEN[art], k = new l[name]();
  // callWS als Attrappe, damit der Verlaufsplatz der CPU-Karte entsteht (Antwort ist für den Vergleich egal).
  k._core = fixture(); k._hass = { locale: { language: 'de' }, callService: async () => {}, callWS: () => new Promise(() => {}) };
  k.setConfig(config); k._render(); return k;
}
const bild = n => `${n.tagName}.${n.className}|${n._text}|${JSON.stringify(n.attributes)}(${n.childNodes.map(bild).join(',')})`;
const body = k => k.shadowRoot.querySelector('.tile-body');
const ids = art => l.UNRAID_ANZEIGE[art].map(e => e.id);
const ohne = (art, id) => ids(art).filter(x => x !== id);

test('Kacheln: Vorgabe und visible_items mit allen IDs zeigen dieselbe Ansicht wie heute', () => {
  for (const art of Object.keys(KARTEN)) assert.equal(bild(rendere(art, { visible_items: ids(art) }).shadowRoot), bild(rendere(art).shadowRoot), art);
});
test('Kacheln: jeder abgewählte Abschnitt verändert die Ansicht (er fehlt)', () => {
  for (const art of Object.keys(KARTEN)) {
    const voll = bild(rendere(art).shadowRoot);
    for (const id of ids(art)) assert.notEqual(bild(rendere(art, { visible_items: ohne(art, id) }).shadowRoot), voll, `${art}: ${id} abgewählt, Ansicht unverändert`);
  }
});
test('Kacheln: alles abgewählt lässt nur Kopf und Aktionen stehen', () => {
  for (const art of Object.keys(KARTEN)) {
    const k = rendere(art, { visible_items: [] });
    assert.equal(body(k).childNodes.length, 0, art + ': Inhalt nicht leer: ' + body(k).textContent);
    assert.ok(k.shadowRoot.querySelector('.tile-title').textContent, art); assert.ok(k.shadowRoot.querySelector('[data-focus-key="toggle"]'), art);
  }
});
test('Kacheln: Altschalter zeigen dieselbe Ansicht wie die neue Auswahl', () => {
  for (const [art, alt, id] of [['server', 'show_clock', 'clock'], ['system', 'show_temperatures', 'temperatures'], ['cpu', 'show_history', 'history'], ['array', 'show_boot', 'boot']]) {
    assert.equal(bild(rendere(art, { [alt]: false }).shadowRoot), bild(rendere(art, { visible_items: ohne(art, id) }).shadowRoot), art);
    assert.equal(bild(rendere(art, { [alt]: true }).shadowRoot), bild(rendere(art).shadowRoot), art);
    // visible_items gilt vor dem Altschalter
    assert.equal(bild(rendere(art, { [alt]: false, visible_items: ids(art) }).shadowRoot), bild(rendere(art).shadowRoot), art);
  }
});
test('Kacheln: gezielte Abschnitte', () => {
  let k = rendere('server', { visible_items: ['uptime', 'mover'] }); const txt = body(k).textContent;
  assert.equal(k.shadowRoot.querySelector('.clock'), null); assert.match(txt, /Laufzeit/); assert.match(txt, /Mover/); assert.doesNotMatch(txt, /Array|Modell|Registrierung/);
  k = rendere('cpu', { visible_items: ['load'] }); assert.ok(k.shadowRoot.querySelector('.bar')); assert.equal(k.shadowRoot.querySelector('.core-details'), null); assert.equal(k.shadowRoot.querySelector('.history'), null); assert.equal(k.shadowRoot.querySelector('table'), null);
  k = rendere('array', { visible_items: ['array', 'pools', 'boot'] }); assert.ok(!k.shadowRoot.querySelectorAll('th').some(th => th.textContent === 'SMART'));
  k = rendere('array', { visible_items: ['boot'] }); assert.deepEqual(k.shadowRoot.querySelectorAll('h3').map(h => h.textContent.split(' · ')[0]), ['Boot']);
  k = rendere('interface', { visible_items: ['rx'] }); assert.deepEqual(k.shadowRoot.querySelectorAll('th').map(th => th.textContent), ['Name', 'Empfang']);
  k = rendere('shares', { visible_items: ['shares'] }); assert.deepEqual(k.shadowRoot.querySelectorAll('th').map(th => th.textContent), ['Name', 'Belegt', 'Frei']);
  k = rendere('users', { visible_items: ['users'] }); assert.deepEqual(k.shadowRoot.querySelectorAll('th').map(th => th.textContent), ['Benutzer', 'Schreiben', 'Lesen']); assert.doesNotMatch(body(k).textContent, /Anzahl SMB-Shares/);
});
test('Kacheln: ohne summary zeigt der Untertitel den Servernamen [A-6]', () => {
  for (const art of ['airflow', 'shares', 'vm-usage', 'users', 'usb', 'coral']) {
    const sub = rendere(art, { visible_items: ohne(art, 'summary') }).shadowRoot.querySelector('.tile-sub').textContent;
    assert.ok(['Tower', 'Example server'].includes(sub), `${art}: ${sub}`);
  }
});
test('Kacheln: Array filtert Boot erst in der Ansicht, das Modell behält die Gruppe', () => {
  const k = rendere('array', { show_boot: false });
  const m = k._modell(k._core, k._config); assert.ok(m.gruppen.some(g => g.art === 2), 'Bootgruppe gehört ins Modell (Kompaktzeile)');
});
test('Kacheln: _anzeige entsteht nur in setConfig', () => {
  const k = rendere('server', { visible_items: ['uptime'] }); const vorher = k._anzeige;
  k._render(); k.hass = k._hass; assert.equal(k._anzeige, vorher);
  k.setConfig({ visible_items: ['mover'] }); assert.notEqual(k._anzeige, vorher); assert.deepEqual([...k._anzeige.sichtbar], ['mover']);
});
