# Design: fehlende Features für pimpt (v0.1.4 → gutes Tool)

## Intent / Warum
pimpt ist ein interaktiver Setup-Assistent für Windows Terminal. Es kann Einstellungen schreiben, PowerShell-Features hinzufügen und Backups anlegen. Was fehlt, um es zu einem "guten Tool" zu machen: keine Deinstallation/Rücknahme, kein nicht-interaktiver Modus, kein Dry-Run, kein Export/Import der pimpt-eigenen Konfiguration, kein gezieltes Undo einzelner Änderungen, nur Default-Profil, hartes Scheitern auf Nicht-Windows, dünne Testabdeckung für Fonts und PowerShell-Module.

## Goals
1. Nicht-interaktiver Modus: JSON-Config-Datei + `--apply` für Scripting/Rollout.
2. Dry-Run: geplante Änderungen anzeigen, bevor `settings.json` geschrieben wird.
3. Export/Import der pimpt-Konfiguration (eigene ausgewählten Einstellungen), unabhängig vom `settings.json`-Backup.
4. Deinstallation einzelner PowerShell-Features (Blöcke aus Profil entfernen) und einzelner Terminal-Settings.
5. Undo einzelner Änderungen: ein Setting auf "keep"/Standard zurücksetzen.
6. Konfiguration einzelner Profile (nicht nur `profiles.defaults`).
7. Graceful degradation: auf Nicht-Windows keine harten Fehler bei Fonts/PowerShell, sondern Hinweis + überspringen.
8. Testabdeckung für `src/fonts.ts` und `src/powershell/*`.

## Non-Goals
- GUI oder Webbasis.
- Vollständige macOS/Linux-Unterstützung (pimpt bleibt Windows-Tool; Nicht-Windows wird nur nicht hart abbricht).
- Automatische winget-Paketverwaltung für jede beliebige Software.

## Constraints
- Bestehende Architektur beibehalten: `@clack/prompts` für UI, `jsonc-parser` für JSONC-Edits, `settings.ts` als zentrale Setting-Definitionen, `installer.ts` als Hauptfluss.
- Node 22+, ESM, TypeScript.
- Bestehende Tests dürfen nicht brechen (`npm test`, `npm run typecheck`, `npm run lint`).
- Backups vor Schreiben bleiben erhalten.

## Approaches (betrachtet)
| Ansatz | Vorteil | Nachteil | Entscheidung |
|--------|---------|----------|--------------|
| Alles auf einmal in einem großen PR | Schnell fertig | Schwer reviewbar, hoher Bruchrisiko | Abgelehnt |
| Feature für Feature nacheinander, jeder mit eigenem Commit und Tests | Reviewbar, sicher, nutzbar nach jedem Schritt | Dauert länger | **Gewählt** |
| Separater CLI-Befehl pro Feature statt Modus-Flags | Explizit | Mehr Boilerplate, inkonsistent | Abgelehnt |

## Wie es gebaut wird (Reihenfolge)
1. Nicht-interaktiver Modus (`--apply <config.json>`): liest Config, wendet `applySettings` an, keine `@clack`-Prompts.
2. Dry-Run (`--dry-run` oder `--preview`): baut den Inhalt, loggt diff-artig, schreibt nicht.
3. Export/Import: `pimpt config export` / `pimpt config import` speichern die `answers`-Map als JSON.
4. Feature-Deinstallation: neue Area "Remove" im Menü, entfernt markierte PowerShell-Blöcke und Settings.
5. Einzelnes Undo: im Einstellungs-Menü "Reset" pro Setting, entfernt den JSON-Pfad bzw. setzt auf Default.
6. Profile-Auswahl: im Installer Profil auswählen, `jsonPath` kann Profil-Index enthalten.
7. Graceful degradation: `assertWindows()` ersetzt durch Warnung + Überspringen, nicht durch Throw.
8. Tests: Vitest-Dateien für Fonts und PowerShell-Module mit gemockten Child-Prozessen.

## Was dem Builder überlassen bleibt
- Genaine Namen der CLI-Flags und Config-Datei-Format (solange konsistent mit README).
- Ob "Remove" eine eigene Area oder eine Option in bestehenden Areas ist.
- Exakte Format der Export/Import-JSON.