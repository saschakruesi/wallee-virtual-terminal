// wallee Virtual Terminal helper.
//
// A single binary that serves the embedded frontend on 127.0.0.1 and forwards
// /wallee/* to https://app-wallee.com/api/v2.0/* unchanged. It holds no
// credentials, signs nothing and stores nothing (see docs/01-architektur.md).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"syscall"
	"time"
)

// version is set at build time via -ldflags "-X main.version=v1.2.3".
var version = "dev"

const (
	defaultPort  = 7811
	portAttempts = 20
	upstreamBase = "https://app-wallee.com"
	upstreamPath = "/api/v2.0"
	proxyPrefix  = "/wallee"
)

func main() {
	port := flag.Int("port", defaultPort, "preferred port (falls back to the next free one)")
	noBrowser := flag.Bool("no-browser", false, "do not open the browser on start")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println(version)
		return
	}

	log.SetFlags(log.Ltime)

	listener, actualPort, err := listenOnFreePort(*port, portAttempts)
	if err != nil {
		log.Fatalf("no free port between %d and %d: %v", *port, *port+portAttempts-1, err)
	}
	origin := fmt.Sprintf("http://127.0.0.1:%d", actualPort)

	upstream, err := url.Parse(upstreamBase)
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.Handle(proxyPrefix+"/", newProxy(upstream, upstreamPath, proxyPrefix, []string{origin, fmt.Sprintf("http://localhost:%d", actualPort)}))
	mux.Handle("/", newStaticHandler(distFS()))

	server := &http.Server{
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	fmt.Printf("wallee Virtual Terminal läuft auf %s — dieses Fenster geöffnet lassen\n", origin)
	fmt.Printf("wallee Virtual Terminal is running at %s — keep this window open (Ctrl+C to quit)\n", origin)
	fmt.Printf("Version %s\n\n", version)

	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	if !*noBrowser {
		if err := openBrowser(origin); err != nil {
			log.Printf("could not open the browser (%v) — open %s manually", err, origin)
		}
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	fmt.Println("\nBeenden … / Shutting down …")

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

// listenOnFreePort tries preferred, preferred+1, … on 127.0.0.1 only.
func listenOnFreePort(preferred, attempts int) (net.Listener, int, error) {
	var lastErr error
	for i := 0; i < attempts; i++ {
		port := preferred + i
		ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)))
		if err == nil {
			return ln, port, nil
		}
		lastErr = err
	}
	return nil, 0, lastErr
}

func openBrowser(target string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", target)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", target)
	default:
		cmd = exec.Command("xdg-open", target)
	}
	return cmd.Start()
}

// logRequests writes method, path, status and duration — never query strings,
// headers or bodies, so credentials cannot end up in the console.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		if r.URL.Path == "/" || len(r.URL.Path) >= len(proxyPrefix) && r.URL.Path[:len(proxyPrefix)] == proxyPrefix {
			log.Printf("%s %s %d %s", r.Method, r.URL.Path, rec.status, time.Since(start).Round(time.Millisecond))
		}
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// Flush keeps streaming responses working through the recorder.
func (s *statusRecorder) Flush() {
	if f, ok := s.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
