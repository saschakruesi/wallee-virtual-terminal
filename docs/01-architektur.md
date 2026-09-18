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
3. `make release` erzeugt:
   - `wallee-virtual-terminal-macos-apple-silicon`
   - `wallee-virtual-terminal-macos-intel`
   - `wallee-virtual-terminal-windows.exe`
4. GitHub Actions (`release.yml`) läuft bei Tag `v*` und veröffentlicht die drei Dateien als Release-Assets,
   plus `SHA256SUMS.txt`.

**Signing / Gatekeeper (offener Punkt für wallee, nicht für Claude Code):** Unsignierte Binaries lösen
auf macOS «kann nicht geöffnet werden» aus (Umgehung: Rechtsklick → Öffnen bzw. Systemeinstellungen →
Datenschutz → «Trotzdem öffnen») und auf Windows SmartScreen. Für die Kundenauslieferung sollte wallee
mit dem Apple Developer ID (Notarisierung) und einem Windows-Code-Signing-Zertifikat signieren. Der
Release-Workflow bekommt dafür vorbereitete, per Secret aktivierbare Schritte (`codesign`/`notarytool`,
`signtool`), die ohne Secrets übersprungen werden. Das README beschreibt den Workaround für unsignierte Builds.

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
