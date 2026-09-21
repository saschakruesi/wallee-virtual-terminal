# Desktop-Paketierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release 1.3.0 liefert ein macOS-App-Bundle (Universal, Icon, kein Terminal) als Zip und eine Windows-Exe mit Icon und ohne Konsole; der Helper bekommt «Beenden», Single-Instance und Bundle-fähiges Self-Update.

**Architecture:** Der Go-Helper bleibt «dumm»; neu sind drei kleine Dateien (`quit.go`, `instance.go`, `bundle.go`) plus Plattform-Dialoge. Paketierung passiert in `scripts/` und wird von Makefile und `release.yml` gleich aufgerufen. Icons werden einmalig erzeugt und committet.

**Tech Stack:** Go 1.22 (stdlib only zur Laufzeit), Build-Zeit: `github.com/tc-hib/go-winres@v0.3.3`, `github.com/randall77/makefat@v0.0.0-20260406194835-1b91746796b7`, `zip`, macOS `qlmanage`/`sips`/`iconutil` für Icons. Frontend Vite/React/TS, Vitest.

## Global Constraints

- Kein CGO (`CGO_ENABLED=0`), keine Laufzeit-Abhängigkeiten im Helper.
- Helper schreibt keine Dateien ausser beim Update; keine Logs in Dateien, keine Credentials in Logs.
- UI-Texte nur über i18n (`de`, `en`), Schweizer Rechtschreibung («ss»).
- Code, Kommentare, Commits Englisch. Commit-Trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Design: keine Emojis, wallee-Look (Türkis als Fläche, Text schwarz), Icons monochrom.
- Auf dieser Maschine: `export PATH=/Library/Developer/CommandLineTools/usr/bin:$HOME/sdk/go/bin:$PATH`; `make` ist nicht nutzbar (Xcode-Lizenz), Makefile-Ziele von Hand ausführen. Vitest aus einem Spiegel im Scratchpad laufen lassen, falls es im Projektpfad scheitert (siehe Memory).
- Asset-Namen: `wallee-virtual-terminal-macos.zip`, `wallee-virtual-terminal-windows.exe`, `SHA256SUMS.txt`. Bundle-Name `wallee Virtual Terminal.app`, Bundle-ID `com.wallee.virtual-terminal`.

---

### Task 1: Icon-Quellen und generierte Icons

**Files:**
- Create: `assets/icon/icon.svg`, `scripts/make-icons.sh`, `assets/icon/png/icon-{16,32,64,128,256,512,1024}.png`, `assets/icon/wallee.icns`

**Interfaces:**
- Produces: `assets/icon/png/icon-*.png` (von Task 2 und Task 6 verwendet), `assets/icon/wallee.icns` (Task 6).

- [ ] **Step 1: SVG schreiben.** Weisse Kachel 824 px in 1024er-Viewbox (10 % Rand), Radius 185 (≈ 22.4 %), darauf der «w»-Pfad aus `web/public/favicon.svg` (der Pfad beginnt bei `M154.6,136.2` und endet bei `Z` vor `"`), zentriert und skaliert. Das «w» hat in der Favicon-Viewbox die Breite 164.5 (x 0…164.5) und Höhe ≈ 100.4 (y 51.7…152.1). Zielbreite 560 px → Faktor 3.404; Translation so, dass der Pfad bei x = 232, y ≈ 341 beginnt.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="100" y="100" width="824" height="824" rx="185" fill="#FFFFFF"/>
  <g transform="translate(232 341) scale(3.404)" fill="#11D9CC">
    <path d="M154.6,136.2C160.8,128.5 … Z" transform="translate(0 -51.7)"/>
  </g>
</svg>
```

- [ ] **Step 2: Skript `scripts/make-icons.sh`** (macOS only, `set -euo pipefail`): rendert mit `qlmanage -t -s 1024 -o <tmp> icon.svg`, skaliert mit `sips -z N N` auf 16…1024 nach `assets/icon/png/`, baut `icon.iconset/` mit den Apple-Namen (`icon_16x16.png`, `icon_16x16@2x.png` = 32, … `icon_512x512@2x.png` = 1024) und ruft `iconutil -c icns icon.iconset -o assets/icon/wallee.icns`.
- [ ] **Step 3: Skript ausführen, PNGs sichten** (Read-Tool auf `icon-256.png` und `icon-32.png`: Kachel weiss, «w» türkis, Rand transparent).
- [ ] **Step 4: Commit** `Add app icon sources and generated icns/png`.

### Task 2: Windows-Ressourcen (Icon, Versionsinfo, Manifest, kein Konsolenfenster)

**Files:**
- Create: `helper/winres/winres.json`
- Modify: `.gitignore` (+`helper/*.syso`), `helper/Makefile` (Ziel `winres`, `-H windowsgui` im Windows-Build)

**Interfaces:**
- Produces: `make winres` erzeugt `helper/rsrc_windows_amd64.syso`; `release.yml` (Task 7) ruft dasselbe Kommando.

- [ ] **Step 1: `winres.json`** mit `RT_GROUP_ICON` → `#/assets/icon/png/icon-256.png` (go-winres skaliert selbst), `RT_MANIFEST` (`identity` Name `wallee-virtual-terminal`, `execution-level asInvoker`, `dpi-awareness per monitor v2`), `RT_VERSION` (ProductName «wallee Virtual Terminal», FileDescription gleich, CompanyName «wallee AG», LegalCopyright «© wallee AG», OriginalFilename `wallee-virtual-terminal-windows.exe`, InternalName `wallee-virtual-terminal`). Pfade relativ zu `helper/` (`../assets/icon/png/icon-256.png`).
- [ ] **Step 2: Makefile:** `WINRES := go run github.com/tc-hib/go-winres@v0.3.3`; Ziel `winres:` → `$(WINRES) make --in winres/winres.json --arch amd64 --product-version $(VERSION_PLAIN) --file-version $(VERSION_PLAIN)` mit `VERSION_PLAIN := $(patsubst v%,%,$(VERSION))`; Windows-Build in `release` bekommt `-ldflags "$(LDFLAGS) -H windowsgui"` und hängt von `winres` ab. `clean` löscht `*.syso`.
- [ ] **Step 3: Lokal prüfen:** `cd helper && go run github.com/tc-hib/go-winres@v0.3.3 make --in winres/winres.json --arch amd64 --product-version 1.3.0 --file-version 1.3.0` → `rsrc_windows_amd64.syso` existiert; `GOOS=windows GOARCH=amd64 go build -ldflags "-s -w -H windowsgui" -o /tmp/x.exe .` läuft. Mit einem 10-Zeilen-Go-Check (`debug/pe`) im Scratchpad: Sektion `.rsrc` vorhanden, `OptionalHeader.Subsystem == 2` (GUI).
- [ ] **Step 4: Commit** `Embed icon, version info and manifest into the Windows binary`.

### Task 3: Helper `POST /quit`

**Files:**
- Create: `helper/quit.go`, `helper/quit_test.go`
- Modify: `helper/main.go` (Registrierung, Shutdown über Kanal)

**Interfaces:**
- Produces: `func newQuitHandler(allowedOrigins map[string]bool, quit chan<- struct{}) http.HandlerFunc`; `main` wartet auf `stop` (Signal) **oder** `quit`.

- [ ] **Step 1: Test** `TestQuitEndpointEnforcesOriginAndMethodAndSignals`: GET → 405; POST mit `Origin: http://evil` → 403 und Kanal leer; POST mit erlaubter Origin → 204 und Kanal erhält genau ein Signal (non-blocking select mit 1 s Timeout).
- [ ] **Step 2: Implementierung:** Handler prüft `originAllowed`, Methode, setzt `Cache-Control: no-store`, antwortet 204, sendet non-blocking auf `quit`.
- [ ] **Step 3: main.go:** `quit := make(chan struct{}, 1)`; `mux.HandleFunc("/quit", newQuitHandler(originsSet, quit))`; Warte-Schleife `select { case <-stop: case <-quit: }`. Die Origin-Map aus `allowedOrigins` in eine kleine Hilfsfunktion `originSet(list []string) map[string]bool` ziehen (auch von `newUpdater` genutzt).
- [ ] **Step 4:** `go vet ./... && go test ./...` grün. **Commit** `Add /quit endpoint so the windowless helper can be stopped from the UI`.

### Task 4: Single Instance und Fehlerdialoge

**Files:**
- Create: `helper/instance.go`, `helper/instance_test.go`, `helper/alert_windows.go`, `helper/alert_other.go`
- Modify: `helper/main.go`

**Interfaces:**
- Produces: `func runningInstance(port int, timeout time.Duration) bool` (true, wenn `GET http://127.0.0.1:<port>/update/version` JSON mit String-Feld `version` liefert); `func showAlert(title, text string)` (Windows MessageBoxW via `syscall.NewLazyDLL("user32.dll")`, sonst `osascript` auf darwin, no-op sonst); `func fatal(msg string)` = log + showAlert + `os.Exit(1)`.

- [ ] **Step 1: Test** `TestRunningInstanceDetectsHelper`: httptest-Server antwortet `{"version":"v1.2.0"}` → true; Server antwortet `text/html` → false; geschlossener Port → false. Da `runningInstance` die URL aus dem Port baut, Signatur `runningInstanceAt(base string, timeout)` testen und `runningInstance(port, …)` als dünner Wrapper.
- [ ] **Step 2: Implementierung** mit `http.Client{Timeout}`, `io.LimitReader` 4 KiB, `json.Unmarshal` in `struct{ Version string }`.
- [ ] **Step 3: main.go:** Vor `listenOnFreePort`, nur wenn kein `WVT_RESTART_PORT` gesetzt ist: `net.Listen` auf Wunschport probieren; scheitert es und `runningInstance(port, time.Second)` → `openBrowser(origin)` (ausser `-no-browser`), `return`. Sonst normal weiter (Listener wieder schliessen, dann `listenOnFreePort`). Beide `log.Fatalf` in `main` durch `fatal(...)` ersetzen.
- [ ] **Step 4:** Tests grün, `GOOS=windows go vet ./...` grün. **Commit** `Reuse a running instance on second launch and show start-up errors as dialogs`.

### Task 5: Bundle-fähiges Self-Update (macOS)

**Files:**
- Create: `helper/bundle.go`, `helper/bundle_test.go`
- Modify: `helper/update.go` (`assetName`, `run`, `cleanupOldBinary`), `helper/update_test.go` (bestehender Run-Test bleibt für Windows/Bare-Pfad)

**Interfaces:**
- Produces: `func bundleDir(exe string) (string, bool)` — liefert `…/X.app`, wenn `exe` = `…/X.app/Contents/MacOS/<name>`; `func extractZip(src, destDir string) error` (Unix-Modus übernehmen, Zip-Slip abwehren, `destDir` vorher leer); `func findBundle(dir string) (string, error)` — erstes `*.app` in `dir`; `func installBundle(newApp, currentApp string) error` (Rename current → `current+".old"`, new → current, Rollback bei Fehler); `func executableInBundle(app string) (string, error)` liest `CFBundleExecutable` nicht, sondern nimmt den einzigen Eintrag in `Contents/MacOS`.

- [ ] **Step 1: Tests** in `bundle_test.go`: `TestBundleDir` (Bundle-Pfad → ok; nackter Pfad → false; Windows-Pfad-Trennung via `filepath.Join`), `TestExtractZipPreservesModeAndRejectsTraversal` (Zip in-memory mit `archive/zip`: Datei `A.app/Contents/MacOS/bin` Modus 0755 → nach Extraktion ausführbar; Eintrag `../evil` → Fehler, nichts geschrieben), `TestInstallBundleSwapsAndRollsBack`.
- [ ] **Step 2: Implementierung** `bundle.go`.
- [ ] **Step 3: update.go:** `assetName()` darwin (beide Archs) → `wallee-virtual-terminal-macos.zip`. In `run`: nach Verifikation, wenn `runtime.GOOS == "darwin"`: `stage := filepath.Join(parent, ".wallee-virtual-terminal.update")` mit `parent` = Eltern des Bundles (bzw. `dir` bei nacktem Binary); `extractZip`; `newApp := findBundle(stage)`; falls Bundle: `installBundle(newApp, app)`, `exe = executableInBundle(app)`; falls nackt: `installBinary(executableInBundle(newApp), exe)`; `os.RemoveAll(stage)`. `cleanupOldBinary` entfernt zusätzlich `<bundle>.old` (RemoveAll).
- [ ] **Step 4: Test** `TestRunInstallsBundleFromZip` (nur `runtime.GOOS == "darwin"`, sonst `t.Skip`): Testserver liefert Zip mit `wallee Virtual Terminal.app/Contents/MacOS/wallee-virtual-terminal` (0755) + `Info.plist`; Updater mit gefälschtem `exe` innerhalb eines Temp-Bundles (`exeFn`-Hook einführen: `u.exePath func() (string, error)` default `os.Executable`) und `restartFn`-Stub; Erwartung: neues Bundle am Platz, `.old` existiert, restart mit neuem Exe-Pfad aufgerufen.
- [ ] **Step 5:** `go test ./...` grün. **Commit** `Update the macOS app bundle as a whole from the zip release asset`.

### Task 6: Bundle-Vorlage, Paketier-Skript, Makefile

**Files:**
- Create: `helper/bundle/Info.plist` (Platzhalter `__VERSION__`), `scripts/make-bundle.sh`
- Modify: `helper/Makefile` (`release`)

**Interfaces:**
- Produces: `scripts/make-bundle.sh <arm64-binary> <amd64-binary> <version> <outdir>` → `<outdir>/wallee-virtual-terminal-macos.zip`; benutzt `go run github.com/randall77/makefat@v0.0.0-20260406194835-1b91746796b7`.

- [ ] **Step 1: Info.plist** mit den Schlüsseln aus der Spec (`LSUIElement` true, `CFBundleShortVersionString`/`CFBundleVersion` = `__VERSION__`).
- [ ] **Step 2: Skript:** baut `<outdir>/wallee Virtual Terminal.app/Contents/{MacOS,Resources}`, `makefat` → `MacOS/wallee-virtual-terminal`, `chmod 755`, `sed` Version in `Info.plist`, `printf 'APPL????' > PkgInfo`, `cp assets/icon/wallee.icns Resources/`, dann `(cd outdir && rm -f zip && zip -r -y -X wallee-virtual-terminal-macos.zip "wallee Virtual Terminal.app")` und `rm -rf` des Ordners.
- [ ] **Step 3: Makefile `release`:** arm64/amd64 nach `$(RELEASE_DIR)/tmp/`, Windows mit `winres` + `-H windowsgui`, dann `../scripts/make-bundle.sh … $(VERSION_PLAIN) $(RELEASE_DIR)`, `rm -rf tmp`, `shasum`.
- [ ] **Step 4: Lokal ausführen** (Kommandos von Hand, da `make` blockiert): Frontend-Build muss in `helper/dist` liegen. Ergebnis prüfen: `unzip -l`, entpacken, `codesign -dv --verbose=2` auf das Binary (ad-hoc Signatur der arm64-Scheibe), `file` zeigt «Mach-O universal binary», Bundle per `open` starten → Browser öffnet, `/update/version` antwortet; `POST /quit` mit curl-Origin beendet.
- [ ] **Step 5: Commit** `Package the macOS build as a universal app bundle`.

### Task 7: Release-Workflow

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Build-Job:** Node-Build wie bisher; `go run github.com/tc-hib/go-winres@v0.3.3 make …` in `helper/`; drei `go build`; `scripts/make-bundle.sh`; `sha256sum` nur über die beiden Assets. Windows-Signaturschritt unverändert (PFX), mit Kommentar «alternative: Azure Artifact Signing (Windows runner + azure/artifact-signing action)».
- [ ] **Step 2: sign-macos-Job:** Zip entpacken, `codesign --force --deep --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "wallee Virtual Terminal.app"`, `ditto -c -k --keepParent app notarize.zip`, `notarytool submit --wait`, `xcrun stapler staple app`, `ditto -c -k --keepParent` → `wallee-virtual-terminal-macos.zip`, Prüfsummen neu.
- [ ] **Step 3:** YAML mit `node -e` oder `ruby -ryaml` auf Syntax prüfen. **Commit** `Build the app bundle and Windows resources in the release workflow`.

### Task 8: Frontend «Beenden»

**Files:**
- Create: `web/src/app/QuitControl.tsx`, `web/src/app/QuitControl.test.tsx`
- Modify: `web/src/api/update.ts` (`quitHelper()`), `web/src/app/Layout.tsx`, `web/src/i18n/de.json`, `web/src/i18n/en.json`, `web/src/components/Icon.tsx` (Icon `power`), `web/src/styles/base.css`

**Interfaces:**
- Produces: `export function quitHelper(): Promise<void>` (POST `/quit`, 204); `QuitControl` rendert Icon-Button «Beenden» → `ConfirmDialog` → nach Erfolg ersetzt ein Vollbild-`<div className="quit-screen">` die App (via State im `Layout`: `QuitControl` bekommt `onQuit`).

- [ ] **Step 1: Test:** Klick auf Button «Beenden» öffnet Dialog; Bestätigen ruft `fetch('/quit', {method:'POST'})` (globales `fetch` mocken) und ruft `onQuit`; Fehler zeigt Toast-Text `quit.failed` und lässt Dialog offen.
- [ ] **Step 2: i18n:** `header.quit` «Beenden»/«Quit», `quit.confirmTitle` «wallee Virtual Terminal beenden?», `quit.confirmMessage` «Das Programm wird beendet. Zum erneuten Starten Doppelklick auf das Programm. Laufende Zahlungen bleiben in wallee erhalten.», `quit.failed` «Beenden fehlgeschlagen. Das Programm läuft weiter.», `quit.doneTitle` «Der wallee Virtual Terminal ist beendet.», `quit.doneText` «Dieses Fenster kann geschlossen werden. Zum Starten Doppelklick auf das Programm.» (EN entsprechend).
- [ ] **Step 3: Implementierung** + Layout: `const [quit, setQuit] = useState(false)`; wenn `quit`, nur `<div className="quit-screen">` mit Wortmarke, Titel, Text rendern. Button-Icon `power` (Kreis mit Strich, 1.5 px) ins Icon-Set.
- [ ] **Step 4:** Lint, Vitest, `npm run build` grün. **Commit** `Add a quit action to the header for the windowless helper`.

### Task 9: Dokumentation

**Files:**
- Modify: `README.md`, `docs/01-architektur.md`, `docs/05-implementationsplan.md`, `CHANGELOG.md`

- [ ] **Step 1: README «Download & Start»** neu: zwei Downloads; macOS: Zip entpacken (Doppelklick), App nach «Programme» ziehen (optional), erster Start: Dialog «kann nicht geöffnet werden» → Systemeinstellungen → Datenschutz & Sicherheit → «Trotzdem öffnen» (einmalig; Rechtsklick → Öffnen funktioniert seit macOS 15 nicht mehr); Windows: SmartScreen «Weitere Informationen → Trotzdem ausführen»; kein Fenster mehr, Beenden über das Symbol oben rechts; Hinweis für Mac-Nutzer von 1.2.0 (einmalig manuell laden); `chmod`-Absatz entfernen.
- [ ] **Step 2: Architektur:** Build & Release-Abschnitt auf Bundle/Skripte/Assets umstellen; Abschnitt «Signing / Gatekeeper» durch «Was wallee für Signaturen braucht» ersetzen (Apple Developer Program als Organisation, D-U-N-S, Developer ID Application, App-Passwort/Team-ID, Secrets-Namen; Windows OV oder Azure Artifact Signing, EV seit 2024 ohne Vorteil, Secrets-Namen); Helper-Endpunkt `/quit` und Single-Instance dokumentieren.
- [ ] **Step 3: Implementationsplan:** Phase 8 «Desktop-Paketierung» mit Inhalt und DoD aus der Spec; offener Punkt 1 (Code-Signing) auf den neuen Abschnitt verweisen. **Changelog** unter Unreleased: Added (App-Bundle, Icons, Beenden, Single Instance), Changed (kein Konsolenfenster, ein Mac-Download, Update tauscht Bundle), Notes (1.2.0-Mac-Nutzer).
- [ ] **Step 4: Commit** `Document the app bundle, first launch on macOS 15+ and signing prerequisites`.

### Task 10: Verifikation und PR

- [ ] `cd web && npm run lint && npm test -- --run && npm run build`; `cd helper && go vet ./... && go test ./...`; lokales Release-Paket bauen (Task 6 Step 4) und den manuellen Test aus der Spec durchspielen (Gatekeeper, Beenden, zweiter Doppelklick, Update-Simulation gegen lokalen Mirror mit `-X main.updateRepo` … falls der Updater nur GitHub kennt, Update-Pfad per Unit-Test abdecken und manuell nur Bundle-Swap mit dem Test-Zip prüfen).
- [ ] PR «Desktop packaging: app bundle, icons, windowless helper» gegen `main` mit `~/sdk/gh/bin/gh pr create`, CI abwarten.
