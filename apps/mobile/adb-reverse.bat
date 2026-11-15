@echo off
REM One-shot adb reverse for the Pico WebView dev setup (ports 5173 + 3001).
REM Wrapper around adb-watch.ps1 -Once so it works with multiple devices.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0adb-watch.ps1" -Once
