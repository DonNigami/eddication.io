@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo   Supabase Migration List
echo ========================================
echo.

if not exist "supabase\migrations\" (
    echo ERROR: supabase/migrations directory not found
    exit /b 1
)

echo Checking migrations folder...
echo.
dir /B /O:N "supabase\migrations\*.sql"
echo.

echo ========================================
echo Run 'supabase migration list' for full details
echo ========================================
pause
