# Nicht-interaktiver Modus, Dry-Run, Export/Import, Deinstallation, Undo, Profile, Graceful Degradation, Tests — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pimpt um acht fehlende Fähigkeiten erweitern, damit es ein rundes, scriptbares und sicheres Windows-Terminal-Setup-Tool wird.

**Architecture:** Acht independientes Feature-Pakete, nacheinander umgesetzt. Jedes Paket hat eigenen Test und eigenen Commit. Bestehende Muster (`settings.ts` als zentrale Definitionen, `installer.ts` als Hauptfluss, `@clack/prompts` für UI, `jsonc-parser` für JSONC-Edits) werden wiederverwendet.

**Tech Stack:** TypeScript, Node 22+, ESM, vitest, @clack/prompts, jsonc-parser, picocolors, tsup.

**Spec:** docs/superpowers/specs/2026-11-16-pimpt-missing-features-design.md

## Global Constraints
- Bestehende Architektur beibehalten: `settings.ts`, `installer.ts`, `@clack/prompts`, `jsonc-parser`.
- Node 22+, ESM, TypeScript.
- Bestehende Tests dürfen nicht brechen (`npm test`, `npm run typecheck`, `npm run lint`).
- Backups vor Schreiben bleiben erhalten.
- pimpt bleibt ein Windows-Tool; Nicht-Windows wird nicht hart abgebrochen, sondern übersprungen mit Hinweis.

## Review Focus
1. **Ungültige Config-Datei bei `--apply`** → sinnvolle Fehlermeldung, kein Absturz.
2. **Dry-Run schreibt nichts** → `settings.json` unverändert, kein Backup.
3. **Export/Import auf nicht existenter Datei** → klare Fehlermeldung.
4. **Feature-Deinstallation wenn PowerShell-Profil nicht existiert** → Hinweis, kein Fehler.
5. **Einzelnes Undo eines nie gesetzten Settings** → kein-op, kein Fehler.
6. **Profilauswahl wenn kein Default-Profil existiert** → Hinweis, nicht hart abbrechen.
7. **Schriftart-/PowerShell-Code auf Nicht-Windows** → Warnung + überspringen, kein Throw.
8. **Config mit unbekannten Keys** → ignoriert mit Warnung, nicht hart abbrechen.

---
### Task 1: Nicht-interaktiver Modus (`--apply <config.json>`)

**Files:**
- Modify: `src/index.ts` — CLI-Argumente `--apply` parsen, `runInstaller` um nicht-interaktiven Pfad ergänzen.
- Modify: `src/installer.ts` — neue Export-Funktion `runNonInteractive(configPath)` oder Parameter auf `runInstaller`, die Config liest und `applySettings` aufruft ohne Prompts.
- Create: `test/noninteractive.test.ts` — Tests für das `--apply`-Verhalten.

**Interfaces:**
- Consumes: `readSettingsFile`, `setSetting`, `writeSettingsFile`, `createSettingsBackup` aus `wtsettings.ts`; `settings` aus `settings.ts`; `applySettings` aus `installer.ts`.
- Produces: `runInstaller` akzeptiert `--apply <pfad>`; liest JSON-Config mit `answers`-Map; schreibt settings.json; ruft PowerShell-Feature-Funktionen auf.

- [ ] **Step 1: Schreibe den fehlenden Test**

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('non-interactive apply', () => {
  it('applies a config without prompts', async () => {
    // arrange: mock readSettingsFile, setSetting, writeSettingsFile, createSettingsBackup
    // act: runInstaller mit --apply
    // assert: setSetting wurde mit den Config-Werten aufgerufen, writeSettingsFile einmal
  });
});
```

- [ ] **Step 2: Lasse den Test fehlschlagen**

Run: `npm test -- test/noninteractive.test.ts`
Expected: FAIL (Modul existiert noch / Funktion nicht definiert)

- [ ] **Step 3: Implementiere `--apply` in `src/index.ts` und `src/installer.ts`**

CLI: wenn `--apply` vorhanden, Pfad extrahieren und nicht-interaktiven Pfad aufrufen, keine `@clack`-Prompts.
`installer.ts`: neue exportierte Funktion, die JSON-Config liest, `answers` baut, `applySettings(answers, settingsPath)` aufruft, PowerShell-Features bedingt anwendet.

- [ ] **Step 4: Lasse den Test bestehen**

Run: `npm test -- test/noninteractive.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/index.ts src/installer.ts test/noninteractive.test.ts
git commit -m "feat: add non-interactive --apply mode"
```

---
### Task 2: Dry-Run (`--dry-run`)

**Files:**
- Modify: `src/index.ts` — `--dry-run`-Flag parsen.
- Modify: `src/installer.ts` — `applySettings` um Dry-Run-Option erweitern oder neue `previewSettings`-Funktion, die den Zielinhalt baut und ausgibt, ohne zu schreiben.
- Test: `test/dryrun.test.ts` (oder Erweiterung von `installer.test.ts`).

**Interfaces:**
- Consumes: `setSetting`, `readSettingsFile` aus `wtsettings.ts`; `settings` aus `settings.ts`.
- Produces: `--dry-run` zeigt geplanten Inhalt/diff, ruft `writeSettingsFile` nicht auf, erstellt kein Backup.

- [ ] **Step 1: Schreibe den fehlenden Test**

```ts
it('does not write settings.json in dry-run mode', async () => {
  // arrange
  // act: runInstaller mit --dry-run
  // assert: writeSettingsFile nicht aufgerufen, createSettingsBackup nicht aufgerufen
});
```

- [ ] **Step 2: Lasse den Test fehlschlagen**

Run: `npm test -- test/dryrun.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementiere Dry-Run**

`applySettings` erhält `dryRun: boolean`; wenn true, wird Inhalt nur in die Konsole ausgegeben (oder als Note), nicht geschrieben, kein Backup.

- [ ] **Step 4: Lasse den Test bestehen**

Run: `npm test -- test/dryrun.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/index.ts src/installer.ts test/dryrun.test.ts
git commit -m "feat: add dry-run mode"
```

---
### Task 3: Export/Import der pimpt-Konfiguration

**Files:**
- Modify: `src/index.ts` — neue Befehle `config export <pfad>` und `config import <pfad>`.
- Modify: `src/installer.ts` — `exportConfig(answers, path)` und `importConfig(path)` die die `answers`-Map als JSON speichern/lesen.
- Create: `test/config.test.ts`.

**Interfaces:**
- Consumes: `answers`-Map aus `installer.ts`, `readFileSync`/`writeFileSync` aus `node:fs`.
- Produces: `pimpt config export config.json` schreibt ausgewählte Einstellungen als JSON; `pimpt config import config.json` liest sie und startet den interaktiven Installer mit vorbefüllten Werten (oder wendet sie direkt an).

- [ ] **Step 1: Schreibe den fehlenden Test**

```ts
it('exports and imports the pimpt config', async () => {
  // arrange
  // act: export, dann import
  // assert: Datei enthält JSON, import liefert dieselbe Map zurück
});
```

- [ ] **Step 2: Lasse den Test fehlschlagen**

Run: `npm test -- test/config.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementiere Export/Import**

Neue CLI-Zweige in `index.ts`; Helper in `installer.ts` für JSON-Serialisierung der `answers`-Map.

- [ ] **Step 4: Lasse den Test bestehen**

Run: `npm test -- test/config.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/index.ts src/installer.ts test/config.test.ts
git commit -m "feat: add config export/import"
```

---
### Task 4: Deinstallation einzelner Features

**Files:**
- Modify: `src/installer.ts` — neue Area "Remove" im Hauptmenü; Optionen für jedes installierbare Feature (PowerShell-Blöcke, Terminal-Settings).
- Modify: `src/powershell/profile.ts` — neue Funktion `removePowerShellProfileBlock(feature)` die den markierten Block aus dem Profil entfernt.
- Test: `test/remove.test.ts`.

**Interfaces:**
- Consumes: `addPowerShellProfileBlock`-Muster, `beginMarker`/`endMarker`, `readPowerShellProfileFeatures`.
- Produces: Menü-Option "Remove"; entfernt PowerShell-Blöcke und einzelne `settings.json`-Keys; schreibt Backup vor Änderung.

- [ ] **Step 1: Schreibe den fehlenden Test**

```ts
it('removes a PowerShell profile block', async () => {
  // arrange: Profil mit pimpt-Block
  // act: removePowerShellProfileBlock('terminal icons')
  // assert: Block nicht mehr im Profil
});
```

- [ ] **Step 2: Lasse den Test fehlschlagen**

Run: `npm test -- test/remove.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementiere Deinstallation**

`removePowerShellProfileBlock(feature)` in `profile.ts`; Menü-Zweig in `installer.ts`; Backup vor Schreiben.

- [ ] **Step 4: Lasse den Test bestehen**

Run: `npm test -- test/remove.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/installer.ts src/powershell/profile.ts test/remove.test.ts
git commit -m "feat: add feature removal"
```

---
### Task 5: Undo einzelner Änderungen

**Files:**
- Modify: `src/settings.ts` — `SettingDefinition` um optionalen `resetValue` oder Wiederherstellung auf `keep`/Default ergänzen.
- Modify: `src/installer.ts` — im Einstellungs-Menü pro Setting eine "Reset"-Option, die den JSON-Pfad entfernt bzw. auf Default setzt.
- Test: `test/undo.test.ts`.

**Interfaces:**
- Consumes: `setSetting` mit `undefined` zum Entfernen, `settings`-Definitionen.
- Produces: Pro Setting eine Reset-Option; entfernt den entsprechenden Key aus `settings.json`.

- [ ] **Step 1: Schreibe den fehlenden Test**

```ts
it('resets a single setting to default', async () => {
  // arrange: setting ist gesetzt
  // act: reset aufgerufen
  // assert: Key entfernt aus settings.json
});
```

- [ ] **Step 2: Lasse den Test fehlschlagen**

Run: `npm test -- test/undo.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementiere Undo**

Reset-Logik in `installer.ts`; ggf. `resetValue` in `settings.ts`.

- [ ] **Step 4: Lasse den Test bestehen**

Run: `npm test -- test/undo.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/settings.ts src/installer.ts test/undo.test.ts
git commit -m "feat: add per-setting undo/reset"
```

---
### Task 6: Einzelne Profile konfigurieren

**Files:**
- Modify: `src/settings.ts` — `jsonPath` kann optional Profil-Index enthalten oder neue Eigenschaft `profileIndex`.
- Modify: `src/installer.ts` — vor dem Einstellungs-Menü Profil auswählen (Default oder konkretes Profil); `applySettings` schreibt in das gewählte Profil statt immer in `defaults`.
- Test: `test/profile.test.ts`.

**Interfaces:**
- Consumes: `getDefaultProfileIndex`, `profiles.list` aus `settings.json`.
- Produces: Profilauswahl-Menü; Setting wird in `profiles.list[i]` statt nur `profiles.defaults` geschrieben.

- [ ] **Step 1: Schreibe den fehlenden Test**

```ts
it('writes a setting to a selected profile instead of defaults', async () => {
  // arrange: zwei Profile im settings.json
  // act: Profil 1 auswählen, font setzen
  // assert: profiles.list[1].font.face gesetzt, defaults unberührt
});
```

- [ ] **Step 2: Lasse den Test fehlschlagen**

Run: `npm test -- test/profile.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementiere Profilauswahl**

Menü vor Settings; `applySettings` berücksichtigt gewählten Profil-Index.

- [ ] **Step 4: Lasse den Test bestehen**

Run: `npm test -- test/profile.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/settings.ts src/installer.ts test/profile.test.ts
git commit -m "feat: add per-profile configuration"
```

---
### Task 7: Graceful Degradation auf Nicht-Windows

**Files:**
- Modify: `src/fonts.ts` — `assertWindows()` ersetzt durch Warnung + `return`/überspringen statt Throw.
- Modify: `src/powershell/profile.ts` — `runPowerShell` und abhängige Funktionen warnen und überspringen statt zu werfen.
- Modify: `src/installer.ts` — Font- und PowerShell-Schritte auf Plattform prüfen.
- Test: `test/graceful.test.ts` (Mock von `process.platform`).

**Interfaces:**
- Consumes: `process.platform`, `isFontInstalled`, `installFont`, `installNerdFont`, PowerShell-Funktionen.
- Produces: Auf Nicht-Windows wird keine harten Fehler geworfen, sondern Hinweis geloggt und Schritt übersprungen.

- [ ] **Step 1: Schreibe den fehlenden Test**

```ts
it('skips font installation on non-Windows without throwing', async () => {
  // arrange: process.platform = 'linux'
  // act: installFont('Cascadia Mono')
  // assert: kein Throw, Warnung geloggt
});
```

- [ ] **Step 2: Lasse den Test fehlschlagen**

Run: `npm test -- test/graceful.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementiere graceful degradation**

`assertWindows` → `warnAndSkipWindowsOnly(feature)`; Font- und PowerShell-Funktionen rufen das statt zu werfen.

- [ ] **Step 4: Lasse den Test bestehen**

Run: `npm test -- test/graceful.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add src/fonts.ts src/powershell/profile.ts src/installer.ts test/graceful.test.ts
git commit -m "feat: graceful degradation on non-Windows"
```

---
### Task 8: Testlücken schließen (fonts + powershell Module)

**Files:**
- Create: `test/fonts.test.ts` — Tests für `isFontInstalled`, `canInstallFont`, `installFont` (mit gemocktem `fetch`, `execFileSync`, `reg.exe`).
- Create: `test/powershell.test.ts` (bereits vorhanden, erweitern) — Tests für `addTerminalIconsToPowerShellProfile`, `addHistoryPreviewToPowerShellProfile`, `readPowerShellProfileFeatures`, `addPowerShellProfileBlock`.
- Modify: `test/powershell.test.ts` — falls nötig.

**Interfaces:**
- Consumes: `fonts.ts` Exporte, `powershell/profile.ts` Exporte, `child_process` Mocks.
- Produces: Abdeckende Vitest-Tests für die bisher ungetesteten Module.

- [ ] **Step 1: Schreibe die fehlenden Tests**

Teste Font-Download, SHA-256-Prüfung, Registry-Eintrag, PowerShell-Block-Einfügung, Feature-Erkennung.

- [ ] **Step 2: Lasse die Tests fehlschlagen**

Run: `npm test -- test/fonts.test.ts test/powershell.test.ts`
Expected: FAIL (Module existieren, aber Tests noch nicht geschrieben / Funktionen nicht vollständig)

- [ ] **Step 3: Implementiere fehlende Test-Helfer / passe an**

Falls Funktionen für Testbarkeit angepasst werden müssen (z. B. `injectable` Child-Process), minimale Änderungen an `fonts.ts`/`profile.ts`.

- [ ] **Step 4: Lasse die Tests bestehen**

Run: `npm test -- test/fonts.test.ts test/powershell.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck, Lint, Commit**

Run: `npm run typecheck && npm run lint`
```bash
git add test/fonts.test.ts test/powershell.test.ts
git commit -m "test: cover fonts and powershell modules"
```

---
### Abschluss

- [ ] **Gesamter Testlauf**
Run: `npm test`
Expected: alle Tests PASS

- [ ] **Typecheck + Lint**
Run: `npm run typecheck && npm run lint`
Expected: keine Fehler

- [ ] **README aktualisieren** (neue CLI-Flags `--apply`, `--dry-run`, `config export/import`, Remove-Area, Undo, Profilauswahl)
- [ ] **Finaler Commit**
```bash
git add README.md
git commit -m "docs: document new CLI features"
```

---
**Plan komplett.** Die acht Tasks bauen aufeinander auf, aber jedes Feature liefert allein bereits einen nutzbaren, getesteten Zuwachs. Reihenfolge ist so gewählt, dass fundamentale Infrastruktur (nicht-interaktiver Modus, Dry-Run) zuerst kommt und feingranularere Features (Undo, Profile, Tests) danach.

Die Task-Grenzen sind so gewählt, dass ein Reviewer jedes Task unabhängig abnehmen kann.

I'm using the writing-plans skill to create the implementation plan.

**Plan complete and saved to `docs/superpowers/plans/2026-11-16-pimpt-missing-features-plan.md`.**

Please review the plan. Does it capture what you want, and which execution approach should we use?

- **Native** — Ich implementiere alle Tasks selbst in dieser Sitzung, eine finale Prüfung am Ende. Schnellster Weg, da du gesagt hast "einfach bauen".
- **Subagent-driven** — Ein frischer Subagent pro Task mit Review dazwischen, dann eine Gesamtprüfung. Gründlicher, aber mehr Kontext-Wechsel.

Für diesen Plan empfehle ich **Native**, weil die Tasks aufeinander aufbauen (das CLI-Gerüst in Task 1 wird von späteren Tasks wiederverwendet) und ein durchgehender Kontext die Schnittstellen konsistenter hält. Sollen wir mit **Native** starten, und soll ich direkt mit **Task 1 (nicht-interaktiver Modus)** loslegen?