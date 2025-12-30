/**
 * Tenant Management Edge Function
 * Handles tenant creation, user management, and onboarding
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json()
    const { action } = body

    console.log(`[Tenant] Action: ${action}`)

    // ===== CREATE TENANT =====
    if (action === 'create-tenant') {
      const { name, subdomain, admin_email, admin_line_id, plan = 'free' } = body

      // Check if subdomain is available
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('subdomain', subdomain)
        .maybeSingle()

      if (existing) {
        throw new Error('Subdomain already taken')
      }

      // Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name,
          subdomain,
          billing_email: admin_email,
          plan,
          status: 'active',
          max_users: plan === 'free' ? 2 : plan === 'starter' ? 5 : 20,
          max_customers: plan === 'free' ? 500 : plan === 'starter' ? 5000 : 50000,
          max_broadcasts_per_month: plan === 'free' ? 1000 : plan === 'starter' ? 10000 : 100000,
          trial_ends_at: plan !== 'free' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() : null,
          settings: {
            features: {
              crm: true,
              segments: true,
              broadcasts: true,
              analytics: plan !== 'free',
              api_access: plan !== 'free',
              automation: plan === 'pro' || plan === 'enterprise',
              white_label: plan === 'enterprise',
              priority_support: plan === 'pro' || plan === 'enterprise'
            }
          }
        })
        .select()
        .single()

      if (tenantError) throw tenantError

      // Create admin user
      const { error: userError } = await supabase
        .from('tenant_users')
        .insert({
          tenant_id: tenant.id,
          line_user_id: admin_line_id,
          email: admin_email,
          role: 'admin',
          status: 'active'
        })

      if (userError) throw userError

      // Create default API key
      const apiKey = `crm_${tenant.id.slice(0, 8)}_${crypto.randomUUID().slice(0, 16)}`
      
      await supabase
        .from('tenant_api_keys')
        .insert({
          tenant_id: tenant.id,
          key_name: 'Default API Key',
          api_key: apiKey,
          is_active: true
        })

      return new Response(
        JSON.stringify({
          success: true,
          tenant,
          api_key: apiKey,
          onboarding_url: `https://${subdomain}.crmpro.app/onboarding`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== INVITE USER =====
    if (action === 'invite-user') {
      const { tenant_id, email, role = 'member', line_user_id } = body

      // Check user limit
      const { data: tenant } = await supabase
        .from('tenants')
        .select('max_users')
        .eq('id', tenant_id)
        .single()

      const { count: currentUsers } = await supabase
        .from('tenant_users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)

      if (currentUsers && tenant && currentUsers >= tenant.max_users) {
        throw new Error('User limit reached. Please upgrade your plan.')
      }

      // Create user invitation
      const { data: user, error: userError } = await supabase
        .from('tenant_users')
        .insert({
          tenant_id,
          email,
          line_user_id,
          role,
          status: 'invited'
        })
        .select()
        .single()

      if (userError) throw userError

      // TODO: Send invitation email via LINE Notify or email service

      return new Response(
        JSON.stringify({
          success: true,
          user,
          message: 'Invitation sent'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== ACCEPT INVITATION =====
    if (action === 'accept-invitation') {
      const { tenant_id, line_user_id } = body

      await supabase
        .from('tenant_users')
        .update({ status: 'active' })
        .eq('tenant_id', tenant_id)
        .eq('line_user_id', line_user_id)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invitation accepted'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== UPDATE USER ROLE =====
    if (action === 'update-user-role') {
      const { tenant_id, user_id, role } = body

      await supabase
        .from('tenant_users')
        .update({ role })
        .eq('tenant_id', tenant_id)
        .eq('id', user_id)

      return new Response(
        JSON.stringify({
          success: true,
          message: `Role updated to ${role}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== REMOVE USER =====
    if (action === 'remove-user') {
      const { tenant_id, user_id } = body

      await supabase
        .from('tenant_users')
        .delete()
        .eq('tenant_id', tenant_id)
        .eq('id', user_id)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'User removed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== GET TENANT INFO =====
    if (action === 'get-tenant') {
      const { tenant_id } = body

      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant_id)
        .single()

      const { data: users } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenant_id)

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenant_id)
        .maybeSingle()

      // Get usage stats
      const { count: customerCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant_id)

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: broadcastUsage } = await supabase
        .from('usage_metrics')
        .select('metric_value')
        .eq('tenant_id', tenant_id)
        .eq('metric_type', 'broadcasts_sent')
        .gte('period_start', startOfMonth.toISOString())
        .maybeSingle()

      return new Response(
        JSON.stringify({
          tenant,
          users,
          subscription,
          usage: {
            users: users?.length || 0,
            customers: customerCount || 0,
            broadcasts_this_month: broadcastUsage?.metric_value || 0
          },
          limits: {
            max_users: tenant?.max_users,
            max_customers: tenant?.max_customers,
            max_broadcasts_per_month: tenant?.max_broadcasts_per_month
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== UPDATE TENANT SETTINGS =====
    if (action === 'update-settings') {
      const { tenant_id, settings } = body

      await supabase
        .from('tenants')
        .update({ 
          settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenant_id)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Settings updated'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== GET USER TENANTS =====
    if (action === 'get-user-tenants') {
      const { line_user_id } = body

      const { data: tenantUsers } = await supabase
        .from('tenant_users')
        .select(`
          *,
          tenants (
            id,
            name,
            subdomain,
            plan,
            status,
            settings
          )
        `)
        .eq('line_user_id', line_user_id)
        .eq('status', 'active')

      return new Response(
        JSON.stringify({
          tenants: tenantUsers || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ===== SWITCH TENANT =====
    if (action === 'switch-tenant') {
      const { line_user_id, tenant_id } = body

      // Verify user belongs to tenant
      const { data: user } = await supabase
        .from('tenant_users')
        .select('*')
        .eq('tenant_id', tenant_id)
        .eq('line_user_id', line_user_id)
        .eq('status', 'active')
        .maybeSingle()

      if (!user) {
        throw new Error('Access denied')
      }

      // Update last accessed
      await supabase
        .from('tenant_users')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', user.id)

      return new Response(
        JSON.stringify({
          success: true,
          tenant_id,
          role: user.role
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Tenant] Error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
