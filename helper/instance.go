package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// runningInstance reports whether another wallee Virtual Terminal already listens on port.
// A second double-click on the app then only opens the browser instead of starting a
// second helper on the next free port.
func runningInstance(port int, timeout time.Duration) bool {
	return runningInstanceAt(fmt.Sprintf("http://127.0.0.1:%d", port), timeout)
}

func runningInstanceAt(base string, timeout time.Duration) bool {
	client := &http.Client{Timeout: timeout}
	res, err := client.Get(base + "/update/version")
	if err != nil {
		return false
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return false
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, 4<<10))
	if err != nil {
		return false
	}
	var body struct {
		Version string `json:"version"`
	}
	return json.Unmarshal(data, &body) == nil && body.Version != ""
}
