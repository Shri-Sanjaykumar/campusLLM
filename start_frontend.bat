@echo off
title CampusLLM Frontend App
cd /d "%~dp0frontend"
echo ========================================================
echo Starting CampusLLM Frontend on http://localhost:3005 ...
echo ========================================================
npm run dev
pause
