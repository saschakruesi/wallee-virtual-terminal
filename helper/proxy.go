package main

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

// forwardedRequestHeaders is the whitelist of request headers passed to wallee.
// Everything else (Origin, Referer, Cookie, Sec-Fetch-*, X-Forwarded-*) is dropped.
var forwardedRequestHeaders = []string{
	"Authorization",
	"Space",
	"Content-Type",
	"Content-Length",
	"Accept",
	"Accept-Language",
}

var allowedMethods = map[string]bool{
	http.MethodGet:    true,
	http.MethodPost:   true,
	http.MethodPut:    true,
	http.MethodPatch:  true,
	http.MethodDelete: true,
}

// newProxy returns a handler that forwards <prefix>/x to <upstream><upstreamPath>/x.
//
// Security model (docs/01-architektur.md):
//   - the listener is bound to 127.0.0.1 only (see main.go);
//   - a request carrying an Origin header must match one of allowedOrigins;
//   - a request carrying Sec-Fetch-Site must be same-origin or none;
//   - only the fixed upstream host is ever contacted.
func newProxy(upstream *url.URL, upstreamPath, prefix string, allowedOrigins []string) http.Handler {
	origins := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		origins[strings.ToLower(o)] = true
	}

	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          10,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
	}

	rp := &httputil.ReverseProxy{
		Transport: transport,
		Rewrite: func(pr *httputil.ProxyRequest) {
			out := pr.Out
			in := pr.In

			out.URL.Scheme = upstream.Scheme
			out.URL.Host = upstream.Host
			out.URL.Path = upstreamPath + strings.TrimPrefix(in.URL.Path, prefix)
			if in.URL.RawPath != "" {
				out.URL.RawPath = upstreamPath + strings.TrimPrefix(in.URL.RawPath, prefix)
			} else {
				out.URL.RawPath = ""
			}
			// RawQuery is copied verbatim: the JWT signs pathname+search exactly as sent.
			out.URL.RawQuery = in.URL.RawQuery
			out.Host = upstream.Host

			out.Header = make(http.Header, len(forwardedRequestHeaders)+1)
			for _, name := range forwardedRequestHeaders {
				if values := in.Header.Values(name); len(values) > 0 {
					out.Header[http.CanonicalHeaderKey(name)] = values
				}
			}
			out.Header.Set("User-Agent", "wallee-virtual-terminal/"+version)
			// No pr.SetXForwarded(): the customer's local IP is nobody's business.
		},
		ErrorHandler: func(w http.ResponseWriter, _ *http.Request, err error) {
			// Upstream unreachable (offline, firewall, corporate proxy). The frontend maps
			// 502 to "Der Helper erreicht app-wallee.com nicht".
			http.Error(w, `{"message":"upstream unreachable: `+sanitize(err.Error())+`"}`, http.StatusBadGateway)
		},
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowedMethods[r.Method] {
			w.Header().Set("Allow", "GET, POST, PUT, PATCH, DELETE")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !originAllowed(r, origins) {
			http.Error(w, "forbidden: cross-origin access to the helper is not permitted", http.StatusForbidden)
			return
		}
		if !strings.HasPrefix(r.URL.Path, prefix+"/") {
			http.NotFound(w, r)
			return
		}
		rp.ServeHTTP(w, r)
	})
}

// originAllowed implements the same-origin policy for the proxy.
// Requests without Origin and without Sec-Fetch-Site (curl, same-origin navigations,
// older browsers) are accepted because the listener is loopback-only anyway.
func originAllowed(r *http.Request, origins map[string]bool) bool {
	if origin := r.Header.Get("Origin"); origin != "" {
		if !origins[strings.ToLower(origin)] {
			return false
		}
	}
	switch strings.ToLower(r.Header.Get("Sec-Fetch-Site")) {
	case "", "same-origin", "none":
		return true
	default: // "cross-site", "same-site"
		return false
	}
}

func sanitize(s string) string {
	s = strings.ReplaceAll(s, `"`, `'`)
	s = strings.ReplaceAll(s, "\n", " ")
	return s
}
