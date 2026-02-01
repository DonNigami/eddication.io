-- =====================================================
-- CLINIC CONNECT SAAS - TODAY APPOINTMENTS VIEW
-- =====================================================
-- This view combines appointments with doctor and patient information
-- for today's appointments, used in the admin dashboard

-- Drop view if exists
DROP VIEW IF EXISTS today_appointments;

-- Create view for today's appointments
CREATE OR REPLACE VIEW today_appointments AS
SELECT
  a.appointment_id,
  a.clinic_id,
  a.patient_id,
  a.doctor_id,
  a.appointment_date,
  a.appointment_time,
  a.queue_number,
  a.status,
  a.symptoms,
  a.notes,
  a.created_at,
  a.updated_at,
  -- Doctor information
  d.name AS doctor_name,
  d.title AS doctor_title,
  d.specialty AS doctor_specialty,
  -- Patient information
  p.name AS patient_name,
  p.phone AS patient_phone,
  p.line_user_id AS patient_line_user_id
FROM appointments a
LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
LEFT JOIN patients p ON a.patient_id = p.patient_id
WHERE a.appointment_date = CURRENT_DATE;

-- Add comment for documentation
COMMENT ON VIEW today_appointments IS 'View of today appointments with joined doctor and patient information for dashboard display';
