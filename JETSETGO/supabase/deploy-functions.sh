#!/usr/bin/env bash
# JETSETGO - Edge Functions Deployment Script
# Uses Supabase Management API to deploy functions

set -e

# Configuration
PROJECT_REF="icgtllieipahixesllux"
SUPABASE_URL="https://api.supabase.com/v1"
FUNCTIONS_DIR="$(dirname "$0")/functions"

# Check for access token
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN environment variable is required"
  echo ""
  echo "Get your access token from: https://supabase.com/dashboard/account/tokens"
  echo ""
  echo "Then run:"
  echo "  export SUPABASE_ACCESS_TOKEN=your_token_here"
  exit 1
fi

echo "🚀 Deploying JETSETGO Edge Functions..."
echo "Project: $PROJECT_REF"
echo ""

# List of functions to deploy
FUNCTIONS=(
  "jetsetgo-embed"
  "jetsetgo-ingest"
  "jetsetgo-ocr"
  "jetsetgo-structure"
  "jetsetgo-rag-query"
  "jetsetgo-line-webhook"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
  echo "📦 Deploying $func..."

  func_dir="$FUNCTIONS_DIR/$func"
  index_file="$func_dir/index.ts"

  if [ ! -f "$index_file" ]; then
    echo "  ❌ Error: $index_file not found"
    continue
  fi

  # Using Supabase CLI
  if command -v supabase &> /dev/null; then
    supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt
  else
    echo "  ❌ Error: supabase CLI not found"
    echo "  Install it from: https://supabase.com/docs/guides/cli"
    exit 1
  fi

  echo "  ✅ $func deployed"
  echo ""
done

echo "✨ All functions deployed!"
echo ""
echo "Next steps:"
echo "1. Set up environment variables in Supabase Dashboard"
echo "2. Test the functions"
