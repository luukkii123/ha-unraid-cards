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
test('System: Fühlername aus friendly_name ohne Gerät, eindeutig, sonst label/Kanal; abschaltbar', () => {
  const { BuschUnraidSystemCard } = ladeKarte(['BuschUnraidSystemCard']); const core = unraidAttrappe();
  const namen = k => [...k.shadowRoot.querySelectorAll('.cell-name')].map(n => n.textContent), werte = k => [...k.shadowRoot.querySelectorAll('.cell-value')].map(n => n.textContent);
  let k = rendere(BuschUnraidSystemCard, core); const n = namen(k);
  assert.ok(n.includes('Temperatur CPU temp3')); assert.ok(werte(k).includes('38,5 °C'));
  // zwei NVMe mit gleichem label („Composite“) und gleichem friendly_name bleiben unterscheidbar
  const nvme = n.filter(x => x.includes('NVMe Composite')); assert.equal(nvme.length, 2); assert.equal(new Set(nvme).size, 2); assert.ok(nvme.every(x => !x.startsWith('Tower ')));
  assert.ok(nvme.includes('Temperatur NVMe Composite (nvme-pci-0100)')); assert.ok(nvme.includes('Temperatur NVMe Composite (nvme-pci-0200)'));
  const k10 = core.entities.get('sensor.tower_k10temp_temp3').attributes; k10.friendly_name = 'Towerchen eigener Name'; k = rendere(BuschUnraidSystemCard, core); assert.ok(namen(k).includes('Towerchen eigener Name'));
  k10.label = 'Tctl'; delete k10.friendly_name; k = rendere(BuschUnraidSystemCard, core); assert.ok(namen(k).includes('Tctl'));
  k10.label = ''; k = rendere(BuschUnraidSystemCard, core); assert.ok(namen(k).includes('temp3'));
  k = rendere(BuschUnraidSystemCard, core, { show_temperatures: false }); assert.equal(k.shadowRoot.querySelector('.grid'), null); assert.doesNotMatch(k.shadowRoot.textContent, /Temperaturen/);
});
test('Raster: jede Zelle trägt den vollen Namen als title', () => {
  const { BuschUnraidSystemCard } = ladeKarte(['BuschUnraidSystemCard']); const k = rendere(BuschUnraidSystemCard, unraidAttrappe());
  const zellen = [...k.shadowRoot.querySelectorAll('.cell-name')]; assert.ok(zellen.length >= 5); for (const z of zellen) assert.equal(z.title, z.textContent);
});
test('System: ohne Fühler und Werte Leerhinweis, nur bei eingeschalteten Temperaturen', () => {
  const { BuschUnraidSystemCard } = ladeKarte(['BuschUnraidSystemCard']); const core = unraidAttrappe({ ausfall: true });
  const weg = id => { core.entities.delete(id); }; for (const id of ['sensor.tower_nvme_composite', 'sensor.tower_nvme_composite_2', 'sensor.tower_k10temp_temp3']) weg(id);
  core.entities.get('sensor.tower_board_temp').state = 'unknown'; core.entities.get('sensor.tower_board_temp').stateObject.state = 'unknown';
  const alt = core.getDeviceEntities; core.getDeviceEntities = id => alt(id).filter(e => !e.entity_id.includes('nvme') && !e.entity_id.includes('k10temp'));
  let k = rendere(BuschUnraidSystemCard, core); assert.match(k.shadowRoot.textContent, /Keine Temperaturfühler\./); assert.equal(k.shadowRoot.querySelector('.grid'), null);
  k = rendere(BuschUnraidSystemCard, core, { show_temperatures: false }); assert.doesNotMatch(k.shadowRoot.textContent, /Keine Temperaturfühler/);
  assert.doesNotMatch(rendere(BuschUnraidSystemCard, unraidAttrappe()).shadowRoot.textContent, /Keine Temperaturfühler/);
});
test('System-Editor: Schema und Texte', () => { const { BuschUnraidSystemCardEditor } = ladeKarte(['BuschUnraidSystemCardEditor']); const e = new BuschUnraidSystemCardEditor(); e.hass = { locale: { language: 'de' } }; e.setConfig({ type: 'custom:busch-unraid-system-card' }); const form = e.querySelector('ha-form'); assert.deepEqual(form.schema.map(s => s.name), ['device_id', 'title', 'show_temperatures']); assert.equal(form.data.show_temperatures, true); assert.equal(form.computeLabel({ name: 'show_temperatures' }), 'Temperaturen zeigen'); });
test('CPU: Balken, Temperatur, Load', () => { const { BuschUnraidCpuCard } = ladeKarte(['BuschUnraidCpuCard']); const txt = rendere(BuschUnraidCpuCard, unraidAttrappe()).shadowRoot.textContent; assert.match(txt, /24 %/); assert.match(txt, /89 °C/); assert.match(txt, /3,2/); });
test('Verlauf: history_during_period, höchstens einmal je Minute', async () => { const { unraidVerlauf } = ladeKarte(['unraidVerlauf']); let n = 0; const hass = { callWS: async m => { n++; assert.equal(m.type, 'history/history_during_period'); assert.equal(m.minimal_response, true); return { 'sensor.tower_cpu': [{ s: '10', lu: 1 }, { s: 'unavailable', lu: 2 }, { s: '30', lu: 3 }] }; } }; const a = await unraidVerlauf(hass, 'sensor.tower_cpu', 10); assert.deepEqual(a.map(p => p.v), [10, 30]); await unraidVerlauf(hass, 'sensor.tower_cpu', 10); assert.equal(n, 1); });
test('Linie: leere Punkte ergeben Hinweis statt SVG-Fehler', () => { const { unraidLinie } = ladeKarte(['unraidLinie']); assert.ok(unraidLinie([], 'Keine Daten').textContent.includes('Keine Daten')); });
test('Verlauf: gleichzeitige Abrufe teilen sich einen Aufruf, Zeitraum zählt getrennt', async () => {
  const { unraidVerlauf } = ladeKarte(['unraidVerlauf']); let n = 0; const hass = { callWS: async () => { n++; return { 'sensor.tower_cpu': [{ s: '5', lu: 1 }, { s: '7', lu: 2 }] }; } };
  await Promise.all([unraidVerlauf(hass, 'sensor.tower_cpu', 10), unraidVerlauf(hass, 'sensor.tower_cpu', 10)]); assert.equal(n, 1);
  await unraidVerlauf(hass, 'sensor.tower_cpu', 30); assert.equal(n, 2);
});
test('Linie: SVG-Pfad über die Punkte, Beschriftung für Screenreader', () => { const { unraidLinie } = ladeKarte(['unraidLinie']); const svg = unraidLinie([{ t: 0, v: 0 }, { t: 10, v: 100 }], 'Keine Daten', 'Gesamtlast'); assert.equal(svg.getAttribute('role'), 'img'); assert.equal(svg.getAttribute('aria-label'), 'Gesamtlast'); assert.equal(svg.childNodes[0].getAttribute('d'), 'M0.00,30.00 L100.00,0.00'); });
test('CPU: ohne callWS kein Verlauf und kein Fehler; mit callWS Linie, Abschaltung wirkt', async () => {
  const { BuschUnraidCpuCard } = ladeKarte(['BuschUnraidCpuCard']); assert.equal(rendere(BuschUnraidCpuCard, unraidAttrappe()).shadowRoot.querySelector('.history'), null);
  let abfrage; const k = new BuschUnraidCpuCard(); k._core = unraidAttrappe(); k._hass = { locale: { language: 'de' }, callWS: async m => { abfrage = m; return { 'sensor.tower_cpu': [{ s: '20', lu: 1 }, { s: '40', lu: 61 }] }; } }; k.setConfig({ history_minutes: '30' });
  await new Promise(r => setImmediate(r)); assert.deepEqual(abfrage.entity_ids, ['sensor.tower_cpu']); assert.ok(k.shadowRoot.querySelector('.history').childNodes[0].getAttribute('class') === 'line');
  k.setConfig({ show_history: false }); assert.equal(k.shadowRoot.querySelector('.history'), null);
});
test('CPU: fehlgeschlagener Verlauf zeigt Hinweis', async () => {
  const { BuschUnraidCpuCard } = ladeKarte(['BuschUnraidCpuCard']); const k = new BuschUnraidCpuCard(); k._core = unraidAttrappe(); k._hass = { locale: { language: 'de' }, callWS: async () => { throw new Error('weg'); } }; k.setConfig({});
  await new Promise(r => setImmediate(r)); assert.match(k.shadowRoot.querySelector('.history').textContent, /Noch kein Verlauf/);
});
test('CPU: history_minutes zur Laufzeit auf 5/10/30/60 begrenzt, sonst 10', async () => {
  // je Lauf frisch laden: der Verlaufscache ist modulweit und würde den zweiten 10-Minuten-Abruf schlucken
  const lauf = async wert => { const { BuschUnraidCpuCard } = ladeKarte(['BuschUnraidCpuCard']); let abfrage; const k = new BuschUnraidCpuCard(); k._core = unraidAttrappe(); k._hass = { locale: { language: 'de' }, callWS: async m => { abfrage = m; return {}; } }; k.setConfig({ history_minutes: wert }); await new Promise(r => setImmediate(r)); return Math.round((Date.now() - Date.parse(abfrage.start_time)) / 60000); };
  assert.equal(await lauf('60'), 60); assert.equal(await lauf(5), 5);
  for (const falsch of ['7', '1000', '-5', 'abc', 0]) assert.equal(await lauf(falsch), 10, String(falsch));
});
test('CPU-Editor: Zeitraum-Auswahl und Texte', () => { const { BuschUnraidCpuCardEditor } = ladeKarte(['BuschUnraidCpuCardEditor']); const e = new BuschUnraidCpuCardEditor(); e.hass = { locale: { language: 'de' } }; e.setConfig({ type: 'custom:busch-unraid-cpu-card' }); const form = e.querySelector('ha-form'); assert.deepEqual(form.schema.map(s => s.name), ['device_id', 'title', 'history_minutes', 'show_history']); assert.equal(form.data.history_minutes, '10'); assert.equal(form.computeLabel({ name: 'history_minutes' }), 'Verlaufszeitraum'); });
test('GPU: Werte und Leerzustand', () => { const { BuschUnraidGpuCard } = ladeKarte(['BuschUnraidGpuCard']); const txt = rendere(BuschUnraidGpuCard, unraidAttrappe()).shadowRoot.textContent; for (const r of [/19 %/, /9 %/, /52 °C/, /78 W/, /31 %/]) assert.match(txt, r); assert.match(rendere(BuschUnraidGpuCard, unraidAttrappe({ gpu: false })).shadowRoot.textContent, /Keine GPU/); });
test('GPU: ohne Lüfter-Entität keine Lüfterzeile; Untertitel mit Last und Temperatur', () => {
  const { BuschUnraidGpuCard } = ladeKarte(['BuschUnraidGpuCard']); const core = unraidAttrappe(); core.entities.delete('sensor.gpu_fan'); const alt = core.getDeviceEntities; core.getDeviceEntities = id => alt(id).filter(e => e.entity_id !== 'sensor.gpu_fan');
  const k = rendere(BuschUnraidGpuCard, core); assert.doesNotMatch(k.shadowRoot.textContent, /Lüfter/); assert.match(k.shadowRoot.querySelector('.tile-sub').textContent, /Last: 19 % · Temperatur: 52 °C/);
  assert.match(rendere(BuschUnraidGpuCard, unraidAttrappe()).shadowRoot.textContent, /Lüfter/);
});
test('GPU: mehrere Karten nach Index (numerisch) mit Überschrift', () => {
  const { BuschUnraidGpuCard } = ladeKarte(['BuschUnraidGpuCard']); const core = unraidAttrappe(); const vorlage = core.entities.get('sensor.gpu_util');
  const neu = { ...vorlage, entity_id: 'sensor.gpu10_util', state: '77', registry: { ...vorlage.registry, entity_id: 'sensor.gpu10_util', unique_id: 'e1_gpu_util_10' } }; core.entities.set(neu.entity_id, neu); const alt = core.getDeviceEntities; core.getDeviceEntities = id => id === 'srv' ? [...alt(id), neu] : alt(id);
  const k = rendere(BuschUnraidGpuCard, core); assert.deepEqual([...k.shadowRoot.querySelectorAll('.section')].map(n => n.textContent), ['GPU 0', 'GPU 10']); assert.match(k.shadowRoot.textContent, /77 %/);
});
test('GPU-Editor: Schema und Texte', () => { const { BuschUnraidGpuCardEditor } = ladeKarte(['BuschUnraidGpuCardEditor']); const e = new BuschUnraidGpuCardEditor(); e.hass = { locale: { language: 'en' } }; e.setConfig({ type: 'custom:busch-unraid-gpu-card' }); const form = e.querySelector('ha-form'); assert.deepEqual(form.schema.map(s => s.name), ['device_id', 'title']); assert.equal(form.computeLabel({ name: 'device_id' }), 'Server'); });
// Task 9: Array-Karte. Statuswerte wie DISK_STATUSES in unraid_ssh (ok, new, disabled, invalid, missing, not_present, unknown).
test('Array: Gruppen und Spalten', () => { const { BuschUnraidArrayCard, unraidGruppen, unraidServer } = ladeKarte(['BuschUnraidArrayCard', 'unraidGruppen', 'unraidServer']); const g = unraidGruppen(unraidServer(unraidAttrappe(), {}), { array: 'Array', boot: 'Boot' }); assert.deepEqual(g.map(x => x.titel), ['Array', 'cache', 'raid', 'Boot']); assert.deepEqual(g[2].geraete.map(d => d.name), ['raid', 'raid2']); const txt = rendere(BuschUnraidArrayCard, unraidAttrappe()).shadowRoot.textContent; assert.match(txt, /disk1/); assert.match(txt, /45 °C/); assert.match(txt, /97 %/); });
test('Array: Poolmitglied ohne Belegung zeigt –', () => { const { BuschUnraidArrayCard } = ladeKarte(['BuschUnraidArrayCard']); const k = rendere(BuschUnraidArrayCard, unraidAttrappe()); const zeile = [...k.shadowRoot.querySelectorAll('tr')].find(r => r.textContent.includes('raid2')); assert.match(zeile.textContent, /–/); assert.doesNotMatch(k.shadowRoot.textContent, /NaN/); });
test('Array: Parität zuerst in „Array“, Statustexte, schlafende Platte ohne Temperatur', () => {
  const { BuschUnraidArrayCard, unraidGruppen, unraidServer } = ladeKarte(['BuschUnraidArrayCard', 'unraidGruppen', 'unraidServer']); const core = unraidAttrappe({ parity: true });
  assert.deepEqual(unraidGruppen(unraidServer(core, {}), { array: 'Array', boot: 'Boot' })[0].geraete.map(d => d.name), ['parity', 'disk1']);
  core.entities.get('sensor.cache_status').state = 'disabled'; core.entities.get('binary_sensor.disk1_spundown').state = 'on';
  const k = rendere(BuschUnraidArrayCard, core), zeile = n => [...k.shadowRoot.querySelectorAll('tr')].find(r => r.querySelector('td')?.textContent === n).textContent;
  assert.match(zeile('parity'), /OK/); assert.match(zeile('cache'), /deaktiviert/); assert.match(zeile('disk1'), /schläft/); assert.doesNotMatch(zeile('disk1'), /45 °C/);
  assert.match(k.shadowRoot.textContent, /Array · 2 Geräte/); assert.match(k.shadowRoot.querySelector('.sem-error').parentNode.textContent, /deaktiviert/);
});
test('Array: Boot abschaltbar, Leerzustand, Editor', () => {
  const { BuschUnraidArrayCard, BuschUnraidArrayCardEditor } = ladeKarte(['BuschUnraidArrayCard', 'BuschUnraidArrayCardEditor']);
  assert.match(rendere(BuschUnraidArrayCard, unraidAttrappe()).shadowRoot.textContent, /Boot · 1 Gerät(?!e)/); assert.doesNotMatch(rendere(BuschUnraidArrayCard, unraidAttrappe(), { show_boot: false }).shadowRoot.textContent, /Boot/);
  const core = unraidAttrappe(); for (const [id, d] of core.devices) if (/disk$/.test(d.model)) core.devices.delete(id); assert.match(rendere(BuschUnraidArrayCard, core).shadowRoot.textContent, /Keine Platten gefunden/);
  const e = new BuschUnraidArrayCardEditor(); e.hass = { locale: { language: 'de' } }; e.setConfig({ type: 'custom:busch-unraid-array-card' }); const form = e.querySelector('ha-form'); assert.deepEqual(form.schema.map(s => s.name), ['device_id', 'title', 'show_boot']); assert.equal(form.data.show_boot, true); assert.equal(form.computeLabel({ name: 'show_boot' }), 'Bootgerät zeigen');
});
