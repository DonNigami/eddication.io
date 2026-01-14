# Migration Plan: Driver Tracking App (Google Sheets -> Supabase)

This document outlines the step-by-step plan to migrate the backend of the Driver Tracking Application from Google Apps Script (GAS) and Google Sheets to Supabase.

## Phase 1: Database & Storage Setup (Supabase)

### 1.1 Database Schema Design
Create the following tables in the Supabase SQL Editor:

- **`trips`**: Stores main job/trip information.
    - `id` (bigint, primary key)
    - `reference_no` (text, unique, required)
    - `vehicle_desc` (text)
    - `shipment_nos` (text[] or jsonb)
    - `driver_ids` (text[] or jsonb - LINE User IDs)
    - `status` (text, default 'open')
    - `job_closed` (boolean, default false)
    - `trip_ended` (boolean, default false)
    - `start_time`, `end_time` (timestamptz)
    - `created_at` (timestamptz)

- **`trip_stops`**: Stores individual stops for each trip.
    - `id` (bigint, primary key)
    - `trip_id` (bigint, FK to `trips.id`)
    - `sequence` (int)
    - `destination_name` (text) - Maps to `destination1` / `destination2`
    - `lat`, `lng` (double precision) - Destination coordinates
    - `status` (text, default 'pending')
    - `is_origin` (boolean)
    - `check_in_time`, `check_out_time` (timestamptz)
    - `fueling_time`, `unload_done_time` (timestamptz)
    - `check_in_odo` (numeric)
    - `receiver_name`, `receiver_type` (text)
    - `check_in_lat`, `check_in_lng` (double precision) - Actual location at check-in

- **`alcohol_checks`**: Stores alcohol test results.
    - `id` (bigint, primary key)
    - `trip_id` (bigint, FK to `trips.id`)
    - `driver_user_id` (text)
    - `driver_name` (text)
    - `alcohol_value` (numeric)
    - `image_url` (text)
    - `checked_at` (timestamptz)
    - `lat`, `lng` (double precision)

### 1.2 Storage Setup
- Create a new Storage Bucket named `alcohol-evidence`.
- Set access policies (RLS) to allow authenticated/anon users to upload images (or Public for simplicity during dev).

### 1.3 Row Level Security (RLS)
- Enable RLS on all tables.
- Create policies to allow:
    - **Read:** Allow reading trips/stops by `reference_no` (Public or Authenticated).
    - **Update:** Allow updating `trip_stops` and `trips` status.
    - **Insert:** Allow inserting into `alcohol_checks`.

---

## Phase 2: Frontend Implementation (index.html)

### 2.1 Dependencies & Initialization
- [ ] Remove Google Apps Script `WEB_APP_URL` variable.
- [ ] Add Supabase JS SDK via CDN.
- [ ] Initialize Supabase Client (`createClient`) with Project URL and Anon Key.

### 2.2 Refactor `search()` Function
- [ ] Replace `fetch(GAS_URL)` with `supabase.from('trips').select(...)`.
- [ ] Implement data mapping: Convert Supabase response format (snake_case) to the existing CamelCase format expected by the UI (e.g., `reference_no` -> `referenceNo`).
- [ ] Handle errors and "Trip Not Found" scenarios.

### 2.3 Refactor `updateStopStatus()` Function
- [ ] Replace `fetch(GAS_URL, method: POST)` with `supabase.from('trip_stops').update(...)`.
- [ ] Logic to handle different update types (`checkin`, `fuel`, `unload`, `checkout`).
- [ ] Ensure GPS coordinates (`lat`, `lng`) are sent correctly.
- [ ] Update UI immediately upon success without full page reload if possible.

### 2.4 Refactor `doAlcoholCheck()` Function
- [ ] Modify to accept `File` object from input instead of Base64 string.
- [ ] Implement `supabase.storage.from('alcohol-evidence').upload(...)`.
- [ ] Get Public URL of the uploaded image.
- [ ] Insert record into `alcohol_checks` table with the image URL.

### 2.5 Refactor `closeJob()` and `endTrip()`
- [ ] Update `closeJob` to update `trips` table (`job_closed = true`, `vehicle_status`, etc.).
- [ ] Update `endTrip` to update `trips` table (`trip_ended = true`, `end_odo`, etc.).

---

## Phase 3: Offline Mode & Synchronization

### 3.1 Update Offline Queue Logic
- [ ] Modify `addToOfflineQueue` to store data in a format compatible with Supabase operations (not GAS FormData).
- [ ] Update `syncOfflineQueue` to iterate through the queue and perform Supabase calls (`.insert()`, `.update()`) based on the action type.

### 3.2 Image Handling in Offline Mode (Optional/Advanced)
- [ ] *Decision needed:* Storing large images in `localStorage` for offline upload is risky (quota limits).
- [ ] *Solution:* Use `IndexedDB` for offline image storage or disable image uploading while offline initially.

---

## Phase 4: Testing & Validation

### 4.1 Functional Testing
- [ ] **Search:** Can find existing trips by Reference No?
- [ ] **Check-in/Out:** Do timestamps and statuses update correctly in the DB?
- [ ] **Alcohol:** Are images uploaded to Storage? Is the record created?
- [ ] **End Job:** Does the job status change to closed/ended?

### 4.2 Performance Testing
- [ ] Measure load times compared to GAS version.
- [ ] Verify UI responsiveness during updates.

### 4.3 Deployment
- [ ] Final code review.
- [ ] Deploy `index.html` to the hosting environment (or update existing file).
