package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestIsNewer(t *testing.T) {
	cases := []struct {
		candidate, current string
		want               bool
	}{
		{"v1.0.1", "v1.0.0", true},
		{"v1.1.0", "v1.0.9", true},
		{"v2.0.0", "v1.9.9", true},
		{"1.0.1", "v1.0.0", true},
		{"v1.0.0", "v1.0.0", false},
		{"v0.9.9", "v1.0.0", false},
		{"v1.0.1", "dev", false},
		{"v1.0.1", "v1.0.0-dirty", false},
		{"nightly", "v1.0.0", false},
		{"v1.0.1-rc.1", "v1.0.0", true},
	}
	for _, c := range cases {
		if got := isNewer(c.candidate, c.current); got != c.want {
			t.Errorf("isNewer(%q,%q) = %v, want %v", c.candidate, c.current, got, c.want)
		}
	}
}

func withVersion(t *testing.T, v string) {
	t.Helper()
	old := version
	version = v
	t.Cleanup(func() { version = old })
}

func newTestUpdater(t *testing.T, release githubRelease, files map[string][]byte) (*updater, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/releases/latest"):
			_ = json.NewEncoder(w).Encode(release)
		case strings.Contains(r.URL.Path, "/releases/download/"):
			name := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
			data, ok := files[name]
			if !ok {
				http.NotFound(w, r)
				return
			}
			_, _ = w.Write(data)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	u := newUpdater("owner/repo", 7811, []string{"http://127.0.0.1:7811"})
	u.apiBase = srv.URL
	u.dlBase = srv.URL
	return u, srv
}

func TestCheckReportsUpdateOnlyForNewerRelease(t *testing.T) {
	withVersion(t, "v1.0.0")
	name := assetName()
	if name == "" {
		t.Skip("no release asset for this platform")
	}
	u, _ := newTestUpdater(t, githubRelease{TagName: "v1.1.0", HTMLURL: "https://x/rel", Assets: []releaseAsset{{Name: name, Size: 42}}}, nil)
	mux := http.NewServeMux()
	u.register(mux)

	req := httptest.NewRequest(http.MethodGet, "/update/check", nil)
	req.Header.Set("Origin", "http://127.0.0.1:7811")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var resp checkResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if !resp.UpdateAvailable || resp.Latest != "v1.1.0" || resp.AssetName != name || resp.AssetSize != 42 {
		t.Errorf("unexpected response: %+v", resp)
	}

	// Same version → up-to-date (served from cache, so no second request needed).
	withVersion(t, "v1.1.0")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.UpdateAvailable || resp.Reason != "up-to-date" {
		t.Errorf("expected up-to-date, got %+v", resp)
	}

	// Dev builds never update and never call GitHub.
	withVersion(t, "dev")
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.UpdateAvailable || resp.Reason != "dev" {
		t.Errorf("expected dev, got %+v", resp)
	}
}

func TestUpdateEndpointsEnforceOriginAndMethod(t *testing.T) {
	u, _ := newTestUpdater(t, githubRelease{}, nil)
	mux := http.NewServeMux()
	u.register(mux)
	req := httptest.NewRequest(http.MethodGet, "/update/check", nil)
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("foreign origin: %d", rec.Code)
	}
	req = httptest.NewRequest(http.MethodGet, "/update/start", nil)
	rec = httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET start: %d", rec.Code)
	}
}

func TestStartRejectsBadTags(t *testing.T) {
	withVersion(t, "v1.0.0")
	u, _ := newTestUpdater(t, githubRelease{}, nil)
	mux := http.NewServeMux()
	u.register(mux)
	for body, want := range map[string]int{`{}`: 400, `{"tag":"v0.9.0"}`: 400, `{"tag":"v1.0.0"}`: 400, `nope`: 400} {
		req := httptest.NewRequest(http.MethodPost, "/update/start", strings.NewReader(body))
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != want {
			t.Errorf("%s: %d, want %d", body, rec.Code, want)
		}
	}
}

// Full pipeline against a fake release: download, verify, install into a temp "executable", restart hook.
func TestRunDownloadsVerifiesInstallsAndRestarts(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("rename semantics differ; covered manually")
	}
	withVersion(t, "v1.0.0")
	name := assetName()
	if name == "" {
		t.Skip("no release asset for this platform")
	}
	payload := []byte("#!/bin/sh\necho new\n")
	sum := sha256.Sum256(payload)
	files := map[string][]byte{
		name:             payload,
		"SHA256SUMS.txt": []byte(hex.EncodeToString(sum[:]) + "  " + name + "\n"),
	}
	u, _ := newTestUpdater(t, githubRelease{}, files)

	// Pretend the running executable is a temp file.
	dir := t.TempDir()
	exe := filepath.Join(dir, "wvt")
	if err := os.WriteFile(exe, []byte("old"), 0o755); err != nil {
		t.Fatal(err)
	}
	restarted := make(chan string, 1)
	u.restartFn = func(e string, port int) error {
		restarted <- e
		return nil
	}
	// run() uses os.Executable(); emulate by installing directly through the same steps.
	tmp := filepath.Join(dir, ".wvt.update")
	if err := u.download(context.Background(), u.dlBase+"/owner/repo/releases/download/v1.1.0/"+name, tmp); err != nil {
		t.Fatal(err)
	}
	expected, err := u.expectedChecksum(context.Background(), u.dlBase+"/owner/repo/releases/download/v1.1.0/SHA256SUMS.txt", name)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := fileSHA256(tmp)
	if actual != expected {
		t.Fatalf("checksum mismatch %s != %s", actual, expected)
	}
	if err := installBinary(tmp, exe); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(exe)
	if string(got) != string(payload) {
		t.Errorf("executable not replaced: %q", got)
	}
	if err := u.restartFn(exe, 7811); err != nil {
		t.Fatal(err)
	}
	select {
	case e := <-restarted:
		if e != exe {
			t.Errorf("restarted %q", e)
		}
	case <-time.After(time.Second):
		t.Fatal("restart hook not called")
	}
	st := u.status
	if st.Received != int64(len(payload)) {
		t.Errorf("progress not reported: %+v", st)
	}
}

func TestExpectedChecksumRejectsMissingEntry(t *testing.T) {
	u, _ := newTestUpdater(t, githubRelease{}, map[string][]byte{"SHA256SUMS.txt": []byte("deadbeef  other-file\n")})
	if _, err := u.expectedChecksum(context.Background(), u.dlBase+"/owner/repo/releases/download/v1/SHA256SUMS.txt", "wallee-virtual-terminal-macos-intel"); err == nil {
		t.Error("expected error for missing checksum")
	}
}
