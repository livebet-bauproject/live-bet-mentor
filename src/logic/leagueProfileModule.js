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
    678,   // UEFA Super Cup
    16,    // World Cup
    1,     // European Championship (Euro)
    133,   // Copa America
    1729,  // FIFA Club World Cup
    384,   // CONMEBOL Copa Libertadores
    19,    // FA Cup (England)
    329,   // Copa del Rey (Spain)
    209,   // DFB-Pokal (Germany)
    211,   // Coppa Italia (Italy)
    210,   // Coupe de France (France)
    552,   // Ziraat Türkiye Kupası (Turkey)
    403,   // Supercopa de España
    407,   // Supercoppa Italiana
    977,   // DFL-Supercup
    1365   // TFF Süper Kupa
]);

const TIER_2_UNIQUE_IDS = new Set([
    37,    // Eredivisie (Netherlands)
    238,   // Liga Portugal (Portugal)
    38,    // Pro League (Belgium)
    18,    // Championship (England)
    44,    // 2. Bundesliga (Germany)
    54,    // LaLiga 2 (Spain)
    53,    // Serie B (Italy)
    182,   // Ligue 2 (France)
    98,    // 1. Lig (Turkey)
    242,   // Major League Soccer (MLS)
    325,   // Brasileirão Serie A (Brazil)
    390,   // Brasileirão Série B (Brazil)
    155,   // Liga Profesional (Argentina)
    36,    // Scottish Premiership (Scotland)
    39,    // Superliga (Denmark)
    41,    // Eliteserien (Norway)
    42,    // Allsvenskan (Sweden)
    45,    // Austrian Bundesliga (Austria)
    46,    // Swiss Super League (Switzerland)
    216,   // Super League 1 (Greece)
    202,   // Ekstraklasa (Poland)
    222,   // 1. Liga (Czech Republic)
    214,   // HNL (Croatia)
    203,   // Premier League (Russia)
    281,   // SuperLiga (Romania)
    240,   // Liga MX (Mexico)
    955,   // Saudi Pro League (Saudi Arabia)
    196,   // J1 League (Japan)
    197,   // K League 1 (South Korea)
    130,   // A-League Men (Australia)
    385,   // CONMEBOL Copa Sudamericana
    22,    // EFL Cup / Carabao Cup (England)
    14100, // CONCACAF Nations League
    11529, // Primera A (Colombia)
    1237,  // Primera A (Colombia alternative ID)
    11528, // Primera División (Chile)
    274,   // Primera División (Chile alternative ID)
    278,   // Primera División (Uruguay)
    11541, // Primera División (Paraguay)
    213    // Eerste Divisie (Netherlands)
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

        // 4. AMATEUR DETECTION
        const isAmateur = normalizedCategory.includes('amateur') || /amateur/i.test(normalizedName);

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
            isYouth,
            isAmateur
        };
    }

    /**
     * Determine Tier (1: Elite, 2: Upper-Mid, 3: Discovery/Risk)
     */
    getTier(fixtureOrLeague) {
        const meta = this.parseInput(fixtureOrLeague);
        const { normalizedName, normalizedCategory, uniqueTournamentId, userCount, isFriendly, isWomen, isYouth, isAmateur } = meta;

        if (!normalizedName && !uniqueTournamentId) return 3;

        // CRITICAL GUARD: Friendly, Women's, Youth, and Amateur matches are always Tier 3 (Discovery Only)
        if (isFriendly || isWomen || isYouth || isAmateur) {
            return 3;
        }

        // 1. FAST-PATH: Verified Unique Tournament ID Lookup
        // Official verified IDs take top priority (prevents false exclusions)
        if (uniqueTournamentId) {
            if (TIER_1_UNIQUE_IDS.has(uniqueTournamentId)) return 1;
            if (TIER_2_UNIQUE_IDS.has(uniqueTournamentId)) return 2;
        }

        // 2. EXCLUSION LIST: Lower divisions, reserve leagues, and unverified state leagues
        const lowerDivisionPatterns = [
            'serie c', 'serie d',
            '3. liga', '3.liga', 'regionalliga', 'oberliga',
            'national 1', 'national 2', 'national 3',
            'primera federacion', 'segunda federacion', 'tercera federacion', 'tercera division',
            'league one', 'league two', 'national league',
            'tff 2. lig', 'tff 3. lig', 'bal ligi',
            'reserves', 'reserve',
            // Brazilian State Leagues (NOT top-flight Serie A)
            'catarinense', 'cearense', 'paulista', 'carioca', 'mineiro', 'gaúcho', 'gaucho',
            'paranaense', 'baiano', 'pernambucano', 'goiano', 'amazonense', 'paraense',
            'alagoano', 'sergipano', 'potiguar', 'piauiense', 'maranhense', 'tocantinense',
            'mato-grossense', 'sul-mato-grossense', 'acreano', 'rondoniense', 'roraimense', 'amapaense'
        ];

        if (lowerDivisionPatterns.some(pattern => normalizedName.includes(pattern))) {
            return 3; // Discovery tier for lower leagues
        }

        // Minor / regional cup exclusion (protect prestige cups and continental tournaments)
        const isCupOrPlayoff = normalizedName.includes('cup') || normalizedName.includes('kupa') || 
                               normalizedName.includes('copa') || normalizedName.includes('taça') || 
                               normalizedName.includes('taca') || normalizedName.includes('playoff') || 
                               normalizedName.includes('play-off');

        const isMajorCup = normalizedName.includes('champions') ||
            normalizedName.includes('europa') ||
            normalizedName.includes('conference') ||
            normalizedName.includes('nations league') ||
            normalizedName.includes('world cup') ||
            normalizedName.includes('euro') ||
            normalizedName.includes('copa america') ||
            normalizedName.includes('libertadores') ||
            normalizedName.includes('sudamericana') ||
            normalizedName.includes('fa cup') ||
            normalizedName.includes('copa del rey') ||
            normalizedName.includes('dfb-pokal') ||
            normalizedName.includes('dfb pokal') ||
            normalizedName.includes('coppa italia') ||
            normalizedName.includes('coupe de france') ||
            normalizedName.includes('türkiye kupası') ||
            normalizedName.includes('turkiye kupasi') ||
            normalizedName.includes('carabao') ||
            normalizedName.includes('efl cup');

        if (isCupOrPlayoff && !isMajorCup) {
            return 3;
        }

        // 3. ORGANIC METADATA: High global follower count indicates top liquidity
        if (userCount >= 300000) return 1;
        if (userCount >= 40000) return 2;

        // 4. TEXT-BASED FALLBACK: Configured TIER_1 and TIER_2 strings
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
