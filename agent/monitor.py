import argparse
import ctypes
import json
import os
import platform
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import urllib.parse
from pathlib import Path

import psutil

if sys.platform == "win32":
    import winreg


def get_windows_software():
    products = []
    registry_paths = (
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    )
    for hive, path in registry_paths:
        try:
            root = winreg.OpenKey(hive, path)
        except OSError:
            continue
        with root:
            for index in range(winreg.QueryInfoKey(root)[0]):
                try:
                    subkey_name = winreg.EnumKey(root, index)
                    with winreg.OpenKey(root, subkey_name) as subkey:
                        name = winreg.QueryValueEx(subkey, "DisplayName")[0]
                        version = _registry_value(subkey, "DisplayVersion")
                        publisher = _registry_value(subkey, "Publisher")
                        if name:
                            products.append({
                                "name": str(name)[:200],
                                "version": str(version or "")[:100],
                                "publisher": str(publisher or "")[:200],
                                "source": "windows-registry",
                            })
                except OSError:
                    continue
    return _deduplicate(products)


def _registry_value(key, name):
    try:
        return winreg.QueryValueEx(key, name)[0]
    except OSError:
        return ""


def _deduplicate(products):
    unique = {}
    for product in products:
        key = (product["name"].casefold(), product["version"])
        unique[key] = product
    return list(unique.values())


def get_linux_software():
    if Path("/usr/bin/dpkg-query").exists():
        command = ["dpkg-query", "-W", "-f=${Package}\\t${Version}\\t${binary:Summary}\\n"]
        source = "dpkg"
    elif Path("/usr/bin/rpm").exists():
        command = ["rpm", "-qa", "--qf", "%{NAME}\\t%{VERSION}-%{RELEASE}\\t%{SUMMARY}\\n"]
        source = "rpm"
    else:
        return []
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return []
    products = []
    for line in result.stdout.splitlines():
        parts = line.split("\t", 2)
        if parts and parts[0].strip():
            products.append({
                "name": parts[0].strip()[:200],
                "version": parts[1].strip()[:100] if len(parts) > 1 else "",
                "publisher": "",
                "source": source,
            })
    return _deduplicate(products)


def get_software():
    if sys.platform == "win32":
        return get_windows_software()
    if sys.platform.startswith("linux"):
        return get_linux_software()
    return []


def activity_status():
    if sys.platform == "win32":
        try:
            sessions = psutil.users()
        except psutil.Error:
            return "unknown"
        if not sessions:
            return "available"
        return _windows_session_activity()
    if sys.platform.startswith("linux"):
        try:
            return "available" if not psutil.users() else "unknown"
        except psutil.Error:
            return "unknown"
    return "unknown"


def _windows_session_activity():
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    current_session_id = wintypes.DWORD()
    if not kernel32.ProcessIdToSessionId(kernel32.GetCurrentProcessId(), ctypes.byref(current_session_id)):
        return "unknown"
    active_console_id = kernel32.WTSGetActiveConsoleSessionId()
    if active_console_id == 0xFFFFFFFF or current_session_id.value != active_console_id:
        return "unknown"

    class LastInputInfo(ctypes.Structure):
        _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]

    last_input = LastInputInfo()
    last_input.cbSize = ctypes.sizeof(LastInputInfo)
    if not user32.GetLastInputInfo(ctypes.byref(last_input)):
        return "unknown"
    idle_milliseconds = (kernel32.GetTickCount() - last_input.dwTime) & 0xFFFFFFFF
    idle_threshold = max(60, int(os.environ.get("LAB_TRACKER_IDLE_AFTER_SECONDS", "600"))) * 1000
    return "idle" if idle_milliseconds >= idle_threshold else "in_use"


def send_json(api_url, endpoint, workstation_id, token, payload=None, timeout=10):
    body = {"workstationId": workstation_id}
    if payload:
        body.update(payload)
    request = urllib.request.Request(
        api_url.rstrip("/") + endpoint,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "User-Agent": "DynamicLabAgent/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def metrics(api_url, workstation_id, token):
    memory = psutil.virtual_memory()
    root = Path.home().anchor or "/"
    disk = psutil.disk_usage(root)
    try:
        api = urllib.parse.urlparse(api_url)
        port = api.port or (443 if api.scheme == "https" else 80)
        with socket.create_connection((api.hostname, port), timeout=2):
            network = "connected"
    except OSError:
        network = "unknown"
    return send_json(api_url, "/api/agent/metrics", workstation_id, token, {
        "cpuPercent": psutil.cpu_percent(interval=0.5),
        "memoryPercent": memory.percent,
        "diskPercent": disk.percent,
        "networkStatus": network,
    })


def heartbeat(api_url, workstation_id, token):
    memory = psutil.virtual_memory()
    root = Path.home().anchor or "/"
    disk = psutil.disk_usage(root)
    return send_json(api_url, "/api/agent/heartbeat", workstation_id, token, {
        "hostname": socket.gethostname(),
        "os": f"{platform.system()} {platform.release()}",
        "cpu": platform.processor() or platform.machine(),
        "memoryTotalBytes": memory.total,
        "diskTotalBytes": disk.total,
        "activityStatus": activity_status(),
    })


def run(api_url, workstation_id, token, interval):
    last_inventory = -1800
    last_metrics = -60
    while True:
        started = time.monotonic()
        try:
            heartbeat(api_url, workstation_id, token)
            if started - last_metrics >= 60:
                metrics(api_url, workstation_id, token)
                last_metrics = started
            if started - last_inventory >= 1800:
                inventory = get_software()
                send_json(api_url, "/api/agent/inventory", workstation_id, token, {"software": inventory}, timeout=90)
                last_inventory = started
            print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} heartbeat and scheduled checks sent", flush=True)
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
            print(f"{time.strftime('%Y-%m-%d %H:%M:%S')} reporting failed: {error}", file=sys.stderr, flush=True)
        time.sleep(max(1, interval - (time.monotonic() - started)))


def main():
    parser = argparse.ArgumentParser(description="Authorized laboratory workstation monitoring agent")
    parser.add_argument("--api-url", default=os.environ.get("LAB_TRACKER_API_URL", "http://127.0.0.1:3001"))
    parser.add_argument("--workstation-id", default=os.environ.get("LAB_TRACKER_WORKSTATION_ID"))
    parser.add_argument("--token", default=os.environ.get("LAB_TRACKER_AGENT_TOKEN"))
    parser.add_argument("--interval", type=int, default=20)
    args = parser.parse_args()
    if not args.workstation_id or not args.token:
        parser.error("Set LAB_TRACKER_WORKSTATION_ID and LAB_TRACKER_AGENT_TOKEN or pass both command-line options.")
    if not args.api_url.lower().startswith("https://") and not (
        args.api_url.startswith("http://127.0.0.1") or args.api_url.startswith("http://localhost")
    ):
        parser.error("Use HTTPS for remote agent connections. Plain HTTP is allowed only on localhost.")
    run(args.api_url, args.workstation_id, args.token, args.interval)


if __name__ == "__main__":
    main()
