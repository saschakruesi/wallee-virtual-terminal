# 01 — Architektur & Technologie

## Ausgangslage und Entscheid

Der wallee Virtual Terminal soll vom Kunden **heruntergeladen und ohne Installation gestartet** werden können,
auf macOS und Windows. Ein Node.js-Server beim Kunden scheidet aus (Installation, Updates, Support).

Geprüft wurde, ob eine reine HTML-Datei direkt mit der wallee-API sprechen kann. Ergebnis (Stand 18.09.2026):
`https://app-wallee.com/api/v2.0/...` beantwortet Cross-Origin-Requests aus dem Browser mit
`403 Invalid CORS request` — für `file://` (`Origin: null`), `http://localhost:*` und fremde HTTPS-Origins.
Nur `https://app-wallee.com` selbst ist als Origin erlaubt. **Ein Browser kann die API also nicht direkt
aufrufen**; ein lokaler Helfer ist nötig.

**Entscheid: Go-Helper als Einzeldatei.**

- Ein statisch gelinktes Go-Binary (~8–10 MB) pro Plattform, das das gebaute Frontend per `embed` enthält.
- Doppelklick → Helper startet auf `127.0.0.1:7811` (bei Belegung nächster freier Port), öffnet den
  Standard-Browser, zeigt die App.
- Der Helper ist ein **transparenter Reverse-Proxy** für `/wallee/*` → `https://app-wallee.com/api/v2.0/*`.
  Er setzt den `Host`-Header, entfernt `Origin`/`Referer`, leitet `Authorization`, `space`, `Content-Type`,
  `Accept` und den Body unverändert weiter und gibt Status, Header und Body unverändert zurück.
- Er akzeptiert Verbindungen **nur von 127.0.0.1** und nur für Requests, deren `Origin` (falls gesetzt) sein
  eigener Origin ist. Das verhindert, dass eine fremde Website im Browser des Kunden den Helper als Proxy nutzt.
- Keine Konfiguration, keine Logs mit Inhalten (nur Methode, Pfad, Status, Dauer auf stdout).

Warum nicht Tauri/Electron: schwerere Toolchain, Signing-Aufwand identisch, kein funktionaler Mehrwert für zwei
Use Cases. Warum nicht «CORS bei wallee öffnen»: wäre die eleganteste Lösung (dann reicht GitHub Pages), ist aber
eine Backend-Änderung mit Security-Review. Die Architektur ist so gebaut, dass das Frontend **ohne Änderung**
auch in diesem Szenario läuft (siehe «API-Basis» unten).

## Komponenten

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Browser des Kunden           │        │ Go-Helper (localhost:7811)   │
│                              │  GET / │                              │
│  React-App (web/dist)  ◄─────┼────────┼── embed.FS (web/dist)        │
│   • Setup / Credentials      │        │                              │
│   • JWT-Signierung (WebCrypto)│ /wallee/*                            │      https://app-wallee.com
│   • MOTO-Flow                ├────────┼──► Reverse Proxy ────────────┼────► /api/v2.0/*
│   • Zahlungslink-Flow        │        │   (Header-Passthrough)       │
│   • Kunden / Produkte        │        └──────────────────────────────┘
│   • localStorage (Config,    │
│     Produktkatalog, Verlauf) │        Payment Page (MOTO) öffnet als
└──────────────────────────────┘        Popup direkt auf app-wallee.com
```

**Der Browser signiert.** Für jeden API-Call erzeugt das Frontend ein JWT (HS256) mit dem Authentication Key
des Application Users (siehe `docs/02-wallee-api.md`). Der Helper sieht die Credentials zwar im
`Authorization`-Header durchlaufen, verarbeitet oder speichert sie aber nicht.

**API-Basis ist konfigurierbar.** `apiBase` ist standardmässig `/wallee` (Proxy). Ein Build-Flag
`VITE_API_BASE=https://app-wallee.com/api/v2.0` erlaubt den Direktbetrieb ohne Helper, sollte wallee CORS
freigeben. Sonst ändert sich nichts.

## Repository-Struktur

```
wallee-virtual-terminal/
├── CLAUDE.md                     # Anweisungen für Claude Code
├── README.md                     # Für Kunden & GitHub: Was ist das, Download, Einrichtung
├── docs/                         # Diese Spezifikation
├── assets/brand/                 # wallee-Wortmarke (SVG/PNG, türkis/weiss/schwarz)
├── web/                          # Frontend
│   ├── index.html
│   ├── vite.config.ts            # dev-Proxy /wallee → app-wallee.com (nur für npm run dev)
│   ├── package.json
│   ├── public/fonts/             # Roboto Light/Regular/Medium als woff2
│   └── src/
│       ├── main.tsx
│       ├── app/                  # Router, Layout (Header mit Wortmarke, Navigation), i18n-Provider
│       ├── api/                  # wallee-Client: jwt.ts, client.ts, transactions.ts, chargeFlows.ts, customers.ts
│       ├── features/
│       │   ├── setup/            # Credentials, Verbindungstest, Space-Info, Umgebungswahl
│       │   ├── moto/             # MOTO-Wizard + Payment-Page-Popup + Polling + Ergebnis
│       │   ├── paymentlink/      # Charge-Flow-Wizard + Status + Link erneut senden
│       │   ├── customers/        # Suche, Anlegen, Bearbeiten (wallee Customer API)
│       │   ├── products/         # Lokaler Katalog (localStorage) + Import/Export
│       │   └── history/          # Letzte Vorgänge (Suche in wallee, Filter metaData.source)
│       ├── components/           # Button, Input, Select, Money, Table, Modal, Toast, Stepper, StatusBadge …
│       ├── i18n/                 # de.json, en.json, useT()
│       ├── lib/                  # money.ts (Rappen-Arithmetik), storage.ts, validation.ts, ids.ts
│       └── styles/               # tokens.css, base.css, components.css
├── helper/                       # Go
│   ├── main.go                   # Port finden, Server starten, Browser öffnen
│   ├── proxy.go                  # Reverse Proxy /wallee/* → app-wallee.com/api/v2.0/*
│   ├── static.go                 # embed web/dist, SPA-Fallback auf index.html
│   ├── go.mod
│   └── Makefile                  # build, release (cross-compile), clean
└── .github/workflows/release.yml # Tag v* → build web, build binaries, GitHub Release mit Assets
```

## Technologie-Stack

| Schicht | Wahl | Begründung |
|---|---|---|
| Frontend | Vite 5, React 18, TypeScript strict | Schnell, verbreitet, Claude Code kennt es gut; ergibt statisches `dist/` |
| Styling | Eigenes CSS mit Custom Properties, keine Library | Volle Kontrolle über wallee-Look; wenig Abhängigkeiten |
| Routing | `react-router-dom` (HashRouter) | HashRouter, damit Deep-Links ohne Server-Rewrites funktionieren |
| i18n | Kleine eigene Lösung (`t('key')`, JSON pro Sprache) | Kein i18next nötig |
| Krypto | WebCrypto (`crypto.subtle`, HMAC SHA-256) | Nativ im Browser, kein Package |
| Tests | Vitest + Testing Library (Frontend), `go test` (Helper) | |
| Helper | Go 1.22+, nur Standardbibliothek (`net/http`, `httputil`, `embed`) | Ein Binary, kein Runtime, Cross-Compile via `GOOS/GOARCH` |
| CI/CD | GitHub Actions | Release-Workflow baut alle Plattformen und hängt die Binaries an das Release |

## Datenhaltung im Browser (localStorage, Präfix `wvt.`)

| Key | Inhalt |
|---|---|
| `wvt.config` | `{ userId, authKey, spaceId, environment: 'PREVIEW'\|'LIVE', language, currency, merchantReferencePrefix, rememberCredentials }` |
| `wvt.products` | Produktkatalog `Product[]` (siehe `docs/03-ui-flows.md`) |
| `wvt.recent` | Letzte 50 lokal gestarteten Vorgänge `{ transactionId, mode, createdAt, amount, currency, customerLabel }` — nur als Cache; Wahrheit ist die wallee-Suche |
| `wvt.ui` | Sprache, zuletzt gewählter Modus, Spaltenbreiten o.ä. |

Bei `rememberCredentials = false` liegt `wvt.config` in `sessionStorage` (weg beim Schliessen des Tabs).

## Build & Release

1. `cd web && npm ci && npm run build` → `web/dist`
2. `cd helper && go build` — `static.go` bettet `../web/dist` ein (`//go:embed` über einen Symlink oder
   Kopierschritt im Makefile, da `embed` keine Pfade ausserhalb des Moduls kann → Makefile kopiert
   `web/dist` nach `helper/dist` vor dem Build).
3. `make release` (seit 1.3.0) erzeugt in `dist/`:
   - `wallee-virtual-terminal-macos.zip` — «wallee Virtual Terminal.app» mit Universal-Binary (arm64 + amd64,
     zusammengesetzt mit `github.com/randall77/makefat`, reines Go, kein `lipo`), `Info.plist` aus
     `helper/bundle/Info.plist` (`LSUIElement`: kein Dock-Symbol, kein Terminal), Icon `assets/icon/wallee.icns`.
     Zusammengebaut von `scripts/make-bundle.sh`; das Zip erhält die Unix-Rechte, darum kein `chmod` beim Kunden.
   - `wallee-virtual-terminal-windows.exe` — mit `-H windowsgui` (kein Konsolenfenster) und Ressourcen aus
     `helper/winres/winres.json` (Icon, Versionsinfo, Manifest), die `go-winres` vor dem Build als
     `rsrc_windows_amd64.syso` erzeugt (gitignored, der Linker nimmt sie automatisch).
   - `SHA256SUMS.txt`
4. GitHub Actions (`release.yml`) läuft bei Tag `v*`, baut dieselben drei Dateien auf einem Linux-Runner und
   veröffentlicht sie als Release-Assets.

**Icons:** Quelle `assets/icon/icon.svg` (weisse Kachel mit Haarlinie, «w»-Monogramm türkis, gemäss
`docs/04-design-system.md`), daraus `scripts/make-icons.sh` (macOS: `qlmanage`, `sips`, `iconutil`) → PNGs in
allen Grössen und `wallee.icns`; beides ist committet. Die `.ico` für Windows baut `go-winres` aus den PNGs.

**Ohne Fenster:** Weil weder Bundle noch GUI-Exe eine Konsole haben, gibt es `POST /quit` (gleicher
Origin-Check wie Proxy und Updater) hinter «Beenden» im Header. Ein zweiter Doppelklick prüft, ob auf dem
Wunschport bereits dieses Programm antwortet (`GET /update/version`), öffnet dann nur den Browser und beendet
sich. Startfehler (kein freier Port) erscheinen als Dialog (`MessageBoxW` via `syscall` bzw. `osascript`).

## Signaturen (offener Punkt für wallee)

Ohne Signatur meldet macOS beim ersten Start «Apple konnte nicht überprüfen …» (Umgehung seit macOS 15 nur
über Systemeinstellungen → Datenschutz & Sicherheit → «Trotzdem öffnen») und Windows zeigt SmartScreen.
Das README beschreibt beides. Die Signier-Schritte im Release-Workflow sind vorbereitet und laufen, sobald die
Secrets gesetzt sind. Was wallee dafür beschaffen muss:

**macOS — Apple Developer Program** (99 USD/Jahr, als Organisation; braucht D-U-N-S-Nummer, E-Mail auf der
Firmendomain, öffentliche Website, zeichnungsberechtigte Person). Danach:
- Zertifikat «Developer ID Application» erstellen und als `.p12` exportieren → Secrets `APPLE_CERT_BASE64`
  (Base64 der .p12), `APPLE_CERT_PASSWORD`, `APPLE_SIGNING_IDENTITY` (z.B. `Developer ID Application: wallee
  Group AG (TEAMID)`), `APPLE_TEAM_ID`.
- Für die Notarisierung ein App-spezifisches Passwort der Apple-ID → `APPLE_ID`, `APPLE_APP_PASSWORD`.
- Repository-Variable `MACOS_SIGNING_ENABLED=true`. Der Workflow signiert das Bundle (`codesign --deep
  --options runtime`), notarisiert es und **heftet das Ticket ans Bundle** (`stapler`), womit Gatekeeper auch
  offline zufrieden ist. Ergebnis: einmaliger Dialog «aus dem Internet geladen — öffnen?», sonst nichts.

**Windows — Code-Signing-Zertifikat.** Seit August 2024 behandelt Microsoft OV- und EV-Zertifikate bei
SmartScreen gleich; ein EV-Zertifikat bringt keinen Vorteil mehr. Reputation baut sich nach der ersten
signierten Version über Downloads auf, die Warnung verschwindet nach einigen Tagen und bleibt weg, solange
dasselbe Zertifikat verwendet wird (Zertifikatswechsel können die Reputation zurücksetzen). Optionen:
- **Azure Artifact Signing** (früher Trusted Signing): ca. 10 USD/Monat, keine Hardware-Token, Microsoft prüft
  die Organisation. Verfügbar für Organisationen in USA, Kanada, EU und UK — ob eine Schweizer AG akzeptiert
  wird, muss wallee prüfen (eine EU-Tochter würde den Weg öffnen). Der Workflow-Schritt müsste dann auf einen
  Windows-Runner mit `azure/trusted-signing-action` umgestellt werden.
- **OV-Zertifikat** (DigiCert, Sectigo, SSL.com; ca. 200–400 USD/Jahr). Seit 2023 muss der Schlüssel auf
  Hardware oder in einem Cloud-HSM liegen; für den Workflow braucht es den Cloud-Signierdienst des Anbieters
  (statt der heutigen PFX-Secrets `WINDOWS_CERT_BASE64`/`WINDOWS_CERT_PASSWORD`, die nur für exportierbare
  Zertifikate passen).

## Update-Mechanismus (seit 1.1.0)

Der Helper prüft auf Anfrage des Frontends, ob auf GitHub ein neueres Release existiert, und kann sich
selbst ersetzen. Das ist die einzige Ausnahme von «der Helper ist dumm» und bewusst eng gefasst:

| Endpunkt | Zweck |
|---|---|
| `GET /update/check` | `api.github.com/repos/<repo>/releases/latest` (1 h Cache), Vergleich mit der einkompilierten Version (SemVer); Antwort `{ current, latest, updateAvailable, assetName, assetSize, releaseUrl, notes }` |
| `POST /update/start` `{ "tag": "v1.1.0" }` | Lädt das Asset für die Plattform von `github.com/<repo>/releases/download/<tag>/`, prüft es gegen `SHA256SUMS.txt` desselben Releases, installiert und startet neu auf demselben Port. Windows: Exe ersetzen, alte Datei nach `.old`. macOS (seit 1.3.0): Zip neben das Bundle entpacken, **ganzes Bundle** tauschen (`.app` → `.app.old`), damit eine Signatur gültig bleibt; ohne Bundle (Entwicklung) nur das Binary. `.old` wird beim nächsten Start entfernt |
| `GET /update/status` | `{ state: downloading\|verifying\|installing\|restarting\|error, received, total, message }` für die Statusleiste |
| `GET /update/version` | Erkennung des Neustarts durch das Frontend |

Regeln: nur das einkompilierte Repository (`-X main.updateRepo=owner/repo`), nur Tags, die neuer sind als die
laufende Version (kein Downgrade), Prüfsumme muss stimmen, derselbe Origin-Check wie beim Proxy,
Entwicklungs-Builds (`dev`) aktualisieren nie. Das Frontend zeigt beim Start eine Leiste oben mit
«Update starten» (Bestätigungsdialog), verfolgt den Fortschritt, wartet auf die neue Version und lädt neu.
Nach dem Neustart wartet der Helper bis zu 15 s auf den bisherigen Port (`WVT_RESTART_PORT`), damit die
Seite unter derselben Adresse zurückkommt.

## Sicherheitsüberlegungen

- Helper bindet ausschliesslich `127.0.0.1`. Kein `0.0.0.0`.
- Proxy akzeptiert nur Requests mit `Origin`/`Sec-Fetch-Site` passend zum eigenen Origin bzw. ohne Origin
  (same-origin Navigations). Fremde Origins → 403.
- Proxy erlaubt nur Pfade unter `/wallee/` und leitet nur an den fix einkompilierten Host `app-wallee.com`
  weiter (kein Open Proxy).
- Der Authentication Key wird nie in URL, Query oder Logs geschrieben; UI maskiert ihn nach dem Speichern.
- Kartendaten berühren die App nie: MOTO-Eingabe erfolgt ausschliesslich auf der wallee Payment Page
  (PCI-Scope bleibt bei wallee).
- `Content-Security-Policy` im `index.html`: `default-src 'self'; connect-src 'self'; img-src 'self' data:;
  font-src 'self'; frame-src https://app-wallee.com` (frame-src nur, falls die Payment Page eingebettet
  wird — siehe UI-Flows).
