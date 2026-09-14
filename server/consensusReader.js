/**
 * CONSENSUS READER SERVICE (Node.js Server)
 * Aggregates pre-match predictions from 10 sources in consensus_data.json
 * Provides top-tier high-agreement picks for Telegram broadcasts & API.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONSENSUS_FILE = path.join(__dirname, 'consensus_data.json');

const KNOWN_SOURCES = [
    'forebet',
    'predictz',
    'windrawwin',
    'vitibet',
    'zulubet',
    'prosoccer',
    'statarea',
    'olbg',
    'soccervista',
    'superbet'
];

function cleanTeamName(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .replace(/\b(fc|cf|sc|ac|as|cd|ud|sk|fk|bk|sv|ff|united|city|town|wanderers|rovers|athletic|atletico|real|sporting|inter|club|clube)\b/gi, '')
        .replace(/[^a-z0-9]/gi, '')
        .trim();
}

function isFuzzyMatch(h1, a1, h2, a2) {
    const ch1 = cleanTeamName(h1);
    const ca1 = cleanTeamName(a1);
    const ch2 = cleanTeamName(h2);
    const ca2 = cleanTeamName(a2);
    if (!ch1 || !ca1 || !ch2 || !ca2) return false;
    const hm = ch1 === ch2 || (ch1.length >= 4 && ch2.length >= 4 && (ch1.includes(ch2) || ch2.includes(ch1)));
    const am = ca1 === ca2 || (ca1.length >= 4 && ca2.length >= 4 && (ca1.includes(ca2) || ca2.includes(ca1)));
    return hm && am;
}

export class ConsensusReader {
    constructor() {
        this.cache = null;
        this.lastLoad = 0;
        this.cacheDuration = 60 * 1000; // 1 minute
    }

    loadRawData() {
        try {
            if (!fs.existsSync(CONSENSUS_FILE)) {
                return {};
            }
            const content = fs.readFileSync(CONSENSUS_FILE, 'utf8');
            return JSON.parse(content);
        } catch (e) {
            console.error('[CONSENSUS_READER] Failed to read consensus_data.json:', e.message);
            return {};
        }
    }

    /**
     * Aggregates all matches across all 10 sources
     */
    getAllMatches(market = '1X2') {
        const raw = this.loadRawData();
        const standings = raw.standings || [];
        const matchMap = {};

        for (const site of KNOWN_SOURCES) {
            const list = raw[site] || [];
            for (const item of list) {
                if (!item.home || !item.away) continue;

                let key = Object.keys(matchMap).find(k =>
                    isFuzzyMatch(matchMap[k].home, matchMap[k].away, item.home, item.away)
                );

                if (!key) {
                    key = `${item.home} vs ${item.away}`;
                    let cleanLeague = item.league || 'Genel';
                    if (cleanLeague.includes('adsbygoogle') || cleanLeague.includes('<script')) {
                        cleanLeague = 'Genel';
                    }

                    matchMap[key] = {
                        match: `${item.home} vs ${item.away}`,
                        home: item.home,
                        away: item.away,
                        league: cleanLeague,
                        date: item.date || null,
                        time: item.time || null,
                        predictions: {},
                        agreement: {},
                        probabilities: {},
                        scorePredictions: {},
                        form: item.form || null,
                        ranks: { home: '-', away: '-' },
                        points: { home: '-', away: '-' },
                        totalSources: 0,
                        market
                    };
                } else {
                    if (!matchMap[key].date && item.date) matchMap[key].date = item.date;
                    if (!matchMap[key].time && item.time) matchMap[key].time = item.time;
                    if (item.form && !matchMap[key].form) matchMap[key].form = item.form;
                    if (item.league && (matchMap[key].league === 'Genel' || site === 'soccervista')) {
                        matchMap[key].league = item.league;
                    }
                }

                // Market prediction normalization
                let pred = null;
                if (market === '1X2') {
                    pred = item.markets?.['1X2']?.pred || item.pred;
                } else if (market === 'OU25') {
                    pred = item.markets?.['OU25']?.pred;
                    if (pred) {
                        const lp = pred.toLowerCase();
                        if (lp.includes('over') || lp === 'üst') pred = 'Üst';
                        if (lp.includes('under') || lp === 'alt') pred = 'Alt';
                    }
                } else if (market === 'BTTS') {
                    pred = item.markets?.['BTTS']?.pred;
                    if (pred) {
                        const lp = pred.toLowerCase();
                        if (lp.includes('yes') || lp === 'kg var') pred = 'KG Var';
                        if (lp.includes('no') || lp === 'kg yok') pred = 'KG Yok';
                    }
                }

                if (pred && pred !== 'N/A') {
                    matchMap[key].predictions[site] = pred;
                    matchMap[key].agreement[pred] = (matchMap[key].agreement[pred] || 0) + 1;
                    matchMap[key].totalSources = Object.keys(matchMap[key].predictions).length;
                }

                const prob = item.markets?.[market]?.prob || item.prob;
                if (prob && prob !== '0') {
                    matchMap[key].probabilities[site] = prob;
                }

                if (item.score_pred && item.score_pred !== 'N/A') {
                    matchMap[key].scorePredictions[site] = item.score_pred;
                }
            }
        }

        // Enrich with standings if available
        if (Array.isArray(standings) && standings.length > 0) {
            for (const match of Object.values(matchMap)) {
                const hClean = cleanTeamName(match.home);
                const aClean = cleanTeamName(match.away);
                const hRow = standings.find(s => s.team && cleanTeamName(s.team) === hClean);
                const aRow = standings.find(s => s.team && cleanTeamName(s.team) === aClean);
                if (hRow) {
                    match.ranks.home = hRow.rank || '-';
                    match.points.home = hRow.points || '-';
                }
                if (aRow) {
                    match.ranks.away = aRow.rank || '-';
                    match.points.away = aRow.points || '-';
                }
            }
        }

        // Calculate top prediction, consensus percent & sort
        const results = Object.values(matchMap).map(m => {
            const sortedAgreement = Object.entries(m.agreement).sort((a, b) => b[1] - a[1]);
            const top = sortedAgreement[0] || ['N/A', 0];
            const topPred = top[0];
            const topCount = top[1];
            const agreementPercent = m.totalSources > 0 ? Math.round((topCount / m.totalSources) * 100) : 0;

            return {
                ...m,
                topPred,
                topCount,
                agreementPercent
            };
        });

        return results;
    }

    /**
     * Filter and return the highest consensus ("En Garanti") matches
     */
    getTopConsensusPicks(options = {}) {
        const {
            minSources = 4,
            minAgreement = 75,
            market = '1X2',
            limit = 5
        } = options;

        const all = this.getAllMatches(market);

        return all
            .filter(m => m.totalSources >= minSources && m.agreementPercent >= minAgreement)
            .sort((a, b) => {
                // 1. Highest agreement percent (e.g. 100% > 83%)
                if (b.agreementPercent !== a.agreementPercent) {
                    return b.agreementPercent - a.agreementPercent;
                }
                // 2. Highest number of agreeing sources (e.g. 7/7 > 4/4)
                if (b.topCount !== a.topCount) {
                    return b.topCount - a.topCount;
                }
                // 3. Most total sources
                return b.totalSources - a.totalSources;
            })
            .slice(0, limit);
    }
}

export const consensusReader = new ConsensusReader();
