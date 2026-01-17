#!/bin/bash
# ============================================
# Deploy All Edge Functions to Supabase
# Step-by-step with prompts
# ============================================

echo ""
echo "========================================"
echo "  Deploy Supabase Edge Functions"
echo "========================================"
echo ""

# Step 1: Check Supabase CLI
echo "[Step 1/5] Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo ""
    echo "[ERROR] Supabase CLI not found!"
    echo ""
    echo "Please install Supabase CLI first:"
    echo "  npm install -g supabase"
    echo ""
    exit 1
fi
echo "[OK] Supabase CLI is installed!"
echo ""

# Step 2: Login
echo "[Step 2/5] Checking login status..."
if ! supabase projects list &> /dev/null; then
    echo ""
    echo "You need to login first."
    echo "This will open a browser for authorization."
    echo ""
    read -p "Press Enter to login..."
    supabase login
    if [ $? -ne 0 ]; then
        echo "[ERROR] Login failed!"
        exit 1
    fi
fi
echo "[OK] Logged in!"
echo ""

# Step 3: Link project
echo "[Step 3/5] Linking to project..."
cd "$(dirname "$0")/.."
supabase link --project-ref myplpshpcordggbbtblg
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to link project!"
    echo ""
    echo "Possible reasons:"
    echo "- Wrong project ref"
    echo "- No database password"
    echo "- Network issue"
    echo ""
    exit 1
fi
echo "[OK] Project linked!"
echo ""

# Step 4: Deploy functions
echo "[Step 4/5] Deploying Edge Functions..."
echo ""
cd supabase

echo "[4.1] Deploying search-job..."
supabase functions deploy search-job --no-verify-jwt
if [ $? -eq 0 ]; then
    echo "[OK] search-job deployed!"
else
    echo "[WARNING] search-job deploy failed"
fi
echo ""

echo "[4.2] Deploying update-stop..."
supabase functions deploy update-stop --no-verify-jwt
if [ $? -eq 0 ]; then
    echo "[OK] update-stop deployed!"
else
    echo "[WARNING] update-stop deploy failed"
fi
echo ""

echo "[4.3] Deploying upload-alcohol..."
supabase functions deploy upload-alcohol --no-verify-jwt
if [ $? -eq 0 ]; then
    echo "[OK] upload-alcohol deployed!"
else
    echo "[WARNING] upload-alcohol deploy failed"
fi
echo ""

echo "[4.4] Deploying close-job..."
supabase functions deploy close-job --no-verify-jwt
if [ $? -eq 0 ]; then
    echo "[OK] close-job deployed!"
else
    echo "[WARNING] close-job deploy failed"
fi
echo ""

echo "[4.5] Deploying end-trip..."
supabase functions deploy end-trip --no-verify-jwt
if [ $? -eq 0 ]; then
    echo "[OK] end-trip deployed!"
else
    echo "[WARNING] end-trip deploy failed"
fi
echo ""

# Step 5: List deployed functions
echo "[Step 5/5] Verifying deployment..."
echo ""
supabase functions list
echo ""

echo "========================================"
echo "  Deployment Summary"
echo "========================================"
echo ""
echo "Functions deployed:"
echo "  1. search-job"
echo "  2. update-stop"
echo "  3. upload-alcohol"
echo "  4. close-job"
echo "  5. end-trip"
echo ""
echo "========================================"
echo "  IMPORTANT: Set Environment Variables"
echo "========================================"
echo ""
echo "You must set these secrets manually:"
echo ""
echo "1. Get your Service Role Key from:"
echo "   https://supabase.com/dashboard/project/myplpshpcordggbbtblg/settings/api"
echo ""
echo "2. Run these commands:"
echo ""
echo "   supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co"
echo ""
echo "   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY"
echo ""
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Set environment variables (above)"
echo "2. Test endpoints with curl or Postman"
echo "3. Update frontend to use EdgeFunctionsAPI"
echo ""
