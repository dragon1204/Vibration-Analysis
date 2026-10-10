// Command edge-agent runs on the T153 gateway: reads sensors, processes signals,
// raises local alarms, buffers data and uploads it over MQTT (spec 5).
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"selink.vn/smartmotor/edge/internal/agent"
	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/logx"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/version"
)

func main() {
	cfgPath := flag.String("config", "/etc/edge-agent/edge.yaml", "configuration file")
	selfTest := flag.Bool("self-test", false, "validate config and storage, then exit (used by OTA)")
	showVersion := flag.Bool("version", false, "print version")
	flag.Parse()

	if *showVersion {
		fmt.Println(version.Version, version.Commit)
		return
	}
	if *selfTest {
		os.Exit(runSelfTest(*cfgPath))
	}
	bin, _ := os.Executable()

	sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	for {
		cfg, err := config.Load(*cfgPath)
		if err != nil {
			fmt.Fprintln(os.Stderr, "config error:", err)
			os.Exit(2)
		}
		log, closer := newLogger(cfg)
		var reload atomic.Bool
		ctx, cancel := context.WithCancel(sigCtx)
		a, err := agent.New(cfg, agent.Options{ConfigPath: *cfgPath, BinaryPath: bin, OnReload: func() {
			reload.Store(true)
			cancel()
		}}, log)
		if err != nil {
			log.Error("agent init failed", "err", err)
			cancel()
			closer()
			// Wait a bit so a supervisor restart loop does not spin.
			time.Sleep(5 * time.Second)
			os.Exit(1)
		}
		_ = a.Run(ctx)
		cancel()
		closer()
		if !reload.Load() || sigCtx.Err() != nil {
			return
		}
		fmt.Fprintln(os.Stderr, "reloading configuration")
	}
}

func newLogger(cfg *config.Config) (*slog.Logger, func()) {
	var lvl slog.Level
	switch strings.ToLower(cfg.Log.Level) {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	var w io.Writer = os.Stderr
	closer := func() {}
	if cfg.Log.File != "" {
		if r, err := logx.NewRotator(cfg.Log.File, 10<<20, 10); err == nil {
			w = io.MultiWriter(os.Stderr, r)
			closer = func() { r.Close() }
		}
	}
	return slog.New(slog.NewJSONHandler(w, &slog.HandlerOptions{Level: lvl})), closer
}

func runSelfTest(path string) int {
	cfg, err := config.Load(path)
	if err != nil {
		fmt.Println("self-test: config:", err)
		return 1
	}
	st, err := store.Open(cfg.Storage.Dir)
	if err != nil {
		fmt.Println("self-test: store:", err)
		return 1
	}
	st.Close()
	fmt.Println("self-test ok", version.Version)
	return 0
}
