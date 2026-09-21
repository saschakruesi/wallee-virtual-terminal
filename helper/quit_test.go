package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestQuitEndpointEnforcesOriginAndMethodAndSignals(t *testing.T) {
	quit := make(chan struct{}, 1)
	h := newQuitHandler(originSet([]string{"http://127.0.0.1:7811"}), quit)

	do := func(method, origin string) int {
		req := httptest.NewRequest(method, "/quit", nil)
		if origin != "" {
			req.Header.Set("Origin", origin)
		}
		rec := httptest.NewRecorder()
		h(rec, req)
		return rec.Code
	}
	assertNoSignal := func() {
		t.Helper()
		select {
		case <-quit:
			t.Fatal("quit signalled unexpectedly")
		default:
		}
	}

	if got := do(http.MethodGet, "http://127.0.0.1:7811"); got != http.StatusMethodNotAllowed {
		t.Errorf("GET: got %d, want 405", got)
	}
	assertNoSignal()
	if got := do(http.MethodPost, "http://evil.example"); got != http.StatusForbidden {
		t.Errorf("foreign origin: got %d, want 403", got)
	}
	assertNoSignal()
	if got := do(http.MethodPost, "http://127.0.0.1:7811"); got != http.StatusNoContent {
		t.Errorf("POST: got %d, want 204", got)
	}
	select {
	case <-quit:
	case <-time.After(time.Second):
		t.Fatal("quit was not signalled")
	}
	// A second request while the first shutdown is pending must not block.
	if got := do(http.MethodPost, "http://127.0.0.1:7811"); got != http.StatusNoContent {
		t.Errorf("second POST: got %d, want 204", got)
	}
}
