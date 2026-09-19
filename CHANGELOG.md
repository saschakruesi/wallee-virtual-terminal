# Changelog

Alle wesentlichen Änderungen am wallee Virtual Terminal. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Added
- Mehrere Spaces: In der Einrichtung lassen sich mehrere Spaces mit eigenen Zugangsdaten und Vorgaben
  erfassen; oben rechts wechselt ein Dropdown zwischen ihnen, daneben führt ein Einstellungs-Symbol direkt
  in die Einrichtung.
- Produktauswahl: Klick ins Produktfeld zeigt sofort die Katalogprodukte, mit Link zur Produktverwaltung.

### Fixed
- Wortmarke im Einrichtungs-Panel war horizontal verzerrt.
- Ein begonnener Vorgang übernimmt geänderte Währung und Referenz-Präfix aus den Einstellungen, solange
  sie im Vorgang nicht selbst geändert wurden.

## [1.1.0] — 2026-09-19

### Added
- Update-Mechanismus: Prüfung auf neue GitHub-Releases beim Start, Statusleiste oben mit «Update starten»;
  der Helper lädt, verifiziert (SHA-256), ersetzt sich selbst und startet neu, die Seite lädt automatisch neu.

## [1.0.0] — 2026-09-19

Erste Version. Abnahme mit einem wallee Test-Space (Testplan T1–T13 in `docs/05-implementationsplan.md`) steht noch aus.

### Added
- Einrichtung mit Verbindungstest (Space-Name, Charge-Flow-Verfügbarkeit), Umgebung Test/Live, Vorgaben
  für Währung, Sprache, Referenz-Präfix und Abschlussverhalten; Zugangsdaten wahlweise nur für die Sitzung.
- MOTO-Vorgang: dreistufiger Wizard (Kunde, Positionen, Prüfen), Zahlungsseite als Popup, Live-Status mit
  Timeline, Beleg-Download, «Jetzt abbuchen» bei autorisierten Zahlungen, Abbrechen, erneuter Versuch.
- Zahlungslink per E-Mail über Charge Flows: Statusseite mit Link zum Kopieren, erneut senden, Empfänger
  ändern, abbrechen.
- Kunden: Suche in wallee, Anlegen mit Adresse, Bearbeiten mit Konfliktbehandlung, Adressverwaltung,
  «Vorgang starten».
- Produkte: lokaler Katalog mit Inline-Bearbeitung, Duplizieren, Löschen mit Rückgängig, JSON/CSV-Import
  und -Export, Beispielprodukte; Produktsuche im Vorgang.
- Vorgänge: Liste aus wallee mit Filtern, Suche, Aktionen und Zähler offener Zahlungslinks.
- Tastaturkürzel ⌘/Ctrl+N und ⌘/Ctrl+K, Sprache Deutsch/Englisch, Hinweisleiste bei Verbindungsverlust,
  Versionsanzeige mit Link auf die Releases-Seite.
- Go-Helper als Einzeldatei (macOS Apple Silicon/Intel, Windows) mit eingebettetem Frontend und
  Reverse-Proxy auf app-wallee.com; Release-Workflow mit Prüfsummen und optionalem Code-Signing.

[Unreleased]: https://github.com/saschakruesi/wallee-virtual-terminal/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/saschakruesi/wallee-virtual-terminal/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/saschakruesi/wallee-virtual-terminal/releases/tag/v1.0.0
