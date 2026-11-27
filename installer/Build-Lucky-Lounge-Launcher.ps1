[CmdletBinding()]
param(
  [string]$SourceRoot,
  [string]$OutputDirectory,
  [string]$Version
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0
Add-Type -AssemblyName System.Drawing
if (-not $SourceRoot) { $SourceRoot = Split-Path -Parent $PSScriptRoot }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot "bin" }

if (-not $Version) {
  $package = Get-Content (Join-Path $SourceRoot "package.json") -Raw | ConvertFrom-Json
  $Version = [string]$package.version
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  throw "Version must use Major.Minor.Patch format."
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$assetDirectory = Join-Path $PSScriptRoot "assets"
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
$iconPath = Join-Path $assetDirectory "lucky-lounge.ico"

if (-not (Test-Path $iconPath)) {
  $bitmap = New-Object Drawing.Bitmap(256, 256)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.Color]::Transparent)
    $background = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255, 18, 39, 31))
    $gold = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(255, 232, 201, 129))
    $ring = New-Object Drawing.Pen([Drawing.Color]::FromArgb(255, 245, 217, 150), 12)
    $font = New-Object Drawing.Font("Segoe UI", 118, [Drawing.FontStyle]::Bold)
    $format = New-Object Drawing.StringFormat
    $format.Alignment = [Drawing.StringAlignment]::Center
    $format.LineAlignment = [Drawing.StringAlignment]::Center
    $graphics.FillEllipse($background, 10, 10, 236, 236)
    $graphics.DrawEllipse($ring, 10, 10, 236, 236)
    $graphics.DrawString("L", $font, $gold, (New-Object Drawing.RectangleF(8, 0, 240, 248)), $format)
    $handle = $bitmap.GetHicon()
    try {
      $icon = [Drawing.Icon]::FromHandle($handle)
      $stream = [IO.File]::Create($iconPath)
      try { $icon.Save($stream) } finally { $stream.Dispose() }
    } finally {
      [void][Runtime.InteropServices.Marshal]::Release($handle)
    }
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    if ($format) { $format.Dispose() }
    if ($font) { $font.Dispose() }
    if ($ring) { $ring.Dispose() }
    if ($gold) { $gold.Dispose() }
    if ($background) { $background.Dispose() }
  }
}

$sourcePath = Join-Path $PSScriptRoot "LuckyLoungeLauncher.cs"
$source = (Get-Content $sourcePath -Raw).Replace("__VERSION__", $Version)
$assemblyPath = Join-Path $OutputDirectory "Lucky Lounge.exe"
if (Test-Path $assemblyPath) { Remove-Item $assemblyPath -Force }
$compilerParameters = New-Object System.CodeDom.Compiler.CompilerParameters
$compilerParameters.OutputAssembly = $assemblyPath
$compilerParameters.GenerateExecutable = $true
$compilerParameters.CompilerOptions = "/target:winexe /optimize+ /win32icon:`"$iconPath`""
[void]$compilerParameters.ReferencedAssemblies.Add("System.dll")
[void]$compilerParameters.ReferencedAssemblies.Add("System.Windows.Forms.dll")

$provider = New-Object Microsoft.CSharp.CSharpCodeProvider
$results = $provider.CompileAssemblyFromSource($compilerParameters, $source)
if ($results.Errors.HasErrors) {
  $messages = $results.Errors | ForEach-Object { "$($_.FileName):$($_.Line): $($_.ErrorText)" }
  throw "Launcher compilation failed:`n$($messages -join [Environment]::NewLine)"
}

$manifest = [ordered]@{
  product = "Lucky Lounge"
  version = $Version
  builtAt = [DateTimeOffset]::UtcNow.ToString("o")
  platform = "win-x64"
  entrypoint = "Lucky Lounge.exe"
} | ConvertTo-Json
Set-Content -Path (Join-Path $OutputDirectory "version.json") -Value $manifest -Encoding UTF8

Write-Output "Built $assemblyPath"
