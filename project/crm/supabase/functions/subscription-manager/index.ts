/**
 * Subscription Management Edge Function
 * Handles subscription lifecycle and plan changes
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OMISE_SECRET_KEY = Deno.env.get('OMISE_SECRET_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to send Telegram notification
async function sendTelegramNotification(message: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    })
    const result = await response.json()
    console.log('[Telegram] Notification sent:', result)
    return result
  } catch (error) {
    console.error('[Telegram] Failed to send notification:', error)
  }
}

interface PlanLimits {
  max_users: number
  max_customers: number
  max_broadcasts_per_month: number
}

const PLAN_CONFIGS: Record<string, { price: number; limits: PlanLimits }> = {
  free: {
    price: 0,
    limits: { max_users: 2, max_customers: 500, max_broadcasts_per_month: 1000 }
  },
  starter: {
    price: 990,
    limits: { max_users: 5, max_customers: 5000, max_broadcasts_per_month: 10000 }
  },
  pro: {
    price: 2990,
    limits: { max_users: 20, max_customers: 50000, max_broadcasts_per_month: 100000 }
  },
  enterprise: {
    price: 0, // custom
    limits: { max_users: 999999, max_customers: 999999, max_broadcasts_per_month: 999999 }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json()
    const { action, tenant_id, plan, token_id, cancel_reason } = body

    console.log(`[Subscription] Action: ${action}, Tenant: ${tenant_id}`)

    // ===== CREATE SUBSCRIPTION =====
    if (action === 'create-subscription') {
      const config = PLAN_CONFIGS[plan]
      
      if (!config) {
        throw new Error('Invalid plan')
      }

      // Get tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('billing_email')
        .eq('id', tenant_id)
        .single()

      if (!tenant) {
        throw new Error('Tenant not found')
      }

      let paymentProviderId = null

      // Create payment with Omise (if not free plan)
      if (plan !== 'free' && token_id) {
        // Create Omise customer
        const omiseCustomer = await fetch('https://api.omise.co/customers', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(OMISE_SECRET_KEY + ':')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: tenant.billing_email,
            card: token_id,
            metadata: { tenant_id }
          })
        })

        const customerData = await omiseCustomer.json()
        paymentProviderId = customerData.id

        // Create Omise schedule for recurring payments
        const omiseSchedule = await fetch('https://api.omise.co/schedules', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(OMISE_SECRET_KEY + ':')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            every: 1,
            period: 'month',
            on: { days_of_month: [1] },
            charge: {
              customer: customerData.id,
              amount: config.price * 100, // convert to satang
              currency: 'THB',
              description: `CRM ${plan} subscription - ${tenant_id}`
            }
          })
        })

        const scheduleData = await omiseSchedule.json()
        console.log('[Omise] Schedule created:', scheduleData.id)
      }

      // Create subscription record
      const now = new Date()
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
          tenant_id,
          plan,
          status: plan === 'free' ? 'active' : 'trialing',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_start: plan !== 'free' ? now.toISOString() : null,
          trial_end: plan !== 'free' ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
          payment_provider: 'omise',
          payment_provider_customer_id: paymentProviderId,
          price_per_month: config.price,
          next_payment_date: plan !== 'free' ? periodEnd.toISOString() : null
        })
        .select()
        .single()

      if (subError) throw subError

      // Update tenant
      await supabase
        .from('tenants')
        .update({
          plan,
          subscription_id: subscription.id,
          max_users: config.limits.max_users,
          max_customers: config.limits.max_customers,
          max_broadcasts_per_month: config.limits.max_broadcasts_per_month,
          trial_ends_at: plan !== 'free' ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
          subscription_started_at: now.toISOString()
        })
        .eq('id', tenant_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          subscription,
          message: plan === 'free' ? 'Free plan activated' : 'Trial started - 14 days free'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== CHANGE PLAN =====
    if (action === 'change-plan') {
      const config = PLAN_CONFIGS[plan]
      
      if (!config) {
        throw new Error('Invalid plan')
      }

      // Get current subscription
      const { data: currentSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenant_id)
        .single()

      if (!currentSub) {
        throw new Error('No active subscription found')
      }

      // Update subscription
      await supabase
        .from('subscriptions')
        .update({
          plan,
          price_per_month: config.price,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenant_id)

      // Update tenant limits
      await supabase
        .from('tenants')
        .update({
          plan,
          max_users: config.limits.max_users,
          max_customers: config.limits.max_customers,
          max_broadcasts_per_month: config.limits.max_broadcasts_per_month
        })
        .eq('id', tenant_id)

      // Create invoice for prorated amount (if upgrade)
      // TODO: Calculate proration

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Plan changed to ${plan}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== CANCEL SUBSCRIPTION =====
    if (action === 'cancel-subscription') {
      await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: cancel_reason || 'User requested'
        })
        .eq('tenant_id', tenant_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Subscription will be cancelled at period end' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== REACTIVATE SUBSCRIPTION =====
    if (action === 'reactivate-subscription') {
      await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: false,
          cancelled_at: null,
          cancellation_reason: null,
          status: 'active'
        })
        .eq('tenant_id', tenant_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Subscription reactivated' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== CHECK LIMITS =====
    if (action === 'check-limit') {
      const { limit_type } = body // 'users', 'customers', 'broadcasts'

      // Get tenant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('max_users, max_customers, max_broadcasts_per_month')
        .eq('id', tenant_id)
        .single()

      if (!tenant) {
        throw new Error('Tenant not found')
      }

      let currentCount = 0
      let maxAllowed = 0

      if (limit_type === 'users') {
        const { count } = await supabase
          .from('tenant_users')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant_id)
        currentCount = count || 0
        maxAllowed = tenant.max_users
      } else if (limit_type === 'customers') {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenant_id)
        currentCount = count || 0
        maxAllowed = tenant.max_customers
      } else if (limit_type === 'broadcasts') {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        
        const { data: usage } = await supabase
          .from('usage_metrics')
          .select('metric_value')
          .eq('tenant_id', tenant_id)
          .eq('metric_type', 'broadcasts_sent')
          .gte('period_start', startOfMonth.toISOString())
          .maybeSingle()
        
        currentCount = usage?.metric_value || 0
        maxAllowed = tenant.max_broadcasts_per_month
      }

      const allowed = currentCount < maxAllowed
      const usagePercent = (currentCount / maxAllowed) * 100

      return new Response(
        JSON.stringify({
          allowed,
          current: currentCount,
          max: maxAllowed,
          usage_percent: usagePercent,
          should_upgrade: usagePercent >= 80
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== GET SUBSCRIPTION INFO =====
    if (action === 'get-subscription') {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenant_id)
        .single()

      const { data: tenant } = await supabase
        .from('tenants')
        .select('plan, trial_ends_at')
        .eq('id', tenant_id)
        .single()

      return new Response(
        JSON.stringify({ 
          subscription,
          tenant,
          plan_config: PLAN_CONFIGS[tenant?.plan || 'free']
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== CREATE CUSTOMER SUBSCRIPTION (FOR PACKAGES) =====
    if (action === 'create-customer-subscription') {
      const { package_id, customer_info, slip_url, charge_id, line_user_id } = body

      // Get package details
      const { data: pkg } = await supabase
        .from('subscription_packages')
        .select('*')
        .eq('id', package_id)
        .single()

      if (!pkg) {
        throw new Error('Package not found')
      }

      // Get or create customer
      let customerId = null
      const { data: existingCustomer } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('line_user_id', line_user_id)
        .maybeSingle()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        // Create new customer
        const { data: newCustomer } = await supabase
          .from('profiles')
          .insert({
            line_user_id,
            display_name: customer_info.name,
            phone: customer_info.phone
          })
          .select()
          .single()
        customerId = newCustomer.id
      }

      // Calculate dates
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + 1) // 1 year from now

      // Create subscription record
      const { data: subscription, error: subError } = await supabase
        .from('customer_subscriptions')
        .insert({
          tenant_id: pkg.tenant_id,
          customer_id: customerId,
          package_id,
          status: 'pending',
          payment_status: 'pending',
          payment_method: 'promptpay',
          paid_amount: pkg.price_yearly,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          charge_id,
          payment_slip_url: slip_url,
          metadata: { customer_info }
        })
        .select()
        .single()

      if (subError) throw subError

      // Create payment record
      await supabase
        .from('subscription_payments')
        .insert({
          tenant_id: pkg.tenant_id,
          subscription_id: subscription.id,
          amount: pkg.price_yearly,
          payment_method: 'promptpay',
          status: 'pending',
          slip_url,
          charge_id
        })

      // Send Telegram notification to admin
      const telegramMessage = `
🎉 <b>สมัครสมาชิกใหม่!</b>

👤 <b>ลูกค้า:</b> ${customer_info.name}
📱 <b>เบอร์:</b> ${customer_info.phone}
💎 <b>แพคเกจ:</b> ${pkg.name}
💰 <b>ยอดชำระ:</b> ฿${pkg.price_yearly.toLocaleString()}
📅 <b>อายุ:</b> ${startDate.toLocaleDateString('th-TH')} - ${endDate.toLocaleDateString('th-TH')}

⏳ <b>สถานะ:</b> รอตรวจสอบสลิป
🔗 <b>Charge ID:</b> ${charge_id || '-'}

กรุณาตรวจสอบและอนุมัติการชำระเงิน
      `.trim()

      await sendTelegramNotification(telegramMessage)

      return new Response(
        JSON.stringify({ 
          success: true, 
          subscription,
          message: 'Subscription created, awaiting payment verification'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== VERIFY PAYMENT =====
    if (action === 'verify-payment') {
      const { payment_id, verified_by } = body

      // Get payment details
      const { data: payment } = await supabase
        .from('subscription_payments')
        .select(`
          *,
          customer_subscriptions (
            id,
            customer_id,
            package_id,
            subscription_packages (name, price_yearly)
          )
        `)
        .eq('id', payment_id)
        .single()

      if (!payment) {
        throw new Error('Payment not found')
      }

      // Update payment status
      await supabase
        .from('subscription_payments')
        .update({
          status: 'verified',
          verified_by,
          verified_at: new Date().toISOString()
        })
        .eq('id', payment_id)

      // Update subscription status
      const subscriptionData = payment.customer_subscriptions as any
      await supabase
        .from('customer_subscriptions')
        .update({
          status: 'active',
          payment_status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', subscriptionData.id)

      // Update customer profile
      await supabase
        .from('profiles')
        .update({
          is_subscriber: true,
          current_package_id: subscriptionData.package_id,
          subscription_expires_at: subscriptionData.end_date
        })
        .eq('id', subscriptionData.customer_id)

      // Send Telegram notification
      const telegramMessage = `
✅ <b>ยืนยันการชำระเงินสำเร็จ!</b>

💎 <b>แพคเกจ:</b> ${subscriptionData.subscription_packages.name}
💰 <b>ยอดเงิน:</b> ฿${payment.amount.toLocaleString()}
✅ <b>สถานะ:</b> เปิดใช้งานแล้ว

ระบบได้เปิดใช้งานสมาชิกให้ลูกค้าเรียบร้อยแล้ว
      `.trim()

      await sendTelegramNotification(telegramMessage)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment verified and subscription activated'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== CREATE PROMPTPAY CHARGE =====
    if (action === 'create-promptpay-charge') {
      const { amount, phone, description } = body

      try {
        const response = await fetch('https://api.omise.co/charges', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(OMISE_SECRET_KEY + ':')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: amount * 100, // convert to satang
            currency: 'THB',
            source: {
              type: 'promptpay'
            },
            description,
            metadata: { phone }
          })
        })

        const charge = await response.json()

        if (charge.failure_code) {
          throw new Error(charge.failure_message || 'Failed to create charge')
        }

        return new Response(
          JSON.stringify({
            success: true,
            charge_id: charge.id,
            qr_code_url: charge.source?.scannable_code?.image?.download_uri,
            expires_at: charge.expires_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (err) {
        return new Response(
          JSON.stringify({ error: (err as Error).message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ===== CHECK PROMPTPAY STATUS =====
    if (action === 'check-promptpay-status') {
      const { charge_id } = body

      try {
        const response = await fetch(`https://api.omise.co/charges/${charge_id}`, {
          headers: {
            'Authorization': `Basic ${btoa(OMISE_SECRET_KEY + ':')}`
          }
        })

        const charge = await response.json()

        return new Response(
          JSON.stringify({
            success: true,
            paid: charge.paid,
            status: charge.status,
            amount: charge.amount / 100
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (err) {
        return new Response(
          JSON.stringify({ error: (err as Error).message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Subscription] Error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
