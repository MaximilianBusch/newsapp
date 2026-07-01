# NewsApp

Moderner Apple-News-Nachfolger mit KI-Briefing als iPhone-Widget (Scriptable), geteilt über iCloud.
Ausführliche Doku im Obsidian-Vault unter **NewsApp/** (Vision, Architektur, Projektplan, Entscheidungen).

## Architektur (Kurz)
```
RSS-Feeds  →  build_briefing.mjs (Node)  →  briefing/briefing.json  →  Scriptable-Widget (iPhone)
```
- **Backend (Node):** kuratierte RSS-Feeds laden, deduplizieren, für Quellen-Vielfalt sorgen
  (Anti-Filterblase), kompaktes JSON schreiben. KI-Zusammenfassung folgt in CP2 (Claude Haiku 4.5).
- **Frontend:** `widget/NewsApp.js` in der App **Scriptable** rendert das Home-Screen-Widget.

## Setup
```bash
npm install
npm run build      # erzeugt briefing/briefing.json
```

## Widget testen (Scriptable)
1. App **Scriptable** (gratis) auf dem iPhone installieren.
2. Inhalt von `widget/NewsApp.js` als neues Skript "NewsApp" anlegen.
3. Zum schnellen Test die Profil-Datei in den **Scriptable-iCloud-Ordner** kopieren
   (`iCloud Drive/Scriptable/`): `briefing-max.json` und/oder `briefing-frau.json`.
4. Home-Screen → Widget **Scriptable** → Skript "NewsApp" wählen → **Parameter** auf `max` oder `frau`
   setzen (leer = `max`). Tipp: größere Widget-Größe = mehr Schlagzeilen.

Sobald das Briefing gehostet ist (→ ADR-0002), stattdessen `BRIEFING_URL` im Widget setzen
(`{profil}` im URL-Muster wird durch den Parameter ersetzt).

## Profile (feineinstellen)
`profiles.json` steuert je Profil, **wie viele** Artikel pro Kategorie und **in welcher Reihenfolge**.
Basis = Politik/Gesellschaft; Technik/KI bewusst „auch" dabei, nicht dominant. Werte frei anpassbar
(0 = Kategorie ausblenden).

## Dateien
| Datei | Zweck |
|---|---|
| `feeds.json` | kuratierte Feed-Liste je Kategorie |
| `profiles.json` | Profil-Gewichte Max/Frau (ab CP3 aktiv) |
| `build_briefing.mjs` | Briefing-Builder (RSS → JSON) |
| `briefing/briefing.json` | erzeugte Ausgabe (nicht im Git) |
| `widget/NewsApp.js` | Scriptable-Widget |

## Hosting (alle 30 Min, GitHub Actions + Pages)
`.github/workflows/briefing.yml` baut die Briefings per Cron `*/30` und veröffentlicht sie via
GitHub Pages. Ergebnis-URLs:
`https://<user>.github.io/<repo>/briefing-max.json` bzw. `…/briefing-frau.json`.
Im Widget dann `BRIEFING_URL` entsprechend setzen (`{profil}` wird ersetzt).

**Einmalige Einrichtung:** Repo (öffentlich) pushen → Repo-Settings → **Pages** → *Source* = **GitHub
Actions**. Danach läuft der Workflow automatisch; manuell auslösbar unter *Actions → Run workflow*.

## Status
CP1 fertig; Hosting (ADR-0002) via GitHub Actions/Pages eingerichtet. Nächster Schritt: CP2 (KI, Haiku 4.5).
Details: Obsidian `NewsApp/Projektplan`.
