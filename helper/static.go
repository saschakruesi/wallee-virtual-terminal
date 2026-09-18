package main

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// The frontend build (web/dist) is copied to helper/dist by the Makefile before
// `go build`. `all:` also embeds files starting with `_` or `.`.
//
//go:embed all:dist
var embeddedDist embed.FS

func distFS() fs.FS {
	sub, err := fs.Sub(embeddedDist, "dist")
	if err != nil {
		panic(err)
	}
	return sub
}

// newStaticHandler serves files from the embedded build with an SPA fallback:
// unknown paths without a file extension return index.html so deep links work
// (the app uses a HashRouter, but this keeps `/setup` style URLs harmless too).
func newStaticHandler(root fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")

		p := path.Clean("/" + r.URL.Path)
		if p == "/" || p == "/index.html" {
			serveIndex(w, r, root)
			return
		}
		if _, err := fs.Stat(root, strings.TrimPrefix(p, "/")); err == nil {
			if strings.HasPrefix(p, "/assets/") {
				// Vite emits content-hashed asset names.
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			r.URL.Path = p
			fileServer.ServeHTTP(w, r)
			return
		}
		if path.Ext(p) == "" {
			serveIndex(w, r, root)
			return
		}
		http.NotFound(w, r)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, root fs.FS) {
	data, err := fs.ReadFile(root, "index.html")
	if err != nil {
		http.Error(w, "frontend build missing (run `make build`)", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	if r.Method == http.MethodHead {
		return
	}
	_, _ = w.Write(data)
}
