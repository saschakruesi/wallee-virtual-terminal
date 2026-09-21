package main

import (
	"log"
	"os"
)

// fatal logs a start-up error, shows it as a dialog and exits.
func fatal(text string) {
	log.Print(text)
	showAlert("wallee Virtual Terminal", text)
	os.Exit(1)
}
