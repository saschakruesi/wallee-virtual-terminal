//go:build windows

package main

import "errors"

// Windows has no exec(2); restartProcess falls back to starting a child and exiting.
func execReplace(_ string, _ []string, _ []string) error {
	return errors.New("exec not supported on windows")
}
