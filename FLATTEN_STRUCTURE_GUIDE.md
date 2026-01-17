# 📊 Database Schema Update - Flatten Structure

## เปลี่ยนแปลง

### ❌ โครงสร้างเดิม (Two Tables)
```
driver_jobs (header data)
  ├── shipment_no, vehicle, driver, route...
  
driver_job_items (separate table)
  ├── delivery, material, ship_to...
  └── One-to-Many relationship
```

### ✅ โครงสร้างใหม่ (Single Table - Flat)
```
driver_jobs (all data in one table)
  ├── shipment_no, vehicle, driver, route...
  ├── delivery, material, ship_to...
  └── ALL 45+ columns in one table
```

## เหตุผล

1. **ตรงกับ SAP Export** - ทุก row ใน Google Sheets = 1 row ใน database
2. **Import ง่ายขึ้น** - ไม่ต้อง group rows หรือจัดการ relationship
3. **Query ง่ายขึ้น** - ไม่ต้อง JOIN tables
4. **Performance** - Faster queries (no joins needed)

## 📋 Complete Column List (45+ columns)

### Core Shipment Info
1. `id` (uuid, PK)
2. `shipment_no` - Shipment No.
3. `reference` - Reference (UNIQUE)
4. `sts` - Status code
5. `sts_text` - Status Text

### Vehicle & Trip
6. `vehicle` - Vehicle code
7. `vehicle_desc` - Vehicle Description
8. `trip` - Trip number

### Carrier & Driver
9. `carrier` - Carrier code
10. `carrier_name` - Carrier Name
11. `driver` - Driver code
12. `driver_name` - Driver name
13. `drivers` - Multiple drivers (comma-separated)

### Route
14. `route` - Route
15. `distance` - Distance
16. `distance_uom` - Distance UOM (KM/MI)

### Scheduling (Date + Time)
17. `scheduling_end` - Scheduling end
18. `planned_load_start_date` - Planned load start (Date)
19. `planned_load_start_time` - Planned load start (Time)
20. `actual_load_start_date` - Actual load start (Date)
21. `actual_load_start_time` - Actual load start (Time)
22. `actual_load_end_date` - Actual load end (Date)
23. `actual_load_end_time` - Actual load end (Time)
24. `actual_del_conf_end_date` - Actual delivery confirmation end

### Transport Plan
25. `transport_plan_pt` - Transport Plan Point
26. `transport_plan_pt_desc` - Transport Plan Point Description

### Shipment Type
27. `shipment_type` - Shipment Type
28. `shipment_type_desc` - Shipment Type Description

### Costing
29. `shp_costing` - Shipment Costing
30. `shp_cost_settl` - Shipment Cost Settlement

### Delivery Item Info (NEW - now in driver_jobs)
31. `shipment_item` - Shipment Item
32. `delivery` - Delivery document number
33. `ship_to` - Ship-to party code
34. `ship_to_name` - Ship-to party name
35. `ship_to_address` - Complete delivery address
36. `street_5` - Additional address line
37. `receiving_plant` - Receiving plant code
38. `del_date` - Delivery date

### Material Info (NEW - now in driver_jobs)
39. `delivery_item` - Delivery Item number
40. `material` - Material code/SKU
41. `material_desc` - Material description
42. `delivery_qty` - Delivery quantity (NUMERIC)
43. `delivery_uom` - Unit of measure

### Order & Billing (NEW - now in driver_jobs)
44. `order_no` - Sales order number
45. `billing_doc` - Billing document number
46. `canceled` - Cancellation flag (BOOLEAN)

### Legacy/Driver App Fields
47. `status` - Job status (pending/active/completed)
48. `start_odo` - Start odometer
49. `end_odo` - End odometer
50. `fees` - Delivery fees
51. `created_at` - Created timestamp
52. `updated_at` - Updated timestamp

## 🚀 Migration Steps

### 1. Apply Database Migration
```bash
# Run batch file
apply-flatten-schema.bat

# Or manually:
# 1. Open Supabase SQL Editor
# 2. Copy content from: supabase/migrations/20260117_flatten_driver_jobs_structure.sql
# 3. Run the SQL
```

### 2. Import Data from Google Sheets
```bash
# Open in browser
PTGLG/driverconnect/driverapp/import-from-sheets.html

# Or deploy to web server
# Then access via URL
```

### 3. Verify Import
```sql
-- Check columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'driver_jobs'
ORDER BY ordinal_position;

-- Check data
SELECT shipment_no, delivery, material, ship_to_name
FROM driver_jobs
LIMIT 5;
```

## 📊 Files Changed

### New Files
- ✅ `supabase/migrations/20260117_flatten_driver_jobs_structure.sql` - Migration to add columns
- ✅ `apply-flatten-schema.bat` - Batch file to apply migration
- ✅ `PTGLG/driverconnect/driverapp/import-from-sheets.html` - Import UI
- ✅ `PTGLG/driverconnect/driverapp/js/sheets-importer.js` - Import logic
- ✅ `FLATTEN_STRUCTURE_GUIDE.md` - This file

### Updated Files
- ✅ `js/sheets-importer.js` - Updated column mapping to include ALL columns

### Deprecated
- ⚠️ `driver_job_items` table - No longer needed (can keep for backward compatibility)
- ⚠️ `20260117_update_driver_jobs_structure.sql` - Old migration (two-table structure)

## 🎯 Benefits

1. **Simpler Architecture** - One table instead of two
2. **Easier Import** - Direct row-to-row mapping
3. **Faster Queries** - No joins needed
4. **Better Performance** - Fewer database roundtrips
5. **Exact SAP Match** - Structure matches export perfectly

## ⚠️ Considerations

**For Multiple Delivery Items per Shipment:**
- Current flat structure: One row per delivery item
- Each row will have same shipment header data
- This is how SAP exports data (denormalized)
- Good for reporting and simple queries
- Some data duplication (acceptable for this use case)

**Alternative (if needed later):**
- Keep `driver_job_items` table for normalized structure
- Use for complex queries requiring grouping
- Can be populated from flat table using trigger/function

## 🔧 Next Steps

1. ✅ Apply migration (add columns to driver_jobs)
2. ✅ Test import from Google Sheets
3. ⏳ Update admin UI to display new fields
4. ⏳ Update driver app to show delivery details
5. ⏳ Add filters/search for new columns

## 📝 Notes

- All new columns are **nullable** (won't break existing data)
- Existing driver app functionality unchanged
- New columns available for future features
- RLS policies already configured (public access for testing)
- Indexes added for common queries (delivery, material, ship_to)
