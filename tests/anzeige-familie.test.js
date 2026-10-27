"use strict";
// #642 Phase B, Schritt 13: Basiskarte (Stack, Container, Einzel-VM) – Einklappen je Schlüssel, Kopf (#643/6),
// Abschnitte über visible_items, Kompaktzeile (Linie von #640), Signatur, Editorfelder.
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { ladeFamilie, familienKarte, speicherAttrappe } = require('./familie-attrappe.js');

const same = (a, b, msg) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, msg);
const bild = n => `${n.tagName}.${n.className}|${n._text}|${JSON.stringify(n.attributes)}(${n.childNodes.map(bild).join(',')})`;
const kopf = k => k.shadowRoot.querySelector('.tile-head');
const knopf = k => k.shadowRoot.querySelector('[data-focus-key="toggle"]');
const zeile = k => k.shadowRoot.querySelector('.compact-line');
const labels = k => zeile(k).querySelectorAll('.compact-label').map(n => n.textContent);
const werte = k => zeile(k).querySelectorAll('.compact-value').map(n => n.textContent);
function vm(config = {}, { core = unraidAttrappe(), speicher } = {}) {
  const { BuschUnraidVmCard } = ladeKarte(['BuschUnraidVmCard'], speicher ? { localStorage: speicher } : undefined), k = new BuschUnraidVmCard();
  k._core = core; k._hass = { locale: { language: 'de' }, callService: async () => {} }; k.setConfig({ device_id: 'vm1', ...config }); k._render(); return k;
}
const gestoppt = () => { const core = unraidAttrappe(); core.entities.get('switch.win').state = 'off'; core.entities.get('sensor.win_state').state = 'shut_off'; return core; };

test('Basiskarte: Einklappen wird je Schlüssel gemerkt, auch bei zwei Containern desselben Stacks [A-10]', () => {
  const speicher = speicherAttrappe(), l = ladeFamilie({ speicher });
  const web = familienKarte('container', { container_key: 'web' }, { l });
  assert.equal(knopf(web).getAttribute('aria-expanded'), 'true'); knopf(web).click();
  assert.equal(speicher.daten.get('unraid-cards:container:stack::web'), '1');
  assert.equal(familienKarte('container', { container_key: 'db' }, { l })._eingeklappt, false, 'anderer Container desselben Stacks bleibt offen');
  assert.equal(knopf(familienKarte('container', { container_key: 'web' }, { l })).getAttribute('aria-expanded'), 'false', 'gemerkt');
  const stack = familienKarte('stack', { title: 'Medien' }, { l }); assert.equal(stack._eingeklappt, false); knopf(stack).click();
  assert.equal(speicher.daten.get('unraid-cards:stack:stack:Medien'), '1');
  const vmSpeicher = speicherAttrappe(); knopf(vm({}, { speicher: vmSpeicher })).click();
  assert.equal(vmSpeicher.daten.get('unraid-cards:vm:vm1:'), '1'); assert.equal(vm({}, { speicher: vmSpeicher })._eingeklappt, true);
  // Ohne Speicher (privates Fenster): kein Fehler, startet ausgeklappt.
  const kaputt = { getItem() { throw Error('blockiert'); }, setItem() { throw Error('blockiert'); } };
  const k = familienKarte('stack', {}, { speicher: kaputt }); assert.equal(k._eingeklappt, false); knopf(k).click(); assert.equal(k._eingeklappt, true);
});

test('Basiskarte: Knopf im Kopf, nicht in den Aktionen; eingeklappt nur Kopf; Fokus bleibt; getCardSize', () => {
  for (const kind of ['stack', 'container']) {
    const k = familienKarte(kind, { start_expanded: true }), h = kopf(k);
    const t = h.childNodes.find(n => n.dataset?.focusKey === 'toggle');
    assert.ok(t, kind); assert.match(t.className, /\bcollapse-toggle\b/); assert.equal(t.getAttribute('aria-label'), 'Einklappen', kind + ': Kachelwort, nicht „Container zuklappen“');
    const actions = h.childNodes.find(n => /\bactions\b/.test(n.className)); assert.ok(actions, kind + ': .header > .actions bleibt');
    assert.equal(actions.querySelector('[data-focus-key="toggle"]'), null);
    assert.equal(k.getCardSize(), kind === 'stack' ? 4 : 2, kind + ' ausgeklappt wie bisher');
    t.focus(); t.click();
    assert.equal(k.shadowRoot.activeElement, knopf(k), kind + ': Fokus bleibt auf dem Knopf');
    assert.equal(knopf(k).getAttribute('aria-expanded'), 'false');
    assert.equal(k.shadowRoot.querySelector('.metrics'), null, kind); assert.equal(k.shadowRoot.querySelector('.rows'), null, kind); assert.equal(k.shadowRoot.querySelector('.disclosure'), null, kind);
    assert.ok(kopf(k).childNodes.some(n => /\bactions\b/.test(n.className)), kind + ': Aktionen bleiben im Kopf');
    assert.equal(k.getCardSize(), 1);
  }
  const k = familienKarte('stack', { collapsed_items: ['containers'] }); knopf(k).click(); assert.equal(k.getCardSize(), 2);
  assert.equal(new (ladeFamilie().BuschUnraidContainerCard)().getCardSize(), 2, 'vor setConfig sicher');
});

test('Basiskarte: Badge in .title-row neben dem Titel, Aktionen in eigener Zeile (#643/6)', () => {
  for (const k of [familienKarte('stack'), familienKarte('container'), vm()]) {
    const reihe = k.shadowRoot.querySelector('.title-row'); assert.ok(reihe);
    assert.equal(reihe.childNodes[0].tagName, 'H2'); assert.ok(reihe.querySelector('.status-badge'));
    assert.ok(!kopf(k).childNodes.some(n => /status-badge/.test(n.className)), 'Badge nicht mehr im Kopfraster');
    assert.ok(kopf(k).childNodes.findIndex(n => n.dataset?.focusKey === 'toggle') < kopf(k).childNodes.findIndex(n => /\bactions\b/.test(n.className)), 'Knopf vor der Aktionszeile');
  }
  const { UNRAID_FAMILIE_STYLE: f, BUSCH_UNRAID_STYLE: b } = ladeKarte(['UNRAID_FAMILIE_STYLE', 'BUSCH_UNRAID_STYLE']);
  assert.match(f, /\.title-row\{[^}]*display:flex[^}]*flex-wrap:wrap/);
  assert.match(f, /\.tile-head>\.tile-actions,\.tile-head>\.actions\{grid-area:actions/);
  assert.doesNotMatch(b, /\.actions button\{flex:1 1 0/); assert.doesNotMatch(b, /\.actions:has\(>button:nth-child\(4\)\)/);
});

test('Basiskarte: Abschnitte über visible_items; Altschalter zeigen dieselbe Ansicht', () => {
  const l = ladeFamilie();
  const s = cfg => familienKarte('stack', { start_expanded: true, ...cfg }, { l }), c = cfg => familienKarte('container', cfg, { l });
  assert.equal(s({ visible_items: ['status', 'update_queue', 'cpu', 'ram'] }).shadowRoot.querySelector('.disclosure'), null, 'ohne containers keine Liste');
  const ohneStatus = s({ visible_items: ['cpu', 'ram', 'containers'] });
  assert.equal(ohneStatus.shadowRoot.querySelector('.title-row').querySelector('.status-badge'), null); assert.equal(ohneStatus.shadowRoot.querySelector('.tile-sub'), null);
  assert.ok(ohneStatus.shadowRoot.querySelectorAll('.row').every(r => !r.querySelector('.status-badge')), 'auch keine Badges je Zeile');
  const nurCpu = s({ visible_items: ['cpu'] }).shadowRoot.querySelector('.metrics'); assert.deepEqual(nurCpu.childNodes.length, 1);
  assert.equal(c({ visible_items: ['status', 'cpu', 'ram'] }).shadowRoot.querySelectorAll('.tile-sub').length, 1, 'ohne image nur der Stack-Untertitel');
  for (const [alt, id, art] of [['show_status', 'status', 'stack'], ['show_cpu', 'cpu', 'stack'], ['show_ram', 'ram', 'stack'], ['show_containers', 'containers', 'stack'], ['show_status', 'status', 'container'], ['show_cpu', 'cpu', 'container'], ['show_ram', 'ram', 'container']]) {
    const k = art === 'stack' ? s : c, alle = art === 'stack' ? ['status', 'update_queue', 'cpu', 'ram', 'containers'] : ['status', 'image', 'cpu', 'ram'];
    assert.equal(bild(k({ [alt]: false }).shadowRoot), bild(k({ visible_items: alle.filter(x => x !== id) }).shadowRoot), `${art}: ${alt}:false`);
    assert.equal(bild(k({ [alt]: true }).shadowRoot), bild(k({}).shadowRoot), `${art}: ${alt}:true`);
  }
  assert.equal(bild(vm({ show_cpu: false, show_ram: false }).shadowRoot), bild(vm({ visible_items: ['status'] }).shadowRoot), 'VM');
});

test('Basiskarte: Kompaktzeile genau die gewählten, verfügbaren Werte; gestoppt kein CPU/RAM (#640)', () => {
  const alle = { collapsed_items: ['ram', 'status', 'cpu'] };
  let k = vm(alle); knopf(k).click();
  same(labels(k), ['Status', 'CPU', 'RAM']); same(werte(k), ['Läuft', '36 %', '16 GiB']); assert.match(zeile(k).querySelector('.dot').className, /sem-ok/);
  k = vm(alle, { core: gestoppt() }); knopf(k).click(); same(labels(k), ['Status'], 'gestoppte VM: kein CPU/RAM');
  k = familienKarte('container', { container_key: 'db', ...alle }); knopf(k).click(); same(labels(k), ['Status'], 'gestoppter Container: kein CPU/RAM');
  k = familienKarte('stack', { collapsed_items: ['containers', 'status'] }); knopf(k).click();
  same(labels(k), ['Status', 'Container']); assert.equal(werte(k)[1], '1/2');
  k = vm({}); knopf(k).click(); assert.equal(zeile(k), null, 'leere Auswahl: keine Zeile');
  assert.equal(zeile(vm(alle)), null, 'ausgeklappt: keine Zeile');
  const leer = familienKarte('stack', { device_id: 'fehlt', collapsed_items: ['status'] }); knopf(leer).click(); assert.equal(zeile(leer), null, 'ohne Gerät keine Zeile');
});

test('Basiskarte: Signatur enthält _eingeklappt (direkter Render ohne _umschalten)', () => {
  const k = familienKarte('stack'), vorher = k.shadowRoot.childNodes[1];
  k._render(); assert.equal(k.shadowRoot.childNodes[1], vorher, 'unverändert: kein Neuaufbau');
  k._eingeklappt = true; k._render(); assert.notEqual(k.shadowRoot.childNodes[1], vorher); assert.equal(knopf(k).getAttribute('aria-expanded'), 'false');
});

const Ereignis = class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
test('Basiseditoren: visible_items/collapsed_items hinter title, überführte show_* entfernt, Altzustand als Häkchen', () => {
  const l = ladeFamilie(), { familienFixture } = require('./familie-attrappe.js');
  const lv = ladeKarte(['BuschUnraidVmEditor', 'BUSCH_UNRAID_DEFAULTS', 'SCHEMA_BUSCH_UNRAID_STACK_CARD', 'SCHEMA_BUSCH_UNRAID_CONTAINER_CARD', 'SCHEMA_BUSCH_UNRAID_VM_CARD'], { CustomEvent: Ereignis });
  for (const alt of ['show_status', 'show_cpu', 'show_ram', 'show_containers']) assert.ok(!(alt in lv.BUSCH_UNRAID_DEFAULTS), alt);
  for (const n of ['STACK', 'CONTAINER', 'VM']) {
    const namen = lv[`SCHEMA_BUSCH_UNRAID_${n}_CARD`].map(f => f.name), i = namen.indexOf('title');
    same(namen.slice(i + 1, i + 3), ['visible_items', 'collapsed_items'], n);
    for (const alt of ['show_status', 'show_cpu', 'show_ram', 'show_containers']) assert.ok(!namen.includes(alt), `${n}: ${alt}`);
  }
  const { core } = familienFixture();
  const stack = new (l.registered.get('busch-unraid-stack-card-editor'))(); stack._core = core; stack._hass = { locale: { language: 'de' } }; stack.setConfig({ device_id: 'stack', show_containers: false });
  same(stack._form.data.visible_items, ['status', 'update_queue', 'cpu', 'ram']);
  same(stack._form.schema.find(f => f.name === 'visible_items').selector.select.options.map(o => [o.value, o.label]), [['status', 'Status'], ['update_queue', 'Update-Warteschlange'], ['cpu', 'CPU'], ['ram', 'RAM'], ['containers', 'Containerliste']]);
  same(stack._form.schema.find(f => f.name === 'collapsed_items').selector.select.options.map(o => o.value), ['status', 'cpu', 'ram', 'containers']);
  assert.equal(stack._form.computeLabel({ name: 'collapsed_items' }), 'Eingeklappt anzeigen');
  for (const fn of stack._form.listeners['value-changed']) fn({ stopPropagation() {}, detail: { value: { ...stack._form.data, title: 'Neu' } } });
  const c = stack.event.detail.config; assert.ok(!('show_containers' in c)); same(c.visible_items, ['status', 'update_queue', 'cpu', 'ram']); assert.equal(c.title, 'Neu');
  const e = new lv.BuschUnraidVmEditor(); e._core = unraidAttrappe(); e._hass = { locale: { language: 'de' } }; e.setConfig({ device_id: 'vm1', show_cpu: false });
  same(e._form.data.visible_items, ['status', 'ram', 'vms']);
  same(e._form.schema.find(f => f.name === 'visible_items').selector.select.options.map(o => o.value), ['status', 'cpu', 'ram', 'vms']);
  assert.equal(e._form.computeHelper({ name: 'collapsed_items' }), 'Kennzahlen in einer Zeile unter dem Kopf, wenn die Karte eingeklappt ist. Vorgabe: keine.');
});
