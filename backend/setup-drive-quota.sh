#!/bin/bash
# Google Drive Quota Fix - Setup Helper Script
# 
# This script helps you verify and fix the Drive upload quota issue
# Usage: bash setup-drive-quota.sh
#
# Windows users: Use WSL, Git Bash, or just run the PowerShell equivalent

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Google Drive Quota Fix - Setup Helper"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  backend/.env not found!"
    echo ""
    echo "Steps:"
    echo "1. Copy backend/.env.example to backend/.env"
    echo "2. Edit backend/.env and set your values"
    echo "3. Run this script again"
    echo ""
    exit 1
fi

# Check GOOGLE_IMPERSONATE_EMAIL
echo "🔍 Checking GOOGLE_IMPERSONATE_EMAIL..."
IMPERSONATE=$(grep "^GOOGLE_IMPERSONATE_EMAIL=" backend/.env | cut -d'=' -f2)

if [ -z "$IMPERSONATE" ] || [ "$IMPERSONATE" = "" ]; then
    echo "   ❌ GOOGLE_IMPERSONATE_EMAIL not set"
    echo ""
    echo "   To fix:"
    echo "   1. Open backend/.env"
    echo "   2. Add: GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com"
    echo "      (Replace driver@yourdomain.com with your Workspace user)"
    echo "   3. Save and run this script again"
    echo ""
else
    # Check if it's a service account
    if [[ "$IMPERSONATE" == *"iam.gserviceaccount.com"* ]]; then
        echo "   ⚠️  GOOGLE_IMPERSONATE_EMAIL appears to be a SERVICE ACCOUNT"
        echo "       Value: $IMPERSONATE"
        echo ""
        echo "   ❌ This won't work! It must be a REAL USER, not a service account"
        echo ""
        echo "   To fix:"
        echo "   1. Open backend/.env"
        echo "   2. Change GOOGLE_IMPERSONATE_EMAIL to a real user:"
        echo "      GOOGLE_IMPERSONATE_EMAIL=driver@yourdomain.com"
        echo "   3. Save and run this script again"
        echo ""
    else
        echo "   ✅ Impersonate user set: $IMPERSONATE"
    fi
fi

# Check ALC_PARENT_FOLDER_ID
echo ""
echo "🔍 Checking ALC_PARENT_FOLDER_ID..."
FOLDER_ID=$(grep "^ALC_PARENT_FOLDER_ID=" backend/.env | cut -d'=' -f2)

if [ -z "$FOLDER_ID" ] || [ "$FOLDER_ID" = "" ] || [ "$FOLDER_ID" = "your_folder_id_here" ]; then
    echo "   ⚠️  ALC_PARENT_FOLDER_ID not set or uses placeholder"
    echo ""
    echo "   This is where files will be uploaded. You need:"
    echo "   1. A Shared Drive folder ID (recommended)"
    echo "      OR a personal Google Drive folder ID"
    echo "   2. To set it in backend/.env:"
    echo "      ALC_PARENT_FOLDER_ID=your_actual_folder_id"
    echo ""
else
    echo "   ✅ Parent folder ID set: $FOLDER_ID"
fi

# Check credentials
echo ""
echo "🔍 Checking Google credentials..."
CREDS=$(grep "^GOOGLE_SHEETS_CREDENTIALS_JSON=" backend/.env | cut -d'=' -f2 | head -c 50)
if [ -z "$CREDS" ] || [ "$CREDS" = "" ]; then
    echo "   ⚠️  GOOGLE_SHEETS_CREDENTIALS_JSON not set in .env"
    echo ""
    echo "   Either:"
    echo "   Option A: Set GOOGLE_SHEETS_KEY_FILE=./google-credentials.json"
    echo "   Option B: Paste full JSON in GOOGLE_SHEETS_CREDENTIALS_JSON"
    echo ""
else
    echo "   ✅ Google credentials configured"
fi

# Suggest next step
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Review your backend/.env configuration"
echo "2. Set these required variables:"
echo "   • GOOGLE_SHEETS_CREDENTIALS_JSON or GOOGLE_SHEETS_KEY_FILE"
echo "   • GOOGLE_IMPERSONATE_EMAIL (must be real user, not service account)"
echo "   • ALC_PARENT_FOLDER_ID (Shared Drive or personal Drive folder)"
echo ""
echo "3. Verify domain-wide delegation is enabled:"
echo "   - Google Cloud Console"
echo "   - APIs & Services → Credentials"
echo "   - Open service account → Credentials tab"
echo "   - Enable \"Domain-wide Delegation\" if not already enabled"
echo ""
echo "4. Authorize the scopes in Workspace Admin:"
echo "   - Security → API Controls → Domain-wide Delegation"
echo "   - Click \"Add new\""
echo "   - Paste service account Client ID"
echo "   - Add OAuth Scopes: drive, drive.file, spreadsheets"
echo "   - Click Authorize"
echo ""
echo "5. Run validation script:"
echo "   node backend/validate-drive-quota.js"
echo ""
echo "6. Restart backend and test:"
echo "   npm run dev"
echo "   (Try uploading an image)"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📖 For detailed instructions, see:"
echo "   - backend/DRIVE_QUOTA_CHECKLIST.md (step-by-step)"
echo "   - backend/DRIVE_QUOTA_FIX.md (complete guide)"
echo "   - backend/VISUAL_GUIDE.md (diagrams)"
echo ""
