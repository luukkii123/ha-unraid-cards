'use strict';
// M48 (#1299, P9): every editor of the bundle feeds its ha-form only when its key (configuration, language and, for the
// family/Docker editors, the device-dependent schema) changes. A foreign update (new hass, same language, same devices)
// sets no schema, data, computeLabel or computeHelper; label functions stay the same per language. Only `hass` is passed on.
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { dockerFixture } = require('./familie-attrappe.js');

const Ereignis = class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
const FELDER = ['schema', 'data', 'computeLabel', 'computeHelper'];
const lib = ladeKarte(['UNRAID_KACHELN', 'BuschUnraidStackEditor', 'BuschUnraidContainerEditor', 'BuschUnraidVmEditor', 'BuschUnraidDockerEditor'], { CustomEvent: Ereignis });

/** Counts property sets on the editor's ha-form (also `hass`, which may be set every time). */
function zaehle(form) {
  const n = { hass: 0 }; for (const f of FELDER) n[f] = 0;
  for (const key of Object.keys(n)) {
    let wert = form[key];
    Object.defineProperty(form, key, { configurable: true, get: () => wert, set: v => { n[key]++; wert = v; } });
  }
  n.summe = () => FELDER.reduce((s, f) => s + n[f], 0);
  return n;
}

const fremd = (hass, i) => ({ ...hass, locale: { ...hass.locale }, states: { [`sensor.fremd_${i}`]: { state: String(i) } } });

function kern() { const core = dockerFixture(); core.attach = () => {}; return core; }

/** All 17 editors: 13 tile editors from UNRAID_KACHELN plus stack, container, VM and Docker. */
function editoren() {
  const liste = lib.UNRAID_KACHELN.map(([tag, Card, Editor]) => ({ name: tag, neu: () => new Editor(), config: Card.getStubConfig() }));
  for (const [name, Editor, config] of [['stack', lib.BuschUnraidStackEditor, { device_id: 'media' }], ['container', lib.BuschUnraidContainerEditor, { device_id: 'solo' }], ['vm', lib.BuschUnraidVmEditor, { device_id: 'server' }], ['docker', lib.BuschUnraidDockerEditor, { device_id: 'server' }]])
    liste.push({ name, neu: () => { const e = new Editor(); e._core = kern(); return e; }, config });
  return liste;
}

test('M48: 17 Editoren im Vertragstest', () => { assert.equal(editoren().length, 17); });

for (const ed of editoren()) {
  test(`M48: ${ed.name} – 0 Schema-/Daten-/Label-Sets je fremdem Update, hass wird weitergereicht`, () => {
    let hass = { locale: { language: 'de' }, language: 'de' };
    const e = ed.neu(); e.hass = hass; e.setConfig(ed.config);
    const form = e.querySelector('ha-form'); assert.ok(form, 'ha-form');
    const label = form.computeLabel, helper = form.computeHelper, n = zaehle(form);
    for (let i = 0; i < 5; i++) { hass = fremd(hass, i); e.hass = hass; }
    assert.equal(n.summe(), 0, JSON.stringify(n));
    assert.equal(n.hass, 5, 'ha-form gets every hass');
    assert.equal(form.hass, hass);
    assert.equal(form.computeLabel, label); assert.equal(form.computeHelper, helper);
  });

  test(`M48: ${ed.name} – eigene Änderungen versorgen weiter (Sprache, Konfiguration)`, () => {
    const e = ed.neu(); e.hass = { locale: { language: 'de' }, language: 'de' }; e.setConfig(ed.config);
    const form = e.querySelector('ha-form'), n = zaehle(form), deLabel = form.computeLabel({ name: 'title' });
    const en = { locale: { language: 'en' }, language: 'en' }; e.hass = en;
    assert.equal(n.schema, 1, 'language → new schema'); assert.equal(n.computeLabel, 1); assert.equal(n.computeHelper, 1);
    assert.equal(n.data, 0, 'data unchanged by language');
    const enLabel = form.computeLabel({ name: 'title' }); assert.ok(enLabel); if (ed.name !== 'docker') assert.notEqual(enLabel, deLabel);
    const enFn = form.computeLabel; e.hass = fremd(en, 1); assert.equal(form.computeLabel, enFn, 'same function per language');
    e.setConfig({ ...ed.config, title: 'Neu' });
    assert.equal(n.data, 1, 'config → new data'); assert.equal(form.data.title, 'Neu');
    assert.equal(n.schema, 1, 'title does not change the schema');
  });
}

test('M48: Geräteliste ändert sich → Stack-, Container- und Docker-Editor bekommen ein neues Schema', () => {
  for (const [Editor, config, geraet] of [[lib.BuschUnraidStackEditor, { device_id: 'media' }, { id: 'neu', name: 'Tower Stack neu', model: 'Compose stack', config_entries: ['entry'] }],
    [lib.BuschUnraidContainerEditor, { device_id: 'solo' }, { id: 'neu', name: 'Tower neu', model: 'Docker container', config_entries: ['entry'] }],
    [lib.BuschUnraidDockerEditor, { device_id: 'server' }, { id: 'neu', name: 'Backup', model: 'Unraid', config_entries: ['entry2'] }]]) {
    const hass = { locale: { language: 'de' }, language: 'de' }, e = new Editor(), core = kern(); e._core = core; e.hass = hass; e.setConfig(config);
    const form = e.querySelector('ha-form'), n = zaehle(form);
    core.devices.set(geraet.id, geraet);
    core.entities.set('switch.neu', { entity_id: 'switch.neu', device_id: geraet.id, platform: 'unraid_ssh', config_entry_id: geraet.config_entries[0], domain: 'switch', state: 'on', attributes: { kind: geraet.model === 'Unraid' ? 'server' : geraet.model === 'Compose stack' ? 'stack' : 'container', role: 'control', config_entry_id: geraet.config_entries[0] }, registry: {} });
    e.hass = fremd(hass, 1);
    assert.equal(n.schema, 1, geraet.model);
    assert.ok(JSON.stringify(form.schema).includes(geraet.name), geraet.model);
    assert.equal(n.data, 0); assert.equal(n.computeLabel, 0);
  }
});

test('M48: value-changed schreibt die Konfiguration und versorgt data einmal', () => {
  const hass = { locale: { language: 'de' }, language: 'de' }, e = new lib.UNRAID_KACHELN[0][2](); e.hass = hass; e.setConfig(lib.UNRAID_KACHELN[0][1].getStubConfig());
  const form = e.querySelector('ha-form'), n = zaehle(form);
  for (const fn of [].concat(form.listeners['value-changed'])) fn({ stopPropagation() {}, detail: { value: { ...form.data, title: 'Neu' } } });
  assert.equal(e.event.detail.config.title, 'Neu'); assert.equal(n.data, 1); assert.equal(form.data.title, 'Neu');
  e.setConfig(e.event.detail.config); assert.equal(n.data, 1, 'echo of own config: no second data set');
  e.hass = fremd(hass, 1); assert.equal(n.summe(), 1);
});
