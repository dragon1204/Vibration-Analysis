//go:build !linux && !darwin

package health

func diskFreeMB(dir string) float64 { return 0 }
