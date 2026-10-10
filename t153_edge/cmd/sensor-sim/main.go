// Command sensor-sim simulates WTVB05 sensors (and a PT100 module) on a Modbus RTU
// bus over TCP or a serial/PTY port (spec 5.14).
//
//	sensor-sim --listen :5020 --devices 0x11:healthy,0x12:unbalance --pt100-listen :5021
//	socat -d -d pty,raw,echo=0 pty,raw,echo=0   # then: sensor-sim --serial /dev/pts/3
//
// Runtime control (HTTP): GET /devices, POST /scenario?addr=0x11&name=bearing_outer
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"

	"selink.vn/smartmotor/edge/internal/sim"
)

func main() {
	listen := flag.String("listen", ":5020", "TCP listen address for bus A (empty to disable)")
	serialDev := flag.String("serial", "", "serial device/PTY for bus A instead of TCP")
	baud := flag.Int("baud", 230400, "serial baud rate")
	devices := flag.String("devices", "0x11:healthy,0x12:healthy",
		"comma list addr:scenario[:mesh=<mm/s>] (scenarios: "+strings.Join(sim.Scenarios, "|")+")")
	f1x := flag.Float64("f1x", 49.63, "shaft frequency 1X (Hz)")
	lobes := flag.Int("lobes", 0, "screw compressor male lobes (adds mesh tone = lobes×1X)")
	contiguous := flag.Bool("contiguous", false, "emulate gap-free RAWFIFO frames")
	srNeedsSave := flag.Bool("sr-needs-save", false, "emulate firmware where SR only applies after save")
	crcRate := flag.Float64("crc-error-rate", 0, "probability of corrupted responses")
	toRate := flag.Float64("timeout-rate", 0, "probability of no response")
	delay := flag.Int("delay-ms", 0, "extra response delay")
	emulateBaud := flag.Int("emulate-baud", 230400, "delay responses by transfer time at this baud (0=off)")
	ptListen := flag.String("pt100-listen", ":5021", "TCP address for bus B with a PT100 module (empty=off)")
	ptAddr := flag.Int("pt100-addr", 1, "PT100 module address")
	ptTemps := flag.String("pt100-temps", "58,55,33,30", "channel temperatures °C")
	httpAddr := flag.String("http", ":8089", "HTTP control address (empty=off)")
	flag.Parse()

	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	busA := sim.NewBus(log)
	busA.Faults = sim.Faults{CRCErrorRate: *crcRate, TimeoutRate: *toRate, DelayMs: *delay, EmulateBaud: *emulateBaud}
	devs := map[byte]*sim.WTVB{}
	for i, spec := range strings.Split(*devices, ",") {
		parts := strings.Split(strings.TrimSpace(spec), ":")
		if len(parts) < 2 {
			log.Error("bad device spec", "spec", spec)
			os.Exit(2)
		}
		a, err := strconv.ParseUint(parts[0], 0, 8)
		if err != nil || a < 1 || a > 0x7F {
			log.Error("bad address", "spec", spec)
			os.Exit(2)
		}
		d := sim.NewWTVB(byte(a), *f1x, parts[1], int64(i+1))
		d.Contig = *contiguous
		d.SRNeedsSave = *srNeedsSave
		for _, opt := range parts[2:] {
			if v, ok := strings.CutPrefix(opt, "mesh="); ok {
				d.Signal().MeshVelRMS, _ = strconv.ParseFloat(v, 64)
				d.Signal().MeshLobes = *lobes
			}
		}
		devs[byte(a)] = d
		busA.Add(d)
		log.Info("simulated WTVB05", "addr", fmt.Sprintf("0x%02X", a), "scenario", parts[1])
	}

	if *ptListen != "" {
		busB := sim.NewBus(log)
		var temps []float64
		for _, s := range strings.Split(*ptTemps, ",") {
			v, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
			temps = append(temps, v)
		}
		busB.Add(sim.NewPT100(byte(*ptAddr), temps))
		go func() {
			if err := busB.ListenTCP(*ptListen); err != nil {
				log.Error("pt100 bus", "err", err)
			}
		}()
	}

	if *httpAddr != "" {
		mux := http.NewServeMux()
		mux.HandleFunc("/devices", func(w http.ResponseWriter, r *http.Request) {
			out := map[string]string{}
			for a, d := range devs {
				out[fmt.Sprintf("0x%02X", a)] = d.Scenario()
			}
			_ = json.NewEncoder(w).Encode(out)
		})
		mux.HandleFunc("/scenario", func(w http.ResponseWriter, r *http.Request) {
			a, err := strconv.ParseUint(r.URL.Query().Get("addr"), 0, 8)
			d := devs[byte(a)]
			name := r.URL.Query().Get("name")
			if err != nil || d == nil || !valid(name) {
				http.Error(w, "usage: /scenario?addr=0x11&name="+strings.Join(sim.Scenarios, "|"), http.StatusBadRequest)
				return
			}
			d.SetScenario(name)
			log.Info("scenario changed", "addr", fmt.Sprintf("0x%02X", a), "scenario", name)
			fmt.Fprintf(w, "0x%02X -> %s\n", a, name)
		})
		go func() { log.Info("control http", "addr", *httpAddr); _ = http.ListenAndServe(*httpAddr, mux) }()
	}

	var err error
	if *serialDev != "" {
		err = busA.ListenSerial(*serialDev, *baud)
	} else {
		err = busA.ListenTCP(*listen)
	}
	if err != nil {
		log.Error("bus A", "err", err)
		os.Exit(1)
	}
}

func valid(name string) bool {
	for _, s := range sim.Scenarios {
		if s == name {
			return true
		}
	}
	return false
}
