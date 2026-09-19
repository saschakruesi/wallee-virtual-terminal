package main

// Self-update against the GitHub releases of this repository.
//
// Flow (see docs/01-architektur.md «Update»):
//  1. GET  /update/check   → latest release from api.github.com (cached 1 h), compared with `version`.
//  2. POST /update/start   → download the asset for this OS/arch, verify it against SHA256SUMS.txt
//                            of the same release, replace the running executable, restart.
//  3. GET  /update/status  → progress for the banner; GET /update/version → detects the restart.
//
// Safety: only the compiled-in repository is ever contacted, only tags newer than the running
// version are accepted, the checksum must match, and the endpoints obey the same origin check
// as the proxy. Development builds ("dev") never update.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// updateRepo is overridable at build time: -X main.updateRepo=owner/repo
var updateRepo = "saschakruesi/wallee-virtual-terminal"

const (
	githubAPIBase     = "https://api.github.com"
	githubDownload    = "https://github.com"
	checkCacheTTL     = time.Hour
	updateMaxBytes    = 200 << 20 // refuse absurd assets
	restartEnvPort    = "WVT_RESTART_PORT"
	restartBindWindow = 15 * time.Second
)

var semverRe = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)`)

// parseSemver returns major, minor, patch; ok=false for anything that is not a release version.
func parseSemver(v string) (int, int, int, bool) {
	m := semverRe.FindStringSubmatch(strings.TrimSpace(v))
	if m == nil {
		return 0, 0, 0, false
	}
	a, _ := strconv.Atoi(m[1])
	b, _ := strconv.Atoi(m[2])
	c, _ := strconv.Atoi(m[3])
	return a, b, c, true
}

// isNewer reports whether candidate is a higher release than current. Non-release versions
// (e.g. "dev", "v1.2.3-dirty" as current) never yield an update.
func isNewer(candidate, current string) bool {
	ca, cb, cc, ok := parseSemver(candidate)
	if !ok {
		return false
	}
	if strings.Contains(current, "-dirty") {
		return false
	}
	a, b, c, ok := parseSemver(current)
	if !ok {
		return false
	}
	if ca != a {
		return ca > a
	}
	if cb != b {
		return cb > b
	}
	return cc > c
}

// assetName is the release asset for this platform (see helper/Makefile, release.yml).
func assetName() string {
	switch runtime.GOOS + "/" + runtime.GOARCH {
	case "darwin/arm64":
		return "wallee-virtual-terminal-macos-apple-silicon"
	case "darwin/amd64":
		return "wallee-virtual-terminal-macos-intel"
	case "windows/amd64":
		return "wallee-virtual-terminal-windows.exe"
	}
	return ""
}

type releaseAsset struct {
	Name        string `json:"name"`
	DownloadURL string `json:"browser_download_url"`
	Size        int64  `json:"size"`
}

type githubRelease struct {
	TagName     string         `json:"tag_name"`
	HTMLURL     string         `json:"html_url"`
	PublishedAt string         `json:"published_at"`
	Body        string         `json:"body"`
	Draft       bool           `json:"draft"`
	Prerelease  bool           `json:"prerelease"`
	Assets      []releaseAsset `json:"assets"`
}

type checkResponse struct {
	Current         string `json:"current"`
	Latest          string `json:"latest,omitempty"`
	UpdateAvailable bool   `json:"updateAvailable"`
	Reason          string `json:"reason,omitempty"`
	ReleaseURL      string `json:"releaseUrl,omitempty"`
	PublishedAt     string `json:"publishedAt,omitempty"`
	AssetName       string `json:"assetName,omitempty"`
	AssetSize       int64  `json:"assetSize,omitempty"`
	Notes           string `json:"notes,omitempty"`
	Platform        string `json:"platform"`
}

type updateState string

const (
	stateIdle        updateState = "idle"
	stateDownloading updateState = "downloading"
	stateVerifying   updateState = "verifying"
	stateInstalling  updateState = "installing"
	stateRestarting  updateState = "restarting"
	stateError       updateState = "error"
)

type updateStatus struct {
	State    updateState `json:"state"`
	Target   string      `json:"target,omitempty"`
	Received int64       `json:"received"`
	Total    int64       `json:"total"`
	Message  string      `json:"message,omitempty"`
	Current  string      `json:"current"`
}

type updater struct {
	repo      string
	apiBase   string
	dlBase    string
	client    *http.Client
	port      int
	allowed   map[string]bool
	restartFn func(exe string, port int) error

	mu      sync.Mutex
	status  updateStatus
	cache   *githubRelease
	cacheAt time.Time
	running bool
}

func newUpdater(repo string, port int, allowedOrigins []string) *updater {
	origins := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		origins[strings.ToLower(o)] = true
	}
	return &updater{
		repo:      repo,
		apiBase:   githubAPIBase,
		dlBase:    githubDownload,
		client:    &http.Client{Timeout: 5 * time.Minute},
		port:      port,
		allowed:   origins,
		restartFn: restartProcess,
		status:    updateStatus{State: stateIdle, Current: version},
	}
}

func (u *updater) register(mux *http.ServeMux) {
	mux.HandleFunc("/update/check", u.guard(http.MethodGet, u.handleCheck))
	mux.HandleFunc("/update/start", u.guard(http.MethodPost, u.handleStart))
	mux.HandleFunc("/update/status", u.guard(http.MethodGet, u.handleStatus))
	mux.HandleFunc("/update/version", u.guard(http.MethodGet, func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": version})
	}))
}

func (u *updater) guard(method string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !originAllowed(r, u.allowed) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if r.Method != method {
			w.Header().Set("Allow", method)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// latestRelease fetches (or serves from cache) the latest non-draft release.
func (u *updater) latestRelease(ctx context.Context, force bool) (*githubRelease, error) {
	u.mu.Lock()
	if !force && u.cache != nil && time.Since(u.cacheAt) < checkCacheTTL {
		rel := u.cache
		u.mu.Unlock()
		return rel, nil
	}
	u.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.apiBase+"/repos/"+u.repo+"/releases/latest", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "wallee-virtual-terminal/"+version)
	res, err := u.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github responded with %d", res.StatusCode)
	}
	var rel githubRelease
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&rel); err != nil {
		return nil, err
	}
	u.mu.Lock()
	u.cache = &rel
	u.cacheAt = time.Now()
	u.mu.Unlock()
	return &rel, nil
}

func (u *updater) handleCheck(w http.ResponseWriter, r *http.Request) {
	platform := runtime.GOOS + "/" + runtime.GOARCH
	if _, _, _, ok := parseSemver(version); !ok {
		writeJSON(w, http.StatusOK, checkResponse{Current: version, UpdateAvailable: false, Reason: "dev", Platform: platform})
		return
	}
	force := r.URL.Query().Get("force") == "1"
	rel, err := u.latestRelease(r.Context(), force)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, checkResponse{Current: version, UpdateAvailable: false, Reason: "unreachable: " + sanitize(err.Error()), Platform: platform})
		return
	}
	resp := checkResponse{Current: version, Latest: rel.TagName, ReleaseURL: rel.HTMLURL, PublishedAt: rel.PublishedAt, Platform: platform}
	if rel.Draft || rel.Prerelease || !isNewer(rel.TagName, version) {
		resp.Reason = "up-to-date"
		writeJSON(w, http.StatusOK, resp)
		return
	}
	name := assetName()
	for _, a := range rel.Assets {
		if a.Name == name {
			resp.AssetName = a.Name
			resp.AssetSize = a.Size
		}
	}
	if resp.AssetName == "" {
		resp.Reason = "no-asset"
		writeJSON(w, http.StatusOK, resp)
		return
	}
	resp.UpdateAvailable = true
	if len(rel.Body) > 2000 {
		resp.Notes = rel.Body[:2000] + "…"
	} else {
		resp.Notes = rel.Body
	}
	writeJSON(w, http.StatusOK, resp)
}

func (u *updater) handleStatus(w http.ResponseWriter, _ *http.Request) {
	u.mu.Lock()
	s := u.status
	u.mu.Unlock()
	writeJSON(w, http.StatusOK, s)
}

func (u *updater) setStatus(fn func(s *updateStatus)) {
	u.mu.Lock()
	fn(&u.status)
	u.status.Current = version
	u.mu.Unlock()
}

func (u *updater) fail(err error) {
	log.Printf("update failed: %v", err)
	u.setStatus(func(s *updateStatus) {
		s.State = stateError
		s.Message = sanitize(err.Error())
	})
	u.mu.Lock()
	u.running = false
	u.mu.Unlock()
}

func (u *updater) handleStart(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Tag string `json:"tag"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil || body.Tag == "" {
		http.Error(w, `{"message":"tag required"}`, http.StatusBadRequest)
		return
	}
	if _, _, _, ok := parseSemver(version); !ok {
		http.Error(w, `{"message":"development build cannot update itself"}`, http.StatusConflict)
		return
	}
	if !isNewer(body.Tag, version) {
		http.Error(w, `{"message":"tag is not newer than the running version"}`, http.StatusBadRequest)
		return
	}
	if assetName() == "" {
		http.Error(w, `{"message":"no release asset for this platform"}`, http.StatusConflict)
		return
	}
	u.mu.Lock()
	if u.running {
		u.mu.Unlock()
		http.Error(w, `{"message":"update already running"}`, http.StatusConflict)
		return
	}
	u.running = true
	u.status = updateStatus{State: stateDownloading, Target: body.Tag, Current: version}
	u.mu.Unlock()

	go u.run(body.Tag)
	writeJSON(w, http.StatusAccepted, map[string]string{"state": string(stateDownloading), "target": body.Tag})
}

// run performs download → verify → install → restart. Errors end in stateError.
func (u *updater) run(tag string) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	exe, err := os.Executable()
	if err != nil {
		u.fail(err)
		return
	}
	exe, _ = filepath.EvalSymlinks(exe)
	dir := filepath.Dir(exe)
	tmp := filepath.Join(dir, "."+filepath.Base(exe)+".update")
	defer os.Remove(tmp)

	name := assetName()
	base := u.dlBase + "/" + u.repo + "/releases/download/" + tag + "/"

	sum, err := u.expectedChecksum(ctx, base+"SHA256SUMS.txt", name)
	if err != nil {
		u.fail(fmt.Errorf("checksums: %w", err))
		return
	}
	if err := u.download(ctx, base+name, tmp); err != nil {
		u.fail(fmt.Errorf("download: %w", err))
		return
	}

	u.setStatus(func(s *updateStatus) { s.State = stateVerifying })
	actual, err := fileSHA256(tmp)
	if err != nil {
		u.fail(err)
		return
	}
	if !strings.EqualFold(actual, sum) {
		u.fail(errors.New("checksum mismatch — the downloaded file was not installed"))
		return
	}

	u.setStatus(func(s *updateStatus) { s.State = stateInstalling })
	if err := installBinary(tmp, exe); err != nil {
		u.fail(fmt.Errorf("install: %w", err))
		return
	}
	log.Printf("update installed: %s → %s", version, tag)

	u.setStatus(func(s *updateStatus) { s.State = stateRestarting })
	// Give the status poller a moment to see "restarting", then hand over to the new binary.
	time.Sleep(700 * time.Millisecond)
	if err := u.restartFn(exe, u.port); err != nil {
		u.fail(fmt.Errorf("restart: %w — please start the program again by hand", err))
	}
}

func (u *updater) expectedChecksum(ctx context.Context, url, name string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "wallee-virtual-terminal/"+version)
	res, err := u.client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("SHA256SUMS.txt: HTTP %d", res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && strings.TrimPrefix(fields[1], "*") == name && len(fields[0]) == 64 {
			return fields[0], nil
		}
	}
	return "", fmt.Errorf("no checksum for %s", name)
}

func (u *updater) download(ctx context.Context, url, dest string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "wallee-virtual-terminal/"+version)
	res, err := u.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", res.StatusCode)
	}
	if res.ContentLength > updateMaxBytes {
		return errors.New("asset too large")
	}
	u.setStatus(func(s *updateStatus) { s.Total = res.ContentLength })

	f, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o755)
	if err != nil {
		return err
	}
	buf := make([]byte, 128<<10)
	var received int64
	for {
		n, rerr := res.Body.Read(buf)
		if n > 0 {
			if _, werr := f.Write(buf[:n]); werr != nil {
				f.Close()
				return werr
			}
			received += int64(n)
			if received > updateMaxBytes {
				f.Close()
				return errors.New("asset too large")
			}
			u.setStatus(func(s *updateStatus) { s.Received = received })
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			f.Close()
			return rerr
		}
	}
	return f.Close()
}

func fileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// installBinary replaces exe with tmp. On Unix a rename over the running binary is atomic and
// safe (the running process keeps the old inode). Windows locks running executables, so the
// old file is moved aside first and cleaned up on the next start (see main.go).
func installBinary(tmp, exe string) error {
	if err := os.Chmod(tmp, 0o755); err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		old := exe + ".old"
		_ = os.Remove(old)
		if err := os.Rename(exe, old); err != nil {
			return err
		}
		if err := os.Rename(tmp, exe); err != nil {
			_ = os.Rename(old, exe) // roll back
			return err
		}
		return nil
	}
	return os.Rename(tmp, exe)
}

// restartProcess starts the new binary on the same port and ends this process.
// The frontend polls /update/version until the new version answers, then reloads.
func restartProcess(exe string, port int) error {
	args := []string{"-no-browser", "-port", strconv.Itoa(port)}
	env := append(os.Environ(), restartEnvPort+"="+strconv.Itoa(port))
	if runtime.GOOS != "windows" {
		if err := execReplace(exe, append([]string{exe}, args...), env); err == nil {
			return nil // not reached: the process image was replaced
		}
	}
	cmd := exec.Command(exe, args...)
	cmd.Env = env
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() {
		time.Sleep(300 * time.Millisecond)
		os.Exit(0)
	}()
	return nil
}

// cleanupOldBinary removes the `.old` file left behind by a Windows update.
func cleanupOldBinary() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	_ = os.Remove(exe + ".old")
}
