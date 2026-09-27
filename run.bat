@echo off
setlocal enabledelayedexpansion
title BSC Enterprise HRMS & Wedding CRM - System Launcher

echo ===============================================================================
echo            BSC ENTERPRISE HRMS ^& WEDDING CRM - SYSTEM LAUNCHER
echo ===============================================================================
echo.

cd /d "%~dp0"

:: 1. Check Node.js and npm installation
echo [1/5] Checking Node.js environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js v18 or higher from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] npm is not found in PATH!
    pause
    exit /b 1
)

:: 2. Check dependencies
echo [2/5] Verifying project dependencies...
if not exist "node_modules" (
    echo [INFO] Root node_modules not found. Installing dependencies...
    call npm install
)

if not exist "frontend\node_modules" (
    echo [INFO] Frontend node_modules not found. Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

:: 3. Check and start MySQL service if stopped
echo [3/5] Checking MySQL Database Service...
sc query "MySQL80" 2>nul | find /i "RUNNING" >nul
if %errorlevel% neq 0 (
    echo [INFO] Attempting to start MySQL Windows service...
    net start MySQL80 >nul 2>&1
    if %errorlevel% neq 0 (
        net start MySQL >nul 2>&1
    )
)

:: 4. Verify and initialize database if needed
echo [4/5] Verifying database connectivity and schema...
node backend/src/scripts/init_local_db.js
if %errorlevel% neq 0 (
    echo [WARNING] Direct MySQL service check had an issue.
    echo If MySQL is running via XAMPP, Docker, or another port, proceeding to launch...
)

:: 5. Display Access URLs & Credentials
echo.
echo [5/5] Launching Application Services...
echo ===============================================================================
echo   * Public Website     : http://localhost:3000
echo   * Portal Login       : http://localhost:3000/login
echo   * Wedding Registry   : http://localhost:3000/wedding/register
echo   * Backend REST API   : http://localhost:5000/api
echo   * Admin Credentials  : admin@bsctextiles.com / admin@2026
echo ===============================================================================
echo.

:: Automatically open default browser after 3 seconds
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: Start Frontend and Backend servers concurrently
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server encountered an error and stopped.
    pause
)
