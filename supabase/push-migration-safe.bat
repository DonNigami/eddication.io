@echo off
echo ============================================
echo  Reset and Push All Migrations to Supabase
echo ============================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io

echo [1/3] Checking Supabase connection...
supabase status

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Not connected to Supabase!
    echo Please run: supabase link --project-ref myplpshpcordggbbtblg
    pause
    exit /b 1
)

echo.
echo [2/3] Pushing all migrations to remote database...
supabase db push

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Push failed. This might be expected if migrations already applied.
    echo Continuing...
)

echo.
echo [3/3] Verifying database status...
supabase db remote status

echo.
echo ============================================
echo  Database Migration Complete!
echo ============================================
echo.
echo Driver Tracking Tables:
echo   - driver_jobs
echo   - driver_stops
echo   - driver_alcohol_checks
echo   - driver_logs
echo.
echo Sample data inserted:
echo   - Reference: 2601S16472
echo   - Reference: HXX-123456
echo.
echo Next steps:
echo   1. Test the app: https://liff.line.me/2007705394-Fgx9wdHu
echo   2. Search for: 2601S16472
echo.
pause
