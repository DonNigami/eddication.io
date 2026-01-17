@echo off
echo ============================================
echo  Apply New Driver Jobs Schema Migration
echo ============================================
echo.
echo This will apply the new SAP-compatible schema:
echo - Add 30+ new columns to driver_jobs table
echo - Create driver_job_items table for delivery items
echo - Add indexes and RLS policies
echo.
echo Migration file: 20260117_update_driver_jobs_structure.sql
echo.
pause

echo.
echo Opening Supabase SQL Editor...
start https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new

echo.
echo Opening migration file...
start notepad "supabase\migrations\20260117_update_driver_jobs_structure.sql"

echo.
echo ============================================
echo  Instructions:
echo ============================================
echo.
echo 1. Copy ALL content from the migration file (Notepad)
echo 2. Paste into Supabase SQL Editor
echo 3. Click "Run" (or press Ctrl+Enter)
echo 4. Wait for success message
echo.
echo New fields added:
echo - shipment_no, sts, sts_text
echo - vehicle, carrier, carrier_name
echo - driver, driver_name
echo - route, distance, distance_uom
echo - All scheduling dates/times
echo - Transport plan, shipment type
echo - Costing and settlement fields
echo - And more...
echo.
echo Plus: driver_job_items table for delivery line items
echo.
pause
