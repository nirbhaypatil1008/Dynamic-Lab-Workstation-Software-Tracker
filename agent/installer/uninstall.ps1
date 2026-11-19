<#
.SYNOPSIS
    Dynamic Lab Workstation & Software Tracker - Agent Uninstaller
.DESCRIPTION
    Stops the background monitoring agent, removes scheduled startup tasks,
    and removes agent local configuration files.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "   DYNAMIC LAB WORKSTATION TRACKER - AGENT UNINSTALLER           " -ForegroundColor White
Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host ""

# 1. Stop background processes
Write-Host "[*] Stopping running monitoring agent processes..." -ForegroundColor Cyan
try {
    Get-CimInstance Win32_Process -Filter "Name LIKE 'python%'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*monitor.py*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch {}
Write-Host "[+] Agent processes stopped." -ForegroundColor Green

# 2. Remove Scheduled Task
Write-Host "[*] Removing scheduled startup tasks..." -ForegroundColor Cyan
& schtasks.exe /delete /tn "DynamicLabTrackerAgent" /f 2>$null | Out-Null
Write-Host "[+] Scheduled task removed." -ForegroundColor Green

# Remove any startup shortcuts
$startupFolder = [Environment]::GetFolderPath("Startup")
if (Test-Path "$startupFolder\DynamicLabTracker.url") {
    Remove-Item -Force "$startupFolder\DynamicLabTracker.url" -ErrorAction SilentlyContinue
}
if (Test-Path "$startupFolder\DynamicLabTracker.vbs") {
    Remove-Item -Force "$startupFolder\DynamicLabTracker.vbs" -ErrorAction SilentlyContinue
}

# 3. Clean up installation directories
$dirs = @(
    "$env:ProgramData\DynamicLabTracker",
    "$env:LOCALAPPDATA\DynamicLabTracker"
)

foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Write-Host "[*] Removing directory: $dir" -ForegroundColor Cyan
        Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
        Write-Host "[+] Removed: $dir" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "   UNINSTALLATION COMPLETE                                       " -ForegroundColor White
Write-Host "   Dynamic Lab monitoring agent has been removed.                " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host ""
