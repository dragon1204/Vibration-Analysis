// Package wtvb05 implements the WitMotion WTVB05-485 driver (spec 3.1).
package wtvb05

// Register addresses (spec 3.1.3).
const (
	RegSave    = 0x00
	RegRRate   = 0x03
	RegBaud    = 0x04
	RegCANBaud = 0x05
	RegMode    = 0x07
	RegStatic  = 0x08
	RegAddr    = 0x1A
	RegSR      = 0x29
	RegDRM     = 0x2B
	RegRawFIFO = 0x2C
	// RegVersion is the firmware version register in the WitMotion standard map.
	// [CẦN XÁC MINH] not listed in the WTVB05 datasheet; reading is best-effort.
	RegVersion = 0x2E
	RegUnlock  = 0x69

	UnlockKey     = 0xB588
	SaveValue     = 0x0000
	RebootValue   = 0x00FF
	FactoryValue  = 0x0001
	unlockValidS  = 10
	samplesPerRaw = 1024
	rawRespLen    = 3 + samplesPerRaw*6 + 2 // 6149
)

// Read blocks (spec 3.1.3 "Kế hoạch đọc khối").
const (
	B1Start, B1Count = 0x34, 19 // instantaneous
	B2Start, B2Count = 0x47, 39 // statistics
	B3Start, B3Count = 0x6E, 45 // spectrum energy
)

// Offsets inside block B1 (relative to 0x34).
const (
	b1Acc  = 0x34 - B1Start
	b1AccF = 0x37 - B1Start
	b1Vel  = 0x3A - B1Start
	b1Temp = 0x40 - B1Start
	b1Disp = 0x41 - B1Start
	b1Hz   = 0x44 - B1Start
)

// Per-axis statistics layout in block B2: 12 registers per axis, then ERRX..Z.
const (
	statCF = iota
	statK
	statAAVG
	statVAR
	statRRA
	statWI
	statPI
	statPC
	statSK
	statVRMS
	statVK
	statDRMS
	statPerAxis
)

// SampleRates maps SR code to sampling frequency in Hz (spec 3.1.4).
var SampleRates = map[uint8]float64{
	0x00: 32000, 0x01: 16000, 0x02: 8000, 0x03: 4000, 0x04: 2000,
	0x05: 1000, 0x06: 512, 0x07: 256, 0x08: 128, 0x09: 64,
}

// BaudCodes maps BAUD register codes to baud rates.
// 0x03 and 0x06 are confirmed by datasheet examples; others [CẦN XÁC MINH].
var BaudCodes = map[uint16]int{
	0x01: 4800, 0x02: 9600, 0x03: 19200, 0x04: 38400, 0x05: 57600, 0x06: 115200, 0x07: 230400,
}

// BaudCode returns the register code for a baud rate.
func BaudCode(baud int) (uint16, bool) {
	for k, v := range BaudCodes {
		if v == baud {
			return k, true
		}
	}
	return 0, false
}

// AccLSB is g per LSB: 16 g full scale on int16.
const AccLSB = 16.0 / 32768.0

// G is standard gravity in m/s^2.
const G = 9.80665
