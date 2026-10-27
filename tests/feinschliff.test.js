"use strict";
// #643 Design-Feinschliff, Phase A (ohne Render-Pfad): Punkte 1, 4 (GPU), 5 (CPU), 7 (Docker).
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');

// ── Schritt 7: #643/1 Titel in normaler Schreibung ──────────────────────────
test('#643/1: kein text-transform:uppercase in den Kartenstilen (alle 17 Karten nutzen .tile-title)', () => {
  const l = ladeKarte(['UNRAID_TILE_STYLE', 'UNRAID_FAMILIE_STYLE', 'BUSCH_UNRAID_DOCKER_STYLE', 'BUSCH_UNRAID_STYLE']);
  for (const [name, css] of Object.entries(l)) assert.doesNotMatch(css, /uppercase/i, name);
  assert.match(l.UNRAID_TILE_STYLE, /\.tile-title\{[^}]*text-overflow:ellipsis[^}]*\}/);
  assert.doesNotMatch(l.UNRAID_TILE_STYLE.match(/\.tile-title\{[^}]*\}/)[0], /letter-spacing/);
});

// ── Schritt 8: #643/4 GPU ────────────────────────────────────────────────────
const { unraidAttrappe } = require('./attrappe.js');
function gpu(core = unraidAttrappe(), config = {}) {
  const { BuschUnraidGpuCard } = ladeKarte(['BuschUnraidGpuCard']), k = new BuschUnraidGpuCard();
  k._core = core; k._hass = { locale: { language: 'de' } }; k.setConfig(config); k._render(); return k;
}
test('#643/4 GPU: Untertitel nur Modell und Treiber, weder Last noch Temperatur', () => {
  const sub = gpu().shadowRoot.querySelector('.tile-sub').textContent;
  assert.match(sub, /Treiber: /); assert.doesNotMatch(sub, /Last|Temperatur|%|°C/);
});
test('#643/4 GPU: Wertegitter mit Rollen, jede Zeile drei Zellen, Werte rechts', () => {
  const k = gpu(), gitter = k.shadowRoot.querySelector('.gpu-values');
  assert.ok(gitter); assert.match(gitter.className, /\btable\b/); assert.equal(gitter.getAttribute('role'), 'table');
  assert.equal(k.shadowRoot.querySelector('table'), null, 'keine HTML-Tabelle mehr (kein Stapeln unter 420 px)');
  const zeilen = gitter.childNodes; assert.equal(zeilen.length, 5);
  for (const z of zeilen) { assert.equal(z.getAttribute('role'), 'row'); assert.equal(z.childNodes.length, 3); for (const c of z.childNodes) assert.equal(c.getAttribute('role'), 'cell'); }
  assert.deepEqual(zeilen.map(z => z.childNodes[0].textContent), ['Last', 'Speicher', 'Temperatur', 'Leistung', 'Lüfter']);
  assert.deepEqual(zeilen.map(z => z.childNodes[2].textContent), ['19 %', '9 %', '52 °C', '78 W', '31 %']);
  // Balken nur in der Spur-Spalte und ohne eigenen Text; Einzelwerte haben eine leere Spur
  assert.ok(zeilen[0].childNodes[1].querySelector('.bar')); assert.equal(zeilen[0].childNodes[1].querySelector('.bar-text'), null);
  assert.equal(zeilen[2].childNodes[1].childNodes.length, 0);
});
test('#643/4 unraidBalken: ohneText lässt .bar-text weg, aria-valuetext bleibt', () => {
  const { unraidBalken } = ladeKarte(['unraidBalken']);
  const ohne = unraidBalken(50, '50 %', { ohneText: true }); assert.equal(ohne.querySelector('.bar-text'), null); assert.equal(ohne.getAttribute('aria-valuetext'), '50 %');
  const mit = unraidBalken(50, '50 %'); assert.ok(mit.querySelector('.bar-text'));
  const leer = unraidBalken(null, '–', { ohneText: true }); assert.equal(leer.getAttribute('aria-valuetext'), '–');
});
test('#643/4 GPU: CSS bündige rechte Spalte', () => {
  const { UNRAID_TILE_STYLE } = ladeKarte(['UNRAID_TILE_STYLE']);
  assert.match(UNRAID_TILE_STYLE, /\.gpu-values\{[^}]*display:grid[^}]*grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(UNRAID_TILE_STYLE, /\.gpu-value\{[^}]*text-align:end[^}]*tabular-nums/);
});

// ── Schritt 9: #643/5 CPU ────────────────────────────────────────────────────
const { dashboardFixture } = require('./familie-attrappe.js');
function karte(name, core, hass = {}, config = {}) {
  const l = ladeKarte([name]), k = new l[name]();
  k._core = core; k._hass = { locale: { language: 'de' }, ...hass }; k.setConfig(config); k._render(); return k;
}
function cpuTemp(wert) { const core = unraidAttrappe(), e = core.entities.get('sensor.tower_cpu_temp'); e.state = String(wert); e.stateObject.state = String(wert); return core; }
test('#643/5 CPU-Temperatur: 79 ohne Punkt, ab 80 Warnung, ab 90 kritisch – immer mit Text [A-11]', () => {
  const zelle = k => k.shadowRoot.querySelectorAll('td').find(td => td.attributes['data-label'] === '' && /°C/.test(td.textContent));
  let z = zelle(karte('BuschUnraidCpuCard', cpuTemp(79))); assert.equal(z.textContent, '79 °C'); assert.equal(z.querySelector('.dot'), null);
  z = zelle(karte('BuschUnraidCpuCard', cpuTemp(80))); assert.match(z.querySelector('.dot').className, /\bsem-warning\b/); assert.equal(z.textContent, '80 °C · hoch');
  z = zelle(karte('BuschUnraidCpuCard', cpuTemp(90))); assert.match(z.querySelector('.dot').className, /\bsem-error\b/); assert.equal(z.textContent, '90 °C · kritisch');
  const { UNRAID_CPU_TEMP_SCHWELLEN } = ladeKarte(['UNRAID_CPU_TEMP_SCHWELLEN']); assert.deepEqual({ ...UNRAID_CPU_TEMP_SCHWELLEN }, { warnung: 80, kritisch: 90 });
});
test('#643/5 Systemkarte: gleiche Temperaturstufe für die CPU-Zeile [A-12]; Kompaktwerte mit Punkt', () => {
  const k = karte('BuschUnraidSystemCard', cpuTemp(91)), zelle = k.shadowRoot.querySelectorAll('.cell').find(c => c.querySelector('.cell-name').textContent === 'CPU');
  assert.match(zelle.querySelector('.dot').className, /\bsem-error\b/); assert.equal(zelle.querySelector('.cell-value').textContent, '91 °C · kritisch');
  const kalt = karte('BuschUnraidSystemCard', cpuTemp(40)).shadowRoot.querySelectorAll('.cell').find(c => c.querySelector('.cell-name').textContent === 'CPU');
  assert.equal(kalt.querySelector('.dot'), null); assert.equal(kalt.querySelector('.cell-value').textContent, '40 °C');
  const s = karte('BuschUnraidSystemCard', cpuTemp(85)), c = karte('BuschUnraidCpuCard', cpuTemp(85));
  assert.deepEqual({ ...s._kompakt(s._modell(s._core, s._config), s._texte.de).temperatures }, { wert: '85 °C · hoch', semantik: 'warning' });
  assert.deepEqual({ ...c._kompakt(c._modell(c._core, c._config), c._texte.de).temperature }, { wert: '85 °C · hoch', semantik: 'warning' });
  assert.deepEqual({ ...c._kompakt(c._modell(cpuTemp(50), c._config), c._texte.de) }.temperature, { wert: '50 °C' });
});
test('#643/5 CPU: ohne Leistungswert keine Leistungszeile; rapl-Package ohne Wert ausgeblendet', () => {
  assert.doesNotMatch(karte('BuschUnraidCpuCard', unraidAttrappe()).shadowRoot.textContent, /CPU-Leistung/);
  const core = dashboardFixture(); core.entities.get('sensor.demo_dashboard_cpu').attributes.packages.push({ id: 'package-1', power_w: null, source: 'rapl' }, { id: 'package-2', power_w: 'x', source: 'rapl' });
  const txt = karte('BuschUnraidCpuCard', core).shadowRoot.textContent;
  assert.match(txt, /CPU-Leistung/); assert.match(txt, /package-0/); assert.doesNotMatch(txt, /package-1|package-2/);
});
test('#643/5 CPU: Kerne als echter Aufklapper mit Chevron; ohne Kerne kein details', () => {
  const k = karte('BuschUnraidCpuCard', dashboardFixture()), summary = k.shadowRoot.querySelector('summary');
  const pfeil = summary.querySelector('.chevron'); assert.ok(pfeil); assert.equal(pfeil.tagName, 'HA-ICON'); assert.equal(pfeil.getAttribute('icon'), 'mdi:chevron-down'); assert.equal(pfeil.getAttribute('aria-hidden'), 'true');
  assert.match(summary.textContent, /Kerne/);
  const { UNRAID_TILE_STYLE } = ladeKarte(['UNRAID_TILE_STYLE']);
  assert.match(UNRAID_TILE_STYLE, /\.core-details summary\{[^}]*list-style:none/); assert.match(UNRAID_TILE_STYLE, /\.core-details summary::-webkit-details-marker\{display:none\}/);
  assert.match(UNRAID_TILE_STYLE, /\.core-details\[open\] \.chevron\{transform:rotate\(180deg\)\}/);
  const leer = dashboardFixture(); leer.entities.get('sensor.demo_dashboard_cpu').attributes.cores = [];
  assert.equal(karte('BuschUnraidCpuCard', leer).shadowRoot.querySelector('details'), null);
});
test('#643/5 CPU-Verlauf: Zeitraum als Überschrift, Min/Max aus genau einem callWS-Abruf', async () => {
  let n = 0; const callWS = async () => { n++; return { 'sensor.tower_cpu': [{ s: '20', lu: 1 }, { s: '3', lu: 31 }, { s: '47', lu: 61 }] }; };
  const k = karte('BuschUnraidCpuCard', unraidAttrappe(), { callWS }, { history_minutes: '30' });
  assert.ok(k.shadowRoot.querySelectorAll('h3').some(h => h.textContent === 'Verlauf · 30 min'));
  await new Promise(r => setImmediate(r));
  assert.equal(k.shadowRoot.querySelector('.history-range').textContent, 'Min 3 % · Max 47 %');
  k._signatur = null; k._render(); assert.equal(k.shadowRoot.querySelector('.history-range').textContent, 'Min 3 % · Max 47 %', 'nach erneutem Render sofort aus der letzten Linie');
  await new Promise(r => setImmediate(r)); assert.equal(n, 1, 'kein zusätzlicher Abruf');
});

// ── Abnahme 0.4.0: Warn-Badge lesbar im HA-Standardthema ────────────────────
// Phase-C-Render: „Teilweise gestartet“ in --warning-color (#ffa600) auf 12 % Orange ergab 1,96:1.
// Der Text wird zur Primärtextfarbe hin abgedunkelt (hell ≈ 4,8:1), der Punkt bleibt reine Warnfarbe.
test('Abnahme 0.4.0: Warn-Badge-Text mit Primärtext gemischt, Punkt bleibt Warnfarbe', () => {
  const { BUSCH_UNRAID_STYLE } = ladeKarte(['BUSCH_UNRAID_STYLE']);
  const regel = BUSCH_UNRAID_STYLE.match(/\.status-warning\{[^}]*\}/)[0];
  assert.match(regel, /(^|[{;])color:color-mix\(in srgb,var\(--warning-color,#a76900\) 50%,var\(--primary-text-color,#212121\)\)/);
  assert.match(regel, /background:color-mix\(in srgb,var\(--warning-color,#a76900\) 12%,var\(--card-background-color\)\)/);
  const punkt = BUSCH_UNRAID_STYLE.indexOf('.status-warning::before{background:var(--warning-color,#a76900)}');
  assert.ok(punkt > BUSCH_UNRAID_STYLE.indexOf('.status-badge::before{'), 'Punktregel nach .status-badge::before');
});
