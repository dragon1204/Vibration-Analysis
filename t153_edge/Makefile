# T153 edge build (spec 5.1). Go >= 1.22, no CGO.
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo 0.1.0)
PKG     := selink.vn/smartmotor/edge/internal/version
LDFLAGS := -s -w -X $(PKG).Version=$(VERSION)
ARM     := GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0
T153    ?= root@192.168.10.10

.PHONY: all arm test vet sim run-dev deploy clean

all: test arm

arm:
	mkdir -p bin
	$(ARM) go build -trimpath -ldflags "$(LDFLAGS)" -o bin/edge-agent ./cmd/edge-agent
	$(ARM) go build -trimpath -ldflags "$(LDFLAGS)" -o bin/wtvb-config ./cmd/wtvb-config
	$(ARM) go build -trimpath -ldflags "$(LDFLAGS)" -o bin/sensor-sim ./cmd/sensor-sim
	$(ARM) go build -trimpath -ldflags "$(LDFLAGS)" -o bin/edge-provision ./cmd/edge-provision

test:
	go test ./...

vet:
	go vet ./...

# Local development without hardware.
sim:
	go run ./cmd/sensor-sim --f1x 49.17 --lobes 4 \
	  --devices 0x11:healthy,0x12:unbalance,0x41:healthy:mesh=9,0x42:healthy:mesh=3,0x43:healthy:mesh=1.2,0x44:healthy:mesh=0.9

run-dev:
	go run ./cmd/edge-agent --config deploy/edge.dev.yaml

# Copy binaries + init script to the gateway (SSH key auth).
deploy: arm
	scp bin/edge-agent bin/wtvb-config $(T153):/usr/local/bin/
	scp deploy/S99edge-agent $(T153):/etc/init.d/S99edge-agent
	ssh $(T153) 'chmod +x /usr/local/bin/edge-agent /usr/local/bin/wtvb-config /etc/init.d/S99edge-agent && mkdir -p /etc/edge-agent /data/edge'
	@echo "Copy edge.yaml, mqtt.token, ca.pem to /etc/edge-agent/ then: ssh $(T153) /etc/init.d/S99edge-agent restart"

clean:
	rm -rf bin data-dev
