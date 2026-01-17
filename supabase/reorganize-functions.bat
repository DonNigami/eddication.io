@echo off
REM ============================================
REM Reorganize Supabase Edge Functions Structure
REM ============================================

echo ========================================
echo   Reorganizing Edge Functions
echo ========================================
echo.

cd /d "%~dp0functions"

REM Create directory structure
echo [1/3] Creating directories...
mkdir "_shared" 2>nul
mkdir "search-job" 2>nul
mkdir "update-stop" 2>nul
mkdir "upload-alcohol" 2>nul
mkdir "close-job" 2>nul
mkdir "end-trip" 2>nul
echo Done!

echo.
echo [2/3] Moving files to correct locations...

REM Move shared files
if exist "types.ts" (
    move /Y "types.ts" "_shared\types.ts" >nul
    echo Moved: types.ts -^> _shared\types.ts
)
if exist "utils.ts" (
    move /Y "utils.ts" "_shared\utils.ts" >nul
    echo Moved: utils.ts -^> _shared\utils.ts
)

REM Move function files
if exist "search-job.ts" (
    move /Y "search-job.ts" "search-job\index.ts" >nul
    echo Moved: search-job.ts -^> search-job\index.ts
)
if exist "update-stop.ts" (
    move /Y "update-stop.ts" "update-stop\index.ts" >nul
    echo Moved: update-stop.ts -^> update-stop\index.ts
)
if exist "upload-alcohol.ts" (
    move /Y "upload-alcohol.ts" "upload-alcohol\index.ts" >nul
    echo Moved: upload-alcohol.ts -^> upload-alcohol\index.ts
)
if exist "close-job.ts" (
    move /Y "close-job.ts" "close-job\index.ts" >nul
    echo Moved: close-job.ts -^> close-job\index.ts
)
if exist "end-trip.ts" (
    move /Y "end-trip.ts" "end-trip\index.ts" >nul
    echo Moved: end-trip.ts -^> end-trip\index.ts
)

echo.
echo [3/3] Fixing import paths...

REM Fix imports in search-job
powershell -Command "(Get-Content 'search-job\index.ts') -replace '\./types\.ts', '../_shared/types.ts' -replace '\./utils\.ts', '../_shared/utils.ts' | Set-Content 'search-job\index.ts'"

REM Fix imports in update-stop
powershell -Command "(Get-Content 'update-stop\index.ts') -replace '\./types\.ts', '../_shared/types.ts' -replace '\./utils\.ts', '../_shared/utils.ts' | Set-Content 'update-stop\index.ts'"

REM Fix imports in upload-alcohol
powershell -Command "(Get-Content 'upload-alcohol\index.ts') -replace '\./types\.ts', '../_shared/types.ts' -replace '\./utils\.ts', '../_shared/utils.ts' | Set-Content 'upload-alcohol\index.ts'"

REM Fix imports in close-job
powershell -Command "(Get-Content 'close-job\index.ts') -replace '\./types\.ts', '../_shared/types.ts' -replace '\./utils\.ts', '../_shared/utils.ts' | Set-Content 'close-job\index.ts'"

REM Fix imports in end-trip
powershell -Command "(Get-Content 'end-trip\index.ts') -replace '\./types\.ts', '../_shared/types.ts' -replace '\./utils\.ts', '../_shared/utils.ts' | Set-Content 'end-trip\index.ts'"

echo Done!

echo.
echo ========================================
echo   Reorganization Complete!
echo ========================================
echo.
echo New structure:
echo   functions/
echo     _shared/
echo       types.ts
echo       utils.ts
echo     search-job/
echo       index.ts
echo     update-stop/
echo       index.ts
echo     upload-alcohol/
echo       index.ts
echo     close-job/
echo       index.ts
echo     end-trip/
echo       index.ts
echo.
echo Ready to deploy with: supabase functions deploy
echo.
pause
