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
if "%COMMIT_MSG%"=="" set COMMIT_MSG=fix: Update LIFF ID and add comprehensive debugging tools

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
        echo [ERROR] Push failed. Trying 'master' branch...
        git push origin master
        
        if %ERRORLEVEL% EQU 0 (
            echo.
            echo [SUCCESS] Push to master successful!
        ) else (
            echo.
            echo [ERROR] Push failed. Try:
            echo   1. git push (if upstream is set)
            echo   2. Check network connection
            echo   3. Check remote permissions
        )
    )
) else (
    echo.
    echo [ERROR] Commit failed or nothing to commit
    echo.
    git status
)

echo.
echo ========================================
echo   Done!
echo ========================================
pause
