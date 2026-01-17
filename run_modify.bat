@echo off
echo.
echo ============================================================
echo  File Copy and Modification Script
echo ============================================================
echo.
cd /d D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
python temp_modify_script.py
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo  Script completed successfully!
    echo ============================================================
) else (
    echo.
    echo ============================================================
    echo  Script failed with error code %ERRORLEVEL%
    echo ============================================================
)
echo.
pause
