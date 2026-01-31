@echo off
REM Apply register_data table migration
REM Usage: double-click this file

echo.
echo ======================================================================
echo   DriverConnect - Registration Data Migration
echo ======================================================================
echo.

cd /d "%~dp0"
node apply-register-migration.js

echo.
echo Press any key to exit...
pause >nul
