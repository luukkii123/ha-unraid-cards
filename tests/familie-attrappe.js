'use strict';
// Gemeinsame Fixtures der Familienkarten (Stack/Container) und der Docker-Karte,
// dazu Karten mit der DOM-Attrappe (querySelector), damit Kopf und Klassen prüfbar sind.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { Element, dokument } = require('./dom-attrappe.js');

/** Stack „Media“ (web läuft, db gestoppt) und Einzelcontainer „Standalone“. */
function familienFixture() {
  const core = { devices: new Map(), entities: new Map(), getDeviceEntities(id) { return [...this.entities.values()].filter(e => e.device_id === id); } };
  core.devices.set('stack', { id: 'stack', name: 'Media', model: 'Compose stack', config_entries: ['instance'] });
  core.devices.set('solo', { id: 'solo', name: 'Standalone', model: 'Docker container', config_entries: ['instance'] });
  const add = (id, device, role, key, state = 'off', extra = {}) => core.entities.set(id, { entity_id: id, device_id: device, platform: 'unraid_ssh', config_entry_id: 'instance', domain: id.split('.')[0], state, attributes: { kind: role.startsWith('stack') ? 'stack' : 'container', role: role.endsWith('restart') ? 'restart' : role.endsWith('update') ? 'update' : 'control', config_entry_id: 'instance', container_key: key, stack_key: device === 'stack' ? 'media' : null, container_name: key, ...extra }, registry: {} });
  add('switch.renamed', 'stack', 'container', 'web', 'on');
  add('switch.other', 'stack', 'container', 'db', 'off');
  add('switch.stack', 'stack', 'stack', null, 'on');
  add('button.native', 'stack', 'container_restart', 'web', 'unknown');
  add('button.stack', 'stack', 'stack_restart', null, 'unknown');
  add('update.correct', 'stack', 'container_update', 'web', 'on');
  add('update.wrong', 'stack', 'container_update', 'db', 'off');
  add('switch.solo', 'solo', 'container', 'solo', 'on');
  return { core, add };
}

const BILD = (n) => `/api/unraid_ssh/icons/${n}.png`; // echte Integrationsform, kein Fake-Icon
/** Server „Tower“ mit Stacks media/tools, Einzelcontainern und einer VM (für die Docker-Karte). */
function dockerFixture() {
  const core = { devices: new Map(), entities: new Map(), getDeviceEntities(id) { return [...this.entities.values()].filter((e) => e.device_id === id); } };
  core.devices.set('server', { id: 'server', name: 'Tower', model: 'Unraid', config_entries: ['entry'] });
  core.devices.set('media', { id: 'media', name: 'Tower Stack media', model: 'Compose stack', config_entries: ['entry'] });
  core.devices.set('tools', { id: 'tools', name: 'Tower Stack tools', model: 'Compose stack', config_entries: ['entry'] });
  core.devices.set('solo', { id: 'solo', name: 'Tower webserver', model: 'Docker container', config_entries: ['entry'] });
  core.devices.set('paused', { id: 'paused', name: 'Tower cache', model: 'Docker container', config_entries: ['entry'] });
  core.devices.set('gone', { id: 'gone', name: 'Tower broken', model: 'Docker container', config_entries: ['entry'] });
  core.devices.set('vm', { id: 'vm', name: 'Tower VM win', model: 'Virtual machine', config_entries: ['entry'] });
  const ent = (id, device, state, attributes) => core.entities.set(id, { entity_id: id, device_id: device, platform: 'unraid_ssh', config_entry_id: 'entry', domain: id.split('.')[0], state, attributes: { config_entry_id: 'entry', ...attributes }, registry: {} });
  ent('sensor.tower_cpu', 'server', '12', { kind: 'server', role: 'cpu' });
  const container = (key, device, state, extra = {}) => {
    const base = { kind: 'container', container_key: key, container_name: key, stack_name: extra.stack || null, container_state: extra.container_state || (state === 'on' ? 'running' : 'exited'), ...(extra.picture === false ? {} : { entity_picture: BILD(key) }) };
    ent(`switch.${key}`, device, state, { ...base, role: 'control' });
    if (extra.restart !== false) ent(`button.${key}_restart`, device, 'unknown', { ...base, role: 'restart' });
    if (extra.update) ent(`update.${key}`, device, extra.update, { ...base, role: 'update' });
  };
  container('media', 'media', 'on', { stack: 'media', update: 'on' });
  container('media-db', 'media', 'on', { stack: 'media', update: 'off' });
  container('media-worker', 'media', 'off', { stack: 'media', picture: false });
  ent('switch.stack_media', 'media', 'on', { kind: 'stack', role: 'control', stack_key: 'media', stack_name: 'media', running_containers: 2, total_containers: 3 });
  ent('button.stack_media_restart', 'media', 'unknown', { kind: 'stack', role: 'restart', stack_key: 'media' });
  ent('button.stack_media_update_all', 'media', 'unknown', { kind: 'stack', role: 'update_all', stack_key: 'media' });
  container('tools-a', 'tools', 'off', { stack: 'tools', restart: false });
  ent('switch.stack_tools', 'tools', 'off', { kind: 'stack', role: 'control', stack_key: 'tools', stack_name: 'tools', running_containers: 0, total_containers: 1 });
  container('webserver-mit-einem-sehr-langen-namen-der-abgeschnitten-werden-muss', 'solo', 'on', { update: 'off' });
  container('cache', 'paused', 'on', { container_state: 'paused', restart: false });
  container('broken', 'gone', 'unavailable', { picture: false, restart: false });
  ent('switch.vm_win', 'vm', 'on', { kind: 'vm', role: 'control', vm_key: 'win' });
  return core;
}

/**
 * Lädt die Karte mit der DOM-Attrappe (Selektoren, Fokus) und einem schlichten
 * Verlauf. `speicher` (optional) wird als localStorage an `window` gehängt.
 */
function ladeFamilie({ language = 'de', speicher } = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../dist/unraid-cards.js'), 'utf8');
  const registered = new Map();
  const document = dokument(registered), body = document.body;
  const history = { stack: [null], get state() { return this.stack.at(-1); }, pushState(s) { this.stack.push(s); }, back() { this.stack.pop(); } };
  const window = { customCards: [], innerWidth: 1000, innerHeight: 800, addEventListener() {}, removeEventListener() {}, scrollX: 0, scrollY: 0, ...(speicher ? { localStorage: speicher } : {}) };
  const context = { performance, setTimeout, clearTimeout, HTMLElement: Element, customElements: { define: (k, v) => registered.set(k, v), get: (k) => registered.get(k) }, window, history, navigator: { language }, console, CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, document };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.unraidBestaetigen = async () => true; // Dialog im Test ersetzt: zugestimmt
  const pick = vm.runInContext('({buschUnraidDockerModel,buschUnraidServers,buschUnraidSchema,BuschUnraidDockerCard,BuschUnraidDockerEditor,BuschUnraidStackCard,BuschUnraidContainerCard,TEXTE_BUSCH_UNRAID_DOCKER_CARD,SCHEMA_BUSCH_UNRAID_DOCKER_CARD,BUSCH_UNRAID_DOCKER_DEFAULTS})', context);
  return { ...pick, context, registered, body, history };
}

/** Ein Speicher wie localStorage (nur getItem/setItem). */
function speicherAttrappe(start = {}) {
  const daten = new Map(Object.entries(start));
  return { daten, getItem: (k) => (daten.has(k) ? daten.get(k) : null), setItem: (k, v) => { daten.set(k, String(v)); } };
}

/** Stack- oder Container-Karte auf der Familien-Fixture, gerendert. */
function familienKarte(kind, config = {}, optionen = {}) {
  const l = optionen.l || ladeFamilie(optionen), { core } = familienFixture();
  const card = new (kind === 'stack' ? l.BuschUnraidStackCard : l.BuschUnraidContainerCard)();
  card._core = core; card._hass = { locale: { language: optionen.language || 'de' }, callService: async () => {} };
  card.setConfig({ device_id: 'stack', ...(kind === 'container' ? { container_key: 'web' } : {}), ...config });
  card.l = l;
  return card;
}

/** Docker-Karte auf der Docker-Fixture, gerendert. */
function dockerKarte(config = {}, optionen = {}) {
  const l = optionen.l || ladeFamilie(optionen), core = optionen.core || dockerFixture();
  const card = new l.BuschUnraidDockerCard();
  card._core = core; card._hass = { locale: { language: optionen.language || 'de' }, callService: async (...args) => (card.calls ||= []).push(args) };
  card.setConfig({ device_id: 'server', ...config });
  card.l = l;
  return card;
}

module.exports = { familienFixture, dockerFixture, BILD, ladeFamilie, speicherAttrappe, familienKarte, dockerKarte };
