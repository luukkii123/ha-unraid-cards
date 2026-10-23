// tests/tile-basis.test.js
const test = require('node:test'); const assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
test('Balken: Schwellen und unbekannter Wert', () => {
  const { unraidBalken } = ladeKarte(['unraidBalken']);
  const ok = unraidBalken(42, '42 %'); assert.equal(ok.getAttribute('aria-valuenow'), '42'); assert.ok(!ok.className.includes('warn'));
  assert.ok(unraidBalken(75, '75 %').className.includes('warn'));
  assert.ok(unraidBalken(95, '95 %').className.includes('crit'));
  const leer = unraidBalken(null, '–'); assert.equal(leer.getAttribute('aria-valuenow'), null);
});
test('Zahl: unbekannt und Locale', () => {
  const { unraidZahl } = ladeKarte(['unraidZahl']);
  assert.equal(unraidZahl(null, '%', 'de'), '–'); assert.equal(unraidZahl(NaN, '%', 'de'), '–');
  assert.equal(unraidZahl(12.345, '%', 'de', 1), '12,3 %'); assert.equal(unraidZahl(12.345, '%', 'en', 1), '12.3 %');
});
test('Tabelle: Leerzustand und data-label', () => {
  const { unraidTabelle } = ladeKarte(['unraidTabelle']);
  const leer = unraidTabelle([{key:'a',label:'A'}], [], {leer:'Nichts'}); assert.match(leer.textContent, /Nichts/);
  const t = unraidTabelle([{key:'a',label:'A'}], [{a:'x'}], {leer:''}); assert.equal(t.querySelector('td').getAttribute('data-label'), 'A');
});
test('Einklappen wird je Karte gemerkt', () => {
  const speicher = new Map();
  const { BuschUnraidTile } = ladeKarte(['BuschUnraidTile'], { localStorage: { getItem:k=>speicher.get(k)??null, setItem:(k,v)=>speicher.set(k,String(v)) } });
  class T extends BuschUnraidTile { static get kachel(){return 'probe';} _modell(){return {server:{id:'s'}};} _kopf(){return {icon:'mdi:server',titel:'Probe'};} _inhalt(){} get _texte(){return {de:{collapse:'Einklappen',expand:'Ausklappen'},en:{collapse:'Collapse',expand:'Expand'}};} }
  const a = new T(); a.setConfig({device_id:'s'}); a._umschalten(); assert.equal(a._eingeklappt, true);
  const b = new T(); b.setConfig({device_id:'s'}); assert.equal(b._eingeklappt, true);
});
test('Fokus bleibt nach einer Kachel-Aktion auf dem Knopf', async () => {
  const { BuschUnraidTile } = ladeKarte(['BuschUnraidTile']);
  let aufrufe = 0, fertig; const laeuft = new Promise((r) => { fertig = r; });
  class T extends BuschUnraidTile { static get kachel(){return 'fokus';} _modell(){return {server:{id:'s'}};} _kopf(){return {icon:'mdi:server',titel:'Fokus'};} _inhalt(){} _aktionen(){return [{key:'neustart',label:'Neustart',icon:'mdi:restart',ausfuehren:()=>{aufrufe++;return laeuft;}}];} }
  const k = new T(); k._core = { attach() {} }; k._hass = { locale: { language: 'de' } }; k.setConfig({ device_id: 's' });
  const knopf = () => k.shadowRoot.querySelector('[data-focus-key="neustart"]');
  knopf().focus(); assert.equal(k.shadowRoot.activeElement?.dataset.focusKey, 'neustart');
  knopf().click();
  // Während der Aktion: gesperrt, aber weiter fokussiert (aria-disabled statt disabled).
  assert.equal(k._busy, true); assert.equal(knopf().getAttribute('aria-disabled'), 'true'); assert.notEqual(knopf().disabled, true);
  assert.equal(k.shadowRoot.activeElement?.dataset.focusKey, 'neustart');
  knopf().click(); // zweiter Klick während _busy wird ignoriert
  assert.equal(aufrufe, 1);
  fertig(); await laeuft; await new Promise((r) => setImmediate(r));
  assert.equal(k._busy, false); assert.equal(knopf().getAttribute('aria-disabled'), null);
  assert.equal(k.shadowRoot.activeElement, knopf()); assert.equal(k.shadowRoot.activeElement.dataset.focusKey, 'neustart');
});
