/**
 * CONSENSUS ADAPTER
 * Normalizes external predictions and applies fuzzy logic for team matching.
 */
import { CONFIG } from '../config.js';
import { database, ref, get } from '../firebase/config.js';

const cleanCache = new Map();

export const consensusAdapter = {
    async fetchConsensus() {
        try {
            const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            if (isLocalDev) {
                // LOCAL: Read from proxy which serves consensus_data.json
                const proxyBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
                const response = await fetch(`${proxyBase}/api/consensus`);
                if (!response.ok) {
                    console.warn('[CONSENSUS_ADAPTER] Proxy returned:', response.status);
                    return null;
                }
                const data = await response.json();
                console.log(`[CONSENSUS_ADAPTER] LOCAL: Loaded consensus with ${Object.keys(data).length} sources`);
                return data;
            } else {
                // PRODUCTION: Use Firebase
                const snapshot = await get(ref(database, 'consensus'));
                if (!snapshot.exists()) return null;
                return snapshot.val();
            }
        } catch (error) {
            console.error('[CONSENSUS_ADAPTER] Error:', error);
            return null;
        }
    },

    _clean(name) {
        if (!name || typeof name !== 'string') return "";
        const cached = cleanCache.get(name);
        if (cached !== undefined) return cached;

        let cleaned = name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/\bmilano\b/g, 'milan')
            .replace(/\blisboa\b/g, 'lisbon')
            .replace(/\bpraha\b/g, 'prague')
            .replace(/\bmadeira\b/g, 'nacional')
            .replace(/\bnottm\b/g, 'nottingham')
            .replace(/\bspurs\b/g, 'tottenham')
            .replace(/\bhove albion\b/g, '') // Brighton & Hove Albion -> Brighton
            .replace(/\s+vs\s+/g, ' ')
            .replace(/\s+v\s+/g, ' ')
            .replace(/\s+-\s+/g, ' ')
            .replace(/\b(manchester)\b/g, 'man')
            // Noise abbreviations only
            .replace(/\b(ac|fc|sc|cf|cd|ud|sd|rc|cp|fk|as|ssc|lfc|afc|rsc|youth|u20|u19|u23|reserve|reserves|calcio|club|deportivo)\b/g, '')
            .replace(/[^a-z0-9]/g, '');

        // If cleaning stripped too much (e.g. "FC" or "Real" or "Sporting"), fallback to basic alphanumeric
        if (cleaned.length < 2) {
            cleaned = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
        }

        cleanCache.set(name, cleaned);
        if (cleanCache.size > 10000) cleanCache.clear();
        return cleaned;
    },

    _isFuzzyMatchClean(h1, a1, h2, a2) {
        if (!h1 || !a1 || !h2 || !a2) return false;
        if (h1.length < 2 || a1.length < 2 || h2.length < 2 || a2.length < 2) return false;

        const homeMatch = h1 === h2 || 
            (h1.length >= 4 && h2.length >= 4 && (h1.includes(h2) || h2.includes(h1)));
        const awayMatch = a1 === a2 || 
            (a1.length >= 4 && a2.length >= 4 && (a1.includes(a2) || a2.includes(a1)));

        return homeMatch && awayMatch;
    },

    _isFuzzyMatch(home1, away1, home2, away2) {
        return this._isFuzzyMatchClean(
            this._clean(home1),
            this._clean(away1),
            this._clean(home2),
            this._clean(away2)
        );
    },

    /**
     * Fuzzy match helper to link external names to our local fixtures
     * Ex: "Man City" matches "Manchester City"
     */
    findMatchInConsensus(siteData, fixtureHome, fixtureAway) {
        if (!siteData || !Array.isArray(siteData)) return null;

        // If only 1 argument passed as string (e.g. "TeamA TeamB")
        let home = fixtureHome;
        let away = fixtureAway;
        if (!away && typeof home === 'string') {
            const parts = home.split(/\s+(?:vs|v|-)\s+/i);
            if (parts.length >= 2) {
                home = parts[0];
                away = parts[1];
            }
        }

        if (home && away) {
            const hClean = this._clean(home);
            const aClean = this._clean(away);

            // Fast path 1: direct exact clean match
            const exact = siteData.find(p => this._clean(p.home) === hClean && this._clean(p.away) === aClean);
            if (exact) return exact;

            // Fast path 2: fuzzy match with cached cleaned strings
            const fuzzy = siteData.find(p => this._isFuzzyMatchClean(hClean, aClean, this._clean(p.home), this._clean(p.away)));
            if (fuzzy) return fuzzy;
        }

        // Fallback for combined string matching (strictly requiring BOTH teams)
        const targetClean = this._clean(typeof home === 'string' && typeof away === 'string' ? `${home} ${away}` : home);
        if (!targetClean || targetClean.length < 5) return null;

        return siteData.find(p => {
            const homeClean = this._clean(p.home);
            const awayClean = this._clean(p.away);
            if (!homeClean || !awayClean || homeClean.length < 3 || awayClean.length < 3) return false;
            return targetClean.includes(homeClean) && targetClean.includes(awayClean);
        });
    },

    _getStandings(globalData, leagueName, teamName) {
        if (!globalData.standings) return { rank: '-', points: '-' };

        // Find the matching league using fuzzy matching
        const leagueClean = this._clean(leagueName);
        const leagueEntry = Object.entries(globalData.standings).find(([lName, table]) => {
            return this._clean(lName) === leagueClean ||
                this._clean(lName).includes(leagueClean) ||
                leagueClean.includes(this._clean(lName));
        });

        if (!leagueEntry) return { rank: '-', points: '-' };
        const leagueTable = leagueEntry[1];

        // Try exact match for team
        if (leagueTable[teamName]) return leagueTable[teamName];

        // Try fuzzy match for team
        const teamClean = this._clean(teamName);
        const match = Object.entries(leagueTable).find(([tName, data]) => {
            const tClean = this._clean(tName);
            return tClean === teamClean || tClean.includes(teamClean) || teamClean.includes(tClean);
        });

        return match ? match[1] : { rank: '-', points: '-' };
    },

    getConsensusSummary(globalData, fixture, market = '1X2') {
        const report = {
            totalSources: 0,
            agreement: {},
            signals: []
        };

        Object.entries(globalData).forEach(([site, matches]) => {
            if (!Array.isArray(matches)) return;
            const match = this.findMatchInConsensus(matches, fixture.homeTeam, fixture.awayTeam);
            if (match && match.markets && match.markets[market]) {
                const mData = match.markets[market];
                report.totalSources++;
                report.signals.push({
                    site,
                    prediction: mData.pred,
                    prob: mData.prob,
                    score_pred: match.score_pred, // Pass score if available
                    form: match.form // Pass form if available
                });

                // Track consensus agreement
                const pred = mData.pred;
                report.agreement[pred] = (report.agreement[pred] || 0) + 1;
            }
        });

        return report;
    },

    /**
     * Get summary for ALL matches in the consensus data (Pre-match view)
     * @param {Object} globalData Ham veri
     * @param {String} selectedMarket '1X2', 'OU25', 'BTTS'
     */
    getAllConsensusSummary(globalData, selectedMarket = '1X2') {
        if (!globalData || Object.keys(globalData).length === 0) return [];

        const matchMap = {}; // Key: "homeClean_awayClean"

        Object.entries(globalData).forEach(([site, matches]) => {
            if (!Array.isArray(matches)) return;

            matches.forEach(m => {
                // Skip if this match doesn't have the selected market
                if (!m.markets || !m.markets[selectedMarket]) return;

                const mData = m.markets[selectedMarket];
                const home = m.home.trim();
                const away = m.away.trim();
                const homeClean = this._clean(home);
                const awayClean = this._clean(away);

                // Find existing match: Check direct key first (O(1) fast path)
                const directKey = `${homeClean}_S_${awayClean}`;
                let key = matchMap[directKey] ? directKey : null;

                // Fallback to fuzzy scanning only if direct key not found
                if (!key) {
                    key = Object.keys(matchMap).find(k => {
                        const [exHome, exAway] = k.split('_S_');
                        if (!exHome || !exAway || !homeClean || !awayClean) return false;
                        const homeMatch = homeClean === exHome || 
                            (homeClean.length >= 4 && exHome.length >= 4 && (homeClean.includes(exHome) || exHome.includes(homeClean)));
                        const awayMatch = awayClean === exAway || 
                            (awayClean.length >= 4 && exAway.length >= 4 && (awayClean.includes(exAway) || exAway.includes(awayClean)));
                        return homeMatch && awayMatch;
                    });
                }

                if (!key) {
                    key = directKey;
                    let cleanLeague = m.league || 'Others';
                    if (cleanLeague.includes('adsbygoogle') || cleanLeague.includes('<script')) cleanLeague = 'Others';

                    matchMap[key] = {
                        match: `${home} vs ${away}`,
                        home,
                        away,
                        league: cleanLeague,
                        predictions: {},
                        agreement: {},
                        probabilities: {},
                        tipCounts: {},
                        scorePredictions: {},
                        odds: {}, // New: Store odds
                        ranks: { home: '-', away: '-' }, // New: Store Rank
                        points: { home: '-', away: '-' }, // New: Store Points
                        totalSources: 0,
                        divergence: 0,
                        isValue: false,
                        market: selectedMarket,
                        date: m.date || null,
                        time: m.time || null,
                        form: m.form || null // Store Home/Away form
                    };

                    // Enrich with Standings immediately
                    const hStandings = this._getStandings(globalData, cleanLeague, home);
                    const aStandings = this._getStandings(globalData, cleanLeague, away);
                    matchMap[key].ranks = { home: hStandings.rank, away: aStandings.rank };
                    matchMap[key].points = { home: hStandings.points, away: aStandings.points };
                } else {
                    // Update missing date/time if this source has it
                    if (!matchMap[key].date && m.date) matchMap[key].date = m.date;
                    if (!matchMap[key].time && m.time) matchMap[key].time = m.time;

                    // Prefer cleaner league name if current one is messy
                    const isNewLeagueBetter = m.league &&
                        (matchMap[key].league === 'Others' ||
                            matchMap[key].league.includes('adsbygoogle') ||
                            matchMap[key].league.toLowerCase().includes('maç özeti') ||
                            matchMap[key].league.toLowerCase().includes('summary') ||
                            (site === 'soccervista' && matchMap[key].league !== m.league));

                    if (isNewLeagueBetter) {
                        matchMap[key].league = m.league;
                        // Re-enrich standings if league changed
                        const hStandings = this._getStandings(globalData, m.league, home);
                        const aStandings = this._getStandings(globalData, m.league, away);
                        matchMap[key].ranks = { home: hStandings.rank, away: aStandings.rank };
                        matchMap[key].points = { home: hStandings.points, away: aStandings.points };
                    }

                    // Prefer form from a source that has it (like SoccerVista)
                    if (!matchMap[key].form && m.form) {
                        matchMap[key].form = m.form;
                    }
                }

                // Capture Odds if available (Forebet)
                if (mData.odds) {
                    matchMap[key].odds[site] = mData.odds;
                }

                // Normalization
                let normalizedPred = mData.pred;
                if (selectedMarket === 'BTTS') {
                    const p = normalizedPred.toLowerCase();
                    if (p.includes('yes') || p === '1' || p === 'kg var' || p === 'y') normalizedPred = 'KG Var';
                    if (p.includes('no') || p === '0' || p === 'kg yok' || p === 'n') normalizedPred = 'KG Yok';
                }
                if (selectedMarket === 'OU25') {
                    const p = normalizedPred.toLowerCase();
                    if (p.includes('over') || p === 'o' || p === 'üst' || p === 'üst 2.5') normalizedPred = 'Üst';
                    if (p.includes('under') || p === 'u' || p === 'alt' || p === 'alt 2.5') normalizedPred = 'Alt';
                }

                matchMap[key].predictions[site] = normalizedPred;
                if (mData.prob && mData.prob !== "0") {
                    matchMap[key].probabilities[site] = mData.prob;
                }

                if (mData.tip_count) {
                    matchMap[key].tipCounts[site] = mData.tip_count;
                }

                if (m.score_pred && m.score_pred !== "N/A") {
                    matchMap[key].scorePredictions[site] = m.score_pred;
                }

                matchMap[key].agreement[normalizedPred] = (matchMap[key].agreement[normalizedPred] || 0) + 1;
                matchMap[key].totalSources = Object.keys(matchMap[key].predictions).length;
            });
        });

        // Post-process for Divergence and Value
        Object.values(matchMap).forEach(m => {
            const uniquePreds = Object.keys(m.agreement).length;
            m.divergence = uniquePreds > 1 ? (uniquePreds / m.totalSources) * 100 : 0;

            // Value Detection: Forebet & OLBG prob check
            const forebetProb = m.probabilities.forebet ? parseInt(m.probabilities.forebet) : 0;
            const olbgProb = m.probabilities.olbg ? parseInt(m.probabilities.olbg) : 0;

            if (forebetProb >= CONFIG.MODULAR_SYSTEM.ADVANCED_ANALYSIS.VALUE_DETECTION.MIN_CONSENSUS_PROB ||
                olbgProb >= CONFIG.MODULAR_SYSTEM.ADVANCED_ANALYSIS.VALUE_DETECTION.MIN_CONSENSUS_PROB) {
                m.isValue = true;
            }
        });

        // Sort by agreement strength
        return Object.values(matchMap)
            .filter(m => m.totalSources >= 1)
            .sort((a, b) => {
                const aMax = Math.max(...Object.values(a.agreement));
                const bMax = Math.max(...Object.values(b.agreement));
                return bMax - aMax;
            });
    }
};
