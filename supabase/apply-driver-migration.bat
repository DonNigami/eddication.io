@echo off
echo ============================================
echo  Apply Driver Tracking Migration ONLY
echo ============================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io

echo This will apply ONLY the driver tracking migration.
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo [1/2] Applying migration directly via psql...

REM Get connection string from supabase
FOR /F "tokens=*" %%i IN ('supabase status --output json 2^>nul ^| findstr /C:"DB URL"') DO SET DB_URL=%%i

if "%DB_URL%"=="" (
    echo.
    echo [INFO] Using Supabase CLI to apply migration...
    supabase db execute --file migrations/20260117_create_driver_tracking_tables.sql
) else (
    echo [INFO] Applying migration file directly...
    psql "%DB_URL%" -f migrations/20260117_create_driver_tracking_tables.sql
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Migration failed!
    echo.
    echo Try manual approach:
    echo 1. Go to: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/editor
    echo 2. Open SQL Editor
    echo 3. Copy content from: supabase\migrations\20260117_create_driver_tracking_tables.sql
    echo 4. Paste and Run
    pause
    exit /b 1
)

echo.
echo [2/2] Verifying tables created...
supabase db execute --query "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'driver%%' ORDER BY tablename;"

echo.
echo ============================================
echo  SUCCESS!
echo ============================================
pause
