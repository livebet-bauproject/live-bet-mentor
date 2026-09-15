/**
 * LIVE BETTING MENTOR - Centralized Configuration
 */

/**
 * CONFIGURATION - [FROZEN FOR OBSERVATION PHASE: DEC 26 - JAN 05]
 * DO NOT MODIFY LIMITS, RISK, OR LEAGUES DURING THIS PERIOD.
 */
export const CONFIG = {
  // Decision Engine Thresholds
  DECISION: {
    EDGE_SCORE_THRESHOLD: 1.20, // Min value to consider a BET
    MIN_SELECTIVITY_PASS_RATE: 0.60, // Target selectivity
    MAX_COUNTER_ARGUMENTS: 2, // Max allowed counter-args before automatic PASS
    DAILY_TRANSACTION_LIMIT: 2, // Max 2 approved trades per day
    DQS_THRESHOLD: 0.40, // Min Data Quality Score to allow analysis
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
      LATE_GAME_BAN_MIN: 85
    }
  },

  // Data & Latency
  DATA: {
    LATENCY_THRESHOLD_MS: 30000, // 30 seconds
    POLLING_INTERVAL_MS: 8000, // 8 seconds for faster updates
    RELIABILITY_SCORE_MIN: 0.8, // Minimum reliability score to avoid NO-BET
    USE_MOCK_DATA: import.meta?.env?.VITE_USE_MOCK_DATA === 'true',
    DATA_SOURCE: import.meta?.env?.VITE_DATA_SOURCE || 'SOFASCORE',
    DATA_SOURCE_OPTIONS: {
      SOFASCORE: 'SOFASCORE',
      REDSCORES: 'REDSCORES'
    },
    SOFASCORE_LOCAL_PROXY_URL: (import.meta?.env?.VITE_API_BASE_URL || 'http://localhost:3001') + '/api/sofascore/live'
  },

  // Bankroll Management
  BANKROLL: {
    DEFAULT_MAX_STAKE_PERCENT: 0.01,
    LOW_RISK_STAKE: 0.0075,
    MEDIUM_RISK_STAKE: 0.005,
    HIGH_RISK_STAKE: 0.0025,
    LOSS_STREAK_STAKE_MODIFIER: 0.5,
    HIERARCHY: {
      INITIAL_BALANCE: 2000,
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
      TIER_1: ['Süper Lig', 'Trendyol Süper Lig', 'Premier League', 'Bundesliga', 'LaLiga', 'Serie A', 'Ligue 1', 'Champions League', 'Europa League'],
      TIER_2: ['Eredivisie', 'Primeira Liga', 'Liga Portugal', 'Pro League', 'Austrian Bundesliga', 'Super League', 'Superliga', 'Scottish Premiership', 'MLS'],
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
    TELEGRAM: '@Livebetdeskbot',
    EMAIL: 'karabulut.hamza@gmail.com'
  },
  MEMBERSHIP_PRICING: {
    trial: 0,
    pro: 29,
    premium: 79,
    currency: '€'
  }
};
