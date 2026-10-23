"use strict";
// Unraid-Server wie unraid_ssh 0.8.0, Werte frei erfunden.
//
// Objektform wie der ECHTE Kern (`BuschEntityIndex.update` in dist/unraid-cards.js):
// Top-Level entity_id, domain, state, stateObject, attributes, platform,
// config_entry_id, device_id, area_id, labels, manufacturer, model,
// entity_category; `registry` ist der rohe Eintrag aus
// `config/entity_registry/list` (unique_id, disabled_by, hidden_by …).
// Deaktivierte Entitäten stehen dort mit `registry.disabled_by` und ohne Zustand
// (`state` undefined) — der Kern liefert sie in `getDeviceEntities` mit.
const ENTRY = 'e1';
function ent(id, suffix, device, state, attributes = {}, entry = ENTRY) {
  const domain = id.split('.')[0];
  const aus = state === undefined;
  const stateObject = aus ? undefined : { entity_id: id, state: String(state), attributes };
  return {
    entity_id: id, domain, registry: { entity_id: id, unique_id: `${entry}_${suffix}`, platform: 'unraid_ssh', config_entry_id: entry, device_id: device, disabled_by: aus ? 'user' : null, hidden_by: null, entity_category: null, labels: [] },
    stateObject, attributes: aus ? {} : attributes, state: aus ? undefined : String(state),
    platform: 'unraid_ssh', config_entry_id: entry, device_id: device, area_id: undefined, floor_id: undefined, labels: [], manufacturer: undefined, model: undefined, entity_category: null,
  };
}
function unraidAttrappe({ gpu = true, fans = true, parity = false, zweiterServer = false, ausfall = false } = {}) {
  const geraet = (id, name, model, entry = ENTRY) => [id, { id, name, name_by_user: null, model, manufacturer: 'Lime Technology', config_entries: [entry], via_device_id: model === 'Unraid' ? null : 'srv' }];
  const devices = new Map([geraet('srv', 'Tower', 'Unraid'), geraet('d1', 'disk1', 'Data disk'), geraet('p1', 'cache', 'Cache disk'), geraet('r1', 'raid', 'Cache disk'), geraet('r2', 'raid2', 'Cache disk'), geraet('f1', 'flash', 'Flash disk'), geraet('sh1', 'appdata', 'Unraid share'), geraet('vm1', 'Windows 11', 'Virtual machine')]);
  if (parity) devices.set(...geraet('par', 'parity', 'Parity disk'));
  const s = v => ausfall ? 'unavailable' : v;
  const list = [ent('sensor.tower_cpu', 'cpu_percent', 'srv', s(24.4)), ent('sensor.tower_ram', 'ram_percent', 'srv', s(67)), ent('sensor.tower_load', 'load_1', 'srv', s(3.2)), ent('sensor.tower_uptime', 'uptime', 'srv', '2026-10-16T14:41:00+00:00'), ent('sensor.tower_array', 'array_state', 'srv', 'started'), ent('sensor.tower_parity_progress', 'parity_progress', 'srv', parity ? 12.5 : 'unknown'), ent('sensor.tower_parity_errors', 'parity_errors', 'srv', 0), ent('sensor.tower_cpu_temp', 'cpu_temp', 'srv', s(89)), ent('sensor.tower_board_temp', 'board_temp', 'srv', 41),
    // Temperaturfühler wie HW_TEMP (has_entity_name, de: „Temperatur {chip} {label}“, chip über chip_display_name, label leer → Kanal):
    // friendly_name = „<Gerät> Temperatur <Chip> <label>“; attrs chip/channel/label roh. Zwei NVMe: gleiches label UND gleicher friendly_name.
    ent('sensor.tower_nvme_composite', 'temp_nvme_pci_0100_temp1', 'srv', 38.5, { chip: 'nvme-pci-0100', channel: 'temp1', label: 'Composite', friendly_name: 'Tower Temperatur NVMe Composite' }),
    ent('sensor.tower_nvme_composite_2', 'temp_nvme_pci_0200_temp1', 'srv', 41.5, { chip: 'nvme-pci-0200', channel: 'temp1', label: 'Composite', friendly_name: 'Tower Temperatur NVMe Composite' }),
    ent('sensor.tower_k10temp_temp3', 'temp_k10temp_pci_00c3_temp3', 'srv', 47, { chip: 'k10temp-pci-00c3', channel: 'temp3', label: '', friendly_name: 'Tower Temperatur CPU temp3' }),
    ent('binary_sensor.tower_array_started', 'array_started', 'srv', 'on'), ent('binary_sensor.tower_parity_running', 'parity_running', 'srv', parity ? 'on' : 'off'), ent('binary_sensor.tower_mover', 'mover_active', 'srv', 'off'),
    ent('sensor.disk1_temp', 'disk_temp_disk1', 'd1', 45), ent('sensor.disk1_usage', 'disk_usage_disk1', 'd1', 97), ent('sensor.disk1_status', 'disk_status_disk1', 'd1', 'ok'), ent('binary_sensor.disk1_spundown', 'disk_spundown_disk1', 'd1', 'off'),
    ent('sensor.cache_temp', 'disk_temp_cache', 'p1', 51), ent('sensor.cache_usage', 'disk_usage_cache', 'p1', 45), ent('sensor.cache_status', 'disk_status_cache', 'p1', 'ok'),
    ent('sensor.raid_temp', 'disk_temp_raid', 'r1', 44), ent('sensor.raid_usage', 'disk_usage_raid', 'r1', 60), ent('sensor.raid_status', 'disk_status_raid', 'r1', 'ok'), ent('sensor.raid2_temp', 'disk_temp_raid2', 'r2', 50), ent('sensor.raid2_status', 'disk_status_raid2', 'r2', 'ok'),
    ent('sensor.flash_usage', 'disk_usage_flash', 'f1', 35), ent('sensor.flash_status', 'disk_status_flash', 'f1', 'ok'),
    ent('sensor.appdata_used', 'share_used_appdata', 'sh1', 120.5, { unit_of_measurement: 'GB' }), ent('sensor.appdata_free', 'share_free_appdata', 'sh1', 450, { unit_of_measurement: 'GB' }),
    ent('sensor.win_state', 'vm_state_Windows 11', 'vm1', 'running'), ent('sensor.win_cpu', 'vm_cpu_Windows 11', 'vm1', 36), ent('sensor.win_ram_used', 'vm_ram_used_Windows 11', 'vm1', 17179869184), ent('sensor.win_ram_alloc', 'vm_ram_allocated_Windows 11', 'vm1', 17179869184),
    // deaktiviert (z. B. vom Nutzer abgeschaltet): im Register, ohne Zustand
    ent('sensor.tower_load_5', 'load_5', 'srv', undefined)];
  if (gpu) list.push(ent('sensor.gpu_util', 'gpu_util_0', 'srv', 19), ent('sensor.gpu_vram', 'gpu_vram_0', 'srv', 9), ent('sensor.gpu_temp', 'gpu_temp_0', 'srv', 52), ent('sensor.gpu_power', 'gpu_power_0', 'srv', 78), ent('sensor.gpu_fan', 'gpu_fan_0', 'srv', 31));
  if (fans) list.push(ent('sensor.fan4', 'fan_nct6798_fan4_rpm', 'srv', 922, { label: 'FAN 4' }), ent('sensor.fan6', 'fan_nct6798_fan6_rpm', 'srv', 4821, { label: 'FAN 6' }), ent('sensor.fan6p', 'fan_nct6798_fan6_percent', 'srv', 100, { label: 'FAN 6' }));
  if (parity) list.push(ent('sensor.parity_temp', 'disk_temp_parity', 'par', 40), ent('sensor.parity_status', 'disk_status_parity', 'par', 'ok'));
  if (zweiterServer) {
    devices.set(...geraet('srv2', 'Backup', 'Unraid', 'e2'));
    devices.set(...geraet('d2', 'backupdisk', 'Data disk', 'e2'));
    list.push(ent('sensor.backup_cpu', 'cpu_percent', 'srv2', 5, {}, 'e2'), ent('sensor.backupdisk_temp', 'disk_temp_backupdisk', 'd2', 33, {}, 'e2'));
  }
  for (const e of list) { const d = devices.get(e.device_id); e.model = d?.model; e.manufacturer = d?.manufacturer; }
  const entities = new Map(list.map(e => [e.entity_id, e]));
  return { devices, entities, getEntity: id => entities.get(id), getDevice: id => devices.get(id), getDeviceEntities: id => list.filter(e => e.device_id === id), attach() {}, retain() { return () => {}; }, watch() { return () => {}; } };
}
module.exports = { unraidAttrappe, ENTRY };
