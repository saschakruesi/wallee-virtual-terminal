# 04 — Design-System (wallee Corporate Design)

Verbindlich, abgeleitet aus dem wallee CI-Manual. Der Look ist **leise**: dünne Schriftschnitte, kleine
Headlines, Wirkung durch Türkis-Flächen und Weissraum — nicht durch Fettdruck, Schatten oder Verläufe.
Claim: **#homeofpayment** (immer klein geschrieben).

## Farben

| Token | Wert | Verwendung |
|---|---|---|
| `--w-turquoise` | `#11D9CC` | Markenfarbe, **flächig**: Split-Panels, Titelflächen, aktiver Stepper-Kreis, Unterstrich aktiver Tab, Fokusring |
| `--w-turquoise-80` | `#41E1D6` | Hover auf Türkis-Fläche |
| `--w-turquoise-60` | `#58E3DA` | Chart-Serie 2 |
| `--w-turquoise-40` | `#9CEDE7` | Chart-Serie 3, Tabellenzeilen-Hover auf Türkis |
| `--w-turquoise-20` | `#CFF7F4` | Sanfte Hintergrundflächen (Info-Boxen), Zeilen-Hover auf Weiss |
| `--w-turquoise-text` | `#0B8F87` | **Einzige** türkis wirkende Textfarbe auf Weiss (Links, Sekundäraktionen) |
| `--w-turquoise-deep` | `#0E6B66` | Hervorhebung innerhalb einer Türkis-Fläche |
| `--w-orange` | `#FF4D00` | Ein Call-out pro Screen: Test-Umgebung-Badge, destruktive Aktion (Text), Fehlermarker. Nie flächig |
| `--w-black` | `#000000` | Headline Zeile 2, Primärbuttons, Text auf Türkis |
| `--w-text` | `#333333` | Fliesstext |
| `--w-text-muted` | `#808080` | Rubrikzeile, Labels, Fussnoten, inaktive Tabs |
| `--w-line` | `#D9D9D9` | Haarlinien, Rahmen von Inputs, Tabellenlinien |
| `--w-grid` | `#E6E6E6` | Tabellen-Zebra (sehr dezent), Chart-Gitter |
| `--w-bg` | `#FFFFFF` | Standardhintergrund |
| `--w-bg-soft` | `#F7F7F7` | Seitenhintergrund hinter Karten (sparsam) |
| `--w-success` | `#0B8F87` | «Bezahlt», «Autorisiert» (türkis-dunkel statt fremdem Grün) |
| `--w-error` | `#FF4D00` | Fehlerstatus |

**Kontrastregeln (nicht verhandelbar):**
- Text auf Türkis ist **Schwarz** (`#000`/`#333`). Weiss auf Türkis nur für die Wortmarke und Display-Zahlen ≥ 40 px.
- Türkis `#11D9CC` ist **keine Textfarbe auf Weiss** (1.8:1). Dafür `--w-turquoise-text`.
- Orange nie als Fliesstext, nie als Fläche, nie neben Türkis als gleichwertige zweite Fläche.
- Kein Farbverlauf, keine Schlagschatten auf Farbflächen. Karten werden durch Haarlinien getrennt, nicht durch Schatten.

## Typografie

- **Roboto** für alles, eingebettet als woff2 (`web/public/fonts/`): Light 300, Regular 400, Medium 500.
  Bold 700 nur für Display-Zahlen (Total). Fallback: `Arial, Helvetica, sans-serif`.
- Grundgrösse 15 px, Zeilenhöhe 1.5. Links-bündig. Keine Kursive, keine Versalien-Labels mit Letterspacing.
- **Headline-Pattern** (jede Seite oben links):
  ```
  Neuer Vorgang          ← Zeile 1: Roboto Light 24 px, #808080
  Zahlung erfassen       ← Zeile 2: Roboto Medium 24 px, #000000
  ```
  Beide Zeilen gleich gross; Hierarchie über Gewicht und Farbe, nicht Grösse.

| Rolle | Gewicht | Grösse | Farbe |
|---|---|---|---|
| Headline Zeile 1 / 2 | Light / Medium | 24 px | `#808080` / `#000` |
| Abschnittstitel | Medium | 17 px | `#000` |
| Fliesstext, Formulare | Regular | 15 px | `#333` |
| Labels, Tabellenkopf | Regular | 13 px | `#808080` |
| Fussnoten, Statuszeile | Light | 12 px | `#808080` |
| Total (Display) | Medium/Bold | 32–40 px | `#000` (auf Türkis ebenfalls Schwarz) |
| Statement auf Türkis-Fläche | Regular | 20–24 px | `#000` |

## Logo

- Assets in `assets/brand/` (→ nach `web/src/assets/` kopieren): `wallee_logo_turquoise.svg` (auf Weiss),
  `wallee_logo_white.svg` (auf Türkis), `wallee_logo_black.svg`.
- Platzierung: **oben rechts im Header**, Höhe 22 px, Schutzraum rundum ≥ Höhe des «w» (≈ 22 px).
- Nicht verzerren, nicht umfärben, keine Effekte. Kein Logo im Footer. Die Wortmarke wird nie als Text
  gesetzt (Logo-Schrift LL Brown ist nicht verfügbar) — immer das SVG.
- Setup-/Leerzustände dürfen die weisse Wortmarke gross auf einer Voll-Türkis-Fläche zeigen, Claim
  `#homeofpayment` darunter in Roboto Light, schwarz.
- Favicon/App-Icon: «w»-Monogramm türkis auf Weiss (aus dem SVG ableiten, 32/180/512 px).

## Abstände & Raster

- Basis 8 px: `--s-1: 8px … --s-6: 48px`. Seitenrand 40 px (Desktop), 20 px (< 900 px).
- Inhalt max. 1120 px. Split-Layout 5/7 (Türkis-Panel 5 Spalten) oder 1/1 im Setup.
- Radius: 4 px für Inputs/Buttons, 8 px für Karten. Nichts Pillenförmiges ausser Status-Badges (12 px).
- Haarlinie 1 px `#D9D9D9` als Trenner zwischen Spalten und Tabellenzeilen — bevorzugtes Stilmittel statt Kartenrahmen.

## Komponenten-Look

- **Primärbutton:** Schwarz `#000`, weisser Text, 44 px hoch, 4 px Radius, Roboto Medium 15 px. Hover
  `#333`. Auf Türkis-Fläche: Weiss mit schwarzem Text. Grosse Aktion (Zahlungsseite öffnen): 52 px hoch, volle Breite.
- **Sekundärbutton:** transparent, 1 px `#D9D9D9`, Text `#000`; Hover Hintergrund `#F7F7F7`.
- **Textbutton/Link:** `--w-turquoise-text`, keine Unterstreichung, Hover unterstrichen.
- **Destruktiv:** Textbutton in `--w-orange`; nie ein orange gefüllter Button.
- **Input:** 44 px, 1 px `#D9D9D9`, Radius 4, Fokus: 2 px Türkis-Ring (`box-shadow 0 0 0 2px #11D9CC`), Label
  13 px grau darüber. Fehler: Rahmen Orange + Text 13 px Orange darunter.
- **Tabelle:** Kopf 13 px grau, Zeilen 48 px, Haarlinien, Hover `#CFF7F4`. Beträge rechtsbündig, tabellarische Ziffern
  (`font-variant-numeric: tabular-nums`), Format `1'234.50` (Schweizer Apostroph), Währung als Spaltenkopf.
- **Status-Badge:** 12 px Radius, 12 px Text Medium, Hintergrund Tint: Bezahlt/Autorisiert `#CFF7F4` + Text `#0B8F87`;
  Offen `#F0F0F0` + `#333`; Fehlgeschlagen `#FFE4D9` + `#B33600`; Storniert `#F0F0F0` + `#808080`.
- **Stepper:** Kreise 28 px, Nummer Medium; aktiv Türkis-Kreis/schwarze Zahl, erledigt schwarz/weisser Haken,
  offen `#D9D9D9`/grau; verbunden mit Haarlinie.
- **Türkis-Panel (Split):** Fläche `#11D9CC`, Innenabstand 40 px, Text Schwarz, weisse Wortmarke nur, wenn das Panel
  den ganzen Screen füllt (Setup). Buttons darauf Weiss.
- **Toast:** unten rechts, Weiss, Haarlinie, links 3 px Türkis-Balken (Erfolg) oder Orange (Fehler).
- **Icons:** minimal, 1.5 px Linien, monochrom schwarz/grau (eigenes kleines Set als SVG-Sprite: Suche, Plus, Kopieren,
  Externer Link, Haken, Schliessen, Warnung, Download, Aktualisieren). Keine Emojis, keine farbigen Icon-Sets.

## Was ausdrücklich nicht wallee ist

Gradient-Buttons, Glassmorphism, Neon-Schatten, lila/blaue Akzente, Dark-Mode-Standard, runde Pillen-Buttons,
fette Versalien-Headlines, Emojis in der UI, dekorative Illustrationen, Bewegungseffekte über 200 ms.
Dark Mode wird **nicht** umgesetzt (Marke ist weiss/türkis).

## CSS-Tokens (`web/src/styles/tokens.css`)

```css
:root {
  --w-turquoise: #11D9CC; --w-turquoise-80: #41E1D6; --w-turquoise-60: #58E3DA;
  --w-turquoise-40: #9CEDE7; --w-turquoise-20: #CFF7F4; --w-turquoise-text: #0B8F87;
  --w-turquoise-deep: #0E6B66; --w-orange: #FF4D00; --w-orange-soft: #FFE4D9; --w-orange-text: #B33600;
  --w-black: #000; --w-text: #333; --w-text-muted: #808080; --w-line: #D9D9D9; --w-grid: #E6E6E6;
  --w-bg: #fff; --w-bg-soft: #F7F7F7;
  --font: 'Roboto', Arial, Helvetica, sans-serif;
  --fs-base: 15px; --lh: 1.5;
  --s-1: 8px; --s-2: 16px; --s-3: 24px; --s-4: 32px; --s-5: 40px; --s-6: 48px;
  --r-sm: 4px; --r-md: 8px; --r-pill: 12px;
  --control-h: 44px; --control-h-lg: 52px; --header-h: 64px; --content-max: 1120px;
  --focus: 0 0 0 2px var(--w-turquoise);
}
```
