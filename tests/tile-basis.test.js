// tests/tile-basis.test.js
const test = require('node:test'); const assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
const { domMitHistory, Element } = require('./dom-attrappe.js');
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

test('Dialog: Escape und Zurück brechen ab, Klick daneben nicht', async () => {
  const { BuschUnraidConfirm, umgebung } = ladeKarte(['BuschUnraidConfirm', 'umgebung'], domMitHistory());
  let p = BuschUnraidConfirm.frage({titel:'Stoppen',text:'Windows 11 stoppen?',aktion:'Stoppen',gefahr:true});
  const d = umgebung.document.body.lastChild; d._scrim.click(); assert.ok(d.isConnected, 'Scrim schließt nicht');
  d.dispatchEvent(new umgebung.KeyboardEvent('keydown',{key:'Escape'})); assert.equal(await p, false);
  p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); umgebung.window.dispatchEvent(new umgebung.Event('popstate')); assert.equal(await p, false);
});
test('Dialog: Doppelklick bestätigt einmal', async () => {
  const { BuschUnraidConfirm, umgebung } = ladeKarte(['BuschUnraidConfirm','umgebung'], domMitHistory());
  const p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); const d = umgebung.document.body.lastChild;
  d._ok.click(); d._ok.click(); assert.equal(await p, true); assert.equal(umgebung.document.body.childNodes.length, 0);
});
test('Kachel: Aktion mit Bestätigung ruft genau einmal auf', async () => {
  const { BuschUnraidTile } = ladeKarte(['BuschUnraidTile']); let n = 0;
  class T extends BuschUnraidTile { _bestaetigen(){ return Promise.resolve(true); } }
  const k = new T(); k.setConfig({}); const a = {key:'x',label:'X',bestaetigen:'Sicher?',ausfuehren:async()=>{n++;}};
  await Promise.all([k._ausfuehren(a,{failed:'f'}), k._ausfuehren(a,{failed:'f'})]); assert.equal(n, 1);
});
test('Dialog: Aufbau, Fokus auf Abbrechen, Fokusfalle, Abbrechen liefert false', async () => {
  const { BuschUnraidConfirm, umgebung } = ladeKarte(['BuschUnraidConfirm','umgebung'], domMitHistory());
  const p = BuschUnraidConfirm.frage({titel:'Stoppen',text:'„plex“ stoppen?',aktion:'Stoppen',gefahr:true}); const d = umgebung.document.body.lastChild;
  assert.equal(d.tagName, 'BUSCH-UNRAID-CONFIRM');
  const box = d.shadowRoot.querySelector('.dialog'); assert.equal(box.getAttribute('role'), 'alertdialog'); assert.equal(box.getAttribute('aria-modal'), 'true');
  assert.match(d.shadowRoot.querySelector('h2').textContent, /Stoppen/); assert.match(d.shadowRoot.querySelector('p').textContent, /plex/);
  assert.equal(d._abbr.textContent, 'Cancel', 'ohne hass/navigator englisch'); assert.equal(d._ok.textContent, 'Stoppen'); assert.equal(d._ok.className, 'danger');
  assert.equal(d.shadowRoot.activeElement, d._abbr, 'Fokus beim Öffnen auf Abbrechen');
  const tab = (shiftKey) => { const e = new umgebung.KeyboardEvent('keydown',{key:'Tab',shiftKey}); d.dispatchEvent(e); return e; };
  assert.ok(tab(false).defaultPrevented); assert.equal(d.shadowRoot.activeElement, d._ok);
  tab(false); assert.equal(d.shadowRoot.activeElement, d._abbr, 'Tab läuft im Dialog im Kreis');
  tab(true); assert.equal(d.shadowRoot.activeElement, d._ok, 'Umschalt+Tab rückwärts');
  d._abbr.click(); assert.equal(await p, false); assert.equal(d.isConnected, false);
});
test('Dialog: ohne Gefahr normaler Knopf, deutsche Texte mit hass', async () => {
  const u = domMitHistory(); u.document.querySelector = (sel) => sel === 'home-assistant' ? { hass: { locale: { language: 'de' } } } : null;
  const { BuschUnraidConfirm, umgebung } = ladeKarte(['BuschUnraidConfirm','umgebung'], u);
  const p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'Neu starten'}); const d = umgebung.document.body.lastChild;
  assert.equal(d._abbr.textContent, 'Abbrechen'); assert.notEqual(d._ok.className, 'danger'); d._ok.click(); assert.equal(await p, true);
});
test('Dialog: Fokus kehrt zum vorher aktiven Element zurück (auch im Shadow DOM)', async () => {
  const { BuschUnraidConfirm, umgebung } = ladeKarte(['BuschUnraidConfirm','umgebung'], domMitHistory());
  const karte = new Element('home-assistant'); karte.attachShadow(); const knopf = new Element('button'); karte.shadowRoot.appendChild(knopf); knopf.focus();
  umgebung.document.activeElement = karte; // der Browser meldet nur den äußersten Shadow-Host
  const p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); knopf.focused = false;
  umgebung.document.body.lastChild.dispatchEvent(new umgebung.KeyboardEvent('keydown',{key:'Escape'})); await p;
  assert.equal(knopf.focused, true);
});
test('Dialog: eigener History-Eintrag; zurück nur, wenn er oben liegt', async () => {
  const { BuschUnraidConfirm, umgebung } = ladeKarte(['BuschUnraidConfirm','umgebung'], domMitHistory()); const h = umgebung.history;
  let p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); assert.equal(h.length, 2); assert.equal(typeof h.state.buschUnraidConfirm, 'string'); assert.equal(h.state.dialog, undefined, 'nicht unter HAs Schlüssel dialog');
  umgebung.document.body.lastChild._ok.click(); assert.equal(await p, true); assert.equal(h.backs, 1); assert.equal(h.length, 1);
  await new Promise((r) => setTimeout(r)); // eigenes popstate aus back() abwarten
  p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); h.stack.pop(); // Zurück des Nutzers: Eintrag ist weg
  umgebung.window.dispatchEvent(new umgebung.Event('popstate')); assert.equal(await p, false); assert.equal(h.backs, 1, 'kein zweites back()');
  p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); h.pushState({fremd:true}); // jemand anderes liegt oben
  umgebung.document.body.lastChild._abbr.click(); assert.equal(await p, false); assert.equal(h.backs, 1, 'fremden Eintrag nicht wegnehmen');
  assert.equal(umgebung.window.listeners.popstate.length, 0, 'popstate-Listener aufgeräumt');
  assert.equal(umgebung.document.listeners.keydown.length, 0, 'keydown-Listener am document aufgeräumt');
});
test('unraidBestaetigen und Kachel-Bestätigung laufen über den Dialog', async () => {
  const { BuschUnraidTile, unraidBestaetigen, globalThis: g } = ladeKarte(['BuschUnraidTile','unraidBestaetigen','globalThis'], domMitHistory());
  const p = unraidBestaetigen('Stoppen','Sicher?','Stoppen',true); const d = g.document.body.lastChild;
  assert.equal(d._ok.textContent, 'Stoppen'); d._ok.click(); assert.equal(await p, true);
  const gefragt = []; g.unraidBestaetigen = async (...x) => { gefragt.push(x); return false; };
  const k = new BuschUnraidTile(); assert.equal(await k._bestaetigen('Sicher?','Stoppen',true), false);
  assert.deepEqual(JSON.parse(JSON.stringify(gefragt)), [['Stoppen','Sicher?','Stoppen',true]]);
});
test('Dialog: nach Scrim-Klick bleiben Escape und Fokusfalle wirksam', async () => {
  const { BuschUnraidConfirm, umgebung } = ladeKarte(['BuschUnraidConfirm','umgebung'], domMitHistory());
  let p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); let d = umgebung.document.body.lastChild;
  const md = new umgebung.Event('mousedown'); for (const fn of d._scrim.listeners.mousedown || []) fn(md);
  assert.ok(md.defaultPrevented, 'mousedown auf dem Scrim nimmt dem Dialog den Fokus nicht'); d._scrim.click(); assert.ok(d.isConnected);
  d._abbr.blur(); assert.equal(d.shadowRoot.activeElement, null, 'Fokus liegt außerhalb (body)');
  const vor = new umgebung.KeyboardEvent('keydown',{key:'Tab',shiftKey:false}); umgebung.document.dispatchEvent(vor);
  assert.ok(vor.defaultPrevented); assert.equal(d.shadowRoot.activeElement, d._abbr, 'Tab von außen springt auf den ersten Knopf');
  d._abbr.blur(); umgebung.document.dispatchEvent(new umgebung.KeyboardEvent('keydown',{key:'Tab',shiftKey:true}));
  assert.equal(d.shadowRoot.activeElement, d._ok, 'Umschalt+Tab von außen springt auf den letzten Knopf');
  d._ok.blur(); umgebung.document.dispatchEvent(new umgebung.KeyboardEvent('keydown',{key:'Escape'}));
  assert.equal(await p, false); assert.equal(d.isConnected, false, 'Dialog entfernt');
  assert.equal(umgebung.document.listeners.keydown.length, 0);
  p = BuschUnraidConfirm.frage({titel:'x',text:'y',aktion:'OK'}); d = umgebung.document.body.lastChild;
  const e = new umgebung.KeyboardEvent('keydown',{key:'Escape'}); d.dispatchEvent(e); assert.equal(await p, false, 'Escape am Host schließt genau einmal');
});
test('Dialog-Host liegt über HA-Dialogen (z-index 10000)', () => {
  const { UNRAID_CONFIRM_STYLE } = ladeKarte(['UNRAID_CONFIRM_STYLE']); assert.match(UNRAID_CONFIRM_STYLE, /:host\{[^}]*z-index:10000/);
});
