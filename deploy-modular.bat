@echo off
echo ============================================
echo  Deploying Enhanced Modular Version
echo ============================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io

echo [1/3] Adding files...
git add PTGLG\driverconnect\driverapp\index-supabase-modular.html
git add PTGLG\driverconnect\driverapp\js\enhanced-ux.js
git add PTGLG\driverconnect\driverapp\js\supabase-api-helper.js

echo.
echo [2/3] Committing...
git commit -m "Add enhanced UX features to modular version (PTR, Quick Actions, Toast, Syncing Bar)"

echo.
echo [3/3] Pushing to GitHub...
git push

echo.
echo ============================================
echo  SUCCESS! Deployed to GitHub Pages
echo ============================================
echo.
echo Wait 1-2 minutes, then test at:
echo https://liff.line.me/2007705394-Fgx9wdHu
echo.
echo Or directly:
echo https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase-modular.html
echo.
pause
