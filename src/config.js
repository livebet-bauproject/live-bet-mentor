import { supabase } from './backend/supabaseClient.js';

let activeBackendUrl = null;
let lastDiscoveryTime = 0;
let discoveryPromise = null;

async function pingBackend(url, timeoutMs = 1200) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url.replace(/\/$/, '')}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timer);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function initBackendDiscovery() {
  if (typeof window === 'undefined') return getApiBaseUrl();
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
    activeBackendUrl = 'http://localhost:3001';
    return activeBackendUrl;
  }

  const now = Date.now();
  if (now - lastDiscoveryTime < 30000) {
    return activeBackendUrl;
  }

  if (discoveryPromise) return discoveryPromise;

  discoveryPromise = (async () => {
    try {
      lastDiscoveryTime = now;
      const { data } = await supabase.from('system_settings').select('value').eq('key', 'backend_api_url').maybeSingle();
      if (data && data.value && data.value.startsWith('http')) {
        const candidateUrl = data.value.trim().replace(/\/$/, '');
        // Fast ping verification (max 600ms) - don't trap the user with dead tunnels!
        const isAlive = await pingBackend(candidateUrl, 600);
        if (isAlive) {
          activeBackendUrl = candidateUrl;
          try { 
            localStorage.setItem('lbm_backend_api_url', candidateUrl);
            localStorage.setItem('lbm_backend_api_url_ts', String(now));
          } catch(e) {}
          console.log('[API_DISCOVERY] Verified live backend:', candidateUrl);
          return candidateUrl;
        } else {
          console.warn('[API_DISCOVERY] Registered backend is unreachable (offline tunnel). Bypassing to cloud fallback:', candidateUrl);
          activeBackendUrl = null;
          try { localStorage.removeItem('lbm_backend_api_url'); } catch(e) {}
          return null;
        }
      }
    } catch(err) {
      console.warn('[API_DISCOVERY] Discovery notice:', err.message);
    } finally {
      discoveryPromise = null;
    }

    // If candidate verification failed, do not use stale unverified cache
    activeBackendUrl = null;
    return null;
  })();

  return discoveryPromise;
}

// Auto-trigger discovery in background when module loads in browser
if (typeof window !== 'undefined') {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalHost) {
    activeBackendUrl = 'http://localhost:3001';
  }
  // Run background verification without blocking UI
  initBackendDiscovery();
  // Auto-refresh every 60s
  setInterval(initBackendDiscovery, 60000);
}

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return 'http://localhost:3001';
    }
    if (activeBackendUrl) {
      return activeBackendUrl;
    }
  }
  return activeBackendUrl || null;
}

export const CONFIG = {
  // Decision Engine Thresholds
  DECISION: {
    EDGE_SCORE_THRESHOLD: 1.20, // Min value to consider a BET
    MIN_SELECTIVITY_PASS_RATE: 0.60, // Target selectivity
    MAX_COUNTER_ARGUMENTS: 2, // Max allowed counter-args before automatic PASS
    DAILY_TRANSACTION_LIMIT: 2, // Max 2 approved trades per day
    DQS_THRESHOLD: 0.50, // Min Data Quality Score to allow analysis
    DQS_WEIGHTS: {
      LATENCY: 0.4,
      STATS_AVAILABILITY: 0.4,
      FRESHNESS: 0.2
    },
    MODES: {
      CORE_DQS: 'CORE_DQS',
      DQS_RISK: 'DQS_RISK',
      FULL_STACK: 'FULL_STACK'
    },
    RISK: {
      DEAD_MATCH_MIN: 75,
      DEAD_MATCH_DIFF: 2,
      MOMENTUM_WINDOW_MIN: 10,
      LATE_GAME_BAN_MIN: 82
    },
    // Institutional VIP Syndicate Quality Gate (78-85% Target Win Rate)
    VIP_CRITERIA: {
      MIN_DQS: 0.70, // Strict data quality
      MIN_ODDS: 1.40, // Value floor: no low-odds traps (<1.40)
      MIN_PRESSURE: 68, // Dominant momentum only
      BLOWOUT_DIFF: 2, // Never recommend next goal for leading team with 2+ diff
      LATE_GAME_MIN: 75, // Stale match check starting minute
      MIN_CONDITIONS: 5 // Min 5/7 conditions required for alert
    }
  },

  // Data & Latency
  DATA: {
    LATENCY_THRESHOLD_MS: 30000, // 30 seconds
    POLLING_INTERVAL_MS: 10000, // 10 seconds for smooth fast updates without choking server
    RELIABILITY_SCORE_MIN: 0.8, // Minimum reliability score to avoid NO-BET
    USE_MOCK_DATA: import.meta?.env?.VITE_USE_MOCK_DATA === 'true',
    DATA_SOURCE: import.meta?.env?.VITE_DATA_SOURCE || 'SOFASCORE',
    DATA_SOURCE_OPTIONS: {
      SOFASCORE: 'SOFASCORE',
      REDSCORES: 'REDSCORES'
    },
    get SOFASCORE_LOCAL_PROXY_URL() {
      return getApiBaseUrl() + '/api/sofascore/live';
    }
  },

  // Bankroll Management
  BANKROLL: {
    DEFAULT_MAX_STAKE_PERCENT: 0.01,
    LOW_RISK_STAKE: 0.0075,
    MEDIUM_RISK_STAKE: 0.005,
    HIGH_RISK_STAKE: 0.0025,
    LOSS_STREAK_STAKE_MODIFIER: 0.5,
    HIERARCHY: {
      INITIAL_BALANCE: 5000,
      MODES: {
        NORMAL: 'NORMAL',
        CAUTION: 'CAUTION',
        NO_BET: 'NO_BET'
      },
      THRESHOLDS: {
        CAUTION_LOSS_STREAK: 2,
        STOP_LOSS_STREAK: 3,
        DAILY_LOSS_LIMIT: 3,
        DAILY_BET_LIMIT: 5
      },
      STAKE_PERCENTAGE: {
        TIER_1: 0.01, // 1%
        TIER_2: 0.005 // 0.5%
      }
    }
  },

  // Visuals
  THEME: {
    DARK_MODE: true,
    GLASSMORPHISM: true,
  },

  // Phase 11: Modular System (Gözlem Aşaması - Default: OFF)
  MODULAR_SYSTEM: {
    OBSERVATION_MODE: true, // 14-day silent log protocol
    SECONDARY_VALIDATOR: {
      ENABLED: false, // Mackolik removed
    },
    OPTIONAL_MODULES: {
      XG_ANALYSIS: true,
      LEAGUE_PROFILES: true,
      BAYESIAN_PRICING: true
    },
    // Phase 12: Tiered League System
    LEAGUE_TIERS: {
      TIER_1: [
        'Süper Lig', 'Trendyol Süper Lig', 'Premier League', 'Bundesliga', 'LaLiga', 'Serie A', 'Ligue 1',
        'Champions League', 'Europa League', 'Conference League', 'UEFA Champions League', 'UEFA Europa League', 'UEFA Europa Conference League',
        'UEFA Nations League', 'Nations League', 'World Cup', 'Euro', 'European Championship', 'Copa America',
        'Copa Libertadores', 'FA Cup', 'Copa del Rey', 'DFB-Pokal', 'DFB Pokal', 'Coppa Italia', 'Coupe de France', 'Türkiye Kupası', 'Turkiye Kupasi',
        'Supercopa de España', 'Supercoppa Italiana', 'DFL-Supercup', 'TFF Süper Kupa', 'FIFA Club World Cup', 'UEFA Super Cup'
      ],
      TIER_2: [
        'Eredivisie', 'Primeira Liga', 'Liga Portugal', 'Pro League', 'Championship', '2. Bundesliga', 'LaLiga 2', 'Segunda División', 'Serie B', 'Ligue 2', '1. Lig', 'Trendyol 1. Lig',
        'Austrian Bundesliga', 'Swiss Super League', 'Superliga', 'Scottish Premiership', 'Eliteserien', 'Allsvenskan', 'Super League Greece', 'Ekstraklasa', 'Fortuna Liga', 'Chance Liga', 'HNL',
        'MLS', 'Major League Soccer', 'Brasileirão', 'Brasileirao', 'Liga Profesional', 'Liga MX', 'Saudi Pro League', 'J1 League', 'K League 1', 'A-League',
        'Copa Sudamericana', 'EFL Cup', 'Carabao Cup', 'CONCACAF Nations League', 'Primera A', 'Liga BetPlay', 'Liga DiMayor', 'Primera División'
      ],
      // Everything else is TIER_3 (Discovery) by default
      SETTINGS: {
        TIER_2_MOMENTUM_WINDOW: 15, // More aggressive (15m instead of 10m)
        TIER_2_DEAD_MATCH_MIN: 70, // Earlier dead-match check (70' instead of 75')
      }
    },
    // Phase 15: Advanced Analysis Modules
    ADVANCED_ANALYSIS: {
      VALUE_DETECTION: {
        ENABLED: true,
        MIN_CONSENSUS_PROB: 70, // %70 prediction agreement
        MAX_ODDS: 2.50, // Max odds to consider
        MIN_EDGE: 10 // %10 difference between prediction and odds
      },
      DIVERGENCE_RADAR: {
        ENABLED: true,
        THRESHOLD: 50 // %50 division among sources
      },
      REVERSE_SIGNAL: {
        ENABLED: true,
        DQS_THRESHOLD: 0.70, // High DQS for counter-play
        MOMENTUM_DIFF: 5 // Significant momentum difference
      },
      // Phase 16: Live Opportunities (Canlı Fırsatlar)
      LIVE_OPPORTUNITIES: {
        ENABLED: true,
        ALEV_THRESHOLD: 75, // 🔥 Hot opportunity
        SICAK_THRESHOLD: 50, // ⚡ Warm opportunity
        MAX_MINUTE: 80, // Exclude matches after this minute
        MIN_DQS: 0.40, // Minimum data quality
        WEIGHTS: {
          DQS: 0.30,
          MOMENTUM: 0.25,
          PRESSURE: 0.20,
          XG: 0.15,
          RISK: 0.10
        }
      }
    }
  },
  SUPPORT: {
    TELEGRAM: '@Livebetdeskbot'
  },
  MEMBERSHIP_PRICING: {
    trial: 0,
    pro: 29,
    premium: 79,
    currency: '€'
  }
};
