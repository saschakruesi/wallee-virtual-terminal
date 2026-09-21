package main

import (
	"net/http"
	"strings"
)

// originSet turns the allowed origins into the lookup map used by originAllowed.
func originSet(list []string) map[string]bool {
	set := make(map[string]bool, len(list))
	for _, o := range list {
		set[strings.ToLower(o)] = true
	}
	return set
}

// newQuitHandler serves POST /quit: the frontend's «Beenden» action. Without a console
// window (app bundle on macOS, -H windowsgui on Windows) this is the only way for the
// user to stop the helper. Same origin policy as the proxy and the updater.
func newQuitHandler(allowed map[string]bool, quit chan<- struct{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !originAllowed(r, allowed) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusNoContent)
		select {
		case quit <- struct{}{}:
		default: // shutdown already requested
		}
	}
}
