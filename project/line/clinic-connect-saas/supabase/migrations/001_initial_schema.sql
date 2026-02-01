-- =====================================================
-- CLINIC CONNECT SAAS - FULL DATABASE SCHEMA
-- Migration: 001_initial_schema
-- Date: 2025-02-01
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================

-- User roles
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'admin');

-- Appointment status
CREATE TYPE appointment_status AS ENUM (
    'pending', 'confirmed', 'checked_in', 'in_consultation',
    'completed', 'cancelled', 'no_show'
);

-- Queue status
CREATE TYPE queue_status AS ENUM (
    'waiting', 'in_queue', 'in_room', 'completed', 'skipped'
);

-- Payment method
CREATE TYPE payment_method AS ENUM (
    'line_pay', 'credit_card', 'promptpay', 'cash', 'other'
);

-- Notification type
CREATE TYPE notification_type AS ENUM (
    'appointment_confirmation', 'appointment_reminder', 'queue_update',
    'queue_called', 'appointment_cancelled', 'news', 'system'
);

-- Article category
CREATE TYPE article_category AS ENUM (
    'health', 'clinic_news', 'promotion', 'announcement', 'tips'
);

-- Subscription tier
CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'clinic');

-- Subscription status
CREATE TYPE subscription_status AS ENUM ('active', 'trial', 'past_due', 'cancelled', 'expired');

-- Billing cycle
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');

-- Block date type
CREATE TYPE block_type AS ENUM ('holiday', 'leave', 'conference', 'other');

-- =====================================================
-- 2. USERS (LINE Login)
-- =====================================================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_user_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    picture_url TEXT,
    email VARCHAR(255),
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'patient',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_line_user_id ON users(line_user_id);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =====================================================
-- 3. CLINICS
-- =====================================================
CREATE TABLE clinics (
    clinic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    line_oa_id VARCHAR(50),
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    subdistrict VARCHAR(100),
    postal_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    description TEXT,
    logo_url TEXT,
    cover_image TEXT,
    location JSONB, -- {lat, lng}
    operating_hours JSONB DEFAULT '{}', -- {mon: {open, close, is_closed}, ...}
    subscription_tier subscription_tier DEFAULT 'basic',
    subscription_status subscription_status DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clinics_slug ON clinics(slug);
CREATE INDEX idx_clinics_subscription_tier ON clinics(subscription_tier);
CREATE INDEX idx_clinics_is_active ON clinics(is_active);

-- =====================================================
-- 4. DOCTORS
-- =====================================================
CREATE TABLE doctors (
    doctor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    title VARCHAR(20), -- พญ., นพ., นายแพทย์
    name VARCHAR(100) NOT NULL,
    license_no VARCHAR(50) UNIQUE,
    specialty VARCHAR(100),
    consultation_fee DECIMAL(10,2) DEFAULT 0,
    appointment_duration_minutes INT DEFAULT 30,
    education TEXT,
    experience_years INT,
    biography TEXT,
    profile_image TEXT,
    is_available BOOLEAN DEFAULT true,
    available_days JSONB DEFAULT '{}', -- [1,2,3,4,5] 1=Mon, 7=Sun
    available_time_start TIME,
    available_time_end TIME,
    break_start_time TIME,
    break_end_time TIME,
    rating_average DECIMAL(3,2) DEFAULT 0,
    review_count INT DEFAULT 0,
    total_patients INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, license_no)
);

-- Indexes
CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctors_clinic_id ON doctors(clinic_id);
CREATE INDEX idx_doctors_is_available ON doctors(is_available);
CREATE INDEX idx_doctors_specialty ON doctors(specialty);

-- =====================================================
-- 5. PATIENTS
-- =====================================================
CREATE TABLE patients (
    patient_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    title VARCHAR(20),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    id_card_number VARCHAR(20),
    blood_type VARCHAR(3) CHECK (blood_type IN ('A', 'B', 'AB', 'O', 'unknown')),
    blood_rh VARCHAR(10) CHECK (blood_rh IN ('positive', 'negative')),
    allergies TEXT,
    chronic_diseases TEXT,
    current_medications TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    address TEXT,
    insurance_provider VARCHAR(100),
    insurance_number VARCHAR(50),
    profile_image TEXT,
    first_visit_date DATE,
    last_visit_date DATE,
    total_visits INT DEFAULT 0,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, user_id)
);

-- Indexes
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_name_trgm ON patients USING gin(name gin_trgm_ops);

-- =====================================================
-- 6. APPOINTMENTS
-- =====================================================
CREATE TABLE appointments (
    appointment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    end_time TIME,
    duration_minutes INT DEFAULT 30,
    status appointment_status DEFAULT 'pending',
    queue_number INT,
    queue_status queue_status DEFAULT 'waiting',
    symptoms TEXT,
    notes TEXT,
    cancel_reason TEXT,
    cancelled_by UUID REFERENCES users(user_id),
    cancelled_at TIMESTAMPTZ,
    check_in_time TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    end_time_actual TIMESTAMPTZ,
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    payment_amount DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);

-- =====================================================
-- 7. APPOINTMENT SLOTS
-- =====================================================
CREATE TABLE appointment_slots (
    slot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT DEFAULT 30,
    is_available BOOLEAN DEFAULT true,
    is_blocked BOOLEAN DEFAULT false,
    block_reason TEXT,
    appointment_id UUID REFERENCES appointments(appointment_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, date, start_time)
);

-- Indexes
CREATE INDEX idx_appointment_slots_doctor_id ON appointment_slots(doctor_id);
CREATE INDEX idx_appointment_slots_date ON appointment_slots(date);
CREATE INDEX idx_appointment_slots_available ON appointment_slots(doctor_id, date, is_available) WHERE is_available = true;

-- =====================================================
-- 8. QUEUE MANAGEMENT
-- =====================================================
CREATE TABLE queue_management (
    queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    current_queue INT DEFAULT 0,
    waiting_count INT DEFAULT 0,
    completed_count INT DEFAULT 0,
    skipped_count INT DEFAULT 0,
    no_show_count INT DEFAULT 0,
    last_called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, doctor_id, date)
);

-- Indexes
CREATE INDEX idx_queue_management_doctor_date ON queue_management(doctor_id, date);

-- =====================================================
-- 9. MEDICAL RECORDS
-- =====================================================
CREATE TABLE medical_records (
    record_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(doctor_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    chief_complaint TEXT,
    present_illness TEXT,
    physical_exam TEXT,
    vital_signs JSONB, -- {bp_systolic, bp_diastolic, pulse, temp, weight, height}
    diagnosis TEXT,
    treatment_plan TEXT,
    prescription TEXT,
    follow_up_date DATE,
    next_appointment_date DATE,
    notes TEXT,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_medical_records_patient_id ON medical_records(patient_id);
CREATE INDEX idx_medical_records_doctor_id ON medical_records(doctor_id);
CREATE INDEX idx_medical_records_appointment_id ON medical_records(appointment_id);

-- =====================================================
-- 10. PRESCRIPTIONS
-- =====================================================
CREATE TABLE prescriptions (
    prescription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id),
    doctor_id UUID REFERENCES doctors(doctor_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    medications JSONB NOT NULL, -- [{name, dosage, frequency, duration, quantity}]
    notes TEXT,
    is_dispensed BOOLEAN DEFAULT false,
    dispensed_at TIMESTAMPTZ,
    dispensed_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_appointment_id ON prescriptions(appointment_id);

-- =====================================================
-- 11. PAYMENTS
-- =====================================================
CREATE TABLE payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    amount DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    final_amount DECIMAL(10,2) NOT NULL,
    payment_method payment_method,
    payment_status VARCHAR(20) DEFAULT 'pending',
    transaction_id VARCHAR(100),
    transaction_ref VARCHAR(100),
    payment_date TIMESTAMPTZ,
    receipt_url TEXT,
    receipt_number VARCHAR(50),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX idx_payments_patient_id ON payments(patient_id);
CREATE INDEX idx_payments_clinic_id ON payments(clinic_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);

-- =====================================================
-- 12. NOTIFICATIONS
-- =====================================================
CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255),
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    sent_via_line BOOLEAN DEFAULT false,
    line_message_id VARCHAR(100),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =====================================================
-- 13. ARTICLES / NEWS
-- =====================================================
CREATE TABLE articles (
    article_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    excerpt TEXT,
    content TEXT,
    cover_image TEXT,
    category article_category DEFAULT 'health',
    author VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, archived
    published_at TIMESTAMPTZ,
    view_count INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    tags VARCHAR[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, slug)
);

-- Indexes
CREATE INDEX idx_articles_clinic_id ON articles(clinic_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);

-- =====================================================
-- 14. REVIEWS / RATINGS
-- =====================================================
CREATE TABLE reviews (
    review_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(appointment_id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(patient_id),
    doctor_id UUID REFERENCES doctors(doctor_id),
    clinic_id UUID REFERENCES clinics(clinic_id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    service_quality_rating INT CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
    doctor_professionalism_rating INT CHECK (doctor_professionalism_rating >= 1 AND doctor_professionalism_rating <= 5),
    cleanliness_rating INT CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
    waiting_time_rating INT CHECK (waiting_time_rating >= 1 AND waiting_time_rating <= 5),
    comment TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    admin_reply TEXT,
    admin_replied_at TIMESTAMPTZ,
    admin_replied_by UUID REFERENCES users(user_id),
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(appointment_id)
);

-- Indexes
CREATE INDEX idx_reviews_doctor_id ON reviews(doctor_id);
CREATE INDEX idx_reviews_clinic_id ON reviews(clinic_id);
CREATE INDEX idx_reviews_is_visible ON reviews(is_visible);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);

-- =====================================================
-- 15. SUBSCRIPTIONS
-- =====================================================
CREATE TABLE subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    tier subscription_tier NOT NULL,
    status subscription_status DEFAULT 'active',
    billing_cycle billing_cycle DEFAULT 'monthly',
    monthly_price DECIMAL(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    max_doctors INT,
    max_appointments_per_month INT,
    features JSONB DEFAULT '{}',
    auto_renew BOOLEAN DEFAULT true,
    cancelled_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_clinic_id ON subscriptions(clinic_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);

-- =====================================================
-- 16. USAGE LOGS
-- =====================================================
CREATE TABLE usage_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    month DATE NOT NULL,
    year INT NOT NULL,
    appointments_created INT DEFAULT 0,
    appointments_completed INT DEFAULT 0,
    appointments_cancelled INT DEFAULT 0,
    new_patients INT DEFAULT 0,
    messages_sent INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, year, month)
);

-- Indexes
CREATE INDEX idx_usage_logs_clinic_month ON usage_logs(clinic_id, year, month);

-- =====================================================
-- 17. ADMIN LOGS
-- =====================================================
CREATE TABLE admin_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_logs_clinic_id ON admin_logs(clinic_id);
CREATE INDEX idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- =====================================================
-- 18. LINE CONFIGURATION
-- =====================================================
CREATE TABLE line_configs (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    liff_id VARCHAR(100),
    liff_url TEXT,
    channel_id VARCHAR(100),
    channel_secret VARCHAR(100),
    access_token VARCHAR(500),
    rich_menu_id VARCHAR(100),
    rich_menu_image_url TEXT,
    auto_reply_enabled BOOLEAN DEFAULT true,
    greeting_message TEXT,
    flex_templates JSONB DEFAULT '{}',
    webhook_url TEXT,
    webhook_secret VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id)
);

-- Indexes
CREATE INDEX idx_line_configs_clinic_id ON line_configs(clinic_id);

-- =====================================================
-- 19. DOCTOR BLOCKED DATES
-- =====================================================
CREATE TABLE doctor_blocked_dates (
    block_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    block_date DATE NOT NULL,
    block_type block_type DEFAULT 'leave',
    reason TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern VARCHAR(50), -- weekly, monthly, yearly
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(doctor_id, block_date)
);

-- Indexes
CREATE INDEX idx_doctor_blocked_dates_doctor_id ON doctor_blocked_dates(doctor_id);
CREATE INDEX idx_doctor_blocked_dates_block_date ON doctor_blocked_dates(block_date);

-- =====================================================
-- ADDITIONAL TABLES FOR LINE INTEGRATION
-- =====================================================

-- 20. LINE USERS (extended from users table)
CREATE TABLE line_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) UNIQUE NOT NULL, -- LINE userId
    display_name VARCHAR(100),
    picture_url TEXT,
    status_message TEXT,
    followed_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active', -- active, blocked, inactive
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_line_users_user_id ON line_users(user_id);

-- 21. CONVERSATION STATES (for state machine)
CREATE TABLE conversation_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    state_name VARCHAR(50) NOT NULL,
    state_data JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversation_states_user_id ON conversation_states(user_id);
CREATE INDEX idx_conversation_states_expires_at ON conversation_states(expires_at);

-- 22. MESSAGE LOGS (for analytics)
CREATE TABLE message_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50),
    direction VARCHAR(10) CHECK (direction IN ('inbound', 'outbound')),
    message_type VARCHAR(20),
    content JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_message_logs_user_id ON message_logs(user_id);
CREATE INDEX idx_message_logs_created_at ON message_logs(created_at);

-- 23. RICH MENU ASSIGNMENTS
CREATE TABLE rich_menu_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    rich_menu_id VARCHAR(50),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_rich_menu_assignments_user_id ON rich_menu_assignments(user_id);

-- 24. BROADCAST CAMPAIGNS
CREATE TABLE broadcast_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    message_template JSONB NOT NULL,
    target_audience JSONB,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending',
    stats JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_configs_updated_at BEFORE UPDATE ON line_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_users_updated_at BEFORE UPDATE ON line_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate queue number
CREATE OR REPLACE FUNCTION generate_queue_number(
    p_doctor_id UUID,
    p_date DATE
) RETURNS INT AS $$
DECLARE
    v_queue_number INT;
BEGIN
    SELECT COALESCE(MAX(queue_number), 0) + 1
    INTO v_queue_number
    FROM appointments a
    JOIN queue_management q ON q.doctor_id = a.doctor_id AND q.date = a.appointment_date
    WHERE a.doctor_id = p_doctor_id
    AND a.appointment_date = p_date
    AND a.status NOT IN ('cancelled', 'no_show');

    RETURN v_queue_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update queue management
CREATE OR REPLACE FUNCTION update_queue_management()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        INSERT INTO queue_management (
            clinic_id, doctor_id, date, waiting_count
        ) VALUES (
            NEW.clinic_id, NEW.doctor_id, NEW.appointment_date, 1
        )
        ON CONFLICT (clinic_id, doctor_id, date)
        DO UPDATE SET
            waiting_count = queue_management.waiting_count + 1,
            updated_at = NOW();

        -- Generate queue number
        NEW.queue_number := generate_queue_number(NEW.doctor_id, NEW.appointment_date);
    END IF;

    IF NEW.status IN ('completed', 'cancelled', 'no_show')
       AND OLD.status NOT IN ('completed', 'cancelled', 'no_show') THEN

        IF NEW.status = 'completed' THEN
            UPDATE queue_management
            SET completed_count = completed_count + 1,
                waiting_count = GREATEST(waiting_count - 1, 0),
                updated_at = NOW()
            WHERE doctor_id = NEW.doctor_id AND date = NEW.appointment_date;
        ELSIF NEW.status = 'cancelled' THEN
            UPDATE queue_management
            SET cancelled_count = cancelled_count + 1,
                waiting_count = GREATEST(waiting_count - 1, 0),
                updated_at = NOW()
            WHERE doctor_id = NEW.doctor_id AND date = NEW.appointment_date;
        ELSIF NEW.status = 'no_show' THEN
            UPDATE queue_management
            SET no_show_count = no_show_count + 1,
                waiting_count = GREATEST(waiting_count - 1, 0),
                updated_at = NOW()
            WHERE doctor_id = NEW.doctor_id AND date = NEW.appointment_date;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_queue_trigger
    AFTER INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_queue_management();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rich_menu_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_campaigns ENABLE ROW LEVEL SECURITY;

-- USERS RLS
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access users"
    ON users FOR ALL
    USING (auth.role() = 'service_role');

-- PATIENTS RLS
CREATE POLICY "Patients can view own records"
    ON patients FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Patients can update own records"
    ON patients FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access patients"
    ON patients FOR ALL
    USING (auth.role() = 'service_role');

-- APPOINTMENTS RLS
CREATE POLICY "Patients can view own appointments"
    ON appointments FOR SELECT
    USING (
        patient_id IN (
            SELECT patient_id FROM patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Doctors can view clinic appointments"
    ON appointments FOR SELECT
    USING (
        doctor_id IN (
            SELECT doctor_id FROM doctors WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access appointments"
    ON appointments FOR ALL
    USING (auth.role() = 'service_role');

-- Similar RLS policies for other tables...
-- For brevity, using service_role access for initial development

CREATE POLICY "Service role full access clinics"
    ON clinics FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access doctors"
    ON doctors FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access medical_records"
    ON medical_records FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access prescriptions"
    ON prescriptions FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access payments"
    ON payments FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access notifications"
    ON notifications FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access articles"
    ON articles FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access reviews"
    ON reviews FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access subscriptions"
    ON subscriptions FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access usage_logs"
    ON usage_logs FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access admin_logs"
    ON admin_logs FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access line_configs"
    ON line_configs FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access doctor_blocked_dates"
    ON doctor_blocked_dates FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access appointment_slots"
    ON appointment_slots FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access queue_management"
    ON queue_management FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access line_users"
    ON line_users FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access conversation_states"
    ON conversation_states FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access message_logs"
    ON message_logs FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access rich_menu_assignments"
    ON rich_menu_assignments FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access broadcast_campaigns"
    ON broadcast_campaigns FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Today's appointments for a clinic
CREATE VIEW today_appointments AS
SELECT
    a.*,
    p.name AS patient_name,
    p.phone AS patient_phone,
    d.name AS doctor_name,
    c.name AS clinic_name
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
JOIN clinics c ON a.clinic_id = c.clinic_id
WHERE a.appointment_date = CURRENT_DATE;

-- View: Doctor statistics
CREATE VIEW doctor_statistics AS
SELECT
    d.doctor_id,
    d.name AS doctor_name,
    d.specialty,
    d.rating_average,
    d.review_count,
    d.total_patients,
    COUNT(a.appointment_id) FILTER (WHERE a.appointment_date = CURRENT_DATE) AS today_appointments,
    COUNT(a.appointment_id) FILTER (WHERE a.appointment_date = CURRENT_DATE AND a.status = 'completed') AS today_completed
FROM doctors d
LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
GROUP BY d.doctor_id, d.name, d.specialty, d.rating_average, d.review_count, d.total_patients;

-- =====================================================
-- SEED DATA (for testing)
-- =====================================================

-- Insert a demo clinic
INSERT INTO clinics (clinic_id, name, slug, phone, email, province, subscription_tier) VALUES
('00000000-0000-0000-0000-000000000001', 'Demo Clinic', 'demo-clinic', '02-123-4567', 'info@democlinic.com', 'Bangkok', 'pro');

-- Insert admin user
INSERT INTO users (user_id, line_user_id, display_name, role, email) VALUES
('00000000-0000-0000-0000-000000000001', 'U_ADMIN_001', 'Admin User', 'admin', 'admin@clinic.com');

-- =====================================================
-- END OF MIGRATION
-- =====================================================
