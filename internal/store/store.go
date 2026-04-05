package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type LogEntry struct {
	ID        int64           `json:"id"`
	CreatedAt time.Time       `json:"createdAt"`
	Host      string          `json:"host"`
	Level     string          `json:"level"`
	Message   string          `json:"message"`
	Meta      json.RawMessage `json:"meta,omitempty"`
}

type Stats struct {
	Total        int64            `json:"total"`
	ByLevel      map[string]int64 `json:"byLevel"`
	Last24h      int64            `json:"last24h"`
	RecentPerMin []Bucket         `json:"recentPerMin"`
}

type Bucket struct {
	Minute string `json:"minute"`
	Count  int64  `json:"count"`
}

// SeverityDayBucket は指定日・タイムゾーン内の「1 時間」単位集計（error / critical / fatal）。
type SeverityDayBucket struct {
	Hour     int    `json:"hour"`
	Label    string `json:"label"`
	Error    int64  `json:"error"`
	Critical int64  `json:"critical"`
	Fatal    int64  `json:"fatal"`
}

type SeverityDayResult struct {
	Date     string              `json:"date"`
	Timezone string              `json:"timezone"`
	Buckets  []SeverityDayBucket `json:"buckets"`
}

type Store struct {
	db *sql.DB
}

// Open は PostgreSQL に接続する。dsn は postgres:// 形式（例: DATABASE_URL）。
func Open(ctx context.Context, dsn string) (*Store, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(16)
	db.SetMaxIdleConns(8)
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) migrate(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL,
  host TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  meta JSONB
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs (created_at);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs (level);
`)
	return err
}

func (s *Store) Insert(ctx context.Context, host, level, message string, meta json.RawMessage) (*LogEntry, error) {
	if level == "" {
		level = "info"
	}
	now := time.Now().UTC()
	var metaArg interface{}
	if len(meta) > 0 {
		metaArg = meta
	} else {
		metaArg = nil
	}
	var id int64
	err := s.db.QueryRowContext(ctx, `
INSERT INTO logs (created_at, host, level, message, meta)
VALUES ($1, $2, $3, $4, $5)
RETURNING id`,
		now, host, level, message, metaArg,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return &LogEntry{
		ID:        id,
		CreatedAt: now,
		Host:      host,
		Level:     level,
		Message:   message,
		Meta:      meta,
	}, nil
}

func (s *Store) Stats(ctx context.Context) (*Stats, error) {
	out := &Stats{ByLevel: make(map[string]int64)}

	row := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM logs`)
	if err := row.Scan(&out.Total); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `SELECT level, COUNT(*) FROM logs GROUP BY level`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var lvl string
		var c int64
		if err := rows.Scan(&lvl, &c); err != nil {
			return nil, err
		}
		out.ByLevel[lvl] = c
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	since24 := time.Now().UTC().Add(-24 * time.Hour)
	row = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM logs WHERE created_at >= $1`, since24)
	if err := row.Scan(&out.Last24h); err != nil {
		return nil, err
	}

	cutoff60 := time.Now().UTC().Add(-60 * time.Minute)
	tsRows, err := s.db.QueryContext(ctx, `SELECT created_at FROM logs WHERE created_at >= $1`, cutoff60)
	if err != nil {
		return nil, err
	}
	defer tsRows.Close()
	perMin := make(map[string]int64)
	for tsRows.Next() {
		var ts time.Time
		if err := tsRows.Scan(&ts); err != nil {
			return nil, err
		}
		t := ts.UTC().Truncate(time.Minute)
		key := t.Format(time.RFC3339)
		perMin[key]++
	}
	if err := tsRows.Err(); err != nil {
		return nil, err
	}
	for k, c := range perMin {
		out.RecentPerMin = append(out.RecentPerMin, Bucket{Minute: k, Count: c})
	}
	sort.Slice(out.RecentPerMin, func(i, j int) bool {
		return out.RecentPerMin[i].Minute < out.RecentPerMin[j].Minute
	})
	return out, nil
}

func (s *Store) ListRecent(ctx context.Context, limit int) ([]LogEntry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx, `
SELECT id, created_at, host, level, message, meta FROM logs
ORDER BY id DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []LogEntry
	for rows.Next() {
		var e LogEntry
		var meta []byte
		if err := rows.Scan(&e.ID, &e.CreatedAt, &e.Host, &e.Level, &e.Message, &meta); err != nil {
			return nil, err
		}
		e.CreatedAt = e.CreatedAt.UTC()
		if len(meta) > 0 {
			e.Meta = json.RawMessage(meta)
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

// SeverityDayByHour は dayInLoc の暦日 0:00〜24:00（その Location）における error / critical / fatal を 1 時間ごとに数える。
func (s *Store) SeverityDayByHour(ctx context.Context, dayInLoc time.Time, tzIANA string) (*SeverityDayResult, error) {
	loc := dayInLoc.Location()
	start := time.Date(dayInLoc.Year(), dayInLoc.Month(), dayInLoc.Day(), 0, 0, 0, 0, loc)
	end := start.Add(24 * time.Hour)
	startUTC := start.UTC()
	endUTC := end.UTC()
	dateStr := start.Format("2006-01-02")

	rows, err := s.db.QueryContext(ctx, `
SELECT
  EXTRACT(HOUR FROM (created_at AT TIME ZONE $3))::int AS hr,
  lower(level) AS lvl,
  COUNT(*)::bigint
FROM logs
WHERE created_at >= $1 AND created_at < $2
  AND lower(level) IN ('error', 'critical', 'fatal')
GROUP BY 1, 2
ORDER BY 1, 2
`, startUTC, endUTC, tzIANA)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	perHour := make([]struct{ err, crit, fatal int64 }, 24)
	for rows.Next() {
		var hr int
		var lvl string
		var cnt int64
		if err := rows.Scan(&hr, &lvl, &cnt); err != nil {
			return nil, err
		}
		if hr < 0 || hr > 23 {
			continue
		}
		switch lvl {
		case "error":
			perHour[hr].err = cnt
		case "critical":
			perHour[hr].crit = cnt
		case "fatal":
			perHour[hr].fatal = cnt
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := &SeverityDayResult{
		Date:     dateStr,
		Timezone: tzIANA,
		Buckets:  make([]SeverityDayBucket, 24),
	}
	for h := 0; h < 24; h++ {
		out.Buckets[h] = SeverityDayBucket{
			Hour:     h,
			Label:    fmt.Sprintf("%02d:00", h),
			Error:    perHour[h].err,
			Critical: perHour[h].crit,
			Fatal:    perHour[h].fatal,
		}
	}
	return out, nil
}

var ErrNotFound = errors.New("not found")
