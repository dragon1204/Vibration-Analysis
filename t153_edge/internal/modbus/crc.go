// Package modbus implements Modbus RTU framing (CRC-16/Modbus) and a minimal
// Modbus TCP client. The WTVB05 RAWFIFO response is non-standard and is handled
// by the wtvb05 driver using the raw transaction helpers in this package.
package modbus

// CRC16 computes CRC-16/Modbus (poly 0xA001 reflected, init 0xFFFF).
func CRC16(data []byte) uint16 {
	crc := uint16(0xFFFF)
	for _, b := range data {
		crc ^= uint16(b)
		for i := 0; i < 8; i++ {
			if crc&1 != 0 {
				crc = (crc >> 1) ^ 0xA001
			} else {
				crc >>= 1
			}
		}
	}
	return crc
}

// AppendCRC appends the CRC low byte first, then high byte (Modbus wire order).
func AppendCRC(frame []byte) []byte {
	c := CRC16(frame)
	return append(frame, byte(c&0xFF), byte(c>>8))
}

// CheckCRC verifies the trailing two CRC bytes of a complete RTU frame.
func CheckCRC(frame []byte) bool {
	if len(frame) < 3 {
		return false
	}
	n := len(frame) - 2
	c := CRC16(frame[:n])
	return frame[n] == byte(c&0xFF) && frame[n+1] == byte(c>>8)
}
