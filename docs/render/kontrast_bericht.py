"""M26 (#1327, W2/W10): contrast and touch targets per rendered state for the Unraid render scripts.

Wraps ``regeln.messe_kontrast_touch_hier`` (hacs/docs/render/regeln.py, measurement in hacs/scripts/kontrast_touch.py)
for scripts with their own width/theme loop and keeps the report form of anzeige.py: report.json gets the areas
``kontrast`` and ``touch``, one run per state ``{fall, breite, thema, kontrast_verstoesse|touch_verstoesse, ausnahmen,
geprueft, ...}``, plus ``ungenutzte_ausnahmen``. Exceptions come from ``kontrast-ausnahmen.json`` next to this file,
each with a reason.

Without regeln.py (repo CI job ``contracts``, M45, .github/ci-contracts.txt) nothing is measured and both areas carry
``kein_urteil``; the script keeps running. With regeln.py every listed violation counts (``verstoesse``), and a run that
measured nothing is a violation, not a pass.
"""
import json
import pathlib

AUSNAHMEN = pathlib.Path(__file__).with_name("kontrast-ausnahmen.json")
BEREICHE = ("kontrast", "touch")
MINDEST_PX = 44
KEIN_URTEIL = "regeln.py nicht gefunden - Kontrast/Touch nicht gemessen (Repo-CI ohne /work)"
JS_THEMA = ("()=>document.documentElement.dataset.theme"
            "||(String(getComputedStyle(document.documentElement).colorScheme).includes('dark')?'dark':'light')")


class KontrastTouch:
    """Collects one contrast/touch measurement per state; ``regeln`` is the module or None (CI mode)."""

    def __init__(self, regeln):
        self.regeln = regeln
        self.datei = None
        self.laeufe = {b: [] for b in BEREICHE}

    def messe(self, page, selektor, fall, breite=None, thema=None):
        """Measure the current state of the card/dialog ``selektor`` (crosses shadow roots) as run ``fall``."""
        if self.regeln is None:
            return None
        if breite is None:
            breite = page.viewport_size["width"]
        if thema is None:
            thema = page.evaluate(JS_THEMA)
        messung = self.regeln.messe_kontrast_touch_hier(page, selektor, ausnahmen=AUSNAHMEN)
        for b in BEREICHE:
            self.datei = messung[b].get("ausnahmen_datei", self.datei)
            self.laeufe[b].append({"fall": fall, "breite": breite, "thema": thema,
                                   **{k: v for k, v in messung[b].items() if k != "ausnahmen_datei"}})
        return messung

    def verstoesse(self):
        """Number of violations (0 in CI mode); nothing measured with regeln.py present counts as one."""
        if self.regeln is None:
            return 0
        if not self.laeufe["kontrast"]:
            return 1
        return sum(len(l.get(b + "_verstoesse") or []) for b in BEREICHE for l in self.laeufe[b])

    def bericht(self):
        """Both areas for report.json (``report.update(kt.bericht())``)."""
        if self.regeln is None:
            return {b: {"kein_urteil": KEIN_URTEIL} for b in BEREICHE}
        liste = json.loads(AUSNAHMEN.read_text(encoding="utf-8")) if AUSNAHMEN.is_file() else {}
        out = {}
        for b in BEREICHE:
            benutzt = {a.get("selektor") for l in self.laeufe[b] for a in l.get("ausnahmen", [])}
            out[b] = {"ausnahmen_datei": self.datei or str(AUSNAHMEN),
                      "ungenutzte_ausnahmen": [a["selektor"] for a in liste.get(b, []) if a["selektor"] not in benutzt],
                      "laeufe": self.laeufe[b]}
        out["touch"] = {"mindest_px": MINDEST_PX, **out["touch"]}
        return out
