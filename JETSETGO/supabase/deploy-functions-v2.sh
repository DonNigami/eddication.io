#!/usr/bin/env bash
# JETSETGO - Edge Functions Deployment Script (Corrected)
# This script handles login and deployment properly

set -e

# Configuration
PROJECT_REF="icgtllieipahixesllux"
SCRIPT_DIR="$(dirname "$0")"
FUNCTIONS_DIR="$SCRIPT_DIR/functions"

echo "===================================="
echo "JETSETGO - Edge Functions Deployment"
echo "===================================="
echo ""
echo "Project: $PROJECT_REF"
echo ""

# Check if logged in
echo "Step 1: Checking authentication..."
if ! supabase whoami &>/dev/null; then
    echo "  Not logged in. Please login first."
    echo ""
    echo "Choose login method:"
    echo "  1. Browser login (recommended)"
    echo "  2. Access Token (headless)"
    echo ""
    read -p "Enter choice (1 or 2): " choice

    if [ "$choice" = "1" ]; then
        echo "  Opening browser for login..."
        supabase login
    elif [ "$choice" = "2" ]; then
        read -p "Enter your Supabase Access Token (get from https://supabase.com/dashboard/account/tokens): " token
        if [ -z "$token" ]; then
            echo "  Token is required. Aborting."
            exit 1
        fi
        supabase login --token "$token"
    else
        echo "  Invalid choice. Aborting."
        exit 1
    fi
else
    echo "  Already logged in."
    supabase whoami
fi
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

# Change to supabase directory
cd "$SCRIPT_DIR"

echo "Step 2: Deploying Edge Functions..."
echo ""

deployed=0
failed=0

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
  echo "  Deploying $func..."

  func_dir="$FUNCTIONS_DIR/$func"
  index_file="$func_dir/index.ts"

  if [ ! -f "$index_file" ]; then
    echo "    Error: $index_file not found"
    ((failed++))
    continue
  fi

  # Deploy using Supabase CLI with project-ref
  if supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt 2>&1; then
    echo "    Success: $func deployed"
    ((deployed++))
  else
    echo "    Failed: $func"
    ((failed++))
  fi

  echo ""
done

echo "===================================="
echo "Deployment Summary"
echo "===================================="
echo "  Deployed: $deployed"
echo "  Failed: $failed"
echo ""

if [ $failed -eq 0 ]; then
    echo "All functions deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Set up environment variables in Supabase Dashboard"
    echo "2. Apply database migrations (ALL_MIGRATIONS.sql)"
    echo "3. Test the functions"
fi
