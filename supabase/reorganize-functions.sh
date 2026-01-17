#!/bin/bash
# ============================================
# Reorganize Supabase Edge Functions Structure
# ============================================

echo "========================================"
echo "  Reorganizing Edge Functions"
echo "========================================"
echo ""

cd "$(dirname "$0")/functions"

# Create directory structure
echo "[1/3] Creating directories..."
mkdir -p "_shared" "search-job" "update-stop" "upload-alcohol" "close-job" "end-trip"
echo "Done!"

echo ""
echo "[2/3] Moving files to correct locations..."

# Move shared files
if [ -f "types.ts" ]; then
    mv "types.ts" "_shared/types.ts"
    echo "Moved: types.ts -> _shared/types.ts"
fi
if [ -f "utils.ts" ]; then
    mv "utils.ts" "_shared/utils.ts"
    echo "Moved: utils.ts -> _shared/utils.ts"
fi

# Move function files
if [ -f "search-job.ts" ]; then
    mv "search-job.ts" "search-job/index.ts"
    echo "Moved: search-job.ts -> search-job/index.ts"
fi
if [ -f "update-stop.ts" ]; then
    mv "update-stop.ts" "update-stop/index.ts"
    echo "Moved: update-stop.ts -> update-stop/index.ts"
fi
if [ -f "upload-alcohol.ts" ]; then
    mv "upload-alcohol.ts" "upload-alcohol/index.ts"
    echo "Moved: upload-alcohol.ts -> upload-alcohol/index.ts"
fi
if [ -f "close-job.ts" ]; then
    mv "close-job.ts" "close-job/index.ts"
    echo "Moved: close-job.ts -> close-job/index.ts"
fi
if [ -f "end-trip.ts" ]; then
    mv "end-trip.ts" "end-trip/index.ts"
    echo "Moved: end-trip.ts -> end-trip/index.ts"
fi

echo ""
echo "[3/3] Fixing import paths..."

# Fix imports in all index.ts files
for func in search-job update-stop upload-alcohol close-job end-trip; do
    if [ -f "$func/index.ts" ]; then
        sed -i.bak "s|'\\./types\\.ts'|'../_shared/types.ts'|g" "$func/index.ts"
        sed -i.bak "s|'\\./utils\\.ts'|'../_shared/utils.ts'|g" "$func/index.ts"
        rm "$func/index.ts.bak" 2>/dev/null
        echo "Fixed imports in $func/index.ts"
    fi
done

echo "Done!"

echo ""
echo "========================================"
echo "  Reorganization Complete!"
echo "========================================"
echo ""
echo "New structure:"
echo "  functions/"
echo "    _shared/"
echo "      types.ts"
echo "      utils.ts"
echo "    search-job/"
echo "      index.ts"
echo "    update-stop/"
echo "      index.ts"
echo "    upload-alcohol/"
echo "      index.ts"
echo "    close-job/"
echo "      index.ts"
echo "    end-trip/"
echo "      index.ts"
echo ""
echo "Ready to deploy with: supabase functions deploy"
echo ""
