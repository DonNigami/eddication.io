#!/bin/bash
# ============================================
# Deploy Supabase Edge Functions
# ============================================

echo "========================================"
echo "  Supabase Edge Functions Deployment"
echo "========================================"
echo ""

# Check if in correct directory
if [ ! -d "supabase/functions" ]; then
    echo "[ERROR] ไม่พบ supabase/functions directory"
    echo "กรุณารันจาก root directory ของโปรเจค"
    exit 1
fi

echo "[1/6] Checking Supabase CLI..."
if ! command -v supabase &> /dev/null; then
    echo ""
    echo "[ERROR] ไม่พบ Supabase CLI"
    echo "กรุณาติดตั้งด้วยคำสั่ง: npm install -g supabase"
    exit 1
fi
supabase --version

echo ""
echo "[2/6] Logging in to Supabase..."
supabase login
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Login ไม่สำเร็จ"
    exit 1
fi

echo ""
echo "[3/6] Linking to project..."
supabase link --project-ref myplpshpcordggbbtblg
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Link project ไม่สำเร็จ"
    exit 1
fi

echo ""
echo "[4/6] Deploying functions..."
echo ""

cd supabase/functions

echo "[4.1] Deploying search-job..."
supabase functions deploy search-job --no-verify-jwt || echo "[WARNING] search-job deploy มีปัญหา"

echo "[4.2] Deploying update-stop..."
supabase functions deploy update-stop --no-verify-jwt || echo "[WARNING] update-stop deploy มีปัญหา"

echo "[4.3] Deploying upload-alcohol..."
supabase functions deploy upload-alcohol --no-verify-jwt || echo "[WARNING] upload-alcohol deploy มีปัญหา"

echo "[4.4] Deploying close-job..."
supabase functions deploy close-job --no-verify-jwt || echo "[WARNING] close-job deploy มีปัญหา"

echo "[4.5] Deploying end-trip..."
supabase functions deploy end-trip --no-verify-jwt || echo "[WARNING] end-trip deploy มีปัญหา"

cd ../..

echo ""
echo "[5/6] Listing deployed functions..."
supabase functions list

echo ""
echo "[6/6] Setting environment variables..."
echo "กรุณารันคำสั่งเหล่านี้ด้วยตัวเอง:"
echo ""
echo "supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co"
echo "supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY"
echo ""

echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. ตั้งค่า environment variables (ด้านบน)"
echo "2. ทดสอบ endpoints"
echo "3. Update frontend code"
echo ""
