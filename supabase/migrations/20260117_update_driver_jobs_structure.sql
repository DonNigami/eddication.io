-- Update driver_jobs table structure to match SAP Shipment format
-- Created: 2026-01-17
-- Purpose: Add comprehensive fields from SAP export

-- ============================================
-- Alter driver_jobs table
-- ============================================

-- Shipment Information
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS shipment_no TEXT; -- Shipment No.
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS sts TEXT; -- Status code
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS sts_text TEXT; -- Status Text
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS vehicle TEXT; -- Vehicle code
-- vehicle_desc already exists
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS trip TEXT; -- Trip number

-- Carrier Information
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS carrier TEXT; -- Carrier code
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS carrier_name TEXT; -- Carrier Name
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS driver TEXT; -- Driver code
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS driver_name TEXT; -- Driver name
-- drivers field (comma-separated) already exists for multiple drivers

-- Route Information
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS route TEXT; -- Route
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS distance NUMERIC(10,2); -- Distance
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS distance_uom TEXT; -- Distance UOM (KM, MI)

-- Scheduling Information
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS scheduling_end TIMESTAMPTZ; -- Scheduling end
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS planned_load_start_date DATE; -- Planned load start (Date)
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS planned_load_start_time TIME; -- Planned load start (Time)
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS actual_load_start_date DATE; -- Actual load start (Date)
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS actual_load_start_time TIME; -- Actual load start (Time)
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS actual_load_end_date DATE; -- Actual load end (Date)
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS actual_load_end_time TIME; -- Actual load end (Time)
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS actual_del_conf_end_date DATE; -- Actual del.conf.end (Date)

-- Transport Plan
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS transport_plan_pt TEXT; -- Transport Plan Pt
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS transport_plan_pt_desc TEXT; -- Transport Plan Pt Desc

-- Shipment Type
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS shipment_type TEXT; -- Shipment Type
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS shipment_type_desc TEXT; -- Shipment Type Desc

-- Costing
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS shp_costing TEXT; -- ShpCosting
ALTER TABLE driver_jobs ADD COLUMN IF NOT EXISTS shp_cost_settl TEXT; -- ShpCostSettl

-- Keep reference as main identifier (already exists as UNIQUE)

-- ============================================
-- Create driver_job_items table for delivery line items
-- ============================================
CREATE TABLE IF NOT EXISTS driver_job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES driver_jobs(id) ON DELETE CASCADE,
  reference TEXT NOT NULL, -- FK to driver_jobs.reference
  
  -- Item Information
  shipment_item TEXT, -- Shipment Item
  delivery TEXT, -- Delivery number
  
  -- Ship To
  ship_to TEXT, -- Ship to code
  ship_to_name TEXT, -- Ship to Name
  ship_to_address TEXT, -- Ship to Address
  street_5 TEXT, -- Street 5
  
  -- Plant & Date
  receiving_plant TEXT, -- Receiving plant
  del_date DATE, -- Del Date
  
  -- Material
  delivery_item TEXT, -- Delivery Item
  material TEXT, -- Material code
  material_desc TEXT, -- Material Desc
  delivery_qty NUMERIC(15,3), -- Delivery Qty
  delivery_uom TEXT, -- Delivery UOM
  
  -- Order & Billing
  order_no TEXT, -- Order
  billing_doc TEXT, -- Billing Doc
  canceled BOOLEAN DEFAULT false, -- Canceled flag
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for driver_job_items
CREATE INDEX IF NOT EXISTS idx_driver_job_items_job_id ON driver_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_driver_job_items_reference ON driver_job_items(reference);
CREATE INDEX IF NOT EXISTS idx_driver_job_items_delivery ON driver_job_items(delivery);
CREATE INDEX IF NOT EXISTS idx_driver_job_items_material ON driver_job_items(material);

-- Enable RLS
ALTER TABLE driver_job_items ENABLE ROW LEVEL SECURITY;

-- Public access policies (for testing)
CREATE POLICY "Allow public read on driver_job_items" ON driver_job_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert on driver_job_items" ON driver_job_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on driver_job_items" ON driver_job_items FOR UPDATE USING (true);

-- Updated_at trigger for driver_job_items
DROP TRIGGER IF EXISTS update_driver_job_items_updated_at ON driver_job_items;
CREATE TRIGGER update_driver_job_items_updated_at
  BEFORE UPDATE ON driver_job_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Create indexes for new columns in driver_jobs
-- ============================================
CREATE INDEX IF NOT EXISTS idx_driver_jobs_shipment_no ON driver_jobs(shipment_no);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_vehicle ON driver_jobs(vehicle);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_carrier ON driver_jobs(carrier);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_driver ON driver_jobs(driver);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_trip ON driver_jobs(trip);
CREATE INDEX IF NOT EXISTS idx_driver_jobs_planned_load_start_date ON driver_jobs(planned_load_start_date);

-- ============================================
-- Add comments for documentation
-- ============================================
COMMENT ON TABLE driver_jobs IS 'Job headers with comprehensive SAP shipment data';
COMMENT ON TABLE driver_job_items IS 'Delivery line items for each shipment';

COMMENT ON COLUMN driver_jobs.reference IS 'Main identifier (e.g., 2601S16472) - UNIQUE';
COMMENT ON COLUMN driver_jobs.shipment_no IS 'SAP Shipment Number';
COMMENT ON COLUMN driver_jobs.vehicle_desc IS 'Vehicle registration/description';
COMMENT ON COLUMN driver_jobs.drivers IS 'Comma-separated driver names (for multiple drivers)';
COMMENT ON COLUMN driver_jobs.driver_name IS 'Primary driver name from SAP';

COMMENT ON COLUMN driver_job_items.reference IS 'Links to driver_jobs.reference';
COMMENT ON COLUMN driver_job_items.ship_to_address IS 'Full delivery address';
COMMENT ON COLUMN driver_job_items.canceled IS 'TRUE if delivery item is canceled';

-- ============================================
-- Sample data update
-- ============================================
-- Update existing test data with new structure
UPDATE driver_jobs 
SET 
  shipment_no = reference,
  vehicle = SUBSTRING(vehicle_desc, 1, 3),
  sts = CASE WHEN status = 'active' THEN 'A' WHEN status = 'completed' THEN 'C' ELSE 'X' END,
  sts_text = status,
  driver_name = SPLIT_PART(drivers, ',', 1)
WHERE reference IN ('2601S16472', 'HXX-123456');
