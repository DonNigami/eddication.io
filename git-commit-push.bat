@echo off
REM Git Commit and Push Helper Script
REM Skips files that fail to push

echo ========================================
echo   Git Commit and Push Script
echo ========================================
echo.

cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io

echo Current Directory: %CD%
echo.

echo ----------------------------------------
echo   Git Status
echo ----------------------------------------
git status
echo.

echo ----------------------------------------
echo   Adding Changes
echo ----------------------------------------

REM Add only PTGLG directory (where we made changes)
git add PTGLG/driverconnect/driverapp/

echo.
echo Files staged for commit:
git diff --cached --name-only
echo.

set /p COMMIT_MSG="Enter commit message (or press Enter for default): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=fix: Supabase errors and add documentation

echo.
echo ----------------------------------------
echo   Committing Changes
echo ----------------------------------------
git commit -m "%COMMIT_MSG%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Commit successful!
    echo.
    
    echo ----------------------------------------
    echo   Pushing to Remote
    echo ----------------------------------------
    git push origin main
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [SUCCESS] Push successful!
    ) else (
        echo.
        echo [ERROR] Push failed. Try:
        echo   1. git push origin master (if main branch is named master)
        echo   2. git push (if upstream is set)
        echo   3. Check network connection
    )
) else (
    echo.
    echo [ERROR] Commit failed or nothing to commit
)

echo.
echo ========================================
echo   Done!
echo ========================================
pause
