@echo off
echo ============================================
echo  Allow Duplicate Reference in driver_jobs
echo ============================================
echo.
echo This will remove UNIQUE constraint from reference column:
echo - reference can now have duplicate values
echo - Allows importing ALL rows from Google Sheet
echo - No need to modify or skip duplicate references
echo.
echo Migration file: 20260117_allow_duplicate_reference.sql
echo.
pause

echo.
echo [Step 1] Opening Supabase SQL Editor...
start https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new

echo.
echo [Step 2] Opening migration file...
start notepad "supabase\migrations\20260117_allow_duplicate_reference.sql"

echo.
echo ============================================
echo  Instructions:
echo ============================================
echo.
echo 1. Copy ALL content from migration file (Notepad)
echo 2. Paste into Supabase SQL Editor
echo 3. Click "Run" (or Ctrl+Enter)
echo 4. Wait for success message
echo.
echo This removes UNIQUE constraint:
echo - ALTER TABLE driver_jobs DROP CONSTRAINT driver_jobs_reference_key
echo - Keeps index for performance (non-unique)
echo.
echo After this, reference values can be duplicated
echo.
pause

echo.
echo ============================================
echo  After applying migration:
echo ============================================
echo.
echo 1. Go to debug-import.html
echo 2. Import ALL rows without any modification
echo 3. All rows will be imported with original reference values
echo.
pause
