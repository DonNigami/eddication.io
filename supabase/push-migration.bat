@echo off
echo ============================================
echo  Push Driver Tracking Migration to Supabase
echo ============================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io

echo [1/2] Pushing migration to Supabase...
supabase db push

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to push migration!
    pause
    exit /b 1
)

echo.
echo [2/2] Verifying tables...
supabase db remote status

echo.
echo ============================================
echo  SUCCESS! Database is ready!
echo ============================================
echo.
echo Tables created:
echo   - driver_jobs (งานขนส่ง)
echo   - driver_stops (จุดส่ง)
echo   - driver_alcohol_checks (ตรวจแอลกอฮอล์)
echo   - driver_logs (Log การทำงาน)
echo.
echo Sample data:
echo   - Reference: 2601S16472 (2 stops)
echo   - Reference: HXX-123456 (test job)
echo.
pause
