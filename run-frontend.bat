@echo off
setlocal enabledelayedexpansion
title BSC Enterprise Frontend - Client Launcher

echo ===============================================================================
echo                BSC ENTERPRISE FRONTEND CLIENT LAUNCHER
echo ===============================================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking frontend dependencies...
if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

echo [2/2] Starting Frontend Vite Server on http://localhost:3000...
echo -------------------------------------------------------------------------------
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
npm --prefix frontend run dev
if %errorlevel% neq 0 (
    echo [ERROR] Frontend server encountered an error.
    pause
)
