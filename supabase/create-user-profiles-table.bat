@echo off
echo ============================================
echo  Create user_profiles Table
echo ============================================
echo.
echo This will create a table to track all users
echo who open the LIFF app.
echo.
pause

echo.
echo [1/2] Opening Supabase SQL Editor...
start https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new

echo.
echo [2/2] Instructions:
echo.
echo 1. Copy all content from:
echo    supabase\migrations\20260117_create_user_profiles.sql
echo.
echo 2. Paste in SQL Editor
echo.
echo 3. Click "Run" (Ctrl+Enter)
echo.
echo 4. You should see: "user_profiles table created successfully"
echo.
pause

echo.
echo ============================================
echo  After creating table:
echo ============================================
echo.
echo 1. Commit and push changes
echo 2. Deploy to GitHub Pages
echo 3. Test the app - user profile will be saved automatically
echo.
echo To view users:
echo SELECT * FROM user_profiles ORDER BY last_seen_at DESC;
echo.
pause
