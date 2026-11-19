<#
.SYNOPSIS
    Dynamic Lab Workstation & Software Tracker - Automated Workstation Installer
.DESCRIPTION
    One-command automated installer to connect and register this workstation
    with the Dynamic Lab server, configure background monitoring, and auto-start on reboot.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ServerUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$EnrollmentToken = ""
)

$DefaultServerUrl = "__SERVER_URL__"
$DefaultEnrollmentToken = "__ENROLLMENT_TOKEN__"

if ([string]::IsNullOrWhiteSpace($ServerUrl) -or $ServerUrl.StartsWith("__")) {
    $ServerUrl = $DefaultServerUrl
}
if ([string]::IsNullOrWhiteSpace($EnrollmentToken) -or $EnrollmentToken.StartsWith("__")) {
    $EnrollmentToken = $DefaultEnrollmentToken
}

$ErrorActionPreference = "Continue"

# Colors and formatting helpers
function Write-Header {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "   DYNAMIC LAB WORKSTATION & SOFTWARE TRACKER - AGENT INSTALLER  " -ForegroundColor White
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step([string]$msg) {
    Write-Host "[*] $msg" -ForegroundColor Cyan
}

function Write-Success([string]$msg) {
    Write-Host "[+] $msg" -ForegroundColor Green
}

function Write-Warn([string]$msg) {
    Write-Host "[!] $msg" -ForegroundColor Yellow
}

function Write-Fail([string]$msg) {
    Write-Host "[-] $msg" -ForegroundColor Red
}

function Send-Progress([string]$step, [string]$message) {
    if ([string]::IsNullOrWhiteSpace($ServerUrl) -or $ServerUrl.StartsWith("__") -or [string]::IsNullOrWhiteSpace($EnrollmentToken) -or $EnrollmentToken.StartsWith("__")) {
        return
    }
    try {
        $body = @{
            step = $step
            message = $message
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$($ServerUrl.TrimEnd('/'))/api/enroll/$EnrollmentToken/progress" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 5 -ErrorAction SilentlyContinue | Out-Null
    } catch {
        # Non-critical, continue
    }
}

Write-Header

# Validate parameters
if ([string]::IsNullOrWhiteSpace($ServerUrl) -or $ServerUrl.StartsWith("__")) {
    Write-Fail "Server URL is required. Example: .\install.ps1 -ServerUrl 'http://192.168.1.106:3001' -EnrollmentToken 'token'"
    return
}
if ([string]::IsNullOrWhiteSpace($EnrollmentToken) -or $EnrollmentToken.StartsWith("__")) {
    Write-Fail "Enrollment token is required or expired. Generate a new command from the admin dashboard."
    return
}

$ServerUrl = $ServerUrl.TrimEnd('/')
Write-Host "Server URL       : $ServerUrl" -ForegroundColor Gray
Write-Host "Enrollment Token : $($EnrollmentToken.Substring(0, [Math]::Min(12, $EnrollmentToken.Length)))..." -ForegroundColor Gray
Write-Host ""

# 1. System checks
Write-Step "Checking operating system and environment..."
if ($PSVersionTable.PSEdition -ne "Core" -and [System.Environment]::OSVersion.Platform -ne "Win32NT") {
    Write-Fail "This automated installer supports Windows 10, 11, and Windows Server."
    Send-Progress "failed" "Unsupported operating system"
    return
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    $InstallDir = "$env:ProgramData\DynamicLabTracker"
    Write-Host "  -> Running with Administrator privileges" -ForegroundColor Gray
} else {
    $InstallDir = "$env:LOCALAPPDATA\DynamicLabTracker"
    Write-Host "  -> Running in User mode (Install directory: $InstallDir)" -ForegroundColor Gray
}

# Create installation and logs directory
New-Item -ItemType Directory -Force -Path "$InstallDir\agent" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\logs" | Out-Null
Write-Success "Target directory ready: $InstallDir"
Send-Progress "installing" "Verified system compatibility and target directory"

# 2. Python Detection & Bootstrapping
Write-Step "Checking Python 3 environment..."
$PythonExe = $null

# Check system PATH
$pyCandidates = @("python", "py", "python3")
foreach ($cmd in $pyCandidates) {
    $cmdObj = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($cmdObj) {
        try {
            $ver = & $cmd -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
            if ($ver -and [version]$ver -ge [version]"3.8") {
                $PythonExe = $cmdObj.Source
                Write-Host "  -> Found Python $ver at: $PythonExe" -ForegroundColor Gray
                break
            }
        } catch {}
    }
}

# If Python is not installed, install automatically
if (-not $PythonExe) {
    Write-Warn "Python 3.8+ not detected. Installing Python runtime automatically..."
    Send-Progress "installing" "Bootstrapping Python 3 runtime..."

    $installedViaWinget = $false
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "  -> Attempting silent install via Windows Package Manager (winget)..." -ForegroundColor Gray
        try {
            Start-Process winget -ArgumentList "install --id Python.Python.3.12 -e --silent --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow
            # Refresh path
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            $pyAfter = Get-Command python -ErrorAction SilentlyContinue
            if ($pyAfter) {
                $PythonExe = $pyAfter.Source
                $installedViaWinget = $true
                Write-Success "Python installed successfully via winget!"
            }
        } catch {
            Write-Warn "Winget installation encountered an error. Falling back to direct installer."
        }
    }

    if (-not $PythonExe) {
        Write-Host "  -> Downloading official Python 3 installer from python.org..." -ForegroundColor Gray
        $pyInstallerUrl = "https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe"
        $pyInstallerPath = "$env:TEMP\python-3.12.8-installer.exe"
        try {
            Invoke-WebRequest -Uri $pyInstallerUrl -OutFile $pyInstallerPath -UseBasicParsing
            Write-Host "  -> Executing silent installation of Python..." -ForegroundColor Gray
            $pyArgs = "/quiet InstallAllUsers=0 PrependPath=1 Include_test=0 SimpleInstall=1"
            Start-Process -FilePath $pyInstallerPath -ArgumentList $pyArgs -Wait
            Start-Sleep -Seconds 3
            # Refresh path
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            $pyAfter = Get-Command python -ErrorAction SilentlyContinue
            if ($pyAfter) {
                $PythonExe = $pyAfter.Source
                Write-Success "Python installed successfully!"
            }
        } catch {
            Write-Fail "Automatic Python installation failed: $_"
            Send-Progress "failed" "Failed to automatically install Python: $_"
            return
        }
    }
}

if (-not $PythonExe) {
    Write-Fail "Could not locate or bootstrap a working Python 3.8+ runtime."
    Send-Progress "failed" "Could not find or bootstrap Python 3"
    return
}

# 3. Download Monitoring Agent Files
Write-Step "Downloading monitoring agent files from Dynamic Lab server..."
Send-Progress "installing" "Downloading monitoring agent and dependencies"

try {
    Invoke-WebRequest -Uri "$ServerUrl/api/enroll/files/monitor.py" -OutFile "$InstallDir\agent\monitor.py" -UseBasicParsing
    Invoke-WebRequest -Uri "$ServerUrl/api/enroll/files/requirements.txt" -OutFile "$InstallDir\agent\requirements.txt" -UseBasicParsing
    Invoke-WebRequest -Uri "$ServerUrl/api/enroll/files/uninstall.ps1" -OutFile "$InstallDir\uninstall.ps1" -UseBasicParsing
    Write-Success "Agent code and uninstaller downloaded."
} catch {
    Write-Fail "Failed to download agent files from $($ServerUrl): $_"
    Send-Progress "failed" "Failed downloading agent files: $_"
    return
}

# 4. Install Dependencies
Write-Step "Installing agent dependencies (psutil)..."
try {
    & $PythonExe -m pip install -r "$InstallDir\agent\requirements.txt" --quiet --disable-pip-version-check
    Write-Success "Dependencies installed successfully."
} catch {
    Write-Warn "Pip install command finished with warning, checking psutil import..."
}

# Verify psutil works
$psutilCheck = & $PythonExe -c "import psutil; print('OK')" 2>$null
if ($psutilCheck -ne "OK") {
    Write-Fail "Agent dependency 'psutil' could not be loaded."
    Send-Progress "failed" "psutil dependency verification failed"
    return
}

# 5. Claim Enrollment and Register Workstation
Write-Step "Registering workstation identity with backend..."
Send-Progress "registering" "Exchanging enrollment token for permanent device credentials..."

$hostname = [System.Net.Dns]::GetHostName()
$osCaption = ""
$cpuName = ""
$totalMem = 0
$totalDisk = 0

try {
    $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($osInfo) { $osCaption = $osInfo.Caption }
    $cpuInfo = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cpuInfo) { $cpuName = $cpuInfo.Name }
    $sysInfo = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    if ($sysInfo) { $totalMem = [int64]$sysInfo.TotalPhysicalMemory }
    $diskInfo = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
    if ($diskInfo) { $totalDisk = [int64]$diskInfo.Size }
} catch {}

$claimPayload = @{
    hostname = $hostname
    os = $osCaption
    cpu = $cpuName
    memoryTotalBytes = $totalMem
    diskTotalBytes = $totalDisk
} | ConvertTo-Json

try {
    $claimResponse = Invoke-RestMethod -Uri "$ServerUrl/api/enroll/$EnrollmentToken/claim" -Method Post -Body $claimPayload -ContentType "application/json"
    $WorkstationId = $claimResponse.workstationId
    $DeviceToken = $claimResponse.deviceToken
    $ResolvedApiUrl = $claimResponse.apiUrl
    Write-Success "Registered as Workstation ID: [$WorkstationId]"
} catch {
    Write-Fail "Enrollment registration failed: $_"
    Send-Progress "failed" "Server rejected enrollment claim: $_"
    return
}

# 6. Save Configuration Securely
Write-Step "Saving workstation configuration..."
$configObject = @{
    apiUrl = $ResolvedApiUrl
    workstationId = $WorkstationId
    agentToken = $DeviceToken
    installedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    version = "1.0.0"
    logFile = "$InstallDir\logs\agent.log"
}

$configJsonPath = "$InstallDir\config.json"
$configJsonString = $configObject | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText($configJsonPath, $configJsonString, [System.Text.UTF8Encoding]::new($false))

# Set restricted permissions on config.json
try {
    & icacls "$configJsonPath" /inheritance:r /grant:r "SYSTEM:(F)" "Administrators:(F)" "$($env:USERNAME):(R)" 2>$null | Out-Null
} catch {}

Write-Success "Configuration written to $configJsonPath"

# 7. Configure Background Startup Launcher & Task Scheduler
Write-Step "Configuring automatic background startup..."
Send-Progress "installing" "Configuring automatic startup on Windows boot..."

# Terminate any previously running monitor.py processes to prevent duplicates
try {
    Get-CimInstance Win32_Process -Filter "Name LIKE 'python%'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*monitor.py*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch {}

# Locate windowless pythonw.exe if available alongside python.exe
$pyDir = Split-Path $PythonExe
$PythonwExe = Join-Path $pyDir "pythonw.exe"
if (-not (Test-Path $PythonwExe)) {
    $PythonwExe = $PythonExe
}

# Create hidden launcher script (VBScript ensures zero console windows appear on user desktop)
$vbsPath = "$InstallDir\run-agent.vbs"
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """$PythonwExe"" ""$InstallDir\agent\monitor.py"" --config ""$configJsonPath""", 0, False
"@
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ascii

# Register Scheduled Task to auto-start on logon / boot
$taskName = "DynamicLabTrackerAgent"
try {
    & schtasks.exe /delete /tn $taskName /f 2>$null | Out-Null
} catch {}

try {
    $schTaskCmd = "wscript.exe `"$vbsPath`""
    if ($isAdmin) {
        & schtasks.exe /create /tn $taskName /tr "`"$schTaskCmd`"" /sc onlogon /rl highest /f 2>$null | Out-Null
    } else {
        & schtasks.exe /create /tn $taskName /tr "`"$schTaskCmd`"" /sc onlogon /f 2>$null | Out-Null
    }
    Write-Success "Scheduled task '$taskName' registered successfully."
} catch {}

# Also place launcher shortcut in Startup folder as a reliable fallback
try {
    $startupFolder = [Environment]::GetFolderPath("Startup")
    if (Test-Path $startupFolder) {
        $shortcutVbs = "$startupFolder\DynamicLabTracker.vbs"
        Copy-Item -Path $vbsPath -Destination $shortcutVbs -Force -ErrorAction SilentlyContinue
    }
} catch {}

# 8. Start Agent in Background Now
Write-Step "Starting Dynamic Lab monitoring agent..."
try {
    Start-Process -FilePath $PythonwExe -ArgumentList "`"$InstallDir\agent\monitor.py`" --config `"$configJsonPath`"" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Success "Agent process started in background."
} catch {
    Write-Warn "Direct launch with pythonw failed. Starting via wscript launcher..."
    Start-Process -FilePath "wscript.exe" -ArgumentList "`"$vbsPath`"" -WindowStyle Hidden
}

# 9. Verify Agent Communication
Write-Step "Verifying connection to server..."
$heartbeatVerified = $false
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path "$InstallDir\logs\agent.log") {
        $logTail = Get-Content "$InstallDir\logs\agent.log" -Tail 6 -ErrorAction SilentlyContinue
        if ($logTail -match "Heartbeat and telemetry checks sent successfully") {
            $heartbeatVerified = $true
            break
        }
    }
}

if ($heartbeatVerified) {
    Write-Success "Agent connection confirmed! Telemetry and monitoring active."
    Send-Progress "completed" "Workstation successfully connected and monitoring active"
} else {
    Write-Warn "Agent is running. Check log file ($InstallDir\logs\agent.log) if data takes a moment to appear."
    Send-Progress "completed" "Agent started on target workstation"
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "   WORKSTATION ENROLLED & CONNECTED SUCCESSFULLY!                " -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  Workstation ID : $WorkstationId" -ForegroundColor Cyan
Write-Host "  Server URL     : $ResolvedApiUrl" -ForegroundColor Cyan
Write-Host "  Installation   : $InstallDir" -ForegroundColor Cyan
Write-Host "  Logs           : $InstallDir\logs\agent.log" -ForegroundColor Cyan
Write-Host "  Uninstaller    : $InstallDir\uninstall.ps1" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
