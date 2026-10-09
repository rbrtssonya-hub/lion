@echo off
cd /d "%~dp0" || exit /b 1
call npm run dev -- --open
pause
