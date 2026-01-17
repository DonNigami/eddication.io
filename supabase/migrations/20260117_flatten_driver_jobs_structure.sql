-- Flatten driver_jobs structure - All columns in one table
-- Created: 2026-01-17
-- Purpose: Match exact SAP export header structure

-- ============================================
-- Add ALL SAP columns to driver_jobs table
-- ============================================

-- Core columns (already exist from previous migration)
-- shipment_no, sts, sts_text, vehicle, vehicle_desc, trip
-- carrier, carrier_name, driver, driver_name
-- route, distance, distance_uom
-- scheduling_end, planned_load_start_date, planned_load_start_time
-- actual_load_start_date, actual_load_start_time
-- actual_load_end_date, actual_load_end_time
-- actual_del_conf_end_date
-- transport_plan_pt, transport_plan_pt_desc
-- shipment_type, shipment_type_desc
-- shp_costing, shp_cost_settl
-- reference

-- ============================================
-- Add Delivery Item columns to driver_jobs
-- ============================================

-- Item Information
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS shipment_item TEXT; -- Shipment Item
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS delivery TEXT; -- Delivery number

-- Ship To
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS ship_to TEXT; -- Ship to code
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS ship_to_name TEXT; -- Ship to Name
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS ship_to_address TEXT; -- Ship to Address
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS street_5 TEXT; -- Street 5

-- Plant & Date
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS receiving_plant TEXT; -- Receiving plant
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS del_date DATE; -- Del Date

-- Material
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS delivery_item TEXT; -- Delivery Item
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS material TEXT; -- Material code
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS material_desc TEXT; -- Material Desc
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS delivery_qty NUMERIC(15,3); -- Delivery Qty
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS delivery_uom TEXT; -- Delivery UOM

-- Order & Billing
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS order_no TEXT; -- Order
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS billing_doc TEXT; -- Billing Doc
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS canceled BOOLEAN DEFAULT false; -- Canceled flag

-- ============================================
-- Add indexes for new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_driver_jobs_delivery ON driver_jobs(delivery);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_material ON driver_jobs(material);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_ship_to ON driver_jobs(ship_to);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_order_no ON driver_jobs(order_no);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_billing_doc ON driver_jobs(billing_doc);

-- ============================================
-- Add comments for new columns
-- ============================================
COMMENT ON COLUMN driver_jobs.shipment_item IS 'Shipment Item number';
COMMENT ON COLUMN driver_jobs.delivery IS 'Delivery document number';
COMMENT ON COLUMN driver_jobs.ship_to IS 'Ship-to party code';
COMMENT ON COLUMN driver_jobs.ship_to_name IS 'Ship-to party name';
COMMENT ON COLUMN driver_jobs.ship_to_address IS 'Complete delivery address';
COMMENT ON COLUMN driver_jobs.street_5 IS 'Additional address line';
COMMENT ON COLUMN driver_jobs.receiving_plant IS 'Receiving plant code';
COMMENT ON COLUMN driver_jobs.del_date IS 'Delivery date';
COMMENT ON COLUMN driver_jobs.delivery_item IS 'Delivery item number';
COMMENT ON COLUMN driver_jobs.material IS 'Material code/SKU';
COMMENT ON COLUMN driver_jobs.material_desc IS 'Material description';
COMMENT ON COLUMN driver_jobs.delivery_qty IS 'Delivery quantity';
COMMENT ON COLUMN driver_jobs.delivery_uom IS 'Unit of measure';
COMMENT ON COLUMN driver_jobs.order_no IS 'Sales order number';
COMMENT ON COLUMN driver_jobs.billing_doc IS 'Billing document number';
COMMENT ON COLUMN driver_jobs.canceled IS 'Item cancellation flag';

-- ============================================
-- Complete Column List (for reference)
-- ============================================
-- This table now contains all SAP export columns:
-- 
-- 1.  id (uuid, PK) - Internal ID
-- 2.  shipment_no - Shipment No.
-- 3.  sts - Sts (Status code)
-- 4.  sts_text - Sts Text
-- 5.  vehicle - Vehicle (code)
-- 6.  vehicle_desc - Vehicle Description
-- 7.  trip - Trip
-- 8.  carrier - Carrier (code)
-- 9.  carrier_name - Carrier Name
-- 10. driver - Driver (code)
-- 11. driver_name - Driver name
-- 12. route - Route
-- 13. distance - Distance
-- 14. distance_uom - Distance UOM
-- 15. scheduling_end - Scheduling end
-- 16. planned_load_start_date - Planned load start (Date)
-- 17. planned_load_start_time - Planned load start (Time)
-- 18. actual_load_start_date - Actual load start (Date)
-- 19. actual_load_start_time - Actual load start (Time)
-- 20. actual_load_end_date - Actual load end (Date)
-- 21. actual_load_end_time - Actual load end (Time)
-- 22. actual_del_conf_end_date - Actual del.conf.end (Date)
-- 23. transport_plan_pt - Transport Plan Pt
-- 24. transport_plan_pt_desc - Transport Plan Pt Desc
-- 25. shipment_type - Shipment Type
-- 26. shipment_type_desc - Shipment Type Desc
-- 27. shp_costing - ShpCosting
-- 28. shp_cost_settl - ShpCostSettl
-- 29. reference - Reference (UNIQUE identifier)
-- 30. shipment_item - Shipment Item
-- 31. delivery - Delivery
-- 32. ship_to - Ship to
-- 33. ship_to_name - Ship to Name
-- 34. ship_to_address - Ship to Address
-- 35. street_5 - Street 5
-- 36. receiving_plant - Receiving plant
-- 37. del_date - Del Date
-- 38. delivery_item - Delivery Item
-- 39. material - Material
-- 40. material_desc - Material Desc
-- 41. delivery_qty - Delivery Qty
-- 42. delivery_uom - Delivery UOM
-- 43. order_no - Order
-- 44. billing_doc - Billing Doc
-- 45. canceled - Canceled
-- 
-- Plus existing columns:
-- - drivers (comma-separated list)
-- - status, start_odo, end_odo, fees
-- - created_at, updated_at
