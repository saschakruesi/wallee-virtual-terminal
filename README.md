# wallee Virtual Terminal

Zahlungen am Telefon erfassen (MOTO) und Zahlungslinks per E-Mail verschicken — direkt mit Ihrem
wallee-Space, ohne Kassensystem und ohne Onlineshop.

Für Hotels, Dienstleister und Händler, die Anzahlungen, Reservationen oder Rechnungen per Karte
entgegennehmen möchten.

## Was das Programm kann

- **Telefonische Zahlung (MOTO):** Sie erfassen Kunde und Betrag, die wallee-Zahlungsseite öffnet sich, Sie
  geben die Kartendaten ein, die der Kunde Ihnen am Telefon nennt. Das Ergebnis erscheint sofort, der Beleg
  lässt sich herunterladen.
- **Zahlungslink per E-Mail:** Sie erfassen Kunde und Betrag, wallee schickt dem Kunden einen Link, der Kunde
  zahlt selbst. Sie sehen, ob bezahlt wurde, und können den Link erneut senden oder den Empfänger ändern.
- **Kunden** werden in Ihrem wallee-Space gespeichert und sind beim nächsten Mal per Suche sofort da.
- **Produkte** legen Sie einmal an (Bezeichnung, Preis, MwSt) und fügen sie per Klick hinzu.

Kartendaten werden ausschliesslich auf der wallee-Zahlungsseite eingegeben — nie in diesem Programm.

## Download & Start

1. Laden Sie unter **Releases** die Datei für Ihr System herunter:
   - macOS (Apple Silicon): `wallee-virtual-terminal-macos-apple-silicon`
   - macOS (Intel): `wallee-virtual-terminal-macos-intel`
   - Windows: `wallee-virtual-terminal-windows.exe`
2. Doppelklick. Ein kleines Fenster mit Text öffnet sich (bitte offen lassen) und Ihr Browser zeigt das
   Programm unter `http://127.0.0.1:7811`.
3. Beim ersten Start richten Sie die Verbindung zu wallee ein (siehe unten).

**macOS meldet «kann nicht geöffnet werden»?** Rechtsklick auf die Datei → «Öffnen» → «Öffnen» bestätigen.
Bei neueren macOS-Versionen: Systemeinstellungen → Datenschutz & Sicherheit → «Trotzdem öffnen».
**Windows SmartScreen?** «Weitere Informationen» → «Trotzdem ausführen».

Das Programm braucht keine Installation und schreibt keine Dateien auf Ihren Computer; Ihre Einstellungen
liegen im Browser. Zum Beenden das Textfenster schliessen.

## Einrichtung in wallee (einmalig)

1. **Application User anlegen:** wallee-Backend → Account → Users → Application Users → «Create». Notieren
   Sie **User ID** und **Authentication Key** (der Key wird nur einmal angezeigt).
2. **Berechtigung:** Dem Application User im gewünschten Space eine Rolle mit Rechten auf Transaktionen,
   Charge Flows und Kunden geben (z.B. «Space Admin» oder eine eigene Rolle).
3. **Space ID:** steht in der URL des Backends (`.../s/12345/...`) bzw. unter Space → Settings.
4. **Für Zahlungslinks:** Space → Settings → Payment → Charge Flows → einen Flow mit einem Level «E-Mail»
   anlegen (Ablaufzeit z.B. 3 Tage).
5. **Für MOTO:** eine Zahlungsmethode/Connector, die Zahlungen ohne anwesenden Kunden erlaubt (Ihr
   wallee-Ansprechpartner hilft bei der Freischaltung).

Im Programm unter «Einrichtung» User ID, Key und Space ID eintragen, «Verbindung testen & speichern».
Beginnen Sie mit der **Testumgebung** und wechseln Sie erst nach einer erfolgreichen Testzahlung auf Live.

## Häufige Fragen

**Wo sind meine Zugangsdaten gespeichert?** Im Browser auf diesem Computer (Speicher der Adresse
`127.0.0.1:7811`). Sie verlassen den Computer nur verschlüsselt in Richtung `app-wallee.com`.

**Kann ich das Programm auf mehreren Computern nutzen?** Ja — auf jedem die Einrichtung wiederholen. Den
Produktkatalog können Sie exportieren und importieren.

**Es öffnet sich kein Browser.** Öffnen Sie manuell `http://127.0.0.1:7811` (oder den Port, der im Textfenster
steht).

## Für Entwickler

Siehe `CLAUDE.md` und `docs/`. Frontend: Vite + React + TypeScript. Helper: Go (Standardbibliothek).

```bash
cd web && npm ci && npm run build
cd ../helper && make build && ./wallee-virtual-terminal
```

Lizenz: proprietär, © wallee Group AG.
