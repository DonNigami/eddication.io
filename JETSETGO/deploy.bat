@echo off
REM JETSETGO - Automated Deployment Script for Windows
REM Generated: 2026-02-11T04:05:54.541Z

set SUPABASE_URL=https://icgtllieipahixesllux.supabase.co
set PROJECT_REF=icgtllieipahixesllux

echo ╔══════════════════════════════════════════════════════════════╗
echo ║           JETSETGO - Automated Deployment                    ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Project: %SUPABASE_URL%
echo.

REM Check if supabase CLI is installed
where supabase >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Supabase CLI not found!
    echo    Install: npm install -g supabase
    exit /b 1
)

echo 🔍 Checking Supabase login status...
supabase projects list >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo    Please login to Supabase:
    supabase login
)

echo    ✅ Logged in
echo.

echo 🔗 Linking to project...
supabase link --project-ref %PROJECT_REF%
echo    ✅ Linked
echo.

echo 🚀 Deploying Edge Functions...
echo.

echo    Deploying: jetsetgo-embed
supabase functions deploy jetsetgo-embed
echo    ✅ jetsetgo-embed deployed
echo.


echo    Deploying: jetsetgo-ingest
supabase functions deploy jetsetgo-ingest
echo    ✅ jetsetgo-ingest deployed
echo.


echo    Deploying: jetsetgo-ocr
supabase functions deploy jetsetgo-ocr
echo    ✅ jetsetgo-ocr deployed
echo.


echo    Deploying: jetsetgo-structure
supabase functions deploy jetsetgo-structure
echo    ✅ jetsetgo-structure deployed
echo.


echo    Deploying: jetsetgo-rag-query
supabase functions deploy jetsetgo-rag-query
echo    ✅ jetsetgo-rag-query deployed
echo.


echo    Deploying: jetsetgo-line-webhook
supabase functions deploy jetsetgo-line-webhook
echo    ✅ jetsetgo-line-webhook deployed
echo.


echo    Deploying: jetsetgo-agent
supabase functions deploy jetsetgo-agent
echo    ✅ jetsetgo-agent deployed
echo.
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    Deployment Complete!                      ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Next Steps:
echo   1. Go to: https://supabase.com/dashboard/project/%PROJECT_REF%/sql/new
echo   2. Run migrations from: deploy-combined-migrations.sql
echo   3. Configure environment variables in Dashboard -^> Edge Functions
echo   4. Set LINE webhook to: %SUPABASE_URL%/functions/v1/jetsetgo-line-webhook
echo.
pause
