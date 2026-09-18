# 02 — wallee API (v2.0, JWT)

Quelle: `https://app-wallee.com/doc/api/web-service` und die OpenAPI-Spezifikation
`https://app-wallee.com/api/spec3.json` (OpenAPI 3.0.1, Version 2.0). Alle Angaben unten wurden gegen die Spec
geprüft (Stand 18.09.2026). **Nur v2.0 verwenden.** v1 (`/api/transaction/create`, HMAC-SHA512 in
`x-mac-*`-Headern) ist deprecated und nicht Teil dieses Projekts.

Base-URL: `https://app-wallee.com/api/v2.0` — im Frontend über `apiBase` (Standard `/wallee`, vom Helper
weitergeleitet).

## 1. Authentifizierung

Jeder Request trägt `Authorization: Bearer <JWT>`. Das JWT wird **pro Request** neu erzeugt und ist an Pfad
und Methode gebunden.

```
Header   { "alg": "HS256", "typ": "JWT", "ver": 1 }
Payload  { "sub": "<applicationUserId>",           // String!
           "iat": <unix seconds>,                  // jetzt, in Sekunden
           "requestPath": "/api/v2.0/customers/search?limit=10&query=...",  // Pfad inkl. Query, ohne Host
           "requestMethod": "GET" }                // Grossbuchstaben
Signatur HMAC-SHA256(base64url(header) + "." + base64url(payload), key)
key      = Base64-DECODE(authenticationKey)        // der Key aus dem Backend ist base64-kodiert
```

Wichtig für die Implementierung (`web/src/api/jwt.ts`):

- `requestPath` muss **exakt** dem Pfad entsprechen, den wallee sieht: `/api/v2.0/...` inkl. Query-String in
  derselben Reihenfolge und Kodierung wie gesendet. Deshalb baut der Client die URL zuerst mit
  `URLSearchParams`, nimmt daraus `pathname + search`, signiert, und sendet dann genau diese URL über den
  Proxy (`/wallee` + rest). Der Proxy darf nichts umkodieren.
- Die Doku zeigt `iat` in Sekunden (`1664375069`); im Beispiel-Token stehen Millisekunden. Implementieren mit
  **Sekunden**; im Verbindungstest bei `401` einmalig mit Millisekunden probieren und den funktionierenden
  Modus in `wvt.config.iatUnit` merken. Uhrzeit-Abweichungen > wenige Minuten führen zu 401 → Fehlermeldung
  «Systemuhr prüfen».
- Base64url ohne Padding. Payload-JSON ohne Whitespace.
- WebCrypto: `crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])`.

Credentials entstehen im wallee-Backend unter **Account → Users → Application Users**: `userId` (numerisch)
und `authenticationKey` (nur einmal sichtbar). Der Application User braucht im Ziel-Space eine Rolle mit
Rechten auf Transactions, Charge Flows, Customers (Lesen + Schreiben) und Spaces (Lesen).

Zusätzlich jeder Request: Header `space: <spaceId>` (Pflicht bei allen hier verwendeten Endpunkten).

## 2. Client-Konventionen (`web/src/api/client.ts`)

```ts
request<T>(method, path, { query?, body?, expand? }): Promise<T>
```

- Baut `path` + Query (`expand` als kommaseparierte Liste in `?expand=`), signiert, sendet mit
  `Content-Type: application/json`, `Accept: application/json` (bei `text/plain`-Endpunkten `Accept: text/plain`).
- Fehler: Status ≠ 2xx → `WalleeApiError { status, code?, message, details? }`; Body-Schema `RestApiErrorResponse`
  (bei 400/422 enthält er Feldfehler → in der UI am Formular anzeigen). 401 → «Credentials ungültig», 403 →
  «Application User hat keine Berechtigung im Space», 409 → optimistic locking (neu laden), 429 → Backoff.
- Timeout 20 s, keine automatischen Retries bei POST (idempotent ist nur GET).

## 3. Verwendete Endpunkte

### Setup / Verbindungstest

| Zweck | Call |
|---|---|
| Space lesen (Name, Zeitzone, Währung, State) | `GET /spaces/{spaceId}` — einziger Endpunkt ohne Pflicht-Header `space` (Client setzt ihn trotzdem, schadet nicht) |
| Charge Flows des Space (für Zahlungslink-Modus) | `GET /payment/charge-flows?limit=100` → `{ data: ChargeFlow[] }` — `state:ACTIVE` zählt |
| Charge-Flow-Levels einer Konfiguration | `GET /payment/charge-flows/levels/search?query=...` |

Verbindungstest = `GET /spaces/{id}` erfolgreich → Space-Name anzeigen. Danach `GET /payment/charge-flows`;
ohne aktiven Charge Flow wird der Zahlungslink-Modus in der UI mit Hinweis deaktiviert («Im Space unter
Settings → Payment → Charge Flows einen Flow mit Level E-Mail einrichten»).

### Transaktion erstellen (beide Modi)

`POST /payment/transactions?expand=lineItems` — Body `Transaction.Create`:

```jsonc
{
  "currency": "CHF",
  "language": "de-CH",
  "merchantReference": "VT-2026-000123",          // Präfix aus Config + fortlaufende Nummer
  "invoiceMerchantReference": "VT-2026-000123",
  "customerId": "12345",                          // optional: wallee Customer-ID als String, wenn Kunde gewählt
  "customerEmailAddress": "gast@example.com",     // Pflicht im Zahlungslink-Modus
  "customersPresence": "NOT_PRESENT",             // MOTO; Zahlungslink: "VIRTUAL_PRESENT"
  "environmentSelectionStrategy": "FORCE_TEST_ENVIRONMENT", // aus Config: PREVIEW → FORCE_TEST_ENVIRONMENT, LIVE → FORCE_PRODUCTION_ENVIRONMENT
  "completionBehavior": "USE_CONFIGURATION",      // Config-Option: COMPLETE_IMMEDIATELY | COMPLETE_DEFERRED | USE_CONFIGURATION
  "autoConfirmationEnabled": true,
  "chargeRetryEnabled": true,
  "billingAddress": {                             // Address.Create — nur gesetzte Felder senden
    "givenName": "Anna", "familyName": "Muster", "organizationName": "Hotel Muster AG",
    "street": "Bahnhofstrasse 1", "postcode": "8400", "city": "Winterthur", "country": "CH",
    "emailAddress": "gast@example.com", "phoneNumber": "+41 52 000 00 00"
  },
  "lineItems": [
    { "uniqueId": "li-1", "type": "PRODUCT", "name": "Doppelzimmer 2 Nächte", "sku": "DZ",
      "quantity": 1, "amountIncludingTax": 480.00,
      "taxes": [ { "title": "MwSt 3.8%", "rate": 3.8 } ] },
    { "uniqueId": "li-2", "type": "DISCOUNT", "name": "Frühbucher", "quantity": 1, "amountIncludingTax": -20.00 },
    { "uniqueId": "li-3", "type": "FEE", "name": "Kurtaxe", "quantity": 2, "amountIncludingTax": 7.00 }
  ],
  "metaData": { "source": "wallee-virtual-terminal", "mode": "MOTO", "appVersion": "1.0.0" }
}
```

Regeln:
- `amountIncludingTax` ist der **Zeilentotal** (Menge × Einzelpreis, inkl. MwSt, nach Rabatt), nicht der Einzelpreis.
  Rabatt-Zeilen (`DISCOUNT`) negativ. Beträge mit max. 2 Dezimalen (`lib/money.ts` rechnet in Rappen).
- `LineItemType`: `PRODUCT | DISCOUNT | FEE | SHIPPING | TIP`.
- `taxes[].rate` in Prozent (`8.1`, `3.8`, `2.6`, `0`), `title` frei.
- `uniqueId` pro Zeile eindeutig (`li-<n>`).
- `language`: BCP-47 aus Config (`de-CH`, `en-US`, `fr-CH`, `it-CH`).
- Antwort `201` → `Transaction` mit `id`, `state` (initial `PENDING`), `authorizationAmount`, `version`.
- `metaData.source` ist der Filter für die «Letzte Vorgänge»-Liste.

### MOTO: Payment Page öffnen und Ergebnis abwarten

| Schritt | Call |
|---|---|
| Payment-Page-URL | `GET /payment/transactions/{id}/payment-page-url` → **`text/plain`**, Body ist die URL |
| Zustand pollen | `GET /payment/transactions/{id}` alle 2 s (nach 60 s alle 5 s), Abbruch nach 15 min |
| Abbruch durch Mitarbeiter | `POST /payment/transactions/{id}/void-online` (nur wenn `state = AUTHORIZED`) |
| Beleg/Rechnung | `GET /payment/transactions/{id}/invoice-document` → `RenderedDocument { data (base64), mimeType, title }` → als Download anbieten |
| Erfolgreicher Charge Attempt (Kartenmarke, letzte 4) | `GET /payment/transactions/{id}/successful-charge-attempt` (optional für die Ergebnisanzeige) |

Zustände (`TransactionState`): `CREATE, PENDING, CONFIRMED, PROCESSING, FAILED, AUTHORIZED, VOIDED, COMPLETED,
FULFILL, DECLINE`. Für die UI:

| state | Anzeige |
|---|---|
| `PENDING`, `CONFIRMED`, `PROCESSING` | «Warten auf Eingabe / Verarbeitung» (Spinner) |
| `AUTHORIZED` | «Autorisiert» (grün) — bei `COMPLETE_DEFERRED` Button «Jetzt abschliessen» = `POST /payment/transactions/{id}/complete-online` |
| `COMPLETED`, `FULFILL` | «Bezahlt» (grün) |
| `FAILED`, `DECLINE` | «Fehlgeschlagen» (rot) + `userFailureMessage` / `failureReason.description` |
| `VOIDED` | «Storniert» (grau) |

Voraussetzung im Space: eine Payment-Method-Konfiguration/Connector, die MOTO (`customersPresence = NOT_PRESENT`)
zulässt. Falls `POST /payment/transactions` mit 422 antwortet, Meldung aus dem Body anzeigen und auf die
Space-Konfiguration verweisen.

Optional-Check vor dem Öffnen: `GET /payment/transactions/{id}/payment-method-configurations?integrationMode=PAYMENT_PAGE`
→ leer ⇒ «Keine Zahlungsmethode für MOTO konfiguriert».

### Zahlungslink (Charge Flow)

| Schritt | Call |
|---|---|
| 1. Transaktion erstellen | wie oben, `customersPresence: "VIRTUAL_PRESENT"`, `customerEmailAddress` Pflicht |
| 2. Charge Flow anwenden | `POST /payment/transactions/{id}/charge-flow/apply` → `Transaction` (wallee wählt den passenden Flow nach Conditions/Priorität und startet Level 1, z.B. E-Mail mit Zahlungslink) |
| 3. Link für Copy/Paste | `GET /payment/transactions/{id}/charge-flow/payment-page-url` → `text/plain` URL |
| 4. Status | `GET /payment/transactions/{id}` (Transaktion) **und** `GET /payment/charge-flows/levels/search?query=transaction.id:{id}&expand=configuration` → Level mit `state PENDING/FAILED/SUCCESSFUL`, `timeoutOn`, `configuration.name`, `configuration.type` |
| 5. E-Mail erneut senden | `POST /payment/charge-flows/levels/{levelId}/send-message` → 204 |
| 6. Empfänger ändern | `POST /payment/transactions/{id}/charge-flow/update-recipient?type={configuration.type}&recipient={email}` → 204, danach `send-message` |
| 7. Abbrechen | `POST /payment/transactions/{id}/charge-flow/cancel` |

Polling im Zahlungslink-Modus ist optional (der Kunde zahlt irgendwann): Statusseite pollt nur solange sie
offen ist (alle 10 s), sonst zeigt die «Letzte Vorgänge»-Liste den aktuellen Zustand beim Öffnen.

### Kunden (wallee Customer API)

| Zweck | Call |
|---|---|
| Suchen | `GET /customers/search?query=<q>&limit=20&order=familyName` → `{ data: Customer[], hasMore, limit, offset }` |
| Lesen | `GET /customers/{id}` |
| Anlegen | `POST /customers` — Body `Customer.Create { givenName, familyName, emailAddress, customerId?, language?, preferredCurrency?, metaData? }` → `201 Customer` |
| Ändern | `PATCH /customers/{id}` — Body inkl. aktueller `version` (optimistic locking, 409 → neu laden) |
| Adresse anlegen | `POST /customers/{customerId}/addresses` — Body `CustomerAddress.Create { customer, addressType: "BILLING"\|"SHIPPING"\|"BOTH", address: CustomerPostalAddress.Create {...} }` |
| Adressen lesen | `GET /customers/{customerId}/addresses` |
| Standardadresse | `POST /customers/{customerId}/addresses/{id}/default` |

Suchsyntax (siehe Doku §6): `emailAddress:~"anna"`, `familyName:~"muster"`, kombiniert mit `OR`.
Die UI-Suche baut aus einem Freitext: `(givenName:~"<q>" OR familyName:~"<q>" OR emailAddress:~"<q>" OR customerId:~"<q>")`.

Beim Start eines Vorgangs mit gewähltem Kunden: `customerId` = `String(customer.id)`, `customerEmailAddress` =
`customer.emailAddress`, `billingAddress` = Standard-Rechnungsadresse (falls vorhanden) — Felder sind
im Formular vorausgefüllt und editierbar.

### Produkte

wallee hat keinen generischen Produktkatalog (nur Subscription-Produkte, die hier nicht passen). Der Katalog
ist deshalb **lokal** (`localStorage`, Export/Import als JSON), siehe `docs/03-ui-flows.md`. Kein API-Call.

### Letzte Vorgänge

`GET /payment/transactions/search?query=metaData.source:"wallee-virtual-terminal"&order=createdOn:DESC&limit=50`
— fällt die Suche über `metaData` nicht wie erwartet aus (im Verbindungstest prüfen), alternativ
`merchantReference:~"<Präfix>"` verwenden. Anzeige: Datum, Referenz, Kunde (`billingAddress` / `customerEmailAddress`),
Betrag, Modus (aus `metaData.mode` oder `customersPresence`), Status. Aktionen je nach Zustand: Öffnen,
Link erneut senden, Abschliessen, Stornieren, Beleg.

## 4. Polling & Timing

- Polling nur, solange die jeweilige Seite offen ist; `AbortController` beim Verlassen.
- Nach Abschluss (`COMPLETED`/`FULFILL`/`FAILED`/`DECLINE`/`VOIDED`) stoppt das Polling und der Eintrag in
  `wvt.recent` wird aktualisiert.
- Mehrere Tabs: keine Sperre nötig, jede Seite pollt eigenständig.

## 5. Testen mit einem Test-Space

- Application User im Test-Account anlegen, Space mit Test-Connector (wallee «Test Card» Payment Method).
- Environment in der App auf **PREVIEW** (→ `FORCE_TEST_ENVIRONMENT`).
- Test-Kartennummern gemäss wallee-Doku (Processors → Test Processor).
- Charge Flow im Test-Space: Flow «Standard» mit Level 1 «E-Mail» (Timeout z.B. 3 Tage), E-Mail-Template Standard.
