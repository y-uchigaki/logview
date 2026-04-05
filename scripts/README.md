# Logview へログを送る（Windows / PowerShell）

API の `POST /api/logs` に JSON を送るスクリプトです。バックエンドが起動している必要があります。

## 前提

- **PowerShell 5.1 以降**（Windows に標準搭載）
- API のベース URL
  - **Docker Compose 既定**: `http://127.0.0.1:18080`
  - **`go run` など**: 例 `http://127.0.0.1:8080`
- 接続先を変えるときは環境変数 **`LOGVIEW_API_URL`** を設定するか、`-ApiBase` を付けます。

## 実行ポリシー

初回、スクリプトがブロックされる場合:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

一時的に許可だけする場合:

```powershell
powershell -ExecutionPolicy Bypass -File .\send-log.ps1 -Level info -Message "test"
```

## `send-log.ps1`（1 件送信）

```powershell
cd <リポジトリ>\scripts

# 情報
.\send-log.ps1 -Level info -Message "起動完了"

# 警告
.\send-log.ps1 -Level warn -Message "設定なし、既定値を使用"

# エラー
.\send-log.ps1 -Level error -Message "DB接続タイムアウト"

# 致命的
.\send-log.ps1 -Level fatal -Message "起動中止"
```

### 利用できるログレベル（`-Level`）

| 値 | 用途の目安 |
|----|------------|
| `trace` | 詳細トレース |
| `debug` | デバッグ |
| `info` | 通常の情報（既定） |
| `warn` / `warning` | 警告 |
| `error` | エラー |
| `critical` | 重大 |
| `fatal` | 致命的 |

### 主なパラメータ

| パラメータ | 説明 |
|------------|------|
| `-Level` | 上表のいずれか |
| `-Message` | ログ本文。省略時は `[レベル] テストログ` と現在時刻 |
| `-LogHost` | `host` フィールド。省略時は `%COMPUTERNAME%` |
| `-ApiBase` | API のオリジン（末尾 `/` 不要） |
| `-MetaJson` | 任意の JSON 文字列 → リクエストの `meta` に載る |

### 環境変数で API を指定

```powershell
$env:LOGVIEW_API_URL = "http://127.0.0.1:8080"
.\send-log.ps1 -Level info -Message "ローカル API へ"
```

### `meta` 付き

```powershell
.\send-log.ps1 -Level info -Message "付帯データあり" -MetaJson '{"pid":1234,"ver":"1.0.0"}'
```

## `send-sample-logs.ps1`（レベル別サンプルを連続送信）

動作確認用に、代表的なレベルを順に 1 件ずつ送ります。

```powershell
cd <リポジトリ>\scripts
.\send-sample-logs.ps1
```

API を別ポートで動かしている場合:

```powershell
.\send-sample-logs.ps1 -ApiBase "http://127.0.0.1:8080"
```

## 補足

- 成功時、API が返した保存済みログ 1 件が JSON で表示されます。
- フロントの **ライブ** 画面では WebSocket、**集計** 画面では `GET /api/stats` で反映を確認できます。
