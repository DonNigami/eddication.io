-- =====================================================
-- CLINIC CONNECT SAAS - ADDITIONAL TABLES FOR EDGE FUNCTIONS
-- Migration: 003_edge_functions_tables
-- Date: 2025-02-01
-- =====================================================

-- -----------------------------------------------------
-- 1. CLINIC ADMINS
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_admins (
    admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin', -- admin, nurse, receptionist
    receive_reports BOOLEAN DEFAULT true,
    receive_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, user_id)
);

CREATE INDEX idx_clinic_admins_clinic_id ON clinic_admins(clinic_id);

-- -----------------------------------------------------
-- 2. DOCTOR SCHEDULES
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration INT DEFAULT 30, -- minutes per appointment
    break_start_time TIME,
    break_end_time TIME,
    max_patients INT DEFAULT 20,
    is_available BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, day_of_week)
);

CREATE INDEX idx_doctor_schedules_doctor_id ON doctor_schedules(doctor_id);
CREATE INDEX idx_doctor_schedules_day_of_week ON doctor_schedules(day_of_week);

-- -----------------------------------------------------
-- 3. HOLIDAYS
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS holidays (
    holiday_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_national_holiday BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_holidays_date ON holidays(date);

-- -----------------------------------------------------
-- 4. INVOICES
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(appointment_id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, paid, overdue, cancelled
    payment_method VARCHAR(50),
    payment_date TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_clinic_id ON invoices(clinic_id);
CREATE INDEX idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);

-- -----------------------------------------------------
-- 5. INVOICE ITEMS
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0, -- e.g., 0.07 for 7%
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- -----------------------------------------------------
-- 6. PATIENT ALLERGIES
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_allergies (
    allergy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    allergen VARCHAR(100) NOT NULL,
    severity VARCHAR(20) DEFAULT 'moderate', -- mild, moderate, severe
    reaction TEXT,
    diagnosed_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patient_allergies_patient_id ON patient_allergies(patient_id);
CREATE INDEX idx_patient_allergies_is_active ON patient_allergies(is_active);

-- -----------------------------------------------------
-- 7. PATIENT CONDITIONS (Chronic Diseases)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_conditions (
    condition_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    condition_name VARCHAR(100) NOT NULL,
    icd10_code VARCHAR(20),
    diagnosed_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patient_conditions_patient_id ON patient_conditions(patient_id);
CREATE INDEX idx_patient_conditions_is_active ON patient_conditions(is_active);

-- -----------------------------------------------------
-- 8. DAILY REPORTS
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    total_appointments INT DEFAULT 0,
    completed_appointments INT DEFAULT 0,
    cancelled_appointments INT DEFAULT 0,
    no_show_appointments INT DEFAULT 0,
    new_patients INT DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    average_wait_time INT DEFAULT 0,
    report_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, report_date)
);

CREATE INDEX idx_daily_reports_clinic_id ON daily_reports(clinic_id);
CREATE INDEX idx_daily_reports_report_date ON daily_reports(report_date);

-- -----------------------------------------------------
-- 9. APPOINTMENT REMINDERS (Log)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_reminders (
    reminder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    reminder_type VARCHAR(20) DEFAULT 'appointment', -- appointment, reminder
    sent_via VARCHAR(20), -- line, sms
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'sent', -- sent, failed
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointment_reminders_appointment_id ON appointment_reminders(appointment_id);
CREATE INDEX idx_appointment_reminders_sent_at ON appointment_reminders(sent_at);

-- -----------------------------------------------------
-- 10. QUEUE REMINDERS (Log)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS queue_reminders (
    reminder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    sent_via VARCHAR(20), -- line, sms, none
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'sent', -- sent, failed
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_reminders_appointment_id ON queue_reminders(appointment_id);
CREATE INDEX idx_queue_reminders_sent_at ON queue_reminders(sent_at);

-- -----------------------------------------------------
-- 11. UPDATE EXISTING APPOINTMENTS TABLE
-- -----------------------------------------------------

-- Add missing columns to appointments if not exists
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_queue_notified TIMESTAMPTZ;

-- -----------------------------------------------------
-- 12. TRIGGERS
-- -----------------------------------------------------

-- Updated at trigger
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- END OF MIGRATION
-- =====================================================
