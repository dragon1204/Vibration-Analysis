// Command wtvb-config configures WTVB05 sensors one at a time before they share a
// bus (spec 3.6): factory sensors all use address 0x50 at 9600 bps.
//
//	wtvb-config --port /dev/ttyUSB0 --baud 9600 --addr 0x50 scan
//	wtvb-config --port COM5 --addr 0x50 set-addr 0x11 --save
//	wtvb-config --port COM5 --addr 0x11 set-baud 230400 --save
//	wtvb-config --port COM5 --addr 0x11 --baud 230400 info
//	wtvb-config --port tcp://127.0.0.1:5020 --addr 0x11 raw --sr 4 > frame.csv
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strconv"
	"time"

	"selink.vn/smartmotor/edge/internal/bus"
	"selink.vn/smartmotor/edge/internal/drivers/wtvb05"
	"selink.vn/smartmotor/edge/internal/modbus"
)

func usage() {
	fmt.Fprintf(os.Stderr, `usage: wtvb-config [flags] <command> [args]
commands:
  scan                         probe addresses 0x01..0x7F
  info                         SR, MODE, firmware, live values
  read <reg> [count]           read registers (hex or decimal)
  write <reg> <value>          unlock + write (add --save to persist)
  set-addr <new>               change Modbus address
  set-baud <baud>              change baud (4800..230400) [codes CẦN XÁC MINH]
  set-sr <code>                change sample rate code 0..9
  set-mode <0|1|2>             algorithm mode
  raw                          read one RAWFIFO frame, print CSV (g)
  reboot                       reboot sensor
flags:
`)
	flag.PrintDefaults()
}

func parseNum(s string) uint16 {
	v, err := strconv.ParseUint(s, 0, 16)
	if err != nil {
		fmt.Fprintln(os.Stderr, "bad number:", s)
		os.Exit(2)
	}
	return uint16(v)
}

func main() {
	port := flag.String("port", "/dev/ttyUSB0", "serial device or tcp://host:port")
	baud := flag.Int("baud", 9600, "baud rate")
	addrS := flag.String("addr", "0x50", "sensor address")
	save := flag.Bool("save", false, "persist to sensor flash after writing")
	sr := flag.Int("sr", -1, "raw: set SR code before reading (not persisted)")
	flag.Usage = usage
	flag.Parse()
	if flag.NArg() < 1 {
		usage()
		os.Exit(2)
	}
	addr := byte(parseNum(*addrS))
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	m := bus.New("cfg", *port, *baud, log)
	go m.Run(ctx)
	ctx = bus.WithPriority(ctx, bus.P3)
	s := wtvb05.New(m, wtvb05.Options{ID: "cfg", Addr: addr, Baud: *baud, Timeout: 300 * time.Millisecond}, log)
	args := flag.Args()
	die := func(err error) {
		if err != nil {
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(1)
		}
	}
	switch args[0] {
	case "scan":
		for a := 1; a <= 0x7F; a++ {
			err := m.Do(ctx, "scan", func(c *modbus.RTUClient) error {
				_, e := c.ReadHolding(byte(a), wtvb05.RegSR, 1, 80*time.Millisecond)
				return e
			})
			if err == nil {
				fmt.Printf("found sensor at 0x%02X\n", a)
			}
		}
	case "info":
		info, err := s.Info(ctx)
		die(err)
		fmt.Printf("addr=0x%02X fw=%s sr=%d (%.0f Hz) mode=%d\n", addr, info.Firmware, info.SrCode, wtvb05.SampleRates[info.SrCode], info.Mode)
		ind, err := s.ReadIndicators(ctx)
		die(err)
		fmt.Printf("acc_g=%.3f/%.3f/%.3f vel_mm_s=%.2f/%.2f/%.2f disp_um=%.0f/%.0f/%.0f hz=%.1f/%.1f/%.1f temp=%.2f°C\n",
			ind.AccG[0], ind.AccG[1], ind.AccG[2], ind.VelMMs[0], ind.VelMMs[1], ind.VelMMs[2],
			ind.DispUm[0], ind.DispUm[1], ind.DispUm[2], ind.FreqHz[0], ind.FreqHz[1], ind.FreqHz[2], ind.TempC)
	case "read":
		if len(args) < 2 {
			usage()
			os.Exit(2)
		}
		reg, cnt := parseNum(args[1]), uint16(1)
		if len(args) > 2 {
			cnt = parseNum(args[2])
		}
		die(m.Do(ctx, "cfg", func(c *modbus.RTUClient) error {
			r, e := c.ReadHolding(addr, reg, cnt, 300*time.Millisecond)
			for i, v := range r {
				fmt.Printf("0x%02X = 0x%04X (%d)\n", int(reg)+i, v, int16(v))
			}
			return e
		}))
	case "write":
		if len(args) < 3 {
			usage()
			os.Exit(2)
		}
		die(s.WriteConfig(ctx, parseNum(args[1]), parseNum(args[2]), *save))
		fmt.Println("ok")
	case "set-addr":
		if len(args) < 2 {
			usage()
			os.Exit(2)
		}
		n := parseNum(args[1])
		if n < 1 || n > 0x7F {
			die(fmt.Errorf("address must be 0x01..0x7F"))
		}
		// The sensor answers the write with its old address, then switches.
		die(s.WriteConfig(ctx, wtvb05.RegAddr, n, false))
		if *save {
			s2 := wtvb05.New(m, wtvb05.Options{ID: "cfg2", Addr: byte(n), Baud: *baud, Timeout: 300 * time.Millisecond}, log)
			die(s2.WriteConfig(ctx, wtvb05.RegSave, wtvb05.SaveValue, false))
		}
		fmt.Printf("address changed to 0x%02X (saved=%v)\n", n, *save)
	case "set-baud":
		if len(args) < 2 {
			usage()
			os.Exit(2)
		}
		b, _ := strconv.Atoi(args[1])
		code, ok := wtvb05.BaudCode(b)
		if !ok {
			die(fmt.Errorf("unsupported baud %d", b))
		}
		die(s.WriteConfig(ctx, wtvb05.RegBaud, code, *save))
		fmt.Printf("baud set to %d (code 0x%02X). Reconnect with --baud %d\n", b, code, b)
	case "set-sr":
		if len(args) < 2 {
			usage()
			os.Exit(2)
		}
		die(s.SetSampleRate(ctx, uint8(parseNum(args[1])), *save))
		fmt.Println("ok")
	case "set-mode":
		if len(args) < 2 {
			usage()
			os.Exit(2)
		}
		die(s.WriteConfig(ctx, wtvb05.RegMode, parseNum(args[1]), *save))
		fmt.Println("ok")
	case "raw":
		if *sr >= 0 {
			die(s.SetSampleRate(ctx, uint8(*sr), false))
		}
		f, err := s.ReadRawFrame(ctx)
		die(err)
		fmt.Printf("# fs_hz=%.0f saturated=%v\nx_g,y_g,z_g\n", f.FsHz, f.Saturated)
		for i := range f.Counts[0] {
			fmt.Printf("%.5f,%.5f,%.5f\n", float64(f.Counts[0][i])*wtvb05.AccLSB,
				float64(f.Counts[1][i])*wtvb05.AccLSB, float64(f.Counts[2][i])*wtvb05.AccLSB)
		}
	case "reboot":
		die(s.WriteConfig(ctx, wtvb05.RegSave, wtvb05.RebootValue, false))
		fmt.Println("ok")
	default:
		usage()
		os.Exit(2)
	}
}
