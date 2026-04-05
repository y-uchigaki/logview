package main

import (
	"context"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// コンテナ等で zoneinfo が無い環境でも LoadLocation("Asia/Tokyo") 等を使えるようにする
	_ "time/tzdata"

	"github.com/uchig/logview/internal/api"
	"github.com/uchig/logview/internal/store"
	"github.com/uchig/logview/internal/ws"
)

func main() {
	addr := flag.String("addr", ":8080", "listen address")
	dsn := flag.String("dsn", os.Getenv("DATABASE_URL"), "PostgreSQL DSN (postgres://...). 未指定時は環境変数 DATABASE_URL")
	flag.Parse()

	if *dsn == "" {
		log.Fatal("PostgreSQL の接続先が必要です。環境変数 DATABASE_URL を設定するか、-dsn を指定してください。")
	}

	ctx := context.Background()
	st, err := store.Open(ctx, *dsn)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer st.Close()

	hub := ws.NewHub()
	srv := api.New(st, hub)

	httpSrv := &http.Server{
		Addr:              *addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("logview listening on %s (postgres)", *addr)
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
}
