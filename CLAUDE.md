# wallee Virtual Terminal — Anweisungen für Claude Code

Dieses Repository enthält den **wallee Virtual Terminal**: ein herunterladbares Werkzeug für wallee-Kunden
(Hotels, Dienstleister, Handel), um ohne Kassensystem und ohne Shop zwei Dinge zu tun:

1. **MOTO** (Mail Order / Telephone Order): Karten­daten eines Kunden am Telefon entgegennehmen und die
   Zahlung über die wallee Payment Page abschliessen.
2. **Zahlungslink / Charge Flow**: dem Kunden per E-Mail einen Zahlungslink schicken (z.B. Anzahlung,
   Rechnung, Reservation) und den Status verfolgen.

Dazu kommt eine kleine Stammdaten-Verwaltung (Kunden in wallee, Produkte lokal), damit ein Vorgang in
wenigen Klicks zusammengestellt ist.

**Lies vor jeder Arbeit `docs/05-implementationsplan.md`** — dort steht, welche Phase aktuell ist und
welche Akzeptanzkriterien gelten. Die anderen Dokumente sind die verbindliche Spezifikation:

| Dokument | Inhalt |
|---|---|
| `docs/01-architektur.md` | Technologie-Entscheid, Komponenten, Ordnerstruktur, Build & Release |
| `docs/02-wallee-api.md` | JWT-Auth, verwendete Endpunkte, Payloads, Fehlerbehandlung, Polling |
| `docs/03-ui-flows.md` | Screens, Navigation, Flows für Setup, MOTO, Zahlungslink, Kunden, Produkte |
| `docs/04-design-system.md` | wallee-Design: Farben, Typografie, Logo, Komponenten, CSS-Tokens |
| `docs/05-implementationsplan.md` | Phasen, Reihenfolge, Definition of Done, Testplan |

## Harte Regeln

- **Kein Node.js zur Laufzeit beim Kunden.** Auslieferung ist eine einzige ausführbare Datei pro Plattform
  (Go-Binary mit eingebettetem Frontend). Node/npm gibt es nur zur Build-Zeit.
- **Der Go-Helper ist dumm.** Er serviert das Frontend und leitet `/wallee/*` 1:1 an `https://app-wallee.com/api/v2.0/*`
  weiter. Er kennt keine Credentials, signiert nichts, speichert nichts. Signieren (JWT HS256) macht der Browser
  mit WebCrypto. Grund: Wenn wallee eines Tages CORS für die API öffnet, läuft dasselbe Frontend ohne Helper
  (z.B. von GitHub Pages).
- **Credentials bleiben beim Kunden.** Speicherung im Browser (`localStorage` des Helper-Origins), nie in Dateien
  auf dem Server, nie in Logs, nie in URLs. Der Authentication Key wird in der UI nach dem Speichern maskiert.
- **wallee-Design ist Pflicht** (`docs/04-design-system.md`): Roboto, Türkis `#11D9CC` als Fläche, Text
  schwarz/dunkelgrau, kein Türkis als Textfarbe auf Weiss, Wortmarke oben rechts, ruhiger Look. Keine
  «Agent-Optik» (keine Gradient-Buttons, keine Emojis, keine Glassmorphism-Karten, keine lila Akzente).
- **Sprache:** UI-Texte über i18n (`de` Standard, `en`), Schweizer Rechtschreibung («ss», nie «ß»).
  Code, Kommentare, Commit-Messages auf Englisch.
- **Keine Framework-Explosion.** Vite + React + TypeScript, eigenes CSS (CSS-Variablen), kein UI-Kit,
  keine State-Library (React Context + Hooks reichen). Abhängigkeiten nur, wenn im Plan genannt.
- **Alles muss offline bauen und laufen** (ausser der API-Aufrufe): Roboto als woff2 im Repo, keine CDN-Links.

## Kommandos

```bash
# Frontend (im Ordner web/)
npm install
npm run dev        # Vite-Devserver mit Proxy auf app-wallee.com (siehe vite.config.ts)
npm run build      # erzeugt web/dist → wird vom Go-Binary eingebettet
npm run test       # Vitest (Unit: JWT, Money, Validierung, Katalog)

# Helper (im Ordner helper/)
go run .           # startet auf 127.0.0.1:7811 und öffnet den Browser
go build -o wallee-virtual-terminal .
make release       # cross-compiliert darwin/arm64, darwin/amd64, windows/amd64 → dist/
```

## Arbeitsweise

- Jede Phase aus dem Implementationsplan als eigener Branch/PR, kleine Commits.
- Vor dem Abschluss einer Phase: `npm run build && go build` müssen sauber durchlaufen, Unit-Tests grün,
  und der manuelle Test aus dem Plan ist durchgespielt (mit einem wallee **Test-Space**, Environment `PREVIEW`).
- Bei Unklarheiten in der API zuerst `docs/02-wallee-api.md` und dann die OpenAPI-Spezifikation
  `https://app-wallee.com/api/spec3.json` konsultieren (v2.0, JWT). **Die alte API v1 (`/api/transaction/...`,
  HMAC-SHA512-Header) nicht verwenden — sie ist deprecated.**
- Nichts erfinden: Wenn ein Endpunkt oder Feld nicht in der Spec steht, nachfragen statt raten.
