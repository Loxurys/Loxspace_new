@echo off
cd /d "%~dp0"
start "Loxspace Netlify Dev" /D "%~dp0" cmd /k npm run dev:netlify
timeout /t 5 /nobreak >nul
start "" "http://localhost:8888"
