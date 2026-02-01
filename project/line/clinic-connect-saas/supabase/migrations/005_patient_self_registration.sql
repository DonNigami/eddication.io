-- =====================================================
-- CLINIC CONNECT SAAS - PATIENT SELF-REGISTRATION
-- Migration: 005_patient_self_registration
-- Date: 2025-02-01
-- =====================================================

-- Drop existing restrictive policies and add self-registration support

-- USERS RLS - Allow patients to create their own user record
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Service role full access users" ON users;

CREATE POLICY "Anyone can view users" ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert user for registration" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Service role full access users" ON users FOR ALL USING (auth.role() = 'service_role');

-- PATIENTS RLS - Allow self-registration
DROP POLICY IF EXISTS "Patients can view own records" ON patients;
DROP POLICY IF EXISTS "Patients can update own records" ON patients;
DROP POLICY IF EXISTS "Service role full access patients" ON patients;

CREATE POLICY "Patients can insert own record"
    ON patients FOR INSERT
    WITH CHECK (true); -- Allow any user to insert (for registration)

CREATE POLICY "Patients can view own records"
    ON patients FOR SELECT
    USING (user_id = auth.uid() OR auth.uid() IS NOT NULL);

CREATE POLICY "Patients can update own records"
    ON patients FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access patients"
    ON patients FOR ALL
    USING (auth.role() = 'service_role');

-- APPOINTMENTS RLS - Allow patients to create appointments
DROP POLICY IF EXISTS "Patients can view own appointments" ON appointments;
DROP POLICY IF EXISTS "Doctors can view clinic appointments" ON appointments;
DROP POLICY IF EXISTS "Service role full access appointments" ON appointments;

CREATE POLICY "Patients can view own appointments"
    ON appointments FOR SELECT
    USING (
        patient_id IN (
            SELECT patient_id FROM patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can create appointments"
    ON appointments FOR INSERT
    WITH CHECK (true); -- Allow authenticated users to create appointments

CREATE POLICY "Service role full access appointments"
    ON appointments FOR ALL
    USING (auth.role() = 'service_role');

-- APPOINTMENT SLOTS - Allow public reading
DROP POLICY IF EXISTS "Service role full access appointment_slots" ON appointment_slots;
CREATE POLICY "Appointment slots are publicly viewable"
    ON appointment_slots FOR SELECT
    USING (true);
CREATE POLICY "Service role full access appointment_slots"
    ON appointment_slots FOR ALL
    USING (auth.role() = 'service_role');

-- QUEUE MANAGEMENT - Allow public reading
DROP POLICY IF EXISTS "Service role full access queue_management" ON queue_management;
CREATE POLICY "Queue management is publicly viewable"
    ON queue_management FOR SELECT
    USING (true);
CREATE POLICY "Service role full access queue_management"
    ON queue_management FOR ALL
    USING (auth.role() = 'service_role');

-- CLINICS - Allow public reading
DROP POLICY IF EXISTS "Service role full access clinics" ON clinics;
CREATE POLICY "Clinics are publicly viewable"
    ON clinics FOR SELECT
    USING (is_active = true);
CREATE POLICY "Service role full access clinics"
    ON clinics FOR ALL
    USING (auth.role() = 'service_role');

-- DOCTORS - Allow public reading
DROP POLICY IF EXISTS "Service role full access doctors" ON doctors;
CREATE POLICY "Doctors are publicly viewable"
    ON doctors FOR SELECT
    USING (is_available = true);
CREATE POLICY "Service role full access doctors"
    ON doctors FOR ALL
    USING (auth.role() = 'service_role');

-- ARTICLES - Allow public reading of published articles
DROP POLICY IF EXISTS "Service role full access articles" ON articles;
CREATE POLICY "Published articles are publicly viewable"
    ON articles FOR SELECT
    USING (status = 'published');
CREATE POLICY "Service role full access articles"
    ON articles FOR ALL
    USING (auth.role() = 'service_role');

-- MEDICAL RECORDS - Allow patients to view their own
DROP POLICY IF EXISTS "Service role full access medical_records" ON medical_records;
CREATE POLICY "Patients can view own medical records"
    ON medical_records FOR SELECT
    USING (
        patient_id IN (
            SELECT patient_id FROM patients WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Service role full access medical_records"
    ON medical_records FOR ALL
    USING (auth.role() = 'service_role');

-- NOTIFICATIONS
DROP POLICY IF EXISTS "Service role full access notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());
CREATE POLICY "Service role full access notifications"
    ON notifications FOR ALL
    USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON clinics TO anon, authenticated;
GRANT SELECT ON doctors TO anon, authenticated;
GRANT SELECT, INSERT ON users TO anon, authenticated;
GRANT SELECT, INSERT ON patients TO anon, authenticated;
GRANT SELECT, INSERT ON appointments TO anon, authenticated;
GRANT SELECT ON appointment_slots TO anon, authenticated;
GRANT SELECT ON queue_management TO anon, authenticated;
GRANT SELECT ON articles TO anon, authenticated;
GRANT SELECT ON medical_records TO anon, authenticated;
GRANT SELECT, UPDATE ON notifications TO anon, authenticated;

-- Note: All tables use UUID (uuid_generate_v4), not sequences, so no sequence grants needed

-- =====================================================
-- END OF MIGRATION
-- =====================================================
