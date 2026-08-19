@echo off
title CampusLLM Backend Server
cd /d "%~dp0Backend"
echo ========================================================
echo Starting CampusLLM Backend on http://localhost:8000 ...
echo ========================================================
call "env\Scripts\activate.bat"
python -m uvicorn app:app --reload --port 8000
pause
