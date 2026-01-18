@echo off
REM =====================================================
REM Sync Driver Jobs to JobData
REM =====================================================
REM Script นี้จะ:
REM 1. Run migration เพื่อสร้าง functions
REM 2. เรียกใช้ sync_all_driver_jobs_to_jobdata()
REM =====================================================

echo.
echo ============================================
echo   SYNC DRIVER JOBS TO JOBDATA
echo ============================================
echo.

REM Apply migration
echo [1/2] Creating/Updating merge functions...
supabase db push --db-url %SUPABASE_URL%

REM Run sync function
echo.
echo [2/2] Running sync function...
echo.

REM Create temp SQL file
echo SELECT * FROM sync_all_driver_jobs_to_jobdata(); > temp_sync.sql

REM Execute via psql if available
psql %DATABASE_URL% -f temp_sync.sql 2>nul

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo Cannot execute via psql. Please run this SQL in Supabase SQL Editor:
  echo.
  echo   SELECT * FROM sync_all_driver_jobs_to_jobdata^(^);
  echo.
  echo Or for specific reference:
  echo   SELECT * FROM merge_driver_jobs_to_jobdata^('YOUR_REFERENCE'^);
  echo.
)

REM Cleanup
if exist temp_sync.sql del temp_sync.sql

echo.
echo ============================================
echo   SYNC COMPLETE
echo ============================================
echo.
pause
