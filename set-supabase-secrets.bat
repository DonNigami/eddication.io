@echo off
REM ============================================
REM Set Supabase Secrets (Fixed)
REM ============================================

echo.
echo ========================================
echo   Setting Supabase Secrets
echo ========================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io

echo [1/2] Setting SERVICE_ROLE_KEY...
supabase secrets set SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQwMjY4OCwiZXhwIjoyMDgzOTc4Njg4fQ.KB3C_BNuO0-52E6D83MKTcJPLFCG__ea0MgzzFkJxAs
if errorlevel 1 (
    echo [ERROR] Failed to set SERVICE_ROLE_KEY
    pause
    exit /b 1
)
echo [OK] SERVICE_ROLE_KEY set successfully!
echo.

echo [2/2] Verifying secrets...
supabase secrets list
echo.

echo ========================================
echo   Secrets Configuration Complete!
echo ========================================
echo.
echo Note: PROJECT_URL is hardcoded in functions as fallback
echo URL: https://myplpshpcordggbbtblg.supabase.co
echo.
echo ========================================
echo   Now Deploying Updated Functions
echo ========================================
echo.

echo Deploying functions with updated environment variables...
cd supabase
supabase functions deploy --no-verify-jwt
cd ..

echo.
echo ========================================
echo   Complete!
echo ========================================
echo.
echo Next step:
echo 1. Go to LINE Developers Console:
echo    https://developers.line.biz/console/
echo.
echo 2. Find LIFF app: 2007705394-Fgx9wdHu
echo.
echo 3. Set Endpoint URL to:
echo    https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase.html
echo.
echo 4. Save and test in LINE app:
echo    https://liff.line.me/2007705394-Fgx9wdHu
echo.
pause
