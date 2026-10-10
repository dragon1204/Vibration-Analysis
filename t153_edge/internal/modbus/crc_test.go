package modbus

import (
	"encoding/hex"
	"strings"
	"testing"
)

// Hex examples from the WTVB05 datasheet (spec 13.3), address 0x50.
var datasheetFrames = []string{
	"50 03 00 34 00 03 49 84", // read acc
	"50 03 00 3A 00 03 28 47", // read velocity
	"50 03 00 40 00 01 88 5F", // read temp
	"50 03 00 41 00 03 58 5E", // read displacement
	"50 03 00 2C 00 01 48 42", // RAWFIFO
	"50 06 00 69 B5 88 22 A1", // unlock
	"50 06 00 00 00 00 84 4B", // save
	"50 06 00 00 00 FF C4 0B", // reboot
	"50 06 00 29 00 07 14 41", // SR=256 Hz
	"50 06 00 04 00 06 45 88", // baud 115200
	"50 06 00 1A 00 02 24 4D", // address 0x02
	"50 06 00 2B 00 02 75 82", // DRM 600 um
	"50 06 00 07 00 01 F4 4A", // MODE high freq
}

func mustHex(t *testing.T, s string) []byte {
	t.Helper()
	b, err := hex.DecodeString(strings.ReplaceAll(s, " ", ""))
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func TestDatasheetCRC(t *testing.T) {
	for _, s := range datasheetFrames {
		f := mustHex(t, s)
		if !CheckCRC(f) {
			t.Errorf("CRC mismatch for %s", s)
		}
		rebuilt := AppendCRC(append([]byte{}, f[:6]...))
		if hex.EncodeToString(rebuilt) != hex.EncodeToString(f) {
			t.Errorf("AppendCRC(%s) = % X", s, rebuilt)
		}
	}
}

func TestBuilders(t *testing.T) {
	if got := BuildRead(0x50, FuncReadHolding, 0x34, 3); hex.EncodeToString(got) != "5003003400034984" {
		t.Errorf("BuildRead = % X", got)
	}
	if got := BuildWriteSingle(0x50, 0x69, 0xB588); hex.EncodeToString(got) != "50060069b58822a1" {
		t.Errorf("BuildWriteSingle = % X", got)
	}
}
