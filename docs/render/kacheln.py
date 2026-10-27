#!/usr/bin/env python3
"""Kacheln von ha-unraid-cards im Playwright-Container: Darstellung, Regel 1, Regel 2.

Aufruf (Repo nach /repo, Ordner mit regeln.py nach /work), sonst über
``bash scripts/karten-alle.sh --repo ha-unraid-cards --schritt kacheln``:

    docker run --rm --name test-hacs-t0-kacheln-render --network none \
      -v "$PWD:/repo:ro" -v "<hacs>/docs/render:/work:ro" \
      --entrypoint bash mcr.microsoft.com/playwright/python:v1.62.0-noble \
      -c 'pip install --quiet --break-system-packages playwright==1.62.0 >/dev/null; \
          python3 /repo/docs/render/kacheln.py /repo/dist/unraid-cards.js /tmp/kacheln-out'

Gerendert werden die neun Kacheln (Server, System, Prozessor, Grafikkarte,
Array, Parität, Luftstrom, Shares, VM-Auslastung) und die VM-Liste bei 320,
480 und 960 px, hell und dunkel. Die Daten sind die Attrappe aus
``tests/attrappe.js`` als JSON (``ATTRAPPE`` unten): ``voll`` =
``unraidAttrappe({parity:true, zweiteVm:true})``, ``leer`` =
``unraidAttrappe({gpu:false, fans:false})`` für die Leerzustände von
Grafikkarte, Luftstrom und Parität. ``stateObject`` ist weggelassen (nur der
Kern liest es, und der ist hier ersetzt).

Regel 1 misst :func:`regeln.messe_text` je Karte, Breite und Thema. Regel 2
misst :func:`regeln.messe_popup` am Bestätigungsdialog der VM-Liste
(„Herunterfahren“) mit ``dialog_typ="bestaetigung"``: Scrim-Klick muss den
Dialog offen lassen (DESIGN_GUIDELINES R04). Dazu E2E: Abbrechen ruft nichts
auf, Bestätigen genau ``switch.turn_off`` der VM. Eigene Urteile: kein
horizontales Scrollen, Touchziele ≥ 44 px, kein Ladezustand, Leerzustand in
``leer``, Kontrast Text/Hintergrund (< 2:1 Verstoß = offensichtlich falsch,
< 4,5:1 Hinweis: HA-Standardthema setzt ``--primary-color`` #03a9f4 als
Knopfschrift, das ergibt auf hellem Grund rund 2,1:1 und ist Themasache), keine
Seiten-/Konsolenfehler, keine fremden Netzanfragen.
"""
import json
import pathlib
import sys

sys.path.insert(0, "/work")
from playwright.sync_api import sync_playwright  # noqa: E402
from regeln import bewerte, lauf_breiten, messe_popup, messe_text, schreibe, selbsttest, zaehle  # noqa: E402

BUNDLE = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/kacheln-out")
OUT.mkdir(parents=True, exist_ok=True)
ORIGIN = "http://karten.test"
BREITEN = (320, 480, 960)
JETZT = "2026-10-23T12:00:00+02:00"

# (Name, Kartentyp, Variante, Zusatzkonfiguration)
FAELLE = [
    ("server", "busch-unraid-server-card", "voll", {}),
    ("system", "busch-unraid-system-card", "voll", {}),
    ("cpu", "busch-unraid-cpu-card", "voll", {}),
    ("gpu", "busch-unraid-gpu-card", "voll", {}),
    ("gpu", "busch-unraid-gpu-card", "leer", {}),
    ("array", "busch-unraid-array-card", "voll", {}),
    ("parity", "busch-unraid-parity-card", "voll", {}),
    ("parity", "busch-unraid-parity-card", "leer", {}),
    ("airflow", "busch-unraid-airflow-card", "voll", {}),
    ("airflow", "busch-unraid-airflow-card", "leer", {}),
    ("shares", "busch-unraid-shares-card", "voll", {}),
    ("vm-usage", "busch-unraid-vm-usage-card", "voll", {}),
    ("vm-liste", "busch-unraid-vm-card", "voll", {}),
    ("vm-liste-alle", "busch-unraid-vm-card", "voll", {"show_all": True}),
]

ATTRAPPE = json.loads(r"""
{
    "voll": {
      "devices": [
        {"id":"srv","name":"Tower","name_by_user":null,"model":"Unraid","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":null},
        {"id":"d1","name":"Tower Festplatte disk1","name_by_user":null,"model":"Data disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"p1","name":"Tower Festplatte cache","name_by_user":null,"model":"Cache disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"r1","name":"Tower Festplatte raid","name_by_user":null,"model":"Cache disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"r2","name":"Tower Festplatte raid2","name_by_user":null,"model":"Cache disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"f1","name":"Tower Festplatte flash","name_by_user":null,"model":"Boot disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"sh1","name":"Tower Share appdata","name_by_user":null,"model":"Unraid share","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"vm1","name":"Tower VM Windows 11","name_by_user":null,"model":"Virtual machine","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"par","name":"Tower Festplatte parity","name_by_user":null,"model":"Parity disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"vm2","name":"Tower VM Ubuntu","name_by_user":null,"model":"Virtual machine","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"}
      ],
      "entities": [
        {"entity_id":"sensor.tower_cpu","domain":"sensor","registry":{"entity_id":"sensor.tower_cpu","unique_id":"e1_cpu_percent","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"24.4","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_ram","domain":"sensor","registry":{"entity_id":"sensor.tower_ram","unique_id":"e1_ram_percent","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"67","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_load","domain":"sensor","registry":{"entity_id":"sensor.tower_load","unique_id":"e1_load_1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"3.2","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_uptime","domain":"sensor","registry":{"entity_id":"sensor.tower_uptime","unique_id":"e1_uptime","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"2026-10-16T14:41:00+00:00","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_array","domain":"sensor","registry":{"entity_id":"sensor.tower_array","unique_id":"e1_array_state","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"started","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_parity_progress","domain":"sensor","registry":{"entity_id":"sensor.tower_parity_progress","unique_id":"e1_parity_progress","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"12.5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_parity_errors","domain":"sensor","registry":{"entity_id":"sensor.tower_parity_errors","unique_id":"e1_parity_errors","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"0","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_cpu_temp","domain":"sensor","registry":{"entity_id":"sensor.tower_cpu_temp","unique_id":"e1_cpu_temp","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"89","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_board_temp","domain":"sensor","registry":{"entity_id":"sensor.tower_board_temp","unique_id":"e1_board_temp","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"41","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_nvme_composite","domain":"sensor","registry":{"entity_id":"sensor.tower_nvme_composite","unique_id":"e1_temp_nvme_pci_0100_temp1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"nvme-pci-0100","channel":"temp1","label":"Composite","friendly_name":"Tower Temperatur NVMe Composite"},"state":"38.5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_nvme_composite_2","domain":"sensor","registry":{"entity_id":"sensor.tower_nvme_composite_2","unique_id":"e1_temp_nvme_pci_0200_temp1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"nvme-pci-0200","channel":"temp1","label":"Composite","friendly_name":"Tower Temperatur NVMe Composite"},"state":"41.5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_k10temp_temp3","domain":"sensor","registry":{"entity_id":"sensor.tower_k10temp_temp3","unique_id":"e1_temp_k10temp_pci_00c3_temp3","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"k10temp-pci-00c3","channel":"temp3","label":"","friendly_name":"Tower Temperatur CPU temp3"},"state":"47","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"binary_sensor.tower_array_started","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.tower_array_started","unique_id":"e1_array_started","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"on","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"binary_sensor.tower_parity_running","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.tower_parity_running","unique_id":"e1_parity_running","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"on","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"binary_sensor.tower_mover","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.tower_mover","unique_id":"e1_mover_active","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"off","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.disk1_temp","domain":"sensor","registry":{"entity_id":"sensor.disk1_temp","unique_id":"e1_disk_temp_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"45","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"sensor.disk1_usage","domain":"sensor","registry":{"entity_id":"sensor.disk1_usage","unique_id":"e1_disk_usage_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"97","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"sensor.disk1_status","domain":"sensor","registry":{"entity_id":"sensor.disk1_status","unique_id":"e1_disk_status_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"binary_sensor.disk1_spundown","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.disk1_spundown","unique_id":"e1_disk_spundown_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"off","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"sensor.cache_temp","domain":"sensor","registry":{"entity_id":"sensor.cache_temp","unique_id":"e1_disk_temp_cache","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"51","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.cache_usage","domain":"sensor","registry":{"entity_id":"sensor.cache_usage","unique_id":"e1_disk_usage_cache","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"45","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.cache_status","domain":"sensor","registry":{"entity_id":"sensor.cache_status","unique_id":"e1_disk_status_cache","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid_temp","domain":"sensor","registry":{"entity_id":"sensor.raid_temp","unique_id":"e1_disk_temp_raid","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"44","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid_usage","domain":"sensor","registry":{"entity_id":"sensor.raid_usage","unique_id":"e1_disk_usage_raid","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"60","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid_status","domain":"sensor","registry":{"entity_id":"sensor.raid_status","unique_id":"e1_disk_status_raid","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid2_temp","domain":"sensor","registry":{"entity_id":"sensor.raid2_temp","unique_id":"e1_disk_temp_raid2","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"50","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid2_status","domain":"sensor","registry":{"entity_id":"sensor.raid2_status","unique_id":"e1_disk_status_raid2","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.flash_usage","domain":"sensor","registry":{"entity_id":"sensor.flash_usage","unique_id":"e1_disk_usage_flash","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"35","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","labels":[],"manufacturer":"Lime Technology","model":"Boot disk","entity_category":null},
        {"entity_id":"sensor.flash_status","domain":"sensor","registry":{"entity_id":"sensor.flash_status","unique_id":"e1_disk_status_flash","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","labels":[],"manufacturer":"Lime Technology","model":"Boot disk","entity_category":null},
        {"entity_id":"switch.win","domain":"switch","registry":{"entity_id":"switch.win","unique_id":"e1_vm_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"control","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"on","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"button.win_restart","domain":"button","registry":{"entity_id":"button.win_restart","unique_id":"e1_restart_vm_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"restart","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"unknown","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"button.win_force","domain":"button","registry":{"entity_id":"button.win_force","unique_id":"e1_force_stop_vm_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"force_stop","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"unknown","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.appdata_used","domain":"sensor","registry":{"entity_id":"sensor.appdata_used","unique_id":"e1_share_used_appdata","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"unit_of_measurement":"GB"},"state":"120.5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","labels":[],"manufacturer":"Lime Technology","model":"Unraid share","entity_category":null},
        {"entity_id":"sensor.appdata_free","domain":"sensor","registry":{"entity_id":"sensor.appdata_free","unique_id":"e1_share_free_appdata","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"unit_of_measurement":"GB"},"state":"450","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","labels":[],"manufacturer":"Lime Technology","model":"Unraid share","entity_category":null},
        {"entity_id":"sensor.win_state","domain":"sensor","registry":{"entity_id":"sensor.win_state","unique_id":"e1_vm_state_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"state","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"running","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.win_cpu","domain":"sensor","registry":{"entity_id":"sensor.win_cpu","unique_id":"e1_vm_cpu_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"cpu","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"36","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.win_ram_used","domain":"sensor","registry":{"entity_id":"sensor.win_ram_used","unique_id":"e1_vm_ram_used_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"ram_used","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"17179869184","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.win_ram_alloc","domain":"sensor","registry":{"entity_id":"sensor.win_ram_alloc","unique_id":"e1_vm_ram_allocated_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"ram_allocated","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"17179869184","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.tower_load_5","domain":"sensor","registry":{"entity_id":"sensor.tower_load_5","unique_id":"e1_load_5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":"user","hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.gpu_util","domain":"sensor","registry":{"entity_id":"sensor.gpu_util","unique_id":"e1_gpu_util_0","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"19","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.gpu_vram","domain":"sensor","registry":{"entity_id":"sensor.gpu_vram","unique_id":"e1_gpu_vram_0","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"9","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.gpu_temp","domain":"sensor","registry":{"entity_id":"sensor.gpu_temp","unique_id":"e1_gpu_temp_0","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"52","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.gpu_power","domain":"sensor","registry":{"entity_id":"sensor.gpu_power","unique_id":"e1_gpu_power_0","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"78","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.gpu_fan","domain":"sensor","registry":{"entity_id":"sensor.gpu_fan","unique_id":"e1_gpu_fan_0","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"31","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.fan4","domain":"sensor","registry":{"entity_id":"sensor.fan4","unique_id":"e1_fan_nct6798_isa_0290_fan4_rpm","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"nct6798-isa-0290","channel":"fan4","pwm":null,"pwm_mode":null,"friendly_name":"Tower Lüfter 4 Drehzahl"},"state":"922","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.fan6","domain":"sensor","registry":{"entity_id":"sensor.fan6","unique_id":"e1_fan_nct6798_isa_0290_fan6_rpm","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"nct6798-isa-0290","channel":"fan6","pwm":255,"pwm_mode":"auto","friendly_name":"Tower Lüfter FAN 6 Drehzahl"},"state":"4821","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.fan6p","domain":"sensor","registry":{"entity_id":"sensor.fan6p","unique_id":"e1_fan_nct6798_isa_0290_fan6_percent","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"nct6798-isa-0290","channel":"fan6","pwm":255,"pwm_mode":"auto","friendly_name":"Tower Lüfter FAN 6 PWM-Ansteuerung"},"state":"100","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.fan1","domain":"sensor","registry":{"entity_id":"sensor.fan1","unique_id":"e1_fan_nct6798_isa_0290_fan1_rpm","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":"user","hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"switch.ubuntu","domain":"switch","registry":{"entity_id":"switch.ubuntu","unique_id":"e1_vm_Ubuntu","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"control","config_entry_id":"e1","vm_key":"Ubuntu","vm_name":"Ubuntu","vm_state":"shut_off"},"state":"off","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"button.ubuntu_restart","domain":"button","registry":{"entity_id":"button.ubuntu_restart","unique_id":"e1_restart_vm_Ubuntu","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"restart","config_entry_id":"e1","vm_key":"Ubuntu","vm_name":"Ubuntu","vm_state":"shut_off"},"state":"unknown","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"button.ubuntu_force","domain":"button","registry":{"entity_id":"button.ubuntu_force","unique_id":"e1_force_stop_vm_Ubuntu","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"force_stop","config_entry_id":"e1","vm_key":"Ubuntu","vm_name":"Ubuntu","vm_state":"shut_off"},"state":"unavailable","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.ubuntu_state","domain":"sensor","registry":{"entity_id":"sensor.ubuntu_state","unique_id":"e1_vm_state_Ubuntu","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"state","config_entry_id":"e1","vm_key":"Ubuntu","vm_name":"Ubuntu","vm_state":"shut_off"},"state":"shut_off","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm2","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.parity_temp","domain":"sensor","registry":{"entity_id":"sensor.parity_temp","unique_id":"e1_disk_temp_parity","platform":"unraid_ssh","config_entry_id":"e1","device_id":"par","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"40","platform":"unraid_ssh","config_entry_id":"e1","device_id":"par","labels":[],"manufacturer":"Lime Technology","model":"Parity disk","entity_category":null},
        {"entity_id":"sensor.parity_status","domain":"sensor","registry":{"entity_id":"sensor.parity_status","unique_id":"e1_disk_status_parity","platform":"unraid_ssh","config_entry_id":"e1","device_id":"par","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"par","labels":[],"manufacturer":"Lime Technology","model":"Parity disk","entity_category":null}
      ]
    },
    "leer": {
      "devices": [
        {"id":"srv","name":"Tower","name_by_user":null,"model":"Unraid","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":null},
        {"id":"d1","name":"Tower Festplatte disk1","name_by_user":null,"model":"Data disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"p1","name":"Tower Festplatte cache","name_by_user":null,"model":"Cache disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"r1","name":"Tower Festplatte raid","name_by_user":null,"model":"Cache disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"r2","name":"Tower Festplatte raid2","name_by_user":null,"model":"Cache disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"f1","name":"Tower Festplatte flash","name_by_user":null,"model":"Boot disk","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"sh1","name":"Tower Share appdata","name_by_user":null,"model":"Unraid share","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"},
        {"id":"vm1","name":"Tower VM Windows 11","name_by_user":null,"model":"Virtual machine","manufacturer":"Lime Technology","config_entries":["e1"],"via_device_id":"srv"}
      ],
      "entities": [
        {"entity_id":"sensor.tower_cpu","domain":"sensor","registry":{"entity_id":"sensor.tower_cpu","unique_id":"e1_cpu_percent","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"24.4","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_ram","domain":"sensor","registry":{"entity_id":"sensor.tower_ram","unique_id":"e1_ram_percent","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"67","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_load","domain":"sensor","registry":{"entity_id":"sensor.tower_load","unique_id":"e1_load_1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"3.2","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_uptime","domain":"sensor","registry":{"entity_id":"sensor.tower_uptime","unique_id":"e1_uptime","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"2026-10-16T14:41:00+00:00","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_array","domain":"sensor","registry":{"entity_id":"sensor.tower_array","unique_id":"e1_array_state","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"started","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_parity_progress","domain":"sensor","registry":{"entity_id":"sensor.tower_parity_progress","unique_id":"e1_parity_progress","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"unknown","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_parity_errors","domain":"sensor","registry":{"entity_id":"sensor.tower_parity_errors","unique_id":"e1_parity_errors","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"0","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_cpu_temp","domain":"sensor","registry":{"entity_id":"sensor.tower_cpu_temp","unique_id":"e1_cpu_temp","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"89","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_board_temp","domain":"sensor","registry":{"entity_id":"sensor.tower_board_temp","unique_id":"e1_board_temp","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"41","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_nvme_composite","domain":"sensor","registry":{"entity_id":"sensor.tower_nvme_composite","unique_id":"e1_temp_nvme_pci_0100_temp1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"nvme-pci-0100","channel":"temp1","label":"Composite","friendly_name":"Tower Temperatur NVMe Composite"},"state":"38.5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_nvme_composite_2","domain":"sensor","registry":{"entity_id":"sensor.tower_nvme_composite_2","unique_id":"e1_temp_nvme_pci_0200_temp1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"nvme-pci-0200","channel":"temp1","label":"Composite","friendly_name":"Tower Temperatur NVMe Composite"},"state":"41.5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.tower_k10temp_temp3","domain":"sensor","registry":{"entity_id":"sensor.tower_k10temp_temp3","unique_id":"e1_temp_k10temp_pci_00c3_temp3","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"chip":"k10temp-pci-00c3","channel":"temp3","label":"","friendly_name":"Tower Temperatur CPU temp3"},"state":"47","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"binary_sensor.tower_array_started","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.tower_array_started","unique_id":"e1_array_started","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"on","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"binary_sensor.tower_parity_running","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.tower_parity_running","unique_id":"e1_parity_running","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"off","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"binary_sensor.tower_mover","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.tower_mover","unique_id":"e1_mover_active","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"off","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null},
        {"entity_id":"sensor.disk1_temp","domain":"sensor","registry":{"entity_id":"sensor.disk1_temp","unique_id":"e1_disk_temp_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"45","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"sensor.disk1_usage","domain":"sensor","registry":{"entity_id":"sensor.disk1_usage","unique_id":"e1_disk_usage_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"97","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"sensor.disk1_status","domain":"sensor","registry":{"entity_id":"sensor.disk1_status","unique_id":"e1_disk_status_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"binary_sensor.disk1_spundown","domain":"binary_sensor","registry":{"entity_id":"binary_sensor.disk1_spundown","unique_id":"e1_disk_spundown_disk1","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"off","platform":"unraid_ssh","config_entry_id":"e1","device_id":"d1","labels":[],"manufacturer":"Lime Technology","model":"Data disk","entity_category":null},
        {"entity_id":"sensor.cache_temp","domain":"sensor","registry":{"entity_id":"sensor.cache_temp","unique_id":"e1_disk_temp_cache","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"51","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.cache_usage","domain":"sensor","registry":{"entity_id":"sensor.cache_usage","unique_id":"e1_disk_usage_cache","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"45","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.cache_status","domain":"sensor","registry":{"entity_id":"sensor.cache_status","unique_id":"e1_disk_status_cache","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"p1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid_temp","domain":"sensor","registry":{"entity_id":"sensor.raid_temp","unique_id":"e1_disk_temp_raid","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"44","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid_usage","domain":"sensor","registry":{"entity_id":"sensor.raid_usage","unique_id":"e1_disk_usage_raid","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"60","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid_status","domain":"sensor","registry":{"entity_id":"sensor.raid_status","unique_id":"e1_disk_status_raid","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r1","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid2_temp","domain":"sensor","registry":{"entity_id":"sensor.raid2_temp","unique_id":"e1_disk_temp_raid2","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"50","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.raid2_status","domain":"sensor","registry":{"entity_id":"sensor.raid2_status","unique_id":"e1_disk_status_raid2","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"r2","labels":[],"manufacturer":"Lime Technology","model":"Cache disk","entity_category":null},
        {"entity_id":"sensor.flash_usage","domain":"sensor","registry":{"entity_id":"sensor.flash_usage","unique_id":"e1_disk_usage_flash","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"35","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","labels":[],"manufacturer":"Lime Technology","model":"Boot disk","entity_category":null},
        {"entity_id":"sensor.flash_status","domain":"sensor","registry":{"entity_id":"sensor.flash_status","unique_id":"e1_disk_status_flash","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"state":"ok","platform":"unraid_ssh","config_entry_id":"e1","device_id":"f1","labels":[],"manufacturer":"Lime Technology","model":"Boot disk","entity_category":null},
        {"entity_id":"switch.win","domain":"switch","registry":{"entity_id":"switch.win","unique_id":"e1_vm_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"control","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"on","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"button.win_restart","domain":"button","registry":{"entity_id":"button.win_restart","unique_id":"e1_restart_vm_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"restart","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"unknown","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"button.win_force","domain":"button","registry":{"entity_id":"button.win_force","unique_id":"e1_force_stop_vm_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"force_stop","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"unknown","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.appdata_used","domain":"sensor","registry":{"entity_id":"sensor.appdata_used","unique_id":"e1_share_used_appdata","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"unit_of_measurement":"GB"},"state":"120.5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","labels":[],"manufacturer":"Lime Technology","model":"Unraid share","entity_category":null},
        {"entity_id":"sensor.appdata_free","domain":"sensor","registry":{"entity_id":"sensor.appdata_free","unique_id":"e1_share_free_appdata","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"unit_of_measurement":"GB"},"state":"450","platform":"unraid_ssh","config_entry_id":"e1","device_id":"sh1","labels":[],"manufacturer":"Lime Technology","model":"Unraid share","entity_category":null},
        {"entity_id":"sensor.win_state","domain":"sensor","registry":{"entity_id":"sensor.win_state","unique_id":"e1_vm_state_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"state","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"running","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.win_cpu","domain":"sensor","registry":{"entity_id":"sensor.win_cpu","unique_id":"e1_vm_cpu_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"cpu","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"36","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.win_ram_used","domain":"sensor","registry":{"entity_id":"sensor.win_ram_used","unique_id":"e1_vm_ram_used_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"ram_used","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"17179869184","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.win_ram_alloc","domain":"sensor","registry":{"entity_id":"sensor.win_ram_alloc","unique_id":"e1_vm_ram_allocated_Windows 11","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","disabled_by":null,"hidden_by":null,"entity_category":null,"labels":[]},"attributes":{"kind":"vm","role":"ram_allocated","config_entry_id":"e1","vm_key":"Windows 11","vm_name":"Windows 11","vm_state":"running"},"state":"17179869184","platform":"unraid_ssh","config_entry_id":"e1","device_id":"vm1","labels":[],"manufacturer":"Lime Technology","model":"Virtual machine","entity_category":null},
        {"entity_id":"sensor.tower_load_5","domain":"sensor","registry":{"entity_id":"sensor.tower_load_5","unique_id":"e1_load_5","platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","disabled_by":"user","hidden_by":null,"entity_category":null,"labels":[]},"attributes":{},"platform":"unraid_ssh","config_entry_id":"e1","device_id":"srv","labels":[],"manufacturer":"Lime Technology","model":"Unraid","entity_category":null}
      ]
    }
}
""")

# Real capacity contracts from Unraid SSH: one FS source per pool, no FS on raid2.
for device, name, used, total in (
    ("d1", "disk1", 768, 1024), ("p1", "cache", 100, 200),
    ("r1", "raid", 512, 1024), ("f1", "flash", 1, 2),
):
    for role, value in (("used", used), ("total", total)):
        sample = next(e for e in ATTRAPPE["voll"]["entities"] if e["device_id"] == device)
        entity_id = f"sensor.capacity_{role}_{name}"
        ATTRAPPE["voll"]["entities"].append({
            **sample, "entity_id": entity_id, "state": str(value),
            "attributes": {"unit_of_measurement": "GiB"},
            "registry": {**sample["registry"], "entity_id": entity_id,
                         "unique_id": f"e1_disk_{role}_{name}"},
        })

SEITE = """<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:Roboto,Arial,sans-serif;background:var(--primary-background-color)}
#wrap{padding:8px}ha-card{display:block;border:1px solid var(--divider-color);border-radius:var(--ha-card-border-radius,12px);background:var(--ha-card-background,var(--card-background-color));color:var(--primary-text-color)}
ha-icon{display:inline-grid;place-items:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);font-size:calc(var(--mdc-icon-size,24px) * .8);line-height:1}</style>
</head><body><home-assistant></home-assistant><div id="wrap"></div>
<script>
customElements.define('ha-icon',class extends HTMLElement{static get observedAttributes(){return ['icon']}attributeChangedCallback(){const n=String(this.getAttribute('icon')||'').replace('mdi:','');this.textContent=n?n[0].toUpperCase():'?'}});
customElements.define('ha-card',class extends HTMLElement{});
customElements.define('home-assistant',class extends HTMLElement{});
document.querySelector('home-assistant').hass={locale:{language:'de'}};
</script>
<script src="/unraid-cards.js"></script>
<script>
window.ATTRAPPE=__ATTRAPPE__;
const baueKern=v=>{const roh=window.ATTRAPPE[v];const devices=new Map(roh.devices.map(d=>[d.id,d]));const list=roh.entities.map(e=>({...e}));const entities=new Map(list.map(e=>[e.entity_id,e]));
 return {devices,entities,lastErrors:new Map(),getEntity:id=>entities.get(id),getDevice:id=>devices.get(id),getDeviceEntities:id=>list.filter(e=>e.device_id===id),attach(){},retain(){return()=>{}},watch(){return()=>{}},watchDevice(){return()=>{}}};};
window.kern=baueKern('voll');window.ensureBuschCore=()=>window.kern;window.calls=[];window.ws=[];
const verlauf=()=>{const jetzt=Date.now()/1000,p=[];for(let i=0;i<=20;i++)p.push({s:String(20+Math.round(15*Math.sin(i/3))),lu:jetzt-600+i*30});return p;};
window.place=(tag,variante,config)=>{window.kern=baueKern(variante);const wrap=document.getElementById('wrap');wrap.replaceChildren();const c=document.createElement(tag);c.setConfig({type:'custom:'+tag,...config});
 c.hass={locale:{language:'de'},config:{time_zone:'Europe/Berlin'},states:{},callService:async(...a)=>{window.calls.push(a)},callWS:async m=>{window.ws.push(m.type);return Object.fromEntries((m.entity_ids||[]).map(id=>[id,verlauf()]))}};wrap.append(c);return true;};
window.addEventListener('hass-more-info',e=>window.calls.push(['more-info',e.detail.entityId]));
</script></body></html>"""

def seite_mit_attrappe(attrappe):
    """Shared offline harness; Stage 2 passes only generated example data."""
    return SEITE.replace("__ATTRAPPE__", json.dumps(attrappe, ensure_ascii=False))


JS_HSCROLL = "()=>document.scrollingElement.scrollWidth>window.innerWidth"

# Touchziele, Meldungen, Ladezustand und Kontrast an der gerenderten Karte.
JS_KARTE = r"""(sel)=>{const host=document.querySelector(sel);const r=host.shadowRoot;
 const alle=[];const gehe=w=>{for(const el of w.querySelectorAll('*')){alle.push(el);if(el.shadowRoot)gehe(el.shadowRoot);}};gehe(r);
 const sichtbar=el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&b.width>0&&b.height>0;};
 const ziele=alle.filter(el=>el.tagName==='BUTTON'&&sichtbar(el)).map(b=>{const x=b.getBoundingClientRect();return {label:b.getAttribute('aria-label')||b.textContent.trim(),w:Math.round(x.width),h:Math.round(x.height)}}).filter(x=>x.w<44||x.h<44);
 const meldungen=[...r.querySelectorAll('.message')].map(m=>m.textContent.trim());
 const rgba=s=>{const m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;const t=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return [t[0],t[1],t[2],t.length>3?t[3]:1];};
 const hoch=el=>el.parentElement||(el.parentNode&&el.parentNode.host)||null;
 const grund=el=>{const lagen=[];let n=el;while(n&&n.nodeType===1){const c=rgba(getComputedStyle(n).backgroundColor);if(c&&c[3]>0){lagen.push(c);if(c[3]>=1)break;}n=hoch(n);}
  let farbe=rgba(getComputedStyle(document.body).backgroundColor)||[255,255,255,1];for(let i=lagen.length-1;i>=0;i--){const c=lagen[i];farbe=[0,1,2].map(k=>c[k]*c[3]+farbe[k]*(1-c[3])).concat(1);}return farbe;};
 const lum=c=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);};
 const kontrast=[];for(const el of alle){if(![...el.childNodes].some(k=>k.nodeType===3&&k.textContent.trim()))continue;if(!sichtbar(el))continue;
  let n=el,aus=false;while(n){if(n.nodeType===1&&(n.getAttribute?.('aria-disabled')==='true'||n.disabled))aus=true;n=hoch(n);}if(aus)continue;
  const fg=rgba(getComputedStyle(el).color),bg=grund(el);if(!fg)continue;const f=[0,1,2].map(k=>fg[k]*fg[3]+bg[k]*(1-fg[3]));const a=lum(f),b=lum(bg);const q=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  kontrast.push({text:el.textContent.trim().slice(0,40),klasse:el.className&&typeof el.className==='string'?el.className:el.localName,q:Math.round(q*100)/100});}
 kontrast.sort((x,y)=>x.q-y.q);
 return {ziele,meldungen,laedt:meldungen.some(m=>/lädt|loading/i.test(m)),kontrast_min:kontrast[0]||null,kontrast_niedrig:kontrast.filter(k=>k.q<4.5),hoehe:Math.round(host.getBoundingClientRect().height)};}"""

DIALOG = "[role=alertdialog]"
ABBRECHEN = "[role=alertdialog] .buttons button:first-child"
OEFFNER = "busch-unraid-vm-card .vm-row button[data-focus-key='control']"


def thema(page, t):
    page.evaluate("t=>{document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}", t)


def main():
    report = {"selbsttest": {}, "breiten": None, "karten": [], "hscroll": [], "popup": {}, "dialog_text": {}, "e2e": {}, "netz": []}
    fehler = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 960, "height": 1200}, locale="de-DE")
        page.clock.set_fixed_time(JETZT)
        page.on("pageerror", lambda e: fehler.append("pageerror: " + str(e)))
        page.on("console", lambda m: m.type == "error" and fehler.append("console: " + m.text))
        seite = seite_mit_attrappe(ATTRAPPE)

        def route(r):
            url = r.request.url
            report["netz"].append(url.replace(ORIGIN, ""))
            if url.endswith("/unraid-cards.js"):
                return r.fulfill(body=BUNDLE.read_text(encoding="utf-8"), content_type="text/javascript")
            if url.rstrip("/") == ORIGIN:
                return r.fulfill(body=seite, content_type="text/html")
            return r.fulfill(status=404)
        page.route(ORIGIN + "/**", route)
        page.route(ORIGIN, route)
        page.goto(ORIGIN + "/")
        page.wait_for_function("()=>!!customElements.get('busch-unraid-vm-usage-card')&&!!customElements.get('busch-unraid-vm-card')")

        for name, tag, variante, cfg in (FAELLE[0], FAELLE[12]):
            page.evaluate("([t,v,c])=>place(t,v,c)", [tag, variante, cfg])
            page.wait_for_timeout(300)
            report["selbsttest"][name] = selbsttest(page, tag)

        def messung(pg):
            breite = pg.viewport_size["width"]
            t = pg.evaluate("document.documentElement.dataset.theme")
            ergebnis = {}
            for name, tag, variante, cfg in FAELLE:
                pg.evaluate("([t,v,c])=>place(t,v,c)", [tag, variante, cfg])
                pg.wait_for_timeout(350)
                if name == "array":
                    assert pg.locator(tag + " h3").all_text_contents() == [
                        "Array · 768 GiB von 1,0 TiB", "cache · 100 GiB von 200 GiB",
                        "raid · 512 GiB von 1,0 TiB", "Boot · 1,0 GiB von 2,0 GiB",
                    ], "Array capacity headings differ from the measured filesystems"
                fall = f"{name}-{variante}"
                datei = f"{fall}-{breite}-{t}.png"
                pg.locator(tag).screenshot(path=str(OUT / datei))
                info = pg.evaluate(JS_KARTE, tag)
                if pg.evaluate(JS_HSCROLL):
                    report["hscroll"].append(f"{fall} {breite} {t}")
                report["karten"].append({"fall": fall, "breite": breite, "thema": t, "bild": datei, **info})
                ergebnis[fall] = messe_text(pg, tag)
            return ergebnis

        report["breiten"] = lauf_breiten(page, breiten=BREITEN, messung=messung, hoehe=1200)

        # ── Bestätigungsdialog der VM-Liste ────────────────────────────────
        for breite in BREITEN:
            for t in ("light", "dark"):
                page.set_viewport_size({"width": breite, "height": 800})
                thema(page, t)
                page.evaluate("place('busch-unraid-vm-card','voll',{})")
                page.wait_for_timeout(300)
                page.locator(OEFFNER).first.click()
                page.wait_for_selector(DIALOG)
                page.wait_for_timeout(200)
                page.screenshot(path=str(OUT / f"dialog-{breite}-{t}.png"))
                report["dialog_text"][f"{breite}-{t}"] = {
                    "regel1": messe_text(page, DIALOG),
                    "inhalt": page.evaluate("()=>{const d=document.querySelector('busch-unraid-confirm').shadowRoot;const b=d.querySelector('.dialog').getBoundingClientRect();return {titel:d.querySelector('h2').textContent,text:d.querySelector('p').textContent,knoepfe:[...d.querySelectorAll('.buttons button')].map(x=>x.textContent),fokus:d.activeElement?.textContent||null,rect:{x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)},inhalt_breite:Math.round(d.querySelector('.dialog').clientWidth-parseFloat(getComputedStyle(d.querySelector('.dialog')).paddingLeft)-parseFloat(getComputedStyle(d.querySelector('.dialog')).paddingRight)),vh:innerHeight}}"),
                }
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
            thema(page, "light")
            page.evaluate("place('busch-unraid-vm-card','voll',{})")
            page.wait_for_timeout(300)
            report["popup"][str(breite)] = messe_popup(page, lambda: page.locator(OEFFNER).first.click(), DIALOG,
                                                       schliessen_knopf_selektor=ABBRECHEN, dialog_typ="bestaetigung")

        # ── E2E: Abbrechen ruft nichts auf, Bestätigen schaltet die VM aus ──
        page.set_viewport_size({"width": 960, "height": 800})
        page.evaluate("place('busch-unraid-vm-card','voll',{})")
        page.wait_for_timeout(300)
        page.evaluate("window.calls=[]")
        laenge = page.evaluate("history.length")
        page.locator(OEFFNER).first.click()
        page.wait_for_selector(DIALOG)
        page.locator(ABBRECHEN).click()
        page.wait_for_timeout(400)
        report["e2e"]["abbrechen"] = {"aufrufe": page.evaluate("JSON.parse(JSON.stringify(window.calls))"),
                                      "dialog_weg": page.evaluate("()=>!document.querySelector('busch-unraid-confirm')")}
        page.locator(OEFFNER).first.click()
        page.wait_for_selector(DIALOG)
        page.locator("[role=alertdialog] .buttons button:last-child").click()
        page.wait_for_timeout(400)
        report["e2e"]["bestaetigen"] = {"aufrufe": page.evaluate("JSON.parse(JSON.stringify(window.calls))"),
                                        "dialog_weg": page.evaluate("()=>!document.querySelector('busch-unraid-confirm')")}
        report["e2e"]["history_state_am_ende"] = page.evaluate("history.state")
        report["e2e"]["history_laenge"] = {"vorher": laenge, "nachher": page.evaluate("history.length")}
        report["e2e"]["verlauf_abfragen"] = page.evaluate("window.ws.length")
        browser.close()

    # ── Urteile, die regeln.py nicht kennt ──────────────────────────────────
    eigene = []
    hinweise = []
    eigene += [f"horizontaler scroll {h}" for h in report["hscroll"]]
    for k in report["karten"]:
        tag = f"{k['fall']} {k['breite']} {k['thema']}"
        if k["ziele"]:
            eigene.append(f"touchziel {tag}: {k['ziele']}")
        if k["laedt"]:
            eigene.append(f"ladezustand {tag}: {k['meldungen']}")
        if k["fall"].endswith("-leer") and not k["meldungen"]:
            eigene.append(f"kein leerzustand {tag}")
        niedrig = [x for x in k["kontrast_niedrig"] if x["q"] < 2]
        if niedrig:
            eigene.append(f"kontrast < 2:1 {tag}: {niedrig}")
        elif k["kontrast_niedrig"]:
            hinweise.append(f"kontrast < 4.5:1 {tag}: {k['kontrast_niedrig']}")
    for key, d in report["dialog_text"].items():
        i = d["inhalt"]
        if i["knoepfe"] != ["Abbrechen", "Herunterfahren"] or i["fokus"] != "Abbrechen" or "Windows 11" not in i["text"]:
            eigene.append(f"dialog {key}: {i}")
        breite = int(key.split("-")[0])
        if breite < 450 and i["rect"]["h"] < 0.9 * i["vh"]:
            eigene.append(f"dialog {key} am handy kein bottom-sheet >= 90 %: {i['rect']}")
        # „Bestätigungsdialoge 320 px“ (ui-regeln.md, Anatomie): Inhaltsbreite, wie die Karte sie setzt
        # (width:min(320px,…) plus Innenabstand); die Außenbreite steht zur Information im Bericht.
        if breite >= 450 and i["inhalt_breite"] > 320:
            eigene.append(f"bestaetigungsdialog {key} breiter als 320 px: {i}")
    for breite, pop in report["popup"].items():
        if int(breite) >= 450 and pop.get("scrim", {}).get("ergebnis") != "bestanden":
            eigene.append(f"scrim ohne urteil bei {breite}: {pop.get('scrim')}")
    e = report["e2e"]
    if e["abbrechen"]["aufrufe"] or not e["abbrechen"]["dialog_weg"]:
        eigene.append(f"abbrechen {e['abbrechen']}")
    if e["bestaetigen"]["aufrufe"] != [["switch", "turn_off", {"entity_id": "switch.win"}]] or not e["bestaetigen"]["dialog_weg"]:
        eigene.append(f"bestaetigen {e['bestaetigen']}")
    if e["history_state_am_ende"] and "buschUnraidConfirm" in json.dumps(e["history_state_am_ende"]):
        eigene.append("verwaister Verlaufseintrag")
    if not e["verlauf_abfragen"]:
        eigene.append("CPU-Verlauf nie abgefragt")
    fremd = [u for u in report["netz"] if u not in ("/", "/unraid-cards.js")]
    if fremd:
        eigene.append(f"fremde anfragen {fremd}")
    report["eigene_verstoesse"] = eigene
    report["hinweise"] = hinweise
    report["seitenfehler"] = fehler
    schreibe(OUT / "report.json", report, zeige=0)
    code = max(bewerte(report), 1 if eigene or fehler else 0)
    print(json.dumps({"zaehlung": zaehle(report), "eigene": eigene, "hinweise": len(hinweise), "fehler": fehler,
                      "bilder": len(list(OUT.glob("*.png"))), "exit": code}, ensure_ascii=False, indent=1))
    sys.exit(code)


if __name__ == "__main__":
    main()
