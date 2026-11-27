[CmdletBinding()]
param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "Programs\Lucky Lounge"),
  [switch]$SkipDependencies,
  [switch]$NoDesktopShortcut
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0
$sourceRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content (Join-Path $sourceRoot "package.json") -Raw | ConvertFrom-Json
$version = [string]$package.version
$installedManifest = $null
$installedManifestPath = Join-Path $InstallRoot "install-version.json"
if (Test-Path $installedManifestPath) {
  try { $installedManifest = Get-Content $installedManifestPath -Raw | ConvertFrom-Json } catch {}
}

function Copy-DirectoryIncremental {
  param(
    [string]$Source,
    [string]$Destination
  )
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  foreach ($sourceFile in Get-ChildItem -LiteralPath $Source -File -Recurse) {
    $relative = $sourceFile.FullName.Substring((Resolve-Path $Source).Path.Length).TrimStart('\', '/')
    $targetFile = Join-Path $Destination $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $targetFile) -Force | Out-Null
    $changed = -not (Test-Path $targetFile)
    if (-not $changed) {
      $changed = (Get-FileHash $sourceFile.FullName -Algorithm SHA256).Hash -ne
        (Get-FileHash $targetFile -Algorithm SHA256).Hash
    }
    if ($changed) { Copy-Item -LiteralPath $sourceFile.FullName -Destination $targetFile -Force }
  }
}

function Test-RuntimeDependencies {
  param(
    [string]$Root
  )
  $packagePath = Join-Path $Root "package.json"
  $modulesPath = Join-Path $Root "node_modules"
  if (-not (Test-Path $packagePath) -or -not (Test-Path $modulesPath)) { return $false }

  $installedPackage = Get-Content $packagePath -Raw | ConvertFrom-Json
  foreach ($dependency in $installedPackage.dependencies.PSObject.Properties.Name) {
    if (-not (Test-Path (Join-Path $modulesPath "$dependency\package.json"))) {
      return $false
    }
  }
  return $true
}

if (-not $SkipDependencies) {
  $node = Get-Command node -ErrorAction SilentlyContinue
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $node -or -not $npm) { throw "Node.js 22+ and npm are required before installation." }
  $nodeVersion = (& node --version)
  if ($nodeVersion -notmatch '^v(\d+)' -or [int]$Matches[1] -lt 22) {
    throw "Lucky Lounge requires Node.js 22 or newer."
  }
}

& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "Build-Lucky-Lounge-Launcher.ps1") `
  -SourceRoot $sourceRoot `
  -Version $version
if ($LASTEXITCODE -ne 0) { throw "Launcher build failed with exit code $LASTEXITCODE." }

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
foreach ($name in @("client", "public", "src", "scripts")) {
  $destination = Join-Path $InstallRoot $name
  Copy-DirectoryIncremental -Source (Join-Path $sourceRoot $name) -Destination $destination
}
foreach ($name in @("package.json", "package-lock.json", "server.js", "start-lounge-tray.cmd", "README.md", "STYLE-GUIDE.md", "THIRD-PARTY-NOTICES.md")) {
  Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination $InstallRoot -Force
}
New-Item -ItemType Directory -Path (Join-Path $InstallRoot "data") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "bin\Lucky Lounge.exe") -Destination $InstallRoot -Force

$bundledNodeMajor = $null
if (-not $SkipDependencies) {
  $sourceNodeModules = Join-Path $sourceRoot "node_modules"
  if (Test-Path $sourceNodeModules) {
    $nodeVersion = & node --version
    if ($nodeVersion -match '^v(\d+)') { $bundledNodeMajor = [int]$Matches[1] }
    if (-not $bundledNodeMajor) { throw "Could not determine the bundled Node.js major version." }
    $targetNodeModules = Join-Path $InstallRoot "node_modules"
    $dependenciesCurrent = $installedManifest -and
      [string]$installedManifest.version -eq $version -and
      [int]$installedManifest.nodeMajor -eq $bundledNodeMajor -and
      (Test-RuntimeDependencies $InstallRoot)
    if ($dependenciesCurrent) {
      Write-Output "Runtime dependencies are already current for Lucky Lounge $version / Node.js $bundledNodeMajor."
    } else {
      if (Test-Path $targetNodeModules) { Remove-Item $targetNodeModules -Recurse -Force }
      Copy-Item -Path $sourceNodeModules -Destination $InstallRoot -Recurse -Force
      Write-Output "Copied bundled runtime dependencies for Node.js $bundledNodeMajor."
    }
  } else {
    Push-Location $InstallRoot
    try {
      & npm ci --omit=dev
      if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
    } finally {
      Pop-Location
    }
  }
}

@{
  version = $version
  installedAt = [DateTimeOffset]::UtcNow.ToString("o")
  source = $sourceRoot
  installRoot = $InstallRoot
  nodeMajor = $bundledNodeMajor
} | ConvertTo-Json | Set-Content -Path (Join-Path $InstallRoot "install-version.json") -Encoding UTF8

if (-not $NoDesktopShortcut) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  $shortcutPath = Join-Path $desktop "Lucky Lounge.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = Join-Path $InstallRoot "Lucky Lounge.exe"
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.IconLocation = Join-Path $InstallRoot "Lucky Lounge.exe"
  $shortcut.Description = "Lucky Lounge $version"
  $shortcut.Save()
  Write-Output "Desktop shortcut created: $shortcutPath"
}

Write-Output "Lucky Lounge $version installed at $InstallRoot"
