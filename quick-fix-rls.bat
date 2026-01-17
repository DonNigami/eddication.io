@echo off
echo ============================================
echo  Quick Fix: Disable RLS for Testing
echo ============================================
echo.
echo This will TEMPORARILY disable RLS on driver_* tables
echo for testing purposes.
echo.
echo WARNING: In production, you should use proper RLS policies!
echo.
pause

echo.
echo [1/2] Opening Supabase SQL Editor...
start https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new

echo.
echo [2/2] Copy and paste this SQL:
echo.
echo ----------------------------------------
echo -- Quick Fix: Disable RLS for Testing
echo ALTER TABLE driver_jobs DISABLE ROW LEVEL SECURITY;
echo ALTER TABLE driver_stops DISABLE ROW LEVEL SECURITY;
echo ALTER TABLE driver_alcohol_checks DISABLE ROW LEVEL SECURITY;
echo ALTER TABLE driver_logs DISABLE ROW LEVEL SECURITY;
echo.
echo SELECT 'RLS disabled for all driver_* tables' as status;
echo ----------------------------------------
echo.
echo Then click "Run" (Ctrl+Enter)
echo.
pause

echo.
echo ============================================
echo  After running SQL:
echo ============================================
echo.
echo 1. Hard refresh browser (Ctrl+Shift+R)
echo 2. Try searching: 2601S16472
echo 3. Should work now!
echo.
pause
