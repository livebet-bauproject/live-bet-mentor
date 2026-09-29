import { CONFIG } from '../config';

export class LeagueProfileModule {
    constructor() {
        // Historical averages (Mock for observation)
        this.profiles = {
            'Premier_League': { avgGoals: 2.8, lateGoalProb: 0.22 },
            'Super_Lig': { avgGoals: 2.6, lateGoalProb: 0.25 },
            'Bundesliga': { avgGoals: 3.1, lateGoalProb: 0.18 }
        };
    }

    getTier(leagueName) {
        if (!leagueName) return 3;
        const tiers = CONFIG.MODULAR_SYSTEM.LEAGUE_TIERS;
        const normalizedName = leagueName.toLowerCase().trim();



        // EXCLUSION LIST: Never match these as Tier 1 or 2
        const excludedPatterns = [
            'serie b', 'serie c', 'serie d',       // Lower divisions (Brazil, Italy, etc.)
            'segunda', '2. liga', '2.liga',        // Second divisions
            'u20', 'u21', 'u19', 'u23', 'u18', 'u17', // Youth leagues
            'women', 'kadın', 'feminino',          // Women's leagues
            'reserve', 'reserves',                  // Reserve leagues
            'cup', 'kupa', 'copa',                  // Cup competitions (except Champions/Europa)
            'playoff', 'play-off',                 // Playoff matches
            'copinha',                              // Brazilian youth cup
            'group a', 'group b', 'group c', 'group d', 'group e', 'group f', 'group g', 'group h',  // Group stage of minor leagues
            'grupo',                                // Spanish/Portuguese group stages
            // Brazilian State Leagues (NOT top-flight Serie A)
            'catarinense', 'cearense', 'paulista', 'carioca', 'mineiro', 'gaúcho', 'gaucho',
            'paranaense', 'baiano', 'pernambucano', 'goiano', 'amazonense', 'paraense',
            'alagoano', 'sergipano', 'potiguar', 'piauiense', 'maranhense', 'tocantinense',
            'mato-grossense', 'sul-mato-grossense', 'acreano', 'rondoniense', 'roraimense', 'amapaense',
            // Other regional/minor leagues
            'a.f.', 'taça', 'taca'                 // Portuguese amateur/cup
        ];

        // If league contains an excluded pattern, skip to Tier 3
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

        // Special handling for "Serie A" - must be specifically the main league, not a state championship
        // "Serie A" should only match if the league name is EXACTLY "Serie A" or starts with "Serie A"
        // NOT if it's something like "Catarinense, Serie A"
        const isRealSerieA = normalizedName === 'serie a' ||
            normalizedName.startsWith('serie a ') ||
            normalizedName === 'serie a tim' ||  // Official Italy Serie A name
            normalizedName.includes('brasileirão') || normalizedName.includes('brasileirao') ||
            normalizedName.includes('campeonato brasileiro serie a');

        // Helper: Check if league name matches (more strict matching)
        const matchesLeague = (tierLeague) => {
            const tierLower = tierLeague.toLowerCase();

            // Special case for Serie A - require strict matching
            if (tierLower === 'serie a') {
                return isRealSerieA;
            }

            // Special case for UEFA Nations League (matches "UEFA Nations League, League A, Gr. 3", etc.)
            if ((tierLower === 'nations league' || tierLower === 'uefa nations league') && normalizedName.includes('nations league')) {
                return true;
            }

            // Exact match
            if (normalizedName === tierLower) return true;

            // Contains match - the whole tier league name must be found within the actual league name
            // This handles cases like "UEFA Champions League" containing "Champions League"
            if (normalizedName.includes(tierLower)) return true;

            // Handle Turkish variations (Süper Lig / Super Lig)
            if (tierLower === 'süper lig' && (normalizedName === 'super lig' || normalizedName.includes('süper lig') || normalizedName.includes('super lig'))) return true;

            return false;
        };

        // Check Tier 1
        if (tiers.TIER_1.some(l => matchesLeague(l))) return 1;

        // Check Tier 2
        if (tiers.TIER_2.some(l => matchesLeague(l))) return 2;

        return 3; // Default to Discovery
    }

    getProfile(leagueName) {
        if (!CONFIG.MODULAR_SYSTEM.OPTIONAL_MODULES.LEAGUE_PROFILES) {
            return { tier: this.getTier(leagueName) };
        }

        const key = Object.keys(this.profiles).find(pk => leagueName?.includes(pk.replace('_', ' '))) || 'default';

        return {
            leagueName,
            tier: this.getTier(leagueName),
            ...this.profiles[key] || { avgGoals: 2.5, lateGoalProb: 0.20 },
            observation: 'LEAGUE_TRAIT_LOGGING'
        };
    }
}

export const leagueProfileModule = new LeagueProfileModule();
