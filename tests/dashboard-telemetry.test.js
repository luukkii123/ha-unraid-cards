'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { ladeKarte } = require('./laden.js');
const { dashboardFixture } = require('./familie-attrappe.js');
function render(name, core = dashboardFixture(), config = {}) { const k = new (ladeKarte([name])[name])(); k._core = core; k._hass = { locale: { language: 'de' } }; k.setConfig({ device_id: 'demo', show_clock: false, show_history: false, ...config }); return k; }
const text = k => k.shadowRoot.querySelector('ha-card').textContent;
test('CPU shows model, package watts and an explicit core disclosure with zero and unknown', () => { const k = render('BuschUnraidCpuCard'); assert.match(text(k), /Example processor/); assert.match(text(k), /18 W/); const summary = k.shadowRoot.querySelector('summary'); assert.match(summary?.textContent || '', /Kern/); const details = k.shadowRoot.querySelector('details'); assert.match(details.textContent, /0.*0 %.*2.*–.*10.*80 %/s); assert.match(text(k), /package-0/); });
test('Server shows product and license from own hardware dashboard', () => { const k = render('BuschUnraidServerCard'); assert.match(text(k), /Example model/); assert.match(text(k), /Example license/); });
test('System shows board, BIOS, disjoint memory parts, available memory and all filesystem rings', () => { const k = render('BuschUnraidSystemCard'); assert.match(text(k), /Example board.*Rev A.*Example firmware.*2.0.*2026-01-01/s); assert.match(text(k), /Verfügbar.*5.*GiB/s); assert.match(text(k), /Cache.*3.*GiB/s); assert.match(text(k), /Puffer.*0 B/s); assert.match(text(k), /System.*3.*GiB/s); assert.equal(k.shadowRoot.querySelectorAll('.ring').length, 4); assert.match(text(k), /Boot.*Log.*Docker/s); });
test('GPU model and driver appear with the indexed measurements', () => { const k = render('BuschUnraidGpuCard'); assert.match(text(k), /Example GPU.*1\.2\.3/s); assert.match(text(k), /10 %/); });
test('Array uses explicit pool members, logical capacities and SMART cache text', () => { const k = render('BuschUnraidArrayCard'); const content = text(k); assert.match(content, /fast-storage-with-a-long-descriptive-name/); assert.match(content, /Beeinträchtigt/); assert.match(content, /1.*TiB.*4.*TiB/s); assert.match(content, /SMART.*Warnung.*Letzter Stand.*2026/s); assert.match(content, /Example health counter.*4/); assert.equal(k.shadowRoot.querySelectorAll('h3').length, 2, 'no duplicate pool member group'); });
test('Share security and streams remain zero and have the Unraid open-path explanation', () => { const k = render('BuschUnraidSharesCard'); assert.match(text(k), /Privat/); assert.match(text(k), /Exportiert/); assert.match(text(k), /Streams.*0/s); assert.match(text(k), /Offene Pfade wie im Unraid-Dashboard/); assert.doesNotMatch(text(k), /Sitzung/); });
test('VM host CPU is separate from unchanged 100 percent per core guest CPU; rates show zero and unknown', () => { const core = dashboardFixture(); const k = render('BuschUnraidVmUsageCard', core); assert.match(text(k), /Gast-CPU.*250 %/s); assert.match(text(k), /Host-CPU.*31,3 %/s); assert.match(text(k), /Netz empfangen.*1,0 KiB\/s/s); assert.match(text(k), /Netz senden.*0 B\/s/s); assert.match(text(k), /Datenträger lesen.*–/s); assert.equal(core.entities.get('sensor.vm_vm_cpu_Example_guest').state, '250'); });
test('Old 0.8 data preserves old cards and gets a concise upgrade hint', () => { for (const name of ['BuschUnraidServerCard', 'BuschUnraidSystemCard', 'BuschUnraidCpuCard', 'BuschUnraidGpuCard', 'BuschUnraidArrayCard', 'BuschUnraidSharesCard', 'BuschUnraidVmUsageCard']) { const k = render(name, dashboardFixture({ legacy: true })); assert.match(text(k), /Unraid SSH.*aktualisieren/s, name); assert.doesNotMatch(text(k), /NaN/); } });
test('Unavailable and unknown dashboard schemas do not expose retained telemetry as current', () => { for (const state of ['unavailable', 'unknown', 'ok']) { const core = dashboardFixture(); const e = core.entities.get('sensor.demo_dashboard_hardware'); e.state = state; if (state === 'ok') e.attributes.schema_version = 99; const k = render('BuschUnraidServerCard', core); assert.doesNotMatch(text(k), /Example model/); assert.match(text(k), /Zusatzdaten.*nicht verfügbar|aktualisieren/s); } });
test('Partial source keeps valid zeroes while missing source is not an empty healthy list', () => { const core = dashboardFixture(); const e = core.entities.get('sensor.demo_dashboard_interfaces'); e.state = 'partial'; e.attributes.failed_sections = ['dash_interfaces']; e.attributes.interfaces = null; const k = render('BuschUnraidInterfaceCard', core); assert.match(text(k), /nicht verfügbar/); assert.doesNotMatch(text(k), /Keine Interfaces/); });
module.exports = { render, text };
test('Docker folder mode never invents a vdisk ring or attributes a pool capacity to Docker', () => { const core = dashboardFixture(); const e = core.entities.get('sensor.demo_dashboard_storage'); e.attributes.docker_mode = 'folder'; e.attributes.filesystems = e.attributes.filesystems.filter(x => x.kind !== 'docker_vdisk'); const k = render('BuschUnraidSystemCard', core); assert.equal(k.shadowRoot.querySelectorAll('.ring').length, 3); assert.match(text(k), /Docker verwendet ein Verzeichnis; keine separate Image-Datei/); });
test('Docker image and unknown modes keep the source distinction explicit', () => { const core = dashboardFixture(); const e = core.entities.get('sensor.demo_dashboard_storage'); e.attributes.docker_mode = 'image'; assert.equal(render('BuschUnraidSystemCard', core).shadowRoot.querySelectorAll('.ring').length, 4); e.attributes.docker_mode = 'unknown'; e.attributes.filesystems = e.attributes.filesystems.filter(x => x.kind !== 'docker_vdisk'); const k = render('BuschUnraidSystemCard', core); assert.match(text(k), /Docker.*unbekannt/i); assert.doesNotMatch(text(k), /keine separate Image-Datei/); });

test('SMART cached epoch time and structured field warnings are readable, not silently dropped', () => { const k = render('BuschUnraidArrayCard'); assert.match(text(k), /Example health counter: 4/); assert.match(text(k), /emhttp_cache/); assert.match(text(k), /2026/); assert.doesNotMatch(text(k), /1767351600/); });
test('Pool names use natural numeric order without adding members to capacities', () => { const core = dashboardFixture(); const e = core.entities.get('sensor.demo_dashboard_storage'); e.attributes.pools = [{name:'pool10',filesystem:'zfs',state:'online',members:[],total_bytes:100,used_bytes:0,free_bytes:100},{name:'pool2',filesystem:'zfs',state:'online',members:[],total_bytes:100,used_bytes:0,free_bytes:100}]; const k = render('BuschUnraidArrayCard', core); const headings = k.shadowRoot.querySelectorAll('h3').map(x => x.textContent); assert.ok(headings.findIndex(x => x.startsWith('pool2')) < headings.findIndex(x => x.startsWith('pool10'))); });

test('CPU core disclosure keeps focus and open state across streamed telemetry renders', () => {
  const core = dashboardFixture(), k = render('BuschUnraidCpuCard', core);
  const old = k.shadowRoot.querySelector('summary'), details = k.shadowRoot.querySelector('details');
  details.open = true; for (const toggle of details.listeners.toggle) toggle(); old.focus();
  core.entities.get('sensor.demo_dashboard_cpu').attributes.cores[0].percent = 17; k._render();
  const current = k.shadowRoot.querySelector('summary');
  assert.notEqual(current, old);
  assert.equal(k.shadowRoot.activeElement, current);
  assert.equal(k.shadowRoot.querySelector('details').open, true);
  assert.match(text(k), /0.*17 %/s);
});

test('Legacy render fixture omits the new parity phase and renders its upgrade fallback', () => {
  const core = dashboardFixture({ legacy: true });
  assert.equal(core.entities.get('binary_sensor.demo_parity_running').attributes.state, undefined);
  const k = render('BuschUnraidParityCard', core);
  assert.match(text(k), /Unraid SSH.*aktualisieren/s);
  assert.match(text(k), /Keine Prüfung aktiv/);
  assert.doesNotMatch(text(k), /pausiert/);
});

test('Partial render fixture nulls failed sources and preserves valid independent telemetry', () => {
  const core = dashboardFixture({ partial: true });
  for (const [name, field, source, state] of [
    ['cpu', 'cores', 'dash_cpu', 'partial'], ['hardware', 'hardware', 'dash_hardware', 'partial'],
    ['storage', 'filesystems', 'dash_storage', 'partial'], ['memory', 'memory', 'dash_memory', 'unavailable'],
    ['interfaces', 'interfaces', 'dash_interfaces', 'unavailable'], ['shares', 'shares', 'dash_shares', 'unavailable'],
    ['vms', 'vms', 'vm_stats', 'unavailable'],
  ]) {
    const entity = core.entities.get('sensor.demo_dashboard_' + name);
    assert.equal(entity.state, state, name);
    assert.equal(entity.attributes[field], null, name);
    assert.deepEqual(entity.attributes.failed_sections, [source], name);
    assert.equal(entity.stateObject.state, state, name + ' HA state');
  }
  const cpu = render('BuschUnraidCpuCard', core), system = render('BuschUnraidSystemCard', core);
  assert.match(text(cpu), /package-0.*18 W/s); assert.doesNotMatch(text(cpu), /Example processor|Kern 0/);
  assert.deepEqual(system.shadowRoot.querySelectorAll('.ring-value').map(ring => ring.textContent), ['40 %', '–', '–', '–']);
  assert.doesNotMatch(text(system), /Example board|5.*GiB/s);
  assert.match(text(render('BuschUnraidServerCard', core)), /Example license/);
  assert.match(text(render('BuschUnraidGpuCard', core)), /Example GPU/);
  assert.match(text(render('BuschUnraidArrayCard', core)), /fast-storage-with-a-long-descriptive-name/);
  const shareCells = render('BuschUnraidSharesCard', core).shadowRoot.querySelectorAll('td');
  assert.deepEqual(shareCells.slice(3).map(cell => cell.textContent), ['Unbekannt', 'Unbekannt', '–']);
  assert.doesNotMatch(text(render('BuschUnraidVmUsageCard', core)), /31,3 %|1,0 KiB\/s/);
  assert.match(text(render('BuschUnraidInterfaceCard', core)), /nicht verfügbar/);
});
