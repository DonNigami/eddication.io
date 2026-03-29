#!/bin/bash
# JETSETGO - Automated Deployment Script
# Generated: 2026-02-11T04:05:54.541Z

set -e  # Exit on error

SUPABASE_URL="https://icgtllieipahixesllux.supabase.co"
PROJECT_REF="icgtllieipahixesllux"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           JETSETGO - Automated Deployment                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Project: $SUPABASE_URL"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "   Install: npm install -g supabase"
    exit 1
fi

# Check if logged in
echo "🔍 Checking Supabase login status..."
if ! supabase projects list &> /dev/null; then
    echo "   Please login to Supabase:"
    supabase login
fi

echo "   ✅ Logged in"
echo ""

# Link project
echo "🔗 Linking to project..."
supabase link --project-ref $PROJECT_REF
echo "   ✅ Linked"
echo ""

# Deploy functions
echo "🚀 Deploying Edge Functions..."
echo ""


echo "   Deploying: jetsetgo-embed"
supabase functions deploy jetsetgo-embed
echo "   ✅ jetsetgo-embed deployed"
echo ""
echo "   Deploying: jetsetgo-ingest"
supabase functions deploy jetsetgo-ingest
echo "   ✅ jetsetgo-ingest deployed"
echo ""
echo "   Deploying: jetsetgo-ocr"
supabase functions deploy jetsetgo-ocr
echo "   ✅ jetsetgo-ocr deployed"
echo ""
echo "   Deploying: jetsetgo-structure"
supabase functions deploy jetsetgo-structure
echo "   ✅ jetsetgo-structure deployed"
echo ""
echo "   Deploying: jetsetgo-rag-query"
supabase functions deploy jetsetgo-rag-query
echo "   ✅ jetsetgo-rag-query deployed"
echo ""
echo "   Deploying: jetsetgo-line-webhook"
supabase functions deploy jetsetgo-line-webhook
echo "   ✅ jetsetgo-line-webhook deployed"
echo ""
echo "   Deploying: jetsetgo-agent"
supabase functions deploy jetsetgo-agent
echo "   ✅ jetsetgo-agent deployed"
echo ""

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Deployment Complete!                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo "  1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "  2. Run migrations from: deploy-combined-migrations.sql"
echo "  3. Configure environment variables in Dashboard → Edge Functions"
echo "  4. Set LINE webhook to: $SUPABASE_URL/functions/v1/jetsetgo-line-webhook"
echo ""
