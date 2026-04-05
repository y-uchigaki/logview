package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/uchig/logview/internal/store"
	wshub "github.com/uchig/logview/internal/ws"
)

// wsCheckOrigin: 既定はすべて許可。LOGVIEW_WS_STRICT=1|true|yes のときだけ
// localhost / 127.0.0.1 / ::1 の http(s) に限定（それ以外の Origin は拒否してログに出す）。
func wsCheckOrigin(r *http.Request) bool {
	s := strings.TrimSpace(os.Getenv("LOGVIEW_WS_STRICT"))
	useStrict := s == "1" || strings.EqualFold(s, "true") || strings.EqualFold(s, "yes")
	if !useStrict {
		return true
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	ok := strings.HasPrefix(origin, "http://localhost:") ||
		strings.HasPrefix(origin, "http://127.0.0.1:") ||
		strings.HasPrefix(origin, "http://[::1]:") ||
		strings.HasPrefix(origin, "https://localhost:") ||
		strings.HasPrefix(origin, "https://127.0.0.1:") ||
		strings.HasPrefix(origin, "https://[::1]:")
	if !ok {
		log.Printf("ws CheckOrigin: rejected strict mode, origin=%q (unset LOGVIEW_WS_STRICT to allow)", origin)
	}
	return ok
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     wsCheckOrigin,
}

type Server struct {
	Store *store.Store
	Hub   *wshub.Hub
	Mux   *http.ServeMux
}

type ingestBody struct {
	Host    string          `json:"host"`
	Level   string          `json:"level"`
	Message string          `json:"message"`
	Meta    json.RawMessage `json:"meta"`
}

func New(s *store.Store, hub *wshub.Hub) *Server {
	srv := &Server{Store: s, Hub: hub, Mux: http.NewServeMux()}
	srv.Mux.HandleFunc("POST /api/logs", srv.handlePostLog)
	srv.Mux.HandleFunc("GET /api/stats", srv.handleStats)
	srv.Mux.HandleFunc("GET /api/stats/severity-day", srv.handleStatsSeverityDay)
	srv.Mux.HandleFunc("GET /api/logs", srv.handleListLogs)
	srv.Mux.HandleFunc("GET /ws", srv.handleWS)
	srv.Mux.HandleFunc("GET /openapi.yaml", srv.handleOpenAPIYAML)
	srv.Mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	return srv
}

func (srv *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		srv.Mux.ServeHTTP(w, r)
	})
}

func (srv *Server) handlePostLog(w http.ResponseWriter, r *http.Request) {
	var body ingestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Message) == "" {
		http.Error(w, "message required", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	entry, err := srv.Store.Insert(ctx, body.Host, body.Level, body.Message, body.Meta)
	if err != nil {
		log.Printf("insert: %v", err)
		http.Error(w, "store error", http.StatusInternalServerError)
		return
	}
	srv.Hub.BroadcastJSON(map[string]any{"type": "log", "log": entry})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(entry)
}

func (srv *Server) handleStatsSeverityDay(w http.ResponseWriter, r *http.Request) {
	dateStr := strings.TrimSpace(r.URL.Query().Get("date"))
	if dateStr == "" {
		http.Error(w, "date required (YYYY-MM-DD)", http.StatusBadRequest)
		return
	}
	// クライアント差で 2026/04/04 等が来る場合も受ける
	dateStr = strings.ReplaceAll(dateStr, "/", "-")
	tzName := strings.TrimSpace(r.URL.Query().Get("timezone"))
	if tzName == "" {
		tzName = "Asia/Tokyo"
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		http.Error(w, "invalid timezone", http.StatusBadRequest)
		return
	}
	day, err := time.ParseInLocation("2006-01-02", dateStr, loc)
	if err != nil {
		http.Error(w, "invalid date (use YYYY-MM-DD): "+dateStr, http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	out, err := srv.Store.SeverityDayByHour(ctx, day, tzName)
	if err != nil {
		log.Printf("severity-day: %v", err)
		http.Error(w, "store error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

func (srv *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	st, err := srv.Store.Stats(ctx)
	if err != nil {
		log.Printf("stats: %v", err)
		http.Error(w, "store error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(st)
}

func (srv *Server) handleListLogs(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	list, err := srv.Store.ListRecent(ctx, 100)
	if err != nil {
		http.Error(w, "store error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}

func (srv *Server) handleOpenAPIYAML(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	_, _ = w.Write(openAPIYAML)
}

func (srv *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	c, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}
	srv.Hub.Register(c)
	defer func() {
		srv.Hub.Unregister(c)
		_ = c.Close()
	}()
	// クライアントは購読のみでフレームを送らないため、ReadDeadline だけ付けると
	// 無通信タイムアウトで切断される。Ping/Pong 無しの deadline は付けない。
	for {
		_, _, err := c.ReadMessage()
		if err != nil {
			break
		}
	}
}
