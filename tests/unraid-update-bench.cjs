'use strict';
// M49 (#1299, P10/F13) Node bench: ms per own update (a value the card shows changes, then one render) for every
// card kind, plus ha-icon elements created per update and whether the live ha-icon objects survive.
// Usage: node tests/unraid-update-bench.cjs [bundle.js] [runs] [--profil]   (default: dist/unraid-cards.js, 300 runs, 50 warm-up)
// --profil: mean ms per update split into model (core/Unraid model), signature (JSON.stringify called by the render
// itself), merge (unraidAnwenden: DOM patch) and rest (building the fresh tree, dictionaries, focus, other). Exclusive
// times through wrapped bundle functions; the wrappers cost a little, so the profile run is not the p95 run.
// Test DOM (tests/dom-attrappe.js), no browser: the numbers compare old and new bundle on the same machine; the browser
// value (layout, style, ha-icon upgrade) is M6 mode f.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { Element, dokument } = require('./dom-attrappe.js');
const { familienFixture, dockerFixture, dashboardFixture, inventoryFixture } = require('./familie-attrappe.js');
const { unraidAttrappe } = require('./attrappe.js');

const ARGS = process.argv.slice(2).filter(a => !a.startsWith('--')), PROFIL = process.argv.includes('--profil');
const BUNDLE = path.resolve(ARGS[0] || path.join(__dirname, '../dist/unraid-cards.js'));
const LAEUFE = Number(ARGS[1]) || 300, WARM = 50;
const KLASSEN = ['BuschUnraidServerCard', 'BuschUnraidSystemCard', 'BuschUnraidCpuCard', 'BuschUnraidGpuCard', 'BuschUnraidArrayCard', 'BuschUnraidParityCard', 'BuschUnraidAirflowCard', 'BuschUnraidSharesCard', 'BuschUnraidVmUsageCard', 'BuschUnraidInterfaceCard', 'BuschUnraidUsersCard', 'BuschUnraidUsbCard', 'BuschUnraidCoralCard', 'BuschUnraidStackCard', 'BuschUnraidContainerCard', 'BuschUnraidVmCard', 'BuschUnraidDockerCard'];

function lade() {
  const registered = new Map(), document = dokument(registered), zaehler = { icons: 0 }, erzeuge = document.createElement;
  document.createElement = tag => { if (tag === 'ha-icon') zaehler.icons++; return erzeuge(tag); };
  const window = { customCards: [], innerWidth: 1000, innerHeight: 800, scrollX: 0, scrollY: 0, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
  const kontext = { performance, setTimeout, clearTimeout, HTMLElement: Element, customElements: { define: (k, v) => registered.set(k, v), get: k => registered.get(k) }, window, history: { state: null, pushState() {}, back() {} }, navigator: { language: 'de' }, console: { info() {}, warn() {}, error() {}, log() {} }, CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, document };
  kontext.globalThis = kontext; vm.createContext(kontext);
  const klassen = vm.runInContext(fs.readFileSync(BUNDLE, 'utf8') + `\n;({${KLASSEN.join(',')}})`, kontext);
  return { klassen, zaehler, profil: PROFIL ? profilieren(kontext, klassen) : null };
}

// Exclusive time per category: a wrapped call pauses the category of its caller. JSON.stringify counts as signature only
// when called directly by the render (inside a model it stays model time).
function profilieren(kontext, klassen) {
  const summe = { modell: 0, signatur: 0, abgleich: 0 }, stapel = []; let aktiv = false;
  const huelle = (fn, kat) => function (...a) {
    if (!aktiv || (kat === 'signatur' && stapel.length)) return fn.apply(this, a);
    const t0 = performance.now(); if (stapel.length) { const o = stapel[stapel.length - 1]; summe[o.kat] += t0 - o.t; }
    const e = { kat, t: t0 }; stapel.push(e);
    try { return fn.apply(this, a); } finally { const t1 = performance.now(); summe[kat] += t1 - stapel.pop().t; if (stapel.length) stapel[stapel.length - 1].t = t1; }
  };
  for (const name of ['buschUnraidModel', 'buschUnraidDockerModel']) kontext[name] = huelle(kontext[name], 'modell');
  kontext.unraidAnwenden = huelle(kontext.unraidAnwenden, 'abgleich');
  const json = vm.runInContext('JSON', kontext); json.stringify = huelle(json.stringify, 'signatur');
  for (const k of Object.values(klassen)) for (const m of ['_modell', '_modellListe']) if (Object.hasOwn(k.prototype, m)) k.prototype[m] = huelle(k.prototype[m], 'modell');
  return { summe, an(v) { aktiv = v; }, leeren() { for (const k in summe) summe[k] = 0; } };
}

const wechsel = (i, a, b) => (i % 2 ? a : b);
// Per card: fixture, configuration and the own update i (a shown value alternates, so every update is a real change).
const FAELLE = {
  BuschUnraidServerCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_dashboard_hardware').attributes.registration = 'Example license ' + (i % 2); }],
  BuschUnraidSystemCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_ram_percent').state = wechsel(i, '41', '42'); }],
  BuschUnraidCpuCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_cpu_percent').state = wechsel(i, '25', '26'); }],
  BuschUnraidGpuCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_gpu_util_0').state = wechsel(i, '10', '11'); }],
  BuschUnraidArrayCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_dashboard_storage').attributes.pools[0].used_bytes = (1 + i % 2) * 1024 ** 4; }],
  BuschUnraidParityCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_parity_progress').state = wechsel(i, '25', '26'); }],
  BuschUnraidAirflowCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_fan_cpu_rpm').state = wechsel(i, '1200', '1210'); }],
  BuschUnraidSharesCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.share_share_used_documents').state = wechsel(i, '2', '3'); }],
  BuschUnraidVmUsageCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_dashboard_vms').attributes.vms[0].host_cpu_percent = 30 + i % 2; }],
  BuschUnraidInterfaceCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_dashboard_interfaces').attributes.interfaces[0].rx_bytes_s = 1024 * (1 + i % 2); }],
  BuschUnraidUsersCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_dashboard_users').attributes.users[0].read_shares = 2 + i % 2; }],
  BuschUnraidUsbCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_dashboard_usb').attributes.devices[1].speed_mbps = wechsel(i, 12, 480); }],
  BuschUnraidCoralCard: [() => kachelKern(), (c, i) => { c.entities.get('sensor.demo_dashboard_coral').attributes.devices[0].temperature_c = 42 + i % 2; }],
  BuschUnraidStackCard: [() => familienFixture().core, (c, i) => { c.entities.get('switch.other').state = wechsel(i, 'on', 'off'); }, { device_id: 'stack', start_expanded: true }],
  BuschUnraidContainerCard: [() => familienFixture().core, (c, i) => { c.entities.get('update.correct').state = wechsel(i, 'off', 'on'); }, { device_id: 'stack', container_key: 'web' }],
  BuschUnraidVmCard: [() => unraidAttrappe({ zweiteVm: true }), (c, i) => { c.entities.get('sensor.win_cpu').state = wechsel(i, '36', '37'); }, { device_id: 'srv' }],
  BuschUnraidDockerCard: [() => dockerFixture(), (c, i) => { const e = c.entities.get('switch.webserver-mit-einem-sehr-langen-namen-der-abgeschnitten-werden-muss'); e.state = wechsel(i, 'off', 'on'); e.attributes.container_state = e.state === 'on' ? 'running' : 'exited'; }, { device_id: 'server' }],
};
function kachelKern() { const core = inventoryFixture(); core.add('fan_cpu_rpm', 1200); return core; }

function p(werte, q) { const s = [...werte].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }

const { klassen, zaehler, profil } = lade(), ergebnis = {};
for (const name of KLASSEN) {
  const [kern, aendern, config = { device_id: 'demo', show_clock: false, show_history: false }] = FAELLE[name], core = kern(), k = new klassen[name]();
  k._core = core; k._hass = { locale: { language: 'de' }, config: { time_zone: 'UTC' }, states: {}, callService: async () => {} }; k.setConfig(config); k._render();
  const zeiten = [], icons = []; let behalten = true;
  for (let i = 0; i < WARM + LAEUFE; i++) {
    const vorher = k.shadowRoot.querySelectorAll('ha-icon').filter(n => !String(n.parentNode?.className).includes('status-badge'));
    aendern(core, i); const n = zaehler.icons; if (profil && i === WARM) profil.leeren(); profil?.an(i >= WARM);
    const t0 = performance.now(); k._render(); const dt = performance.now() - t0; profil?.an(false);
    if (i < WARM) continue;
    zeiten.push(dt); icons.push(zaehler.icons - n);
    const jetzt = new Set(k.shadowRoot.querySelectorAll('ha-icon')); if (!vorher.every(n => jetzt.has(n))) behalten = false;
  }
  if (profil) { const z = zeiten.reduce((a, b) => a + b, 0) / zeiten.length, s = profil.summe, f = x => +(x / zeiten.length).toFixed(4);
    ergebnis[name] = { gesamt_ms: +z.toFixed(4), modell_ms: f(s.modell), signatur_ms: f(s.signatur), abgleich_ms: f(s.abgleich), rest_ms: +(z - (s.modell + s.signatur + s.abgleich) / zeiten.length).toFixed(4) }; continue; }
  ergebnis[name] = { p50_ms: +p(zeiten, 0.5).toFixed(4), p95_ms: +p(zeiten, 0.95).toFixed(4), knoten: k.shadowRoot.all().length - 1, ha_icon_neu_je_update: +(icons.reduce((a, b) => a + b, 0) / icons.length).toFixed(1), icons_objektgleich: behalten };
}
console.log(JSON.stringify({ bundle: path.basename(BUNDLE), laeufe: LAEUFE, node: process.version, profil: PROFIL }));
for (const [name, werte] of Object.entries(ergebnis)) console.log(JSON.stringify({ karte: name.replace('BuschUnraid', ''), ...werte }));
