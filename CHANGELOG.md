# Changelog

Alle wesentlichen Änderungen am wallee Virtual Terminal. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/).

## [Unreleased]

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
