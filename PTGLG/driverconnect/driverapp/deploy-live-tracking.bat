@echo off
REM Deploy Live Tracking Feature to Supabase and GitHub Pages
echo =========================================
echo   Live Tracking Feature Deployment
echo =========================================
echo.

echo [1/4] Deploying Edge Functions...
echo.

echo Deploying start-live-tracking...
call supabase functions deploy start-live-tracking
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to deploy start-live-tracking
    pause
    exit /b 1
)

echo.
echo Deploying stop-live-tracking...
call supabase functions deploy stop-live-tracking
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to deploy stop-live-tracking
    pause
    exit /b 1
)

echo.
echo [2/4] Staging files for Git...
git add PTGLG\driverconnect\driverapp\js\live-tracking.js
git add PTGLG\driverconnect\driverapp\js\config.js
git add PTGLG\driverconnect\driverapp\js\app.js
git add PTGLG\driverconnect\driverapp\track\
git add PTGLG\driverconnect\driverapp\LIVE_TRACKING_GUIDE.md
git add supabase\functions\start-live-tracking\
git add supabase\functions\stop-live-tracking\

echo.
echo [3/4] Committing changes...
git commit -m "feat: Add Live Tracking with Smart Model (auto-switch 15s/5min intervals)"

echo.
echo [4/4] Pushing to GitHub...
git push

echo.
echo =========================================
echo   Deployment Complete!
echo =========================================
echo.
echo Next Steps:
echo 1. Apply migration in Supabase Dashboard:
echo    supabase/migrations/20260120134241_create_driver_live_locations_table.sql
echo.
echo 2. Test Driver App:
echo    https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase-modular.html
echo.
echo 3. Test Tracking Page:
echo    https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/track/?driver_user_id=YOUR_USER_ID
echo.
pause
