package clock

import (
	"encoding/json"
	"time"
)

// timeKeys are the top-level payload fields that carry a measurement time.
var timeKeys = []string{"ts", "ts_start", "ts_end", "window_start", "window_end"}

// Correct rewrites a queued JSON payload measured during an unverified epoch.
// known: add stepS to its timestamps and record "time_corrected_s";
// unknown (the step could not be measured): mark it "time_unsynced" so the server can treat it.
// Payloads that are not JSON objects are returned unchanged.
func Correct(payload []byte, stepS float64, known bool) []byte {
	var m map[string]json.RawMessage
	if json.Unmarshal(payload, &m) != nil || m == nil {
		return payload
	}
	if !known {
		m["time_unsynced"] = json.RawMessage("true")
	} else {
		if stepS != 0 {
			shift := time.Duration(stepS * float64(time.Second))
			for _, k := range timeKeys {
				var s string
				if raw, ok := m[k]; !ok || json.Unmarshal(raw, &s) != nil {
					continue
				}
				t, err := time.Parse(time.RFC3339Nano, s)
				if err != nil {
					continue
				}
				b, _ := json.Marshal(t.Add(shift).UTC().Format("2006-01-02T15:04:05.000Z"))
				m[k] = b
			}
		}
		b, _ := json.Marshal(stepS)
		m["time_corrected_s"] = b
		delete(m, "time_unsynced")
		for _, k := range []string{"flags", "quality_flags"} {
			var flags []string
			if raw, ok := m[k]; ok && json.Unmarshal(raw, &flags) == nil {
				kept := []string{}
				for _, f := range flags {
					if f != "time_unsynced" {
						kept = append(kept, f)
					}
				}
				m[k], _ = json.Marshal(kept)
			}
		}
	}
	out, err := json.Marshal(m)
	if err != nil {
		return payload
	}
	return out
}
