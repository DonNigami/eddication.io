# DriverConnect Database Schema Reference

**Project**: DriverConnect - Fuel Delivery Management System
**Database**: Supabase (PostgreSQL)
**Project URL**: https://supabase.com/dashboard/project/myplpshpcordggbbtblg
**Last Updated**: 2026-01-27

---

## Table of Contents

1. [Core Job Tables](#core-job-tables)
2. [User Management](#user-management)
3. [Location Tables](#location-tables)
4. [Driver Tracking](#driver-tracking)
5. [Safety & Compliance](#safety--compliance)
6. [Reporting & Monitoring](#reporting--monitoring)
7. [CRM Tables](#crm-tables)
8. [Views](#views)
9. [Storage Buckets](#storage-buckets)
10. [RLS Policies](#rls-policies)

---

## Core Job Tables

### `jobdata` (Main Job/Stops Table)

**Description**: Primary table for delivery jobs and stops. Contains all delivery information, check-in/out data, and fueling records.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `SERIAL` | - | Primary key |
| `reference` | `VARCHAR(50)` | - | Job reference number (e.g., HXX-123456) |
| `shipment_no` | `VARCHAR(100)` | - | Shipment number |
| `ship_to_code` | `VARCHAR(50)` | - | Customer/station code |
| `ship_to_name` | `VARCHAR(200)` | - | Customer/station name |
| `status` | `VARCHAR(30)` | `'PENDING'` | Status: PENDING, checkin, checkout |
| `checkin_time` | `TIMESTAMPTZ` | - | Check-in timestamp |
| `checkout_time` | `TIMESTAMPTZ` | - | Check-out timestamp |
| `updated_by` | `VARCHAR(100)` | - | User who last updated |
| `source_row` | `INTEGER` | - | Source row reference |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update timestamp |
| `dest_lat` | `NUMERIC(10,7)` | - | Destination latitude |
| `dest_lng` | `NUMERIC(10,7)` | - | Destination longitude |
| `radius_m` | `INTEGER` | `200` | Geofence radius in meters |
| `checkin_lat` | `NUMERIC(10,7)` | - | Check-in latitude |
| `checkin_lng` | `NUMERIC(10,7)` | - | Check-in longitude |
| `checkout_lat` | `NUMERIC(10,7)` | - | Check-out latitude |
| `checkout_lng` | `NUMERIC(10,7)` | - | Check-out longitude |
| `fueling_time` | `TIMESTAMPTZ` | - | Fueling timestamp |
| `unload_done_time` | `TIMESTAMPTZ` | - | Unload completion timestamp |
| `reviewed_time` | `TIMESTAMPTZ` | - | Review completion timestamp |
| `job_closed_at` | `TIMESTAMPTZ` | - | Job closed timestamp |
| `distance_km` | `NUMERIC(10,2)` | - | Distance traveled in km |
| `checkin_odo` | `INTEGER` | - | Odometer at check-in |
| `trip_end_odo` | `INTEGER` | - | Odometer at trip end |
| `trip_end_lat` | `NUMERIC(10,7)` | - | Trip end latitude |
| `trip_end_lng` | `NUMERIC(10,7)` | - | Trip end longitude |
| `trip_end_place` | `VARCHAR(200)` | - | Trip end location name |
| `trip_ended_at` | `TIMESTAMPTZ` | - | Trip ended timestamp |
| `vehicle_desc` | `VARCHAR(200)` | - | Vehicle description/plate |
| `processdata_time` | `TIMESTAMPTZ` | - | Process data timestamp |
| `seq` | `INTEGER` | `1` | Stop sequence number |
| `route` | `VARCHAR(50)` | - | Route code |
| `drivers` | `TEXT` | - | Driver names (comma-separated) |
| `is_origin_stop` | `BOOLEAN` | `false` | Origin station flag |
| `materials` | `TEXT` | - | Materials (comma-separated) |
| `total_qty` | `NUMERIC(12,2)` | - | Total quantity |
| `receiver_name` | `VARCHAR(100)` | - | Receiver name |
| `receiver_type` | `VARCHAR(50)` | - | Receiver type |
| `has_pumping` | `BOOLEAN` | `false` | Has pumping data flag |
| `has_transfer` | `BOOLEAN` | `false` | Has transfer data flag |
| `job_closed` | `BOOLEAN` | `false` | Job closed flag |
| `trip_ended` | `BOOLEAN` | `false` | Trip ended flag |
| `vehicle_status` | `VARCHAR(30)` | - | Vehicle status after job |
| `closed_by` | `VARCHAR(100)` | - | User who closed job |
| `ended_by` | `VARCHAR(100)` | - | User who ended trip |
| `accuracy` | `NUMERIC(10,2)` | - | GPS accuracy in meters |
| `driver_count` | `INTEGER` | - | Number of drivers |
| `is_holiday_work` | `BOOLEAN` | `false` | Holiday work flag |
| `holiday_work_notes` | `TEXT` | - | Holiday work notes |

**Constraints**:
- Primary Key: `id`
- Unique: `(reference, seq)`

**Indexes**:
- `idx_jobdata_reference_shiptocode` ON `(reference, ship_to_code)`

---

### `trips` (formerly `driver_jobs`)

**Description**: Trip/job header table. Main trip record for each delivery job.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `reference` | `TEXT` | UNIQUE | Job reference number |
| `reference_no` | `TEXT` | - | Alias for reference |
| `vehicle_desc` | `TEXT` | - | Vehicle description |
| `drivers` | `TEXT` | - | Driver names |
| `driver_ids` | `JSONB` | `'[]'::jsonb` | Driver LINE User IDs array |
| `status` | `TEXT` | `'active'` | Status: active, closed, completed |
| `start_odo` | `INTEGER` | - | Starting odometer |
| `end_odo` | `INTEGER` | - | Ending odometer |
| `start_location` | `JSONB` | - | Start coordinates {lat, lng} |
| `end_location` | `JSONB` | - | End coordinates {lat, lng} |
| `vehicle_status` | `TEXT` | - | Vehicle status after job |
| `fees` | `NUMERIC(10,2)` | - | Fees amount |
| `job_closed` | `BOOLEAN` | `false` | Job closed flag |
| `trip_ended` | `BOOLEAN` | `false` | Trip ended flag |
| `start_time` | `TIMESTAMPTZ` | - | Trip start time |
| `end_time` | `TIMESTAMPTZ` | - | Trip end time |
| `shipment_nos` | `JSONB` | `'[]'::jsonb` | Shipment numbers array |
| `is_holiday_work` | `BOOLEAN` | `false` | Holiday work flag |
| `holiday_work_notes` | `TEXT` | - | Holiday work notes |
| `is_vehicle_breakdown` | `BOOLEAN` | `false` | Vehicle breakdown flag |
| `breakdown_reason` | `TEXT` | - | Breakdown reason |
| `original_job_id` | `UUID` | FK | Original trip ID (if rescheduled) |
| `replacement_job_id` | `UUID` | FK | Replacement trip ID |
| `is_b100` | `BOOLEAN` | `false` | B100 job flag |
| `b100_amount` | `NUMERIC(12,2)` | - | B100 amount |
| `b100_status` | `TEXT` | `'pending'` | B100 status: pending, paid, outstanding |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update timestamp |
| `created_by` | `TEXT` | - | Creator LINE User ID |
| `updated_by` | `TEXT` | - | Updater LINE User ID |

**Constraints**:
- Primary Key: `id`
- Unique: `reference`

**Indexes**:
- `idx_trips_reference` ON `(reference)`
- `idx_trips_status` ON `(status)`
- `idx_driver_jobs_is_holiday_work` ON `(is_holiday_work)` WHERE `is_holiday_work = TRUE`
- `idx_driver_jobs_is_vehicle_breakdown` ON `(is_vehicle_breakdown)` WHERE `is_vehicle_breakdown = TRUE`
- `idx_driver_jobs_original_job_id` ON `(original_job_id)` WHERE `original_job_id IS NOT NULL`
- `idx_driver_jobs_is_b100` ON `(is_b100)` WHERE `is_b100 = TRUE`
- `idx_driver_jobs_b100_status` ON `(b100_status)` WHERE `is_b100 = TRUE`

---

### `trip_stops` (formerly `driver_stops`)

**Description**: Individual stops within a trip. Each stop represents a delivery location.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `job_id` | `UUID` | FK | Foreign key to trips.id |
| `trip_id` | `UUID` | FK | Foreign key to trips.id (alias) |
| `reference` | `TEXT` | - | Job reference number |
| `stop_number` | `INTEGER` | - | Stop number (old name) |
| `sequence` | `INTEGER` | - | Stop sequence number |
| `stop_name` | `TEXT` | - | Stop name (old name) |
| `destination_name` | `TEXT` | - | Destination name |
| `address` | `TEXT` | - | Address |
| `lat` | `DOUBLE PRECISION` | - | Latitude |
| `lng` | `DOUBLE PRECISION` | - | Longitude |
| `is_origin` | `BOOLEAN` | `false` | Origin station flag |
| `status` | `TEXT` | `'pending'` | Status: pending, checkin, fuel, unload, checkout |
| **Check-in** | | | |
| `checkin_time` | `TIMESTAMPTZ` | - | Check-in time (old) |
| `check_in_time` | `TIMESTAMPTZ` | - | Check-in time |
| `checkin_location` | `JSONB` | - | Check-in location (old) |
| `check_in_lat` | `DOUBLE PRECISION` | - | Check-in latitude |
| `check_in_lng` | `DOUBLE PRECISION` | - | Check-in longitude |
| `check_in_odo` | `NUMERIC` | - | Odometer at check-in |
| `checkin_by` | `TEXT` | - | LINE User ID (old) |
| **Fueling** | | | |
| `fuel_time` | `TIMESTAMPTZ` | - | Fuel time (old) |
| `fueling_time` | `TIMESTAMPTZ` | - | Fueling time |
| `fuel_location` | `JSONB` | - | Fuel location |
| `fuel_odo` | `INTEGER` | - | Odometer at fuel |
| `fuel_by` | `TEXT` | - | LINE User ID |
| **Unload** | | | |
| `unload_time` | `TIMESTAMPTZ` | - | Unload time (old) |
| `unload_done_time` | `TIMESTAMPTZ` | - | Unload done time |
| `unload_location` | `JSONB` | - | Unload location |
| `unload_receiver` | `TEXT` | - | Receiver name (old) |
| `receiver_name` | `TEXT` | - | Receiver name |
| `receiver_type` | `TEXT` | - | Receiver type |
| `unload_by` | `TEXT` | - | LINE User ID |
| **Check-out** | | | |
| `checkout_time` | `TIMESTAMPTZ` | - | Check-out time (old) |
| `check_out_time` | `TIMESTAMPTZ` | - | Check-out time |
| `checkout_location` | `JSONB` | - | Check-out location |
| `checkout_odo` | `INTEGER` | - | Odometer at checkout |
| `checkout_by` | `TEXT` | - | LINE User ID |
| **Other** | | | |
| `notes` | `TEXT` | - | Notes |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update timestamp |

**Constraints**:
- Primary Key: `id`
- Foreign Key: `job_id` REFERENCES `trips(id)` ON DELETE CASCADE

**Indexes**:
- `idx_trip_stops_job_id` ON `(job_id)`
- `idx_trip_stops_reference` ON `(reference)`
- `idx_trip_stops_sequence` ON `(sequence)`

---

### `driver_stop` (Duplicate/Sync Table)

**Description**: Individual stops table (may be duplicate of trip_stops for compatibility).

**Schema**: Same as `trip_stops` with additional:
- `trip_id` UUID REFERENCES `driver_jobs(id)`

---

## User Management

### `user_profiles`

**Description**: User/driver profiles from LINE LIFF. Tracks all users who open the app.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `user_id` | `TEXT` | UNIQUE | LINE User ID |
| `display_name` | `TEXT` | - | LINE display name |
| `picture_url` | `TEXT` | - | LINE profile picture URL |
| `status_message` | `TEXT` | - | LINE status message |
| `phone` | `TEXT` | - | Phone number |
| `email` | `TEXT` | - | Email address |
| `employee_id` | `TEXT` | - | Employee ID |
| `user_type` | `TEXT` | `'DRIVER'` | User type: DRIVER, ADMIN |
| `status` | `TEXT` | `'PENDING'` | Approval status: PENDING, APPROVED, REJECTED |
| `approved_by` | `TEXT` | - | LINE User ID of approver |
| `approved_at` | `TIMESTAMPTZ` | - | Approval timestamp |
| `rejection_reason` | `TEXT` | - | Reason for rejection |
| `first_seen_at` | `TIMESTAMPTZ` | `NOW()` | First visit timestamp |
| `last_seen_at` | `TIMESTAMPTZ` | `NOW()` | Last visit timestamp |
| `total_visits` | `INTEGER` | `1` | Total visit count |
| `last_reference` | `TEXT` | - | Last searched reference |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update timestamp |

**Constraints**:
- Primary Key: `id`
- Unique: `user_id`

**Indexes**:
- `idx_user_profiles_user_id` ON `(user_id)`
- `idx_user_profiles_last_seen` ON `(last_seen_at DESC)`
- `idx_user_profiles_status_approval` ON `(status, approved_at DESC)`

**Triggers**:
- `update_user_profiles_updated_at` - Auto-update `updated_at`

---

### `pending_driver_approvals` (View)

**Description**: View for admin to see drivers pending approval.

```sql
SELECT id, user_id, display_name, picture_url, phone, email, employee_id,
       user_type, first_seen_at, last_seen_at, total_visits
FROM user_profiles
WHERE status = 'PENDING'
ORDER BY first_seen_at ASC;
```

---

## Location Tables

### `station`

**Description**: Service stations/origins (PTC stations).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `station_name` | `TEXT` | - | Station name |
| `mobile` | `TEXT` | - | Mobile contact |
| `Name_Area` | `TEXT` | - | Area name |
| `Phone_Area` | `TEXT` | - | Area phone |
| `Name_Region` | `TEXT` | - | Region name |
| `Phone_Region` | `TEXT` | - | Region phone |
| `GPS` | `TEXT` | - | GPS coordinates string |
| `time_open` | `TEXT` | - | Opening hours |
| `depot_name` | `TEXT` | - | Depot name |
| `plant code` | `TEXT` | NOT NULL | Plant code |
| `lat` | `DOUBLE PRECISION` | - | Latitude |
| `lng` | `DOUBLE PRECISION` | - | Longitude |
| `radiusMeters` | `BIGINT` | `100` | Geofence radius |
| `name` | `TEXT` | GENERATED | Alias for station_name |
| `stationKey` | `TEXT` | NOT NULL | Station key |

**Constraints**:
- Primary Key: `(plant code, stationKey)`

**Indexes**:
- `idx_station_name` ON `(name)`
- `idx_station_station_key` ON `(stationKey)`
- `idx_station_plant_code` ON `(plant code)`

---

### `customer`

**Description**: Customer locations.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `stationKey` | `TEXT` | NOT NULL, PK | Customer key |
| `stationKey2` | `TEXT` | NOT NULL | Secondary key |
| `name` | `TEXT` | - | Customer name |
| `lat` | `DOUBLE PRECISION` | - | Latitude |
| `lng` | `DOUBLE PRECISION` | - | Longitude |
| `radiusMeters` | `BIGINT` | - | Geofence radius |
| `email` | `TEXT` | - | Email |
| `STD` | `TEXT` | - | STD code |

**Constraints**:
- Primary Key: `stationKey`

**Indexes**:
- `idx_customer_station_key2` ON `(stationKey2)`
- `idx_customer_name` ON `(name)`
- `idx_customer_email` ON `(email)`
- `idx_customer_std` ON `(STD)`

---

### `origin`

**Description**: Job departure points/origins.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `originKey` | `TEXT` | NOT NULL | Origin key |
| `name` | `TEXT` | - | Origin name |
| `lat` | `DOUBLE PRECISION` | - | Latitude |
| `lng` | `DOUBLE PRECISION` | - | Longitude |
| `radiusMeters` | `BIGINT` | - | Geofence radius |
| `routeCode` | `TEXT` | NOT NULL | Route code |

**Constraints**:
- Primary Key: `(originKey, routeCode)`

**Indexes**:
- `idx_origin_name` ON `(name)`

**Default Data**:
- `('TOP_SR', 'ไทยออยล์ ศรีราชา', 13.1100258, 100.9144418, 500, '001')`
- `('TOP_LC', 'ไทยออยล์ แหลมฉบัง', 13.0850000, 100.8950000, 500, '002')`

---

## Driver Tracking

### `driver_live_locations`

**Description**: Real-time driver GPS tracking.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `driver_user_id` | `TEXT` | PK | LINE User ID |
| `trip_id` | `BIGINT` | - | FK to trips.id |
| `lat` | `FLOAT8` | NOT NULL | Latitude |
| `lng` | `FLOAT8` | NOT NULL | Longitude |
| `last_updated` | `TIMESTAMPTZ` | `NOW()` | Last update timestamp |
| `is_tracked_in_realtime` | `BOOLEAN` | `false` | Real-time tracking flag |

**Constraints**:
- Primary Key: `driver_user_id`

**Indexes**:
- `idx_driver_live_locations_trip_id` ON `(trip_id)`

---

### `driver_logs`

**Description**: Audit trail for driver actions.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `job_id` | `UUID` | FK | FK to trips.id |
| `trip_id` | `UUID` | FK | FK to trips.id (alias) |
| `reference` | `TEXT` | - | Job reference |
| `action` | `TEXT` | NOT NULL | Action: search, checkin, checkout, fuel, unload, alcohol, close, endtrip |
| `details` | `JSONB` | - | Additional details |
| `location` | `JSONB` | - | GPS location {lat, lng} |
| `user_id` | `TEXT` | - | LINE User ID |
| `user_name` | `TEXT` | - | LINE display name |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |

**Constraints**:
- Primary Key: `id`
- Foreign Key: `job_id` REFERENCES `trips(id)` ON DELETE CASCADE

**Indexes**:
- `idx_driver_logs_job_id` ON `(job_id)`
- `idx_driver_logs_reference` ON `(reference)`
- `idx_driver_logs_action` ON `(action)`
- `idx_driver_logs_created_at` ON `(created_at DESC)`

---

## Safety & Compliance

### `alcohol_checks` (formerly `driver_alcohol_checks`)

**Description**: Alcohol test records for drivers.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `job_id` | `UUID` | FK | FK to trips.id |
| `trip_id` | `UUID` | FK | FK to trips.id (alias) |
| `reference` | `TEXT` | NOT NULL | Job reference |
| `driver_name` | `TEXT` | NOT NULL | Driver name |
| `driver_user_id` | `TEXT` | - | LINE User ID |
| `alcohol_value` | `NUMERIC(4,3)` | NOT NULL | Alcohol level (0.000-5.000) |
| `image_url` | `TEXT` | - | Evidence image URL |
| `location` | `JSONB` | - | GPS location {lat, lng} |
| `lat` | `DOUBLE PRECISION` | - | Latitude (extracted) |
| `lng` | `DOUBLE PRECISION` | - | Longitude (extracted) |
| `checked_at` | `TIMESTAMPTZ` | `NOW()` | Test timestamp |
| `checked_by` | `TEXT` | - | LINE User ID |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |

**Constraints**:
- Primary Key: `id`
- Foreign Key: `job_id` REFERENCES `trips(id)` ON DELETE CASCADE

**Indexes**:
- `idx_alcohol_checks_job_id` ON `(job_id)`
- `idx_alcohol_checks_reference` ON `(reference)`
- `idx_alcohol_checks_checked_at` ON `(checked_at DESC)`

---

### `fuel_siphoning`

**Description**: Records of fuel siphoning incidents.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `station_name` | `TEXT` | NOT NULL | Station name |
| `station_code` | `TEXT` | - | Station code |
| `customer_name` | `TEXT` | - | Customer name |
| `customer_code` | `TEXT` | - | Customer code |
| `driver_user_id` | `TEXT` | NOT NULL | LINE User ID |
| `driver_name` | `TEXT` | NOT NULL | Driver name |
| `vehicle_plate` | `TEXT` | NOT NULL | Vehicle plate |
| `liters` | `NUMERIC(10,2)` | NOT NULL | Siphoned liters |
| `siphon_date` | `DATE` | NOT NULL | Date of incident |
| `siphon_time` | `TIME` | - | Time of incident |
| `evidence_image_url` | `TEXT` | - | Evidence image URL |
| `notes` | `TEXT` | - | Notes |
| `reported_by` | `TEXT` | NOT NULL | Reporter LINE User ID |
| `status` | `TEXT` | `'reported'` | Status: reported, verified, resolved, cancelled |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update timestamp |

**Constraints**:
- Check: `status IN ('reported', 'verified', 'resolved', 'cancelled')`

**Indexes**:
- `idx_fuel_siphoning_driver_user_id` ON `(driver_user_id)`
- `idx_fuel_siphoning_siphon_date` ON `(siphon_date)`
- `idx_fuel_siphoning_status` ON `(status)`
- `idx_fuel_siphoning_station_code` ON `(station_code)`

---

## Reporting & Monitoring

### `app_settings`

**Description**: Application-wide configurable settings.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `TEXT` | PK | Setting ID |
| `value` | `TEXT` | NOT NULL | Setting value |
| `type` | `TEXT` | `'string'` | Data type: number, boolean, string |
| `description` | `TEXT` | - | Description |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update |

**Default Settings**:
- `geofencing_radius_m = 200` - Geofencing radius in meters
- `driver_app_auto_refresh_interval_s = 30` - Auto-refresh interval
- `admin_panel_map_zoom = 10` - Default map zoom
- `admin_panel_map_center_lat = 13.736717` - Map center lat
- `admin_panel_map_center_lng = 100.523186` - Map center lng

---

### `admin_alerts`

**Description**: Configurable alert rules for anomalies.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `uuid_generate_v4()` | Primary key |
| `rule_name` | `TEXT` | UNIQUE, NOT NULL | Rule name |
| `rule_type` | `TEXT` | NOT NULL | Type: geofence_deviation, long_stop, job_overdue |
| `threshold` | `JSONB` | - | Threshold config {distance_m, duration_min} |
| `status` | `TEXT` | `'active'` | Status: active, inactive |
| `recipients` | `JSONB` | - | Recipients [{type, id/address}] |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update |

---

### `triggered_alerts`

**Description**: Records of triggered alerts.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `uuid_generate_v4()` | Primary key |
| `alert_rule_id` | `UUID` | FK | FK to admin_alerts.id |
| `trip_id` | `BIGINT` | - | Related trip ID |
| `driver_user_id` | `TEXT` | - | Driver LINE User ID |
| `message` | `TEXT` | NOT NULL | Alert message |
| `details` | `JSONB` | - | Additional details |
| `triggered_at` | `TIMESTAMPTZ` | `NOW()` | Trigger timestamp |
| `resolved_at` | `TIMESTAMPTZ` | - | Resolution timestamp |
| `status` | `TEXT` | `'pending'` | Status: pending, resolved |

**Constraints**:
- Foreign Key: `alert_rule_id` REFERENCES `admin_alerts(id)`

---

### `report_schedules`

**Description**: Configurable report generation schedules.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `uuid_generate_v4()` | Primary key |
| `report_name` | `TEXT` | NOT NULL | Report name |
| `report_type` | `TEXT` | NOT NULL | Type: driver_performance, job_summary |
| `frequency` | `TEXT` | NOT NULL | Frequency: daily, weekly, monthly |
| `recipients` | `JSONB` | - | Recipients [{type, address}] |
| `last_generated_at` | `TIMESTAMPTZ` | - | Last generation |
| `next_generation_at` | `TIMESTAMPTZ` | - | Next generation |
| `status` | `TEXT` | `'active'` | Status: active, paused |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update |

---

### `google_chat_webhooks`

**Description**: Google Chat webhook configurations.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `uuid_generate_v4()` | Primary key |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `entity_type` | `TEXT` | NOT NULL | Entity type: station, customer, stop |
| `entity_id` | `UUID` | NOT NULL | Entity FK ID |
| `description` | `TEXT` | - | Description |
| `notification_type` | `TEXT` | NOT NULL | Type: webhook, dm |
| `target_address` | `TEXT` | NOT NULL | Webhook URL |

**Constraints**:
- Check: `notification_type IN ('webhook', 'dm')`

**Indexes**:
- `idx_google_chat_webhooks_entity` ON `(entity_type, entity_id)`

---

## CRM Tables

### `profiles`

**Description**: CRM user profiles (separate from user_profiles).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Primary key |
| `line_user_id` | `TEXT` | UNIQUE | LINE User ID |
| `display_name` | `TEXT` | - | Display name |
| `picture_url` | `TEXT` | - | Profile picture URL |
| `email` | `TEXT` | - | Email |
| `phone` | `TEXT` | - | Phone |
| `role` | `TEXT` | `'member'` | Role: admin, member |
| `points` | `INTEGER` | `0` | Loyalty points |
| `tags` | `TEXT[]` | `'{}'` | Tags array |
| `last_activity` | `TIMESTAMPTZ` | `NOW()` | Last activity |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update |

**Constraints**:
- Check: `points >= 0`
- Check: `role IN ('admin', 'member')`

**Indexes**:
- `idx_profiles_line_user_id` ON `(line_user_id)`
- `idx_profiles_role` ON `(role)`
- `idx_profiles_points` ON `(points DESC)`
- `idx_profiles_tags` USING `gin(tags)`
- `idx_profiles_last_activity` ON `(last_activity DESC)`

---

### `tiers`

**Description**: Customer loyalty tiers.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `SERIAL` | - | Primary key |
| `name` | `TEXT` | NOT NULL | Tier name |
| `min_points` | `INTEGER` | `0` | Minimum points |
| `color_theme` | `TEXT` | `'card-member'` | CSS class |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |

**Default Tiers**:
- Member (0 points)
- Silver (1000 points)
- Gold (5000 points)
- Platinum (10000 points)
- Black (50000 points)

---

### `news_promotions`

**Description**: News and promotions for customers.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `SERIAL` | - | Primary key |
| `title` | `TEXT` | NOT NULL | Title |
| `description` | `TEXT` | - | Description |
| `image_url` | `TEXT` | - | Image URL |
| `link_url` | `TEXT` | - | Link URL |
| `link_text` | `TEXT` | `'ดูรายละเอียด'` | Link text |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update |

**Indexes**:
- `idx_news_promotions_created_at` ON `(created_at DESC)`

---

### `customer_segments`

**Description**: Customer segmentation rules.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `SERIAL` | - | Primary key |
| `name` | `TEXT` | NOT NULL | Segment name |
| `conditions` | `JSONB` | `'{}'` | Segment conditions |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Last update |

---

## Views

### `jobdata_grouped`

**Description**: Groups jobdata rows by `ship_to_code` for frontend display. Merges items with same destination.

**Columns**:
- `group_id` = `reference || '_' || ship_to_code`
- `reference`, `ship_to_code`, `ship_to_name`
- `materials` = aggregated materials
- `total_qty` = sum of quantities
- `item_count` = count of merged items
- `item_ids` = array of all IDs
- Coordinates, vehicle, route from first row
- `seq` = minimum sequence
- `status` = most advanced status
- Check-in/out times from first available
- `is_origin_stop`, `has_pumping`, `has_transfer` = OR aggregation

---

### `v_b100_outstanding_by_driver`

**Description**: Summary of outstanding B100 jobs by driver.

```sql
SELECT
    drivers,
    COUNT(*) as outstanding_jobs_count,
    SUM(b100_amount) as total_outstanding_amount,
    MAX(created_at) as last_job_date
FROM driver_jobs
WHERE is_b100 = TRUE AND b100_status = 'outstanding'
GROUP BY drivers;
```

---

### `pending_driver_approvals`

**Description**: View of drivers pending approval (see User Management).

---

## Storage Buckets

| Bucket ID | Public | Description |
|-----------|--------|-------------|
| `alcohol-checks` | true | Alcohol test evidence images |
| `alcohol-evidence` | true | Renamed alcohol test bucket |
| `fuel-siphoning-evidence` | true | Fuel siphoning evidence images |

---

## Functions

### Update Functions

| Function | Description |
|----------|-------------|
| `update_updated_at_column()` | Auto-update `updated_at` timestamp |
| `update_grouped_stop_checkin()` | Check-in all rows with same reference+ship_to_code |
| `update_grouped_stop_checkout()` | Check-out all rows with same reference+ship_to_code |
| `update_grouped_stop_fueling()` | Update fueling time for grouped stops |
| `update_grouped_stop_unload()` | Update unload time for grouped stops |
| `is_user_approved(p_user_id)` | Check if user is approved |
| `merge_driver_jobs_to_jobdata(p_reference)` | Merge driver_jobs to jobdata |
| `sync_all_driver_jobs_to_jobdata()` | Sync all driver_jobs to jobdata |

---

## RLS Policies

### Security Status

⚠️ **WARNING**: Anon RLS policies use `WITH CHECK (true)` for development. Requires application-layer ownership verification via `shared/driver-auth.js` before production.

### Policy Summary

| Table | Anon/Authenticated | Admin |
|-------|-------------------|-------|
| `user_profiles` | Full access (dev) | - |
| `trips` (driver_jobs) | Full access (dev) | - |
| `trip_stops` | Full access (dev) | - |
| `alcohol_checks` | Full access (dev) | - |
| `driver_logs` | Full access (dev) | - |
| `driver_stop` | - | Admin full access |
| `customer` | Select, service insert/update/delete | - |
| `station` | Select, service insert/update | - |
| `origin` | Select, service insert/update/delete | - |
| `fuel_siphoning` | Full access | - |
| `admin_alerts` | - | Admin full access |
| `triggered_alerts` | - | Admin select/update |
| `report_schedules` | - | Admin full access |
| `profiles` (CRM) | Full access | - |
| `tiers` | Select | - |
| `news_promotions` | Select | - |
| `customer_segments` | Select | - |

### Admin Verification Pattern

```sql
EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN auth.users au ON up.user_id = (au.raw_user_meta_data->>'line_user_id')::text
    WHERE au.id = auth.uid() AND up.user_type = 'ADMIN'
)
```

---

## Index Summary

### Performance Indexes

| Index | Table | Columns | Type |
|-------|-------|---------|------|
| `idx_jobdata_reference_shiptocode` | jobdata | reference, ship_to_code | btree |
| `idx_trips_reference` | trips | reference | btree |
| `idx_trips_status` | trips | status | btree |
| `idx_trip_stops_job_id` | trip_stops | job_id | btree |
| `idx_trip_stops_sequence` | trip_stops | sequence | btree |
| `idx_alcohol_checks_job_id` | alcohol_checks | job_id | btree |
| `idx_alcohol_checks_checked_at` | alcohol_checks | checked_at DESC | btree |
| `idx_user_profiles_user_id` | user_profiles | user_id | btree |
| `idx_user_profiles_last_seen` | user_profiles | last_seen_at DESC | btree |
| `idx_driver_logs_created_at` | driver_logs | created_at DESC | btree |
| `idx_profiles_tags` | profiles | tags | gin |

---

## Migration Files Reference

| File | Description |
|------|-------------|
| `20260117_create_user_profiles.sql` | Create user_profiles table |
| `20260117_create_driver_tracking_tables.sql` | Create driver_jobs, driver_stops, driver_alcohol_checks, driver_logs |
| `20260117_update_user_profiles.sql` | Add columns to user_profiles |
| `20260117_merge_driver_jobs_to_jobdata.sql` | Merge functions for jobdata |
| `20260117_migrate_to_trips_schema.sql` | Rename to trips/trip_stops |
| `20260117_jobdata_grouped_view.sql` | Create grouped view and update functions |
| `20260118_add_admin_columns_to_user_profiles.sql` | Add status, user_type |
| `20260118_create_app_settings_table.sql` | Create app_settings |
| `20260118_create_admin_alerts_tables.sql` | Create admin_alerts, triggered_alerts |
| `20260118_create_report_schedules_table.sql` | Create report_schedules |
| `20260118_create_driver_stop_table.sql` | Create driver_stop |
| `20260118_create_driver_alcohol_checks.sql` | Create driver_alcohol_checks |
| `20260119_add_holiday_work_notes.sql` | Add holiday work columns |
| `20260119_add_vehicle_breakdown_columns.sql` | Add breakdown tracking |
| `20260119_create_fuel_siphoning_table.sql` | Create fuel_siphoning |
| `20260119_add_b100_job_columns.sql` | Add B100 tracking |
| `20260120134219_create_google_chat_webhooks_table.sql` | Create webhooks |
| `20260120134241_create_driver_live_locations_table.sql` | Create live locations |
| `20260126000000_add_driver_approval_fields.sql` | Add approval fields |
| `20260126030000_create_location_tables.sql` | Create customer, station, origin |
| `20251230_setup_crm_tables.sql` | Create CRM tables |
| `add_is_holiday_work_to_jobdata.sql` | Add is_holiday_work flag |

---

*Generated from migration files. For live schema, use Supabase Dashboard: https://supabase.com/dashboard/project/myplpshpcordggbbtblg*
