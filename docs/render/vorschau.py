#!/usr/bin/env python3
"""README-Vorschaubilder von ha-unraid-cards im Playwright-Container.

Kein Abnahmelauf, nur Bilderzeugung. Aufruf (Repo nach /repo, Ordner mit regeln.py
nach /work, Symboldatei nach /mdi.json; das Image braucht Python-Playwright 1.62):

    docker run --rm --name test-hacs-t0-vorschau --network none \
      -v "$PWD:/repo:ro" -v "<hacs>/docs/render:/work:ro" \
      -v "<pfad>/mdi-pfade.json:/mdi.json:ro" -v "$PWD/docs:/out" \
      --entrypoint python3 <image-mit-playwright> \
      /repo/docs/render/vorschau.py /repo/dist/unraid-cards.js /mdi.json /out

Die Symboldatei hat das Format ``{"mdi:name": "<svg path d>"}`` und liegt
bewusst außerhalb des Repos (Material Design Icons, Apache 2.0); im Repo
liegen nur die gerenderten PNGs. Der ``ha-icon``-Stub zeichnet daraus ein
echtes 24×24-SVG mit ``fill:currentColor`` in ``--mdc-icon-size``. Fehlt ein
Symbol, bricht das Skript ab (keine Buchstaben-Platzhalter in der README).

Daten: dieselbe erfundene Attrappe wie ``kacheln.py`` (Server „Tower“,
disk1/cache/raid/flash, Share appdata, VM Windows 11 …), zur Laufzeit aus
``kacheln.py`` gelesen, ergänzt um erfundene Compose-Stacks und Container für
die Docker-Karte. Keine echten Haushaltsdaten, keine Netzanfragen nach außen.

Ausgabe in ``<out>``:
- ``preview-uebersicht.png``  hell, 960 px, 2 Spalten: Server, Prozessor,
  System, GPU, Array, Airflow
- ``preview-docker-vm.png``   hell, 960 px, 2 Spalten: Docker-Karte, VM-Liste
- ``preview-mobil-dunkel.png`` dunkel, 320 px: Prozessor und Array untereinander
"""
import json
import pathlib
import re
import sys

sys.path.insert(0, "/work")
from playwright.sync_api import sync_playwright  # noqa: E402
from regeln import THEMA_CSS  # noqa: E402  (hell/dunkel wie in den Renderskripten)

BUNDLE = pathlib.Path(sys.argv[1])
MDI = json.loads(pathlib.Path(sys.argv[2]).read_text(encoding="utf-8"))
OUT = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "/tmp/vorschau-out")
OUT.mkdir(parents=True, exist_ok=True)
ORIGIN = "http://karten.test"
JETZT = "2026-10-23T12:00:00+02:00"
GRENZE = 400 * 1024

QUELLE = (pathlib.Path(__file__).resolve().parent / "kacheln.py").read_text(encoding="utf-8")
ATTRAPPE = json.loads(re.search(r'ATTRAPPE = json\.loads\(r"""(.*?)"""\)', QUELLE, re.S).group(1))


def docker_attrappe():
    """Erfundene Stacks und Container (wie unraid-docker.py) am Server „Tower“."""
    devices, entities = [], []

    def dev(i, name, model):
        devices.append({"id": i, "name": name, "name_by_user": None, "model": model, "manufacturer": "Lime Technology",
                        "config_entries": ["e1"], "via_device_id": "srv"})

    def ent(eid, device, state, attrs, model):
        entities.append({"entity_id": eid, "domain": eid.split(".")[0],
                         "registry": {"entity_id": eid, "unique_id": "e1_" + eid, "platform": "unraid_ssh", "config_entry_id": "e1",
                                      "device_id": device, "disabled_by": None, "hidden_by": None, "entity_category": None, "labels": []},
                         "attributes": {"config_entry_id": "e1", **attrs}, "state": state, "platform": "unraid_ssh",
                         "config_entry_id": "e1", "device_id": device, "labels": [], "manufacturer": "Lime Technology",
                         "model": model, "entity_category": None})

    def container(key, device, state, model, stack=None, update=None, paused=False):
        a = {"kind": "container", "container_key": key, "container_name": key, "stack_name": stack,
             "container_state": "paused" if paused else "running" if state == "on" else "exited", "image": "example/" + key + ":latest"}
        ent("switch." + key, device, state, {**a, "role": "control"}, model)
        ent("button." + key + "_restart", device, "unknown", {**a, "role": "restart"}, model)
        if update:
            ent("update." + key, device, update, {**a, "role": "update"}, model)

    def stack(key, liste):
        dev("st-" + key, "Tower Stack " + key, "Compose stack")
        laufend = 0
        for name, state, opt in liste:
            container(name, "st-" + key, state, "Compose stack", stack=key, **opt)
            laufend += state == "on"
        ent("switch.stack_" + key, "st-" + key, "on" if laufend else "off",
            {"kind": "stack", "role": "control", "stack_key": key, "stack_name": key, "running_containers": laufend, "total_containers": len(liste)},
            "Compose stack")
        ent("button.stack_" + key + "_restart", "st-" + key, "unknown", {"kind": "stack", "role": "restart", "stack_key": key}, "Compose stack")

    def solo(key, state, **opt):
        dev("so-" + key, "Tower " + key, "Docker container")
        container(key, "so-" + key, state, "Docker container", **opt)

    stack("media", [("media", "on", {"update": "on"}), ("media-db", "on", {}), ("media-worker", "on", {})])
    stack("monitoring", [("grafana", "on", {}), ("prometheus", "on", {}), ("alertmanager", "off", {})])
    solo("nginx-proxy-manager", "on", update="on")
    solo("mariadb", "on", paused=True)
    solo("backup", "off")
    return devices, entities


d, e = docker_attrappe()
ATTRAPPE["voll"]["devices"] += d
ATTRAPPE["voll"]["entities"] += e

SEITE = """<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style id="regeln-thema">__THEMA__</style>
<style>html,body{margin:0;font-family:Roboto,"Liberation Sans",Arial,sans-serif;background:var(--primary-background-color);color:var(--primary-text-color)}
#wrap{padding:16px;display:grid;gap:16px;align-items:start;grid-template-columns:repeat(var(--spalten,2),minmax(0,1fr))}</style>
</head><body><home-assistant></home-assistant><div id="wrap"></div>
<script>
window.MDI=__MDI__;window.fehlend=new Set();
customElements.define('ha-icon',class extends HTMLElement{static get observedAttributes(){return ['icon']}
 constructor(){super();this.attachShadow({mode:'open'});}
 connectedCallback(){this._zeichne();}attributeChangedCallback(){this._zeichne();}
 _zeichne(){const n=String(this.getAttribute('icon')||'');if(!n)return;const d=window.MDI[n];if(!d){window.fehlend.add(n);}
  this.shadowRoot.innerHTML='<style>:host{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);flex:none}svg{width:100%;height:100%;fill:currentColor;display:block}</style>'+
   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+(d||'')+'"></path></svg>';}});
customElements.define('ha-card',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;border-radius:var(--ha-card-border-radius,12px);border:1px solid var(--divider-color);background:var(--ha-card-background,var(--card-background-color))}</style><slot></slot>';}});
customElements.define('home-assistant',class extends HTMLElement{});
document.querySelector('home-assistant').hass={locale:{language:'de'}};
</script>
<script src="/unraid-cards.js"></script>
<script>
window.ATTRAPPE=__ATTRAPPE__;
const baueKern=v=>{const roh=window.ATTRAPPE[v];const devices=new Map(roh.devices.map(d=>[d.id,d]));const list=roh.entities.map(e=>({...e}));const entities=new Map(list.map(e=>[e.entity_id,e]));
 return {devices,entities,lastErrors:new Map(),getEntity:id=>entities.get(id),getDevice:id=>devices.get(id),getDeviceEntities:id=>list.filter(e=>e.device_id===id),attach(){},retain(){return()=>{}},watch(){return()=>{}},watchDevice(){return()=>{}}};};
window.kern=baueKern('voll');window.ensureBuschCore=()=>window.kern;
const verlauf=()=>{const jetzt=Date.now()/1000,p=[];for(let i=0;i<=20;i++)p.push({s:String(20+Math.round(15*Math.sin(i/3))),lu:jetzt-600+i*30});return p;};
const hass={locale:{language:'de'},config:{time_zone:'Europe/Berlin'},states:{},callService:async()=>{},callWS:async m=>Object.fromEntries((m.entity_ids||[]).map(id=>[id,verlauf()]))};
window.raster=(spalten,karten)=>{const wrap=document.getElementById('wrap');wrap.style.setProperty('--spalten',spalten);wrap.replaceChildren();
 for(const [tag,config] of karten){const c=document.createElement(tag);c.setConfig({type:'custom:'+tag,...config});c.hass=hass;wrap.append(c);}return true;};
</script></body></html>"""

BILDER = [
    ("preview-uebersicht.png", "light", 960, 2, [
        ("busch-unraid-server-card", {}), ("busch-unraid-cpu-card", {}),
        ("busch-unraid-system-card", {}), ("busch-unraid-gpu-card", {}),
        ("busch-unraid-array-card", {}), ("busch-unraid-airflow-card", {})]),
    ("preview-docker-vm.png", "light", 960, 2, [
        ("busch-unraid-docker-card", {"device_id": "srv"}), ("busch-unraid-vm-card", {})]),
    ("preview-mobil-dunkel.png", "dark", 320, 1, [
        ("busch-unraid-cpu-card", {}), ("busch-unraid-array-card", {})]),
]


def main():
    fehler, netz, ergebnis = [], [], []
    seite = (SEITE.replace("__THEMA__", THEMA_CSS).replace("__MDI__", json.dumps(MDI))
             .replace("__ATTRAPPE__", json.dumps(ATTRAPPE, ensure_ascii=False)))
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 960, "height": 2400}, locale="de-DE", device_scale_factor=1)
        page.clock.set_fixed_time(JETZT)
        page.on("pageerror", lambda x: fehler.append("pageerror: " + str(x)))
        page.on("console", lambda m: m.type == "error" and fehler.append("console: " + m.text))

        def route(r):
            url = r.request.url
            netz.append(url.replace(ORIGIN, ""))
            if url.endswith("/unraid-cards.js"):
                return r.fulfill(body=BUNDLE.read_text(encoding="utf-8"), content_type="text/javascript")
            if url.rstrip("/") == ORIGIN:
                return r.fulfill(body=seite, content_type="text/html")
            return r.fulfill(status=404)
        page.route(ORIGIN + "/**", route)
        page.route(ORIGIN, route)
        page.goto(ORIGIN + "/")
        page.wait_for_function("()=>!!customElements.get('busch-unraid-docker-card')&&!!customElements.get('busch-unraid-airflow-card')")
        for datei, thema, breite, spalten, karten in BILDER:
            page.set_viewport_size({"width": breite, "height": 2400})
            page.evaluate("t=>{document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}", thema)
            page.evaluate("([s,k])=>raster(s,k)", [spalten, [list(k) for k in karten]])
            page.wait_for_timeout(600)
            ziel = OUT / datei
            page.locator("#wrap").screenshot(path=str(ziel))
            info = page.evaluate("()=>({hscroll:document.scrollingElement.scrollWidth>innerWidth,"
                                 "karten:[...document.querySelectorAll('#wrap>*')].map(c=>{const b=c.getBoundingClientRect();"
                                 "return {tag:c.localName,w:Math.round(b.width),h:Math.round(b.height),"
                                 "meldung:[...(c.shadowRoot?.querySelectorAll('.message')||[])].map(m=>m.textContent.trim())}})})")
            ergebnis.append({"bild": datei, "thema": thema, "breite": breite, "bytes": ziel.stat().st_size, **info})
        fehlend = page.evaluate("[...window.fehlend]")
        browser.close()
    fremd = [u for u in netz if u not in ("/", "/unraid-cards.js")]
    probleme = list(fehler)
    probleme += [f"symbol fehlt: {n}" for n in fehlend]
    probleme += [f"fremde anfrage: {u}" for u in fremd]
    for b in ergebnis:
        if b["bytes"] >= GRENZE:
            probleme.append(f"{b['bild']} {b['bytes']} B >= 400 KB")
        if b["hscroll"]:
            probleme.append(f"{b['bild']} horizontaler scroll")
        probleme += [f"{b['bild']} {k['tag']}: {k['meldung']}" for k in b["karten"] if k["meldung"]]
    print(json.dumps({"bilder": ergebnis, "probleme": probleme}, ensure_ascii=False, indent=1))
    sys.exit(1 if probleme else 0)


if __name__ == "__main__":
    main()
