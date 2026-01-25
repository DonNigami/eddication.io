/**
 * Driver Performance Scoring System
 * Calculates and tracks driver performance metrics
 *
 * Scoring Categories:
 * - On-Time Delivery: 30%
 * - Customer Rating: 25%
 * - Route Adherence: 20%
 * - Response Time: 10%
 * - Fuel Efficiency: 10%
 * - Safety: 5%
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Performance Weights Configuration
 */
const PERFORMANCE_WEIGHTS = {
  onTimeRate: 0.30,        // 30% weight
  customerRating: 0.25,    // 25% weight
  routeAdherence: 0.20,    // 20% weight
  responseTime: 0.10,      // 10% weight
  fuelEfficiency: 0.10,    // 10% weight
  safety: 0.05             // 5% weight
};

/**
 * Calculate Performance Score
 */
async function calculatePerformanceScore(driverId, period) {
  try {
    // Get metrics for the period
    const metrics = await getDriverMetrics(driverId, period);

    // Calculate individual scores
    const scores = {
      onTimeRate: calculateOnTimeRate(metrics),
      customerRating: calculateCustomerRating(metrics),
      routeAdherence: calculateRouteAdherence(metrics),
      responseTime: calculateResponseTimeScore(metrics),
      fuelEfficiency: calculateFuelEfficiencyScore(metrics),
      safety: calculateSafetyScore(metrics)
    };

    // Calculate weighted overall score
    const overallScore =
      scores.onTimeRate * PERFORMANCE_WEIGHTS.onTimeRate +
      scores.customerRating * PERFORMANCE_WEIGHTS.customerRating +
      scores.routeAdherence * PERFORMANCE_WEIGHTS.routeAdherence +
      scores.responseTime * PERFORMANCE_WEIGHTS.responseTime +
      scores.fuelEfficiency * PERFORMANCE_WEIGHTS.fuelEfficiency +
      scores.safety * PERFORMANCE_WEIGHTS.safety;

    return {
      driverId,
      period,
      overallScore: Math.round(overallScore * 100) / 100,
      scores,
      metrics,
      calculatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error calculating performance score:', error);
    throw error;
  }
}

/**
 * Get Driver Metrics
 */
async function getDriverMetrics(driverId, period) {
  const { startDate, endDate } = getPeriodDates(period);

  // Get completed jobs in period
  const { data: jobs } = await supabase
    .from('jobdata')
    .select('*')
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get driver logs
  const { data: logs } = await supabase
    .from('driver_logs')
    .select('*')
    .eq('driver_liff_id', driverId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  // Get alcohol tests
  const { data: alcoholTests } = await supabase
    .from('alcohol_tests')
    .select('*')
    .eq('driver_id', driverId)
    .gte('tested_at', startDate)
    .lte('tested_at', endDate);

  // Get exceptions
  const { data: exceptions } = await supabase
    .from('job_exceptions')
    .select('*')
    .eq('driver_id', driverId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  return {
    totalJobs: jobs?.length || 0,
    jobs,
    logs: logs?.length || 0,
    logsData: logs,
    alcoholTests: alcoholTests?.length || 0,
    alcoholTestsData: alcoholTests,
    exceptions: exceptions?.length || 0,
    exceptionsData: exceptions
  };
}

/**
 * Calculate On-Time Rate Score
 */
function calculateOnTimeRate(metrics) {
  if (metrics.totalJobs === 0) return 0;

  const onTimeJobs = metrics.jobs.filter(job => {
    if (!job.scheduled_time || !job.actual_delivery_time) return true;

    const scheduled = new Date(job.scheduled_time);
    const actual = new Date(job.actual_delivery_time);
    const delayMinutes = (actual - scheduled) / 60000;

    return delayMinutes <= 15; // Within 15 minutes is considered on-time
  });

  const rate = (onTimeJobs.length / metrics.totalJobs) * 100;
  return Math.min(100, Math.max(0, rate));
}

/**
 * Calculate Customer Rating Score
 */
function calculateCustomerRating(metrics) {
  const ratedJobs = metrics.jobs.filter(job => job.customer_rating);

  if (ratedJobs.length === 0) return 80; // Default score if no ratings

  const avgRating = ratedJobs.reduce((sum, job) => sum + job.customer_rating, 0) / ratedJobs.length;
  return (avgRating / 5) * 100; // Convert 1-5 scale to 0-100
}

/**
 * Calculate Route Adherence Score
 */
function calculateRouteAdherence(metrics) {
  const deviationExceptions = metrics.exceptionsData.filter(e => e.rule_id === 'route_deviation');

  if (metrics.totalJobs === 0) return 0;

  const adherenceRate = 1 - (deviationExceptions.length / metrics.totalJobs);
  return adherenceRate * 100;
}

/**
 * Calculate Response Time Score
 */
function calculateResponseTimeScore(metrics) {
  const checkInLogs = metrics.logsData.filter(log => log.action === 'check_in');

  if (checkInLogs.length === 0) return 80;

  // Calculate average time from job assignment to check-in
  let totalResponseTime = 0;
  let validResponses = 0;

  for (const log of checkInLogs) {
    const job = metrics.jobs.find(j => j.reference === log.reference);
    if (job && job.assigned_at) {
      const assigned = new Date(job.assigned_at);
      const checkedIn = new Date(log.timestamp);
      const responseMinutes = (checkedIn - assigned) / 60000;
      totalResponseTime += responseMinutes;
      validResponses++;
    }
  }

  if (validResponses === 0) return 80;

  const avgResponseMinutes = totalResponseTime / validResponses;

  // Score: < 15 min = 100, > 60 min = 0
  if (avgResponseMinutes <= 15) return 100;
  if (avgResponseMinutes >= 60) return 0;

  return Math.round(100 - ((avgResponseMinutes - 15) / 45) * 100);
}

/**
 * Calculate Fuel Efficiency Score
 */
function calculateFuelEfficiencyScore(metrics) {
  // For now, return default score
  // This would require fuel cost and distance data
  return 75;
}

/**
 * Calculate Safety Score
 */
function calculateSafetyScore(metrics) {
  const passedTests = metrics.alcoholTestsData.filter(t => t.result === 'pass').length;
  const totalTests = metrics.alcoholTests;

  if (totalTests === 0) return 100;

  const testPassRate = (passedTests / totalTests) * 100;

  // Deduct points for safety exceptions
  const safetyExceptions = metrics.exceptionsData.filter(e =>
    ['speeding', 'emergency_button'].includes(e.rule_id)
  );
  const exceptionPenalty = safetyExceptions.length * 20;

  return Math.max(0, testPassRate - exceptionPenalty);
}

/**
 * Get Period Dates
 */
function getPeriodDates(period) {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case 'daily':
      startDate.setHours(0, 0, 0, 0);
      break;

    case 'weekly':
      startDate.setDate(now.getDate() - 7);
      break;

    case 'monthly':
      startDate.setMonth(now.getMonth() - 1);
      break;

    default:
      startDate.setDate(now.getDate() - 1);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: now.toISOString()
  };
}

/**
 * Save Performance Record
 */
async function savePerformanceRecord(performanceData) {
  try {
    const { data, error } = await supabase
      .from('driver_performance')
      .insert({
        driver_id: performanceData.driverId,
        period_type: performanceData.period,
        period_start: new Date(performanceData.calculatedAt),
        period_end: new Date(),
        total_jobs: performanceData.metrics.totalJobs,
        on_time_deliveries: performanceData.metrics.jobs.filter(j => j.on_time).length,
        on_time_rate: performanceData.scores.onTimeRate,
        avg_response_time_minutes: calculateAvgResponseTime(performanceData.metrics),
        customer_rating: performanceData.scores.customerRating,
        route_adherence_score: performanceData.scores.routeAdherence,
        fuel_efficiency_score: performanceData.scores.fuelEfficiency,
        safety_score: performanceData.scores.safety,
        overall_score: performanceData.overallScore
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Performance record saved: ${data.id}`);
    return data;

  } catch (error) {
    console.error('❌ Failed to save performance record:', error);
    throw error;
  }
}

/**
 * Calculate Average Response Time
 */
function calculateAvgResponseTime(metrics) {
  const checkInLogs = metrics.logsData.filter(log => log.action === 'check_in');
  let totalResponseTime = 0;
  let validResponses = 0;

  for (const log of checkInLogs) {
    const job = metrics.jobs.find(j => j.reference === log.reference);
    if (job && job.assigned_at) {
      const assigned = new Date(job.assigned_at);
      const checkedIn = new Date(log.timestamp);
      totalResponseTime += (checkedIn - assigned) / 60000;
      validResponses++;
    }
  }

  return validResponses > 0 ? Math.round(totalResponseTime / validResponses) : 0;
}

/**
 * Get Driver Leaderboard
 */
async function getDriverLeaderboard(period = 'weekly', limit = 10) {
  try {
    const { startDate, endDate } = getPeriodDates(period);

    const { data, error } = await supabase
      .from('driver_performance')
      .select(`
        driver_id,
        overall_score,
        on_time_rate,
        customer_rating,
        period_start,
        user_profiles (
          id,
          full_name,
          picture_url,
          phone
        )
      `)
      .eq('period_type', period)
      .gte('period_start', startDate)
      .order('overall_score', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('❌ Failed to get leaderboard:', error);
    throw error;
  }
}

/**
 * Get Driver Performance History
 */
async function getDriverPerformanceHistory(driverId, limit = 12) {
  try {
    const { data, error } = await supabase
      .from('driver_performance')
      .select('*')
      .eq('driver_id', driverId)
      .order('period_start', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('❌ Failed to get performance history:', error);
    throw error;
  }
}

/**
 * Generate Performance Report
 */
async function generatePerformanceReport(driverId, period) {
  try {
    const performance = await calculatePerformanceScore(driverId, period);
    const history = await getDriverPerformanceHistory(driverId, 4);
    const leaderboard = await getDriverLeaderboard(period, 10);

    const driverRank = leaderboard.findIndex(p => p.driver_id === driverId) + 1;

    return {
      current: performance,
      history,
      leaderboard,
      rank: driverRank || '-',
      totalDrivers: leaderboard.length,
      generatedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Failed to generate performance report:', error);
    throw error;
  }
}

/**
 * Batch Calculate Performance for All Drivers
 * Run this daily/weekly via cron job
 */
async function batchCalculatePerformance(period = 'daily') {
  try {
    console.log(`🔄 Starting batch performance calculation (${period})...`);

    // Get all active drivers
    const { data: drivers } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('role', 'driver')
      .eq('status', 'active');

    if (!drivers || drivers.length === 0) {
      console.log('⚠️  No active drivers found');
      return [];
    }

    const results = [];

    for (const driver of drivers) {
      try {
        const performance = await calculatePerformanceScore(driver.id, period);
        const saved = await savePerformanceRecord(performance);
        results.push(saved);

        console.log(`✅ Calculated performance for driver ${driver.id}: ${performance.overallScore}`);

      } catch (error) {
        console.error(`❌ Failed to calculate performance for ${driver.id}:`, error);
      }
    }

    console.log(`✅ Batch calculation complete: ${results.length} drivers`);
    return results;

  } catch (error) {
    console.error('❌ Batch performance calculation failed:', error);
    throw error;
  }
}

export {
  calculatePerformanceScore,
  savePerformanceRecord,
  getDriverLeaderboard,
  getDriverPerformanceHistory,
  generatePerformanceReport,
  batchCalculatePerformance,
  PERFORMANCE_WEIGHTS
};
