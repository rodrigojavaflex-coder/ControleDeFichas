param(
  [switch]$Production,
  [switch]$ErrorOnly,
  [switch]$NoLog,
  [switch]$NewVersion,
  [string]$AppVersion = ''
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Title,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Action
}

function Get-SemverParts {
  param([Parameter(Mandatory = $true)][string]$Version)
  if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    throw "Versao invalida '$Version'. Use o formato x.y.z (ex.: 1.3.9)."
  }
  return @{
    Major = [int]$Matches[1]
    Minor = [int]$Matches[2]
    Patch = [int]$Matches[3]
  }
}

function ConvertTo-VersionCode {
  param(
    [Parameter(Mandatory = $true)][int]$Major,
    [Parameter(Mandatory = $true)][int]$Minor,
    [Parameter(Mandatory = $true)][int]$Patch
  )
  return ($Major * 10000) + ($Minor * 100) + $Patch
}

function Write-Utf8NoBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Update-MobileAppVersionsCatalog {
  param(
    [Parameter(Mandatory = $true)][string]$CatalogPath,
    [Parameter(Mandatory = $true)][string]$TargetVersion,
    [Parameter(Mandatory = $true)][string]$VersionDate
  )

  $entries = @()
  if (Test-Path $CatalogPath) {
    $raw = [System.IO.File]::ReadAllText($CatalogPath)
    if ($raw.Length -gt 0 -and [int][char]$raw[0] -eq 0xFEFF) {
      $raw = $raw.Substring(1)
    }
    $catalog = $raw | ConvertFrom-Json
    if ($null -ne $catalog.versions) {
      foreach ($item in @($catalog.versions)) {
        if ($null -eq $item) { continue }
        if ($item -is [string]) {
          $ver = "$item".Trim()
          if ($ver) {
            $entries += [pscustomobject]@{ version = $ver; date = $null }
          }
        } else {
          $ver = "$($item.version)".Trim()
          if (-not $ver) { continue }
          $dt = "$($item.date)".Trim()
          if ($dt -notmatch '^\d{4}-\d{2}-\d{2}$') { $dt = $null }
          $entries += [pscustomobject]@{ version = $ver; date = $dt }
        }
      }
    }
  } else {
    $catalogDir = Split-Path $CatalogPath -Parent
    if (-not (Test-Path $catalogDir)) {
      New-Item -ItemType Directory -Path $catalogDir | Out-Null
    }
  }

  $existing = $entries | Where-Object { $_.version -eq $TargetVersion } | Select-Object -First 1
  if ($null -eq $existing) {
    $entries = @(
      [pscustomobject]@{ version = $TargetVersion; date = $VersionDate }
    ) + $entries
    Write-Host "Catalogo de versoes: adicionada $TargetVersion ($VersionDate)" -ForegroundColor Green
  } else {
    if (-not $existing.date) {
      $existing.date = $VersionDate
      Write-Host "Catalogo de versoes: data atualizada em $TargetVersion ($VersionDate)" -ForegroundColor Green
    } else {
      Write-Host "Catalogo de versoes ja contem $TargetVersion" -ForegroundColor DarkYellow
    }
  }

  $payloadObj = @{
    versions = @(
      $entries | ForEach-Object {
        @{
          version = $_.version
          date = $_.date
        }
      }
    )
  }
  $payload = $payloadObj | ConvertTo-Json -Depth 5
  Write-Utf8NoBom -Path $CatalogPath -Content $payload
}

function Update-MobileAppVersion {
  param(
    [Parameter(Mandatory = $true)][string]$RootDir,
    [Parameter(Mandatory = $true)][string]$TargetVersion
  )

  $parts = Get-SemverParts -Version $TargetVersion
  $versionCode = ConvertTo-VersionCode -Major $parts.Major -Minor $parts.Minor -Patch $parts.Patch
  $versionDate = Get-Date -Format 'yyyy-MM-dd'

  $appVersionTs = Join-Path $RootDir "mobile\src\app\constants\app-version.ts"
  $buildGradle = Join-Path $RootDir "mobile\android\app\build.gradle"
  $mobilePackageJson = Join-Path $RootDir "mobile\package.json"
  $catalogPath = Join-Path $RootDir "backend\src\data\mobile-app-versions.json"

  if (-not (Test-Path $appVersionTs)) {
    throw "Arquivo nao encontrado: $appVersionTs"
  }
  if (-not (Test-Path $buildGradle)) {
    throw "Arquivo nao encontrado: $buildGradle"
  }

  $tsContent = @"
export const APP_VERSION = '$TargetVersion';
export const APP_BUILD = '$versionCode';
export const APP_VERSION_DATE = '$versionDate';
"@
  Write-Utf8NoBom -Path $appVersionTs -Content $tsContent

  $gradle = Get-Content -Path $buildGradle -Raw
  $gradle = [regex]::Replace($gradle, 'versionCode\s+\d+', "versionCode $versionCode")
  $gradle = [regex]::Replace($gradle, 'versionName\s+"[^"]+"', "versionName `"$TargetVersion`"")
  Write-Utf8NoBom -Path $buildGradle -Content $gradle

  if (Test-Path $mobilePackageJson) {
    $pkgRaw = [System.IO.File]::ReadAllText($mobilePackageJson)
    if ($pkgRaw.Length -gt 0 -and [int][char]$pkgRaw[0] -eq 0xFEFF) {
      $pkgRaw = $pkgRaw.Substring(1)
    }
    $pkgUpdated = [regex]::Replace(
      $pkgRaw,
      '"version"\s*:\s*"[^"]+"',
      ('"version": "' + $TargetVersion + '"'),
      1
    )
    Write-Utf8NoBom -Path $mobilePackageJson -Content $pkgUpdated
  }

  Update-MobileAppVersionsCatalog -CatalogPath $catalogPath -TargetVersion $TargetVersion -VersionDate $versionDate

  Write-Host "Versao do app atualizada para $TargetVersion (versionCode $versionCode, data $versionDate)" -ForegroundColor Green
  Write-Host "Login e Sobre usam APP_VERSION em mobile/src/app/constants/app-version.ts." -ForegroundColor Green
  Write-Host "Lembrete: so defina a versao minima em Configuracao DEPOIS de instalar este APK nos aparelhos." -ForegroundColor DarkYellow
}

$rootDir = $PSScriptRoot
$mobileDir = Join-Path $rootDir "mobile"
$androidDir = Join-Path $mobileDir "android"
$adbDir = "C:\Users\rodrigo.teixeira\AppData\Local\Android\Sdk\platform-tools"
$adbExe = Join-Path $adbDir "adb.exe"
$packageName = "com.sistemasfarmamais.app"
$apkPath = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
$appVersionTsPath = Join-Path $mobileDir "src\app\constants\app-version.ts"

if ($Production) {
  $buildConfig = 'production'
  $apiUrl = 'https://controledefichas.onrender.com/api'
} else {
  $buildConfig = 'development'
  $apiUrl = 'https://api-dev.sistemasfarmamais.com/api'
}

Write-Host ""
Write-Host "Ambiente: $buildConfig | API: $apiUrl" -ForegroundColor Yellow
if ($Production) {
  Write-Host "Atencao: o app usara a API de producao no Render." -ForegroundColor DarkYellow
} else {
  Write-Host "Desenvolvimento: tunnel api-dev -> localhost:3000. O backend do OMNI precisa estar parado." -ForegroundColor DarkYellow
}

if ($NewVersion -or -not [string]::IsNullOrWhiteSpace($AppVersion)) {
  Invoke-Step -Title "Bump versao do aplicativo mobile" -Action {
    $currentRaw = Get-Content -Path $appVersionTsPath -Raw
    if ($currentRaw -notmatch "APP_VERSION\s*=\s*'([^']+)'") {
      throw "Nao foi possivel ler APP_VERSION em $appVersionTsPath"
    }
    $currentVersion = $Matches[1]

    if (-not [string]::IsNullOrWhiteSpace($AppVersion)) {
      $targetVersion = $AppVersion.Trim()
    } else {
      $parts = Get-SemverParts -Version $currentVersion
      $targetVersion = "{0}.{1}.{2}" -f $parts.Major, $parts.Minor, ($parts.Patch + 1)
    }

    Write-Host "Versao atual: $currentVersion -> nova: $targetVersion" -ForegroundColor Yellow
    Update-MobileAppVersion -RootDir $rootDir -TargetVersion $targetVersion
  }
}

Invoke-Step -Title "Build e sync (mobile - $buildConfig)" -Action {
  Set-Location $mobileDir
  npm run build -- --configuration $buildConfig
  if ($LASTEXITCODE -ne 0) { throw "Falha no build Angular (exit $LASTEXITCODE)." }
  npx cap sync android
  if ($LASTEXITCODE -ne 0) { throw "Falha no cap sync android (exit $LASTEXITCODE)." }
  npm run fix:agp9-proguard
  if ($LASTEXITCODE -ne 0) { throw "Falha no fix AGP9 proguard (exit $LASTEXITCODE)." }
}

Invoke-Step -Title "Clean e assembleDebug (android)" -Action {
  Set-Location $androidDir
  .\gradlew --stop
  .\gradlew clean --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "Falha no gradle clean (exit $LASTEXITCODE)." }
  .\gradlew assembleDebug --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "Falha no gradle assembleDebug (exit $LASTEXITCODE)." }
}

Invoke-Step -Title "Configurar adb na sessao (se necessario)" -Action {
  if (-not (Test-Path $adbExe)) {
    throw "adb.exe nao encontrado em: $adbExe"
  }

  if ($env:Path -notlike "*$adbDir*") {
    $env:Path += ";$adbDir"
  }
}

Invoke-Step -Title "Reinstalar app limpo no emulador" -Action {
  & $adbExe uninstall $packageName | Out-Host
  & $adbExe install -r $apkPath | Out-Host
}

Invoke-Step -Title "Limpar logcat" -Action {
  & $adbExe logcat -c
}

if (-not $NoLog) {
  Invoke-Step -Title "Monitorar logs (Ctrl+C para parar)" -Action {
    $patterns = "com.sistemasfarmamais.app|chromium|NetworkService|SIGTRAP|Fatal signal|ERR_|Http failure|Failed to load|net::"
    if ($ErrorOnly) {
      & $adbExe logcat "*:E" |
        Select-String -Pattern $patterns -CaseSensitive:$false |
        Where-Object { $_.Line -notmatch 'too few uniforms or varyings' }
    } else {
      & $adbExe logcat |
        Select-String -Pattern $patterns -CaseSensitive:$false |
        Where-Object { $_.Line -notmatch 'too few uniforms or varyings' }
    }
  }
} else {
  Write-Host ""
  Write-Host "Fluxo concluido ($buildConfig, -NoLog). API: $apiUrl" -ForegroundColor Green
}
