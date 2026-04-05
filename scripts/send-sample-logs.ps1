#requires -Version 5.1
<#
.SYNOPSIS
  代表的なログレベルごとに 1 件ずつ Logview へ送信（動作確認用）

.EXAMPLE
  .\send-sample-logs.ps1
.EXAMPLE
  .\send-sample-logs.ps1 -ApiBase "http://127.0.0.1:8080"
#>
param(
    [string] $ApiBase = $env:LOGVIEW_API_URL
)

$here = $PSScriptRoot
$samples = @(
    @{ Level = 'trace';    Message = 'トレース: 詳細トレース' }
    @{ Level = 'debug';    Message = 'デバッグ: 変数 dump 相当' }
    @{ Level = 'info';     Message = '情報: サービス起動完了' }
    @{ Level = 'warn';     Message = '警告: 設定が未指定のため既定値を使用' }
    @{ Level = 'warning';  Message = '警告(alias): ディスク使用率 80%' }
    @{ Level = 'error';    Message = 'エラー: 外部 API が 503 を返却' }
    @{ Level = 'critical'; Message = '重大: 永続化キューが利用不可' }
    @{ Level = 'fatal';    Message = '致命的: 起動中止' }
)

foreach ($row in $samples) {
    Write-Host ">> $($row.Level): $($row.Message)" -ForegroundColor Cyan
    & "$here\send-log.ps1" -ApiBase $ApiBase -Level $row.Level -Message $row.Message
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Start-Sleep -Milliseconds 200
}

Write-Host "`n完了。フロントのライブ / 集計で確認してください。" -ForegroundColor Green
