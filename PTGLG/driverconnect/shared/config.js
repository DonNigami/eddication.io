// PTGLG/driverconnect/shared/config.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const SUPABASE_URL = 'https://myplpshpcordggbbtblg.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8';

// Singleton Supabase client for use across all modules
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const LIFF_IDS = {
    ADMIN: '2007705394-Lq3mMYKA', // PTGLG/driverconnect/admin/admin.js
    APP: '2007705394-y4mV76Gv',   // PTGLG/driverconnect/app/index.html
    DRIVER_APP: '2007705394-Fgx9wdHu', // PTGLG/driverconnect/driverapp/js/config.js and others
    DRIVER_APP_INDEX: '2007705394-NGJXjBkn', // PTGLG/driverconnect/driverapp/index.html
    WAWA_TRUCK_STATUS: '2007213966-9K5wX5Ag', // wawa2559/truckstatus/admin.html
    UAT_REGISTER: '2007368597-78MQkENk', // uat/register/index.html
    CAR_RENTAL: '2007118277-20aJg5rX', // project/demo/carrental/rental.html
    CRM_INDEX: '2006397073-kK6uCiwf', // project/crm/index.html
    CRM_TEST: '2006397073-3wO44G35', // project/crm/test.html
};
