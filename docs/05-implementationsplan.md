# 05 — Implementationsplan

Sieben Phasen, jede mit «Definition of Done». Reihenfolge einhalten; Phase 1–3 ergeben bereits ein
brauchbares MOTO-Werkzeug, Phase 4 bringt den Zahlungslink, 5–6 die Stammdaten, 7 den Release.

**Aktuelle Phase: 7 abgeschlossen (Release v1.0.0 am 19.09.2026)** — alle sieben Phasen sind in `main`. Offen: Abnahme T1–T13 mit Test-Space-Credentials, Test auf frischen Maschinen, offene Punkte für wallee (siehe unten).

Voraussetzungen für die Entwicklung: Node 20+, Go 1.22+, ein wallee **Test-Space** mit Application User,
Test-Connector und einem aktiven Charge Flow (Level «E-Mail»). Credentials nur lokal in `.env.local`
(gitignored) für Vitest-Integrationstests, nie im Repo.

---

## Phase 1 — Gerüst, Helper, Design-Basis

**Ziel:** Ein Binary, das den Browser öffnet und eine leere, aber fertig gestylte App im wallee-Look zeigt.

1. `web/`: Vite + React + TS (strict), ESLint/Prettier, Vitest. HashRouter, Layout mit Header (Nav-Tabs,
   Space-Chip-Platzhalter, Wortmarke), `Headline`, Statuszeile. `tokens.css`, `base.css` mit Roboto-woff2
   (`@font-face`, `font-display: swap`). Komponenten: Button, Input, Select, Segmented, Stepper, Table,
   StatusBadge, Toast, Modal, CopyField, Split, EmptyState, Spinner — mit einer versteckten Route
   `#/styleguide`, die alle Komponenten zeigt (bleibt im Build, nicht in der Navigation).
2. i18n: `de.json`, `en.json`, `useT()`, Sprachwahl in `wvt.ui.lang`, Standard aus `navigator.language` (de→de, sonst en).
3. `helper/`: `main.go` (Port 7811 → nächster freier, `http.Server` auf `127.0.0.1`, Browser öffnen via
   `open`/`rundll32 url.dll,FileProtocolHandler`/`xdg-open`, sauberes Shutdown auf Ctrl+C, Konsolenausgabe
   «wallee Virtual Terminal läuft auf http://127.0.0.1:7811 — dieses Fenster geöffnet lassen»),
   `static.go` (embed `dist/`, SPA-Fallback), `proxy.go` (`httputil.ReverseProxy` auf
   `https://app-wallee.com`, Pfad `/wallee/x` → `/api/v2.0/x`, Header-Whitelist, Origin-Check, 403 für alles andere).
   `Makefile` mit `build` (kopiert `../web/dist` → `helper/dist`), `release`, `clean`. `go test` für Proxy-Rewrite und Origin-Check.
4. `vite.config.ts`: Dev-Proxy `/wallee` → `https://app-wallee.com/api/v2.0` (mit `changeOrigin`, `Origin` entfernen).

**DoD:** `make build` erzeugt ein Binary; Doppelklick öffnet die App; `#/styleguide` zeigt alle Komponenten im
wallee-Look; Lighthouse Accessibility ≥ 95; keine externen Requests ausser `/wallee/*`.

## Phase 2 — Setup & wallee-Client

1. `api/jwt.ts` (WebCrypto HS256, base64url, `iat` Sekunden/Millisekunden-Fallback) mit Unit-Tests gegen
   einen bekannten Vektor (Token aus `jwt.io` mit Beispiel-Key nachrechnen).
2. `api/client.ts` (`request`, Fehlerklasse, Query-Builder, `expand`, `text/plain`-Antworten), `api/spaces.ts`,
   `api/chargeFlows.ts` (list).
3. `features/setup`: Formular gemäss `docs/03-ui-flows.md`, Verbindungstest, Speicherung (`storage.ts` mit
   local/sessionStorage-Umschaltung), Maskierung des Keys, Umgebungs-Wechsel mit Bestätigung, Guard-Route.
4. Space-Chip im Header (Name + PREVIEW-Badge).

**DoD:** Mit echten Test-Credentials zeigt der Verbindungstest Space-Name und Charge-Flow-Verfügbarkeit;
falsche Credentials liefern verständliche Fehler; Reload behält die Config; Unit-Tests für JWT und Storage grün.

## Phase 3 — MOTO-Flow (Kernstück)

1. `lib/money.ts` (Rappen-Integer, Formatierung `1'234.50`, Parsing von Eingaben mit `.`/`,`), Tests.
2. Wizard `features/moto` mit Stepper: Schritt 1 nur «Ohne Kundenprofil» (Kundensuche kommt in Phase 5,
   die Kunden-Komponente aber schon als Platzhalter-Slot vorsehen), Schritt 2 Positionen mit freien Zeilen
   (Produktsuche kommt in Phase 6), Schritt 3 Prüfen & starten. Entwurf in sessionStorage.
3. `api/transactions.ts`: create, get, paymentPageUrl, voidOnline, completeOnline, invoiceDocument,
   successfulChargeAttempt, paymentMethodConfigurations. Payload-Builder aus Wizard-State mit Tests
   (Zeilentotal, Rabatt-Zeile, Steuern, negative Beträge, `uniqueId`).
4. Screen `#/moto/:id`: Payment Page öffnen (**zuerst empirisch mit dem Test-Space prüfen, ob iframe
   möglich ist; ansonsten ausschliesslich Popup**), Polling mit Backoff, Ergebnisanzeige, Beleg-Download
   (base64 → Blob → `a[download]`), «Erneut versuchen», «Abbrechen», «Neuer Vorgang». Popup-Blocker-Fall:
   Hinweis + Button «Zahlungsseite öffnen» (Klick-initiiert ist erlaubt).
5. `wvt.recent` schreiben.

**DoD:** Eine Testzahlung mit Test-Karte läuft von Modus-Auswahl bis «Bezahlt» ohne Maus-Wechsel in andere
Programme durch; Fehlschlag (Decline-Testkarte) wird korrekt angezeigt; `COMPLETE_DEFERRED` zeigt «Jetzt
abbuchen» und funktioniert; Beleg lädt herunter.

## Phase 4 — Zahlungslink (Charge Flow)

1. Modus-Auswahl auf `#/` (zwei Karten), Modus im Stepper.
2. `api/chargeFlows.ts`: apply, paymentPageUrl, levelsForTransaction, sendMessage, updateRecipient, cancel.
3. Screen `#/link/:id` gemäss Spezifikation; E-Mail-Pflicht im Wizard, Empfänger ändern, erneut senden, Link
   kopieren/öffnen, sanftes Polling, Abbrechen.
4. Deaktivierung des Modus ohne aktiven Charge Flow inkl. Hilfetext.

**DoD:** Link-Vorgang erzeugt eine E-Mail an die Testadresse; Zahlung über den Link wird in der App als
«Bezahlt» sichtbar; «Erneut senden» und «Empfänger ändern» funktionieren; Abbrechen setzt den Status korrekt.

## Phase 5 — Kunden

1. `api/customers.ts`: search (Query-Builder), get, create, update (version), addresses (list/create/default).
2. Wizard Schritt 1: Suche mit Debounce, Auswahl, Inline-Neuanlage, Kundenkarte.
3. Screens `#/customers`, `#/customers/new`, `#/customers/:id` inkl. Adressen und «Vorgang starten».
4. Vorbelegung `customerId`, `customerEmailAddress`, `billingAddress` im Payload.

**DoD:** Kunde in der App angelegt erscheint im wallee-Backend mit Adresse; Suche findet ihn nach Name/E-Mail;
Vorgang mit Kunde zeigt im Backend die Kundenverknüpfung; 409-Fall (parallele Änderung) wird sauber behandelt.

## Phase 6 — Produkte & Letzte Vorgänge

1. `features/products`: Katalog-Store (localStorage, Migration/Versionierung des Schemas), Tabelle mit
   Inline-Edit, Duplizieren, Löschen mit Undo, Import/Export JSON, CSV-Import, Beispielprodukte.
2. Wizard Schritt 2: Produktsuche/Autocomplete, Enter fügt hinzu, Menge-Fokus.
3. `features/history`: Suche in wallee (metaData-Filter, Fallback merchantReference), Filter-Chips, Aktionen,
   «Mehr laden».
4. Tastaturkürzel (`Cmd/Ctrl+N`, `Cmd/Ctrl+K`), Autofokus in allen Schritten prüfen.

**DoD:** Vorgang mit drei Katalogprodukten in < 30 s erfasst; Katalog übersteht Reload und Export→Import;
Verlauf zeigt Vorgänge aus beiden Modi mit korrektem Status und funktionierenden Aktionen.

## Phase 7 — Politur, Release, Dokumentation

1. Fehlerzustände (Netzwerk, 401/403/409/422/429) auf allen Screens durchspielen; Toasts konsistent.
2. Accessibility: Fokusreihenfolge, Labels, Kontrast (Türkis-Regeln!), `prefers-reduced-motion`.
3. Responsive bis 900 px (Laptop-Halbfenster), keine horizontalen Scrollbalken.
4. `README.md` für Kunden fertigstellen (Download je Plattform, Gatekeeper/SmartScreen-Hinweis, Application
   User anlegen mit Screenshots-Platzhaltern, Charge Flow einrichten, FAQ). `CHANGELOG.md`.
5. `.github/workflows/release.yml`: Node-Build → Go-Cross-Compile → Checksums → Release-Assets; optionale
   Signing-Schritte hinter Secrets (`APPLE_*`, `WINDOWS_CERT_*`), `ci.yml` für Lint/Test/Build bei jedem Push.
6. Versionsanzeige (aus `git describe` beim Build via `-ldflags` und `VITE_APP_VERSION`), «Auf neue Version
   prüfen»-Link auf die GitHub-Releases-Seite (nur Link, kein Auto-Update).

**DoD:** Tag `v1.0.0` erzeugt ein Release mit drei Binaries; frische Maschine (Mac und Windows) → Download →
Start → Setup → Testzahlung ohne Konsultation der Doku durch eine nicht-technische Testperson.

## Phase 8 — Desktop-Paketierung (Release 1.3.0)

Spec: `docs/superpowers/specs/2026-09-21-desktop-packaging-design.md`.

1. macOS als App-Bundle im Zip: Universal-Binary (`makefat`), `Info.plist` mit `LSUIElement`, Icon; ein Download
   für alle Macs, Ausführ-Rechte bleiben im Zip erhalten. Windows-Exe mit Icon, Versionsinfo, Manifest
   (`go-winres`) und ohne Konsolenfenster (`-H windowsgui`).
2. Helper ohne Fenster: `POST /quit` hinter «Beenden» im Header (Bestätigungsdialog, End-Zustand), zweiter
   Doppelklick öffnet nur den Browser der laufenden Instanz, Startfehler als Dialog.
3. Self-Update auf dem Mac tauscht das ganze Bundle (Zip entpacken, `.app` → `.app.old`).
4. Release-Workflow: Bundle und Ressourcen auf dem Linux-Runner, macOS-Signatur mit Notarisierung und Stapling.
5. Doku: README (erster Start auf macOS 15+, SmartScreen, Beenden), Architektur («Signaturen»), Changelog.

**DoD:** Tag `v1.3.0` erzeugt `…-macos.zip`, `…-windows.exe`, `SHA256SUMS.txt`. Mac: Zip laden, App mit Icon,
Start ohne Terminal, «Beenden» funktioniert, Update-Pfad getestet. Windows: Icon und Versionsinfo im Explorer,
Start ohne Konsole. Mac-Nutzer von 1.2.0 laden einmalig manuell (Release-Notes).

---

## Testplan (manuell, mit Test-Space)

| # | Szenario | Erwartung |
|---|---|---|
| T1 | Setup mit falschem Key | Klarer 401-Hinweis, nichts gespeichert |
| T2 | Setup korrekt, PREVIEW | Space-Name, «Zahlungslink verfügbar», Badge «PREVIEW» im Header |
| T3 | MOTO, 1 Produkt, Test-Karte erfolgreich | «Bezahlt», Beleg-Download, Eintrag im Verlauf |
| T4 | MOTO, Decline-Karte | «Fehlgeschlagen» mit Grund, «Erneut versuchen» |
| T5 | MOTO, Popup vom Mitarbeiter geschlossen | App bleibt im Wartezustand, «Fenster erneut öffnen» funktioniert, «Abbrechen» beendet |
| T6 | MOTO mit Rabatt-Zeile und zwei MwSt-Sätzen | Beträge im Backend identisch mit App-Total |
| T7 | Zahlungslink an Testadresse | E-Mail kommt, Link zahlt, Status «Bezahlt» in der App |
| T8 | Zahlungslink, Empfänger ändern + erneut senden | Zweite E-Mail an neue Adresse |
| T9 | Kunde anlegen, suchen, Vorgang starten | Kundendaten vorbelegt, Verknüpfung im Backend |
| T10 | Produkte exportieren, localStorage löschen, importieren | Katalog identisch |
| T11 | Helper-Port belegt | Startet auf nächstem Port, Browser öffnet richtige URL |
| T12 | Fremde Website ruft `http://127.0.0.1:7811/wallee/...` auf | 403 |
| T13 | Umschalten auf LIVE | Bestätigungsdialog, Badge verschwindet, `FORCE_PRODUCTION_ENVIRONMENT` im Payload |

## Offene Punkte (Entscheid durch wallee, nicht durch Claude Code)

1. **Code-Signing** (Apple Developer ID + Notarisierung, Windows-Zertifikat) für die Kundenauslieferung —
   Voraussetzungen und Secrets in `docs/01-architektur.md` «Signaturen».
2. **Produktname** — Arbeitstitel «wallee Virtual Terminal»; Alternativen «wallee MOTO Desk», «wallee Payment Desk».
3. **CORS-Freigabe** für `/api/v2.0` (JWT-authentifizierte Requests) im wallee-Backend — würde den Helper
   überflüssig machen; das Frontend ist darauf vorbereitet (`VITE_API_BASE`).
4. **Zentraler Produktkatalog** (z.B. via wallee-Metadaten oder eine kleine Datei im Space) — heute lokal.
5. **FR/IT** — i18n-Struktur ist vorbereitet, Übersetzungen fehlen.
