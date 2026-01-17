@echo off
REM Supabase Status Check Helper Script
REM Run this in Command Prompt for quick status check

echo.
echo ================================================
echo   Supabase Project Status Check
echo ================================================
echo.
echo Project: myplpshpcordggbbtblg
echo URL: https://myplpshpcordggbbtblg.supabase.co
echo.
echo ------------------------------------------------
echo   Checking Supabase CLI...
echo ------------------------------------------------
echo.

REM Check if supabase CLI is installed
where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Supabase CLI not found!
    echo.
    echo Please install Supabase CLI:
    echo   - Windows ^(Scoop^): scoop install supabase
    echo   - Download: https://github.com/supabase/cli/releases
    echo.
    goto :end
)

echo [OK] Supabase CLI found
echo.
supabase --version
echo.

echo ------------------------------------------------
echo   Project Status
echo ------------------------------------------------
echo.
supabase status
echo.

echo ------------------------------------------------
echo   Migration List
echo ------------------------------------------------
echo.
supabase migration list
echo.

echo ------------------------------------------------
echo   Linked Projects
echo ------------------------------------------------
echo.
supabase projects list
echo.

:end
echo ================================================
echo   Status check complete!
echo ================================================
echo.
pause
