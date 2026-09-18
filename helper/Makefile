# wallee Virtual Terminal — helper build
#
#   make build     copy ../web/dist → ./dist and build the binary for this machine
#   make release   cross-compile darwin/arm64, darwin/amd64, windows/amd64 → ../dist/
#   make test      go vet + go test (needs ./dist, a placeholder is created if missing)
#   make clean

BINARY   := wallee-virtual-terminal
VERSION  ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS  := -s -w -X main.version=$(VERSION)
GOFLAGS  := -trimpath -buildvcs=false
export CGO_ENABLED := 0

RELEASE_DIR := ../dist
WEB_DIST    := ../web/dist

.PHONY: build release test clean copy-dist placeholder-dist web

build: copy-dist
	go build $(GOFLAGS) -ldflags "$(LDFLAGS)" -o $(BINARY) .

## Build the frontend first (needs Node), then copy it here for embedding.
web:
	cd ../web && VITE_APP_VERSION=$(VERSION) npm run build

copy-dist:
	@test -f $(WEB_DIST)/index.html || { echo "error: $(WEB_DIST)/index.html missing — run 'make web' (or 'npm run build' in web/) first"; exit 1; }
	rm -rf dist && cp -R $(WEB_DIST) dist

## Creates an empty placeholder so `go vet`/`go test` work without a frontend build.
placeholder-dist:
	@test -f dist/index.html || { mkdir -p dist && printf '<!doctype html><title>placeholder</title>' > dist/index.html; }

test: placeholder-dist
	go vet ./...
	go test ./...

release: copy-dist
	rm -rf $(RELEASE_DIR) && mkdir -p $(RELEASE_DIR)
	GOOS=darwin  GOARCH=arm64 go build $(GOFLAGS) -ldflags "$(LDFLAGS)" -o $(RELEASE_DIR)/$(BINARY)-macos-apple-silicon .
	GOOS=darwin  GOARCH=amd64 go build $(GOFLAGS) -ldflags "$(LDFLAGS)" -o $(RELEASE_DIR)/$(BINARY)-macos-intel .
	GOOS=windows GOARCH=amd64 go build $(GOFLAGS) -ldflags "$(LDFLAGS)" -o $(RELEASE_DIR)/$(BINARY)-windows.exe .
	cd $(RELEASE_DIR) && shasum -a 256 $(BINARY)-* > SHA256SUMS.txt
	@ls -la $(RELEASE_DIR)

clean:
	rm -rf dist $(BINARY) $(BINARY).exe $(RELEASE_DIR)
