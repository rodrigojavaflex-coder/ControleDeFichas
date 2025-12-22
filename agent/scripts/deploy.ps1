param(
  [string]$Output = "agent-deploy",
  [switch]$IncludeNodeModules,
  [int]$RemoveRetries = 3,
  [int]$RetryDelaySeconds = 2
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptDir

function Remove-PathWithRetry {
  param(
    [string]$Path,
    [int]$Retries = 3,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $Retries; $attempt++) {
    try {
      Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
      return
    } catch {
      if ($attempt -eq $Retries) { throw }
      Write-Host "[agente] caminho em uso, tentando novamente em $DelaySeconds s (tentativa $attempt de $Retries)" -ForegroundColor Yellow
      Start-Sleep -Seconds $DelaySeconds
    }
  }
}

Push-Location $agentRoot
try {
  Write-Host "[agente] Build iniciado em $agentRoot" -ForegroundColor Cyan

  npm install
  npm run build

  if (Test-Path $Output) {
    Write-Host "[agente] Limpando saída anterior em $Output" -ForegroundColor Yellow
    Remove-PathWithRetry -Path $Output -Retries $RemoveRetries -DelaySeconds $RetryDelaySeconds
  }

  New-Item -ItemType Directory -Path $Output | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $Output "scripts") | Out-Null

  Copy-Item -Recurse -Force "$agentRoot/dist" "$Output/dist"
  # remove source maps para não levar código-fonte
  Get-ChildItem -Path "$Output/dist" -Recurse -Filter *.map | Remove-Item -Force -ErrorAction SilentlyContinue

  Copy-Item -Force "$agentRoot/package.json" "$Output/package.json"
  Copy-Item -Force "$agentRoot/package-lock.json" "$Output/package-lock.json"
  if (Test-Path "$agentRoot/.env.example") {
    Copy-Item -Force "$agentRoot/.env.example" "$Output/.env.example"
  }
  # scripts auxiliares de atualização
  if (Test-Path "$agentRoot/scripts/atualiza-agente.ps1") {
    Copy-Item -Force "$agentRoot/scripts/atualiza-agente.ps1" "$Output/scripts/atualiza-agente.ps1"
    $batPath = Join-Path $Output "executar-atualizacao.bat"
    @"
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\atualiza-agente.ps1" -PackagePath "C:\\Deploy\\agente" -TargetPath "C:\\agente" -ServiceName "agente-local"
pause
"@ | Out-File -FilePath $batPath -Encoding ASCII -Force
  }

  if ($IncludeNodeModules) {
    Write-Host "[agente] Instalando deps de produção para embutir no pacote" -ForegroundColor Cyan
    npm ci --omit=dev
    Copy-Item -Recurse -Force "$agentRoot/node_modules" "$Output/node_modules"
  }

  Write-Host "[agente] Pacote pronto em $Output (somente build + package*.json)" -ForegroundColor Green
  Write-Host "No servidor: copiar $Output/, criar .env e rodar 'node dist/main.js' ou 'npm start'." -ForegroundColor Green
}
finally {
  Pop-Location
}
