"use strict";
// Kacheln (Task 5–11, 13): je Kachel Modell, Kopf und Inhalt über die Attrappe.
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');
const { festesDatum } = require('./dom-attrappe.js');
function rendere(Klasse, core, config = {}) { const k = new Klasse(); k._core = core; k._hass = { locale: { language: 'de' }, callService: async () => {} }; k.setConfig(config); k._render(); return k; }

test('Server: Kopf, Uptime, Array-Zustand', () => { const { BuschUnraidServerCard } = ladeKarte(['BuschUnraidServerCard'], { Date: festesDatum('2026-10-23T08:36:00Z') }); const k = rendere(BuschUnraidServerCard, unraidAttrappe()); const txt = k.shadowRoot.textContent; assert.match(txt, /Tower/); assert.match(txt, /6 Tage, 17 Stunden, 55 Minuten/); assert.match(txt, /Gestartet/); });
test('Server: zwei Server ohne Auswahl', () => { const { BuschUnraidServerCard } = ladeKarte(['BuschUnraidServerCard']); assert.match(rendere(BuschUnraidServerCard, unraidAttrappe({ zweiterServer: true })).shadowRoot.textContent, /Mehrere Unraid-Server/); });
test('Server: Version im Untertitel, Mover, Uhr abschaltbar', () => {
  const { BuschUnraidServerCard } = ladeKarte(['BuschUnraidServerCard'], { Date: festesDatum('2026-10-23T08:36:00Z') });
  const core = unraidAttrappe(); core.devices.get('srv').sw_version = '7.1.4';
  const mit = rendere(BuschUnraidServerCard, core, { show_clock: true });
  assert.match(mit.shadowRoot.querySelector('.tile-sub').textContent, /Unraid-Version 7\.1\.4/); assert.match(mit.shadowRoot.textContent, /Mover.*ruht/); assert.ok(mit.shadowRoot.querySelector('.clock'));
  assert.equal(rendere(BuschUnraidServerCard, core, { show_clock: false }).shadowRoot.querySelector('.clock'), null);
});
test('Server: Ausfall des Uptime-Sensors zeigt –', () => {
  const { BuschUnraidServerCard } = ladeKarte(['BuschUnraidServerCard']);
  const core = unraidAttrappe(); const up = core.entities.get('sensor.tower_uptime'); up.state = 'unavailable';
  const td = rendere(BuschUnraidServerCard, core, { show_clock: false }).shadowRoot.querySelectorAll('td'); assert.equal(td[1].textContent, '–');
});
test('Dauer: Einzahl, Null und ungültig', () => {
  const { unraidDauer } = ladeKarte(['unraidDauer']); const t = { day: 'Tag', days: 'Tage', hour: 'Stunde', hours: 'Stunden', minute: 'Minute', minutes: 'Minuten' };
  assert.equal(unraidDauer(86400 + 3600 + 60, t), '1 Tag, 1 Stunde, 1 Minute'); assert.equal(unraidDauer(30, t), '0 Minuten'); assert.equal(unraidDauer(2 * 86400, t), '2 Tage, 0 Minuten');
  assert.equal(unraidDauer(null, t), '–'); assert.equal(unraidDauer(-1, t), '–'); assert.equal(unraidDauer(NaN, t), '–');
});
test('Server: Uhr-Intervall wird beim Trennen geräumt', () => {
  const laufend = new Set(); let n = 0;
  const { BuschUnraidServerCard } = ladeKarte(['BuschUnraidServerCard'], { setInterval: () => { laufend.add(++n); return n; }, clearInterval: (id) => laufend.delete(id) });
  const k = new BuschUnraidServerCard(); k.setConfig({}); k.connectedCallback(); k.connectedCallback(); assert.equal(laufend.size, 1);
  k.disconnectedCallback(); assert.equal(laufend.size, 0);
});
test('Kachel-Editor: Labels/Helper aus den Texten, value-changed → config-changed', () => {
  const { BuschUnraidServerCardEditor } = ladeKarte(['BuschUnraidServerCardEditor'], { CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } } });
  const e = new BuschUnraidServerCardEditor(); e.hass = { locale: { language: 'de' } }; e.setConfig({ type: 'custom:busch-unraid-server-card' });
  const form = e.querySelector('ha-form'); assert.ok(form); assert.deepEqual(form.schema.map(s => s.name), ['device_id', 'title', 'show_clock']);
  assert.equal(form.data.show_clock, true); assert.equal(form.computeLabel({ name: 'show_clock' }), 'Uhrzeit zeigen'); assert.match(form.computeHelper({ name: 'show_clock' }), /Zeitzone/);
  for (const fn of form.listeners['value-changed']) fn({ stopPropagation() {}, detail: { value: { ...form.data, show_clock: false } } });
  assert.equal(e.event.type, 'config-changed'); assert.equal(e.event.detail.config.show_clock, false); assert.equal(e.event.detail.config.type, 'custom:busch-unraid-server-card');
});
test('Registrierung: Kartenwähler-Eintrag je Kachel', () => {
  const kontext = { window: { customCards: [] }, customElements: { define() {} } };
  const { UNRAID_KACHELN } = ladeKarte(['UNRAID_KACHELN'], kontext);
  for (const [tag] of UNRAID_KACHELN) { const c = kontext.window.customCards.find(x => x.type === tag); assert.ok(c, tag); assert.equal(c.preview, true); assert.equal(c.documentationURL, 'https://github.com/luukkii123/ha-unraid-cards#' + tag); assert.ok(c.name && c.description); }
});
test('System: RAM-Ring und Temperaturen', () => { const { BuschUnraidSystemCard } = ladeKarte(['BuschUnraidSystemCard']); const k = rendere(BuschUnraidSystemCard, unraidAttrappe()); const r = k.shadowRoot.querySelector('.ring'); assert.match(r.textContent, /67 %/); assert.match(k.shadowRoot.textContent, /CPU.*89 °C/s); assert.match(k.shadowRoot.textContent, /Mainboard.*41 °C/s); });
test('System: Ausfall zeigt – statt NaN', () => { const { BuschUnraidSystemCard } = ladeKarte(['BuschUnraidSystemCard']); const txt = rendere(BuschUnraidSystemCard, unraidAttrappe({ ausfall: true })).shadowRoot.textContent; assert.doesNotMatch(txt, /NaN/); assert.match(txt, /–/); });
test('System: Fühlername aus label, sonst friendly_name, sonst Kanal; abschaltbar', () => {
  const { BuschUnraidSystemCard } = ladeKarte(['BuschUnraidSystemCard']); const core = unraidAttrappe();
  const namen = k => [...k.shadowRoot.querySelectorAll('.cell-name')].map(n => n.textContent), werte = k => [...k.shadowRoot.querySelectorAll('.cell-value')].map(n => n.textContent);
  let k = rendere(BuschUnraidSystemCard, core); assert.ok(namen(k).includes('Composite')); assert.ok(werte(k).includes('38,5 °C')); assert.ok(namen(k).includes('temp3'));
  core.entities.get('sensor.tower_k10temp_temp3').attributes.friendly_name = 'Tower k10temp temp3'; k = rendere(BuschUnraidSystemCard, core); assert.ok(namen(k).includes('Tower k10temp temp3'));
  k = rendere(BuschUnraidSystemCard, core, { show_temperatures: false }); assert.equal(k.shadowRoot.querySelector('.grid'), null); assert.doesNotMatch(k.shadowRoot.textContent, /Temperaturen/);
});
test('System-Editor: Schema und Texte', () => { const { BuschUnraidSystemCardEditor } = ladeKarte(['BuschUnraidSystemCardEditor']); const e = new BuschUnraidSystemCardEditor(); e.hass = { locale: { language: 'de' } }; e.setConfig({ type: 'custom:busch-unraid-system-card' }); const form = e.querySelector('ha-form'); assert.deepEqual(form.schema.map(s => s.name), ['device_id', 'title', 'show_temperatures']); assert.equal(form.data.show_temperatures, true); assert.equal(form.computeLabel({ name: 'show_temperatures' }), 'Temperaturen zeigen'); });
