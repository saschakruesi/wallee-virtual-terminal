# Desktop-Paketierung: App-Bundle, Icons, fensterloser Helper (Release 1.3.0)

Stand: 2026-09-21. Freigegeben durch den Product Owner am 2026-09-21.

## Ziel

Der Virtual Terminal soll auf macOS und Windows wie ein normales Programm aussehen und sich so verhalten:
eigenes Icon im Finder/Explorer, ein Download pro Plattform, Doppelklick öffnet nur den Browser, kein
Konsolenfenster. Die Gatekeeper-/SmartScreen-Hürde wird ohne Zertifikat auf das Minimum reduziert und der
Release-Workflow so vorbereitet, dass Signatur und Notarisierung später nur noch per Secrets eingeschaltet
werden.

Nicht Ziel: Zertifikate beschaffen (Entscheid wallee), Installer (`.pkg`, `.msi`), Tray-Icon, Auto-Start.

## Auslieferung

Pro Release drei Dateien:

| Datei | Inhalt |
|---|---|
| `wallee-virtual-terminal-macos.zip` | `wallee Virtual Terminal.app` mit Universal-Binary (arm64 + amd64), Icon, `Info.plist` |
| `wallee-virtual-terminal-windows.exe` | wie heute, neu mit Icon, Versionsinfo, Manifest, ohne Konsolenfenster |
| `SHA256SUMS.txt` | Prüfsummen der beiden Dateien |

Die bisherigen nackten Mac-Binaries (`-macos-apple-silicon`, `-macos-intel`) entfallen. Der Updater von
1.2.0 meldet dafür «no-asset» mit Link auf die Release-Seite; Mac-Nutzer von 1.2.0 laden einmalig manuell
(steht in den Release-Notes und im Changelog).

### macOS-Bundle

```
wallee Virtual Terminal.app/
  Contents/
    Info.plist
    PkgInfo                      "APPL????"
    MacOS/wallee-virtual-terminal   Universal-Binary
    Resources/wallee.icns
```

`Info.plist`: `CFBundleName`/`CFBundleDisplayName` «wallee Virtual Terminal», `CFBundleIdentifier`
`com.wallee.virtual-terminal`, `CFBundleExecutable`, `CFBundleIconFile`, `CFBundlePackageType APPL`,
`CFBundleShortVersionString`/`CFBundleVersion` aus dem Tag (ohne «v»), `LSMinimumSystemVersion 11.0`,
`LSUIElement true` (kein Dock-Symbol, kein Terminal), `NSHighResolutionCapable true`.

Das Universal-Binary entsteht ohne `lipo` mit `github.com/randall77/makefat` (reines Go, `go run` mit
gepinnter Version), das Bundle wird als Ordner zusammengesetzt und mit `zip -r` gezippt; Unix-Rechte bleiben
erhalten, deshalb entfällt der bisherige `chmod +x`-Hinweis. Die arm64-Scheibe trägt die Ad-hoc-Signatur
des Go-Linkers (Pflicht auf Apple Silicon), das Bundle selbst ist ohne Secrets unsigniert.

### Windows-Binary

`go-winres` (`github.com/tc-hib/go-winres`, gepinnt) erzeugt aus `helper/winres/winres.json` und den
Icon-PNGs vor dem Build `helper/rsrc_windows_amd64.syso` (gitignored). Inhalt: Icon (alle Grössen), Versionsinfo
(`ProductName` «wallee Virtual Terminal», `FileDescription`, `CompanyName` «wallee AG», `LegalCopyright`,
`ProductVersion`/`FileVersion` aus dem Tag), Manifest (`asInvoker`, DPI-aware). Der Linker nimmt die
`.syso` automatisch. Zusätzlich `-ldflags "-H windowsgui"`, damit kein Konsolenfenster erscheint.

### Icons

Quelle `assets/icon/icon.svg`: weisse Kachel mit abgerundeten Ecken (macOS-Radius ≈ 22.4 % der Kante),
darauf das «w»-Monogramm in Türkis `#11D9CC` aus `web/public/favicon.svg`, gemäss `docs/04-design-system.md`
(«Favicon/App-Icon: w-Monogramm türkis auf Weiss»). Rundum ≈ 10 % transparenter Rand wie bei macOS-Icons üblich.

Erzeugte, committete Dateien in `assets/icon/`: `png/icon-{16,32,64,128,256,512,1024}.png`, `wallee.icns`.
Skript `scripts/make-icons.sh` (macOS: Rendering + `sips` + `iconutil`) dokumentiert die Erzeugung. Die `.ico`
baut `go-winres` aus den PNGs. Das Web-Favicon bleibt unverändert.

## Verhalten des Helpers ohne Fenster

- **Beenden:** `POST /quit`, gleiche Origin-Prüfung wie `/update/*` (Origin/Referer muss `allowedOrigins`
  entsprechen, sonst 403). Antwort `204`, danach `server.Shutdown` mit 3 s Timeout und `os.Exit(0)`.
  Frontend: Menüpunkt «Beenden» im Header rechts (neben Space-Wechsler und Einstellungen), Bestätigung im
  Browser (`confirm`-Dialog reicht nicht, eigener kleiner Dialog im wallee-Look mit «Abbrechen»/«Beenden»).
  Nach Erfolg zeigt die Seite den Vollbild-Zustand «Der wallee Virtual Terminal ist beendet. Zum Starten
  Doppelklick auf das Programm.» ohne Navigation.
- **Zweiter Doppelklick (Single Instance):** Schlägt `net.Listen` auf dem Wunschport fehl, fragt der Helper
  `GET http://127.0.0.1:<port>/update/version` mit 1 s Timeout ab. Antwortet JSON mit Feld `version`,
  öffnet er nur den Browser auf diese Instanz und beendet sich mit Exit-Code 0. Sonst weicht er wie heute auf
  den nächsten freien Port aus. Der Restart-Pfad nach einem Update (`WVT_RESTART_PORT`) bleibt unverändert.
- **Kein Auto-Beenden** beim Schliessen des Tabs. Der Prozess läuft bis «Beenden» oder Neustart des
  Rechners; der nächste Doppelklick öffnet den Browser auf die laufende Instanz.
- **Fehler ohne Konsole:** Startfehler (kein freier Port, Serverfehler) werden zusätzlich als Dialog gezeigt:
  Windows `user32.MessageBoxW` via `syscall` (kein CGO), macOS `osascript -e 'display alert …'`. Logs gehen
  weiterhin nur an stderr (sichtbar bei Start aus einem Terminal). Es wird keine Datei geschrieben.

## Self-Update mit Bundle

- Windows: unverändert (Datei ersetzen, neu starten).
- macOS: `assetName()` liefert `wallee-virtual-terminal-macos.zip`. Ablauf: Zip herunterladen, Prüfsumme
  gegen `SHA256SUMS.txt`, entpacken mit `archive/zip` (Unix-Modus aus dem Eintrag übernehmen, Pfade
  gegen Zip-Slip prüfen) in `<Eltern des Bundles>/.wallee-virtual-terminal.update/`. Dann
  `X.app` → `X.app.old` umbenennen, neues Bundle → `X.app`, `execReplace` auf das neue Binary
  (`Contents/MacOS/wallee-virtual-terminal`). `cleanupOldBinary()` räumt beim nächsten Start neben der alten
  Datei auch `*.app.old` weg.
- Bundle-Erkennung: `os.Executable()` liegt in `…/<Name>.app/Contents/MacOS/`; sonst (Entwicklung, nacktes
  Binary) wird nur das Binary aus dem Zip extrahiert und wie heute ersetzt.
- Das ganze Bundle wird getauscht, damit eine spätere Signatur/Notarisierung von wallee gültig bleibt.

## Release-Workflow und Makefile

`release.yml` (Linux-Runner): Frontend bauen → `go-winres make` → drei `go build` (darwin/arm64, darwin/amd64,
windows/amd64 mit `-H windowsgui`) → `makefat` → Bundle aus `helper/bundle/Info.plist`-Vorlage (Version
eingesetzt) + `assets/icon/wallee.icns` → `zip -r` → `SHA256SUMS.txt`.

Optionale Signatur (macOS-Runner, `MACOS_SIGNING_ENABLED`): Zip entpacken, `codesign --deep --options runtime
--timestamp` auf das Bundle, Zip für `notarytool submit --wait`, `xcrun stapler staple` auf das Bundle,
Bundle neu zippen, Prüfsummen neu. Windows-Signatur bleibt beim PFX-Schritt (`osslsigncode`), mit Kommentar
zu Azure Artifact Signing als Alternative.

`helper/Makefile`: `release` macht dasselbe lokal (braucht `zip`, kein `lipo`); `build` bleibt für den
Entwickler-Binary ohne Bundle. `.gitignore` ergänzt `helper/*.syso`.

## Dokumentation

- `README.md`: Download-Abschnitt neu (ein Mac-Zip, ein Windows-Exe), erster Start auf macOS 15 und neuer
  («Trotzdem öffnen» in den Systemeinstellungen; Rechtsklick → Öffnen funktioniert dort nicht mehr), Windows
  SmartScreen, «Beenden» statt Fenster schliessen, Hinweis für Mac-Nutzer von 1.2.0.
- `docs/01-architektur.md`: Build & Release aktualisieren, neuer Abschnitt «Was wallee für Signaturen
  braucht» (Apple Developer Program als Organisation mit D-U-N-S, Developer ID Application, App-Passwort;
  Windows OV-Zertifikat oder Azure Artifact Signing, EV bringt seit 2024 keinen Vorteil).
- `docs/05-implementationsplan.md`: Phase 8 «Desktop-Paketierung» mit DoD. `CHANGELOG.md` unter Unreleased.

## Tests

Go (helper): Bundle-Pfad-Erkennung (`bundleDir`), Zip-Entpacken mit Ausführ-Rechten und Zip-Slip-Abwehr,
Single-Instance-Erkennung (Testserver antwortet mit/ohne `version`), `/quit` mit gültiger/ungültiger Origin,
`assetName` pro Plattform. Frontend (Vitest): Beenden-Dialog ruft `/quit` und zeigt den End-Zustand.

Manuell auf diesem Mac: `make release`-Äquivalent lokal ausführen, Zip entpacken, Doppelklick → Gatekeeper →
«Trotzdem öffnen» → Browser öffnet, «Beenden», zweiter Doppelklick bei laufender Instanz, Update-Simulation
gegen einen lokalen Release-Mirror. Windows: PE-Datei auf `.rsrc`-Sektion, Icon und GUI-Subsystem prüfen
(`debug/pe`), ausführen ist hier nicht möglich.

## Definition of Done

- Tag `v1.3.0` erzeugt Release mit `…-macos.zip`, `…-windows.exe`, `SHA256SUMS.txt`.
- Mac: Zip laden, entpacken, App mit Icon, Start ohne Terminal, «Beenden» funktioniert, Update-Pfad getestet.
- Windows: Exe zeigt Icon und Versionsinfo im Explorer, startet ohne Konsole.
- README, Architektur-Doku, Changelog aktuell; `npm run build`, `go vet`, `go test`, Vitest grün.
