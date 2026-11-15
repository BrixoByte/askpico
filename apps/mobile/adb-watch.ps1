# Keeps adb reverse applied for the Pico WebView dev setup.
#   5173 = Vite dev server (the page)
#   3001 = API backend (chat/agent/memory calls)
# adb reverse lives in adbd's memory and is wiped on reconnect/reboot, so this
# re-applies it every few seconds for every connected device.
#   Loop mode (default): powershell -File adb-watch.ps1
#   One-shot:            powershell -File adb-watch.ps1 -Once   (used by adb-reverse.bat)
# Or hidden at logon via Task Scheduler.

param([switch]$Once)

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) { $adb = "adb" }

$ports = 5173, 3001

while ($true) {
    $serials = & $adb devices |
        Select-String "`tdevice$" |
        ForEach-Object { ($_ -split "`t")[0] }

    if (-not $serials) {
        if ($Once) { Write-Host "No device connected. Check ``adb devices``."; exit 1 }
    } else {
        foreach ($s in $serials) {
            foreach ($p in $ports) {
                & $adb -s $s reverse "tcp:$p" "tcp:$p" 2>$null | Out-Null
            }
        }
        if ($Once) { Write-Host "adb reverse applied for ports $($ports -join ', ') on $($serials.Count) device(s). Reload the app."; exit 0 }
    }

    Start-Sleep -Seconds 5
}
