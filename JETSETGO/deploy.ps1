# JETSETGO - PowerShell Deployment Script
# Generated: 2026-02-11T04:05:54.542Z

$ErrorActionPreference = "Stop"

$SUPABASE_URL = "https://icgtllieipahixesllux.supabase.co"
$PROJECT_REF = "icgtllieipahixesllux"

Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           JETSETGO - Automated Deployment                    ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $SUPABASE_URL"
Write-Host ""

# Check if supabase CLI is installed
Write-Host "🔍 Checking Supabase CLI..." -ForegroundColor Yellow
try {
    $null = supabase --version
} catch {
    Write-Host "   ❌ Supabase CLI not found!" -ForegroundColor Red
    Write-Host "   Install: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}
Write-Host "   ✅ Supabase CLI found" -ForegroundColor Green
Write-Host ""

# Check login status
Write-Host "🔍 Checking login status..." -ForegroundColor Yellow
$loginCheck = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Please login:" -ForegroundColor Yellow
    supabase login
}
Write-Host "   ✅ Logged in" -ForegroundColor Green
Write-Host ""

# Link project
Write-Host "🔗 Linking to project..." -ForegroundColor Yellow
supabase link --project-ref $PROJECT_REF
Write-Host "   ✅ Linked" -ForegroundColor Green
Write-Host ""

# Deploy functions
Write-Host "🚀 Deploying Edge Functions..." -ForegroundColor Yellow
Write-Host ""

$functions = @(
    "jetsetgo-embed",
    "jetsetgo-ingest",
    "jetsetgo-ocr",
    "jetsetgo-structure",
    "jetsetgo-rag-query",
    "jetsetgo-line-webhook",
    "jetsetgo-agent"
)

foreach ($func in $functions) {
    Write-Host "   Deploying: $func" -ForegroundColor Cyan
    supabase functions deploy $func
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ $func deployed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Failed to deploy $func" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    Deployment Complete!                      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. SQL Editor: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
Write-Host "  2. Run: deploy-combined-migrations.sql"
Write-Host "  3. Configure env vars in Dashboard -> Edge Functions"
Write-Host "  4. LINE Webhook: $SUPABASE_URL/functions/v1/jetsetgo-line-webhook"
Write-Host ""
$test = Read-Host "Test deployment now? (y/n)"
if ($test -eq "y") {
    Write-Host ""
    Write-Host "Testing agent endpoint..." -ForegroundColor Yellow
    $body = @{
        query = "ยาง Michelin"
        sessionId = "test-deploy"
    } | ConvertTo-Json

    $params = @{
        Uri = "$SUPABASE_URL/functions/v1/jetsetgo-agent"
        Method = "POST"
        ContentType = "application/json"
        Body = $body
    }

    $response = Invoke-RestMethod @params

    Write-Host "Response:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
