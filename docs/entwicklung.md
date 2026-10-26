# Entwicklung

## Aufbau

`dist/unraid-cards.js` ist Quelltext und Auslieferung in einem: Vanilla-JS mit
Custom Elements, kein Bundler, keine Abhängigkeit. HACS liefert für ein
Dashboard-Repo genau diese eine Datei aus; Unterordner erreichen den Browser
nie. Die Datei gliedert sich in Abschnitte (Kommentarköpfe im Code):

| Abschnitt | Inhalt |
| --- | --- |
| `BEGIN/END BUSCH SHARED UI` | gemeinsame UI-Bausteine aller Busch-Kartenrepos (Editorbasis, Medien, Status, Sprache). Wortgleich mit Versions- und Hashkopf; nie von Hand ändern, sondern zentral abgleichen. |
| Kern (Kopie aus Busch Cards) | `BuschCardsCore`, `ensureBuschCore`, Registercache, Entitätsindex, Abfrage-Engine und die Smart-Abfragen (`BuschSmartQueries`, `buschSmart*`, auto-entities-Attribution mit MIT-Hinweis). Zur Laufzeit gibt es den Kern nur einmal (`globalThis[Symbol.for("busch.cards.core")]`, API 1): wer zuerst lädt, legt ihn an — auch für Busch-Cards-Karten wie Gerät und Smart. Deshalb ist der Abschnitt von `const BUSCH_CORE_KEY` bis zum Ende von `BuschSmartQueries` **byte-gleich** zu `busch-cards/dist/busch-cards.js`; nie von Hand ändern, sondern aus Busch Cards übernehmen und mit `python3 scripts/kern-gleich-pruefen.py` (im hacs-Ordner) bzw. `tests/kern.test.js` belegen. `ensureBuschCore` bleibt eine globale Funktion und wird als `ensureBuschCore(1)` aufgerufen. |
| Version und Sprache | `CARD_VERSION`, Konsolenbanner, Sprachwahl nach `hass.locale.language` (im Kartenwähler nach `navigator.language`). |
| Unraid-Familie | Stack-, Container- und VM-Karte samt Modell (`buschUnraidModel`), Editoren und gemeinsamen Vorgaben (`BUSCH_UNRAID_DEFAULTS`). |
| Unraid-Docker-Übersicht | `busch-unraid-docker-card` mit Kachelraster und Aktionsmenü. |
| Kachel-Basis | `BuschUnraidTile` (Kopf, Einklappen mit `localStorage`), Bausteine Balken, Ring, Tabelle, Raster, Statuspunkt, das Servermodell und der zentrale Bestätigungsdialog `busch-unraid-confirm`. |
| Kacheln | die neun Kacheln Server, System, Prozessor, GPU, Array, Parität, Airflow, Shares, VM-Nutzung mit gemeinsamem Editor `BuschUnraidTileEditor`. |

Feste Verträge:

- `CARD_VERSION = "0.1.0"` muss zum Tag passen; der Release-Workflow liest
  den Wert per Regex (genau diese Schreibweise mit doppelten Anführungszeichen).
- Jedes Element wird nur definiert, wenn es noch fehlt
  (`if(!customElements.get?.(tag))customElements.define(tag,Klasse);`). So
  laufen Unraid Cards und ältere Busch Cards (≤ 0.21) ohne Absturz
  nebeneinander; das zuerst geladene Bundle gewinnt.
- Je Karte ein Editor-Schema `SCHEMA_<TAG>` und ein Wörterbuch `TEXTE_<TAG>`
  (Tag groß, `-` → `_`, z. B. `SCHEMA_BUSCH_UNRAID_CPU_CARD`). Jedes
  Schemafeld braucht Label und Helper in Deutsch und Englisch; die Texte
  stehen wörtlich im Literal, weil der statische UI-Regelprüfer nur Literale
  liest.
- Entitäten werden über das Entitätsregister gefunden und über den Suffix
  der `unique_id` (`<config_entry_id>_<suffix>`) zugeordnet, nie über
  Anzeigenamen.
- Farben nur über Theme-Variablen von Home Assistant (Hexwerte höchstens als
  `var()`-Ersatz); Status nie nur über Farbe.
- Der Bestätigungsdialog schließt mit Escape, Zurück und *Abbrechen*, **nicht**
  per Klick daneben (DESIGN_GUIDELINES R04 hat Vorrang vor der allgemeinen
  Popup-Regel).
- Kacheln und VM-Liste bauen nur bei geänderter Render-Signatur neu (Modell,
  Konfiguration, Einklappen, Busy, Fehler, Sprache; die Server-Uhr zusätzlich
  die Minute) und beobachten Server und Kindgeräte per `watchDevice`
  (`unraidBeobachten`), damit Stream-Updates ankommen.

### Ausnahme R24: Stack- und Container-Einzelkarte

Die Kacheln und die VM-Liste klappen über den Pfeil im Kopf bis auf den Kopf
ein (R21, gemerkt im Browser). Die Stack- und die Container-Karte sind
bewusst **kompakte Einzelkarten** ohne dieses Kopf-Einklappen: Ihr Kopf trägt
Status und Steueraktionen, die eingeklappt nicht verschwinden dürfen, und die
Stack-Karte hat stattdessen ein eigenes Auf-/Zuklappen der Containerliste
(`start_expanded`, Knopf „Container (n)“). Ein zweiter Einklapp-Pfeil daneben
würde zwei Bedeutungen für dasselbe Symbol schaffen.

## Tests

Unit- und Frontendtests mit `node --test` gegen eine `hass`-Attrappe
(`tests/attrappe.js`, `tests/dom-attrappe.js`, `tests/familie-attrappe.js`);
kein Browser, kein Netz. Für den Byte-Vergleich des Kerns zusätzlich
`busch-cards` schreibgeschützt unter `/busch-cards` einhängen
(`-v "$PWD/../busch-cards:/busch-cards:ro"`); fehlt es, überspringt
`tests/kern.test.js` diesen Teil mit Begründung. Node läuft nicht auf dem Host, sondern in einem
Container mit Node ≥ 20, die Quellen werden schreibgeschützt eingehängt und
im Container kopiert:

```bash
docker run --rm --network none \
  -v "$PWD:/src:ro" \
  node:22-alpine \
  sh -c 'cp -r /src /r && cd /r && node --check dist/unraid-cards.js && node --test tests/*.test.js'
```

| Datei | Prüft |
| --- | --- |
| `tests/namensraum.test.js` | keine doppelten Namen auf oberster Ebene im Bundle |
| `tests/vertrag.test.js` | je Kachel Schema und Wörterbuch de/en, `getStubConfig`, Editor, Rasterspalten, Kartenwähler-Eintrag |
| `tests/tile-basis.test.js` | Kachel-Basis, Bausteine, Einklappen, Bestätigungsdialog (Doppelklick, Escape, kein Schließen per Klick daneben) |
| `tests/server-modell.test.js` | Servermodell, Zuordnung über `unique_id`, Rohnamen der Kindgeräte |
| `tests/kacheln.test.js` | die neun Kacheln samt Leer-, Fehl- und Nicht-verfügbar-Zuständen |
| `tests/unraid-cards.test.js` | Stack-, Container- und VM-Karte, Abbildung alter Konfigurationsschlüssel |
| `tests/unraid-docker-card.test.js` | Docker-Übersicht |
| `tests/kern.test.js` | `smartQuery` des Kerns, Byte-Gleichheit des Kerns mit Busch Cards |
| `tests/schluss-*.test.js` | Schlussrunde #564: Render-Signatur und `watchDevice`, Lade-/Nicht-verfügbar-Zustände, Tabellen am Handy, Balkenkontrast, Ring, VM-Liste (Einklappen, `show_restart`), Kleinigkeiten |

## Renderprüfung (Chromium, erfundene Daten)

Die Skripte in `docs/render/` laden das Bundle in Chromium (Playwright,
Image `mcr.microsoft.com/playwright/python:v1.62.0-noble`), ersetzen die
HA-Bausteine durch Attrappen und arbeiten mit erfundenen Daten. Sie messen
Textüberlauf bei 320/480/960 px hell und dunkel sowie das Schließen der
Popups (Escape, Zurück, Schließen, Klick daneben).

Hinweis: Die Skripte binden das Messmodul `regeln.py` ein, das nicht in
diesem Repo liegt (es gehört zur Verwaltungsumgebung des Autors); ohne es
laufen sie nicht. Aufruf am Beispiel der Docker-Übersicht:

```bash
docker run --rm --network none \
  -v "$PWD:/repo:ro" \
  -v "<ordner-mit-regeln.py>:/work:ro" \
  --entrypoint bash mcr.microsoft.com/playwright/python:v1.62.0-noble \
  -c 'python3 /repo/docs/render/unraid-docker.py /repo/dist/unraid-cards.js /tmp/out'
```

| Skript | Inhalt |
| --- | --- |
| `unraid-cards.py` | Stack- und Containerkarte, schmale Breiten, lange Namen |
| `unraid-queue.py` | Update-Warteschlange und Fortschritt |
| `unraid-updated-family.py` | Stack/Container/VM im Kachelstil |
| `unraid-docker.py` | Docker-Übersicht, Menü, Bestätigung |
| `kacheln.py` | neun Kacheln und VM-Liste bei 320/480/960 px hell/dunkel, Leerzustände, Bestätigungsdialog (Regel 2, R04), Kontrast |
| `live-ha-unraid-family.py` | echte `ha-form`-Editoren in einem laufenden Home Assistant; braucht eine Zugangsdatei (`base_url`, `token`) außerhalb des Repos, die nie hineingehört |

Ergebnisse landen in `docs/render/ergebnis/` (nicht im Repo).

## Geprüft

**23.10.2026 – 0.1.0, Abnahme vor dem ersten Tag (`main` 5510abb, Todo #564):**
`node --check dist/unraid-cards.js` grün; `ui-regeln-pruefen.py` alle Repos
0 Verstöße. Zentraler Runner `karten-alle.sh --repo ha-unraid-cards`
(Lauf `karten-20261023-152420-982b56`): Node 188/188, `unraid-queue` und neues
`kacheln` grün; `unraid-cards`, `unraid-updated-family` und `unraid-docker`
rot, weil ihre E2E-Teile noch den nativen `window.confirm` beantworteten,
den die Karten seit dem eigenen Bestätigungsdialog `busch-unraid-confirm`
(R04) nicht mehr öffnen — Fehler der Prüfskripte, nicht des Kartencodes.
Skripte auf den eigenen Dialog umgestellt (Abbrechen = erster, Bestätigen =
letzter Knopf), nur diese drei Schritte wiederholt: grün
(`karten-20261023-152839-bab508` 41 Bilder, `karten-20261023-152905-71a813`
180 Bilder, `karten-20261023-152929-8c74a4` 35 Bilder).
`docs/render/kacheln.py` (neu; Daten = `tests/attrappe.js` als JSON): 14 Fälle
(9 Kacheln, VM-Liste, VM-Liste „alle“, Leerzustände GPU/Luftstrom/Parität) ×
320/480/960 px × hell/dunkel, 1102 Textprüfungen, 0 Überlauf/außerhalb/
Überlappung, 18 gewollt gekürzt; Selbsttest schlägt an. Bestätigungsdialog
bei 320/480/960 px: Escape, Zurück, Abbrechen, obenauf bestanden, Scrim-Klick
lässt ihn offen (R04); unter 450 px Blatt mit 96 % Höhe, darüber 320 px
Inhaltsbreite; Abbrechen ruft nichts auf, Bestätigen genau
`switch.turn_off switch.win`; kein verwaister Verlaufseintrag. Touchziele
≥ 44 px, kein horizontales Scrollen, 0 Seiten-/Konsolenfehler, keine fremden
Anfragen. Kontrast: nichts unter 2:1; Hinweise unter 4,5:1 nur für Knopfschrift
in `--primary-color` bzw. `--error-color` des Attrappen-Themas (Themasache).
Screenshots gesichtet (je Karte 320 px dunkel und 960 px hell, Dialog 320/960
in beiden Themen).

**23.10.2026 – 0.1.1 = 0.1.0 + README-Bilder (Todo #564):** kein Kartencode
geändert (im Bundle nur `CARD_VERSION`), die Abnahme von 0.1.0 gilt. Bilder
`docs/preview-*.png` aus `docs/render/vorschau.py` (Attrappe von `kacheln.py`,
MDI-Pfaddatei außerhalb des Repos), gesichtet.

**26.10.2026 – gemessene Kapazitätstitel (Todo #581, vor Veröffentlichung):**
Array-/Pool-/Bootgruppen zeigen „belegt von gesamt“. Das Array addiert nur
Datenlaufwerke, Pools zählen den logischen Dateisystemträger einmal. Die
Zuordnung nutzt weiterhin die Registry; HA-Datengrößeneinheiten werden vor
der Summierung nach Bytes umgerechnet. Fehlende/ungültige Werte ergeben „–“.
197/197 Node-Tests bestanden, darunter neun neue Kapazitätsregressionen;
Namensraum und Syntax grün, statische UI-Prüfung 0 Verstöße. Unabhängiger
Review ohne Befund. Abschließender Chromium-Lauf bei 320/480/960 px,
hell/dunkel: `kacheln` grün, 90 Bilder, keine Regelverstöße; die Kapazitätstitel
werden zusätzlich im Browser gegen die gemessenen Fixturewerte geprüft.
Array-Screenshots bei 320 px dunkel und 960 px hell gesichtet. Die parallel
laufende Integrationsmatrix bestand 1011/1011 Tests, 17/17 Suites, keine Skips.
Die synthetischen Daten sind keine Prüfung eines laufenden Unraid-Servers.

**26.10.2026 – 0.1.2:** Die geprüfte Änderung aus PR #1 wird veröffentlicht;
frische GitHub-CI grün. Gegenüber der obigen finalen Browserabnahme ändert
sich im Bundle nur CARD_VERSION. Syntax und statische UI-Prüfung vor dem
Tag erneut grün. Kapazitätssensoren stammen aus Unraid SSH 0.8.1.


**26.10.2026 – 0.2.0, Dashboarddaten und Serveraktionen:**
Erweiterte Kacheln für CPU, RAM, Hardware, Dateisysteme, SMART/Pools, Shares
und VM-Durchsatz sowie die neue Interfacekarte. Zehn Serveraktionen besitzen
eine feste Zielbestätigung; Paritätsstart prüft ausschließlich ohne Korrektur.
Der gemeinsame Dialog hat ein lokalisiertes Schließen-X und umbrechende
Footeraktionen. CPU-Details behalten Offen-Zustand und Fokus auch vor einem
verzögerten nativen Toggle.

276/276 Node-Tests und 6/6 Busch-Namensraumtests ohne Skips; Syntax und
statische UI-Prüfung grün. Shared UI und 46.470-Byte-Core sind bytegleich.
Unabhängige Reviews und gezielte RED/GREEN-Regressionen für Zustände, Ziel-
wechsel, asynchronen Anfragekontext, Dialogabbruch und Detailszustand.
Chromium mit vollständig erfundenen Daten bei 320/480/960 px hell/dunkel:
312 Bilder, 4.462 Textprüfungen, kein Überlauf/außerhalb/Überlappung,
keine Seitenfehler; 150/150 Popup-Prüfungen bestanden. Sechs Gegenproben
unterscheiden geschlossene von offenen Details und erkennen weiterhin
einen absichtlich erzeugten offenen Überlauf. 82 Bilder repräsentativ
gesichtet, einschließlich aller offenen CPU-Varianten und der langen
Dialogaktionen bei 320 px. Frühere fehlerhafte Prüfläufe wurden erst nach
gezielter Korrektur des Prüfers und der gefundenen Produktfehler ersetzt.

Browsernachweise verwenden HA-/Icon-/Formularattrappen; sie belegen keine
native HA-Editor- oder Hardwarebedienung. Serveraktionen werden nur gegen
Attrappen ausgeführt. Reale Installations- und Laufzeitbelege gehören nicht
in diese öffentliche Entwicklungsdokumentation.
