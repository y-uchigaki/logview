#requires -Version 5.1
<#
.SYNOPSIS
  Logview へ JSON でログを POST する（Windows / PowerShell）

.EXAMPLE
  .\send-log.ps1 -Level info -Message "起動完了"
.EXAMPLE
  $env:LOGVIEW_API_URL = "http://127.0.0.1:8080"
  .\send-log.ps1 -Level error -Message "DB接続失敗"
#>
param(
    [string] $ApiBase = $env:LOGVIEW_API_URL,

    [Parameter(Mandatory = $false)]
    [ValidateSet(
        'trace', 'debug', 'info', 'warn', 'warning', 'error', 'fatal', 'critical'
    )]
    [string] $Level = 'info',

    [Parameter(Mandatory = $false)]
    [string] $Message = '',

    [string] $LogHost = $env:COMPUTERNAME,

    [string] $MetaJson = ''
)

if ([string]::IsNullOrWhiteSpace($ApiBase)) {
    $ApiBase = 'http://127.0.0.1:18080'
}
$ApiBase = $ApiBase.TrimEnd('/')

if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "[$Level] テストログ $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

$payload = [ordered]@{
    host    = $LogHost
    level   = $Level
    message = $Message
}

if (-not [string]::IsNullOrWhiteSpace($MetaJson)) {
    try {
        $payload['meta'] = $MetaJson | ConvertFrom-Json
    }
    catch {
        Write-Error "MetaJson は有効な JSON 文字列にしてください: $_"
        exit 1
    }
}

$json = $payload | ConvertTo-Json -Compress -Depth 10
try {
    $res = Invoke-RestMethod -Uri "$ApiBase/api/logs" -Method Post -Body $json `
        -ContentType 'application/json; charset=utf-8'
    $res | ConvertTo-Json -Depth 5
}
catch {
    Write-Error "POST 失敗 ($ApiBase): $_"
    exit 1
}
