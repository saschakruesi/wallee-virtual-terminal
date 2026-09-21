//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// showAlert opens a native message box. The Windows binary is linked with -H windowsgui,
// so this is the only way a start-up error reaches the user. No CGO: user32 via syscall.
func showAlert(title, text string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	messageBox := user32.NewProc("MessageBoxW")
	t, err1 := syscall.UTF16PtrFromString(text)
	c, err2 := syscall.UTF16PtrFromString(title)
	if err1 != nil || err2 != nil {
		return
	}
	const mbOK, mbIconError = 0x0, 0x10
	_, _, _ = messageBox.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), mbOK|mbIconError)
}
