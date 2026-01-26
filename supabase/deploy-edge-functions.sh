#!/bin/bash
# =====================================================
# DEPLOY SUPABASE EDGE FUNCTIONS
# =====================================================
# This script deploys all Edge Functions for the Driver Connect app
# Usage: ./deploy-edge-functions.sh [PROJECT_REF]
#
# PROJECT_REF: Your Supabase project reference (e.g., myplpshpcordggbbtblg)
# Can be found in Supabase Dashboard > Settings > API
# =====================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get project ref from argument or environment
PROJECT_REF="${1:-$SUPABASE_PROJECT_REF}"

if [ -z "$PROJECT_REF" ]; then
  echo -e "${RED}Error: PROJECT_REF not provided${NC}"
  echo "Usage: ./deploy-edge-functions.sh <PROJECT_REF>"
  echo "Or set SUPABASE_PROJECT_REF environment variable"
  exit 1
fi

echo -e "${YELLOW}Deploying Edge Functions to project: ${PROJECT_REF}${NC}"
echo ""

# Array of functions to deploy
FUNCTIONS=(
  "enrich-coordinates"
  "geocode"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
  echo -e "${GREEN}Deploying ${func}...${NC}"
  npx supabase functions deploy "$func" --project-ref "$PROJECT_REF"
  echo ""
done

echo -e "${GREEN}All Edge Functions deployed successfully!${NC}"
echo ""
echo "To verify deployment, check:"
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
