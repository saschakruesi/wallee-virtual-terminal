package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRunningInstanceDetectsHelper(t *testing.T) {
	helper := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/update/version" {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"version": "v1.2.0"})
	}))
	defer helper.Close()
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html>not us</html>"))
	}))
	defer other.Close()
	closed := httptest.NewServer(http.NotFoundHandler())
	closedURL := closed.URL
	closed.Close()

	if !runningInstanceAt(helper.URL, time.Second) {
		t.Error("helper not recognised")
	}
	if runningInstanceAt(other.URL, time.Second) {
		t.Error("foreign server mistaken for the helper")
	}
	if runningInstanceAt(closedURL, time.Second) {
		t.Error("closed port reported as running instance")
	}
}
