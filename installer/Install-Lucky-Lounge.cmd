@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Lucky-Lounge.ps1"
if errorlevel 1 (
  echo Installation failed.
  pause
  exit /b 1
)
echo.
echo Lucky Lounge was installed. Use the desktop shortcut to start it.
pause
