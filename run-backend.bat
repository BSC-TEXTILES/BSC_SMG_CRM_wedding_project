@echo off
setlocal enabledelayedexpansion
title BSC Enterprise Backend API - Service Launcher

echo ===============================================================================
echo                BSC ENTERPRISE BACKEND API SERVICE LAUNCHER
echo ===============================================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    pause
    exit /b 1
)

echo [2/3] Verifying database connectivity...
node backend/src/scripts/init_local_db.js

echo.
echo [3/3] Starting Backend API Server on http://localhost:5000...
echo -------------------------------------------------------------------------------
call npm run dev:backend
if %errorlevel% neq 0 (
    echo [ERROR] Backend stopped with error.
    pause
)
