@echo off
cd /d "%~dp0"
start "Loxspace local server" /D "%~dp0" cmd /k node server.js
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/Page/blog-maker.html"
