@echo off
cd /d "%~dp0"

REM Create directories
echo Creating directories...
mkdir "_shared" 2>nul
mkdir "search-job" 2>nul
mkdir "update-stop" 2>nul
mkdir "upload-alcohol" 2>nul
mkdir "close-job" 2>nul
mkdir "end-trip" 2>nul

REM Verify directories were created
echo.
echo Directory structure after creation:
dir /B

pause
