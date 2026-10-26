#!/usr/bin/env python3
"""Stage 2 final render, to be run once by the main session (never against HA).

Container invocation: python3 /repo/docs/render/stufe2.py /repo/dist/unraid-cards.js /out
Mount the shared rule helpers at /work. Services and telemetry are synthetic.
All changed cards, core disclosure, interface editor and all ten confirmations:
320/480/960 px, light/dark; text, touch targets, scroll, focus and modal history.
"""
import copy
import json
import pathlib
import shutil
import subprocess
import sys

sys.path.insert(0, "/work")
from playwright.sync_api import sync_playwright
from regeln import bewerte, lauf_breiten, messe_popup, messe_text, schreibe, selbsttest, zaehle
import kacheln as base

BUNDLE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/stufe2-out")
OUT.mkdir(parents=True, exist_ok=True)
CARDS = ["server", "system", "cpu", "gpu", "array", "parity", "shares", "vm-usage", "interface"]
ACTIONS = {"server": ["server_reboot", "server_shutdown", "mover_start"],
           "array": ["array_start", "array_stop", "spindown_all"],
           "parity": ["parity_start", "parity_pause", "parity_resume", "parity_cancel"]}
CLOSE = "[role=alertdialog] .close"
FORM = """<style>busch-unraid-interface-card-editor{display:block;min-width:0;color:var(--primary-text-color);background:var(--card-background-color);padding:16px;box-sizing:border-box}</style><script>
customElements.define('ha-form',class extends HTMLElement {
 set schema(v){this._schema=v;this.draw()} get schema(){return this._schema}
 set data(v){this._data=v;this.draw()} get data(){return this._data}
 set computeLabel(v){this._label=v;this.draw()}
 set computeHelper(v){this._helper=v;this.draw()}
 draw(){this.replaceChildren();for(const s of this._schema||[]){
 const box=document.createElement('div');box.style.cssText='display:grid;gap:8px;margin:12px 0;overflow-wrap:anywhere;min-width:0';
 const label=document.createElement('label');label.textContent=this._label?.(s)||s.name;label.htmlFor='field-'+s.name;
 const input=document.createElement('input');input.id=label.htmlFor;input.name=s.name;input.type=s.name==='show_virtual'?'checkbox':'text';
 input.style.cssText='min-height:44px;min-width:44px;max-width:100%;box-sizing:border-box;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color)';
 if(input.type==='checkbox')input.checked=!!this._data?.[s.name];else input.value=this._data?.[s.name]||'';
 input.onchange=()=>{this._data={...this._data,[s.name]:input.type==='checkbox'?input.checked:input.value};this.dispatchEvent(new CustomEvent('value-changed',{detail:{value:this._data}}))};
 const help=document.createElement('small');help.textContent=this._helper?.(s)||'';box.append(label,input,help);this.append(box)}}
});
</script>"""


def fixtures():
    # Use the exact registry/state shapes tested by Node. No host data files are read.
    import playwright
    node = shutil.which("node") or str(pathlib.Path(playwright.__file__).parent / "driver" / "node")
    repo = pathlib.Path(__file__).resolve().parents[2]
    js = "const f=require('./tests/familie-attrappe.js').dashboardFixture; const out={}; for(const [name,options] of [['voll',{}],['legacy',{legacy:true}],['partial',{partial:true}]]){const x=f(options);out[name]={devices:[...x.devices.values()],entities:[...x.entities.values()]};} console.log(JSON.stringify(out))"
    data = json.loads(subprocess.check_output([node, "-e", js], cwd=repo, text=True))
    for variant in ["offline", "empty", "folder", "unknown"]:
        data[variant] = copy.deepcopy(data["voll"])
    for e in data["offline"]["entities"]:
        e["state"] = "unavailable"
    for e in data["empty"]["entities"]:
        if e["registry"]["unique_id"].endswith("_dashboard_interfaces"):
            e["attributes"]["interfaces"] = []
    for variant in ["folder", "unknown"]:
        for e in data[variant]["entities"]:
            if e["registry"]["unique_id"].endswith("_dashboard_storage"):
                e["attributes"]["docker_mode"] = variant
                e["attributes"]["filesystems"] = [x for x in e["attributes"]["filesystems"] if x["kind"] != "docker_vdisk"]
    return data


def main():
    report = {"abgeschlossen": False, "selbsttest": {}, "breiten": {}, "popup": {}, "actions": [], "eigene_verstoesse": [], "seitenfehler": [], "netz": []}
    failures = report["eigene_verstoesse"]
    def check(ok, message):
        if not ok:
            failures.append(message)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 960, "height": 1200}, locale="de-DE")
        page.clock.set_fixed_time("2026-01-02T12:00:00Z")
        page.on("pageerror", lambda e: report["seitenfehler"].append(str(e)))
        page.on("console", lambda m: m.type == "error" and report["seitenfehler"].append(m.text))
        html = base.seite_mit_attrappe(fixtures()).replace('<script src="/unraid-cards.js">', FORM + '<script src="/unraid-cards.js">')
        def route(r):
            url = r.request.url
            report["netz"].append(url)
            if url == base.ORIGIN + "/unraid-cards.js":
                return r.fulfill(body=BUNDLE.read_text(), content_type="text/javascript")
            if url == base.ORIGIN + "/":
                return r.fulfill(body=html, content_type="text/html")
            failures.append("Unexpected network request: " + url)
            return r.fulfill(status=404, body="")
        page.route("**/*", route)
        page.goto(base.ORIGIN + "/")
        page.wait_for_function("!!customElements.get('busch-unraid-interface-card')")
        def place(kind, variant="voll", config=None):
            tag = "busch-unraid-" + kind + "-card"
            page.evaluate("([tag,variant,cfg])=>place(tag,variant,{device_id:'demo',show_clock:false,show_history:false,...cfg})", [tag, variant, config or {}])
            return tag
        tag = place("interface")
        report["selbsttest"]["interface"] = selbsttest(page, tag)
        def capture(name, selector):
            width = page.viewport_size["width"]
            theme = page.evaluate("document.documentElement.dataset.theme")
            page.locator(selector).screenshot(path=str(OUT / f"{name}-{width}-{theme}.png"))
            check(not page.evaluate(base.JS_HSCROLL), f"Horizontal scroll: {name}/{width}/{theme}")
            text = messe_text(page, selector)
            check(text.get("geprueft", 0) > 0 and text.get("geprueft_mit_kasten", 0) > 0,
                  f"Empty text measurement: {name}/{width}/{theme}: {text}")
            return text
        def measurement(pg):
            results = {}
            for kind in CARDS:
                for variant in ["voll", "partial", "legacy", "offline"]:
                    tag = place(kind, variant)
                    results[kind + "-" + variant] = capture(kind + "-" + variant, tag)
                    info = pg.evaluate(base.JS_KARTE, tag)
                    check(not info["laedt"], f"Unexpected loading: {kind}/{variant}")
                    check(not info["ziele"], f"Small touch target: {kind}/{variant}: {info['ziele']}")
            for variant in ["folder", "unknown"]:
                tag = place("system", variant)
                results["docker-" + variant] = capture("docker-" + variant, tag)
            tag = place("interface", "empty")
            results["interfaces-empty"] = capture("interfaces-empty", tag)
            tag = place("interface", config={"show_virtual": False})
            check("br-demo" not in pg.evaluate("tag=>document.querySelector(tag).shadowRoot.textContent", tag), "Virtual filter failed")
            results["interfaces-physical"] = capture("interfaces-physical", tag)
            tag = place("cpu")
            summary = pg.locator(tag + " summary")
            summary.focus()
            summary.press("Enter")
            check(pg.locator(tag + " details").get_attribute("open") is not None, "Keyboard core disclosure failed")
            focus_retained = pg.evaluate("""()=>{
                const card=document.querySelector('busch-unraid-cpu-card');
                const before=card.shadowRoot.querySelector('summary');
                const entity=kern.entities.get('sensor.demo_dashboard_cpu');
                entity.attributes={...entity.attributes,cores:entity.attributes.cores.map((row,index)=>index?row:{...row,percent:1})};
                card.hass={...card._hass};
                const after=card.shadowRoot.querySelector('summary');
                return before!==after&&after===card.shadowRoot.activeElement&&card.shadowRoot.querySelector('details').open;
            }""")
            check(focus_retained, "Keyboard focus/open state lost on core telemetry render")
            results["cores-open"] = capture("cores-open", tag)
            editor = "busch-unraid-interface-card-editor"
            pg.evaluate("tag=>{document.querySelector('#wrap').replaceChildren();const e=document.createElement(tag);e.setConfig({type:'custom:busch-unraid-interface-card',device_id:'demo'});e.hass={locale:{language:'de'}};e.addEventListener('config-changed',ev=>window.editorConfig=ev.detail.config);document.querySelector('#wrap').append(e)}", editor)
            results["interface-editor"] = capture("interface-editor", editor)
            pg.locator(editor + " input[name=show_virtual]").uncheck()
            check(pg.evaluate("window.editorConfig?.show_virtual===false"), "Editor did not publish filter config")
            for kind, keys in ACTIONS.items():
                for key in keys:
                    tag = place(kind)
                    pg.evaluate("window.calls=[]")
                    opener = tag + f' [data-focus-key="{key}"]'
                    pg.locator(opener).click()
                    pg.wait_for_selector(base.DIALOG)
                    check("Example server" in pg.locator(base.DIALOG).inner_text(), "Missing confirmation target: " + key)
                    check(pg.evaluate("document.querySelector('busch-unraid-confirm').shadowRoot.activeElement.textContent") == "Abbrechen", "Confirmation did not focus cancel: " + key)
                    results[key + "-dialog"] = capture(key + "-dialog", base.DIALOG)
                    pg.locator(base.ABBRECHEN).click()
                    check(pg.evaluate("window.calls.length") == 0, "Cancel sent service: " + key)
                    pg.locator(opener).click()
                    pg.locator("[role=alertdialog] .buttons button:last-child").click()
                    pg.wait_for_function("window.calls.length===1")
                    calls = pg.evaluate("window.calls")
                    check(calls == [["button", "press", {"entity_id": "button.demo_" + key}]], "Wrong service/target: " + key)
                    report["actions"].append({"key": key, "width": pg.viewport_size["width"], "calls": calls})
            return results
        report["breiten"] = lauf_breiten(page, breiten=(320, 480, 960), messung=measurement, hoehe=1200)
        schreibe(OUT / "report.json", report, zeige=0)
        for width in (320, 480, 960):
            page.set_viewport_size({"width": width, "height": 800})
            for kind, keys in ACTIONS.items():
                for key in keys:
                    tag = place(kind)
                    opener = tag + f' [data-focus-key="{key}"]'
                    # Shared JS helpers query each shadow root separately: the
                    # selector must name the inner sheet without crossing hosts.
                    popup = messe_popup(page, lambda o=opener: page.locator(o).click(), base.DIALOG, schliessen_knopf_selektor=CLOSE, dialog_typ="bestaetigung")
                    report["popup"][f"{key}-{width}"] = popup
                    for rule in ("escape", "zurueck", "schliessknopf", "obenauf", "scrim"):
                        verdict = popup.get(rule, {})
                        # A narrow fullscreen sheet may leave no outside point;
                        # at 480/960 px even Scrim must have a real verdict.
                        no_outside_point = (rule == "scrim" and width == 320
                                            and verdict.get("ergebnis") == "kein_urteil"
                                            and verdict.get("beleg", {}).get("kein_punkt") is True)
                        check(verdict.get("ergebnis") in ("bestanden", "verletzt") or no_outside_point,
                              f"Missing popup verdict: {key}/{width}/{rule}: {popup.get(rule)}")
                    schreibe(OUT / "report.json", report, zeige=0)
        browser.close()
    report["abgeschlossen"] = True
    schreibe(OUT / "report.json", report, zeige=0)
    code = max(bewerte(report), int(bool(failures or report["seitenfehler"])))
    print(json.dumps({"zaehlung": zaehle(report), "eigene": failures, "seitenfehler": report["seitenfehler"], "report": str(OUT / "report.json"), "exit": code}, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
