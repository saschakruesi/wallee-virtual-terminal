package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

const testAppName = "wallee Virtual Terminal.app"

// testBundleZip builds an in-memory release zip with an executable and an Info.plist.
func testBundleZip(t *testing.T, payload []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	add := func(name string, mode os.FileMode, data []byte) {
		h := &zip.FileHeader{Name: name, Method: zip.Deflate}
		h.SetMode(mode)
		f, err := w.CreateHeader(h)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	add(testAppName+"/Contents/Info.plist", 0o644, []byte("<plist/>"))
	add(testAppName+"/Contents/MacOS/wallee-virtual-terminal", 0o755, payload)
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestBundleDir(t *testing.T) {
	app := filepath.Join("Applications", testAppName)
	if got, ok := bundleDir(filepath.Join(app, "Contents", "MacOS", "wallee-virtual-terminal")); !ok || got != app {
		t.Errorf("bundleDir = %q, %v", got, ok)
	}
	if _, ok := bundleDir(filepath.Join("Users", "x", "Downloads", "wallee-virtual-terminal")); ok {
		t.Error("bare binary reported as bundle")
	}
	if _, ok := bundleDir(filepath.Join("X.app", "wallee-virtual-terminal")); ok {
		t.Error("file directly inside .app reported as bundle")
	}
}

func TestExtractZipPreservesModeAndRejectsTraversal(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix file modes")
	}
	dir := t.TempDir()
	archive := filepath.Join(dir, "asset.zip")
	if err := os.WriteFile(archive, testBundleZip(t, []byte("#!/bin/sh\n")), 0o644); err != nil {
		t.Fatal(err)
	}
	dest := filepath.Join(dir, "stage")
	if err := extractZip(archive, dest); err != nil {
		t.Fatal(err)
	}
	exe := filepath.Join(dest, testAppName, "Contents", "MacOS", "wallee-virtual-terminal")
	info, err := os.Stat(exe)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm()&0o111 == 0 {
		t.Errorf("executable bit lost: %v", info.Mode())
	}

	// Traversal
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	f, _ := w.Create("../evil")
	_, _ = f.Write([]byte("x"))
	_ = w.Close()
	evil := filepath.Join(dir, "evil.zip")
	_ = os.WriteFile(evil, buf.Bytes(), 0o644)
	if err := extractZip(evil, filepath.Join(dir, "stage2")); err == nil {
		t.Error("traversal entry accepted")
	}
	if _, err := os.Stat(filepath.Join(dir, "evil")); err == nil {
		t.Error("traversal entry was written")
	}
}

func TestInstallBundleSwapsAndRollsBack(t *testing.T) {
	dir := t.TempDir()
	app := filepath.Join(dir, testAppName)
	newApp := filepath.Join(dir, "stage", testAppName)
	for _, p := range []string{app, newApp} {
		if err := os.MkdirAll(filepath.Join(p, "Contents", "MacOS"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	_ = os.WriteFile(filepath.Join(app, "Contents", "MacOS", "wallee-virtual-terminal"), []byte("old"), 0o755)
	_ = os.WriteFile(filepath.Join(newApp, "Contents", "MacOS", "wallee-virtual-terminal"), []byte("new"), 0o755)

	if err := installBundle(newApp, app); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(filepath.Join(app, "Contents", "MacOS", "wallee-virtual-terminal"))
	if string(got) != "new" {
		t.Errorf("bundle not swapped: %q", got)
	}
	if _, err := os.Stat(app + ".old"); err != nil {
		t.Errorf("old bundle not kept: %v", err)
	}

	// Rollback: new bundle missing → the current one must be back in place.
	if err := installBundle(filepath.Join(dir, "missing.app"), app); err == nil {
		t.Error("expected error for missing new bundle")
	}
	if _, err := os.Stat(filepath.Join(app, "Contents", "MacOS", "wallee-virtual-terminal")); err != nil {
		t.Errorf("rollback failed: %v", err)
	}
}

func TestInstallFromZipReplacesBareBinary(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix file modes")
	}
	dir := t.TempDir()
	exe := filepath.Join(dir, "wallee-virtual-terminal")
	_ = os.WriteFile(exe, []byte("old"), 0o755)
	archive := filepath.Join(dir, "asset.zip")
	_ = os.WriteFile(archive, testBundleZip(t, []byte("new")), 0o644)

	got, err := installFromZip(archive, exe)
	if err != nil {
		t.Fatal(err)
	}
	if got != exe {
		t.Errorf("restart path %q, want %q", got, exe)
	}
	data, _ := os.ReadFile(exe)
	if string(data) != "new" {
		t.Errorf("binary not replaced: %q", data)
	}
	if _, err := os.Stat(filepath.Join(dir, updateStageDir)); err == nil {
		t.Error("stage directory not cleaned up")
	}
}

func TestRunInstallsBundleFromZip(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS asset")
	}
	withVersion(t, "v1.0.0")
	name := assetName()
	payload := []byte("#!/bin/sh\necho new\n")
	archive := testBundleZip(t, payload)
	sum := sha256.Sum256(archive)
	u, _ := newTestUpdater(t, githubRelease{}, map[string][]byte{
		name:             archive,
		"SHA256SUMS.txt": []byte(hex.EncodeToString(sum[:]) + "  " + name + "\n"),
	})

	dir, err := filepath.EvalSymlinks(t.TempDir()) // run() resolves symlinks (/var → /private/var)
	if err != nil {
		t.Fatal(err)
	}
	app := filepath.Join(dir, testAppName)
	exe := filepath.Join(app, "Contents", "MacOS", "wallee-virtual-terminal")
	if err := os.MkdirAll(filepath.Dir(exe), 0o755); err != nil {
		t.Fatal(err)
	}
	_ = os.WriteFile(exe, []byte("old"), 0o755)
	u.exePath = func() (string, error) { return exe, nil }
	restarted := make(chan string, 1)
	u.restartFn = func(e string, _ int) error {
		restarted <- e
		return nil
	}

	u.run("v1.1.0")

	if st := u.status; st.State != stateRestarting {
		t.Fatalf("state %s (%s)", st.State, st.Message)
	}
	select {
	case e := <-restarted:
		if e != exe {
			t.Errorf("restarted %q, want %q", e, exe)
		}
	default:
		t.Fatal("restart hook not called")
	}
	got, _ := os.ReadFile(exe)
	if string(got) != string(payload) {
		t.Errorf("bundle executable not replaced: %q", got)
	}
	if _, err := os.Stat(app + ".old"); err != nil {
		t.Errorf("old bundle missing: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, updateStageDir)); err == nil {
		t.Error("stage directory left behind")
	}
}
