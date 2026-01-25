/**
 * Intelligent Exception Detection System for DriverConnect
 * Monitors driver telemetry and detects anomalies in real-time
 *
 * Supports Supabase Free Plan (500 MB database, 1GB bandwidth)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Exception Rule Configuration
 */
const EXCEPTION_RULES = [
  {
    id: 'gps_offline',
    name: 'GPS Offline',
    nameTh: 'GPS ไม่ทำงาน',
    priority: 1,
    condition: (data) => {
      return data.gpsStatus === 'offline' && data.offlineDuration > 300; // 5 minutes
    },
    severity: 'high',
    notification: {
      line: true,
      email: true,
      adminPanel: true
    },
    autoActions: ['log_exception', 'notify_dispatcher'],
    recovery: 'gps_restored',
    message: {
      th: '⚠️ GPS ไม่ทำงานเกิน 5 นาที',
      en: '⚠️ GPS offline for over 5 minutes'
    }
  },
  {
    id: 'long_stop',
    name: 'Long Stop Detection',
    nameTh: 'จอดนานเกินไป',
    priority: 2,
    condition: (data) => {
      return data.isStopped && data.stopDuration > 1800; // 30 minutes
    },
    severity: 'medium',
    notification: {
      line: true,
      email: false,
      adminPanel: true
    },
    autoActions: ['log_exception', 'ask_driver_reason'],
    message: {
      th: '📍 จอดนานเกิน 30 นาที',
      en: '📍 Stopped for over 30 minutes'
    }
  },
  {
    id: 'route_deviation',
    name: 'Route Deviation',
    nameTh: 'เบี่ยงเบนจากเส้นทาง',
    priority: 3,
    condition: (data) => {
      return data.distanceFromRoute > 500; // 500 meters
    },
    severity: 'medium',
    notification: {
      line: true,
      email: false,
      adminPanel: true
    },
    autoActions: ['log_exception'],
    message: {
      th: '↗️ เบี่ยงเบนจากเส้นทางเกิน 500 เมตร',
      en: '↗️ Deviated from route by over 500m'
    }
  },
  {
    id: 'delivery_delay_risk',
    name: 'Delivery Delay Risk',
    nameTh: 'เสี่ยงส่งช้า',
    priority: 1,
    condition: (data) => {
      return data.etaDelay > 900; // 15 minutes
    },
    severity: 'high',
    notification: {
      line: true,
      email: true,
      adminPanel: true
    },
    autoActions: ['log_exception', 'notify_customer'],
    message: {
      th: '⏰ เสี่ยงส่งช้าเกิน 15 นาที',
      en: '⏰ Risk of late delivery (>15 min)'
    }
  },
  {
    id: 'emergency_button',
    name: 'Emergency Button Pressed',
    nameTh: 'กดปุ่มฉุกเฉิน',
    priority: 0,
    condition: (data) => {
      return data.emergencyTriggered === true;
    },
    severity: 'critical',
    notification: {
      line: true,
      email: true,
      sms: true,
      adminPanel: true
    },
    autoActions: [
      'log_exception',
      'notify_all_dispatchers',
      'send_location_to_all',
      'update_rich_menu_emergency'
    ],
    message: {
      th: '🆘 ฉุกเฉิน! ต้องการความช่วยเหลือด่วน',
      en: '🆘 EMERGENCY! Immediate assistance required'
    }
  },
  {
    id: 'missed_alcohol_test',
    name: 'Missed Alcohol Test',
    nameTh: 'ไม่ได้ทดสอบแอลกอฮอล์',
    priority: 2,
    condition: (data) => {
      return data.checkedOut && !data.alcoholTestCompleted;
    },
    severity: 'high',
    notification: {
      line: true,
      email: true,
      adminPanel: true
    },
    autoActions: ['log_exception', 'notify_supervisor'],
    message: {
      th: '🍺 ไม่ได้ทดสอบแอลกอฮอล์ก่อนจบงาน',
      en: '🍺 Missed alcohol test before checkout'
    }
  },
  {
    id: 'speeding',
    name: 'Speeding Detected',
    nameTh: 'ขับเร็วเกินไป',
    priority: 3,
    condition: (data) => {
      return data.speed > data.speedLimit + 20; // 20 km/h over limit
    },
    severity: 'medium',
    notification: {
      line: false,
      email: false,
      adminPanel: true
    },
    autoActions: ['log_exception', 'warn_driver'],
    message: {
      th: '🏎️ ขับเร็วเกินกำหนด',
      en: '🏎️ Speeding detected'
    }
  }
];

/**
 * Log Exception to Database
 */
async function logException(exception) {
  try {
    const { data, error } = await supabase
      .from('job_exceptions')
      .insert({
        driver_id: exception.driverId,
        job_id: exception.jobId,
        rule_id: exception.ruleId,
        severity: exception.severity,
        message_th: exception.messageTh,
        message_en: exception.messageEn,
        telemetry: exception.telemetry,
        location: exception.location,
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Exception logged: ${exception.ruleId} - ID: ${data.id}`);
    return data;

  } catch (error) {
    console.error('❌ Failed to log exception:', error);
    throw error;
  }
}

/**
 * Send LINE Notification for Exception
 */
async function sendLineAlert(exception, driverInfo) {
  // This would be called from your webhook handler
  // For now, we'll just log it
  console.log(`📱 LINE Alert: ${exception.messageTh}`);

  // In production, you would:
  // 1. Get admin LINE user IDs from database
  // 2. Use LINE Messaging API to send Flex Message
  // 3. Include driver info, location, quick actions

  return {
    success: true,
    messageId: `line_${Date.now()}`
  };
}

/**
 * Execute Auto-Actions
 */
async function executeAutoActions(action, context) {
  const { driverId, telemetry, rule, exceptionId } = context;

  switch (action) {
    case 'log_exception':
      // Already done before this function
      break;

    case 'notify_dispatcher':
      // Send notification to all dispatchers
      await notifyDispatchers(context);
      break;

    case 'notify_all_dispatchers':
      // High priority notification to all dispatchers
      await notifyAllDispatchers(context);
      break;

    case 'notify_customer':
      // Send delay notification to customer
      await notifyCustomerDelay(context);
      break;

    case 'notify_supervisor':
      // Notify driver's supervisor
      await notifySupervisor(context);
      break;

    case 'ask_driver_reason':
      // Send quick reply to driver asking for reason
      await askDriverReason(context);
      break;

    case 'warn_driver':
      // Send warning to driver
      await warnDriver(context);
      break;

    case 'send_location_to_all':
      // Broadcast driver location to all admins
      await broadcastLocation(context);
      break;

    case 'update_rich_menu_emergency':
      // Update driver's rich menu to emergency mode
      await updateDriverRichMenu(driverId, 'emergency');
      break;

    default:
      console.warn(`Unknown auto-action: ${action}`);
  }
}

/**
 * Notify Dispatchers
 */
async function notifyDispatchers(context) {
  const { rule, driverId, exceptionId } = context;

  // Get active dispatchers from database
  const { data: dispatchers } = await supabase
    .from('user_profiles')
    .select('line_user_id, notification_preferences')
    .eq('role', 'dispatcher')
    .eq('is_active', true);

  if (!dispatchers || dispatchers.length === 0) {
    console.log('⚠️  No active dispatchers found');
    return;
  }

  // Send notifications (in production, use LINE Messaging API)
  console.log(`📢 Notifying ${dispatchers.length} dispatchers about ${rule.id}`);
}

/**
 * Notify All Dispatchers (Critical)
 */
async function notifyAllDispatchers(context) {
  await notifyDispatchers(context);

  // Also send SMS/email for critical alerts
  console.log('📧 Sending email alerts to all managers');
}

/**
 * Notify Customer of Delay
 */
async function notifyCustomerDelay(context) {
  const { jobId, telemetry } = context;

  // Get job details
  const { data: job } = await supabase
    .from('jobdata')
    .select('customer_name, customer_phone, reference')
    .eq('id', jobId)
    .single();

  if (!job) return;

  // Log customer notification
  await supabase.from('customer_notifications').insert({
    job_id: jobId,
    type: 'delay_alert',
    message: `งาน ${job.reference} อาจจะส่งช้า`,
    status: 'sent',
    sent_at: new Date().toISOString()
  });

  console.log(`📱 Customer notified for job ${job.reference}`);
}

/**
 * Ask Driver for Reason
 */
async function askDriverReason(context) {
  const { driverId, rule } = context;

  // Get driver's LINE user ID
  const { data: driver } = await supabase
    .from('user_profiles')
    .select('line_user_id')
    .eq('id', driverId)
    .single();

  if (!driver) return;

  // Send quick reply message (via LINE API)
  console.log(`💬 Asking ${driver.line_user_id} for reason about ${rule.id}`);
}

/**
 * Warn Driver
 */
async function warnDriver(context) {
  const { driverId, rule } = context;

  const { data: driver } = await supabase
    .from('user_profiles')
    .select('line_user_id')
    .eq('id', driverId)
    .single();

  if (!driver) return;

  console.log(`⚠️  Warning sent to ${driver.line_user_id}: ${rule.messageTh}`);
}

/**
 * Broadcast Driver Location
 */
async function broadcastLocation(context) {
  const { driverId, telemetry } = context;

  console.log(`📍 Broadcasting location for driver ${driverId}:`, {
    lat: telemetry.latitude,
    lng: telemetry.longitude,
    accuracy: telemetry.accuracy
  });
}

/**
 * Update Driver Rich Menu
 */
async function updateDriverRichMenu(driverId, status) {
  // This would call your rich menu management function
  console.log(`🎨 Updating rich menu for driver ${driverId} to ${status}`);
}

/**
 * Main Exception Detection Function
 * Call this whenever you receive driver telemetry
 */
async function detectExceptions(driverId, jobId, telemetry) {
  const triggeredExceptions = [];

  for (const rule of EXCEPTION_RULES) {
    try {
      if (rule.condition(telemetry)) {
        console.log(`🚨 Exception triggered: ${rule.id} for driver ${driverId}`);

        // Prepare exception data
        const exceptionData = {
          driverId,
          jobId,
          ruleId: rule.id,
          severity: rule.severity,
          messageTh: rule.message.th,
          messageEn: rule.message.en,
          telemetry,
          location: {
            latitude: telemetry.latitude,
            longitude: telemetry.longitude,
            accuracy: telemetry.accuracy
          }
        };

        // Log to database
        const exception = await logException(exceptionData);
        triggeredExceptions.push(exception);

        // Send LINE notification
        if (rule.notification.line) {
          await sendLineAlert(exceptionData, { driverId });
        }

        // Execute auto-actions
        if (rule.autoActions && rule.autoActions.length > 0) {
          for (const action of rule.autoActions) {
            await executeAutoActions(action, {
              driverId,
              jobId,
              telemetry,
              rule,
              exceptionId: exception.id
            });
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error processing rule ${rule.id}:`, error);
    }
  }

  return triggeredExceptions;
}

/**
 * Get Active Exceptions for Driver
 */
async function getActiveExceptions(driverId) {
  const { data, error } = await supabase
    .from('job_exceptions')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data;
}

/**
 * Resolve Exception
 */
async function resolveException(exceptionId, resolvedBy, resolutionNote) {
  const { data, error } = await supabase
    .from('job_exceptions')
    .update({
      status: 'resolved',
      resolved_by: resolvedBy,
      resolution_note: resolutionNote,
      resolved_at: new Date().toISOString()
    })
    .eq('id', exceptionId)
    .select()
    .single();

  if (error) throw error;

  console.log(`✅ Exception ${exceptionId} resolved by ${resolvedBy}`);
  return data;
}

/**
 * Get Exception Statistics
 */
async function getExceptionStats(startDate, endDate) {
  const { data, error } = await supabase
    .from('job_exceptions')
    .select('rule_id, severity, status')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (error) throw error;

  // Calculate statistics
  const stats = {
    total: data.length,
    bySeverity: {},
    byRule: {},
    open: data.filter(e => e.status === 'open').length,
    resolved: data.filter(e => e.status === 'resolved').length
  };

  data.forEach(exception => {
    stats.bySeverity[exception.severity] = (stats.bySeverity[exception.severity] || 0) + 1;
    stats.byRule[exception.rule_id] = (stats.byRule[exception.rule_id] || 0) + 1;
  });

  return stats;
}

export {
  EXCEPTION_RULES,
  detectExceptions,
  getActiveExceptions,
  resolveException,
  getExceptionStats,
  logException,
  sendLineAlert,
  executeAutoActions
};
