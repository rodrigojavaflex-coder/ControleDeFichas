param(
  # Caminho onde o pacote atualizado foi deixado (pasta ou .zip)
  [string]$PackagePath = "C:\\Deploy\\agente",
  # Caminho onde o serviço roda de fato
  [string]$TargetPath = "C:\\agente",
  [string]$ServiceName = "agente-local",
  [string]$NssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
)

$ErrorActionPreference = "Stop"

function Ensure-Nssm {
  param([string]$Url, [string]$DestRoot)

  $nssmExe = Join-Path $DestRoot "nssm.exe"
  if (Test-Path $nssmExe) { return $nssmExe }

  Write-Host "[nssm] baixando e extraindo..." -ForegroundColor Cyan
  $tmpZip = Join-Path $env:TEMP "nssm.zip"
  Invoke-WebRequest -Uri $Url -OutFile $tmpZip
  $tmpDir = Join-Path $env:TEMP "nssm_extracted"
  if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
  Expand-Archive -Path $tmpZip -DestinationPath $tmpDir

  $extracted = Get-ChildItem -Path $tmpDir -Directory | Select-Object -First 1
  $srcExe = Join-Path $extracted.FullName "win64\\nssm.exe"
  New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null
  Copy-Item $srcExe $nssmExe -Force
  Remove-Item $tmpZip -Force
  Remove-Item $tmpDir -Recurse -Force
  return $nssmExe
}

function Get-PackageFolder {
  param([string]$Path)
  if (Test-Path $Path -PathType Container) { return (Resolve-Path $Path).Path }
  if ($Path.ToLower().EndsWith(".zip")) {
    $tmp = Join-Path $env:TEMP "agent_pkg"
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    Expand-Archive -Path $Path -DestinationPath $tmp
    return (Resolve-Path $tmp | Select-Object -First 1).Path
  }
  throw "Caminho do pacote inválido: $Path"
}

# Localiza node.exe
function Resolve-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Node não encontrado no PATH. Instale Node LTS."
}

# Instala Node se não existir
function Ensure-Node {
  try {
    return Resolve-Node
  } catch {
    Write-Host "[node] Node não encontrado. Instalando Node LTS via winget..." -ForegroundColor Yellow
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) { throw "winget não encontrado. Instale Node manualmente ou adicione ao PATH." }
    winget install -e --id OpenJS.NodeJS.LTS -h
    return Resolve-Node
  }
}

$pkgFolder = Get-PackageFolder -Path $PackagePath
Write-Host "[agente] pacote origem: $pkgFolder" -ForegroundColor Cyan

# garante Node e NSSM disponíveis antes de mexer no serviço
$nodeExe = Ensure-Node
$nssmExe = Ensure-Nssm -Url $NssmUrl -DestRoot "C:\\nssm"
Write-Host "[serviço] usando nssm: $nssmExe" -ForegroundColor Cyan

# para e remove serviço existente (se houver)
try { & $nssmExe stop $ServiceName 2>$null | Out-Null } catch {}
try { & $nssmExe remove $ServiceName confirm 2>$null | Out-Null } catch {}

# preserva .env existente
$envBackup = $null
$envPath = Join-Path $TargetPath ".env"
if (Test-Path $envPath) {
  $envBackup = Join-Path $env:TEMP "agent_env_backup.env"
  Copy-Item $envPath $envBackup -Force
}

Write-Host "[agente] atualizando $TargetPath" -ForegroundColor Cyan
if (Test-Path $TargetPath) { Remove-Item -Recurse -Force $TargetPath }
New-Item -ItemType Directory -Path $TargetPath | Out-Null

Copy-Item -Recurse -Force (Join-Path $pkgFolder "dist") (Join-Path $TargetPath "dist")
Copy-Item -Force (Join-Path $pkgFolder "package.json") (Join-Path $TargetPath "package.json")
Copy-Item -Force (Join-Path $pkgFolder "package-lock.json") (Join-Path $TargetPath "package-lock.json")
if (Test-Path (Join-Path $pkgFolder ".env.example")) {
  Copy-Item -Force (Join-Path $pkgFolder ".env.example") (Join-Path $TargetPath ".env.example")
}
if (Test-Path (Join-Path $pkgFolder "node_modules")) {
  Write-Host "[agente] copiando node_modules do pacote" -ForegroundColor Yellow
  Copy-Item -Recurse -Force (Join-Path $pkgFolder "node_modules") (Join-Path $TargetPath "node_modules")
}

# restaura .env
if ($envBackup) {
  Copy-Item $envBackup $envPath -Force
  Remove-Item $envBackup -Force
} else {
  Write-Host "[agente] ATENÇÃO: crie o .env em $TargetPath (.env.example disponível se copiado)" -ForegroundColor Yellow
}

# instala deps se necessário
if (-not (Test-Path (Join-Path $TargetPath "node_modules"))) {
  Write-Host "[agente] instalando dependências de produção (npm ci --omit=dev)" -ForegroundColor Cyan
  Push-Location $TargetPath
  try { npm ci --omit=dev }
  finally { Pop-Location }
}

# reinstala e inicia serviço
& $nssmExe install $ServiceName $nodeExe (Join-Path $TargetPath "dist\\main.js")
& $nssmExe set $ServiceName AppDirectory $TargetPath
& $nssmExe set $ServiceName Start SERVICE_AUTO_START
& $nssmExe set $ServiceName AppStdout (Join-Path $TargetPath "logs\\stdout.log")
& $nssmExe set $ServiceName AppStderr (Join-Path $TargetPath "logs\\stderr.log")
& $nssmExe set $ServiceName AppRotateFiles 1
& $nssmExe set $ServiceName AppRotateBytes 1048576
& $nssmExe set $ServiceName AppRotateKeep 5

& $nssmExe start $ServiceName
Write-Host "[serviço] serviço '$ServiceName' iniciado." -ForegroundColor Green
Write-Host "[verificação] tail: Get-Content -Path \"$TargetPath\\logs\\stdout.log\" -Wait" -ForegroundColor Gray
