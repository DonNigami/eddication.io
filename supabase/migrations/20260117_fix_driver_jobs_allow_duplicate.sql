-- =====================================================
-- FIX: Allow duplicate references in driver_jobs
-- =====================================================
-- ตาราง driver_jobs ต้องรองรับหลายแถวต่อ 1 reference
-- เพราะ 1 reference มีหลาย delivery items (materials)
-- =====================================================

-- 1. Drop UNIQUE constraint on reference (if exists)
ALTER TABLE public.driver_jobs 
DROP CONSTRAINT IF EXISTS driver_jobs_reference_key;

-- 2. Add shipment_item column (if not exists)
ALTER TABLE public.driver_jobs 
ADD COLUMN IF NOT EXISTS shipment_item TEXT;

-- 3. Add dest_lat, dest_lng (if not exists)
ALTER TABLE public.driver_jobs 
ADD COLUMN IF NOT EXISTS dest_lat DECIMAL(10,7);

ALTER TABLE public.driver_jobs 
ADD COLUMN IF NOT EXISTS dest_lng DECIMAL(10,7);

-- 4. Add delivery_uom (if not exists)
ALTER TABLE public.driver_jobs 
ADD COLUMN IF NOT EXISTS delivery_uom TEXT;

-- 5. Create new UNIQUE constraint on (reference, shipment_item)
ALTER TABLE public.driver_jobs 
DROP CONSTRAINT IF EXISTS driver_jobs_reference_item_key;

ALTER TABLE public.driver_jobs 
ADD CONSTRAINT driver_jobs_reference_item_key 
UNIQUE (reference, shipment_item);

-- 6. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_driver_jobs_ship_to ON public.driver_jobs(ship_to);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_material ON public.driver_jobs(material_desc);

-- 7. Update existing rows to have shipment_item (if null)
-- Assign sequential numbers grouped by reference
WITH numbered_rows AS (
  SELECT 
    id,
    reference,
    ROW_NUMBER() OVER (PARTITION BY reference ORDER BY created_at) AS rn
  FROM driver_jobs
  WHERE shipment_item IS NULL
)
UPDATE driver_jobs
SET shipment_item = numbered_rows.rn::TEXT
FROM numbered_rows
WHERE driver_jobs.id = numbered_rows.id;

-- =====================================================
-- Verify changes
-- =====================================================
-- Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'driver_jobs'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check constraints
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.driver_jobs'::regclass;

-- Test: Should allow duplicate references with different shipment_item
/*
INSERT INTO driver_jobs (reference, shipment_item, ship_to, material_desc, delivery_qty)
VALUES 
  ('TEST001', '1', '11000973', 'GASOHOL 95', 3.00),
  ('TEST001', '2', '11000973', 'DIESEL', 8.00);  -- Same reference, different item
*/
