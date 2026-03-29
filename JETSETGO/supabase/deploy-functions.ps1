# JETSETGO - Edge Functions Deployment Script (PowerShell)
# Uses Supabase CLI to deploy functions

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_REF = "icgtllieipahixesllux"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FUNCTIONS_DIR = Join-Path $SCRIPT_DIR "functions"

Write-Host "🚀 Deploying JETSETGO Edge Functions..." -ForegroundColor Cyan
Write-Host "Project: $PROJECT_REF" -ForegroundColor Yellow
Write-Host ""

# List of functions to deploy
$FUNCTIONS = @(
    "jetsetgo-embed",
    "jetsetgo-ingest",
    "jetsetgo-ocr",
    "jetsetgo-structure",
    "jetsetgo-rag-query",
    "jetsetgo-line-webhook"
)

# Check if supabase CLI is installed
$SUPABASE_CMD = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $SUPABASE_CMD) {
    Write-Host "❌ Error: supabase CLI not found" -ForegroundColor Red
    Write-Host "Install it from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

# Change to supabase directory
Push-Location $SCRIPT_DIR

try {
    # Deploy each function
    foreach ($func in $FUNCTIONS) {
        Write-Host "📦 Deploying $func..." -ForegroundColor Cyan

        $funcDir = Join-Path $FUNCTIONS_DIR $func
        $indexFile = Join-Path $funcDir "index.ts"

        if (-not (Test-Path $indexFile)) {
            Write-Host "  ❌ Error: $indexFile not found" -ForegroundColor Red
            continue
        }

        # Deploy using Supabase CLI
        $output = supabase functions deploy $func --project-ref $PROJECT_REF --no-verify-jwt 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ $func deployed" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Failed to deploy $func" -ForegroundColor Red
            Write-Host $output -ForegroundColor DarkRed
        }

        Write-Host ""
    }

    Write-Host "✨ Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Set up environment variables in Supabase Dashboard"
    Write-Host "2. Test the functions"
}
finally {
    Pop-Location
}
