/**
 * LEAGUE TIER & LIQUIDITY GUARD v1.0
 * Institutional market depth and league integrity filtering.
 * Prevents false-positive signals in illiquid, highly volatile, or low-tier competitions.
 */

export class LeagueTierGuard {
    constructor() {
        // Tier 1: Premier Liquidity & Global Market Depth
        this.tier1Keywords = [
            'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1',
            'süper lig', 'super lig', 'champions league', 'europa league',
            'conference league', 'uefa', 'fa cup', 'copa del rey', 'dfb pokal',
            'coppa italia', 'world cup', 'euro championship'
        ];

        // Tier 2: Solid Competitive Senior Professional Leagues
        this.tier2Keywords = [
            'championship', 'eredivisie', 'primeira liga', 'trendyol 1. lig',
            '1. lig', 'pro league', 'premiership', 'bundesliga 2', 'serie b',
            'segunda division', 'ligue 2', 'super league', 'allsvenskan',
            'eliteserien', 'superliga', 'brasileirao', 'primera division'
        ];

        // Strict Auto-Disqualify Keywords (Youth, Amateur, University, Reserve)
        this.disqualifiedKeywords = [
            'u17', 'u18', 'u19', 'u20', 'u21', 'u23',
            'youth', 'reserves', 'reserve', 'amateur',
            'university', 'regional', 'hazırlık', 'friendly',
            'women', 'kadın', 'kadin', 'damen', 'femme'
        ];
    }

    evaluate(leagueName = '', categoryName = '') {
        const fullString = `${leagueName} ${categoryName}`.toLowerCase();

        // 1. Strict Exclusion Check
        for (const kw of this.disqualifiedKeywords) {
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            if (regex.test(fullString)) {
                return {
                    allowed: false,
                    tier: 4,
                    reason: `Amatör, Gençlik veya Hazırlık ligi (${kw}) - Canlı algoritmaya uygun değil`
                };
            }
        }

        // 2. Check Tier 1
        for (const kw of this.tier1Keywords) {
            if (fullString.includes(kw)) {
                return {
                    allowed: true,
                    tier: 1,
                    tierLabel: 'Tier 1 (Yüksek Likidite)',
                    minConfidence: 82,
                    minOdds: 1.48,
                    maxOdds: 2.85,
                    bonusWeight: 1.05
                };
            }
        }

        // 3. Check Tier 2
        for (const kw of this.tier2Keywords) {
            if (fullString.includes(kw)) {
                return {
                    allowed: true,
                    tier: 2,
                    tierLabel: 'Tier 2 (Standart Profesyonel)',
                    minConfidence: 85,
                    minOdds: 1.55,
                    maxOdds: 2.65,
                    bonusWeight: 1.0
                };
            }
        }

        // 4. Default: Tier 3 (Diğer resmi kıdemli ligler)
        // Alt kademelerde büro marjları yüksek olduğundan ekstra güven eşiği (%89) istenir
        return {
            allowed: true,
            tier: 3,
            tierLabel: 'Tier 3 (Gelişen / İkincil Lig)',
            minConfidence: 89,
            minOdds: 1.65,
            maxOdds: 2.45,
            bonusWeight: 0.95
        };
    }
}

export const leagueTierGuard = new LeagueTierGuard();
