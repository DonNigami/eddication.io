@echo off
echo ============================================
echo  Apply Flattened Driver Jobs Schema
echo ============================================
echo.
echo This will add ALL SAP columns to driver_jobs table:
echo - All 45+ columns in ONE table (no separate items table)
echo - Matches exact SAP export structure
echo.
echo Migration file: 20260117_flatten_driver_jobs_structure.sql
echo.
pause

echo.
echo [Step 1] Opening Supabase SQL Editor...
start https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new

echo.
echo [Step 2] Opening migration file...
start notepad "supabase\migrations\20260117_flatten_driver_jobs_structure.sql"

echo.
echo ============================================
echo  Instructions:
echo ============================================
echo.
echo 1. Copy ALL content from migration file (Notepad)
echo 2. Paste into Supabase SQL Editor
echo 3. Click "Run" (or Ctrl+Enter)
echo 4. Wait for success message
echo.
echo This adds delivery item columns to driver_jobs:
echo - shipment_item, delivery
echo - ship_to, ship_to_name, ship_to_address
echo - receiving_plant, del_date
echo - material, material_desc
echo - delivery_qty, delivery_uom
echo - order_no, billing_doc, canceled
echo.
echo ALL columns now in driver_jobs table (flat structure)
echo.
pause

echo.
echo ============================================
echo  After applying migration:
echo ============================================
echo.
echo 1. Go to import-from-sheets.html
echo 2. Import data from Google Sheets
echo 3. All columns will be imported to driver_jobs
echo.
pause
