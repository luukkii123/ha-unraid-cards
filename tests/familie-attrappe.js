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

/** Entirely synthetic Stage 2 registry/state fixture; no host inventory. */
function dashboardFixture({ legacy = false, second = false, partial = false } = {}) {
  const devices = new Map(), entities = new Map();
  const device = (id, name, model, entry) => devices.set(id, { id, name, name_by_user: null, model, manufacturer: 'Lime Technology', config_entries: [entry], via_device_id: model === 'Unraid' ? null : 'demo' });
  function add(suffix, state, attributes = {}, id = 'demo', entry = 'example-entry', domain = 'sensor') {
    const entity_id = `${domain}.${id}_${suffix.replace(/[^a-z0-9_]/gi, '_')}`, d = devices.get(id);
    const registry = { entity_id, unique_id: `${entry}_${suffix}`, platform: 'unraid_ssh', config_entry_id: entry, device_id: id, disabled_by: null, hidden_by: null, entity_category: null, labels: [] };
    const e = { entity_id, domain, registry, state: String(state), attributes, stateObject: { entity_id, state: String(state), attributes }, platform: 'unraid_ssh', config_entry_id: entry, device_id: id, model: d.model, manufacturer: d.manufacturer, entity_category: null, labels: [] };
    entities.set(entity_id, e); return e;
  }
  device('demo', 'Example server', 'Unraid', 'example-entry');
  device('disk', 'Example server disk disk1', 'Data disk', 'example-entry');
  device('pool', 'Example server disk fast-storage', 'Cache disk', 'example-entry');
  device('member', 'Example server disk member-extra', 'Cache disk', 'example-entry');
  device('vm', 'Example server VM Example guest', 'Virtual machine', 'example-entry');
  device('share', 'Example server Share documents', 'Unraid share', 'example-entry');
  add('cpu_percent', 25); add('ram_percent', 40); add('array_state', 'started'); add('mover_active', 'off', {}, 'demo', 'example-entry', 'binary_sensor');
  add('parity_running', 'off', legacy ? {} : { state: 'paused' }, 'demo', 'example-entry', 'binary_sensor'); add('parity_progress', 25); add('parity_errors', 0);
  add('disk_status_disk1', 'ok', {}, 'disk'); add('disk_usage_disk1', 50, {}, 'disk'); add('disk_total_disk1', 1024, { unit_of_measurement: 'GiB' }, 'disk'); add('disk_used_disk1', 512, { unit_of_measurement: 'GiB' }, 'disk');
  add('disk_status_fast-storage', 'ok', {}, 'pool'); add('disk_status_member-extra', 'ok', {}, 'member');
  add('share_used_documents', 2, { unit_of_measurement: 'GiB' }, 'share'); add('share_free_documents', 6, { unit_of_measurement: 'GiB' }, 'share');
  add('vm_state_Example guest', 'running', {}, 'vm'); add('vm_cpu_Example guest', 250, {}, 'vm'); add('vm_ram_used_Example guest', 1024, { unit_of_measurement: 'MiB' }, 'vm'); add('vm_ram_allocated_Example guest', 2048, { unit_of_measurement: 'MiB' }, 'vm');
  add('gpu_util_0', 10); add('gpu_temp_0', 40);
  if (!legacy) {
    const dashboard = (suffix, attributes) => add('dashboard_' + suffix, 'ok', { schema_version: 1, sampled_at: { dash_example_source: 12345.0 }, failed_sections: [], ...attributes });
    dashboard('cpu', { cores: [{ id: 0, percent: 0 }, { id: 2, percent: null }, { id: 10, percent: 80 }], packages: [{ id: 'package-0', power_w: 18, source: 'rapl' }] }); add('cpu_power', 18, { unit_of_measurement: 'W' });
    dashboard('hardware', { hardware: { board_vendor: 'Example vendor', board_name: 'Example board', board_version: 'Rev A', bios_vendor: 'Example firmware', bios_version: '2.0', bios_date: '2026-01-01', product_name: 'Example model', cpu_model: 'Example processor' }, registration: 'Example license', gpus: [{ index: 0, model: 'Example GPU', driver_version: '1.2.3' }] });
    dashboard('memory', { memory: { total_bytes: 8 * 1024**3, available_bytes: 5 * 1024**3, free_bytes: 2 * 1024**3, cache_bytes: 3 * 1024**3, buffers_bytes: 0, system_bytes: 3 * 1024**3 } });
    dashboard('storage', { docker_mode: 'image', filesystems: ['boot', 'log', 'docker_vdisk'].map((kind, i) => ({ kind, total_bytes: 1024**3, used_bytes: i * 1024**3 / 4, free_bytes: (4-i) * 1024**3 / 4, percent: i * 25 })), pools: [{ name: 'fast-storage-with-a-long-descriptive-name', filesystem: 'btrfs', state: 'degraded', members: ['fast-storage', 'member-extra'], total_bytes: 4 * 1024**4, used_bytes: 1024**4, free_bytes: 3 * 1024**4 }] });
    dashboard('interfaces', { interfaces: [{ id: '65746832', name: 'eth2', kind: 'physical', state: 'up', mtu: 1500, speed_mbps: 1000, rx_bytes_s: 0, tx_bytes_s: 1024 }, { id: '6574683130', name: 'eth10', kind: 'physical', state: 'down', mtu: 9000, speed_mbps: null, rx_bytes_s: null, tx_bytes_s: null }, { id: '62722d64656d6f', name: 'br-demo-with-a-very-long-interface-name', kind: 'bridge', state: 'up', mtu: 1500, speed_mbps: null, rx_bytes_s: 2048, tx_bytes_s: 0 }] });
    dashboard('shares', { shares: [{ name: 'documents', exported: true, security: 'private', streams: 0 }] });
    dashboard('vms', { vms: [{ name: 'Example guest', host_cpu_percent: 31.25, net_rx_bytes_s: 1024, net_tx_bytes_s: 0, disk_read_bytes_s: null, disk_write_bytes_s: 4096 }] });
    add('disk_smart_disk1', 'warning', { sampled_at: 1767351600, source: 'emhttp_cache', stale: true, details: [{ field: 'Example health counter', value: 4 }] }, 'disk');
    for (const suffix of ['server_reboot', 'server_shutdown', 'array_start', 'array_stop', 'parity_start', 'parity_pause', 'parity_resume', 'parity_cancel', 'spindown_all', 'mover_start']) add(suffix, 'unknown', {}, 'demo', 'example-entry', 'button');
  }
  if (second) { device('other', 'Other example', 'Unraid', 'other-entry'); add('cpu_percent', 1, {}, 'other', 'other-entry'); add('dashboard_interfaces', 'ok', { schema_version: 1, interfaces: [{ name: 'foreign-interface', kind: 'physical' }] }, 'other', 'other-entry'); add('server_reboot', 'unknown', {}, 'other', 'other-entry', 'button'); }
  if (partial && !legacy) {
    // Failed sources expose null; independent successful sources keep their data.
    for (const [suffix, field, source, state, validSources] of [
      ['cpu', 'cores', 'dash_cpu', 'partial', ['dash_power']],
      ['hardware', 'hardware', 'dash_hardware', 'partial', ['dash_gpu', 'var']],
      ['storage', 'filesystems', 'dash_storage', 'partial', ['dash_pools', 'dash_docker']],
      ['memory', 'memory', 'dash_memory', 'unavailable', []],
      ['interfaces', 'interfaces', 'dash_interfaces', 'unavailable', []],
      ['shares', 'shares', 'dash_shares', 'unavailable', []],
      ['vms', 'vms', 'vm_stats', 'unavailable', []],
    ]) {
      const e = entities.get('sensor.demo_dashboard_' + suffix);
      e.state = e.stateObject.state = state;
      e.attributes[field] = null;
      e.attributes.failed_sections = [source];
      e.attributes.sampled_at = Object.fromEntries(validSources.map(key => [key, 12345.0]));
    }
  }
  return { devices, entities, add, getDevice: id => devices.get(id), getEntity: id => entities.get(id), getDeviceEntities: id => [...entities.values()].filter(e => e.device_id === id), attach() {}, retain() { return () => {}; }, watch() { return () => {}; } };
}
module.exports.dashboardFixture = dashboardFixture;

/** Stage 3, wholly invented inventory; count states deliberately include zero. */
function inventoryFixture(options = {}) {
  const core = dashboardFixture(options);
  if (!options.legacy) {
    const add = (key, list, extra = {}) => core.add('dashboard_' + key, list.length, { schema_version: 1, sampled_at: { ['inv_' + key]: 12345 }, failed_sections: [], [key === 'users' ? 'users' : 'devices']: list, ...extra });
    add('users', [{ name: 'user10', description: 'Example description', protected: false, read_shares: 2, write_shares: 0 }, { name: 'root', description: 'Example administrator', protected: true, read_shares: null, write_shares: null }, { name: 'user2', description: '<img src=x onerror=alert(1)>', protected: true, read_shares: 3, write_shares: 1 }], { smb_enabled: true, unprotected_count: 1 });
    add('usb', [{ id: '1-10', port: '1-10', name: 'Example remote adapter', state: 'remote', remote_host: 'example.invalid', assigned_vm: null }, { id: '1-2', port: '1-2', name: 'Example keyboard', state: 'host', speed_mbps: 12 }, { id: '1-3', port: '1-3', name: 'Example camera', state: 'vm', assigned_vm: 'Example guest', assignment_source: 'libvirt' }, { id: 'usb1', port: 'usb1', name: 'Example hub', state: 'host', is_hub: true }], { mapping_status: 'ok' });
    add('coral', [{ id: '0000:02:00.0', name: 'Coral TPU 1', transport: 'pci', state: 'ready', temperature_c: 42, driver_version: '1.2' }, { id: '1-4', name: 'Example USB Coral', transport: 'usb', state: 'unknown', temperature_c: null }, { id: '0000:03:00.0', name: 'Coral TPU 2', transport: 'pci', state: 'error', temperature_c: null }]);
  }
  if (options.second) {
    for (const key of ['users', 'usb', 'coral']) core.add('dashboard_' + key, 1, { schema_version: 1, failed_sections: [], [key === 'users' ? 'users' : 'devices']: [{ name: 'FOREIGN', port: 'FOREIGN' }] }, 'other', 'other-entry');
  }
  return core;
}
module.exports.inventoryFixture = inventoryFixture;
