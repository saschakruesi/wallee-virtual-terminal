package main

// macOS app bundle support for the self-update: the release asset is a zip containing
// «wallee Virtual Terminal.app». The whole bundle is swapped (not just the executable) so
// that a code signature and notarization ticket on the bundle stay valid after an update.

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const updateStageDir = ".wallee-virtual-terminal.update"

// bundleDir returns the .app directory when exe lies in <Name>.app/Contents/MacOS/.
func bundleDir(exe string) (string, bool) {
	macos := filepath.Dir(exe)
	contents := filepath.Dir(macos)
	app := filepath.Dir(contents)
	if filepath.Base(macos) != "MacOS" || filepath.Base(contents) != "Contents" || !strings.HasSuffix(app, ".app") {
		return "", false
	}
	return app, true
}

// extractZip unpacks src into dest (created, must not exist yet), keeping Unix file modes so
// the executable stays executable. Entries escaping dest or symlinks are rejected.
func extractZip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()
	if err := os.Mkdir(dest, 0o755); err != nil {
		return err
	}
	for _, f := range r.File {
		name := filepath.FromSlash(f.Name)
		if !filepath.IsLocal(name) {
			return fmt.Errorf("zip entry %q escapes the target directory", f.Name)
		}
		if strings.HasPrefix(name, "__MACOSX") {
			continue // Finder metadata, never part of our archives
		}
		mode := f.Mode()
		if mode&os.ModeSymlink != 0 {
			return fmt.Errorf("zip entry %q is a symlink", f.Name)
		}
		target := filepath.Join(dest, name)
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		perm := mode.Perm()
		if perm == 0 {
			perm = 0o644
		}
		if err := writeZipEntry(f, target, perm); err != nil {
			return err
		}
	}
	return nil
}

func writeZipEntry(f *zip.File, target string, perm os.FileMode) error {
	in, err := f.Open()
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, perm)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, io.LimitReader(in, updateMaxBytes)); err != nil {
		_ = out.Close()
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Chmod(target, perm) // umask-independent
}

// findBundle returns the single *.app directory directly inside dir.
func findBundle(dir string) (string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}
	for _, e := range entries {
		if e.IsDir() && strings.HasSuffix(e.Name(), ".app") {
			return filepath.Join(dir, e.Name()), nil
		}
	}
	return "", errors.New("no .app bundle in the downloaded archive")
}

// bundleExecutable returns the single file in <app>/Contents/MacOS.
func bundleExecutable(app string) (string, error) {
	dir := filepath.Join(app, "Contents", "MacOS")
	entries, err := os.ReadDir(dir)
	if err != nil {
		return "", err
	}
	var files []string
	for _, e := range entries {
		if e.Type().IsRegular() {
			files = append(files, e.Name())
		}
	}
	if len(files) != 1 {
		return "", fmt.Errorf("expected one executable in %s, found %d", dir, len(files))
	}
	return filepath.Join(dir, files[0]), nil
}

// installBundle moves the current bundle aside as <app>.old and puts newApp in its place.
// The .old bundle is removed on the next start (cleanupOldBinary).
func installBundle(newApp, app string) error {
	old := app + ".old"
	_ = os.RemoveAll(old)
	if err := os.Rename(app, old); err != nil {
		return err
	}
	if err := os.Rename(newApp, app); err != nil {
		_ = os.Rename(old, app) // roll back
		return err
	}
	return nil
}

// installFromZip installs the macOS asset: a bundle swap when running inside an .app,
// otherwise (development, bare binary) only the executable is replaced. Returns the path
// of the executable to restart.
func installFromZip(archive, exe string) (string, error) {
	app, inBundle := bundleDir(exe)
	parent := filepath.Dir(exe)
	if inBundle {
		parent = filepath.Dir(app)
	}
	stage := filepath.Join(parent, updateStageDir)
	_ = os.RemoveAll(stage)
	defer os.RemoveAll(stage)

	if err := extractZip(archive, stage); err != nil {
		return "", err
	}
	newApp, err := findBundle(stage)
	if err != nil {
		return "", err
	}
	newExe, err := bundleExecutable(newApp)
	if err != nil {
		return "", err
	}
	if !inBundle {
		if err := installBinary(newExe, exe); err != nil {
			return "", err
		}
		return exe, nil
	}
	if err := installBundle(newApp, app); err != nil {
		return "", err
	}
	return bundleExecutable(app)
}
