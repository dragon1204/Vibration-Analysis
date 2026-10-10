// Package version holds build information injected via -ldflags.
package version

var (
	// Version is set at build time: -X selink.vn/smartmotor/edge/internal/version.Version=$(git describe)
	Version = "dev"
	// Commit is the git commit hash (optional).
	Commit = ""
)
