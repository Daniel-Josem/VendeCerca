export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratuito',
    price: 0,
    maxProducts: 20,
    maxBranches: 1,
    analytics: false,
    color: '#6b7280',
    icon: '🆓',
    badge: null,
  },
  basic: {
    id: 'basic',
    name: 'Básico',
    price: 7,
    maxProducts: 50,
    maxBranches: 2,
    analytics: false,
    color: '#3b82f6',
    icon: '🔵',
    badge: 'Plan Básico',
  },
  pro: {
    id: 'pro',
    name: 'Profesional',
    price: 25,
    maxProducts: 200,
    maxBranches: 5,
    analytics: true,
    color: '#8b5cf6',
    icon: '💜',
    badge: 'Pro',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Empresas',
    price: 60,
    maxProducts: Infinity,
    maxBranches: Infinity,
    analytics: true,
    color: '#f59e0b',
    icon: '⭐',
    badge: 'Empresas',
  },
};

export const TIERS = {
  bronze:   { id: 'bronze',   name: 'Bronce',  minSales: 0,   color: '#cd7f32', icon: '🥉' },
  silver:   { id: 'silver',   name: 'Plata',   minSales: 10,  color: '#9ca3af', icon: '🥈' },
  gold:     { id: 'gold',     name: 'Oro',     minSales: 50,  color: '#f59e0b', icon: '🥇' },
  platinum: { id: 'platinum', name: 'Platino', minSales: 200, color: '#8b5cf6', icon: '💎' },
};

export function getTier(completedSales = 0) {
  if (completedSales >= 200) return TIERS.platinum;
  if (completedSales >= 50)  return TIERS.gold;
  if (completedSales >= 10)  return TIERS.silver;
  return TIERS.bronze;
}

export function getPlan(planId = 'free') {
  return PLANS[planId] || PLANS.free;
}

export function generateReferralCode(uid) {
  return uid.slice(0, 8).toUpperCase();
}

export const FEATURED_COST = { day: 10, week: 50 };
export const REFERRAL_REWARD = 10;
export const VERIFICATION_COST_COP = 10000; // $10.000 COP — insignia Verificado
