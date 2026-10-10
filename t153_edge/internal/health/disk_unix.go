//go:build linux || darwin

package health

import "syscall"

func diskFreeMB(dir string) float64 {
	var st syscall.Statfs_t
	if err := syscall.Statfs(dir, &st); err != nil {
		return 0
	}
	return round1(float64(st.Bavail) * float64(st.Bsize) / (1 << 20))
}
