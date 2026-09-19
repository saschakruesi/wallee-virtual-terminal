//go:build !windows

package main

import "syscall"

// execReplace swaps the process image for the new binary; the listening socket is
// close-on-exec, so the new process can bind the same port.
func execReplace(exe string, argv []string, env []string) error {
	return syscall.Exec(exe, argv, env)
}
