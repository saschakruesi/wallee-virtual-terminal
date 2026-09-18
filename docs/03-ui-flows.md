# 03 — UI & Flows

Leitidee: **Nach dem Setup ist ein Vorgang in unter 60 Sekunden gestartet.** Ein Wizard mit drei Schritten
(Kunde → Positionen → Start), grosse Klickflächen, Tastaturbedienung (Enter = weiter, Esc = abbrechen),
keine Nebensächlichkeiten auf dem Hauptpfad. Zielgruppe: Rezeption, Backoffice, Verkauf — keine Techniker.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Neuer Vorgang   Vorgänge   Kunden   Produkte                  [Space ▾] [wallee]  │  ← Header: weiss, Wortmarke türkis oben rechts
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Rubrik (grau, Light)                                                       │  ← zweizeilige Headline oben links (wallee-Signatur)
│   Thema (schwarz, Medium)                                                    │
│                                                                              │
│   Inhalt …                                                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Header 64 px, weiss, Haarlinie `#D9D9D9` unten. Navigation links als Text-Tabs (aktiv: schwarz Medium
  + 2 px türkiser Unterstrich; inaktiv: `#808080`). Rechts: Space-Chip (Name + Umgebung «PREVIEW»
  als kleines Badge in Orange-Text nur wenn Test), dann Wortmarke (`assets/brand/wallee_logo_turquoise.svg`,
  Höhe 22 px, Schutzraum ≥ 22 px).
- Inhalt max. 1120 px breit, zentriert, 40 px Aussenabstand; auf < 900 px einspaltig.
- Statuszeile unten rechts klein grau: Version, «Verbunden mit Space 1234». Kein Logo im Footer.
- Sprachumschalter (DE/EN) in den Einstellungen und im First-Run.

## Routen (HashRouter)

| Route | Screen |
|---|---|
| `#/setup` | Einrichtung (First-Run und Einstellungen) |
| `#/` | Neuer Vorgang (Modus-Auswahl → Wizard) |
| `#/moto/:id` | MOTO-Zahlung läuft / Ergebnis |
| `#/link/:id` | Zahlungslink-Status |
| `#/history` | Letzte Vorgänge |
| `#/customers`, `#/customers/new`, `#/customers/:id` | Kunden |
| `#/products` | Produkte (Liste + Inline-Bearbeitung) |

Ohne gültige Config leiten alle Routen auf `#/setup`.

## Screen: Einrichtung (`#/setup`)

Headline: «Einrichtung» / «wallee verbinden».

Split-Layout: links Türkis-Fläche (40 %) mit kurzer Erklärung in Schwarz («Sie brauchen einen Application
User mit Berechtigung auf Ihren Space. Anleitung →»), rechts das Formular auf Weiss:

1. **Application User ID** (Zahl)
2. **Authentication Key** (Passwortfeld mit Auge-Toggle; nach dem Speichern als `••••••••` + «ändern»)
3. **Space ID** (Zahl)
4. **Umgebung**: Segment «Test (PREVIEW)» / «Live» — Standard Test, Live mit Bestätigungsdialog
5. **Standardwährung** (Select aus `CHF, EUR, USD, GBP`, vorbelegt aus Space nach Verbindungstest)
6. **Sprache der Zahlungsseite/E-Mails** (`de-CH`, `en-US`, `fr-CH`, `it-CH`)
7. **Referenz-Präfix** (Text, Standard `VT`), Vorschau «VT-2026-000001»
8. **Abschlussverhalten**: «Sofort abbuchen (empfohlen)» / «Nur autorisieren, später abschliessen» / «Space-Einstellung»
9. Checkbox **«Zugangsdaten auf diesem Computer merken»** (Standard an; aus = sessionStorage)
10. Button **«Verbindung testen & speichern»**

Verbindungstest zeigt: Space-Name, Zustand, Anzahl aktive Charge Flows («Zahlungslink verfügbar» /
«nicht verfügbar — Hinweis»). Fehler werden im Klartext erklärt (401: User-ID/Key prüfen; 403: Rolle im
Space; Netzwerk: «Der Helper erreicht app-wallee.com nicht — Firewall/Proxy?»).

Zusätzlich auf dieser Seite: Sprache der App (DE/EN), «Produktkatalog exportieren/importieren»,
«Alle lokalen Daten löschen».

## Screen: Neuer Vorgang (`#/`)

Headline: «Neuer Vorgang» / «Zahlung erfassen».

**Schritt 0 — Modus** (zwei grosse Karten nebeneinander, je 50 %):

- **Telefon / MOTO** — «Sie nehmen die Kartendaten am Telefon entgegen und erfassen sie auf der wallee-Zahlungsseite.»
- **Zahlungslink per E-Mail** — «Der Kunde erhält einen Link und zahlt selbst.» (deaktiviert mit Hinweis, wenn kein Charge Flow aktiv)

Der zuletzt gewählte Modus ist vorausgewählt; Enter startet ihn. Modus bleibt im Wizard oben als Stepper sichtbar
und ist jederzeit wechselbar (Daten bleiben erhalten).

**Stepper**: `1 Kunde — 2 Positionen — 3 Prüfen & starten` (Stepper-Komponente: Nummern in schwarzen Kreisen,
aktiver Schritt türkiser Kreis mit schwarzer Zahl, Haarlinie dazwischen).

### Schritt 1 — Kunde

Ein Suchfeld mit Autofokus: «Name, E-Mail oder Kundennummer». Ab 2 Zeichen Debounce 300 ms → wallee-Suche,
Resultate als Liste (Name, E-Mail, Kundennummer). Auswahl übernimmt Kunde + Standardadresse.

Darunter zwei Links: **«Neuen Kunden anlegen»** (öffnet Inline-Formular, speichert in wallee, wählt aus) und
**«Ohne Kundenprofil weiter»** (nur die Pflichtfelder für den Vorgang: E-Mail (im Link-Modus Pflicht), Vorname,
Nachname, optional Firma, Strasse, PLZ, Ort, Land (Standard CH)). Bei «ohne Profil» wird nichts in wallee
angelegt; die Angaben gehen als `billingAddress` mit.

Anzeige nach Auswahl: Kundenkarte (Name, Firma, E-Mail, Adresse) mit «Ändern».

### Schritt 2 — Positionen

Tabelle mit Zeilen: Bezeichnung · Menge · Einzelpreis inkl. MwSt · MwSt-Satz · Zeilentotal · ✕.

- Oben: **Produktsuche** («Produkt hinzufügen…», Autocomplete aus dem lokalen Katalog; Enter fügt hinzu,
  Menge 1). Rechts daneben **«Freie Position»** (leere Zeile, Cursor im Namen).
- Zeilentyp per kleinem Select: Produkt / Gebühr / Rabatt (Rabatt → Betrag negativ, Anzeige in Klammern) /
  Versand / Trinkgeld.
- Untere Zeile: **Rabatt gesamt** (optional, Betrag oder %) → wird als eine `DISCOUNT`-Zeile gesendet.
- Rechts unten gross: **Total** (Roboto Medium 32 px, schwarz), darunter MwSt-Aufschlüsselung klein grau.
- Währung (Select, vorbelegt) und Referenz (vorgeschlagen, editierbar), sowie optionale Notiz (→ `metaData.note`).
- Validierung: mindestens eine Zeile, Total > 0, Menge > 0, Beträge 2 Dezimalen. Fehler inline unter dem Feld.

### Schritt 3 — Prüfen & starten

Zusammenfassung (Kunde links, Positionen rechts, Total gross), Umgebungshinweis wenn Test («Testumgebung —
es wird kein Geld bewegt», Orange-Text), und ein grosser Primär-Button:

- MOTO: **«Zahlungsseite öffnen»**
- Link: **«Zahlungslink senden an gast@example.com»**

Klick → `POST /payment/transactions` → je nach Modus weiter zu `#/moto/:id` bzw. `#/link/:id`.

## Screen: MOTO läuft (`#/moto/:id`)

Split-Layout:

- **Links (Weiss):** Zusammenfassung (Kunde, Positionen, Total), Referenz, Transaktions-ID, Statusbadge.
- **Rechts (Türkis-Fläche):** Die Zahlungserfassung.
  1. Beim Betreten: `GET payment-page-url`, dann **Versuch, die Payment Page in einem `<iframe>` in der
     rechten Fläche einzubetten** (Breite 100 %, min-height 640 px). Lässt sich die Seite nicht einbetten
     (`X-Frame-Options`/CSP — erkennbar daran, dass das iframe nach 3 s kein `load` mit Inhalt liefert bzw.
     ein Fehlerbild zeigt), **Fallback: Popup** via `window.open(url, 'wallee-payment', 'width=520,height=760')`
     und in der Fläche ein Panel: «Die Zahlungsseite ist in einem separaten Fenster geöffnet.» mit Buttons
     «Fenster erneut öffnen» und «Link kopieren». Welche Variante funktioniert, wird in `wvt.ui.motoEmbed`
     gemerkt, damit es beim nächsten Mal sofort richtig läuft. (Aufgabe für Phase 3: mit einem Test-Space
     empirisch prüfen; die Payment Page ist für Endkunden gedacht und wird vermutlich nicht einbettbar sein —
     dann ist Popup die Standardvariante, ohne iframe-Code im Produkt.)
  2. Polling des Transaktionsstatus; Fortschrittsanzeige «Warten auf Karteneingabe…».
  3. Ergebnis ersetzt die Fläche: grosser Haken + «Bezahlt» (oder «Autorisiert» mit Button «Jetzt abbuchen»),
     Betrag, Kartenmarke/letzte 4 (falls verfügbar), Buttons **«Beleg herunterladen»**, **«Neuer Vorgang»**.
     Bei Fehlschlag: Grund, Buttons **«Erneut versuchen»** (neue Payment-Page-URL derselben Transaktion,
     solange `chargeRetryEnabled` und Zustand es zulässt, sonst neue Transaktion mit denselben Daten) und
     **«Abbrechen»**.
- Der Mitarbeiter kann den Vorgang jederzeit **abbrechen** (Link oben rechts): Popup schliessen, bei
  `AUTHORIZED` void-online, sonst nur lokal als abgebrochen markieren (Transaktion läuft in wallee in ihren
  Timeout).

## Transaktionsstatus-Anzeige (beide Modi)

Auf `#/moto/:id`, `#/link/:id` und in der Vorgänge-Liste wird der wallee-Zustand nicht nur als Badge,
sondern auf den Detailseiten zusätzlich als **Status-Timeline** gezeigt (Komponente `StatusTimeline`):
horizontale Kette von Kreisen mit Haarlinie, erledigte Schritte schwarz mit weissem Haken, aktueller Schritt
Türkis, offene Schritte `#D9D9D9`. Darunter je Schritt der Zeitstempel aus der Transaktion.

| Schritt | wallee-Zustand(e) | Zeitstempel | Anzeige |
|---|---|---|---|
| Erstellt | `CREATE`, `PENDING` | `createdOn` | «Erstellt» / Link-Modus: «Link gesendet» |
| Bestätigt | `CONFIRMED`, `PROCESSING` | `confirmedOn`, `processingOn` | «Kunde gibt Zahlungsdaten ein» |
| Autorisiert | `AUTHORIZED` | `authorizedOn` | «Autorisiert» (Betrag reserviert) — Button «Jetzt abbuchen» bei `COMPLETE_DEFERRED` |
| Abgebucht | `COMPLETED` | `completedOn` | «Bezahlt» |
| Abgeschlossen | `FULFILL` | (`completedOn`) | «Bezahlt & abgeschlossen» — Endzustand, grosser Haken, Beleg-Button |
| Fehlgeschlagen / Storniert | `FAILED`, `DECLINE`, `VOIDED` | `failedOn` | Timeline bricht am letzten erreichten Schritt ab, roter bzw. grauer Endpunkt mit `userFailureMessage` / «Storniert» |

`FULFILL` ist der Zustand, den wallee nach erfolgreichem Abschluss und Auslieferungsentscheid setzt — für die
UI gilt er wie `COMPLETED` als «Bezahlt», wird aber als letzter, vollständiger Schritt hervorgehoben
(Timeline komplett schwarz, Badge «Abgeschlossen»). Polling endet bei `FULFILL`, `FAILED`, `DECLINE`, `VOIDED`;
bei `COMPLETED` läuft es noch bis zu 2 Minuten weiter (wallee wechselt in der Regel kurz danach auf `FULFILL`),
danach zeigt «Status aktualisieren» den Übergang manuell.

## Screen: Zahlungslink-Status (`#/link/:id`)

Split-Layout wie oben. Rechts (Türkis):

- «Zahlungslink gesendet an **gast@example.com**» mit Zeitpunkt, Level-Name aus dem Charge Flow, Ablaufdatum (`timeoutOn`).
- Der Link selbst in einem Copy-Feld («Link kopieren», «Link öffnen»), damit er auch per WhatsApp/SMS/Chat
  weitergegeben werden kann.
- Buttons: **«E-Mail erneut senden»**, **«Empfänger ändern»** (Inline-Feld → update-recipient + send-message),
  **«Abbrechen»** (charge-flow/cancel mit Bestätigung).
- Status-Badge (Ausstehend / Bezahlt / Fehlgeschlagen / Abgelaufen); leichtes Polling alle 10 s solange offen.
- Bei «Bezahlt»: Beleg herunterladen, Neuer Vorgang.

## Screen: Letzte Vorgänge (`#/history`)

Tabelle (Datum · Referenz · Kunde · Betrag · Modus · Status · Aktionen), Filter-Chips «Alle / Offen / Bezahlt /
Fehlgeschlagen», Suche nach Referenz/Kunde (clientseitig über die geladenen 50, «Mehr laden» via `offset`).
Zeile klicken → `#/moto/:id` bzw. `#/link/:id` (Modus aus `metaData.mode`). Aktionen kontextabhängig
(Link erneut senden, Abschliessen, Stornieren, Beleg).

Diese Liste ist die zentrale Stelle, um **versendete Zahlungslinks zu verfolgen**: Ein Charge-Flow-Vorgang
bleibt `PENDING`, bis der Kunde bezahlt hat. Beim Öffnen der Liste wird der Stand frisch aus wallee geladen;
zusätzlich gibt es oben rechts einen Button **«Status aktualisieren»** (Icon Aktualisieren, mit Zeitstempel
«zuletzt 14:32»). Der Navigations-Tab zeigt die Zahl offener Zahlungslinks als kleinen grauen Zähler
(«Vorgänge · 3 offen»), berechnet aus der letzten Ladung. Die Statusseite `#/link/:id` hat denselben
«Status aktualisieren»-Button neben dem Status-Badge.

## Screen: Kunden (`#/customers`)

Suche wie im Wizard, Liste, «Neuer Kunde». Detail: Stammdaten (Vorname, Nachname, E-Mail, Kundennummer
`customerId`, Sprache, Währung) + Adressen (Liste, «Adresse hinzufügen», Standard setzen). Speichern via
`PATCH` mit `version`; bei 409 neu laden mit Hinweis. Button «Vorgang starten» → Wizard mit vorgewähltem Kunden.

## Screen: Produkte (`#/products`)

Lokaler Katalog. Tabelle mit Inline-Bearbeitung: Bezeichnung · SKU · Preis inkl. MwSt · MwSt-Satz · Typ
(Produkt/Gebühr) · aktiv. «Neues Produkt», Duplizieren, Löschen (mit Undo-Toast). Export/Import JSON
(Schema unten) und CSV-Import (Spalten `name,sku,price,taxRate,type`). Hinweis-Text: «Produkte werden nur
auf diesem Computer gespeichert. Exportieren Sie den Katalog, um ihn auf einem anderen Gerät zu nutzen.»

```ts
type Product = {
  id: string;            // uuid
  name: string;
  sku?: string;
  price: number;         // in Rappen/Cent, inkl. MwSt
  taxRate: number;       // Prozent, z.B. 8.1
  taxTitle?: string;     // Standard "MwSt <rate>%"
  type: 'PRODUCT' | 'FEE' | 'SHIPPING';
  active: boolean;
  updatedAt: string;     // ISO
};
```

Standard-MwSt-Sätze CH (Auswahlliste, editierbar): 8.1 % Normal, 3.8 % Beherbergung, 2.6 % reduziert, 0 %.
Beim Katalog-Start ist er leer; ein «Beispielprodukte einfügen»-Link legt drei Beispielzeilen an.

## Komponenten (web/src/components)

`Button` (primary = schwarz auf Weiss / auf Türkis-Fläche weiss mit schwarzem Text; secondary = Haarlinie;
danger = Orange-Text), `Input`, `MoneyInput` (Rappen-basiert, Anzeige `1'234.50`), `Select`, `Segmented`,
`Stepper`, `Table`, `StatusBadge`, `Toast`, `Modal`/`ConfirmDialog`, `CopyField`, `Headline` (zweizeilig),
`Split` (Layout Weiss/Türkis), `EmptyState`, `Spinner`.

## Tastatur & Geschwindigkeit

- Autofokus auf dem ersten sinnvollen Feld jedes Schritts; Enter = nächster Schritt, wenn valide.
- `Cmd/Ctrl+N` = Neuer Vorgang, `Cmd/Ctrl+K` = Kundensuche fokussieren.
- Der Wizard merkt sich Entwürfe (sessionStorage), damit ein versehentlicher Reload nichts verliert.
- Alle API-Wartezeiten mit sichtbarem Zustand (Button-Spinner, Skeleton-Zeilen), nie stiller Stillstand.

## Fehler- und Leerzustände

- Netzwerk/Proxy-Fehler: gelbe Leiste oben «Keine Verbindung zu wallee — erneut versuchen».
- API-Feldfehler (400/422): am jeweiligen Feld, plus Zusammenfassung oben im Formular.
- Leere Listen: `EmptyState` mit einem Satz und einer Aktion («Noch keine Vorgänge — Neuen Vorgang starten»).
