@echo off
setlocal enabledelayedexpansion
title BSC Enterprise - Security & Integration Test Suite

echo ===============================================================================
echo            BSC ENTERPRISE - FIREWALL & INTEGRATION TEST RUNNER
echo ===============================================================================
echo.

cd /d "%~dp0"

echo Running all automated test suites...
echo -------------------------------------------------------------------------------
call npm test
echo -------------------------------------------------------------------------------
if %errorlevel% equ 0 (
    echo [SUCCESS] All test suites completed successfully.
) else (
    echo [WARNING] Some tests reported failures.
)
echo.
pause
