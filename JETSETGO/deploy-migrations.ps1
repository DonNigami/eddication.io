# JETSETGO - Deploy migrations using Supabase CLI (PowerShell)
# FREE/OPEN SOURCE Edition

$ErrorActionPreference = "Stop"

Write-Host "🚀 JETSETGO - Migration Deployment" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if supabase CLI is installed
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Supabase CLI not found!" -ForegroundColor Red
    Write-Host "Install it from: https://supabase.com/docs/guides/cli"
    Write-Host "Or run: npm install -g supabase"
    exit 1
}

Write-Host "✅ Supabase CLI found" -ForegroundColor Green
Write-Host ""

# Project reference
$PROJECT_REF = "icgtllieipahixesllux"
$MIGRATIONS_DIR = "supabase/migrations"

Write-Host "📦 Deploying migrations to project: $PROJECT_REF" -ForegroundColor Yellow
Write-Host ""

# Check if migrations directory exists
if (-not (Test-Path $MIGRATIONS_DIR)) {
    Write-Host "❌ Migrations directory not found: $MIGRATIONS_DIR" -ForegroundColor Red
    exit 1
}

# Apply migrations in order
$migrations = @(
    "001_pgvector",
    "002_catalog_tables",
    "003_ingestion_tables",
    "004_linebot_tables",
    "005_vector_indexes",
    "006_search_functions",
    "007_rls_policies"
)

foreach ($migration in $migrations) {
    $migrationFile = Join-Path $MIGRATIONS_DIR "jetsetgo_${migration}.sql"

    if (Test-Path $migrationFile) {
        Write-Host "▶️  Applying: jetsetgo_${migration}.sql" -ForegroundColor Yellow

        # Use psql directly if you have connection string
        # Or use supabase db execute command
        $sqlContent = Get-Content $migrationFile -Raw

        # Option 1: Using supabase db execute (requires login)
        # supabase db execute --project-ref $PROJECT_REF --file $migrationFile

        # Option 2: Output SQL to console for copy-paste to Supabase Dashboard
        Write-Host "   SQL file ready. Copy the content below to Supabase SQL Editor:" -ForegroundColor Gray
        Write-Host "   ---" -ForegroundColor Gray
        Write-Host $sqlContent
        Write-Host "   ---" -ForegroundColor Gray
        Write-Host ""

        Write-Host "✅ Prepared: jetsetgo_${migration}.sql" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠️  File not found: $migrationFile" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🎉 All migrations prepared!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Open Supabase Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF/sql"
Write-Host "   2. Copy and run each migration SQL above"
Write-Host ""
Write-Host "   3. Create storage bucket (run in SQL Editor):" -ForegroundColor Cyan
Write-Host @"
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('jetsetgo-catalogs', 'jetsetgo-catalogs', true)
ON CONFLICT (id) DO NOTHING;

-- Grant public access
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'jetsetgo-catalogs');

CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'jetsetgo-catalogs');
"@ -ForegroundColor Gray
