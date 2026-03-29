#!/bin/bash
# JETSETGO - Deploy migrations using Supabase CLI
# FREE/OPEN SOURCE Edition

set -e

echo "🚀 JETSETGO - Migration Deployment"
echo "=================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Install it from: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if logged in
echo "📋 Checking login status..."
supabase projects list > /dev/null 2>&1 || {
    echo "❌ Not logged in to Supabase"
    echo "Run: supabase login"
    exit 1
}

echo "✅ Logged in to Supabase"
echo ""

# Project reference
PROJECT_REF="icgtllieipahixesllux"

echo "📦 Deploying migrations to project: $PROJECT_REF"
echo ""

# Apply migrations in order
MIGRATIONS=(
    "001_pgvector"
    "002_catalog_tables"
    "003_ingestion_tables"
    "004_linebot_tables"
    "005_vector_indexes"
    "006_search_functions"
    "007_rls_policies"
)

for migration in "${MIGRATIONS[@]}"; do
    echo "▶️  Applying: jetsetgo_${migration}.sql"
    supabase db execute --project-ref "$PROJECT_REF" \
        --file "supabase/migrations/jetsetgo_${migration}.sql" \
        --dry-run false
    echo "✅ Done: jetsetgo_${migration}.sql"
    echo ""
done

echo ""
echo "🎉 All migrations applied successfully!"
echo ""
echo "📊 Next steps:"
echo "   1. Create storage bucket:"
echo "      supabase storage create-buckets --project-ref $PROJECT_REF"
echo ""
echo "   2. Enable storage permissions (run in SQL Editor):"
cat << 'EOF'
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
EOF
