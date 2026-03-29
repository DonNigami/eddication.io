-- ============================================
-- Restructure InventData Table
-- New columns: ItemName, Standard, ItemName2, ItemName3, OnhandQtyByTotalPiece
-- ============================================

-- Step 1: Add new columns
ALTER TABLE inventdata
  ADD COLUMN IF NOT EXISTS "ItemName" TEXT,
  ADD COLUMN IF NOT EXISTS "Standard" TEXT,
  ADD COLUMN IF NOT EXISTS "ItemName2" TEXT,
  ADD COLUMN IF NOT EXISTS "ItemName3" TEXT,
  ADD COLUMN IF NOT EXISTS "OnhandQtyByTotalPiece" INTEGER DEFAULT 0;

-- Step 2: Migrate data from old columns to new columns
UPDATE inventdata
SET
  "ItemName" = item_name,
  "OnhandQtyByTotalPiece" = stock_quantity
WHERE "ItemName" IS NULL;

-- Step 3: Drop old columns (after data migration)
-- Uncomment these lines after verifying data migration is successful
-- ALTER TABLE inventdata DROP COLUMN IF EXISTS item_name;
-- ALTER TABLE inventdata DROP COLUMN IF EXISTS stock_quantity;

-- Step 4: Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_inventdata_ItemName ON inventdata("ItemName");
CREATE INDEX IF NOT EXISTS idx_inventdata_ItemName_gin ON inventdata USING gin("ItemName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventdata_ItemName2 ON inventdata("ItemName2");
CREATE INDEX IF NOT EXISTS idx_inventdata_ItemName3 ON inventdata("ItemName3");
CREATE INDEX IF NOT EXISTS idx_inventdata_Standard ON inventdata("Standard");

-- Step 5: Add comments for documentation
COMMENT ON COLUMN inventdata."ItemName" IS 'Primary item name/SKU (ชื่อสินค้าหลัก/รหัสสินค้า)';
COMMENT ON COLUMN inventdata."ItemName2" IS 'Car Brand (ยี่ห้อรถ - เช่น TOYOTA, HONDA)';
COMMENT ON COLUMN inventdata."ItemName3" IS 'Car Model (รุ่นรถ - เช่น CAMRY, CIVIC)';
COMMENT ON COLUMN inventdata."Standard" IS 'Car Standard/Spec (มาตรฐานรถ - เช่น 2.0V, 1.8EL)';
COMMENT ON COLUMN inventdata."OnhandQtyByTotalPiece" IS 'Total on-hand quantity by pieces (จำนวนสินค้าคงคลังรวม)';
