[CmdletBinding()]
param(
  [switch]$NoAutoStart
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::SetUnhandledExceptionMode(
  [Windows.Forms.UnhandledExceptionMode]::CatchException
)

$script:Root = Split-Path -Parent $PSScriptRoot
$parsedPort = 0
$script:Port = if ($env:PORT -and [int]::TryParse($env:PORT, [ref]$parsedPort)) { $parsedPort } else { 3000 }
$script:BaseUrl = "http://127.0.0.1:$script:Port"
$script:TrayMutex = New-Object Threading.Mutex($false, "Local\LuckyLoungeTray-$script:Port")
if (-not $script:TrayMutex.WaitOne(0, $false)) {
  $script:TrayMutex.Dispose()
  Write-Host "Lucky Lounge tray is already running."
  exit 0
}
$script:ManagedProcess = $null
$script:StartedByTray = $false
$script:LastStatus = $null
$script:NotifyIcon = $null
$script:StatusBox = $null
$script:StatusWindow = $null
$script:StatusTimer = $null
$script:SplashWindow = $null
$script:SplashStatus = $null
$script:SplashProgress = $null
$script:AdminToken = [Environment]::GetEnvironmentVariable("ADMIN_TOKEN", "User")
$script:LanAddress = $null
$script:PublicIp = $null
$script:PublicIpCheckedAt = [DateTime]::MinValue
$script:PublicIpError = $null
$script:FirewallPromptShown = $false
$script:PortListensOnLan = $false
$script:FirewallAllowed = $false
$script:DataRoot = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "LuckyLounge"
$script:LogDirectory = Join-Path $script:DataRoot "logs"
[IO.Directory]::CreateDirectory($script:LogDirectory) | Out-Null

function Write-TrayLog {
  param([string]$Message)
  try {
    $line = "[{0:u}] {1}" -f (Get-Date), $Message
    Add-Content -Path (Join-Path $script:LogDirectory "tray.log") -Value $line -Encoding UTF8
  } catch {
    [Console]::Error.WriteLine($Message)
  }
}

function New-AdminToken {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $token = ([BitConverter]::ToString($bytes) -replace "-", "").ToLowerInvariant()
  [Environment]::SetEnvironmentVariable("ADMIN_TOKEN", $token, "User")
  $env:ADMIN_TOKEN = $token
  $script:AdminToken = $token
  Write-TrayLog "Created a new persistent ADMIN_TOKEN."
  return $token
}

function Ensure-AdminToken {
  if ($script:AdminToken -and $script:AdminToken.Length -ge 32) {
    $env:ADMIN_TOKEN = $script:AdminToken
    return $true
  }
  New-AdminToken | Set-Clipboard
  Show-Balloon "Lucky Lounge" "A new admin token was created and copied to the clipboard." ([Windows.Forms.ToolTipIcon]::Info)
  return $true
}

function Get-PortOwner {
  try {
    $connection = Get-NetTCPConnection -LocalPort $script:Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($null -ne $connection) {
      return Get-Process -Id $connection.OwningProcess -ErrorAction Stop
    }
  } catch {
    Write-TrayLog "Could not resolve the owner of port $script:Port`: $($_.Exception.Message)"
  }
  return $null
}

function Get-LanAddress {
  try {
    $defaultRoute = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq "Active" -or $_.RouteMetric -ge 0 } |
      Sort-Object RouteMetric, ifIndex |
      Select-Object -First 1
    if ($defaultRoute) {
      $routeAddress = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $defaultRoute.ifIndex -ErrorAction SilentlyContinue |
        Where-Object {
          $_.AddressState -eq "Preferred" -and
          $_.IPAddress -notmatch '^127\.' -and
          $_.IPAddress -notmatch '^169\.254\.'
        } |
        Select-Object -First 1
      if ($routeAddress) { return [string]$routeAddress.IPAddress }
    }

    $candidate = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object {
        $_.AddressState -eq "Preferred" -and
        $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)'
      } |
      Sort-Object InterfaceIndex |
      Select-Object -First 1
    if ($candidate) { return [string]$candidate.IPAddress }
  } catch {
    Write-TrayLog "Could not determine the LAN address: $($_.Exception.Message)"
  }
  return $null
}

function Test-FirewallPortSpec {
  param(
    [object]$LocalPort,
    [int]$Port
  )
  $portText = [string]$LocalPort
  if ([string]::IsNullOrWhiteSpace($portText) -or $portText -eq "Any") { return $true }
  foreach ($item in ($portText -split ",")) {
    $range = $item.Trim()
    if ($range -eq [string]$Port) { return $true }
    if ($range -match '^(\d+)-(\d+)$' -and $Port -ge [int]$Matches[1] -and $Port -le [int]$Matches[2]) {
      return $true
    }
  }
  return $false
}

function Test-LoungeFirewallAccess {
  try {
    $rules = Get-NetFirewallRule -Direction Inbound -Enabled True -Action Allow -ErrorAction SilentlyContinue
    foreach ($rule in $rules) {
      $portFilter = $rule | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue
      if (-not $portFilter) { continue }
      foreach ($filter in @($portFilter)) {
        $protocol = [string]$filter.Protocol
        if (($protocol -eq "TCP" -or $protocol -eq "Any") -and
            (Test-FirewallPortSpec $filter.LocalPort $script:Port)) {
          return $true
        }
      }
    }
  } catch {
    Write-TrayLog "Could not inspect Windows Firewall: $($_.Exception.Message)"
  }
  return $false
}

function Get-LanUrl {
  if (-not $script:LanAddress) { $script:LanAddress = Get-LanAddress }
  if ($script:LanAddress) { return "http://$script:LanAddress`:$script:Port" }
  return $null
}

function Get-PublicIpv4 {
  param(
    [switch]$Refresh,
    [switch]$CachedOnly
  )
  if ($CachedOnly) { return $script:PublicIp }
  $cacheAge = (Get-Date) - $script:PublicIpCheckedAt
  if (-not $Refresh -and $script:PublicIp -and $cacheAge.TotalMinutes -lt 15) {
    return $script:PublicIp
  }

  $script:PublicIpCheckedAt = Get-Date
  try {
    $value = [string](Invoke-RestMethod -Uri "https://api.ipify.org?format=text" -TimeoutSec 4 -ErrorAction Stop)
    $parsed = $null
    $validAddress = [Net.IPAddress]::TryParse($value.Trim(), [ref]$parsed)
    if ($validAddress -and $parsed.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork) {
      $script:PublicIp = $parsed.ToString()
      $script:PublicIpError = $null
    } else {
      throw "The public IP service did not return a valid IPv4 address."
    }
  } catch {
    $script:PublicIpError = $_.Exception.Message
    Write-TrayLog "Could not determine the public IPv4 address: $($script:PublicIpError)"
  }
  return $script:PublicIp
}

function Test-PortListensOnLan {
  try {
    $listeners = Get-NetTCPConnection -LocalPort $script:Port -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
      $address = [string]$listener.LocalAddress
      if ($address -eq "0.0.0.0" -or $address -eq "::" -or $address -eq $script:LanAddress) {
        return $true
      }
    }
  } catch {
    Write-TrayLog "Could not inspect the listening address for port $script:Port`: $($_.Exception.Message)"
  }
  return $false
}

function Refresh-NetworkSnapshot {
  $script:LanAddress = Get-LanAddress
  $script:PortListensOnLan = Test-PortListensOnLan
  $script:FirewallAllowed = Test-LoungeFirewallAccess
  return [pscustomobject]@{
    LanAddress = $script:LanAddress
    PortListensOnLan = $script:PortListensOnLan
    FirewallAllowed = $script:FirewallAllowed
  }
}

function Request-FirewallAccess {
  param([switch]$ForcePrompt)
  if ($script:FirewallPromptShown -and -not $ForcePrompt) { return }
  $script:FirewallPromptShown = $true

  $network = Refresh-NetworkSnapshot
  if (-not $network.PortListensOnLan) {
    Show-Balloon "Servidor solo local" "El servidor no está escuchando en la interfaz de red. Reinícialo desde este tray para habilitar el acceso LAN." ([Windows.Forms.ToolTipIcon]::Warning)
    return
  }

  if ($network.FirewallAllowed) {
    Show-Balloon "Puerto listo" "Windows Firewall ya permite conexiones TCP al puerto $script:Port."
    return
  }

  $answer = [Windows.Forms.MessageBox]::Show(
    "El puerto $script:Port no tiene una regla de entrada permitida en Windows Firewall.`r`n`r`n" +
    "¿Quieres abrirlo solo para dispositivos de tu subred local? Se solicitarán permisos de administrador.",
    "Permitir acceso a Lucky Lounge en la red local",
    [Windows.Forms.MessageBoxButtons]::YesNo,
    [Windows.Forms.MessageBoxIcon]::Question,
    [Windows.Forms.MessageBoxDefaultButton]::Button1
  )
  if ($answer -ne [Windows.Forms.DialogResult]::Yes) { return }

  $ruleName = "Lucky Lounge (TCP $script:Port)"
  $command = "& { " +
    "`$old = Get-NetFirewallRule -DisplayName '$ruleName' -ErrorAction SilentlyContinue; " +
    "if (`$old) { `$old | Remove-NetFirewallRule -ErrorAction Stop }; " +
    "New-NetFirewallRule -DisplayName '$ruleName' -Description 'Allows Lucky Lounge access from the local subnet only' " +
    "-Direction Inbound -Action Allow -Protocol TCP -LocalPort $script:Port -Profile Any " +
    "-RemoteAddress LocalSubnet -Enabled True -ErrorAction Stop | Out-Null " +
    "}"
  try {
    $process = Start-Process -FilePath "powershell.exe" -Verb RunAs -PassThru -WindowStyle Hidden `
      -ArgumentList @("-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command)
    $process.WaitForExit()
    if ($process.ExitCode -eq 0) {
      Refresh-NetworkSnapshot | Out-Null
    }
    if ($process.ExitCode -eq 0 -and $script:FirewallAllowed) {
      Show-Balloon "Acceso local habilitado" "El puerto $script:Port ahora acepta conexiones desde la subred local."
    } else {
      Show-Balloon "No se pudo abrir el puerto" "Revisa tray.log o configura Windows Firewall manualmente." ([Windows.Forms.ToolTipIcon]::Warning)
    }
    Refresh-Status
  } catch {
    Write-TrayLog "Firewall rule creation failed: $($_.Exception.Message)"
    Show-Balloon "Permiso cancelado" "No se modificó Windows Firewall." ([Windows.Forms.ToolTipIcon]::Warning)
  }
}

function Invoke-Json {
  param(
    [string]$Path,
    [hashtable]$Headers = @{}
  )
  return Invoke-RestMethod -Uri "$script:BaseUrl$Path" -Headers $Headers -TimeoutSec 3 -ErrorAction Stop
}

function Test-RuntimeDependencies {
  $packagePath = Join-Path $script:Root "package.json"
  $modulesPath = Join-Path $script:Root "node_modules"
  if (-not (Test-Path $packagePath) -or -not (Test-Path $modulesPath)) { return $false }

  try {
    $package = Get-Content $packagePath -Raw | ConvertFrom-Json
    foreach ($dependency in $package.dependencies.PSObject.Properties.Name) {
      if (-not (Test-Path (Join-Path $modulesPath "$dependency\package.json"))) {
        return $false
      }
    }
    return $true
  } catch {
    Write-TrayLog "Could not validate runtime dependencies: $($_.Exception.Message)"
    return $false
  }
}

function Get-LoungeStatus {
  if (-not $script:LanAddress) { $script:LanAddress = Get-LanAddress }
  $lanUrl = if ($script:LanAddress) { "http://$script:LanAddress`:$script:Port" } else { $null }
  $publicIp = Get-PublicIpv4 -CachedOnly
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
  $nodeMajor = 0
  $nodeVersion = if ($nodeCommand) {
    try { (& node --version).Trim() } catch { "Unavailable" }
  } else {
    "Missing"
  }
  if ($nodeVersion -match '^v(\d+)') { $nodeMajor = [int]$Matches[1] }

  $owner = Get-PortOwner
  $healthy = $false
  $adminReady = $false
  $databaseHealth = $null
  $metrics = $null
  $serverError = $null
  try {
    $page = Invoke-WebRequest -Uri "$script:BaseUrl/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $databaseHealth = Invoke-Json "/api/health" @{ "Origin" = $script:BaseUrl }
    $healthy = $page.StatusCode -eq 200 -and $page.Content -match "Lucky Lounge" -and $databaseHealth.ok
  } catch {
    $serverError = $_.Exception.Message
  }

  if ($healthy -and $script:AdminToken) {
    try {
      $metrics = Invoke-Json "/api/admin/metrics" @{
        "X-Admin-Token" = $script:AdminToken
        "Origin" = $script:BaseUrl
      }
      $adminReady = $true
    } catch {
      $serverError = "Admin token is not accepted by this running server. Restart it from this tray."
    }
  }

  $processOwned = $false
  if ($owner -and $script:ManagedProcess) {
    $processOwned = $owner.Id -eq $script:ManagedProcess.Id
  }

  return [pscustomobject]@{
    Timestamp = Get-Date
    Node = $nodeVersion
    NodeReady = $nodeMajor -ge 22
    NpmReady = $null -ne $npmCommand
    DependenciesReady = Test-RuntimeDependencies
    DatabaseReady = Test-Path (Join-Path $script:Root "data\casino.db")
    DatabaseHealthy = $databaseHealth -and $databaseHealth.ok
    AdminConfigured = $script:AdminToken -and $script:AdminToken.Length -ge 32
    AdminReady = $adminReady
    Healthy = $healthy
    PortOwner = $owner
    ProcessOwned = $processOwned
    LanAddress = $script:LanAddress
    LanUrl = $lanUrl
    PublicIp = $publicIp
    PublicIpError = $script:PublicIpError
    PortListensOnLan = $script:PortListensOnLan
    FirewallAllowed = $script:FirewallAllowed
    ServerError = $serverError
    Metrics = $metrics
  }
}

function Format-LoungeStatus {
  param($Status)
  $owner = if ($Status.PortOwner) { "$($Status.PortOwner.ProcessName) PID $($Status.PortOwner.Id)" } else { "none" }
  $lines = New-Object Collections.Generic.List[string]
  $timeText = $Status.Timestamp.ToString("HH:mm:ss")
  $serverText = if ($Status.Healthy) { "ONLINE" } else { "OFFLINE" }
  $nodeText = if ($Status.NodeReady) { "ready" } else { "requires v22+" }
  $npmText = if ($Status.NpmReady) { "ready" } else { "missing" }
  $dependencyText = if ($Status.DependenciesReady) { "installed" } else { "run npm install" }
  $databaseText = if ($Status.DatabaseReady) { "present" } else { "created on first start" }
  $databaseHealthText = if ($Status.DatabaseHealthy) { "healthy" } elseif ($Status.Healthy) { "warning" } else { "not checked" }
  $tokenText = if ($Status.AdminConfigured) { "configured" } else { "missing" }
  $adminText = if ($Status.AdminReady) { "accepted" } else { "not active" }
  $managedText = if ($Status.ProcessOwned) { "yes" } else { "no" }
  $lanAddressText = if ($Status.LanAddress) { $Status.LanAddress } else { "not detected" }
  $lanUrlText = if ($Status.LanUrl) { $Status.LanUrl } else { "unavailable" }
  $publicIpText = if ($Status.PublicIp) { $Status.PublicIp } else { "not detected" }
  $listeningText = if ($Status.PortListensOnLan) { "LAN ready" } else { "local only / not listening" }
  $firewallText = if ($Status.FirewallAllowed) { "allowed" } else { "blocked / rule missing" }
  $lanAccessText = if ($Status.Healthy -and $Status.PortListensOnLan -and $Status.FirewallAllowed) { "READY" } else { "NOT READY" }
  [void]$lines.Add("Lucky Lounge live status - $timeText")
  [void]$lines.Add("Server: $serverText at $script:BaseUrl")
  [void]$lines.Add("LAN IP: $lanAddressText")
  [void]$lines.Add("LAN URL: $lanUrlText")
  [void]$lines.Add("Public IPv4: $publicIpText")
  [void]$lines.Add("GoDaddy A record: $publicIpText")
  [void]$lines.Add("Internet routing: forward 80/443 to this host through the router or VPS")
  [void]$lines.Add("LAN access: $lanAccessText")
  [void]$lines.Add("Port $script:Port listening: $listeningText")
  [void]$lines.Add("Windows Firewall: $firewallText")
  [void]$lines.Add("Port owner: $owner")
  [void]$lines.Add("Node: $($Status.Node) ($nodeText)")
  [void]$lines.Add("npm: $npmText")
  [void]$lines.Add("Dependencies: $dependencyText")
  [void]$lines.Add("Database: $databaseText")
  [void]$lines.Add("Database health: $databaseHealthText")
  [void]$lines.Add("Admin token: $tokenText / $adminText")
  if ($Status.Metrics) {
    [void]$lines.Add("Connected sockets: $($Status.Metrics.activeSockets)")
    [void]$lines.Add("Wallet credits: $([int64]$Status.Metrics.walletCredits)")
    [void]$lines.Add("Maximum unsettled: $([int64]$Status.Metrics.maximumUnsettledPayout)")
  } else {
    [void]$lines.Add("Connected sockets: unavailable until admin access is active")
  }
  [void]$lines.Add("Managed by tray: $managedText")
  if ($Status.ServerError) { [void]$lines.Add("Warning: $($Status.ServerError)") }
  if ($Status.PublicIpError) { [void]$lines.Add("Public IP warning: $($Status.PublicIpError)") }
  return $lines -join [Environment]::NewLine
}

function Show-Balloon {
  param(
    [string]$Title,
    [string]$Text,
    [Windows.Forms.ToolTipIcon]$Icon = [Windows.Forms.ToolTipIcon]::Info
  )
  if ($script:NotifyIcon) {
    $script:NotifyIcon.ShowBalloonTip(3500, $Title, $Text, $Icon)
  }
}

function New-TrayIcon {
  param([bool]$Online)
  $bitmap = New-Object Drawing.Bitmap(64, 64)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  $brush = $null
  $pen = $null
  $font = $null
  $textBrush = $null
  $format = $null
  try {
    $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([Drawing.Color]::Transparent)
    $background = if ($Online) { [Drawing.Color]::FromArgb(255, 20, 42, 34) } else { [Drawing.Color]::FromArgb(255, 46, 23, 27) }
    $accent = if ($Online) { [Drawing.Color]::FromArgb(255, 232, 201, 129) } else { [Drawing.Color]::FromArgb(255, 185, 86, 93) }
    $brush = New-Object Drawing.SolidBrush($background)
    $pen = New-Object Drawing.Pen($accent, 3)
    $graphics.FillEllipse($brush, 4, 4, 56, 56)
    $graphics.DrawEllipse($pen, 4, 4, 56, 56)
    $font = New-Object Drawing.Font("Segoe UI", 28, [Drawing.FontStyle]::Bold)
    $textBrush = New-Object Drawing.SolidBrush($accent)
    $format = New-Object Drawing.StringFormat
    $format.Alignment = [Drawing.StringAlignment]::Center
    $format.LineAlignment = [Drawing.StringAlignment]::Center
    $graphics.DrawString("L", $font, $textBrush, (New-Object Drawing.RectangleF(4, 2, 56, 58)), $format)
    $handle = $bitmap.GetHicon()
    return [Drawing.Icon]::FromHandle($handle)
  } finally {
    if ($format) { $format.Dispose() }
    if ($textBrush) { $textBrush.Dispose() }
    if ($font) { $font.Dispose() }
    if ($pen) { $pen.Dispose() }
    if ($brush) { $brush.Dispose() }
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Show-StartupSplash {
  if ($script:SplashWindow -and -not $script:SplashWindow.IsDisposed) { return }
  $imagePath = Join-Path $script:Root "public\assets\casino-entrance.jpg"
  $script:SplashWindow = New-Object Windows.Forms.Form
  $script:SplashWindow.FormBorderStyle = "None"
  $script:SplashWindow.StartPosition = "CenterScreen"
  $script:SplashWindow.ShowInTaskbar = $false
  $script:SplashWindow.TopMost = $true
  $script:SplashWindow.Width = 760
  $script:SplashWindow.Height = 430
  $script:SplashWindow.BackColor = [Drawing.Color]::FromArgb(8, 14, 12)
  if (Test-Path $imagePath) {
    $script:SplashWindow.BackgroundImage = [Drawing.Image]::FromFile($imagePath)
    $script:SplashWindow.BackgroundImageLayout = "Stretch"
  }
  $shade = New-Object Windows.Forms.Panel
  $shade.Dock = "Fill"
  $shade.BackColor = [Drawing.Color]::FromArgb(185, 7, 13, 11)
  $content = New-Object Windows.Forms.Panel
  $content.Width = 520
  $content.Height = 250
  $content.Left = [Math]::Round(($script:SplashWindow.ClientSize.Width - $content.Width) / 2)
  $content.Top = [Math]::Round(($script:SplashWindow.ClientSize.Height - $content.Height) / 2)
  $content.BackColor = [Drawing.Color]::FromArgb(238, 9, 19, 16)
  $content.BorderStyle = "FixedSingle"
  $brand = New-Object Windows.Forms.Label
  $brand.Text = "LUCKY LOUNGE"
  $brand.ForeColor = [Drawing.Color]::FromArgb(255, 232, 201, 129)
  $brand.Font = New-Object Drawing.Font("Segoe UI", 24, [Drawing.FontStyle]::Bold)
  $brand.TextAlign = "MiddleCenter"
  $brand.BackColor = $content.BackColor
  $brand.SetBounds(0, 18, $content.Width, 58)
  $brand.UseCompatibleTextRendering = $false
  $title = New-Object Windows.Forms.Label
  $title.Text = "Iniciando el servidor"
  $title.ForeColor = [Drawing.Color]::FromArgb(245, 246, 239)
  $title.Font = New-Object Drawing.Font("Segoe UI", 15, [Drawing.FontStyle]::Regular)
  $title.TextAlign = "MiddleCenter"
  $title.BackColor = $content.BackColor
  $title.SetBounds(0, 92, $content.Width, 42)
  $title.UseCompatibleTextRendering = $false
  $script:SplashStatus = New-Object Windows.Forms.Label
  $script:SplashStatus.Text = "Verificando Node.js, base de datos y puerto 3000..."
  $script:SplashStatus.ForeColor = [Drawing.Color]::FromArgb(183, 197, 189)
  $script:SplashStatus.Font = New-Object Drawing.Font("Segoe UI", 11)
  $script:SplashStatus.TextAlign = "TopCenter"
  $script:SplashStatus.BackColor = $content.BackColor
  $script:SplashStatus.SetBounds(28, 145, $content.Width - 56, 40)
  $script:SplashStatus.UseCompatibleTextRendering = $false
  $script:SplashProgress = New-Object Windows.Forms.ProgressBar
  $script:SplashProgress.Style = "Continuous"
  $script:SplashProgress.Minimum = 0
  $script:SplashProgress.Maximum = 100
  $script:SplashProgress.Value = 8
  $script:SplashProgress.SetBounds(42, 202, $content.Width - 84, 8)
  $content.Controls.AddRange(@($brand, $title, $script:SplashStatus, $script:SplashProgress))
  $shade.Controls.Add($content)
  $script:SplashWindow.Controls.Add($shade)
  $script:SplashWindow.Show()
  [Windows.Forms.Application]::DoEvents()
}

function Update-StartupSplash {
  param(
    [string]$Message,
    [int]$Progress
  )
  if ($script:SplashWindow -and -not $script:SplashWindow.IsDisposed) {
    $script:SplashStatus.Text = $Message
    $script:SplashProgress.Value = [Math]::Min(100, [Math]::Max(0, $Progress))
    [Windows.Forms.Application]::DoEvents()
  }
}

function Close-StartupSplash {
  if ($script:SplashWindow -and -not $script:SplashWindow.IsDisposed) {
    $script:SplashWindow.Close()
    $script:SplashWindow.Dispose()
  }
  $script:SplashWindow = $null
  $script:SplashStatus = $null
  $script:SplashProgress = $null
}

function Invoke-TrayAction {
  param(
    [string]$Name,
    [scriptblock]$Action
  )
  try {
    & $Action
  } catch {
    Write-TrayLog "$Name failed: $($_.Exception.ToString())"
    Show-Balloon "Lucky Lounge tray error" "$Name failed. See tray.log in the logs folder." ([Windows.Forms.ToolTipIcon]::Error)
  }
}

function Refresh-Status {
  try {
    $status = Get-LoungeStatus
    $script:LastStatus = $status
    $script:StartItem.Enabled = -not $status.Healthy -and $status.NodeReady -and $status.NpmReady -and $status.DependenciesReady
    $script:StopItem.Enabled = $status.ProcessOwned
    $script:AdminItem.Enabled = $status.Healthy
    $script:OpenItem.Enabled = $status.Healthy
    $script:CopyLanUrlItem.Enabled = $status.Healthy -and $status.PortListensOnLan -and $status.LanUrl
    $script:CopyPublicIpItem.Enabled = $null -ne $status.PublicIp
    $script:NetworkItem.Enabled = $null -ne $status.LanAddress
    $script:CopyAdminTokenItem.Enabled = $status.AdminConfigured
    $script:StatusItem.Text = if ($status.Healthy) {
      "Lucky Lounge: ONLINE"
    } elseif ($status.PortOwner) {
      "Lucky Lounge: port occupied"
    } else {
      "Lucky Lounge: OFFLINE"
    }
    $tip = if ($status.Healthy) {
      $connections = if ($status.Metrics) { $status.Metrics.activeSockets } else { "?" }
      $adminState = if ($status.AdminReady) { "ready" } else { "restart needed" }
      "Lucky Lounge online | $connections connected | Admin $adminState"
    } else {
      "Lucky Lounge offline | $script:BaseUrl"
    }
    $script:NotifyIcon.Text = $tip.Substring(0, [Math]::Min(63, $tip.Length))
    $script:NotifyIcon.Icon = if ($status.Healthy) { $script:OnlineIcon } else { $script:OfflineIcon }
    if ($script:StatusBox -and -not $script:StatusBox.IsDisposed) {
      $script:StatusBox.Text = Format-LoungeStatus $status
    }
  } catch {
    Write-TrayLog "Status refresh failed: $($_.Exception.Message)"
  }
}

function Start-Lounge {
  Update-StartupSplash "Verificando Node.js, npm y dependencias..." 18
  $status = Get-LoungeStatus
  if (-not $status.NodeReady) { Show-Balloon "Preflight failed" "Node.js v22 or newer is required." ([Windows.Forms.ToolTipIcon]::Error); return }
  if (-not $status.NpmReady) { Show-Balloon "Preflight failed" "npm is not available." ([Windows.Forms.ToolTipIcon]::Error); return }
  if (-not $status.DependenciesReady) { Show-Balloon "Preflight failed" "Run npm install from the project folder, then retry." ([Windows.Forms.ToolTipIcon]::Error); return }
  if ($status.Healthy) {
    Show-Balloon "Already running" "Lucky Lounge is already online."
    if (-not $status.PortListensOnLan) {
      Show-Balloon "LAN access is not ready" "This server is listening on localhost only. Start it from this tray to enable LAN access." ([Windows.Forms.ToolTipIcon]::Warning)
    } elseif (-not $status.FirewallAllowed) {
      Request-FirewallAccess
    }
    return
  }
  if ($status.PortOwner) {
    Show-Balloon "Port occupied" "Port $script:Port is owned by $($status.PortOwner.ProcessName) PID $($status.PortOwner.Id). The tray will not stop an unrelated process." ([Windows.Forms.ToolTipIcon]::Warning)
    return
  }
  Ensure-AdminToken | Out-Null
  Update-StartupSplash "Iniciando el servidor local seguro..." 38
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $stdout = Join-Path $script:LogDirectory "server-$stamp.out.log"
  $stderr = Join-Path $script:LogDirectory "server-$stamp.err.log"
  $previousHost = $env:HOST
  $env:HOST = "0.0.0.0"
  try {
    $script:ManagedProcess = Start-Process -FilePath "node" -ArgumentList "`"$script:Root\server.js`"" -WorkingDirectory $script:Root `
      -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  } finally {
    $env:HOST = $previousHost
  }
  $script:StartedByTray = $true
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    Update-StartupSplash "Cargando datos, red y render 2D/3D..." (45 + $attempt * 2)
    if ((Get-LoungeStatus).Healthy) { break }
  }
  Refresh-Status
  if ($script:ManagedProcess.HasExited) {
    $exitCode = $script:ManagedProcess.ExitCode
    Show-Balloon "Start failed" "The server exited with code $exitCode. See $stderr." ([Windows.Forms.ToolTipIcon]::Error)
    $script:StartedByTray = $false
  } else {
    Update-StartupSplash "Lucky Lounge esta listo" 100
    Close-StartupSplash
    $lanUrl = Get-LanUrl
    $onlineText = if ($lanUrl) { "Local: $script:BaseUrl`r`nLAN: $lanUrl" } else { $script:BaseUrl }
    Show-Balloon "Lucky Lounge is online" $onlineText
    Request-FirewallAccess
  }
}

function Stop-Lounge {
  if (-not $script:ManagedProcess -or $script:ManagedProcess.HasExited -or -not $script:StartedByTray) {
    Show-Balloon "Cannot stop external server" "Only a server started by this tray can be stopped automatically." ([Windows.Forms.ToolTipIcon]::Warning)
    return
  }
  $processId = $script:ManagedProcess.Id
  Stop-Process -Id $processId
  $script:ManagedProcess.WaitForExit(5000)
  $script:StartedByTray = $false
  Refresh-Status
  Show-Balloon "Server stopped" "Stopped managed process PID $processId."
}

function Open-Url {
  param([string]$Url)
  Start-Process $Url
}

function Show-StatusWindow {
  if ($script:StatusWindow -and -not $script:StatusWindow.IsDisposed) {
    $script:StatusWindow.Activate()
    return
  }
  $script:StatusWindow = New-Object Windows.Forms.Form
  $script:StatusWindow.Text = "Lucky Lounge Live Status"
  $script:StatusWindow.Width = 780
  $script:StatusWindow.Height = 500
  $script:StatusWindow.StartPosition = "CenterScreen"
  $script:StatusWindow.FormBorderStyle = "FixedSingle"
  $script:StatusWindow.BackColor = [Drawing.Color]::FromArgb(12, 20, 17)
  $script:StatusWindow.ForeColor = [Drawing.Color]::FromArgb(244, 241, 232)
  $header = New-Object Windows.Forms.Panel
  $header.Dock = "Top"
  $header.Height = 76
  $header.BackColor = [Drawing.Color]::FromArgb(23, 43, 35)
  $headerTitle = New-Object Windows.Forms.Label
  $headerTitle.Text = "Lucky Lounge"
  $headerTitle.Font = New-Object Drawing.Font("Segoe UI", 20, [Drawing.FontStyle]::Bold)
  $headerTitle.ForeColor = [Drawing.Color]::FromArgb(243, 217, 150)
  $headerTitle.AutoSize = $true
  $headerTitle.Location = New-Object Drawing.Point(20, 13)
  $headerSubtitle = New-Object Windows.Forms.Label
  $headerSubtitle.Text = "LOCAL SERVER / LIVE STATUS"
  $headerSubtitle.Font = New-Object Drawing.Font("Segoe UI", 9, [Drawing.FontStyle]::Bold)
  $headerSubtitle.ForeColor = [Drawing.Color]::FromArgb(155, 209, 169)
  $headerSubtitle.AutoSize = $true
  $headerSubtitle.Location = New-Object Drawing.Point(22, 48)
  $header.Controls.AddRange(@($headerTitle, $headerSubtitle))
  $script:StatusBox = New-Object Windows.Forms.TextBox
  $script:StatusBox.Multiline = $true
  $script:StatusBox.ReadOnly = $true
  $script:StatusBox.ScrollBars = "Both"
  $script:StatusBox.Dock = "Fill"
  $script:StatusBox.BorderStyle = "None"
  $script:StatusBox.BackColor = [Drawing.Color]::FromArgb(15, 27, 23)
  $script:StatusBox.ForeColor = [Drawing.Color]::FromArgb(220, 230, 223)
  $script:StatusBox.Font = New-Object Drawing.Font("Cascadia Mono", 10)
  $script:StatusBox.Padding = New-Object Windows.Forms.Padding(18)
  $actions = New-Object Windows.Forms.FlowLayoutPanel
  $actions.Dock = "Bottom"
  $actions.Height = 96
  $actions.Padding = New-Object Windows.Forms.Padding(12, 10, 12, 10)
  $actions.BackColor = [Drawing.Color]::FromArgb(8, 15, 13)
  $refreshButton = New-Object Windows.Forms.Button
  $refreshButton.Text = "Refresh"
  $refreshButton.Width = 110
  $openButton = New-Object Windows.Forms.Button
  $openButton.Text = "Open lounge"
  $openButton.Width = 130
  $adminButton = New-Object Windows.Forms.Button
  $adminButton.Text = "Open admin"
  $adminButton.Width = 120
  $copyLanButton = New-Object Windows.Forms.Button
  $copyLanButton.Text = "Copy LAN URL"
  $copyLanButton.Width = 130
  $copyPublicIpButton = New-Object Windows.Forms.Button
  $copyPublicIpButton.Text = "Copy public IP"
  $copyPublicIpButton.Width = 130
  $networkButton = New-Object Windows.Forms.Button
  $networkButton.Text = "Check network"
  $networkButton.Width = 130
  foreach ($button in @($refreshButton, $openButton, $adminButton, $copyLanButton, $copyPublicIpButton, $networkButton)) {
    $button.Height = 36
    $button.FlatStyle = "Flat"
    $button.FlatAppearance.BorderColor = [Drawing.Color]::FromArgb(216, 182, 109)
    $button.BackColor = [Drawing.Color]::FromArgb(35, 52, 44)
    $button.ForeColor = [Drawing.Color]::FromArgb(244, 241, 232)
  }
  $refreshButton.Add_Click({ Invoke-TrayAction "Refresh status" { Refresh-Status } })
  $openButton.Add_Click({ Invoke-TrayAction "Open lounge" { Open-Url $script:BaseUrl } })
  $adminButton.Add_Click({ Invoke-TrayAction "Open admin panel" { Open-Url "$script:BaseUrl/admin" } })
  $copyLanButton.Add_Click({
    Invoke-TrayAction "Copy LAN URL" {
      $lanUrl = Get-LanUrl
      if ($lanUrl) {
        $lanUrl | Set-Clipboard
        Show-Balloon "LAN URL copied" "Open $lanUrl from a device on the same router."
      }
    }
  })
  $copyPublicIpButton.Add_Click({
    Invoke-TrayAction "Copy public IP" {
      $publicIp = Get-PublicIpv4 -Refresh
      if ($publicIp) {
        $publicIp | Set-Clipboard
        Show-Balloon "Public IP copied" "Use $publicIp as the IPv4 value for the GoDaddy A record."
      } else {
        Show-Balloon "Public IP unavailable" "The public IP service could not be reached. Try again or verify internet access." ([Windows.Forms.ToolTipIcon]::Warning)
      }
    }
  })
  $networkButton.Add_Click({ Invoke-TrayAction "Check network access" { Refresh-Status; Request-FirewallAccess -ForcePrompt } })
  $actions.Controls.AddRange(@($refreshButton, $openButton, $adminButton, $copyLanButton, $copyPublicIpButton, $networkButton))
  $script:StatusWindow.Controls.Add($script:StatusBox)
  $script:StatusWindow.Controls.Add($actions)
  $script:StatusWindow.Controls.Add($header)
  $script:StatusTimer = New-Object Windows.Forms.Timer
  $script:StatusTimer.Interval = 3000
  $script:StatusTimer.Add_Tick({ Invoke-TrayAction "Live status refresh" { Refresh-Status } })
  $script:StatusWindow.Add_FormClosed({
    Invoke-TrayAction "Close status window" {
      if ($script:StatusTimer) {
        $script:StatusTimer.Stop()
        $script:StatusTimer.Dispose()
        $script:StatusTimer = $null
      }
      $script:StatusWindow = $null
      $script:StatusBox = $null
    }
  })
  $script:StatusTimer.Start()
  Refresh-NetworkSnapshot | Out-Null
  Get-PublicIpv4 | Out-Null
  Refresh-Status
  $script:StatusWindow.Show()
}

[Windows.Forms.Application]::add_ThreadException({
  param($Sender, $EventArgs)
  $error = $EventArgs.Exception
  Write-TrayLog "Unhandled WinForms exception: $($error.ToString())"
  Show-Balloon "Lucky Lounge tray error" "A tray action failed. The launcher is still running; see tray.log." ([Windows.Forms.ToolTipIcon]::Error)
})

$script:OnlineIcon = New-TrayIcon $true
$script:OfflineIcon = New-TrayIcon $false
$script:NotifyIcon = New-Object Windows.Forms.NotifyIcon
$script:NotifyIcon.Icon = $script:OfflineIcon
$script:NotifyIcon.Visible = $true
$script:NotifyIcon.Text = "Lucky Lounge offline"

$menu = New-Object Windows.Forms.ContextMenuStrip
$script:StatusItem = $menu.Items.Add("Lucky Lounge: checking...")
$script:StatusItem.Enabled = $false
$menu.Items.Add("-") | Out-Null
$script:StartItem = $menu.Items.Add("Start server")
$script:StopItem = $menu.Items.Add("Stop managed server")
$script:OpenItem = $menu.Items.Add("Open Lucky Lounge")
$script:AdminItem = $menu.Items.Add("Open admin panel")
$copyLanUrlItem = $menu.Items.Add("Copy LAN URL")
$script:CopyLanUrlItem = $copyLanUrlItem
$copyPublicIpItem = $menu.Items.Add("Copy public IPv4")
$script:CopyPublicIpItem = $copyPublicIpItem
$copyTokenItem = $menu.Items.Add("Copy admin token")
$script:CopyAdminTokenItem = $copyTokenItem
$networkItem = $menu.Items.Add("Check port and firewall")
$script:NetworkItem = $networkItem
$viewStatusItem = $menu.Items.Add("Show live status")
$logsItem = $menu.Items.Add("Open logs folder")
$menu.Items.Add("-") | Out-Null
$exitItem = $menu.Items.Add("Quit Lucky Lounge and server")
$script:NotifyIcon.ContextMenuStrip = $menu

$script:NotifyIcon.Add_DoubleClick({ Invoke-TrayAction "Open live status" { Show-StatusWindow } })
$script:StartItem.Add_Click({ Invoke-TrayAction "Start server" { Start-Lounge } })
$script:StopItem.Add_Click({ Invoke-TrayAction "Stop server" { Stop-Lounge } })
$script:OpenItem.Add_Click({ Invoke-TrayAction "Open lounge" { Open-Url $script:BaseUrl } })
$script:AdminItem.Add_Click({ Invoke-TrayAction "Open admin panel" { Open-Url "$script:BaseUrl/admin" } })
$copyLanUrlItem.Add_Click({
  Invoke-TrayAction "Copy LAN URL" {
    $lanUrl = Get-LanUrl
    if ($lanUrl) {
      $lanUrl | Set-Clipboard
      Show-Balloon "LAN URL copied" "Open $lanUrl from a device on the same router."
    }
  }
})
$copyPublicIpItem.Add_Click({
  Invoke-TrayAction "Copy public IP" {
    $publicIp = Get-PublicIpv4 -Refresh
    if ($publicIp) {
      $publicIp | Set-Clipboard
      Show-Balloon "Public IP copied" "Use $publicIp as the IPv4 value for the GoDaddy A record."
    } else {
      Show-Balloon "Public IP unavailable" "The public IP service could not be reached. Try again or verify internet access." ([Windows.Forms.ToolTipIcon]::Warning)
    }
  }
})
$copyTokenItem.Add_Click({
  Invoke-TrayAction "Copy admin token" {
    Ensure-AdminToken | Out-Null
    $script:AdminToken | Set-Clipboard
    Show-Balloon "Admin token copied" "Paste it into the admin panel."
  }
})
$networkItem.Add_Click({ Invoke-TrayAction "Check port and firewall" { Refresh-Status; Request-FirewallAccess -ForcePrompt } })
$viewStatusItem.Add_Click({ Invoke-TrayAction "Open live status" { Show-StatusWindow } })
$logsItem.Add_Click({ Invoke-TrayAction "Open logs folder" { Start-Process $script:LogDirectory } })
$exitItem.Add_Click({
  Invoke-TrayAction "Quit Lucky Lounge and server" {
    if ($script:StartedByTray -and $script:ManagedProcess -and -not $script:ManagedProcess.HasExited) {
      $processId = $script:ManagedProcess.Id
      Stop-Process -Id $processId
      $script:ManagedProcess.WaitForExit(5000)
      $script:StartedByTray = $false
      Write-TrayLog "Server stopped by quit action (PID $processId)."
    }
    $script:NotifyIcon.Visible = $false
    [Windows.Forms.Application]::ExitThread()
  }
})

$timer = New-Object Windows.Forms.Timer
$timer.Interval = 5000
$timer.Add_Tick({ Invoke-TrayAction "Periodic status refresh" { Refresh-Status } })
$timer.Start()

try {
  Invoke-TrayAction "Tray initialization" {
    Show-StartupSplash
    Ensure-AdminToken | Out-Null
    Refresh-Status
    if (-not $NoAutoStart) { Start-Lounge }
    else {
      Update-StartupSplash "Monitor de estado listo" 100
      Start-Sleep -Milliseconds 500
    }
    Close-StartupSplash
    Show-Balloon "Lucky Lounge tray ready" "Right-click the tray icon for live controls."
  }
  Close-StartupSplash
  [Windows.Forms.Application]::Run()
  Write-TrayLog "Tray closed."
} catch {
  Close-StartupSplash
  Write-TrayLog "Tray failed: $($_.Exception.ToString())"
  throw
} finally {
  Close-StartupSplash
  $timer.Stop()
  $timer.Dispose()
  $script:NotifyIcon.Visible = $false
  $script:NotifyIcon.Dispose()
  if ($script:TrayMutex) {
    $script:TrayMutex.ReleaseMutex()
    $script:TrayMutex.Dispose()
  }
}
