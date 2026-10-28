// Package store keeps the edge's durable state in SQLite (WAL): the MQTT outbox
// (store-and-forward, ADR-05), key/value state and counters, plus wave/spectrum files.
package store

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

// Outbox priorities.
const (
	PrioEvent    = 0
	PrioMetrics  = 1
	PrioFeatures = 2
	PrioWaveform = 3
)

const schema = `
CREATE TABLE IF NOT EXISTS outbox (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic       TEXT NOT NULL,
  qos         INTEGER NOT NULL DEFAULT 1,
  priority    INTEGER NOT NULL DEFAULT 2,
  payload     BLOB NOT NULL,
  created_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  sent_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(sent_at, priority, id);
CREATE TABLE IF NOT EXISTS state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`

// Message is one outbox row.
type Message struct {
	ID       int64
	Topic    string
	QoS      byte
	Priority int
	Payload  []byte
	Attempts int
	// ClockEpoch is set when the message was measured before the wall clock was verified.
	ClockEpoch string
}

// Store wraps the SQLite DB and the file directory.
type Store struct {
	db  *sql.DB
	dir string
	mu  sync.Mutex
	// notify is signalled when a message is enqueued.
	notify chan struct{}
	// epoch returns the open clock epoch ("" while the clock is verified).
	epoch func() string
}

// Open opens (or creates) <dir>/edge.db.
func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	dsn := "file:" + filepath.ToSlash(filepath.Join(dir, "edge.db")) +
		"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	if err := addColumn(db, "outbox", "clk_epoch", "TEXT NOT NULL DEFAULT ''"); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db, dir: dir, notify: make(chan struct{}, 1), epoch: func() string { return "" }}, nil
}

// addColumn migrates an existing database (SQLite has no ADD COLUMN IF NOT EXISTS).
func addColumn(db *sql.DB, table, col, def string) error {
	rows, err := db.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		if name == col {
			return nil
		}
	}
	_, err = db.Exec(fmt.Sprintf(`ALTER TABLE %s ADD COLUMN %s %s`, table, col, def))
	return err
}

// SetClockEpoch installs the clock-epoch source used to tag new outbox messages.
func (s *Store) SetClockEpoch(f func() string) { s.epoch = f }

// ClockStepKey is the state key holding the measured step (seconds) of a clock epoch.
func ClockStepKey(epoch string) string { return "clock_step/" + epoch }

// Close closes the DB.
func (s *Store) Close() error { return s.db.Close() }

// Dir returns the data directory.
func (s *Store) Dir() string { return s.dir }

// Notify returns a channel signalled on new outbox messages.
func (s *Store) Notify() <-chan struct{} { return s.notify }

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }

// Enqueue appends a message to the outbox.
func (s *Store) Enqueue(topic string, qos byte, prio int, payload []byte) error {
	_, err := s.db.Exec(`INSERT INTO outbox(topic,qos,priority,payload,created_at,clk_epoch) VALUES(?,?,?,?,?,?)`,
		topic, qos, prio, payload, now(), s.epoch())
	if err == nil {
		select {
		case s.notify <- struct{}{}:
		default:
		}
	}
	return err
}

// Pending returns up to limit unsent messages ordered by priority, id. Messages of the
// held clock epoch (still waiting for its step) are skipped; hold "" skips nothing.
func (s *Store) Pending(limit int, hold string) ([]Message, error) {
	rows, err := s.db.Query(`SELECT id,topic,qos,priority,payload,attempts,clk_epoch FROM outbox
		WHERE sent_at IS NULL AND (?='' OR clk_epoch<>?) ORDER BY priority, id LIMIT ?`, hold, hold, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		var qos int
		if err := rows.Scan(&m.ID, &m.Topic, &qos, &m.Priority, &m.Payload, &m.Attempts, &m.ClockEpoch); err != nil {
			return nil, err
		}
		m.QoS = byte(qos)
		out = append(out, m)
	}
	return out, rows.Err()
}

// Ack deletes a message after PUBACK.
func (s *Store) Ack(id int64) error {
	_, err := s.db.Exec(`DELETE FROM outbox WHERE id=?`, id)
	return err
}

// Fail increments the attempt counter.
func (s *Store) Fail(id int64) error {
	_, err := s.db.Exec(`UPDATE outbox SET attempts=attempts+1 WHERE id=?`, id)
	return err
}

// PendingCount returns the number of unsent messages.
func (s *Store) PendingCount() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM outbox WHERE sent_at IS NULL`).Scan(&n)
	return n, err
}

// SetState stores a key/value pair.
func (s *Store) SetState(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO state(key,value,updated_at) VALUES(?,?,?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, key, value, now())
	return err
}

// GetState reads a value ("" and false if absent).
func (s *Store) GetState(key string) (string, bool, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM state WHERE key=?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return v, err == nil, err
}

// Incr increments a counter and returns the new value.
func (s *Store) Incr(key string, delta int64) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.db.Exec(`INSERT INTO counters(key,value) VALUES(?,?)
		ON CONFLICT(key) DO UPDATE SET value=value+excluded.value`, key, delta); err != nil {
		return 0, err
	}
	var v int64
	err := s.db.QueryRow(`SELECT value FROM counters WHERE key=?`, key).Scan(&v)
	return v, err
}

// Counter reads a counter (0 if absent).
func (s *Store) Counter(key string) (int64, error) {
	var v int64
	err := s.db.QueryRow(`SELECT value FROM counters WHERE key=?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return v, err
}

// FlashWriteKey returns the per-day flash-write counter key (ADR-04).
func FlashWriteKey(point string, t time.Time) string {
	return "flash_writes/" + point + "/" + t.UTC().Format("2006-01-02")
}

// WriteFile stores a data file under dir (rel path uses forward slashes).
func (s *Store) WriteFile(rel string, data []byte) error {
	p := filepath.Join(s.dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// CaptureRel builds raw/<point>/<yyyy>/<mm>/<dd>/<capture_id>.<ext>.
func CaptureRel(kind, point string, ts time.Time, captureID, ext string) string {
	return fmt.Sprintf("%s/%s/%s/%s%s", kind, point, ts.UTC().Format("2006/01/02"), captureID, ext)
}

// Prune enforces retention: outbox rows older than retentionDays are dropped
// (waveforms first), files older than retention removed, and when total size
// exceeds maxBytes the oldest raw files and waveform messages are removed first,
// keeping events and metrics (spec 5.9).
func (s *Store) Prune(retentionDays int, maxBytes int64) (removedFiles int, err error) {
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	if _, err = s.db.Exec(`DELETE FROM outbox WHERE created_at < ?`, cutoff.Format(time.RFC3339Nano)); err != nil {
		return
	}
	type fileInfo struct {
		path string
		size int64
		mod  time.Time
		kind string
	}
	var files []fileInfo
	var total int64
	for _, kind := range []string{"raw", "spec"} {
		root := filepath.Join(s.dir, kind)
		_ = filepath.WalkDir(root, func(p string, d fs.DirEntry, e error) error {
			if e != nil || d.IsDir() {
				return nil
			}
			info, e := d.Info()
			if e != nil {
				return nil
			}
			if info.ModTime().Before(cutoff) {
				if os.Remove(p) == nil {
					removedFiles++
				}
				return nil
			}
			files = append(files, fileInfo{p, info.Size(), info.ModTime(), kind})
			total += info.Size()
			return nil
		})
	}
	if fi, e := os.Stat(filepath.Join(s.dir, "edge.db")); e == nil {
		total += fi.Size()
	}
	if total <= maxBytes {
		return
	}
	// Drop queued waveforms first.
	if _, err = s.db.Exec(`DELETE FROM outbox WHERE priority=?`, PrioWaveform); err != nil {
		return
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].kind != files[j].kind {
			return files[i].kind == "raw"
		}
		return files[i].mod.Before(files[j].mod)
	})
	for _, f := range files {
		if total <= maxBytes*9/10 {
			break
		}
		if os.Remove(f.path) == nil {
			total -= f.size
			removedFiles++
		}
	}
	return
}

// DiskUsage returns the total size of files under dir.
func (s *Store) DiskUsage() int64 {
	var total int64
	_ = filepath.WalkDir(s.dir, func(p string, d fs.DirEntry, e error) error {
		if e == nil && !d.IsDir() && !strings.HasSuffix(p, ".tmp") {
			if info, e := d.Info(); e == nil {
				total += info.Size()
			}
		}
		return nil
	})
	return total
}
