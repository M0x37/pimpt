<div align="center">
  <img src="https://cdn.iconscout.com/icon/free/png-512/free-terminal-icon-svg-download-png-7523117.png" width="96" height="96" alt="Terminal-Icon">
  <h1>pimpt</h1>
  <p>Interaktiver Setup-Assistent für Windows Terminal und PowerShell.</p>
  <p>
    <a href="https://github.com/M0x37/pimpt/actions/workflows/ci.yml"><img src="https://github.com/M0x37/pimpt/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
    <a href="https://www.npmjs.com/package/@m0x373/pimpt"><img src="https://img.shields.io/npm/v/%40m0x373%2Fpimpt?logo=npm" alt="npm-Version"></a>
    <a href="https://www.npmjs.com/package/@m0x373/pimpt"><img src="https://img.shields.io/npm/dm/%40m0x373%2Fpimpt?logo=npm" alt="npm-Downloads"></a>
    <a href="https://www.npmjs.com/package/@m0x373/pimpt"><img src="https://img.shields.io/npm/l/%40m0x373%2Fpimpt" alt="Lizenz"></a>
    <a href="https://github.com/M0x37/pimpt"><img src="https://img.shields.io/github/stars/M0x37/pimpt?style=flat&logo=github" alt="GitHub-Sterne"></a>
  </p>
</div>

## Überblick

`pimpt` führt dich durch die Konfiguration von Windows Terminal. Einstellungen werden
gesammelt, als Zusammenfassung angezeigt und erst nach deiner Bestätigung geschrieben.
Zusätzlich können nützliche PowerShell-Funktionen aktiviert und Standardprogramme über
`winget` installiert werden.

## Funktionen

### Windows-Terminal-Einstellungen

- Transparenz und Acryl-Effekt
- Hintergrundfarbe: Midnight, Nord, Dracula, Solarized Dark oder eigener Hex-Wert
- Lokales Hintergrundbild
- Schriftart und Schriftgröße, inklusive automatischer Installation fehlender Fonts
- Cursorform
- Farbschema
- Startverzeichnis mit Unterstützung für `~`, Umgebungsvariablen und Laufwerkswechsel
- Startmodus: Fenster, maximiert, Vollbild, Fokus oder maximierter Fokus
- Anwendungsthema und Position der Tab-Leiste
- Tab-Breite
- Profil-Icon und eigener Tab-Titel
- Copy-on-select, Schließen-Bestätigung, Mausfokus und bereinigtes Einfügen

### PowerShell-Funktionen

Die Funktionen werden in markierten Blöcken zum Profil des aktuellen Benutzers hinzugefügt.
Dadurch bleiben sie nachvollziehbar und können später gezielt entfernt werden.

- Datei-Icons mit Terminal-Icons und Hack Nerd Font Mono
- History-Vorschau mit PSReadLine
- Lazy Git über den Befehl `lg`
- Intelligentes `cd` mit Ordnerverlauf, Laufwerkswechseln und interaktiver Auswahl
- Baumansicht für `ls`
- Praktische Aliase wie `ll`, `la`, `..`, `grep`, `wget` und `curl`
- Ausblenden des PowerShell-Startbanners

### Programm-Installer

Über `winget` können folgende Programme installiert werden:

- Git
- Python
- Node.js
- Visual Studio Code
- Docker Desktop

## Voraussetzungen

- Windows 10 oder neuer
- Windows Terminal: Stable, Preview oder Canary
- Node.js 22 oder neuer
- PowerShell für die PowerShell-Funktionen
- `winget` für die Programm-Installation

Für optionale Funktionen und fehlende Schriftarten kann eine Internetverbindung erforderlich
sein.

## Installation

```powershell
npm install --global @m0x373/pimpt
```

Danach startest du den Assistenten:

```powershell
pimpt
```

Das Paket ist unter dem Scope `@m0x373` veröffentlicht, weil der unscoped Name `pimpt`
auf npm nicht verfügbar ist.

## Verwendung

```text
pimpt              Interaktiven Assistenten starten
pimpt --help       Hilfe anzeigen
pimpt --version    Installierte Version anzeigen
```

Der Ablauf:

1. Bereich auswählen: `Appearance`, `Features`, `Installer` oder `Other`
2. Einstellungen auswählen; bereits aktive Optionen werden erkannt
3. Zusammenfassung der Änderungen prüfen
4. Änderungen bestätigen

Der Assistent liest vorhandene Windows-Terminal-Einstellungen ein und verwendet sie als
Ausgangswerte.

## Sicherheit und Wiederherstellung

- `settings.json` wird als JSONC verarbeitet; Kommentare und Formatierung bleiben nach
  Möglichkeit erhalten.
- Vor jeder Änderung wird ein Backup erstellt.
- Backups sind über `Other` und `Restore settings backup` erreichbar.
- Ohne Bestätigung werden keine Änderungen angewendet.
- PowerShell-Erweiterungen werden in markierten Profilblöcken gespeichert.

## Entwicklung

```powershell
npm install            Abhängigkeiten installieren
npm test               Test-Suite ausführen
npm run typecheck      TypeScript prüfen
npm run lint           Quellen und Tests linten
npm run format         Mit Prettier formatieren
npm run format:check   Formatierung prüfen
npm run build          ESM-Bundle nach dist/ bauen
```

Der Build wird vor der Veröffentlichung automatisch über `prepublishOnly` ausgeführt.

## Projektstruktur

```text
src/
  index.ts             CLI-Einstiegspunkt
  installer.ts         Interaktiver Setup-Assistent
  settings.ts          Einstellungsdefinitionen
  wtsettings.ts        Lesen, Schreiben und Backups von settings.json
  powershell.ts        PowerShell-Profilfunktionen
  fonts.ts             Font-Erkennung und Installation
  summary.ts           Zusammenfassung der Auswahl
test/                  Vitest-Tests
```

## Lizenz

Dieses Projekt steht unter der [ISC-Lizenz](https://opensource.org/license/isc-license-txt),
wie in den Paketmetadaten festgelegt.

Das Header-Icon stammt von [IconScout](https://iconscout.com) und ist als kostenloses
Asset von [Widyatmoko P.Y](https://iconscout.com/contributors/widyatmoko) veröffentlicht:
[Terminal-Icon](https://iconscout.com/free-icon/terminal-9243450).

## Links

- [Quellcode auf GitHub](https://github.com/M0x37/pimpt)
- [npm-Paket](https://www.npmjs.com/package/@m0x373/pimpt)
- [Issues und Fehlerberichte](https://github.com/M0x37/pimpt/issues)
