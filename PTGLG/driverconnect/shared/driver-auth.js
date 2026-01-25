/**
 * Driver Identity Verification for LIFF-based Authentication
 *
 * Since DriverConnect uses LIFF ID as user identifier WITHOUT Supabase Auth,
 * auth.role() = 'anon' always. RLS policies are permissive (WITH CHECK (true)),
 * so we must enforce ownership at the APPLICATION LAYER.
 *
 * This class provides:
 * 1. Driver approval status verification
 * 2. Audit trail logging
 * 3. Optional: Job access control (if database supports it)
 */

import { supabase as supabaseClient } from './config.js';

/**
 * Driver Approval Status Constants
 */
export const ApprovalStatus = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED'
};

/**
 * Configuration flags for DriverAuth behavior
 */
export const DriverAuthConfig = {
    /**
     * Bypass job access checks (verifyJobAccess, verifyCheckInAccess, etc.)
     * Set to true when database doesn't support driver-to-job assignment.
     * When true, any approved driver can access any job.
     */
    BYPASS_JOB_ACCESS_CHECK: true,

    /**
     * Enable audit logging for all driver actions
     */
    ENABLE_AUDIT_LOG: true
};

/**
 * DriverAuth - Application-layer auth verification
 */
export class DriverAuth {
    /**
     * Check if a user (by LINE User ID) is approved to use the system.
     * This is the primary approval check function.
     *
     * @param {string} lineUserId - The user's LINE User ID
     * @returns {Promise<boolean>} - True if user is approved
     */
    static async isUserApproved(lineUserId) {
        if (!lineUserId) {
            console.warn('⚠️ DriverAuth: Missing lineUserId for approval check');
            return false;
        }

        try {
            const supabase = supabaseClient;

            // Option 1: Use the database function (recommended)
            const { data, error } = await supabase
                .rpc('is_user_approved', { p_user_id: lineUserId });

            if (error) {
                // Fallback: Direct query if function doesn't exist yet
                const { data: profile, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('status')
                    .eq('user_id', lineUserId)
                    .maybeSingle();

                if (profileError) {
                    console.error('❌ DriverAuth.isUserApproved error:', profileError);
                    return false;
                }

                const isApproved = profile?.status === ApprovalStatus.APPROVED;
                if (!isApproved) {
                    console.warn(`⚠️ DriverAuth: User ${lineUserId} status is ${profile?.status || 'unknown'}`);
                }
                return isApproved;
            }

            return data === true;
        } catch (err) {
            console.error('❌ DriverAuth.isUserApproved exception:', err);
            return false;
        }
    }

    /**
     * Get user profile including approval status.
     * Returns null if user not found.
     *
     * @param {string} lineUserId - The user's LINE User ID
     * @returns {Promise<Object|null>} - User profile or null
     */
    static async getUserProfile(lineUserId) {
        if (!lineUserId) {
            console.warn('⚠️ DriverAuth: Missing lineUserId for profile fetch');
            return null;
        }

        try {
            const supabase = supabaseClient;

            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', lineUserId)
                .maybeSingle();

            if (error) {
                console.error('❌ DriverAuth.getUserProfile error:', error);
                return null;
            }

            return data;
        } catch (err) {
            console.error('❌ DriverAuth.getUserProfile exception:', err);
            return null;
        }
    }

    /**
     * Create or update user profile on LIFF login.
     * Tracks first_seen_at and total_visits.
     *
     * @param {Object} liffProfile - LIFF profile object { userId, displayName, pictureUrl, statusMessage }
     * @returns {Promise<Object>} - Created/updated profile
     */
    static async registerUser(liffProfile) {
        if (!liffProfile?.userId) {
            console.error('❌ DriverAuth: Invalid LIFF profile');
            return null;
        }

        try {
            const supabase = supabaseClient;

            // First, try to get existing profile
            const existing = await this.getUserProfile(liffProfile.userId);

            if (existing) {
                // Update last_seen and total_visits
                const { data, error } = await supabase
                    .from('user_profiles')
                    .update({
                        last_seen_at: new Date().toISOString(),
                        total_visits: (existing.total_visits || 0) + 1,
                        display_name: liffProfile.displayName || existing.display_name,
                        picture_url: liffProfile.pictureUrl || existing.picture_url,
                        status_message: liffProfile.statusMessage || existing.status_message
                    })
                    .eq('user_id', liffProfile.userId)
                    .select()
                    .single();

                if (error) {
                    console.error('❌ DriverAuth.registerUser update error:', error);
                    return existing;
                }
                return data;
            }

            // Create new profile (status defaults to PENDING in DB, but we set explicitly here)
            const { data, error } = await supabase
                .from('user_profiles')
                .insert({
                    user_id: liffProfile.userId,
                    display_name: liffProfile.displayName,
                    picture_url: liffProfile.pictureUrl,
                    status_message: liffProfile.statusMessage,
                    first_seen_at: new Date().toISOString(),
                    last_seen_at: new Date().toISOString(),
                    total_visits: 1,
                    status: ApprovalStatus.PENDING, // New users need approval
                    user_type: 'DRIVER'
                })
                .select()
                .single();

            if (error) {
                console.error('❌ DriverAuth.registerUser insert error:', error);
                return null;
            }

            console.log(`✅ DriverAuth: New user registered - ${liffProfile.userId} (status: PENDING)`);
            return data;
        } catch (err) {
            console.error('❌ DriverAuth.registerUser exception:', err);
            return null;
        }
    }

    /**
     * Log audit trail for driver actions.
     * Used to track who did what for accountability.
     *
     * @param {string} lineUserId - The user's LINE User ID
     * @param {string} reference - Job reference
     * @param {string} action - Action performed (search, checkin, checkout, etc.)
     * @param {Object} details - Additional details
     * @param {Object} location - GPS location {lat, lng}
     * @returns {Promise<boolean>} - True if logged successfully
     */
    static async logAudit(lineUserId, userName, reference, action, details = null, location = null) {
        if (!lineUserId) {
            console.warn('⚠️ DriverAuth: Missing lineUserId for audit log');
            return false;
        }

        try {
            const supabase = supabaseClient;

            const { error } = await supabase
                .from('driver_logs')
                .insert({
                    user_id: lineUserId,
                    user_name: userName,
                    reference: reference,
                    action: action,
                    details: details,
                    location: location
                });

            if (error) {
                console.error('❌ DriverAuth.logAudit error:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('❌ DriverAuth.logAudit exception:', err);
            return false;
        }
    }

    /**
     * Get approval status message for UI display.
     *
     * @param {string} status - Status value from user_profiles
     * @returns {string} - User-friendly message
     */
    static getStatusMessage(status) {
        switch (status) {
            case ApprovalStatus.APPROVED:
                return null; // No message needed for approved users
            case ApprovalStatus.PENDING:
                return '⏳ บัญชีของคุณอยู่ระหว่างการตรวจสอบ\nกรุณาติดต่อผู้ดูแลระบบ';
            case ApprovalStatus.REJECTED:
                return '❌ บัญชีของคุณไม่ได้รับอนุมัติ\nกรุณาติดต่อผู้ดูแลระบบ';
            default:
                return '⚠️ สถานะบัญชีไม่ชัดเจน\nกรุณาติดต่อผู้ดูแลระบบ';
        }
    }

    /**
     * Verify that the current driver (by LIFF ID) is assigned to this job.
     * NOTE: This check is bypassed when BYPASS_JOB_ACCESS_CHECK = true
     * (which is the case when database doesn't support driver-to-job assignment).
     *
     * @param {string} liffId - The driver's LIFF ID
     * @param {string} reference - Job reference number
     * @returns {Promise<boolean>} - True if driver can access this job
     */
    static async verifyJobAccess(liffId, reference) {
        // Bypass job access check if configured
        if (DriverAuthConfig.BYPASS_JOB_ACCESS_CHECK) {
            console.log('✅ DriverAuth: Job access check bypassed (config)');
            return true;
        }

        if (!liffId || !reference) {
            console.warn('⚠️ DriverAuth: Missing liffId or reference');
            return false;
        }

        try {
            const supabase = supabaseClient;

            // Check if driver_jobs has this driver assigned to this reference
            const { data, error } = await supabase
                .from('driver_jobs')
                .select('id')
                .eq('reference', reference)
                .eq('driver_liff_id', liffId)
                .maybeSingle();

            if (error) {
                console.error('❌ DriverAuth.verifyJobAccess error:', error);
                return false;
            }

            const hasAccess = !!data;
            if (!hasAccess) {
                console.warn(`⚠️ DriverAuth: LIFF ID ${liffId} not assigned to reference ${reference}`);
            }

            return hasAccess;
        } catch (err) {
            console.error('❌ DriverAuth.verifyJobAccess exception:', err);
            return false;
        }
    }

    /**
     * Verify that the current driver (by LIFF ID) can check-in to a specific stop.
     * Checks both job assignment and optionally verifies the stop belongs to the job.
     *
     * @param {string} liffId - The driver's LIFF ID
     * @param {string} reference - Job reference number
     * @param {string|null} shipToCode - Optional ship_to_code for stop-level verification
     * @returns {Promise<boolean>} - True if driver can check-in to this stop
     */
    static async verifyCheckInAccess(liffId, reference, shipToCode = null) {
        // First verify job access
        const hasJobAccess = await this.verifyJobAccess(liffId, reference);
        if (!hasJobAccess) {
            return false;
        }

        // If shipToCode provided, verify stop belongs to this job
        if (shipToCode) {
            try {
                const supabase = supabaseClient;
                const { data, error } = await supabase
                    .from('jobdata')
                    .select('id')
                    .eq('reference', reference)
                    .eq('ship_to_code', shipToCode)
                    .maybeSingle();

                if (error || !data) {
                    console.warn(`⚠️ DriverAuth: ShipToCode ${shipToCode} not found in reference ${reference}`);
                    return false;
                }
            } catch (err) {
                console.error('❌ DriverAuth.verifyCheckInAccess exception:', err);
                return false;
            }
        }

        return true;
    }

    /**
     * Verify that the current driver (by LIFF ID) owns this user profile.
     * Used before profile update operations.
     *
     * @param {string} liffId - The driver's LIFF ID
     * @param {string} profileId - UUID of the user profile
     * @returns {Promise<boolean>} - True if profile belongs to this driver
     */
    static async verifyProfileOwnership(liffId, profileId) {
        if (!liffId || !profileId) {
            console.warn('⚠️ DriverAuth: Missing liffId or profileId');
            return false;
        }

        try {
            const supabase = supabaseClient;

            const { data, error } = await supabase
                .from('user_profiles')
                .select('user_id')
                .eq('id', profileId)
                .single();

            if (error) {
                console.error('❌ DriverAuth.verifyProfileOwnership error:', error);
                return false;
            }

            // In LIFF auth, user_id IS the liffId
            const hasOwnership = data?.user_id === liffId;

            if (!hasOwnership) {
                console.warn(`⚠️ DriverAuth: Profile ${profileId} does not belong to LIFF ID ${liffId}`);
            }

            return hasOwnership;
        } catch (err) {
            console.error('❌ DriverAuth.verifyProfileOwnership exception:', err);
            return false;
        }
    }

    /**
     * Verify that the driver can submit an alcohol test for this job.
     * Checks if the driver is assigned to any job with this reference.
     *
     * @param {string} liffId - The driver's LIFF ID
     * @param {string} reference - Job reference number
     * @returns {Promise<boolean>} - True if driver can submit alcohol test
     */
    static async verifyAlcoholTestAccess(liffId, reference) {
        // Alcohol test access uses the same verification as job access
        return await this.verifyJobAccess(liffId, reference);
    }

    /**
     * Get all jobs assigned to a driver by LIFF ID.
     * Used for loading the driver's job list.
     *
     * @param {string} liffId - The driver's LIFF ID
     * @returns {Promise<Array>} - Array of assigned jobs
     */
    static async getDriverJobs(liffId) {
        if (!liffId) {
            console.warn('⚠️ DriverAuth: Missing liffId');
            return [];
        }

        try {
            const supabase = supabaseClient;

            const { data, error } = await supabase
                .from('driver_jobs')
                .select('*')
                .eq('driver_liff_id', liffId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ DriverAuth.getDriverJobs error:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('❌ DriverAuth.getDriverJobs exception:', err);
            return [];
        }
    }

    /**
     * Authorization error message for UI display
     */
    static getUnauthorizedMessage() {
        return '⚠️ คุณไม่มีสิทธิ์ดำเนินการกับงานนี้\nกรุณาติดต่อผู้ดูแลระบบ';
    }
}

/**
 * Hook: Wraps API calls with ownership verification.
 * Returns unauthorized response if verification fails.
 *
 * @param {Function} verificationFn - The verification function to call
 * @param {Function} apiFn - The API function to execute if verified
 * @returns {Promise<Object>} - API response or unauthorized error
 */
export async function withAuthCheck(verificationFn, apiFn) {
    const isAuthorized = await verificationFn();

    if (!isAuthorized) {
        return {
            success: false,
            message: DriverAuth.getUnauthorizedMessage(),
            unauthorized: true
        };
    }

    return await apiFn();
}
