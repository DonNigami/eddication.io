# JETSETGO - Edge Functions Deployment Script (Corrected)
# This script handles login and deployment properly

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_REF = "icgtllieipahixesllux"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FUNCTIONS_DIR = Join-Path $SCRIPT_DIR "functions"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "JETSETGO - Edge Functions Deployment" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $PROJECT_REF" -ForegroundColor Yellow
Write-Host ""

# Check if logged in
Write-Host "Step 1: Checking authentication..." -ForegroundColor Cyan
$loginStatus = supabase whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Not logged in. Please login first." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Choose login method:" -ForegroundColor White
    Write-Host "  1. Browser login (recommended)" -ForegroundColor Green
    Write-Host "  2. Access Token (headless)" -ForegroundColor Green
    Write-Host ""

    $choice = Read-Host "Enter choice (1 or 2)"

    if ($choice -eq "1") {
        Write-Host "  Opening browser for login..." -ForegroundColor Cyan
        supabase login
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Login failed. Please try again." -ForegroundColor Red
            exit 1
        }
    } elseif ($choice -eq "2") {
        $token = Read-Host "Enter your Supabase Access Token (get from https://supabase.com/dashboard/account/tokens)"
        if ([string]::IsNullOrWhiteSpace($token)) {
            Write-Host "  Token is required. Aborting." -ForegroundColor Red
            exit 1
        }
        supabase login --token $token
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Login failed. Please check your token." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  Invalid choice. Aborting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  Already logged in as:" -ForegroundColor Green
    Write-Host "  $loginStatus" -ForegroundColor DarkGray
}
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

# Change to supabase directory
Push-Location $SCRIPT_DIR

try {
    Write-Host "Step 2: Deploying Edge Functions..." -ForegroundColor Cyan
    Write-Host ""

    $deployed = 0
    $failed = 0

    # Deploy each function
    foreach ($func in $FUNCTIONS) {
        Write-Host "  Deploying $func..." -ForegroundColor Cyan

        $funcDir = Join-Path $FUNCTIONS_DIR $func
        $indexFile = Join-Path $funcDir "index.ts"

        if (-not (Test-Path $indexFile)) {
            Write-Host "    Error: $indexFile not found" -ForegroundColor Red
            $failed++
            continue
        }

        # Deploy using Supabase CLI with project-ref
        $output = supabase functions deploy $func --project-ref $PROJECT_REF --no-verify-jwt 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "    Success: $func deployed" -ForegroundColor Green
            $deployed++
        } else {
            Write-Host "    Failed: $func" -ForegroundColor Red
            Write-Host "    $output" -ForegroundColor DarkRed
            $failed++
        }

        Write-Host ""
    }

    Write-Host "====================================" -ForegroundColor Cyan
    Write-Host "Deployment Summary" -ForegroundColor Cyan
    Write-Host "====================================" -ForegroundColor Cyan
    Write-Host "  Deployed: $deployed" -ForegroundColor Green
    Write-Host "  Failed: $failed" -ForegroundColor Red
    Write-Host ""

    if ($failed -eq 0) {
        Write-Host "All functions deployed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Set up environment variables in Supabase Dashboard" -ForegroundColor White
        Write-Host "2. Apply database migrations (ALL_MIGRATIONS.sql)" -ForegroundColor White
        Write-Host "3. Test the functions" -ForegroundColor White
    }

}
finally {
    Pop-Location
}
