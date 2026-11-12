"use strict";

// #1011 Kartenwähler: keine Live-Vorschau, ein Satz Beschreibung, billige Vorgaben ohne Kern.
const test = require("node:test");
const assert = require("node:assert");
const { ladeKarte } = require("./laden.js");

function eintraege(sprache) {
  const fenster = { customCards: [] };
  ladeKarte(["CARD_VERSION"], { window: fenster, navigator: { language: sprache } });
  return fenster.customCards;
}

test("jeder Kartenwähler-Eintrag: preview false, Name „Unraid: …“ und ein Satz Beschreibung (de und en)", () => {
  for (const sprache of ["de-DE", "en-US"]) {
    const liste = eintraege(sprache);
    assert.strictEqual(liste.length, 17);
    for (const e of liste) {
      assert.strictEqual(e.preview, false, `${e.type}: preview`);
      assert.match(e.name, /^Unraid: \S/, `${e.type}: Name ${e.name}`);
      assert.match(e.description, /^[A-ZÄÖÜ].*[^.]\.$/, `${e.type}: ein Satz mit Punkt: ${e.description}`);
      assert.ok(!/[.!?] /.test(e.description), `${e.type}: genau ein Satz: ${e.description}`);
      assert.ok(!/—/.test(e.description), `${e.type}: kein Gedankenstrich-Fragment`);
    }
  }
});

function zaehlHass() {
  const zaehler = { states: 0, entities: 0, devices: 0, netz: 0 };
  const geraet = (id, name, model) => ({ id, name, name_by_user: null, model, config_entries: ["e1"] });
  const devices = { srv: geraet("srv", "Tower", "Unraid"), stk: geraet("stk", "Media", "Compose stack"), ctr: geraet("ctr", "Adguard", "Docker container") };
  // hass.entities im Frontend: Anzeige-Register OHNE config_entry_id.
  const reg = (id, device) => ({ entity_id: id, device_id: device, platform: "unraid_ssh" });
  const entities = { "sensor.tower_cpu": reg("sensor.tower_cpu", "srv"), "switch.media": reg("switch.media", "stk"), "switch.adguard": reg("switch.adguard", "ctr") };
  const states = {
    "sensor.tower_cpu": { entity_id: "sensor.tower_cpu", state: "12", attributes: {} },
    "switch.media": { entity_id: "switch.media", state: "on", attributes: { kind: "stack", role: "control", stack_key: "media" } },
    "switch.adguard": { entity_id: "switch.adguard", state: "on", attributes: { kind: "container", role: "control", container_key: "adguard", container_name: "adguard" } },
  };
  const zaehl = (obj, k) => new Proxy(obj, { ownKeys(t) { zaehler[k]++; return Reflect.ownKeys(t); } });
  const netz = () => { zaehler.netz++; return new Promise(() => {}); };
  const hass = {
    states: zaehl(states, "states"), entities: zaehl(entities, "entities"), devices: zaehl(devices, "devices"),
    areas: {}, floors: {}, locale: { language: "de" }, callWS: netz, callApi: netz,
    connection: { subscribeEvents: netz, subscribeMessage: netz, sendMessagePromise: netz },
  };
  return { hass, zaehler };
}

test("getStubConfig: ein Durchlauf je Register für alle Karten, kein Kern, kein Netz", () => {
  const k = ladeKarte(["UNRAID_KACHELN", "BuschUnraidStackCard", "BuschUnraidContainerCard", "BuschUnraidVmCard", "BuschUnraidDockerCard"]);
  const { hass, zaehler } = zaehlHass();
  const karten = [k.BuschUnraidStackCard, k.BuschUnraidContainerCard, k.BuschUnraidVmCard, k.BuschUnraidDockerCard, ...k.UNRAID_KACHELN.map((x) => x[1])];
  let r = [];
  for (let runde = 0; runde < 2; runde++) r = karten.map((K) => JSON.parse(JSON.stringify(K.getStubConfig(hass))));
  assert.ok(zaehler.states <= 1, `hass.states ${zaehler.states}× durchlaufen`);
  assert.ok(zaehler.entities <= 1, `hass.entities ${zaehler.entities}× durchlaufen`);
  assert.ok(zaehler.devices <= 1, `hass.devices ${zaehler.devices}× durchlaufen`);
  assert.strictEqual(zaehler.netz, 0, "Netz- oder WebSocket-Abfrage im Kartenwähler");
  assert.deepStrictEqual(r[0], { type: "custom:busch-unraid-stack-card", device_id: "stk" });
  assert.deepStrictEqual(r[1], { type: "custom:busch-unraid-container-card", device_id: "ctr", container_key: "adguard" });
  assert.deepStrictEqual(r[2], { type: "custom:busch-unraid-vm-card" });
  assert.deepStrictEqual(r[3], { type: "custom:busch-unraid-docker-card", device_id: "srv" });
});

test("getStubConfig ohne hass bleibt die nackte Vorgabe", () => {
  const k = ladeKarte(["BuschUnraidStackCard", "BuschUnraidContainerCard", "BuschUnraidDockerCard"]);
  assert.deepStrictEqual({ ...k.BuschUnraidStackCard.getStubConfig() }, { type: "custom:busch-unraid-stack-card" });
  assert.deepStrictEqual({ ...k.BuschUnraidContainerCard.getStubConfig() }, { type: "custom:busch-unraid-container-card" });
  assert.deepStrictEqual({ ...k.BuschUnraidDockerCard.getStubConfig() }, { type: "custom:busch-unraid-docker-card" });
});
