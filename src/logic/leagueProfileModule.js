import { CONFIG } from '../config.js';

// Verified Top-Flight Global Unique Tournament IDs from live data feeds
const TIER_1_UNIQUE_IDS = new Set([
    17,    // Premier League (England)
    8,     // LaLiga (Spain)
    23,    // Serie A (Italy)
    35,    // Bundesliga (Germany)
    34,    // Ligue 1 (France)
    52,    // Süper Lig (Turkey)
    7,     // UEFA Champions League
    679,   // UEFA Europa League
    17015, // UEFA Conference League
    10783, // UEFA Nations League
    16,    // World Cup
    1,     // European Championship (Euro)
    133    // Copa America
]);

const TIER_2_UNIQUE_IDS = new Set([
    37,   // Eredivisie (Netherlands)
    238,  // Liga Portugal
    38,   // Pro League (Belgium)
    18,   // Championship (England)
    44,   // 2. Bundesliga (Germany)
    54,   // LaLiga 2 (Spain)
    53,   // Serie B (Italy)
    242,  // Major League Soccer (MLS)
    325,  // Brasileirão Serie A (Brazil)
    155,  // Liga Profesional (Argentina)
    36,   // Scottish Premiership
    39,   // Superliga (Denmark)
    41,   // Eliteserien (Norway)
    42,   // Allsvenskan (Sweden)
    45,   // Austrian Bundesliga
    46,   // Swiss Super League
    98,   // 1. Lig (Turkey)
    240,  // Liga MX (Mexico)
    955   // Saudi Pro League
]);

export class LeagueProfileModule {
    constructor() {
        // Historical averages (Observation baseline)
        this.profiles = {
            'Premier_League': { avgGoals: 2.8, lateGoalProb: 0.22 },
            'Super_Lig': { avgGoals: 2.6, lateGoalProb: 0.25 },
            'Bundesliga': { avgGoals: 3.1, lateGoalProb: 0.18 }
        };
    }

    /**
     * Parses string or object input to extract tournament metadata safely
     */
    parseInput(fixtureOrLeague) {
        let leagueName = '';
        let categoryName = '';
        let uniqueTournamentId = null;
        let userCount = 0;
        let gender = '';

        if (typeof fixtureOrLeague === 'object' && fixtureOrLeague !== null) {
            leagueName = fixtureOrLeague.leagueName || fixtureOrLeague.league || fixtureOrLeague.name || '';
            categoryName = fixtureOrLeague.category || fixtureOrLeague.tournament?.category?.name || '';
            uniqueTournamentId = fixtureOrLeague.uniqueTournamentId || fixtureOrLeague.tournament?.uniqueTournament?.id || null;
            userCount = fixtureOrLeague.userCount || fixtureOrLeague.tournament?.uniqueTournament?.userCount || 0;
            gender = fixtureOrLeague.gender || fixtureOrLeague.homeTeam?.gender || '';
        } else {
            leagueName = String(fixtureOrLeague || '');
        }

        const normalizedName = leagueName.toLowerCase().trim();
        const normalizedCategory = categoryName.toLowerCase().trim();

        // 1. FRIENDLY DETECTION (via structured category or match text)
        const isFriendly = normalizedCategory.includes('friendly') || 
                           /friendly|hazırlık|hazirlik|amichevole|freundschaftsspiel|amical|amistoso|exhibition|pre-season/i.test(normalizedName);

        // 2. WOMEN'S DETECTION (via gender metadata, category or title)
        const isWomen = gender === 'F' || 
                        normalizedCategory.includes('women') || 
                        /women|kadın|kadin|femme|frauen|damen|dames|kvinner|feminino|w\.f\.c|wfc|ladies/i.test(normalizedName) ||
                        /women|kadın|kadin/i.test(normalizedCategory);

        // 3. YOUTH / RESERVE DETECTION
        const isYouth = normalizedCategory.includes('youth') || 
                        /\b(u17|u18|u19|u20|u21|u23|reserves|reserve|youth|primavera|copinha)\b/i.test(normalizedName);

        return {
            leagueName,
            categoryName,
            uniqueTournamentId: uniqueTournamentId ? Number(uniqueTournamentId) : null,
            userCount: Number(userCount) || 0,
            gender,
            normalizedName,
            normalizedCategory,
            isFriendly,
            isWomen,
            isYouth
        };
    }

    /**
     * Determine Tier (1: Elite, 2: Upper-Mid, 3: Discovery/Risk)
     */
    getTier(fixtureOrLeague) {
        const meta = this.parseInput(fixtureOrLeague);
        const { normalizedName, normalizedCategory, uniqueTournamentId, userCount, isFriendly, isWomen, isYouth } = meta;

        if (!normalizedName && !uniqueTournamentId) return 3;

        // CRITICAL GUARD: Friendly, Women's, and Youth/Reserve matches are always Tier 3 (Discovery Only)
        if (isFriendly || isWomen || isYouth) {
            return 3;
        }

        // EXCLUSION LIST: Never match these patterns as Tier 1 or 2
        const excludedPatterns = [
            'friendly', 'hazırlık', 'hazirlik', 'amichevole', 'freundschaftsspiel', 'amical', 'amistoso',
            'serie b', 'serie c', 'serie d',       // Lower divisions (Brazil, Italy, etc.)
            'segunda', '2. liga', '2.liga',        // Second divisions
            'u20', 'u21', 'u19', 'u23', 'u18', 'u17', // Youth leagues
            'women', 'kadın', 'feminino',          // Women's leagues
            'reserve', 'reserves',                  // Reserve leagues
            'cup', 'kupa', 'copa',                  // Cup competitions (except Champions/Europa)
            'playoff', 'play-off',                 // Playoff matches
            'copinha',                              // Brazilian youth cup
            'group a', 'group b', 'group c', 'group d', 'group e', 'group f', 'group g', 'group h',
            'grupo',
            // Brazilian State Leagues (NOT top-flight Serie A)
            'catarinense', 'cearense', 'paulista', 'carioca', 'mineiro', 'gaúcho', 'gaucho',
            'paranaense', 'baiano', 'pernambucano', 'goiano', 'amazonense', 'paraense',
            'alagoano', 'sergipano', 'potiguar', 'piauiense', 'maranhense', 'tocantinense',
            'mato-grossense', 'sul-mato-grossense', 'acreano', 'rondoniense', 'roraimense', 'amapaense',
            'a.f.', 'taça', 'taca'
        ];

        const hasExcludedPattern = excludedPatterns.some(pattern => normalizedName.includes(pattern));

        // Exception: Major international and continental competitions should never be excluded
        const isProtectedCompetition = normalizedName.includes('champions') ||
            normalizedName.includes('europa') ||
            normalizedName.includes('conference league') ||
            normalizedName.includes('nations league') ||
            normalizedName.includes('world cup') ||
            normalizedName.includes('euro') ||
            normalizedName.includes('copa america');

        if (hasExcludedPattern && !isProtectedCompetition) {
            return 3; // Discovery tier for excluded leagues
        }

        // 1. FAST-PATH: Verified Unique Tournament ID Lookup
        if (uniqueTournamentId) {
            if (TIER_1_UNIQUE_IDS.has(uniqueTournamentId)) return 1;
            if (TIER_2_UNIQUE_IDS.has(uniqueTournamentId)) return 2;
        }

        // 2. ORGANIC METADATA: High global follower count indicates top liquidity
        if (userCount >= 300000) return 1;
        if (userCount >= 50000) return 2;

        // 3. TEXT-BASED FALLBACK: Configured TIER_1 and TIER_2 strings
        const tiers = CONFIG.MODULAR_SYSTEM?.LEAGUE_TIERS || {};
        const isRealSerieA = normalizedName === 'serie a' ||
            normalizedName.startsWith('serie a ') ||
            normalizedName === 'serie a tim' ||
            normalizedName.includes('brasileirão') || normalizedName.includes('brasileirao') ||
            normalizedName.includes('campeonato brasileiro serie a');

        const matchesLeague = (tierLeague) => {
            const tierLower = tierLeague.toLowerCase();

            if (tierLower === 'serie a') return isRealSerieA;

            if ((tierLower === 'nations league' || tierLower === 'uefa nations league') && normalizedName.includes('nations league')) {
                return true;
            }

            if (normalizedName === tierLower) return true;
            if (normalizedName.includes(tierLower)) return true;

            if (tierLower === 'süper lig' && (normalizedName === 'super lig' || normalizedName.includes('süper lig') || normalizedName.includes('super lig'))) {
                return true;
            }

            return false;
        };

        if (tiers.TIER_1 && tiers.TIER_1.some(l => matchesLeague(l))) return 1;
        if (tiers.TIER_2 && tiers.TIER_2.some(l => matchesLeague(l))) return 2;

        return 3; // Default to Discovery
    }

    /**
     * Get enriched league profile with metadata
     */
    getProfile(fixtureOrLeague) {
        const meta = this.parseInput(fixtureOrLeague);
        const tier = this.getTier(fixtureOrLeague);

        if (!CONFIG.MODULAR_SYSTEM?.OPTIONAL_MODULES?.LEAGUE_PROFILES) {
            return {
                leagueName: meta.leagueName,
                category: meta.categoryName,
                tier,
                isFriendly: meta.isFriendly,
                isWomen: meta.isWomen,
                isYouth: meta.isYouth,
                userCount: meta.userCount
            };
        }

        const key = Object.keys(this.profiles).find(pk => meta.leagueName?.includes(pk.replace('_', ' '))) || 'default';

        return {
            leagueName: meta.leagueName,
            category: meta.categoryName,
            tier,
            isFriendly: meta.isFriendly,
            isWomen: meta.isWomen,
            isYouth: meta.isYouth,
            userCount: meta.userCount,
            ...this.profiles[key] || { avgGoals: 2.5, lateGoalProb: 0.20 },
            observation: 'LEAGUE_TRAIT_LOGGING'
        };
    }
}

export const leagueProfileModule = new LeagueProfileModule();
