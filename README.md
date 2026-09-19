# wallee Virtual Terminal

Zahlungen am Telefon erfassen (MOTO) und Zahlungslinks per E-Mail verschicken — direkt mit Ihrem
wallee-Space, ohne Kassensystem und ohne Onlineshop.

Für Hotels, Dienstleister und Händler, die Anzahlungen, Reservationen oder Rechnungen per Karte
entgegennehmen möchten.

## Was das Programm kann

- **Telefonische Zahlung (MOTO):** Sie erfassen Kunde und Betrag, die wallee-Zahlungsseite öffnet sich in
  einem eigenen Fenster, Sie geben die Kartendaten ein, die der Kunde Ihnen am Telefon nennt. Das Ergebnis
  erscheint sofort im Programm, der Beleg lässt sich herunterladen.
- **Zahlungslink per E-Mail:** Sie erfassen Kunde und Betrag, wallee schickt dem Kunden einen Link, der
  Kunde zahlt selbst. Sie sehen unter «Vorgänge», ob bezahlt wurde, und können den Link erneut senden,
  den Empfänger ändern oder den Link abbrechen.
- **Kunden** werden in Ihrem wallee-Space gespeichert und sind beim nächsten Mal per Suche sofort da.
- **Produkte** legen Sie einmal an (Bezeichnung, Preis, MwSt) und fügen sie im Vorgang per Suche hinzu.

Kartendaten werden ausschliesslich auf der wallee-Zahlungsseite eingegeben — nie in diesem Programm.

## Download & Start

1. Laden Sie unter **Releases** die Datei für Ihr System herunter:
   - macOS (Apple Silicon, M1 und neuer): `wallee-virtual-terminal-macos-apple-silicon`
   - macOS (Intel): `wallee-virtual-terminal-macos-intel`
   - Windows (64-bit): `wallee-virtual-terminal-windows.exe`
2. Doppelklick auf die Datei. Ein kleines Textfenster öffnet sich (bitte offen lassen) und Ihr Browser zeigt
   das Programm unter `http://127.0.0.1:7811`.
3. Beim ersten Start richten Sie die Verbindung zu wallee ein (siehe unten).

Das Programm braucht keine Installation und schreibt keine Dateien auf Ihren Computer; Ihre Einstellungen
liegen im Browser. Zum Beenden schliessen Sie das Textfenster (oder drücken dort Ctrl+C).

**macOS meldet «kann nicht geöffnet werden»?** Rechtsklick auf die Datei → «Öffnen» → «Öffnen» bestätigen.
Bei neueren macOS-Versionen: Systemeinstellungen → Datenschutz & Sicherheit → «Trotzdem öffnen».
Falls die Datei nicht ausführbar ist: im Terminal `chmod +x wallee-virtual-terminal-macos-*` ausführen.

**Windows SmartScreen?** «Weitere Informationen» → «Trotzdem ausführen». Die Windows-Firewall fragt beim
ersten Start eventuell nach — das Programm braucht nur ausgehende Verbindungen zu `app-wallee.com`.

## Einrichtung in wallee (einmalig)

1. **Application User anlegen:** wallee-Backend → Account → Users → Application Users → «Create».
   Notieren Sie **User ID** und **Authentication Key** (der Key wird nur einmal angezeigt).

   _[Screenshot: Application User anlegen]_

2. **Berechtigung:** Dem Application User im gewünschten Space eine Rolle mit Rechten auf Transaktionen,
   Charge Flows und Kunden geben (z.B. «Space Admin» oder eine eigene Rolle).

   _[Screenshot: Rolle im Space zuweisen]_

3. **Space ID:** steht in der URL des Backends (`…/s/12345/…`) bzw. unter Space → Settings.
4. **Für Zahlungslinks:** Space → Settings → Payment → Charge Flows → einen Flow mit einem Level
   «E-Mail» anlegen (Ablaufzeit z.B. 3 Tage). Ohne aktiven Charge Flow ist der Modus «Zahlungslink» im
   Programm ausgegraut.

   _[Screenshot: Charge Flow mit Level E-Mail]_

5. **Für MOTO:** eine Zahlungsmethode bzw. ein Connector, der Zahlungen ohne anwesenden Kunden erlaubt
   (Ihr wallee-Ansprechpartner hilft bei der Freischaltung).

Im Programm unter «Einrichtung» User ID, Key und Space ID eintragen und **«Verbindung testen & speichern»**
klicken. Das Programm zeigt den Namen des Space und ob Zahlungslinks verfügbar sind.

Beginnen Sie mit der **Testumgebung** (Umgebung «Test (PREVIEW)», Badge «PREVIEW» im Kopf) und wechseln
Sie erst nach einer erfolgreichen Testzahlung auf **Live**. Der Wechsel auf Live wird bestätigt.

## So läuft ein Vorgang

1. **Neuer Vorgang** → Modus wählen: «Telefon / MOTO» oder «Zahlungslink per E-Mail».
2. **Kunde:** Name, E-Mail oder Kundennummer eintippen und den Kunden aus wallee auswählen, neu anlegen
   oder «Ohne Kundenprofil weiter» (Adresse nur für diesen Vorgang). Beim Zahlungslink ist die E-Mail Pflicht.
3. **Positionen:** Produkt aus dem Katalog suchen (Enter fügt hinzu) oder eine freie Position erfassen.
   Menge, Einzelpreis inkl. MwSt und MwSt-Satz anpassen, optional Rabatt, Referenz und Notiz.
4. **Prüfen & starten:** Bei MOTO öffnet sich die Zahlungsseite in einem Fenster; das Programm wartet auf
   das Ergebnis. Beim Zahlungslink verschickt wallee die E-Mail; die Statusseite zeigt den Link zum Kopieren.

**Tastatur:** Enter = nächster Schritt, `⌘/Ctrl+N` = neuer Vorgang, `⌘/Ctrl+K` = Kundensuche.

## Häufige Fragen

**Wo sind meine Zugangsdaten gespeichert?** Im Browser auf diesem Computer (Speicher der Adresse
`127.0.0.1:7811`). Sie verlassen den Computer nur verschlüsselt in Richtung `app-wallee.com`. Mit
abgewähltem «Zugangsdaten merken» gelten sie nur bis zum Schliessen des Browser-Tabs.

**Kann ich das Programm auf mehreren Computern nutzen?** Ja — auf jedem die Einrichtung wiederholen. Den
Produktkatalog können Sie unter «Produkte» exportieren und auf dem anderen Gerät importieren (JSON oder CSV).

**Es öffnet sich kein Browser.** Öffnen Sie manuell `http://127.0.0.1:7811` (oder den Port, der im
Textfenster steht — ist 7811 belegt, nimmt das Programm den nächsten freien).

**Der Browser blockiert das Zahlungsfenster.** Das Programm zeigt dann einen Button «Zahlungsseite
öffnen». Alternativ den Link kopieren und in einem neuen Tab öffnen.

**«Keine Verbindung zu wallee».** Internetverbindung, Firewall oder Firmen-Proxy prüfen; das Programm
braucht Zugriff auf `https://app-wallee.com`. «Erneut versuchen» lädt die Seite neu; laufende Vorgänge
bleiben in wallee erhalten und sind unter «Vorgänge» wieder sichtbar.

**Zahlung «Autorisiert» statt «Bezahlt».** Bei der Einstellung «Nur autorisieren» ist der Betrag reserviert.
«Jetzt abbuchen» schliesst die Zahlung ab; «Abbrechen» gibt die Reservation frei.

**Neue Version?** Die Statuszeile unten zeigt die installierte Version und einen Link auf die Releases-Seite.
Das Programm aktualisiert sich nicht selbst: neue Datei herunterladen, alte ersetzen — die Einstellungen
bleiben erhalten.

## Für Entwickler

Siehe `CLAUDE.md` und `docs/`. Frontend: Vite + React + TypeScript (`web/`). Helper: Go, nur
Standardbibliothek (`helper/`). Der Helper serviert das eingebettete Frontend und leitet `/wallee/*` an
`https://app-wallee.com/api/v2.0/*` weiter; signiert wird im Browser (JWT HS256, WebCrypto).

```bash
cd web && npm ci && npm test && npm run build
cd ../helper && make build && ./wallee-virtual-terminal
```

Release: Tag `v1.2.3` pushen → GitHub Actions baut die drei Binaries, `SHA256SUMS.txt` und das Release.
Code-Signing (Apple Developer ID / Windows-Zertifikat) läuft, sobald die entsprechenden Secrets gesetzt sind
(`APPLE_*`, `WINDOWS_CERT_*`, Repository-Variable `MACOS_SIGNING_ENABLED=true`).

Lizenz: proprietär, © wallee Group AG.
