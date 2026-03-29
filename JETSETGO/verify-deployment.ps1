# JETSETGO - Deployment Verification Script
# Run this to verify all components are in place

$ErrorActionPreference = "Continue"
$PROJECT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "JETSETGO - Deployment Verification" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0
$warnings = 0

function Test-FileExists {
    param($Path, $Description)

    $fullPath = Join-Path $PROJECT_ROOT $Path
    if (Test-Path $fullPath) {
        Write-Host "  [PASS] $Description" -ForegroundColor Green
        Write-Host "        $Path" -ForegroundColor DarkGray
        return $true
    } else {
        Write-Host "  [FAIL] $Description" -ForegroundColor Red
        Write-Host "        $Path - NOT FOUND" -ForegroundColor DarkGray
        return $false
    }
}

function Test-DirectoryExists {
    param($Path, $Description)

    $fullPath = Join-Path $PROJECT_ROOT $Path
    if (Test-Path $fullPath) {
        $files = Get-ChildItem -Path $fullPath -File -ErrorAction SilentlyContinue
        Write-Host "  [PASS] $Description" -ForegroundColor Green
        Write-Host "        $Path ($($files.Count) files)" -ForegroundColor DarkGray
        return $true
    } else {
        Write-Host "  [FAIL] $Description" -ForegroundColor Red
        Write-Host "        $Path - NOT FOUND" -ForegroundColor DarkGray
        return $false
    }
}

# Test 1: Project Structure
Write-Host "1. Project Structure" -ForegroundColor Yellow
if (Test-FileExists "jetsetgo_plan.md" "Plan Document") { $passed++ } else { $failed++ }
if (Test-FileExists "DEPLOYMENT.md" "Deployment Guide") { $passed++ } else { $failed++ }
if (Test-FileExists "VERIFY_DEPLOYMENT.md" "Verification Guide") { $passed++ } else { $failed++ }
Write-Host ""

# Test 2: Admin Panel
Write-Host "2. Admin Panel" -ForegroundColor Yellow
if (Test-FileExists "admin/index.html" "Admin HTML") { $passed++ } else { $failed++ }
if (Test-FileExists "admin/css/admin.css" "Admin CSS") { $passed++ } else { $failed++ }
if (Test-FileExists "admin/js/app.js" "Admin JS") { $passed++ } else { $failed++ }
Write-Host ""

# Test 3: Edge Functions
Write-Host "3. Edge Functions (supabase/functions/)" -ForegroundColor Yellow
$functions = @(
    "jetsetgo-embed",
    "jetsetgo-ingest",
    "jetsetgo-ocr",
    "jetsetgo-structure",
    "jetsetgo-rag-query",
    "jetsetgo-line-webhook"
)

foreach ($func in $functions) {
    $indexPath = "supabase/functions/$func/index.ts"
    if (Test-FileExists $indexPath $func) {
        $passed++
        # Check file size
        $fullPath = Join-Path $PROJECT_ROOT $indexPath
        $size = (Get-Item $fullPath).Length
        $lines = (Get-Content $fullPath).Count
        Write-Host "        Size: $size bytes, $lines lines" -ForegroundColor DarkGray
    } else {
        $failed++
    }
}
Write-Host ""

# Test 4: Database Migrations
Write-Host "4. Database Migrations (supabase/migrations/)" -ForegroundColor Yellow
$migrations = @(
    "jetsetgo_001_pgvector.sql",
    "jetsetgo_002_catalog_tables.sql",
    "jetsetgo_003_ingestion_tables.sql",
    "jetsetgo_004_linebot_tables.sql",
    "jetsetgo_005_vector_indexes.sql",
    "jetsetgo_006_search_functions.sql",
    "jetsetgo_007_rls_policies.sql",
    "ALL_MIGRATIONS.sql"
)

foreach ($migration in $migrations) {
    if (Test-FileExists "supabase/migrations/$migration" $migration) {
        $passed++
    } else {
        $failed++
    }
}
Write-Host ""

# Test 5: Deployment Helpers
Write-Host "5. Deployment Helpers" -ForegroundColor Yellow
if (Test-FileExists "supabase/deploy.html" "Web Deploy Helper") { $passed++ } else { $failed++ }
if (Test-FileExists "supabase/deploy-functions.ps1" "PowerShell Deploy Script") { $passed++ } else { $failed++ }
if (Test-FileExists "supabase/deploy-functions.sh" "Bash Deploy Script") { $passed++ } else { $failed++ }
if (Test-FileExists "supabase/config.toml" "Supabase Config") { $passed++ } else { $failed++ }
Write-Host ""

# Test 6: Edge Function Code Quality
Write-Host "6. Edge Function Code Quality" -ForegroundColor Yellow
$totalLines = 0
foreach ($func in $functions) {
    $indexPath = "supabase/functions/$func/index.ts"
    $fullPath = Join-Path $PROJECT_ROOT $indexPath
    if (Test-Path $fullPath) {
        $lines = (Get-Content $fullPath).Count
        $totalLines += $lines
    }
}
Write-Host "  Total lines of TypeScript: $totalLines" -ForegroundColor Cyan
if ($totalLines -gt 2000) {
    Write-Host "  [PASS] Code base substantial" -ForegroundColor Green
    $passed++
} else {
    Write-Host "  [WARN] Code base seems small" -ForegroundColor Yellow
    $warnings++
}
Write-Host ""

# Test 7: Check for TODO markers
Write-Host "7. Checking for TODO markers in Edge Functions" -ForegroundColor Yellow
$todoCount = 0
foreach ($func in $functions) {
    $indexPath = "supabase/functions/$func/index.ts"
    $fullPath = Join-Path $PROJECT_ROOT $indexPath
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        $todoCount += ([regex]::Matches($content, "TODO|FIXME|XXX")).Count
    }
}
if ($todoCount -eq 0) {
    Write-Host "  [PASS] No TODO markers found" -ForegroundColor Green
    $passed++
} else {
    Write-Host "  [WARN] Found $todoCount TODO markers" -ForegroundColor Yellow
    $warnings++
}
Write-Host ""

# Summary
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor Red
Write-Host "  Warnings: $warnings" -ForegroundColor Yellow
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ All files verified! Ready for deployment." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Open supabase/deploy.html in browser" -ForegroundColor White
    Write-Host "2. Copy each function code to Supabase Dashboard" -ForegroundColor White
    Write-Host "3. Apply database migrations (ALL_MIGRATIONS.sql)" -ForegroundColor White
    Write-Host "4. Set environment variables (GROQ_API_KEY, etc.)" -ForegroundColor White
    Write-Host "5. Test admin panel (admin/index.html)" -ForegroundColor White
} else {
    Write-Host "❌ Some files are missing. Please check the failed items above." -ForegroundColor Red
    exit 1
}
