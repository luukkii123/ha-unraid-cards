'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { unraidAttrappe } = require('./attrappe.js');

// Capacity entities deliberately have unrelated entity_ids and translated device names.
function fixture() {
  const core = unraidAttrappe({ parity: true, zweiterServer: true });
  core.getDeviceEntities = id => [...core.entities.values()].filter(e => e.device_id === id);
  let serial = 0;
  function capacity(device, name, used, total, unit = 'GiB', entry = 'e1') {
    for (const [role, value] of [['used', used], ['total', total]]) {
      const id = 'sensor.renamed_' + serial++;
      core.entities.set(id, { entity_id: id, domain: 'sensor', device_id: device, platform: 'unraid_ssh', config_entry_id: entry,
        state: value == null ? value : String(value), attributes: { unit_of_measurement: unit },
        registry: { unique_id: `${entry}_disk_${role}_${name}` } });
    }
  }
  function disk(id, name, model = 'Data disk') {
    core.devices.set(id, { id, name: 'Übersetzter Gerätename', model, config_entries: ['e1'], via_device_id: 'srv' });
    const eid = 'sensor.status_' + serial++;
    core.entities.set(eid, { entity_id: eid, device_id: id, platform: 'unraid_ssh', config_entry_id: 'e1',
      state: 'ok', attributes: {}, registry: { unique_id: `e1_disk_status_${name}` } });
  }
  return { core, capacity, disk };
}
function headings(f, language = 'de', config = {}) {
  const { BuschUnraidArrayCard } = ladeKarte(['BuschUnraidArrayCard']);
  const card = new BuschUnraidArrayCard(); card._core = f.core;
  card._hass = { locale: { language } }; card.setConfig({ device_id: 'srv', ...config }); card._render();
  return [...card.shadowRoot.querySelectorAll('h3')].map(h => h.textContent);
}

test('Array sums differently sized data filesystems, excludes parity and another server', () => {
  const f = fixture(); f.capacity('d1', 'disk1', 512, 1024); f.disk('d3', 'disk2');
  f.capacity('d3', 'disk2', 256, 512); f.capacity('par', 'parity', 9000, 10000);
  f.capacity('d2', 'backupdisk', 9000, 10000, 'GiB', 'e2');
  assert.equal(headings(f)[0], 'Array · 768 GiB von 1,5 TiB');
});
test('Pools count one logical filesystem, even when member capacity is duplicated', () => {
  const f = fixture(); f.capacity('p1', 'cache', 100, 200); f.capacity('r1', 'raid', 512, 1024);
  f.capacity('r2', 'raid2', 512, 1024); f.disk('r3', 'raid3', 'Cache disk');
  assert.deepEqual(headings(f).slice(1, 3), ['cache · 100 GiB von 200 GiB', 'raid · 512 GiB von 1,0 TiB']);
});
test('A pool with no canonical device uses its sole filesystem source and refuses ambiguous sources', () => {
  const f = fixture(); f.core.devices.delete('r1'); f.capacity('r2', 'raid2', 5, 10);
  assert.ok(headings(f).includes('raid · 5,0 GiB von 10 GiB'));
  f.disk('r3', 'raid3', 'Cache disk'); f.capacity('r3', 'raid3', 5, 10);
  assert.ok(headings(f).includes('raid · –'));
});
test('Pools without filesystem data stay unknown; canonical outage cannot use a stale member', () => {
  const f = fixture(); assert.ok(headings(f).includes('raid · –'));
  f.capacity('r1', 'raid', 'unavailable', 'unavailable'); f.capacity('r2', 'raid2', 5, 10);
  assert.ok(headings(f).includes('raid · –'));
});
test('A missing or invalid data disk makes the whole array capacity unknown', () => {
  for (const [used, total] of [[null, 20], ['unknown', 20], ['unavailable', 20], ['', 20], [' ', 20], ['NaN', 20], ['Infinity', 20], [-1, 20], [21, 20], [1, -20], [1, null], [true, 20]]) {
    const f = fixture(); f.capacity('d1', 'disk1', 5, 10); f.disk('missing', 'disk2'); f.capacity('missing', 'disk2', used, total);
    assert.equal(headings(f)[0], 'Array · –', `${used}/${total}`);
  }
  const f = fixture(); f.capacity('d1', 'disk1', 5, 10); f.disk('missing', 'disk2');
  assert.equal(headings(f)[0], 'Array · –');
});
test('Measured zero stays zero; disabled sensors and missing units stay unknown', () => {
  const f = fixture(); f.capacity('d1', 'disk1', 0, 10); assert.equal(headings(f)[0], 'Array · 0 B von 10 GiB');
  const used = [...f.core.entities.values()].find(e => e.registry?.unique_id === 'e1_disk_used_disk1');
  used.registry.disabled_by = 'user'; assert.equal(headings(f)[0], 'Array · –');
  delete used.registry.disabled_by; delete used.attributes.unit_of_measurement;
  assert.equal(headings(f)[0], 'Array · –');
});
test('HA binary and decimal data size units are converted before summing', () => {
  for (const [unit, used, total, expected] of [
    ['B', 512, 1024, '512 B von 1,0 KiB'], ['KiB', 512, 1024, '512 KiB von 1,0 MiB'],
    ['MiB', 512, 1024, '512 MiB von 1,0 GiB'], ['GiB', 512, 1024, '512 GiB von 1,0 TiB'],
    ['GB', 1.073741824, 2.147483648, '1,0 GiB von 2,0 GiB'], ['TB', 1.099511627776, 2.199023255552, '1,0 TiB von 2,0 TiB']
  ]) { const f = fixture(); f.capacity('d1', 'disk1', used, total, unit); assert.equal(headings(f)[0], 'Array · ' + expected); }
  const f = fixture(); f.capacity('d1', 'disk1', 512, 1024, 'MiB'); f.disk('d3', 'disk2'); f.capacity('d3', 'disk2', 512 * 1024, 1024 * 1024, 'KiB');
  assert.equal(headings(f)[0], 'Array · 1,0 GiB von 2,0 GiB');
});
test('Boot capacity is separate, translated, and hidden by show_boot=false', () => {
  const f = fixture(); f.capacity('f1', 'flash', 1, 2);
  assert.equal(headings(f).at(-1), 'Boot · 1,0 GiB von 2,0 GiB');
  assert.equal(headings(f, 'en').at(-1), 'Boot · 1.0 GiB used of 2.0 GiB');
  assert.ok(headings(f, 'de', { show_boot: false }).every(h => !h.startsWith('Boot')));
});
test('Capacity-only entities retain raw disk identity', () => {
  const f = fixture(); f.disk('d3', 'disk2');
  for (const [id, e] of f.core.entities) if (e.device_id === 'd3') f.core.entities.delete(id);
  f.capacity('d1', 'disk1', 5, 10); f.capacity('d3', 'disk2', 5, 10);
  assert.equal(headings(f)[0], 'Array · 10 GiB von 20 GiB');
});
