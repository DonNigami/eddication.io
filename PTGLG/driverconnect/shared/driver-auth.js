/**
 * Driver Identity Verification for LIFF-based Authentication
 *
 * Since DriverConnect uses LIFF ID as user identifier WITHOUT Supabase Auth,
 * auth.role() = 'anon' always. RLS policies are permissive (WITH CHECK (true)),
 * so we must enforce ownership at the APPLICATION LAYER.
 *
 * This class provides verification methods to ensure drivers can only access
 * their own assigned jobs and data.
 */

import { getSupabase } from './config.js';

/**
 * DriverAuth - Application-layer ownership verification
 */
export class DriverAuth {
    /**
     * Verify that the current driver (by LIFF ID) is assigned to this job.
     * Used before check-in, check-out, and other job operations.
     *
     * @param {string} liffId - The driver's LIFF ID
     * @param {string} reference - Job reference number
     * @returns {Promise<boolean>} - True if driver owns this job
     */
    static async verifyJobAccess(liffId, reference) {
        if (!liffId || !reference) {
            console.warn('⚠️ DriverAuth: Missing liffId or reference');
            return false;
        }

        try {
            const supabase = getSupabase();

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
                const supabase = getSupabase();
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
            const supabase = getSupabase();

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
            const supabase = getSupabase();

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
