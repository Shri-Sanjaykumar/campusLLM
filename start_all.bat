@echo off
title CampusLLM Launcher
echo Starting CampusLLM Services...
start "CampusLLM Backend" cmd /k "%~dp0start_backend.bat"
timeout /t 3 /nobreak >nul
start "CampusLLM Frontend" cmd /k "%~dp0start_frontend.bat"
echo Both servers launched!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3005
