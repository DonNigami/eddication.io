@echo off
echo ============================================
echo  Switch to Modular Version
echo ============================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\PTGLG\driverconnect\driverapp

echo [1/3] Backing up V3...
if exist index-supabase-v3.html (
    copy /Y index-supabase-v3.html index-supabase-v3.html.backup
    echo V3 backed up
)

echo.
echo [2/3] Setting modular as default...
copy /Y index-supabase-modular.html index.html

echo.
echo [3/3] Done!
echo.
echo ============================================
echo  Recommended file: index-supabase-modular.html
echo  Also copied to: index.html
echo ============================================
echo.
echo Next steps:
echo 1. cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
echo 2. git add .
echo 3. git commit -m "Switch to modular version with enhanced UX"
echo 4. git push
echo.
pause
