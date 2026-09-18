package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type captured struct {
	method  string
	uri     string
	host    string
	headers http.Header
	body    string
}

func newTestProxy(t *testing.T) (http.Handler, *captured) {
	t.Helper()
	got := &captured{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		*got = captured{method: r.Method, uri: r.URL.RequestURI(), host: r.Host, headers: r.Header.Clone(), body: string(body)}
		w.Header().Set("Content-Type", "text/plain")
		w.Header().Set("X-Upstream", "yes")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("https://pay.example/x"))
	}))
	t.Cleanup(upstream.Close)
	u, _ := url.Parse(upstream.URL)
	return newProxy(u, "/api/v2.0", "/wallee", []string{"http://127.0.0.1:7811"}), got
}

func TestProxyRewritesPathAndKeepsQueryVerbatim(t *testing.T) {
	proxy, got := newTestProxy(t)
	rawQuery := `query=emailAddress%3A~%22anna%22%20OR%20familyName%3A~%22m%C3%BC%22&limit=10&order=familyName`
	req := httptest.NewRequest(http.MethodGet, "/wallee/customers/search?"+rawQuery, nil)
	req.Header.Set("Authorization", "Bearer abc.def.ghi")
	req.Header.Set("Space", "1234")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "http://127.0.0.1:7811")
	req.Header.Set("Referer", "http://127.0.0.1:7811/")
	req.Header.Set("Cookie", "session=secret")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	rec := httptest.NewRecorder()

	proxy.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", rec.Code, rec.Body.String())
	}
	if want := "/api/v2.0/customers/search?" + rawQuery; got.uri != want {
		t.Errorf("upstream URI = %q, want %q", got.uri, want)
	}
	if got.headers.Get("Authorization") != "Bearer abc.def.ghi" {
		t.Errorf("Authorization not forwarded: %v", got.headers)
	}
	if got.headers.Get("Space") != "1234" {
		t.Errorf("space header not forwarded: %v", got.headers)
	}
	for _, h := range []string{"Origin", "Referer", "Cookie", "Sec-Fetch-Site", "X-Forwarded-For", "X-Forwarded-Host"} {
		if got.headers.Get(h) != "" {
			t.Errorf("header %s must not be forwarded (got %q)", h, got.headers.Get(h))
		}
	}
	if strings.Contains(got.host, "127.0.0.1:7811") {
		t.Errorf("Host header must be the upstream host, got %q", got.host)
	}
	if rec.Header().Get("X-Upstream") != "yes" || rec.Body.String() != "https://pay.example/x" {
		t.Errorf("response not passed through unchanged: %v %q", rec.Header(), rec.Body.String())
	}
}

func TestProxyForwardsBodyAndContentType(t *testing.T) {
	proxy, got := newTestProxy(t)
	req := httptest.NewRequest(http.MethodPost, "/wallee/payment/transactions?expand=lineItems", strings.NewReader(`{"currency":"CHF"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	proxy.ServeHTTP(rec, req)
	if got.method != http.MethodPost || got.body != `{"currency":"CHF"}` {
		t.Errorf("body/method not forwarded: %s %q", got.method, got.body)
	}
	if got.headers.Get("Content-Type") != "application/json" {
		t.Errorf("Content-Type not forwarded: %v", got.headers)
	}
	if got.uri != "/api/v2.0/payment/transactions?expand=lineItems" {
		t.Errorf("uri = %q", got.uri)
	}
}

func TestProxyRejectsForeignOrigin(t *testing.T) {
	proxy, got := newTestProxy(t)
	cases := map[string]http.Header{
		"foreign origin":                  {"Origin": {"https://evil.example"}},
		"foreign origin, same-origin sfs": {"Origin": {"https://evil.example"}, "Sec-Fetch-Site": {"same-origin"}},
		"cross-site fetch without origin": {"Sec-Fetch-Site": {"cross-site"}},
		"same-site (other port)":          {"Sec-Fetch-Site": {"same-site"}},
		"null origin (file://)":           {"Origin": {"null"}},
	}
	for name, headers := range cases {
		t.Run(name, func(t *testing.T) {
			*got = captured{}
			req := httptest.NewRequest(http.MethodGet, "/wallee/spaces/1", nil)
			req.Header = headers
			rec := httptest.NewRecorder()
			proxy.ServeHTTP(rec, req)
			if rec.Code != http.StatusForbidden {
				t.Errorf("status = %d, want 403", rec.Code)
			}
			if got.uri != "" {
				t.Errorf("upstream must not be called, but got %q", got.uri)
			}
		})
	}
}

func TestProxyAcceptsOwnOriginAndNoOrigin(t *testing.T) {
	proxy, _ := newTestProxy(t)
	cases := map[string]http.Header{
		"own origin":               {"Origin": {"http://127.0.0.1:7811"}, "Sec-Fetch-Site": {"same-origin"}},
		"own origin, mixed case":   {"Origin": {"HTTP://127.0.0.1:7811"}},
		"no origin (curl)":         {},
		"sec-fetch-site none only": {"Sec-Fetch-Site": {"none"}},
	}
	for name, headers := range cases {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/wallee/spaces/1", nil)
			req.Header = headers
			rec := httptest.NewRecorder()
			proxy.ServeHTTP(rec, req)
			if rec.Code != http.StatusCreated {
				t.Errorf("status = %d, want 201 (passed through)", rec.Code)
			}
		})
	}
}

func TestProxyRejectsUnsupportedMethods(t *testing.T) {
	proxy, got := newTestProxy(t)
	for _, m := range []string{http.MethodOptions, http.MethodTrace, http.MethodConnect, "PROPFIND"} {
		req := httptest.NewRequest(m, "/wallee/spaces/1", nil)
		rec := httptest.NewRecorder()
		proxy.ServeHTTP(rec, req)
		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s: status = %d, want 405", m, rec.Code)
		}
		if got.uri != "" {
			t.Errorf("%s: upstream must not be called", m)
		}
	}
}

func TestProxyReportsUnreachableUpstreamAs502(t *testing.T) {
	u, _ := url.Parse("http://127.0.0.1:1") // nothing listens here
	proxy := newProxy(u, "/api/v2.0", "/wallee", []string{"http://127.0.0.1:7811"})
	req := httptest.NewRequest(http.MethodGet, "/wallee/spaces/1", nil)
	rec := httptest.NewRecorder()
	proxy.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502", rec.Code)
	}
}
