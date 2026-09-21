//go:build !windows

package main

import (
	"os/exec"
	"runtime"
	"strings"
)

// showAlert shows a start-up error as a dialog. Inside the macOS app bundle there is no
// terminal, so stderr alone would go unseen. Other platforms only log.
func showAlert(title, text string) {
	if runtime.GOOS != "darwin" {
		return
	}
	quote := func(s string) string { return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"` }
	script := "display alert " + quote(title) + " message " + quote(text) + " as critical"
	_ = exec.Command("osascript", "-e", script).Run()
}
