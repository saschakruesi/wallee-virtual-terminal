package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func testDist() fstest.MapFS {
	return fstest.MapFS{
		"index.html":         {Data: []byte("<!doctype html><title>wvt</title>")},
		"favicon.svg":        {Data: []byte("<svg/>")},
		"assets/app-abc.js":  {Data: []byte("console.log(1)")},
		"fonts/roboto.woff2": {Data: []byte("woff2")},
	}
}

func TestStaticServesFilesAndSPAFallback(t *testing.T) {
	h := newStaticHandler(testDist())
	cases := []struct {
		path       string
		wantStatus int
		wantBody   string
		wantCache  string
	}{
		{"/", 200, "<!doctype html><title>wvt</title>", "no-cache"},
		{"/index.html", 200, "<!doctype html><title>wvt</title>", "no-cache"},
		{"/setup", 200, "<!doctype html><title>wvt</title>", "no-cache"},
		{"/customers/42", 200, "<!doctype html><title>wvt</title>", "no-cache"},
		{"/favicon.svg", 200, "<svg/>", "no-cache"},
		{"/assets/app-abc.js", 200, "console.log(1)", "public, max-age=31536000, immutable"},
		{"/fonts/roboto.woff2", 200, "woff2", "no-cache"},
		{"/missing.png", 404, "", ""},
		{"/assets/../index.html", 200, "<!doctype html><title>wvt</title>", "no-cache"},
	}
	for _, c := range cases {
		t.Run(c.path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, c.path, nil)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != c.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, c.wantStatus)
			}
			if c.wantBody != "" && rec.Body.String() != c.wantBody {
				t.Errorf("body = %q, want %q", rec.Body.String(), c.wantBody)
			}
			if c.wantCache != "" && rec.Header().Get("Cache-Control") != c.wantCache {
				t.Errorf("Cache-Control = %q, want %q", rec.Header().Get("Cache-Control"), c.wantCache)
			}
			if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
				t.Errorf("missing nosniff header")
			}
		})
	}
}

func TestStaticRejectsWrites(t *testing.T) {
	h := newStaticHandler(testDist())
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405", rec.Code)
	}
}
