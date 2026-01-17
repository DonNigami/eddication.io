@echo off
REM ============================================
REM Quick Deploy to GitHub Pages
REM ============================================

echo.
echo ========================================
echo   Deploy to GitHub Pages
echo ========================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\PTGLG\driverconnect\driverapp

echo [1/6] Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git not found! Please install Git first.
    echo Download: https://git-scm.com/download/win
    pause
    exit /b 1
)
echo [OK] Git is installed
echo.

echo [2/6] Initializing Git repository...
if not exist ".git" (
    git init
    echo [OK] Git initialized
) else (
    echo [OK] Git already initialized
)
echo.

echo [3/6] Adding files...
git add .
echo [OK] Files added
echo.

echo [4/6] Committing...
git commit -m "Deploy LINE LIFF app" >nul 2>&1
echo [OK] Changes committed
echo.

echo [5/6] Setting up remote...
echo.
echo IMPORTANT: Create a new repository on GitHub first!
echo 1. Go to: https://github.com/new
echo 2. Repository name: driver-connect
echo 3. Click "Create repository"
echo.
echo Then enter your GitHub username:
set /p GITHUB_USER="GitHub username: "

git remote remove origin >nul 2>&1
git remote add origin https://github.com/%GITHUB_USER%/driver-connect.git
git branch -M main
echo [OK] Remote configured
echo.

echo [6/6] Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
    echo [ERROR] Push failed!
    echo.
    echo Possible reasons:
    echo - Repository doesn't exist
    echo - Wrong username
    echo - No permission
    echo.
    pause
    exit /b 1
)
echo [OK] Pushed to GitHub!
echo.

echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Your files are at:
echo   https://github.com/%GITHUB_USER%/driver-connect
echo.
echo Next steps:
echo.
echo 1. Enable GitHub Pages:
echo    - Go to: https://github.com/%GITHUB_USER%/driver-connect/settings/pages
echo    - Source: Deploy from branch
echo    - Branch: main
echo    - Click Save
echo.
echo 2. Wait 1-2 minutes for deployment
echo.
echo 3. Your app will be at:
echo    https://%GITHUB_USER%.github.io/driver-connect/index-supabase.html
echo.
echo 4. Set Endpoint URL in LINE Console:
echo    - Go to: https://developers.line.biz/console/
echo    - Open your LIFF app (2007705394-Fgx9wdHu)
echo    - Set Endpoint URL to: https://%GITHUB_USER%.github.io/driver-connect/index-supabase.html
echo    - Save
echo.
echo 5. Test by opening in LINE app:
echo    https://liff.line.me/2007705394-Fgx9wdHu
echo.
pause
