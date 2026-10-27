"use strict";
// Vertrag für jede Kachel aus UNRAID_KACHELN — neue Kacheln laufen automatisch mit.
const test = require('node:test'), assert = require('node:assert');
const { ladeKarte } = require('./laden.js');
test('Vertrag: jede Kachel hat Schema, Texte de/en, Stub, Editor', () => { const { UNRAID_KACHELN } = ladeKarte(['UNRAID_KACHELN']); assert.ok(UNRAID_KACHELN.length >= 1); for (const [tag, Karte, Editor] of UNRAID_KACHELN) { assert.equal(Karte.getStubConfig().type, 'custom:' + tag); assert.ok(Karte.getConfigElement()); const k = new Karte(); for (const f of new Editor()._schema) { for (const l of ['de', 'en']) { assert.ok(k._texte[l].labels?.[f.name], `${tag} ${l} labels.${f.name}`); assert.ok(k._texte[l].helpers?.[f.name], `${tag} ${l} helpers.${f.name}`); } } } });
test('Vertrag: Stub ohne device_id, Rasterspalten Vielfache von 3, Namen de/en', () => { const { UNRAID_KACHELN } = ladeKarte(['UNRAID_KACHELN']); for (const [tag, Karte] of UNRAID_KACHELN) { assert.ok(!('device_id' in Karte.getStubConfig()), tag); const g = new Karte().getGridOptions(); assert.equal(g.columns % 3, 0, tag); assert.equal(g.min_columns % 3, 0, tag); const tx = new Karte()._texte; for (const l of ['de', 'en']) assert.ok(tx[l].name && tx[l].description, `${tag} ${l} name/description`); assert.ok(new Karte().getCardSize() >= 1, tag); } });
test('Vertrag: genau ein Kartenwähler-Eintrag je Kachel, Name aus dem Wörterbuch', () => { const kontext = { window: { customCards: [] }, customElements: { define() {} }, navigator: { language: 'de-DE' } }; const { UNRAID_KACHELN } = ladeKarte(['UNRAID_KACHELN'], kontext); for (const [tag, Karte] of UNRAID_KACHELN) { const e = kontext.window.customCards.filter(c => c.type === tag); assert.equal(e.length, 1, tag); const tx = new Karte()._texte.de; assert.equal(e[0].name, tx.name, tag); assert.equal(e[0].description, tx.description, tag); } });
test('Vertrag: neue Interface-Kachel ist im HA-Kartenwähler enthalten', () => { const { UNRAID_KACHELN } = ladeKarte(['UNRAID_KACHELN']); assert.ok(UNRAID_KACHELN.some(([tag]) => tag === 'busch-unraid-interface-card')); });

test('Vertrag: Stage 3 registers all cards and complete de/en editors with safe defaults', () => {
  const { UNRAID_KACHELN } = ladeKarte(['UNRAID_KACHELN'], { CustomEvent: class { constructor(type, options) {this.type=type;Object.assign(this,options);} } });
  for (const key of ['users','usb','coral']) {
    const row=UNRAID_KACHELN.find(([tag])=>tag===`busch-unraid-${key}-card`); assert.ok(row,key);
    const [,Card,Editor]=row;
    for(const language of ['de','en']) {const e=new Editor();e.hass={locale:{language}};e.setConfig(Card.getStubConfig());const f=e.querySelector('ha-form');assert.deepEqual(Array.from(f.schema,x=>x.name),key==='usb'?['device_id','title','visible_items','collapsed_items','show_hubs']:['device_id','title','visible_items','collapsed_items']);for(const field of f.schema){assert.ok(f.computeLabel(field));assert.ok(f.computeHelper(field));}if(key==='usb'){assert.equal(f.data.show_hubs,true);assert.match(f.computeHelper({name:'device_id'}),/VFIO/);f.listeners['value-changed'][0]({stopPropagation(){},detail:{value:{...f.data,show_hubs:false}}});assert.equal(e.event.detail.config.show_hubs,false);}}
  }
});
