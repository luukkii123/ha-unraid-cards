'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { render, text, sensor, inventoryFixture } = require('./inventory-card-helpers.js');
test('Users explains share permissions, text warning, natural names, root unknown and literal descriptions', () => {
  const k = render('Users'), content = text(k);
  assert.match(content, /3.*1.*Kennwort/s); assert.match(content, /Anzahl SMB-Shares mit dieser Berechtigung/);
  assert.match(content, /Kennwort fehlt/); assert.match(content, /root.*–.*–.*user2.*user10/s);
  assert.match(content, /<img src=x onerror=alert\(1\)>/); assert.equal(k.shadowRoot.querySelector('img'), null);
  assert.doesNotMatch(content, /Sitzungen|I\/O/); assert.equal(k.calls.length, 0);
});
test('SMB disabled and root never advertise zero permissions even if stale fields are numeric', () => {
  const c = inventoryFixture(), e = sensor(c, 'users'); e.attributes.users[1].read_shares = 4; e.attributes.users[1].write_shares = 4;
  const root = render('Users', c).shadowRoot.querySelector('tbody').childNodes[0]; assert.match(root.textContent, /–.*–/s);
  e.attributes.smb_enabled = false; const k = render('Users', c); assert.match(text(k), /SMB deaktiviert/);
  for (const row of k.shadowRoot.querySelector('tbody').childNodes) assert.match(row.textContent, /–.*–/s);
});
for (const [kind, key, empty] of [['Users','users',/Keine Benutzer/], ['Usb','usb',/Keine USB-Geräte/], ['Coral','coral',/Keine Coral TPU/]]) {
  test(`${kind} count zero, failed source, partial list, offline, legacy and server boundaries`, () => {
    const c = inventoryFixture({ second: true }), e = sensor(c,key), field = key === 'users' ? 'users' : 'devices';
    assert.doesNotMatch(text(render(kind,c)), /FOREIGN/);
    e.state = '0'; e.attributes[field] = []; assert.match(text(render(kind,c)),empty);
    e.state = 'unavailable'; assert.match(text(render(kind,c)),/Daten nicht verfügbar/); assert.doesNotMatch(text(render(kind,c)),empty);
    e.state = '1'; e.attributes[field] = [{name:'Partial item',port:'2-2',state:'unknown',transport:'pci'}]; e.attributes.failed_sections=['optional_source'];
    assert.match(text(render(kind,c)),/Teil.*Daten|Daten.*teilweise/i); assert.match(text(render(kind,c)),/Partial item/);
    e.attributes[field] = null; assert.match(text(render(kind,c)),/Daten nicht verfügbar/); assert.doesNotMatch(text(render(kind,c)),/Partial item/);
    assert.match(text(render(kind,inventoryFixture({legacy:true}))),/Unraid SSH.*0\.10.*aktualisieren/s);
    for(const suffix of ['cpu_percent','array_state']) c.entities.get('sensor.demo_'+suffix).state='unavailable';
    assert.match(text(render(kind,c)),/Nicht verfügbar/);
  });
}
test('Users renders all entries without silently limiting inventory', () => { const c=inventoryFixture(),e=sensor(c,'users'); e.attributes.users=Array.from({length:150},(_,i)=>({name:'user'+i,description:'Long text '.repeat(20),protected:true,read_shares:0,write_shares:0})); e.state='150'; assert.equal(render('Users',c).shadowRoot.querySelector('tbody').childNodes.length,150); });
for(const [kind,key] of [['Users','users'],['Usb','usb'],['Coral','coral']]) {
 test(`${kind} partial empty inventory makes no complete absence claim and stale unknown never renders`,()=>{const c=inventoryFixture(),e=sensor(c,key),field=key==='users'?'users':'devices';e.state='0';e.attributes[field]=[];e.attributes.failed_sections=['optional_source'];assert.match(text(render(kind,c)),/Keine.*verfügbaren Teilquelle/);assert.doesNotMatch(text(render(kind,c)),/Keine.*gefunden/);e.state='unknown';e.attributes[field]=[{name:'STALE',port:'STALE'}];assert.doesNotMatch(text(render(kind,c)),/STALE/);assert.match(text(render(kind,c)),/Daten nicht verfügbar/);});
 test(`${kind} shares tile collapse, focus and render signature without service calls`,()=>{const k=render(kind),old=k.shadowRoot.querySelector('[data-focus-key="toggle"]');old.focus();k._render();assert.equal(k.shadowRoot.querySelector('[data-focus-key="toggle"]'),old);old.click();assert.equal(k.shadowRoot.querySelector('table'),null);assert.equal(k.shadowRoot.activeElement?.dataset.focusKey,'toggle');k.shadowRoot.querySelector('[data-focus-key="toggle"]').click();assert.ok(k.shadowRoot.querySelector('table'));assert.equal(k.calls.length,0);});
}
test('Inventory rejects incompatible schema, nonnumeric states and missing failure metadata',()=>{for(const key of ['users','usb','coral']){const kind={users:'Users',usb:'Usb',coral:'Coral'}[key];for(const state of ['ok','partial','-1','1.5','']){const c=inventoryFixture();sensor(c,key).state=state;assert.match(text(render(kind,c)),/Daten nicht verfügbar/);}const c=inventoryFixture(),e=sensor(c,key);e.attributes.schema_version=2;assert.match(text(render(kind,c)),/0\.10\.0/);e.attributes.schema_version=1;delete e.attributes.failed_sections;assert.match(text(render(kind,c)),/Daten nicht verfügbar/);}});
test('All Stage 3 runtime dictionary keys exist in both languages and English content renders',()=>{for(const kind of ['Users','Usb','Coral']){const k=render(kind,undefined,{},'en');assert.doesNotMatch(text(k),/Nicht verfügbar|Kennwort fehlt|Am Host erkannt/);assert.deepEqual(Object.keys(k._texte.de).sort(),Object.keys(k._texte.en).sort());}});
