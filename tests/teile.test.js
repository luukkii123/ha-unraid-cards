'use strict';
// M49 step 2 (#1299): parts (unraidTeil) are built only when their signature changed. An own update builds only the
// changed parts; a placeholder whose live part is gone is built after all; signatures that depend on the clock (SMART
// relative time) or on the language (epoch) rebuild the part.
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { Element, dokument } = require('./dom-attrappe.js');
const { inventoryFixture, familienKarte, dockerKarte, ladeFamilie, dockerFixture } = require('./familie-attrappe.js');
const { unraidAttrappe } = require('./attrappe.js');

// Document whose createElement counts elements and ha-icon elements.
function zaehlDokument(d = dokument()) {
  const z = { elemente: 0, icons: 0 }, erzeuge = d.createElement.bind(d);
  d.createElement = tag => { z.elemente++; if (tag === 'ha-icon') z.icons++; return erzeuge(tag); };
  return { d, z };
}
const messen = (z, fn) => { const e = z.elemente, i = z.icons; fn(); return { elemente: z.elemente - e, icons: z.icons - i }; };
function kachel(name, zusatz = {}) {
  const { d, z } = zaehlDokument(), l = ladeKarte([name], { document: d, ...zusatz }), k = new l[name](), core = inventoryFixture();
  k._core = core; k._hass = { locale: { language: 'de' }, config: { time_zone: 'UTC' }, callService: async () => {} };
  k.setConfig({ device_id: 'demo', show_clock: false, show_history: false }); return { k, core, z };
}

test('M49 parts: an own update of system and array tiles builds only the changed part', () => {
  const s = kachel('BuschUnraidSystemCard'), speicher = s.k.shadowRoot.querySelectorAll('.grid')[1];
  const sys = messen(s.z, () => { s.core.entities.get('sensor.demo_ram_percent').state = '61'; s.k._render(); });
  assert.match(s.k.shadowRoot.querySelector('.rings').textContent, /61 %/, 'ring updated');
  assert.ok(sys.elemente <= 30, 'system: elements built ' + sys.elemente + ' (before: 71)');
  assert.equal(s.k.shadowRoot.querySelectorAll('.grid')[1], speicher, 'memory raster kept');
  const a = kachel('BuschUnraidArrayCard'), tabellen = a.k.shadowRoot.querySelectorAll('table');
  const arr = messen(a.z, () => { a.core.entities.get('sensor.demo_dashboard_storage').attributes.pools[0].used_bytes = 2 * 1024 ** 4; a.k._render(); });
  assert.ok(arr.elemente <= 12, 'array: elements built ' + arr.elemente + ' (before: 71)');
  assert.deepEqual(a.k.shadowRoot.querySelectorAll('table'), tabellen, 'device tables kept');
});

test('M49 parts: an own update of stack, VM list and Docker builds no ha-icon of unchanged rows or heads', () => {
  const l = ladeFamilie(), { z } = zaehlDokument(l.context.document), stack = familienKarte('stack', { start_expanded: true }, { l });
  const st = messen(z, () => { stack._core.entities.get('switch.other').state = 'on'; stack._render(); });
  assert.ok(st.icons <= 2, 'stack: ha-icon built ' + st.icons + ' (before: 4-5)');
  const docker = dockerKarte({}, { l }), web = [...docker._core.entities.values()].find(e => e.entity_id.startsWith('switch.webserver'));
  const dk = messen(z, () => { web.state = 'off'; web.attributes.container_state = 'exited'; docker._render(); });
  assert.ok(dk.icons <= 1, 'docker: ha-icon built ' + dk.icons + ' (before: 3)');
  const { d, z: zv } = zaehlDokument(), { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard'], { document: d }), core = unraidAttrappe({ zweiteVm: true }), vm = new BuschUnraidVmCard();
  vm._core = core; vm._hass = { locale: { language: 'de' }, states: {}, callService: async () => {} }; vm.setConfig({ device_id: 'srv' });
  const v = messen(zv, () => { core.entities.get('sensor.win_cpu').state = '77'; vm._render(); });
  assert.match(vm.shadowRoot.querySelector('ha-card').textContent, /77 %/);
  assert.ok(v.icons <= 1, 'vm list: ha-icon built ' + v.icons + ' (before: 3)');
});

test('M49 parts: a placeholder whose live part is gone is built after all, also inside a new parent', () => {
  const { unraidTeil, unraidAnwenden } = ladeKarte(['unraidTeil', 'unraidAnwenden']), root = new Element('#shadow');
  let gebaut = 0;
  const teil = text => () => { gebaut++; const n = new Element('div'); n.className = 'teil'; n.textContent = text; return n; };
  const karte = (huelle = 'div') => { const c = new Element('ha-card'), h = new Element(huelle); h.appendChild(unraidTeil(root, 'a', 's1', teil('A'))); c.appendChild(h); return c; };
  unraidAnwenden(root, '', karte()); assert.equal(gebaut, 1);
  const live = root.querySelector('.teil');
  unraidAnwenden(root, '', karte()); assert.equal(gebaut, 1, 'same signature: kept'); assert.equal(root.querySelector('.teil'), live);
  live.remove();
  unraidAnwenden(root, '', karte()); assert.equal(gebaut, 2, 'live part gone: built'); assert.equal(root.querySelector('.teil')?.textContent, 'A');
  unraidAnwenden(root, '', karte('section')); assert.equal(gebaut, 3, 'new parent: built'); assert.equal(root.querySelector('section').querySelector('.teil')?.textContent, 'A');
  assert.equal(root.querySelectorAll('.teil').length, 1);
});

test('M49 parts: a kept SMART table follows the clock, a language change rebuilds kept parts', () => {
  let jetzt = 1767351600 * 1000 + 30000;
  class Uhr extends Date { constructor(...a) { super(...(a.length ? a : [jetzt])); } static now() { return jetzt; } }
  const { k, core } = kachel('BuschUnraidArrayCard', { Date: Uhr }), smart = () => k.shadowRoot.querySelector('.smart-text').textContent;
  const vorher = smart(); assert.match(vorher, /Sek/);
  jetzt += 120000; core.entities.get('sensor.demo_dashboard_storage').attributes.pools[0].used_bytes = 2 * 1024 ** 4; k._render();
  assert.match(smart(), /Min/, 'relative time follows: ' + smart());
  const s = kachel('BuschUnraidSystemCard'), speicher = () => s.k.shadowRoot.querySelectorAll('.grid')[1].textContent, de = speicher();
  s.k._hass = { ...s.k._hass, locale: { language: 'en' } }; s.k._render();
  assert.notEqual(speicher(), de, 'memory raster rebuilt in English');
});

// A core with track/unchanged like Busch Core (#641): versions per device, an epoch per registry rebuild.
function verfolgterKern(core) {
  const versionen = new Map(); let lesen = null; const lies = core.getDeviceEntities.bind(core);
  core.epoch = 0; core.getDeviceEntities = id => { lesen?.add(id); return lies(id); };
  core.track = fn => { const aussen = lesen, r = new Set(); lesen = r; try { fn(); } finally { lesen = aussen; if (aussen) for (const key of r) aussen.add(key); } return { epoch: core.epoch, v: [...r].map(key => [key, versionen.get(key) || 0]) }; };
  core.unchanged = d => !!d && d.v.length > 0 && d.epoch === core.epoch && d.v.every(([key, v]) => (versionen.get(key) || 0) === v);
  core.aendern = (id, fn) => { const e = core.entities.get(id); fn(e); versionen.set(e.device_id, (versionen.get(e.device_id) || 0) + 1); };
  return core;
}
test('M49 Docker model: with core.track only the changed device is modelled again; a new epoch models all', () => {
  const l = ladeFamilie(), core = verfolgterKern(dockerFixture()), orig = l.context.buschUnraidModel; let gebaut = [];
  l.context.buschUnraidModel = (c, cfg, kind, g) => { gebaut.push(cfg.device_id); return orig(c, cfg, kind, g); };
  const k = dockerKarte({}, { l, core }), alle = gebaut.length, web = [...core.entities.values()].find(e => e.entity_id.startsWith('switch.webserver'));
  const status = () => k.shadowRoot.querySelectorAll('.tile-main').find(b => b.dataset.key === 'container:' + web.attributes.container_key).querySelector('.tile-status-text').textContent, vorher = status();
  assert.ok(alle > 2, 'first render models every device: ' + alle);
  gebaut = []; core.aendern(web.entity_id, e => { e.state = 'off'; e.attributes.container_state = 'exited'; }); k._render();
  assert.deepEqual(gebaut, [web.device_id], 'only the changed device'); assert.notEqual(status(), vorher, 'tile follows');
  const deps = core.track(() => k._render()); assert.ok(deps.v.length >= alle, 'the card still tracks every device: ' + deps.v.length);
  gebaut = []; core.epoch++; core.aendern(web.entity_id, e => { e.state = 'on'; e.attributes.container_state = 'running'; }); k._render();
  assert.equal(gebaut.length, alle, 'new epoch: every device again'); assert.equal(status(), vorher);
});

// M49 follow-up (#1299): an inventory update that changes only the count (entity state, head) while the list (attributes)
// stays the same rebuilds no list node and does not merge the list; ha-icon objects and focus stay, the head count follows.
for (const [kind, name] of [['users', 'BuschUnraidUsersCard'], ['usb', 'BuschUnraidUsbCard'], ['coral', 'BuschUnraidCoralCard']]) test(`M49 inventory ${kind}: a count-only update keeps the list without rebuilding or merging it`, () => {
  const { d } = zaehlDokument(), tags = new Map(), erzeuge = d.createElement; d.createElement = tag => { tags.set(tag, (tags.get(tag) || 0) + 1); return erzeuge(tag); };
  const l = ladeKarte([name], { document: d }), k = new l[name](), core = inventoryFixture(), e = core.entities.get('sensor.demo_dashboard_' + kind);
  k._core = core; k._hass = { locale: { language: 'de' }, config: { time_zone: 'UTC' }, callService: async () => {} }; k.setConfig({ device_id: 'demo' });
  const root = k.shadowRoot, table = root.querySelector('table'), zeilen = root.querySelectorAll('tr'), icons = root.querySelectorAll('ha-icon'), toggle = root.querySelector('[data-focus-key="toggle"]');
  assert.ok(table && zeilen.length > 1, kind + ': table rendered'); toggle.focus();
  // Reads of the table's children by the card (the test DOM's own queries, Element.all, do not count).
  let kinder = table.childNodes, zugriffe = 0, an = false;
  Object.defineProperty(table, 'childNodes', { configurable: true, get() { if (an && !/Element\.all/.test(new Error().stack)) zugriffe++; return kinder; }, set(v) { kinder = v; } });
  const vorher = Number(e.state); e.state = String(vorher + 7); tags.clear();
  an = true; k._render(); an = false;
  assert.match(root.querySelector('.tile-sub').textContent, new RegExp(String(vorher + 7)), kind + ': head count follows');
  assert.equal(root.querySelector('table'), table, kind + ': table kept'); assert.deepEqual(root.querySelectorAll('tr'), zeilen, kind + ': rows kept');
  // One empty <table> is the part placeholder (unraidTeil); it never goes live.
  assert.ok((tags.get('table') || 0) <= 1, `${kind}: <table> built ${tags.get('table')}`);
  for (const tag of ['thead', 'tbody', 'tr', 'td', 'th', 'span', 'ha-icon']) assert.equal(tags.get(tag) || 0, 0, `${kind}: <${tag}> built ${tags.get(tag) || 0}`);
  assert.equal(zugriffe, 0, kind + ': list merged (' + zugriffe + ' child reads)');
  const jetzt = root.querySelectorAll('ha-icon'); assert.equal(jetzt.length, icons.length); icons.forEach((n, i) => assert.equal(jetzt[i], n, `${kind}: ha-icon ${i} kept`));
  assert.equal(root.activeElement, toggle, kind + ': focused toggle stays focused');
  // The list itself still follows (new attributes as HA sends them): only the changed row is built again, the table and
  // the other rows stay the same objects, also after the count-only update above kept the table.
  const feld = kind === 'users' ? 'users' : 'devices', [i, key, wert] = { users: [0, 'description', 'Changed entry'], usb: [1, 'name', 'Changed entry'], coral: [0, 'name', 'Coral TPU 1 Changed entry'] }[kind];
  const liste = e.attributes[feld].map((x, j) => (j === i ? { ...x, [key]: wert } : x)); e.attributes = { ...e.attributes, [feld]: liste }; tags.clear(); k._render();
  assert.match(root.querySelector('table').textContent, /Changed entry/, kind + ': changed row rendered'); assert.equal(root.querySelector('table'), table, kind + ': table kept');
  assert.deepEqual(root.querySelectorAll('tr'), zeilen, kind + ': rows kept (the changed one patched in place)');
  const spalten = root.querySelectorAll('th').length; assert.equal(tags.get('td'), spalten, `${kind}: <td> built ${tags.get('td')}, one row has ${spalten}`);
  assert.equal(tags.get('th') || 0, 0, kind + ': header kept');
});
