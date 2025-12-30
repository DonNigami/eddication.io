/**
 * Pricing Plans Configuration
 * Version: 3.0.0
 * Date: 2025-12-30
 */

export interface PlanLimits {
  max_users: number
  max_customers: number
  max_broadcasts_per_month: number
  max_segments: number
  max_campaigns: number
  max_api_calls_per_month: number
  storage_gb: number
}

export interface PlanFeatures {
  basic_crm: boolean
  line_integration: boolean
  manual_broadcasts: boolean
  automated_campaigns: boolean
  advanced_segmentation: boolean
  rfm_analysis: boolean
  ab_testing: boolean
  predictive_analytics: boolean
  churn_prediction: boolean
  ltv_prediction: boolean
  api_access: boolean
  custom_integrations: boolean
  white_label: boolean
  custom_domain: boolean
  priority_support: boolean
  dedicated_support: boolean
  sla_guarantee: boolean
  custom_development: boolean
}

export interface PricingPlan {
  id: string
  name: string
  name_th: string
  description: string
  description_th: string
  price: number
  currency: string
  billing_period: 'monthly' | 'yearly'
  trial_days: number
  limits: PlanLimits
  features: string[]
  highlighted?: boolean
  cta: string
  cta_th: string
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    name_th: 'ฟรี',
    description: 'Perfect for trying out our CRM',
    description_th: 'เหมาะสำหรับทดลองใช้งาน',
    price: 0,
    currency: 'THB',
    billing_period: 'monthly',
    trial_days: 0,
    limits: {
      max_users: 2,
      max_customers: 500,
      max_broadcasts_per_month: 1000,
      max_segments: 5,
      max_campaigns: 3,
      max_api_calls_per_month: 0,
      storage_gb: 1
    },
    features: [
      'basic_crm',
      'line_integration',
      'manual_broadcasts',
      'basic_reports',
      'email_support'
    ],
    cta: 'Get Started',
    cta_th: 'เริ่มใช้งาน'
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    name_th: 'สตาร์ทเตอร์',
    description: 'For growing businesses',
    description_th: 'สำหรับธุรกิจที่กำลังเติบโต',
    price: 990,
    currency: 'THB',
    billing_period: 'monthly',
    trial_days: 14,
    limits: {
      max_users: 5,
      max_customers: 5000,
      max_broadcasts_per_month: 10000,
      max_segments: 20,
      max_campaigns: 10,
      max_api_calls_per_month: 10000,
      storage_gb: 10
    },
    features: [
      'all_free_features',
      'advanced_segmentation',
      'automated_campaigns',
      'rfm_analysis',
      'custom_fields',
      'api_access',
      'priority_email_support',
      'analytics_dashboard'
    ],
    highlighted: true,
    cta: 'Start Free Trial',
    cta_th: 'ทดลองใช้ฟรี 14 วัน'
  },

  pro: {
    id: 'pro',
    name: 'Professional',
    name_th: 'โปรเฟสชันนัล',
    description: 'For teams that need advanced features',
    description_th: 'สำหรับทีมที่ต้องการฟีเจอร์ขั้นสูง',
    price: 2990,
    currency: 'THB',
    billing_period: 'monthly',
    trial_days: 14,
    limits: {
      max_users: 20,
      max_customers: 50000,
      max_broadcasts_per_month: 100000,
      max_segments: 100,
      max_campaigns: 50,
      max_api_calls_per_month: 100000,
      storage_gb: 100
    },
    features: [
      'all_starter_features',
      'ab_testing',
      'predictive_analytics',
      'churn_prediction',
      'ltv_prediction',
      'advanced_automation',
      'custom_integrations',
      'white_label_option',
      'phone_support',
      'dedicated_account_manager'
    ],
    cta: 'Start Free Trial',
    cta_th: 'ทดลองใช้ฟรี 14 วัน'
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    name_th: 'เอ็นเทอร์ไพรส์',
    description: 'For large organizations with custom needs',
    description_th: 'สำหรับองค์กรขนาดใหญ่ที่ต้องการปรับแต่ง',
    price: 0, // Custom pricing
    currency: 'THB',
    billing_period: 'monthly',
    trial_days: 30,
    limits: {
      max_users: 999999,
      max_customers: 999999,
      max_broadcasts_per_month: 999999,
      max_segments: 999999,
      max_campaigns: 999999,
      max_api_calls_per_month: 999999,
      storage_gb: 1000
    },
    features: [
      'all_pro_features',
      'custom_development',
      'dedicated_infrastructure',
      'sla_guarantee_99_95',
      'onboarding_training',
      'priority_feature_requests',
      'custom_contracts',
      'data_migration_support',
      '24_7_support'
    ],
    cta: 'Contact Sales',
    cta_th: 'ติดต่อฝ่ายขาย'
  }
}

// Yearly pricing (20% discount)
export const YEARLY_PRICING_PLANS: Record<string, PricingPlan> = {
  starter: {
    ...PRICING_PLANS.starter,
    price: 9504, // 990 * 12 * 0.8 = 9,504
    billing_period: 'yearly',
    description: 'For growing businesses (Save 20%)',
    description_th: 'สำหรับธุรกิจที่กำลังเติบโต (ประหยัด 20%)'
  },
  pro: {
    ...PRICING_PLANS.pro,
    price: 28704, // 2990 * 12 * 0.8 = 28,704
    billing_period: 'yearly',
    description: 'For teams that need advanced features (Save 20%)',
    description_th: 'สำหรับทีมที่ต้องการฟีเจอร์ขั้นสูง (ประหยัด 20%)'
  }
}

// Feature descriptions
export const FEATURE_DESCRIPTIONS: Record<string, { name: string; name_th: string; description: string; description_th: string }> = {
  basic_crm: {
    name: 'Basic CRM',
    name_th: 'CRM พื้นฐาน',
    description: 'Manage customers, segments, and basic campaigns',
    description_th: 'จัดการลูกค้า กลุ่มเป้าหมาย และแคมเปญพื้นฐาน'
  },
  line_integration: {
    name: 'LINE Integration',
    name_th: 'เชื่อมต่อ LINE',
    description: 'Send messages via LINE Official Account',
    description_th: 'ส่งข้อความผ่าน LINE Official Account'
  },
  advanced_segmentation: {
    name: 'Advanced Segmentation',
    name_th: 'กลุ่มเป้าหมายขั้นสูง',
    description: 'Create dynamic segments with multiple conditions',
    description_th: 'สร้างกลุ่มเป้าหมายแบบไดนามิกด้วยเงื่อนไขหลายแบบ'
  },
  automated_campaigns: {
    name: 'Automated Campaigns',
    name_th: 'แคมเปญอัตโนมัติ',
    description: 'Schedule and automate your marketing campaigns',
    description_th: 'กำหนดเวลาและทำแคมเปญการตลาดอัตโนมัติ'
  },
  rfm_analysis: {
    name: 'RFM Analysis',
    name_th: 'วิเคราะห์ RFM',
    description: 'Analyze customers by Recency, Frequency, Monetary',
    description_th: 'วิเคราะห์ลูกค้าตามความถี่และมูลค่าการซื้อ'
  },
  ab_testing: {
    name: 'A/B Testing',
    name_th: 'ทดสอบ A/B',
    description: 'Test different messages and optimize results',
    description_th: 'ทดสอบข้อความหลายแบบและเพิ่มประสิทธิภาพ'
  },
  predictive_analytics: {
    name: 'Predictive Analytics',
    name_th: 'การวิเคราะห์เชิงคาดการณ์',
    description: 'AI-powered predictions for customer behavior',
    description_th: 'ใช้ AI คาดการณ์พฤติกรรมลูกค้า'
  },
  churn_prediction: {
    name: 'Churn Prediction',
    name_th: 'คาดการณ์การหลุดลอย',
    description: 'Identify at-risk customers before they leave',
    description_th: 'ระบุลูกค้าที่มีแนวโน้มจะหยุดใช้บริการ'
  },
  api_access: {
    name: 'API Access',
    name_th: 'เข้าถึง API',
    description: 'Integrate with your existing systems',
    description_th: 'เชื่อมต่อกับระบบที่มีอยู่'
  },
  white_label: {
    name: 'White Label',
    name_th: 'ติดแบรนด์เอง',
    description: 'Remove our branding and use your own',
    description_th: 'ลบแบรนด์ของเราและใช้แบรนด์ของคุณเอง'
  },
  custom_domain: {
    name: 'Custom Domain',
    name_th: 'โดเมนเฉพาะ',
    description: 'Use your own domain (e.g., crm.yourcompany.com)',
    description_th: 'ใช้โดเมนของคุณเอง (เช่น crm.yourcompany.com)'
  },
  sla_guarantee: {
    name: '99.95% SLA',
    name_th: 'SLA 99.95%',
    description: 'Guaranteed uptime with financial penalties',
    description_th: 'รับประกันระยะเวลาใช้งานพร้อมค่าชดเชย'
  }
}

// Usage-based pricing add-ons
export const ADDONS = {
  extra_broadcasts: {
    name: 'Extra Broadcasts',
    name_th: 'ข้อความเพิ่มเติม',
    price: 0.5, // per 1000 messages
    unit: 'per 1000 messages',
    unit_th: 'ต่อ 1,000 ข้อความ'
  },
  extra_storage: {
    name: 'Extra Storage',
    name_th: 'พื้นที่จัดเก็บเพิ่ม',
    price: 50, // per GB per month
    unit: 'per GB/month',
    unit_th: 'ต่อ GB/เดือน'
  },
  extra_users: {
    name: 'Extra Team Members',
    name_th: 'สมาชิกทีมเพิ่ม',
    price: 200, // per user per month
    unit: 'per user/month',
    unit_th: 'ต่อคน/เดือน'
  }
}

// Helper functions
export function getPlanLimits(planId: string): PlanLimits {
  return PRICING_PLANS[planId]?.limits || PRICING_PLANS.free.limits
}

export function getPlanFeatures(planId: string): string[] {
  return PRICING_PLANS[planId]?.features || []
}

export function hasPlanFeature(planId: string, feature: string): boolean {
  const features = getPlanFeatures(planId)
  return features.includes(feature) || features.includes('all_free_features') || features.includes('all_starter_features') || features.includes('all_pro_features')
}

export function calculatePrice(planId: string, billingPeriod: 'monthly' | 'yearly' = 'monthly'): number {
  if (billingPeriod === 'yearly' && YEARLY_PRICING_PLANS[planId]) {
    return YEARLY_PRICING_PLANS[planId].price
  }
  return PRICING_PLANS[planId]?.price || 0
}

export function calculateAnnualSavings(planId: string): number {
  const monthlyPrice = PRICING_PLANS[planId]?.price || 0
  const yearlyPrice = YEARLY_PRICING_PLANS[planId]?.price || (monthlyPrice * 12)
  return (monthlyPrice * 12) - yearlyPrice
}

// Plan comparison for upgrade suggestions
export function getUpgradePlan(currentPlan: string): string | null {
  const order = ['free', 'starter', 'pro', 'enterprise']
  const currentIndex = order.indexOf(currentPlan)
  return currentIndex < order.length - 1 ? order[currentIndex + 1] : null
}

export function shouldUpgrade(currentPlan: string, usagePercent: number): boolean {
  return usagePercent >= 80 && getUpgradePlan(currentPlan) !== null
}
