#!/usr/bin/env python3
"""Abnahme #642/#643 (Phase C): alle 17 Unraid-Karten ein- und ausgeklappt.

Aufruf im Playwright-Container (Repo nach /repo, Ordner mit regeln.py nach /work),
sonst über ``bash scripts/karten-alle.sh --repo ha-unraid-cards --schritt anzeige``:

    python3 /repo/docs/render/anzeige.py /repo/dist/unraid-cards.js /tmp/anzeige-out

Nur erfundene Daten (``kacheln.ATTRAPPE`` und ``tests/familie-attrappe.js``), kein HA,
keine echten Dienstaufrufe. Je Karte bei 320/480/960 px, hell und dunkel:

* ausgeklappt (localStorage leer) und eingeklappt (Schlüssel der Karte mit ``'1'``
  vorbelegt, ``collapsed_items`` gesetzt): Bild, Regel 1 (``messe_text``), Touchziele,
  Kontrast, kein horizontales Scrollen;
* Kopf (#643/1, /2): Titel ohne ``text-transform: uppercase``, Einklapp-Knopf direkt im
  Kopf, oben rechts, nie in der Aktionsreihe, ``aria-expanded`` passend; Kopfhöhe;
* Kompaktzeile (#642): eingeklappt genau die gewählten, verfügbaren Werte; gestoppte VM
  ohne CPU/RAM (Linie #640); Interface-Karte ohne Kompaktwerte;
* GPU (#643/4): alle Werte rechtsbündig in einer Spalte; CPU (#643/5): Temperaturstufe
  mit Text und Punkt (52/89/93 °C); VM (#643/6, O-3): Badge in der Titelzeile, Aktionen
  umbrechen nur bei Platzmangel ([A-13]), kein Leerraum unter dem Inhalt; Icon mittig zum Textblock;
* Servermenü (#643/3): ⋮ öffnet genau Neustart und Ausschalten, unter 450 px als
  Bottom-Sheet; Regel 2 (``messe_popup``, flüchtiges Menü) je Breite; E2E über den
  Bestätigungsdialog (Abbrechen ohne Aufruf, Bestätigen genau ein ``button.press``),
  Fokus kehrt auf ⋮ zurück;
* Editoren aller 17 Karten mit einer ``ha-form``-Attrappe, die ``select``/``multiple``
  als Häkchenliste zeichnet: Felder ``visible_items``/``collapsed_items`` mit den
  Katalogoptionen, Abwählen schreibt ``visible_items`` und keine ``show_*``.
"""
import base64
import copy
import json
import pathlib
import shutil
import subprocess
import sys

sys.path.insert(0, "/work")
from playwright.sync_api import sync_playwright  # noqa: E402
from regeln import bewerte, lauf_breiten, messe_popup, messe_text, schreibe, selbsttest, zaehle  # noqa: E402
import kacheln as base  # noqa: E402

BUNDLE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/anzeige-out")
OUT.mkdir(parents=True, exist_ok=True)
BREITEN = (320, 480, 960)

# (Name, Element, Datensatz, Konfiguration, collapsed_items, erwartete Kompaktlabels)
FAELLE = [
    ("server", "busch-unraid-server-card", "voll", {"device_id": "srv"}, ["uptime", "array", "mover"], ["Laufzeit", "Array", "Mover"]),
    ("system", "busch-unraid-system-card", "voll", {"device_id": "srv"}, ["ram", "temperatures"], ["RAM"]),
    ("cpu", "busch-unraid-cpu-card", "voll", {"device_id": "srv"}, ["temperature", "load_average", "load"], ["Temp.", "Load", "CPU"]),
    ("gpu", "busch-unraid-gpu-card", "voll", {"device_id": "srv"}, ["util", "vram", "temperature", "power", "fan"], ["GPU", "VRAM", "Temp."]),
    ("array", "busch-unraid-array-card", "voll", {"device_id": "srv"}, ["array", "pools", "boot"], ["Array"]),
    ("parity", "busch-unraid-parity-card", "voll", {"device_id": "srv"}, ["state", "progress", "errors"], ["Fehler"]),
    ("airflow", "busch-unraid-airflow-card", "voll", {"device_id": "srv"}, ["summary"], []),
    ("shares", "busch-unraid-shares-card", "voll", {"device_id": "srv"}, ["summary"], []),
    ("vm-usage", "busch-unraid-vm-usage-card", "inv", {"device_id": "demo"}, ["summary"], []),
    ("interface", "busch-unraid-interface-card", "inv", {"device_id": "demo"}, [], []),
    ("users", "busch-unraid-users-card", "inv", {"device_id": "demo"}, ["summary"], []),
    ("usb", "busch-unraid-usb-card", "inv", {"device_id": "demo"}, ["summary"], []),
    ("coral", "busch-unraid-coral-card", "inv", {"device_id": "demo"}, ["summary"], []),
    ("stack", "busch-unraid-stack-card", "familie", {"device_id": "stack"}, ["status", "cpu", "ram", "containers"], ["Status", "Container"]),
    ("container", "busch-unraid-container-card", "familie", {"device_id": "stack", "container_key": "web"}, ["status", "cpu", "ram"], ["Status"]),
    ("vm", "busch-unraid-vm-card", "voll", {"device_id": "vm1"}, ["status", "cpu", "ram"], ["Status", "CPU", "RAM"]),
    ("vm-gestoppt", "busch-unraid-vm-card", "voll", {"device_id": "vm2"}, ["status", "cpu", "ram"], ["Status"]),
    ("vm-liste", "busch-unraid-vm-card", "voll", {}, ["vms"], []),
    ("docker", "busch-unraid-docker-card", "docker", {"device_id": "server"}, ["summary"], []),
]
# 17 Kartenarten (vm, vm-gestoppt und vm-liste sind dieselbe Karte in drei Zuständen).
KARTENARTEN = sorted({f[1] for f in FAELLE})
# 1×1-PNG für die Containerbilder der Docker-Fixture (/api/unraid_ssh/icons/<name>.png).
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
# Die ha-icon-Attrappe aus kacheln.SEITE ist im Shadow DOM ungestylt (Dokumentstile wirken dort nicht) und
# zeichnet nur einen Buchstaben in Fließtextgröße. Hier bekommt sie per Inline-Stil die echte Kastengröße
# (--mdc-icon-size, wie ha-svg-icon), damit Kopfhöhe und Icon-Ausrichtung realistisch gemessen werden.
ICON_ALT = "customElements.define('ha-icon',class extends HTMLElement{static get observedAttributes(){return ['icon']}"
ICON_NEU = ("customElements.define('ha-icon',class extends HTMLElement{connectedCallback(){this.style.cssText+=';display:inline-grid;"
            "place-items:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);font-size:calc(var(--mdc-icon-size,24px) * .6);"
            "line-height:1;flex:none'}static get observedAttributes(){return ['icon']}")
SERVER = "busch-unraid-server-card"
MEHR = SERVER + ' [data-focus-key="more"]'
MENUE = "busch-unraid-docker-menu"

FORM = """<style>[data-anzeige-editor]{display:block;min-width:0;color:var(--primary-text-color);background:var(--card-background-color);padding:16px;box-sizing:border-box}
ha-form .feld{display:grid;gap:4px;margin:12px 0;min-width:0;overflow-wrap:anywhere}ha-form .opt{display:flex;align-items:center;gap:8px;min-height:44px;min-width:0}
ha-form input{min-height:44px;min-width:44px;max-width:100%;box-sizing:border-box;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color)}
ha-form small{color:var(--secondary-text-color)}</style><script>
// ha-form-Attrappe: select/multiple als Häkchenliste (wie mode:list), boolean als Häkchen, sonst Textfeld.
customElements.define('ha-form',class extends HTMLElement {
 set schema(v){this._schema=v;this.draw()} get schema(){return this._schema}
 set data(v){this._data=v;this.draw()} get data(){return this._data}
 set hass(v){this._hass=v} get hass(){return this._hass}
 set computeLabel(v){this._label=v;this.draw()}
 set computeHelper(v){this._helper=v;this.draw()}
 felder(){const out=[];const gehe=l=>{for(const s of l||[]){if(Array.isArray(s.schema))gehe(s.schema);else if(s.name)out.push(s);}};gehe(this._schema);return out;}
 senden(name,wert){this._data={...this._data,[name]:wert};this.dispatchEvent(new CustomEvent('value-changed',{detail:{value:this._data}}));}
 draw(){this.replaceChildren();for(const s of this.felder()){
  const box=document.createElement('div');box.className='feld';box.dataset.feld=s.name;
  const titel=document.createElement('label');titel.textContent=this._label?.(s)||s.name;box.append(titel);
  const sel=s.selector?.select;
  if(sel&&sel.multiple){const liste=document.createElement('div');liste.setAttribute('role','group');
   const wert=Array.isArray(this._data?.[s.name])?this._data[s.name]:[];
   for(const o of sel.options||[]){const opt=document.createElement('label');opt.className='opt';const cb=document.createElement('input');cb.type='checkbox';cb.name=s.name;cb.value=o.value;cb.checked=wert.includes(o.value);
    cb.onchange=()=>this.senden(s.name,[...this.querySelectorAll('input[name="'+s.name+'"]')].filter(x=>x.checked).map(x=>x.value));
    const text=document.createElement('span');text.textContent=o.label;opt.append(cb,text);liste.append(opt);}
   box.append(liste);}
  else{const input=document.createElement('input');input.name=s.name;input.type=s.selector?.boolean?'checkbox':'text';
   if(input.type==='checkbox')input.checked=!!this._data?.[s.name];else input.value=this._data?.[s.name]??'';
   input.onchange=()=>this.senden(s.name,input.type==='checkbox'?input.checked:input.value);box.append(input);}
  const help=document.createElement('small');help.textContent=this._helper?.(s)||'';box.append(help);this.append(box);}}
});
</script>"""


def fixtures():
    """Kachel-Attrappe plus Node-Fixtures (Inventar, Familie, Docker); alles erfunden."""
    import playwright
    node = shutil.which("node") or str(pathlib.Path(playwright.__file__).parent / "driver" / "node")
    repo = pathlib.Path(__file__).resolve().parents[2]
    js = ("const f=require('./tests/familie-attrappe.js');const roh=c=>({devices:[...c.devices.values()],entities:[...c.entities.values()]});"
          "console.log(JSON.stringify({inv:roh(f.inventoryFixture({})),familie:roh(f.familienFixture().core),docker:roh(f.dockerFixture())}))")
    data = json.loads(subprocess.check_output([node, "-e", js], cwd=repo, text=True))
    voll = copy.deepcopy(base.ATTRAPPE["voll"])
    muster = next(e for e in voll["entities"] if e["registry"]["unique_id"] == "e1_cpu_percent")
    # Serverknöpfe für das ⋮-Menü (die Kachel-Attrappe hat keine): erfundene IDs am Server srv.
    for key in ("server_reboot", "server_shutdown", "mover_start"):
        eid = "button.tower_" + key
        voll["entities"].append({**copy.deepcopy(muster), "entity_id": eid, "domain": "button", "state": "unknown", "attributes": {},
                                 "registry": {**muster["registry"], "entity_id": eid, "unique_id": "e1_" + key}})
    data["voll"] = voll
    for name, grad in (("kuehl", "52"), ("kritisch", "93")):
        v = copy.deepcopy(voll)
        for e in v["entities"]:
            if e["registry"]["unique_id"] == "e1_cpu_temp":
                e["state"] = grad
        data[name] = v
    return data


JS_KOPF = r"""(sel)=>{const host=document.querySelector(sel),r=host.shadowRoot,card=r.querySelector('ha-card');
 const head=r.querySelector('ha-card>.tile-head')||r.querySelector('ha-card>.header');const toggle=r.querySelector('[data-focus-key="toggle"]');
 const rc=x=>{if(!x)return null;const b=x.getBoundingClientRect();return {l:Math.round(b.left),t:Math.round(b.top),r:Math.round(b.right),b:Math.round(b.bottom),w:Math.round(b.width),h:Math.round(b.height)}};
 const titel=head?.querySelector('h2');const leiste=head?[...head.children].find(k=>k.matches('.tile-actions,.actions')):null;
 const knoepfe=leiste?[...leiste.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width>0):[];
 const zeilen=[...new Set(knoepfe.map(b=>Math.round(b.getBoundingClientRect().top)))];
 const lueke=leiste?parseFloat(getComputedStyle(leiste).columnGap)||0:0,noetig=Math.round(knoepfe.reduce((s,b)=>s+b.getBoundingClientRect().width,0)+lueke*Math.max(0,knoepfe.length-1)),da=leiste?Math.round(leiste.clientWidth):0;
 const ikon=head?[...head.children].find(k=>k.matches('.tile-icon,.card-icon')):null,mitte=x=>{const b=x.getBoundingClientRect();return b.top+b.height/2};
 const kinder=head?[...head.children].filter(k=>k.getBoundingClientRect().width>0):[];
 const sichtbar=[...card.children].filter(k=>getComputedStyle(k).display!=='none'&&k.getBoundingClientRect().height>0);
 const cb=card.getBoundingClientRect(),unten=sichtbar.length?Math.max(...sichtbar.map(k=>k.getBoundingClientRect().bottom)):cb.top;
 const badge=r.querySelector('.title-row .badge, .title-row [class*="badge"]');
 return {titel:titel?.textContent||null,titel_transform:titel?getComputedStyle(titel).textTransform:null,
  toggle:!!toggle,toggle_im_kopf:!!toggle&&toggle.parentElement===head,toggle_in_aktionen:!!toggle?.closest('.tile-actions,.actions'),
  toggle_expanded:toggle?.getAttribute('aria-expanded')??null,toggle_rect:rc(toggle),kopf:rc(head),karte:rc(card),
  toggle_ganz_rechts:!!toggle&&kinder.every(k=>k===toggle||k.getBoundingClientRect().right<=toggle.getBoundingClientRect().right+1),
  toggle_oben:!!toggle&&!!titel&&toggle.getBoundingClientRect().top<=titel.getBoundingClientRect().bottom,
  kompakt_zeile:!!r.querySelector('.compact-line'),kompakt:[...r.querySelectorAll('.compact-item')].map(i=>({label:i.querySelector('.compact-label')?.textContent,wert:i.querySelector('.compact-value')?.textContent,punkt:!!i.querySelector('.dot')})),
  aktionen:knoepfe.map(b=>b.dataset.focusKey),aktion_zeilen:zeilen.length,aktion_breite_noetig:noetig,aktion_breite_da:da,badge_in_titelzeile:!!badge,
  ikon_titel_abstand:ikon&&titel?Math.round(Math.abs(mitte(ikon)-mitte(titel))):null,ikon:rc(ikon),titel_rect:rc(titel),
  ikon_im_textblock:(()=>{const tb=head?[...head.children].find(k=>k.matches('.tile-text,.header-main')):null;if(!ikon||!tb)return null;const b=tb.getBoundingClientRect(),m=mitte(ikon);return m>=b.top-1&&m<=b.bottom+1;})(),
  inhalt:sichtbar.filter(k=>k!==head&&!k.matches('.compact-line,.message')).length,
  rest_unten:Math.round(cb.bottom-unten),hoehe:Math.round(cb.height)};}"""

JS_GPU = r"""(sel)=>{const r=document.querySelector(sel).shadowRoot;return [...r.querySelectorAll('.gpu-values .gpu-value')].map(c=>{const g=document.createRange();g.selectNodeContents(c);const b=g.getBoundingClientRect();return {wert:c.textContent,rechts:Math.round(b.right),zellen:c.parentElement.querySelectorAll(':scope>[role=cell]').length}});}"""

JS_TEMP = r"""(sel)=>{const r=document.querySelector(sel).shadowRoot;return {punkte:[...r.querySelectorAll('.dot-row')].filter(x=>/°C/.test(x.textContent)).map(x=>({text:x.textContent,stufe:x.querySelector('.dot').className})),
 texte:[...r.querySelectorAll('*')].filter(x=>!x.children.length&&/\d\s*°C/.test(x.textContent)).map(x=>x.textContent)};}"""

JS_MENUE = r"""()=>{const m=document.querySelector('busch-unraid-docker-menu');if(!m)return null;const p=m.shadowRoot.querySelector('.menu-panel').getBoundingClientRect();
 const items=[...m.shadowRoot.querySelectorAll('.item')];return {sheet:m.hasAttribute('sheet'),breite:innerWidth,hoehe_fenster:innerHeight,panel:{l:Math.round(p.left),t:Math.round(p.top),r:Math.round(p.right),b:Math.round(p.bottom)},
 innen:p.left>=0&&p.top>=0&&p.right<=innerWidth+0.5&&p.bottom<=innerHeight+0.5,items:items.map(i=>i.dataset.action),texte:items.map(i=>i.textContent.trim()),
 klein:items.concat([...m.shadowRoot.querySelectorAll('.menu-close')]).filter(i=>{const b=i.getBoundingClientRect();return b.width<44||b.height<44}).length,
 fokus:m.shadowRoot.activeElement?.dataset?.action||null};}"""


def main():
    report = {"abgeschlossen": False, "selbsttest": {}, "kartenarten": KARTENARTEN, "breiten": {}, "karten": [], "editoren": [],
              "menue": [], "popup": {}, "e2e": {}, "eigene_verstoesse": [], "hinweise": [], "seitenfehler": [], "netz": [],
              "grenzen": ["ha-form ist eine Attrappe: belegt Verdrahtung und Schema, nicht HAs native Darstellung.",
                          "Sections-Rasterhöhe von HA wird nicht gerendert; gemessen wird die Höhe der Karte selbst."]}
    fehler = report["eigene_verstoesse"]

    def check(ok, text):
        if not ok:
            fehler.append(text)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 960, "height": 1200}, locale="de-DE")
        page.clock.set_fixed_time(base.JETZT)
        page.on("pageerror", lambda e: report["seitenfehler"].append(str(e)))
        page.on("console", lambda m: m.type == "error" and report["seitenfehler"].append(m.text))
        payload = json.dumps(fixtures(), ensure_ascii=False).replace("<", r"<")
        assert base.SEITE.count(ICON_ALT) == 1
        html = base.SEITE.replace(ICON_ALT, ICON_NEU).replace("__ATTRAPPE__", payload).replace('<script src="/unraid-cards.js">', FORM + '<script src="/unraid-cards.js">')

        def route(r):
            url = r.request.url
            report["netz"].append(url.replace(base.ORIGIN, ""))
            if url == base.ORIGIN + "/unraid-cards.js":
                return r.fulfill(body=BUNDLE.read_text(encoding="utf-8"), content_type="text/javascript")
            if url.rstrip("/") == base.ORIGIN:
                return r.fulfill(body=html, content_type="text/html")
            if url.startswith(base.ORIGIN + "/api/unraid_ssh/icons/") and url.endswith(".png"):
                return r.fulfill(body=PNG, content_type="image/png")
            fehler.append("fremde Anfrage: " + url)
            return r.fulfill(status=404, body="")
        page.route("**/*", route)
        page.goto(base.ORIGIN + "/")
        page.wait_for_function("()=>KARTEN.every(t=>!!customElements.get(t))".replace("KARTEN", json.dumps(KARTENARTEN)))

        def platziere(tag, variante, cfg, eingeklappt, kompakt):
            """Ausgeklappt: localStorage leer. Eingeklappt: Schlüssel der Karte vorbelegen, dann neu platzieren."""
            konfig = {**cfg, **({"collapsed_items": kompakt} if eingeklappt and kompakt else {})}
            page.evaluate("()=>localStorage.clear()")
            page.evaluate("([t,v,c])=>place(t,v,c)", [tag, variante, konfig])
            if eingeklappt:
                schluessel = page.evaluate("t=>document.querySelector(t)._schluessel()", tag)
                page.evaluate("k=>localStorage.setItem(k,'1')", schluessel)
                page.evaluate("([t,v,c])=>place(t,v,c)", [tag, variante, konfig])
            page.wait_for_timeout(250)

        for name, tag, variante, cfg, kompakt, _ in (FAELLE[0], FAELLE[15]):
            platziere(tag, variante, cfg, False, kompakt)
            report["selbsttest"][name + "-aus"] = selbsttest(page, tag)
            platziere(tag, variante, cfg, True, kompakt)
            report["selbsttest"][name + "-ein"] = selbsttest(page, tag)

        def messung(pg):
            breite = pg.viewport_size["width"]
            thema = pg.evaluate("document.documentElement.dataset.theme")
            ergebnis = {}
            for name, tag, variante, cfg, kompakt, labels in FAELLE:
                hoehen = {}
                inhalt_aus = 0
                for zustand, eingeklappt in (("aus", False), ("ein", True)):
                    platziere(tag, variante, cfg, eingeklappt, kompakt)
                    fall = f"{name}-{zustand}"
                    bild = f"{fall}-{breite}-{thema}.png"
                    pg.locator(tag).screenshot(path=str(OUT / bild))
                    kopf = pg.evaluate(JS_KOPF, tag)
                    info = pg.evaluate(base.JS_KARTE, tag)
                    eintrag = {"fall": fall, "breite": breite, "thema": thema, "bild": bild, "kopf": kopf, **info}
                    ort = f"{fall} {breite} {thema}"
                    hoehen[zustand] = kopf["hoehe"]
                    if not eingeklappt:
                        inhalt_aus = kopf["inhalt"]
                    check(not pg.evaluate(base.JS_HSCROLL), f"horizontaler Scroll {ort}")
                    check(not info["ziele"], f"Touchziel < 44 px {ort}: {info['ziele']}")
                    check(not info["laedt"], f"Ladezustand {ort}")
                    # Buchstaben der ha-icon-Attrappe sind kein Text (echtes Icon = SVG neben einem Statustext): nur Hinweis.
                    niedrig = [x for x in info["kontrast_niedrig"] if x["q"] < 2 and x["klasse"] != "ha-icon"]
                    check(not niedrig, f"Kontrast < 2:1 {ort}: {niedrig}")
                    if info["kontrast_niedrig"]:
                        report["hinweise"].append(f"Kontrast < 4.5:1 {ort}: {info['kontrast_niedrig']}")
                    check(kopf["titel_transform"] not in (None, "uppercase"), f"Titel {ort}: {kopf['titel_transform']}")
                    check(kopf["toggle"] and kopf["toggle_im_kopf"] and not kopf["toggle_in_aktionen"], f"Einklapp-Knopf nicht im Kopf {ort}: {kopf}")
                    check(kopf["toggle_ganz_rechts"] and kopf["toggle_oben"], f"Einklapp-Knopf nicht oben rechts {ort}: {kopf['toggle_rect']} {kopf['kopf']}")
                    # Icon mittig zum Textblock (Titel, ggf. umbrochenes Badge, Untertitel), nicht darüber oder darunter.
                    check(kopf["ikon_im_textblock"] is not False, f"Icon außerhalb der Textblockhöhe {ort}: {kopf['ikon']} {kopf['titel_rect']}")
                    check(kopf["toggle_expanded"] == ("false" if eingeklappt else "true"), f"aria-expanded {ort}: {kopf['toggle_expanded']}")
                    if eingeklappt:
                        gesehen = [k["label"] for k in kopf["kompakt"]]
                        if kompakt and name != "interface":
                            check(kopf["kompakt_zeile"] and all(l in gesehen for l in labels), f"Kompaktzeile {ort}: {gesehen}, erwartet {labels}")
                        else:
                            check(not kopf["kompakt_zeile"], f"unerwartete Kompaktzeile {ort}: {gesehen}")
                        if name == "vm-gestoppt":
                            check(not any(l in ("CPU", "RAM") for l in gesehen), f"gestoppt mit CPU/RAM {ort}: {gesehen}")
                        check(all(k["wert"] and k["wert"] not in ("–", "NaN", "undefined") for k in kopf["kompakt"]), f"leerer Kompaktwert {ort}: {kopf['kompakt']}")
                    else:
                        check(not kopf["kompakt_zeile"], f"Kompaktzeile ausgeklappt {ort}")
                        if name == "gpu":
                            werte = pg.evaluate(JS_GPU, tag)
                            eintrag["gpu"] = werte
                            check(len(werte) >= 4 and max(w["rechts"] for w in werte) - min(w["rechts"] for w in werte) <= 1 and all(w["zellen"] == 3 for w in werte),
                                  f"GPU-Werte nicht bündig {ort}: {werte}")
                        if name == "cpu":
                            eintrag["temperatur"] = pg.evaluate(JS_TEMP, tag)
                        if name in ("vm", "stack", "container"):
                            check(kopf["badge_in_titelzeile"], f"Badge nicht in der Titelzeile {ort}")
                        if name == "vm":
                            # [A-13] Umbruch nur, wenn die Knöpfe nebeneinander nicht passen (R06).
                            check(kopf["aktion_zeilen"] <= 1 or kopf["aktion_breite_noetig"] > kopf["aktion_breite_da"],
                                  f"VM-Aktionen ohne Platzmangel umgebrochen {ort}: {kopf['aktion_breite_noetig']}/{kopf['aktion_breite_da']}")
                            check(kopf["rest_unten"] <= 24, f"VM-Karte höher als nötig {ort}: {kopf['rest_unten']} px unter dem Inhalt")
                        if name == "server":
                            check(kopf["aktionen"] == ["mover_start", "more"], f"Serveraktionen {ort}: {kopf['aktionen']}")
                    report["karten"].append(eintrag)
                    ergebnis[f"{fall}"] = messe_text(pg, tag)
                # Ohne Inhalt unter dem Kopf (gestoppte VM) gibt es nichts einzuklappen; die gewählte Kompaktzeile kommt hinzu.
                if inhalt_aus:
                    check(hoehen["ein"] < hoehen["aus"], f"eingeklappt nicht niedriger {name} {breite} {thema}: {hoehen}")
            # CPU-Temperaturstufen: 52 °C ohne Punkt, 89 °C Warnung, 93 °C kritisch (mit Text, R16/R17).
            for variante, stufe, wort in (("kuehl", None, None), ("voll", "sem-warning", "hoch"), ("kritisch", "sem-error", "kritisch")):
                platziere("busch-unraid-cpu-card", variante, {"device_id": "srv"}, False, [])
                bild = f"cpu-temp-{variante}-{breite}-{thema}.png"
                pg.locator("busch-unraid-cpu-card").screenshot(path=str(OUT / bild))
                temp = pg.evaluate(JS_TEMP, "busch-unraid-cpu-card")
                report["karten"].append({"fall": f"cpu-temp-{variante}", "breite": breite, "thema": thema, "bild": bild, "temperatur": temp})
                if stufe:
                    check(any(stufe in x["stufe"] and wort in x["text"] for x in temp["punkte"]), f"CPU-Temperatur {variante} {breite} {thema}: {temp}")
                else:
                    check(not temp["punkte"] and any("52" in t for t in temp["texte"]), f"CPU-Temperatur kühl mit Punkt {breite} {thema}: {temp}")
                ergebnis[f"cpu-temp-{variante}"] = messe_text(pg, "busch-unraid-cpu-card")
            # Servermenü (flüchtig, R04/R08/R23).
            platziere(SERVER, "voll", {"device_id": "srv"}, False, [])
            pg.locator(MEHR).click()
            pg.wait_for_selector(MENUE)
            pg.wait_for_timeout(200)
            lage = pg.evaluate(JS_MENUE)
            bild = f"servermenue-{breite}-{thema}.png"
            pg.screenshot(path=str(OUT / bild))
            report["menue"].append({"breite": breite, "thema": thema, "bild": bild, **lage})
            check(lage["items"] == ["server_reboot", "server_shutdown"], f"Menüeinträge {breite} {thema}: {lage['items']}")
            check(lage["sheet"] == (breite < 450) and lage["innen"] and not lage["klein"], f"Menülage {breite} {thema}: {lage}")
            check(pg.evaluate("()=>document.querySelector('busch-unraid-server-card').shadowRoot.querySelector('[data-focus-key=more]').getAttribute('aria-expanded')") == "true", f"⋮ ohne aria-expanded {breite} {thema}")
            ergebnis["servermenue"] = messe_text(pg, MENUE)
            pg.keyboard.press("Escape")
            pg.wait_for_timeout(400)
            fokus = pg.evaluate("()=>{const c=document.querySelector('busch-unraid-server-card');return document.activeElement===c&&c.shadowRoot.activeElement?.dataset?.focusKey}")
            check(fokus == "more" and not pg.evaluate("()=>!!document.querySelector('busch-unraid-docker-menu')"), f"Fokus nach Escape {breite} {thema}: {fokus}")
            # Editoren aller 17 Karten.
            for name, tag, variante, cfg, kompakt, _ in FAELLE:
                if name in ("vm-gestoppt", "vm-liste"):
                    continue
                editor = tag + "-editor"
                pg.evaluate("""([tag,v,cfg])=>{localStorage.clear();place(tag,v,cfg);
                  const wrap=document.querySelector('#wrap');const e=document.createElement(tag+'-editor');e.setAttribute('data-anzeige-editor','');
                  window.editorConfig=null;e.addEventListener('config-changed',ev=>window.editorConfig=ev.detail.config);
                  e.setConfig({type:'custom:'+tag,...cfg});e.hass={locale:{language:'de'},states:{}};wrap.replaceChildren(e);}""", [tag, variante, cfg])
                pg.wait_for_timeout(200)
                bild = f"editor-{name}-{breite}-{thema}.png"
                pg.locator(editor).screenshot(path=str(OUT / bild))
                felder = pg.evaluate("""ed=>{const f=document.querySelector(ed).querySelector('ha-form');const o=n=>[...f.querySelectorAll('input[name="'+n+'"]')].map(i=>({wert:i.value,an:i.checked,text:i.parentElement.textContent}));
                  return {visible:o('visible_items'),collapsed:o('collapsed_items'),felder:[...f.querySelectorAll('.feld')].map(x=>x.dataset.feld),show:[...f.querySelectorAll('.feld')].map(x=>x.dataset.feld).filter(n=>/^show_(cpu|ram|status|containers|clock|temperatures|history|boot)$/.test(n))}}""", editor)
                eintrag = {"editor": name, "breite": breite, "thema": thema, "bild": bild, **felder}
                ort = f"Editor {name} {breite} {thema}"
                check(len(felder["visible"]) > 0 and all(x["an"] for x in felder["visible"]), f"{ort}: visible_items fehlt oder nicht vorbelegt: {felder['visible']}")
                check(all(x["text"].strip() and x["text"].strip() != x["wert"] for x in felder["visible"] + felder["collapsed"]), f"{ort}: Option ohne Beschriftung")
                check((len(felder["collapsed"]) == 0) == (name == "interface"), f"{ort}: collapsed_items {felder['collapsed']}")
                check(not felder["show"], f"{ort}: überführte Altschalter im Formular: {felder['show']}")
                eintrag["regel1"] = messe_text(pg, editor)
                ergebnis[f"editor-{name}"] = eintrag["regel1"]
                if breite == 960 and thema == "light":
                    erstes = felder["visible"][0]["wert"]
                    pg.locator(f'{editor} input[name="visible_items"][value="{erstes}"]').uncheck()
                    pg.wait_for_timeout(100)
                    neu = pg.evaluate("window.editorConfig")
                    eintrag["nach_abwahl"] = neu
                    check(isinstance(neu, dict) and isinstance(neu.get("visible_items"), list) and erstes not in neu["visible_items"]
                          and not any(k.startswith("show_") and k[5:] in ("cpu", "ram", "status", "containers", "clock", "temperatures", "history", "boot") for k in neu),
                          f"{ort}: Abwahl schreibt {neu}")
                report["editoren"].append(eintrag)
            return ergebnis

        report["breiten"] = lauf_breiten(page, breiten=BREITEN, messung=messung, hoehe=1200)
        schreibe(OUT / "report.json", report, zeige=0)

        # Regel 2 am Servermenü je Breite (flüchtig: Scrim schließt, kein Verlaufsrest).
        for breite in BREITEN:
            page.set_viewport_size({"width": breite, "height": 800})
            base.thema(page, "light")
            platziere(SERVER, "voll", {"device_id": "srv"}, False, [])
            report["popup"][str(breite)] = messe_popup(page, lambda: page.locator(MEHR).click(), ".menu-panel",
                                                       schliessen_knopf_selektor=".menu-close", dialog_typ="ansicht")
            for regel in ("escape", "zurueck", "schliessknopf", "obenauf", "scrim"):
                urteil = report["popup"][str(breite)].get(regel, {})
                ohne_punkt = regel == "scrim" and breite < 450 and urteil.get("ergebnis") == "kein_urteil" and urteil.get("beleg", {}).get("kein_punkt") is True
                check(urteil.get("ergebnis") == "bestanden" or ohne_punkt, f"Servermenü {breite} {regel}: {urteil}")

        # E2E: Menü → Bestätigung → Abbrechen ohne Aufruf, Bestätigen genau ein button.press.
        page.set_viewport_size({"width": 960, "height": 800})
        platziere(SERVER, "voll", {"device_id": "srv"}, False, [])
        page.evaluate("window.calls=[]")
        laenge = page.evaluate("history.length")
        e2e = report["e2e"]
        for key, annehmen in (("server_reboot", False), ("server_shutdown", True)):
            page.locator(MEHR).click()
            page.wait_for_selector(MENUE)
            page.locator(f"{MENUE} .item[data-action='{key}']").click()
            page.wait_for_selector(base.DIALOG)
            text = page.locator(base.DIALOG).inner_text()
            knopf = "last" if annehmen else "first"
            page.locator(f"[role=alertdialog] .buttons button:{knopf}-child").click()
            page.wait_for_function("()=>!document.querySelector('busch-unraid-confirm')")
            page.wait_for_timeout(400)
            e2e[key] = {"dialog_text": text, "aufrufe": page.evaluate("JSON.parse(JSON.stringify(window.calls))"),
                        "fokus": page.evaluate("()=>document.querySelector('busch-unraid-server-card').shadowRoot.activeElement?.dataset?.focusKey||null"),
                        "menue_weg": page.evaluate("()=>!document.querySelector('busch-unraid-docker-menu')")}
        e2e["history"] = {"vorher": laenge, "nachher": page.evaluate("history.length"), "state": page.evaluate("history.state")}
        check("Tower" in e2e["server_reboot"]["dialog_text"] and e2e["server_reboot"]["aufrufe"] == [] and e2e["server_reboot"]["menue_weg"],
              f"Abbrechen Neustart: {e2e['server_reboot']}")
        check(e2e["server_shutdown"]["aufrufe"] == [["button", "press", {"entity_id": "button.tower_server_shutdown"}]],
              f"Bestätigen Ausschalten: {e2e['server_shutdown']}")
        check(e2e["server_reboot"]["fokus"] == "more", f"Fokus nach Abbrechen: {e2e['server_reboot']['fokus']}")
        state = json.dumps(e2e["history"]["state"] or {})
        check("buschUnraidDockerMenu" not in state and "buschUnraidConfirm" not in state, f"verwaister Verlaufseintrag: {state}")
        browser.close()

    report["abgeschlossen"] = True
    schreibe(OUT / "report.json", report, zeige=0)
    code = max(bewerte(report), int(bool(fehler or report["seitenfehler"])))
    print(json.dumps({"zaehlung": zaehle(report), "eigene": fehler[:40], "anzahl_eigene": len(fehler), "hinweise": len(report["hinweise"]),
                      "seitenfehler": report["seitenfehler"][:10], "bilder": len(list(OUT.glob("*.png"))), "exit": code}, ensure_ascii=False, indent=1))
    return code


if __name__ == "__main__":
    sys.exit(main())
