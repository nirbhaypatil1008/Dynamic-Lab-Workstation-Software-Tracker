# Dynamic Lab Workstation Installer

This folder contains the automated connection and monitoring scripts for Dynamic Lab Workstations.

## Files

- `install.ps1`: The automated Windows PowerShell installer that downloads the agent, sets up Python dependencies, registers the workstation via a one-time enrollment token, and schedules background startup.
- `uninstall.ps1`: Completely stops the background agent, deletes the scheduled startup task, and removes configuration files.

## Automated One-Command Installation

Generate a connection command from the **Dynamic Lab Administrator Dashboard** (**Admin Hub → Workstations → Connect New Computer**).

Run the generated command in PowerShell:

```powershell
& ([scriptblock]::Create((irm 'http://<SERVER-IP>:3001/api/enroll/<ENROLLMENT-TOKEN>/install.ps1')))
```

## Manual Uninstallation

On the target computer, open PowerShell as Administrator and run:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\ProgramData\DynamicLabTracker\uninstall.ps1"
```
Or for user-level installation:
```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\DynamicLabTracker\uninstall.ps1"
```
