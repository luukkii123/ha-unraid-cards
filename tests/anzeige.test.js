"use strict";
// #642 Phase A: Abschnittskatalog, Leselogik, Wörterbücher, Kompaktzeile, Editoren.
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');

const ARTEN = ['stack', 'container', 'vm', 'docker', 'server', 'system', 'cpu', 'gpu', 'array', 'parity', 'airflow', 'shares', 'vm-usage', 'interface', 'users', 'usb', 'coral'];

// ── Schritt 1: Katalog und Leselogik ─────────────────────────────────────────
test('Katalog: alle 17 Kartenarten, IDs eindeutig und snake_case, alt verweist auf show_*', () => {
  const { UNRAID_ANZEIGE } = ladeKarte(['UNRAID_ANZEIGE']);
  assert.deepEqual(Object.keys(UNRAID_ANZEIGE).sort(), [...ARTEN].sort());
  for (const art of ARTEN) {
    const ids = UNRAID_ANZEIGE[art].map(e => e.id);
    assert.ok(ids.length, art);
    assert.equal(new Set(ids).size, ids.length, art + ': doppelte ID');
    for (const e of UNRAID_ANZEIGE[art]) {
      assert.match(e.id, /^[a-z][a-z0-9_]*$/, art + ' ' + e.id);
      assert.equal(typeof e.vorgabe, 'boolean'); assert.equal(typeof e.kompakt, 'boolean');
      if (e.alt !== undefined) assert.match(e.alt, /^show_[a-z_]+$/, art + ' ' + e.id);
      assert.ok(!('name' in e), 'Katalog darf kein name: tragen (Prüfskript)');
    }
  }
});

test('Katalog: Altschalter-Abbildung laut Plan', () => {
  const { UNRAID_ANZEIGE } = ladeKarte(['UNRAID_ANZEIGE']);
  const alt = art => Object.fromEntries(UNRAID_ANZEIGE[art].filter(e => e.alt).map(e => [e.alt, e.id]));
  assert.deepEqual(alt('stack'), { show_status: 'status', show_cpu: 'cpu', show_ram: 'ram', show_containers: 'containers' });
  assert.deepEqual(alt('container'), { show_status: 'status', show_cpu: 'cpu', show_ram: 'ram' });
  assert.deepEqual(alt('vm'), { show_status: 'status', show_cpu: 'cpu', show_ram: 'ram' });
  assert.deepEqual(alt('server'), { show_clock: 'clock' });
  assert.deepEqual(alt('system'), { show_temperatures: 'temperatures' });
  assert.deepEqual(alt('cpu'), { show_history: 'history' });
  assert.deepEqual(alt('array'), { show_boot: 'boot' });
  for (const art of ['docker', 'gpu', 'parity', 'airflow', 'shares', 'vm-usage', 'interface', 'users', 'usb', 'coral']) assert.deepEqual(alt(art), {}, art);
  assert.ok(!UNRAID_ANZEIGE.interface.some(e => e.kompakt), 'Interfaces: keine Kompaktwerte [A-5]');
  assert.ok(!UNRAID_ANZEIGE.server.find(e => e.id === 'clock').kompakt, 'Uhr nicht kompakt [A-3]');
});

test('Leselogik: Vorgabe ergibt alle Vorgabe-IDs, kompakt leer', () => {
  const { UNRAID_ANZEIGE, unraidAnzeige } = ladeKarte(['UNRAID_ANZEIGE', 'unraidAnzeige']);
  for (const art of ARTEN) {
    const a = unraidAnzeige({}, UNRAID_ANZEIGE[art]);
    assert.deepEqual([...a.sichtbar], UNRAID_ANZEIGE[art].filter(e => e.vorgabe).map(e => e.id), art);
    assert.deepEqual([...a.kompakt], [], art);
  }
});

test('Leselogik: show_cpu:false entfernt cpu, truthy bleibt wie bisher', () => {
  const { UNRAID_ANZEIGE, unraidAnzeige } = ladeKarte(['UNRAID_ANZEIGE', 'unraidAnzeige']);
  const a = unraidAnzeige({ show_cpu: false }, UNRAID_ANZEIGE.stack);
  assert.ok(!a.sichtbar.has('cpu')); assert.ok(a.sichtbar.has('ram')); assert.ok(a.sichtbar.has('status'));
  assert.ok(unraidAnzeige({ show_cpu: 1 }, UNRAID_ANZEIGE.stack).sichtbar.has('cpu'));
  assert.ok(!unraidAnzeige({ show_clock: '' }, UNRAID_ANZEIGE.server).sichtbar.has('clock'));
});

test('Leselogik: visible_items gilt vor den Altschaltern, unbekannte IDs still ignoriert', () => {
  const { UNRAID_ANZEIGE, unraidAnzeige } = ladeKarte(['UNRAID_ANZEIGE', 'unraidAnzeige']);
  const a = unraidAnzeige({ visible_items: ['cpu', 'gibt_es_nicht'], show_cpu: false, show_ram: true }, UNRAID_ANZEIGE.stack);
  assert.deepEqual([...a.sichtbar], ['cpu']);
  assert.deepEqual([...unraidAnzeige({ visible_items: [] }, UNRAID_ANZEIGE.server).sichtbar], []);
});

test('Leselogik: Nicht-Array fällt auf die Vorgabe zurück', () => {
  const { UNRAID_ANZEIGE, unraidAnzeige } = ladeKarte(['UNRAID_ANZEIGE', 'unraidAnzeige']);
  const alle = UNRAID_ANZEIGE.cpu.map(e => e.id);
  for (const wert of ['cpu', null, 3, { cpu: true }]) {
    assert.deepEqual([...unraidAnzeige({ visible_items: wert }, UNRAID_ANZEIGE.cpu).sichtbar], alle, String(wert));
    assert.deepEqual([...unraidAnzeige({ collapsed_items: wert }, UNRAID_ANZEIGE.cpu).kompakt], [], String(wert));
  }
});

test('Leselogik: collapsed_items filtert nicht-kompakte und unbekannte, Reihenfolge laut Katalog', () => {
  const { UNRAID_ANZEIGE, unraidAnzeige } = ladeKarte(['UNRAID_ANZEIGE', 'unraidAnzeige']);
  const a = unraidAnzeige({ collapsed_items: ['mover', 'clock', 'uptime', 'model', 'xyz'] }, UNRAID_ANZEIGE.server);
  assert.deepEqual([...a.kompakt], ['uptime', 'mover']);
  // [A-8] kompakt und sichtbar sind unabhängig
  const b = unraidAnzeige({ visible_items: ['clock'], collapsed_items: ['array'] }, UNRAID_ANZEIGE.server);
  assert.deepEqual([...b.sichtbar], ['clock']); assert.deepEqual([...b.kompakt], ['array']);
});

test('unraidZeigt: liest nur das in setConfig berechnete _anzeige', () => {
  const { UNRAID_ANZEIGE, unraidAnzeige, unraidZeigt } = ladeKarte(['UNRAID_ANZEIGE', 'unraidAnzeige', 'unraidZeigt']);
  assert.equal(unraidZeigt({}, 'cpu'), false);
  const karte = { _anzeige: unraidAnzeige({ visible_items: ['load'] }, UNRAID_ANZEIGE.cpu) };
  assert.equal(unraidZeigt(karte, 'load'), true); assert.equal(unraidZeigt(karte, 'history'), false);
});

// ── Schritt 2: Wörterbücher ──────────────────────────────────────────────────
function woerterbuecher() {
  const l = ladeKarte(['UNRAID_ANZEIGE', 'UNRAID_KACHELN', 'TEXTE_BUSCH_UNRAID_STACK_CARD', 'TEXTE_BUSCH_UNRAID_CONTAINER_CARD', 'TEXTE_BUSCH_UNRAID_VM_CARD', 'TEXTE_BUSCH_UNRAID_DOCKER_CARD']);
  const je = { stack: l.TEXTE_BUSCH_UNRAID_STACK_CARD, container: l.TEXTE_BUSCH_UNRAID_CONTAINER_CARD, vm: l.TEXTE_BUSCH_UNRAID_VM_CARD, docker: l.TEXTE_BUSCH_UNRAID_DOCKER_CARD };
  for (const [, Karte] of l.UNRAID_KACHELN) je[Karte.kachel] = new Karte()._texte;
  return { katalog: l.UNRAID_ANZEIGE, je };
}
test('Wörterbücher: anzeige je ID, kurz je Kompaktwert, compact_label – de und en, alle 17 Karten', () => {
  const { katalog, je } = woerterbuecher();
  assert.deepEqual(Object.keys(je).sort(), [...ARTEN].sort());
  for (const art of ARTEN) for (const sprache of ['de', 'en']) {
    const t = je[art][sprache], ort = `${art} ${sprache}`;
    assert.equal(typeof t.compact_label, 'string', ort + ' compact_label'); assert.ok(t.compact_label.trim(), ort);
    for (const e of katalog[art]) {
      assert.ok(typeof t.anzeige?.[e.id] === 'string' && t.anzeige[e.id].trim(), `${ort} anzeige.${e.id}`);
      if (e.kompakt) assert.ok(typeof t.kurz?.[e.id] === 'string' && t.kurz[e.id].trim(), `${ort} kurz.${e.id}`);
    }
  }
});
test('Wörterbücher: Labels und Helper der beiden Felder wörtlich (O-1: „Eingeklappt anzeigen“)', () => {
  const { je } = woerterbuecher();
  for (const art of ARTEN) {
    const de = je[art].de, en = je[art].en;
    assert.equal(de.labels.visible_items, 'Angezeigt', art); assert.equal(en.labels.visible_items, 'Shown', art);
    assert.equal(de.labels.collapsed_items, 'Eingeklappt anzeigen', art); assert.equal(en.labels.collapsed_items, 'Shown when collapsed', art);
    assert.equal(de.helpers.visible_items, 'Abschnitte, die ausgeklappt sichtbar sind. Vorgabe: alle wie bisher.', art);
    assert.equal(en.helpers.visible_items, 'Sections shown when expanded. Default: all, as before.', art);
    assert.equal(de.helpers.collapsed_items, 'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.', art);
    assert.equal(en.helpers.collapsed_items, 'Values shown in one line below the header while collapsed. Default: none.', art);
  }
});

// ── Schritt 3: Baustein Kompaktzeile ─────────────────────────────────────────
const T = { compact_label: 'Kennzahlen', kurz: { status: 'Status', cpu: 'CPU', ram: 'RAM', containers: 'Container' } };
test('Kompaktzeile: leere Auswahl oder nur fehlende Werte → null (keine Zeile)', () => {
  const { unraidKompaktZeile } = ladeKarte(['unraidKompaktZeile']);
  assert.equal(unraidKompaktZeile([], { cpu: { wert: '12 %' } }, T), null);
  assert.equal(unraidKompaktZeile(['cpu', 'ram'], { cpu: { wert: null }, ram: { wert: '–' } }, T), null);
  assert.equal(unraidKompaktZeile(['cpu'], {}, T), null);
  assert.equal(unraidKompaktZeile(undefined, undefined, T), null);
});
test('Kompaktzeile: Werte null/undefined/„–“ fallen weg, Reihenfolge der IDs, Label aus kurz', () => {
  const { unraidKompaktZeile } = ladeKarte(['unraidKompaktZeile']);
  const z = unraidKompaktZeile(['status', 'cpu', 'ram', 'containers'], { containers: { wert: '3/5' }, ram: { wert: '–' }, cpu: { wert: '12 %' }, status: { wert: 'Läuft', semantik: 'ok' } }, T);
  assert.equal(z.className, 'compact-line');
  const items = z.querySelectorAll('.compact-item');
  assert.deepEqual(items.map(i => i.querySelector('.compact-label').textContent), ['Status', 'CPU', 'Container']);
  assert.deepEqual(items.map(i => i.querySelector('.compact-value').textContent), ['Läuft', '12 %', '3/5']);
});
test('Kompaktzeile: role=list/listitem, aria-label, Punkt nur mit Semantik und aria-hidden', () => {
  const { unraidKompaktZeile } = ladeKarte(['unraidKompaktZeile']);
  const z = unraidKompaktZeile(['status', 'cpu'], { status: { wert: 'Läuft', semantik: 'ok' }, cpu: { wert: '12 %' } }, T);
  assert.equal(z.getAttribute('role'), 'list'); assert.equal(z.getAttribute('aria-label'), 'Kennzahlen');
  const [a, b] = z.querySelectorAll('.compact-item');
  assert.equal(a.getAttribute('role'), 'listitem'); assert.equal(b.getAttribute('role'), 'listitem');
  const punkt = a.querySelector('.dot'); assert.ok(punkt); assert.match(punkt.className, /\bsem-ok\b/); assert.equal(punkt.getAttribute('aria-hidden'), 'true');
  assert.equal(b.querySelector('.dot'), null);
});
test('Kompaktzeile: eigenes Label und mehrere Werte je ID (z. B. Pools, mehrere GPUs)', () => {
  const { unraidKompaktZeile } = ladeKarte(['unraidKompaktZeile']);
  const z = unraidKompaktZeile(['pools'], { pools: [{ label: 'cache', wert: '45 %' }, { label: 'raid', wert: null }, { label: 'nvme', wert: '10 %' }] }, { compact_label: 'K', kurz: { pools: 'Pool' } });
  assert.deepEqual(z.querySelectorAll('.compact-label').map(n => n.textContent), ['cache', 'nvme']);
});
test('Kompaktzeile: CSS mit Umbruch, Trenner per ::before, Theme-Farben', () => {
  const { UNRAID_TILE_STYLE } = ladeKarte(['UNRAID_TILE_STYLE']);
  assert.match(UNRAID_TILE_STYLE, /\.compact-line\{[^}]*display:flex[^}]*flex-wrap:wrap[^}]*\}/);
  assert.match(UNRAID_TILE_STYLE, /\.compact-line\{[^}]*overflow-wrap:anywhere/);
  assert.match(UNRAID_TILE_STYLE, /\.compact-item\+\.compact-item::before\{content:'·'/);
  assert.match(UNRAID_TILE_STYLE, /\.compact-label\{[^}]*var\(--secondary-text-color\)/);
  assert.match(UNRAID_TILE_STYLE, /\.compact-value\{[^}]*var\(--primary-text-color\)/);
});

// ── Schritt 4: Editoren und Schemata ─────────────────────────────────────────
const Ereignis = class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
function editor(name, config, sprache = 'de') {
  const l = ladeKarte([name], { CustomEvent: Ereignis }), e = new l[name]();
  e.hass = { locale: { language: sprache } }; e.setConfig({ type: 'custom:x', ...config }); return { e, form: e.querySelector('ha-form') };
}
const aendern = (form, wert) => { for (const fn of form.listeners['value-changed']) fn({ stopPropagation() {}, detail: { value: { ...form.data, ...wert } } }); };
const KACHEL_SCHEMATA = ['SERVER', 'SYSTEM', 'CPU', 'GPU', 'ARRAY', 'PARITY', 'AIRFLOW', 'SHARES', 'VM_USAGE', 'INTERFACE', 'USERS', 'USB', 'CORAL'].map(n => `SCHEMA_BUSCH_UNRAID_${n}_CARD`);

test('Schemata: visible_items/collapsed_items direkt hinter title, Häkchenliste; überführte show_* entfernt', () => {
  const l = ladeKarte([...KACHEL_SCHEMATA, 'SCHEMA_BUSCH_UNRAID_DOCKER_CARD']);
  for (const n of [...KACHEL_SCHEMATA, 'SCHEMA_BUSCH_UNRAID_DOCKER_CARD']) {
    const namen = l[n].map(f => f.name), i = namen.indexOf('title');
    assert.deepEqual(namen.slice(i + 1, i + 3), ['visible_items', 'collapsed_items'], n);
    for (const f of l[n].filter(f => f.name.endsWith('_items'))) assert.deepEqual(JSON.parse(JSON.stringify(f.selector)), { select: { multiple: true, mode: 'list', options: [] } }, n);
    for (const alt of ['show_clock', 'show_temperatures', 'show_history', 'show_boot']) assert.ok(!namen.includes(alt), `${n}: ${alt}`);
  }
});
test('Kachel-Vorgaben: überführte show_* sind keine Vorgaben mehr', () => {
  const l = ladeKarte(['UNRAID_KACHELN']);
  for (const [tag, Karte] of l.UNRAID_KACHELN) for (const alt of ['show_clock', 'show_temperatures', 'show_history', 'show_boot']) assert.ok(!(alt in new Karte()._vorgaben), `${tag}: ${alt}`);
});
test('Editor: Häkchen zeigen den Altzustand; Optionen aus dem Katalog mit Wörterbuch-Labels', () => {
  const { e, form } = editor('BuschUnraidServerCardEditor', { show_clock: false });
  assert.deepEqual([...form.data.visible_items], ['uptime', 'array', 'mover', 'model', 'registration']);
  assert.deepEqual([...form.data.collapsed_items], []);
  const feld = form.schema.find(f => f.name === 'visible_items');
  assert.deepEqual(feld.selector.select.options.map(o => [o.value, o.label]), [['clock', 'Uhrzeit'], ['uptime', 'Laufzeit'], ['array', 'Array'], ['mover', 'Mover'], ['model', 'Modell'], ['registration', 'Registrierung']]);
  assert.equal(feld.selector.select.multiple, true); assert.equal(feld.selector.select.mode, 'list');
  assert.deepEqual(form.schema.find(f => f.name === 'collapsed_items').selector.select.options.map(o => o.value), ['uptime', 'array', 'mover']);
  assert.equal(form.computeLabel({ name: 'collapsed_items' }), 'Eingeklappt anzeigen'); assert.match(form.computeHelper({ name: 'visible_items' }), /Vorgabe: alle wie bisher\./);
  assert.ok(e);
});
test('Editor: nach value-changed steht visible_items in der Konfiguration, show_* ist entfernt', () => {
  const { e, form } = editor('BuschUnraidServerCardEditor', { show_clock: false });
  aendern(form, { title: 'Neu' });
  const c = e.event.detail.config; assert.equal(e.event.type, 'config-changed');
  assert.ok(!('show_clock' in c)); assert.deepEqual([...c.visible_items], ['uptime', 'array', 'mover', 'model', 'registration']); assert.equal(c.title, 'Neu');
  assert.ok(!('collapsed_items' in c), 'leeres collapsed_items wird nicht geschrieben');
  // Echo-Schutz: form.data folgt der normalisierten Konfiguration
  assert.deepEqual([...form.data.visible_items], ['uptime', 'array', 'mover', 'model', 'registration']);
});
test('Editor: bei Vorgabe wird kein visible_items geschrieben, Reihenfolge laut Katalog', () => {
  let { e, form } = editor('BuschUnraidCpuCardEditor', { show_history: true });
  aendern(form, { title: 'X' }); assert.ok(!('visible_items' in e.event.detail.config)); assert.ok(!('show_history' in e.event.detail.config));
  ({ e, form } = editor('BuschUnraidCpuCardEditor', {}));
  aendern(form, { visible_items: ['history', 'load'], collapsed_items: ['power', 'cores', 'temperature'] });
  assert.deepEqual([...e.event.detail.config.visible_items], ['load', 'history']);
  assert.deepEqual([...e.event.detail.config.collapsed_items], ['temperature', 'power']);
});
test('Editor: unbekannte IDs bleiben erhalten (Datenerhalt)', () => {
  const { e, form } = editor('BuschUnraidServerCardEditor', { visible_items: ['uptime', 'zukunft'], collapsed_items: ['array', 'spaeter'] });
  assert.deepEqual([...form.data.visible_items], ['uptime']);
  aendern(form, { visible_items: ['uptime', 'mover'] });
  assert.deepEqual([...e.event.detail.config.visible_items], ['uptime', 'mover', 'zukunft']);
  assert.deepEqual([...e.event.detail.config.collapsed_items], ['array', 'spaeter']);
});
test('Editor: Interfaces ohne collapsed_items (keine Kompaktwerte)', () => {
  const { form } = editor('BuschUnraidInterfaceCardEditor', {});
  const namen = form.schema.map(f => f.name); assert.ok(namen.includes('visible_items')); assert.ok(!namen.includes('collapsed_items'));
});
test('Docker-Editor: Felder, device_id-Reset wirkt weiter, Vorgabe schreibt keinen Schlüssel', () => {
  const { familienFixture, dockerFixture } = require('./familie-attrappe.js'); void familienFixture;
  const l = ladeKarte(['BuschUnraidDockerEditor'], { CustomEvent: Ereignis }), e = new l.BuschUnraidDockerEditor();
  e._core = dockerFixture(); e._hass = { locale: { language: 'de' } }; e.setConfig({ type: 'custom:busch-unraid-docker-card', device_id: 'server', container_key: 'alt', switch_entity: 'switch.alt' });
  const form = e._form; assert.deepEqual(form.schema.find(f => f.name === 'visible_items').selector.select.options.map(o => [o.value, o.label]), [['summary', 'Zusammenfassung'], ['stacks', 'Stacks'], ['containers', 'Eigenständige Container']]);
  aendern(form, { device_id: 'anderer' });
  const c = e.event.detail.config; assert.equal(c.device_id, 'anderer'); assert.ok(!('container_key' in c)); assert.ok(!('switch_entity' in c)); assert.ok(!('visible_items' in c)); assert.ok(!('collapsed_items' in c));
  aendern(e._form, { visible_items: ['stacks'], collapsed_items: ['summary'] });
  assert.deepEqual([...e.event.detail.config.visible_items], ['stacks']); assert.deepEqual([...e.event.detail.config.collapsed_items], ['summary']);
});
