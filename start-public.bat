@echo off
title FinWise AI Launcher
echo ======================================================
echo Starting FinWise AI Platform with Public HTTPS Hosting
echo ======================================================

set "PATH=C:\Program Files\nodejs;%PATH%"

echo [1/3] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start /B "" "c:\Users\nough\Downloads\finwise-ai\finwise-ai\backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

timeout /t 2 /nobreak >nul

echo [2/3] Launching Next.js Production Frontend on http://localhost:3000 ...
start /B "" /D "c:\Users\nough\Downloads\finwise-ai\finwise-ai\frontend" "C:\Program Files\nodejs\npm.cmd" run start

timeout /t 3 /nobreak >nul

echo [3/3] Creating Secure Cloudflare Public Tunnel...
echo The public HTTPS URL will appear below:
"c:\Users\nough\Downloads\finwise-ai\finwise-ai\cloudflared.exe" tunnel --url http://localhost:3000
pause
