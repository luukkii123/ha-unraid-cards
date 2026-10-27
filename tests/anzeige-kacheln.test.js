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

// ── Schritt 6: _kompakt je Kachel (nur Datenfunktion aus dem fertigen Modell) ──
const { dashboardFixture } = require('./familie-attrappe.js');
function kompakt(art, fixture, config = {}) {
  const k = new l[KARTEN[art][0]](); k._core = fixture; k._hass = { locale: { language: 'de' } }; k.setConfig(config);
  const m = k._modell(k._core, k._config); return k._kompakt(m, k._texte.de);
}
const werte = o => Object.fromEntries(Object.entries(o).map(([id, w]) => [id, Array.isArray(w) ? w.map(x => [x.label, x.wert]) : w === null ? null : w.semantik ? [w.wert, w.semantik] : w.wert]));
test('_kompakt: Werte aus dem Fixture, Schlüssel = kompakte Katalog-IDs', () => {
  const kompakteIds = art => l.UNRAID_ANZEIGE[art].filter(e => e.kompakt).map(e => e.id).sort();
  const faelle = {
    server: [unraidAttrappe(), { uptime: '6 Tage, 17 Stunden, 55 Minuten', array: ['Gestartet', 'ok'], mover: 'ruht' }],
    system: [unraidAttrappe(), { ram: '67 %' }],
    cpu: [unraidAttrappe(), { load_average: '3,2', load: '24 %', power: null }],
    gpu: [unraidAttrappe(), { util: '19 %', vram: '9 %', temperature: '52 °C', power: '78 W', fan: '31 %' }],
    array: [dashboardFixture(), { array: '50 %', pools: [['fast-storage-with-a-long-descriptive-name', '25 %']], boot: null }],
    parity: [dashboardFixture(), { state: ['Prüfung pausiert', 'warning'], progress: '25,0 %', errors: '0' }],
    airflow: [unraidAttrappe(), { summary: '2' }],
    shares: [dashboardFixture(), { summary: '1' }],
    'vm-usage': [dashboardFixture(), { summary: '1' }],
    interface: [dashboardFixture(), {}],
    users: [inventoryFixture(), { summary: '3 (1 ohne gesetztes Kennwort)' }],
    usb: [inventoryFixture(), { summary: String(inventoryFixture().entities.get('sensor.demo_dashboard_usb').state) }],
    coral: [inventoryFixture(), { summary: '3' }],
  };
  for (const [art, [fixture, erwartet]] of Object.entries(faelle)) {
    const k = kompakt(art, fixture), w = werte(k);
    assert.deepEqual(Object.keys(k).sort(), kompakteIds(art), art);
    for (const [id, wert] of Object.entries(erwartet)) assert.deepEqual(w[id], wert, `${art}.${id}`);
  }
  // Temperaturen: Zahl samt Einheit (Warnstufe folgt mit #643/5)
  assert.match([].concat(werte(kompakt('cpu', unraidAttrappe())).temperature).join(' '), /^89 °C/);
  assert.match([].concat(werte(kompakt('system', unraidAttrappe())).temperatures).join(' '), /^89 °C/);
});
test('_kompakt: nicht verfügbare Werte sind null; Laden/Fehler liefern nichts', () => {
  const core = unraidAttrappe(); for (const id of ['sensor.tower_cpu_temp', 'sensor.gpu_fan', 'binary_sensor.tower_mover']) { const e = core.entities.get(id); e.state = 'unavailable'; if (e.stateObject) e.stateObject.state = 'unavailable'; }
  assert.equal(kompakt('cpu', core).temperature, null); assert.equal(kompakt('system', core).temperatures, null);
  assert.equal(kompakt('gpu', core).fan, null); assert.equal(kompakt('server', core).mover, null);
  const zwei = unraidAttrappe({ zweiterServer: true });
  for (const art of Object.keys(KARTEN)) assert.deepEqual(kompakt(art, zwei), {}, art);
  // Parität ohne Lauf: kein Fortschritt
  assert.equal(kompakt('parity', unraidAttrappe()).progress, null);
});
test('_kompakt: mehrere GPUs bekommen den Index ins Label [A-4]', () => {
  const core = dashboardFixture(); core.add('gpu_util_1', 70);
  const k = kompakt('gpu', core); assert.deepEqual(k.util.map(x => [x.label, x.wert]), [['GPU 0', '10 %'], ['GPU 1', '70 %']]);
  assert.deepEqual(k.temperature.map(x => [x.label, x.wert]), [['Temp. 0', '40 °C']], 'fehlender Wert der zweiten GPU fällt weg');
});
