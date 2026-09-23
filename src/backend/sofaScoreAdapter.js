/**
 * SOFASCORE DATA ADAPTER
 * Focus: XHR/JSON extraction and normalization.
 */

import { CONFIG } from '../config.js';
import { database, ref, get } from '../firebase/config.js';

// Central live odds in-memory cache to prevent redundant HTTP requests
let centralOddsCache = null;
let centralOddsCacheTime = 0;

async function getLiveOddsMap() {
    const now = Date.now();
    if (centralOddsCache && (now - centralOddsCacheTime < 25000)) {
        return centralOddsCache;
    }
    const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const primaryUrl = isLocalDev
        ? ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001')
        : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

    try {
        const res = await fetch(`${primaryUrl}/api/odds/live`, { signal: AbortSignal.timeout(3500) });
        if (res.ok) {
            const data = await res.json();
            centralOddsCache = data;
            centralOddsCacheTime = now;
            return data;
        }
    } catch (e) {
        // Fallback to Render cloud if local dev proxy was unreachable
        if (isLocalDev && (primaryUrl.includes('localhost') || primaryUrl.includes('127.0.0.1'))) {
            try {
                const cloudRes = await fetch('https://live-bet-mentor.onrender.com/api/odds/live', { signal: AbortSignal.timeout(4000) });
                if (cloudRes.ok) {
                    const data = await cloudRes.json();
                    centralOddsCache = data;
                    centralOddsCacheTime = now;
                    return data;
                }
            } catch (cloudErr) {}
        }
    }
    return centralOddsCache || {};
}

// Module-level caches and in-flight request deduplication maps for ultra-fast UI rendering
const adapterGraphCache = new Map();
const adapterIncidentsCache = new Map();
const adapterStatsCache = new Map();
const inFlightGraph = new Map();
const inFlightIncidents = new Map();
const inFlightStats = new Map();
let adapterLiveEventsCache = [];
let adapterLiveEventsTime = 0;

export const sofaScoreAdapter = {
    _graphCache: adapterGraphCache,
    _incidentsCache: adapterIncidentsCache,
    _statsCache: adapterStatsCache,

    /**
     * Synchronously returns cached attack momentum graph points if available
     */
    getCachedGraph(eventId) {
        if (!eventId) return null;
        const cached = adapterGraphCache.get(eventId);
        if (cached && (Date.now() - cached.time < 180000)) {
            return cached.data?.graphPoints || null;
        }
        return null;
    },

    /**
     * Synchronously returns cached match incidents if available
     */
    getCachedIncidents(eventId) {
        if (!eventId) return null;
        const cached = adapterIncidentsCache.get(eventId);
        if (cached && (Date.now() - cached.time < 180000)) {
            return cached.data || null;
        }
        return null;
    },
    /**
     * Fetches the match list for the current day.
     */
    async fetchScheduledEvents() {
        try {
            // Detect environment: Local dev uses local proxy, any deployed domain uses cloud/Firebase
            const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const isProduction = !isLocalDev;

            if (isLocalDev) {
                // LOCAL DEVELOPMENT: Try local proxy first (faster, no Firebase quota)
                const proxyUrl = ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001') + '/api/sofascore/live';
                let data = null;

                try {
                    const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(3500) });
                    if (response.ok) {
                        data = await response.json();
                    }
                } catch (localErr) {
                    // Local proxy offline -> proceed to cloud fallback
                }

                // If local proxy failed or returned empty events, fallback to Render cloud
                if (!data || !data.events || data.events.length === 0) {
                    try {
                        const cloudUrl = 'https://live-bet-mentor.onrender.com/api/sofascore/live';
                        const cloudRes = await fetch(cloudUrl, { signal: AbortSignal.timeout(8000) });
                        if (cloudRes.ok) {
                            data = await cloudRes.json();
                        }
                    } catch (cloudErr) {
                        console.warn('[SOFASCORE_ADAPTER] Render fallback error:', cloudErr.message);
                    }
                }

                if (data && data.events) {
                    const normalized = [];
                    for (const event of data.events) {
                        try {
                            const n = this.normalizeEvent(event);
                            if (n) normalized.push(n);
                        } catch (err) {
                            console.error('[SOFASCORE_ADAPTER] Normalization failed for event:', event.id, err.message);
                        }
                    }

                    const totalMatches = data.events.length;
                    console.log(`[SOFASCORE_ADAPTER] Discovered ${totalMatches} total. After normalization: ${normalized.length} active football matches.`);
                    
                    if (normalized.length === 0 && totalMatches > 0) {
                        console.warn('[SOFASCORE_ADAPTER] All matches were filtered out. Check normalizeEvent() logic.');
                    }
                    
                    if (normalized.length > 0) {
                        adapterLiveEventsCache = normalized;
                        adapterLiveEventsTime = Date.now();
                    }
                    return normalized;
                }
                return adapterLiveEventsCache && adapterLiveEventsCache.length > 0 ? adapterLiveEventsCache : [];
            } else {
                // PRODUCTION: Use Render backend proxy (replaces Firebase)
                const renderUrl = (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com') + '/api/sofascore/live';
                try {
                    const response = await fetch(renderUrl, { signal: AbortSignal.timeout(8000) });
                    if (!response.ok) {
                        console.warn('[SOFASCORE_ADAPTER] Render proxy error:', response.status);
                        // Fallback to Firebase
                        try {
                            const snapshot = await get(ref(database, 'live_events'));
                            if (snapshot.exists()) {
                                const fbData = snapshot.val();
                                if (fbData && fbData.events) {
                                    const fbNorm = fbData.events.map(event => this.normalizeEvent(event)).filter(e => e !== null);
                                    if (fbNorm.length > 0) {
                                        adapterLiveEventsCache = fbNorm;
                                        adapterLiveEventsTime = Date.now();
                                        return fbNorm;
                                    }
                                }
                            }
                        } catch (fbErr) {}
                        return (adapterLiveEventsCache && adapterLiveEventsCache.length > 0) ? adapterLiveEventsCache : [];
                    }
                    const data = await response.json();
                    if (data && data.events) {
                        const normalized = data.events
                            .map(event => this.normalizeEvent(event))
                            .filter(event => event !== null);
                        console.log(`[SOFASCORE_ADAPTER] RENDER: Found ${data.events.length} total, ${normalized.length} active football matches`);
                        if (normalized.length > 0) {
                            adapterLiveEventsCache = normalized;
                            adapterLiveEventsTime = Date.now();
                            return normalized;
                        }
                    }
                } catch (renderErr) {
                    console.warn('[SOFASCORE_ADAPTER] Render fetch failed, trying Firebase fallback:', renderErr.message);
                    try {
                        const snapshot = await get(ref(database, 'live_events'));
                        if (snapshot.exists()) {
                            const fbData = snapshot.val();
                            if (fbData && fbData.events) {
                                const fbNorm = fbData.events.map(event => this.normalizeEvent(event)).filter(e => e !== null);
                                if (fbNorm.length > 0) {
                                    adapterLiveEventsCache = fbNorm;
                                    adapterLiveEventsTime = Date.now();
                                    return fbNorm;
                                }
                            }
                        }
                    } catch (fbErr) {}
                }
                // If both Render and Firebase fail, return last known cached live events (prevents UI flicker)
                if (adapterLiveEventsCache && adapterLiveEventsCache.length > 0) {
                    console.log(`[SOFASCORE_ADAPTER] Using cached live events: ${adapterLiveEventsCache.length} matches`);
                    return adapterLiveEventsCache;
                }
                return [];
            }
        } catch (error) {
            console.error('[SOFASCORE_ADAPTER] Error fetching:', error);
            return (adapterLiveEventsCache && adapterLiveEventsCache.length > 0) ? adapterLiveEventsCache : [];
        }
    },

    /**
     * Light normalization for list view.
     */
    normalizeEvent(event) {
        if (!event) return null;

        // CRITICAL: Strict filtering to match SofaScore "Live" (Football) count
        // 1. Sport ID check (ID 1 is Football)
        const sportId = event.tournament?.category?.sport?.id;
        // RELAXED: If sportId is missing, assume it's football because the endpoint is sport/football
        if (sportId && sportId !== 1) return null; 

        // 2. Anti-Ghost filter: Reject matches that started > 5.5 hours ago or are scheduled > 1 hour in future
        const nowSec = Date.now() / 1000;
        const startTs = event.startTimestamp || nowSec;
        if ((nowSec - startTs) > 5.5 * 3600) {
            return null; // Ghost match stuck in SofaScore feed from earlier
        }
        if ((startTs - nowSec) > 3600) {
            return null; // Postponed/rescheduled amateur match with future timestamp
        }

        // 3. Must be Active (Filter out anything finished, ended, canceled or delayed)
        const statusType = (event.status?.type || '').toLowerCase();
        const statusDesc = (event.status?.description || '').toLowerCase();

        const isActuallyFinished = statusType === 'finished' || 
            statusDesc.includes('ended') || statusDesc.includes('finished') || 
            statusDesc.includes('canceled') || statusDesc.includes('bitti') || 
            statusDesc.includes('ertele') || statusDesc.includes('iptal');

        if (isActuallyFinished) return null;
        if (statusType === 'notstarted' && !statusDesc.includes('live')) return null;

        const calculatedMinute = this.calculateMinute(event);
        if (calculatedMinute === 'MS' || calculatedMinute === 'FT' || calculatedMinute === 'Ert.') {
            return null;
        }

        const homeTeamId = event.homeTeam?.id;
        const awayTeamId = event.awayTeam?.id;

        return {
            id: event.id,
            homeTeam: event.homeTeam?.name || 'Home',
            awayTeam: event.awayTeam?.name || 'Away',
            homeTeamId,
            awayTeamId,
            homeTeamLogo: homeTeamId ? `https://img.sofascore.com/api/v1/team/${homeTeamId}/image` : null,
            awayTeamLogo: awayTeamId ? `https://img.sofascore.com/api/v1/team/${awayTeamId}/image` : null,
            homeColors: event.homeTeam?.teamColors,
            awayColors: event.awayTeam?.teamColors,
            leagueName: event.tournament?.name || 'Unknown League',
            score: {
                home: event.homeScore?.current ?? 0,
                away: event.awayScore?.current ?? 0
            },
            minute: this.calculateMinute(event),
            status: event.status,
            time: event.time,
            statusTime: event.statusTime,
            cards: {
                home: { yellow: 0, red: event.homeRedCards || 0 },
                away: { yellow: 0, red: event.awayRedCards || 0 }
            },
            stats: {
                possession: { home: 0, away: 0 },
                shotsOnGoal: { home: 0, away: 0 },
                dangerousAttacks: { home: 0, away: 0 },
                corners: { home: 0, away: 0 },
                xg: { home: 0, away: 0 },
                cards: {
                    home: { yellow: 0, red: event.homeRedCards || 0 },
                    away: { yellow: 0, red: event.awayRedCards || 0 }
                }
            },
            isPartial: true,
            latency: 0,
            dataQuality: 'BASIC',
            source: 'SOFASCORE'
        };
    },

    /**
     * Fetches full details for a specific event.
     */
    fetchEventDetails: async (eventId) => {
        const startTime = Date.now();

        try {
            const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const isProduction = !isLocalDev;

            if (isLocalDev) {
                // LOCAL DEVELOPMENT: Try local proxy for stats, fallback to Render cloud
                const proxyBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001';
                let detailRes = null;
                let statsRes = null;

                try {
                    [detailRes, statsRes] = await Promise.all([
                        fetch(`${proxyBase}/api/sofascore/event/${eventId}`, { signal: AbortSignal.timeout(3500) }),
                        fetch(`${proxyBase}/api/sofascore/event/${eventId}/statistics`, { signal: AbortSignal.timeout(3500) })
                    ]);
                } catch (localErr) {
                    // Local proxy offline -> fallback to Render cloud
                    try {
                        const renderBase = 'https://live-bet-mentor.onrender.com';
                        [detailRes, statsRes] = await Promise.all([
                            fetch(`${renderBase}/api/sofascore/event/${eventId}`, { signal: AbortSignal.timeout(7000) }),
                            fetch(`${renderBase}/api/sofascore/event/${eventId}/statistics`, { signal: AbortSignal.timeout(7000) })
                        ]);
                    } catch (cloudErr) {
                        return null;
                    }
                }

                const latency = Date.now() - startTime;

                // Detail must be successful (200) - 202 means "queued, not ready yet"
                if (!detailRes || (!detailRes.ok && detailRes.status !== 202)) {
                    return null;
                }

                const detail = await detailRes.json();
                let stats = null;

                if (statsRes.ok) {
                    stats = await statsRes.json();
                } else if (statsRes.status === 404) {
                    // Match has no in-depth stats on SofaScore (normal for minor/youth leagues)
                    stats = { statistics: [] };
                } else if (statsRes.status === 202) {
                    stats = { status: 'queued' };
                }

                // If detail is queued (not ready), return null
                if (detail.status === 'queued') {
                    return null;
                }

                if (detail?.error) return null;

                const normalized = sofaScoreAdapter.normalize(detail, stats || { statistics: [] });
                normalized.latency = latency;
                return normalized;
            } else {
                // PRODUCTION: Use Render backend proxy
                const renderBase = import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com';
                try {
                    const [detailRes, statsRes] = await Promise.all([
                        fetch(`${renderBase}/api/sofascore/event/${eventId}`),
                        fetch(`${renderBase}/api/sofascore/event/${eventId}/statistics`)
                    ]);

                    const latency = Date.now() - startTime;

                    if (!detailRes.ok && detailRes.status !== 202) return null;

                    const detail = await detailRes.json();
                    let stats = null;
                    if (statsRes.ok) stats = await statsRes.json();
                    else if (statsRes.status === 404) stats = { statistics: [] };
                    else if (statsRes.status === 202) stats = { status: 'queued' };

                    if (detail.status === 'queued' || detail?.error) return null;

                    const normalized = sofaScoreAdapter.normalize(detail, stats || { statistics: [] });
                    normalized.latency = latency;
                    return normalized;
                } catch (renderErr) {
                    // Fallback to Firebase
                    try {
                        const [detailSnap, statsSnap] = await Promise.all([
                            get(ref(database, `stats/${eventId}/detail`)),
                            get(ref(database, `stats/${eventId}/stats`))
                        ]);
                        if (!detailSnap.exists()) return null;
                        const detail = detailSnap.val();
                        const stats = statsSnap.exists() ? statsSnap.val() : { statistics: [] };
                        if (detail?.error) return null;
                        const normalized = sofaScoreAdapter.normalize(detail, stats);
                        normalized.latency = Date.now() - startTime;
                        return normalized;
                    } catch { return null; }
                }
            }
        } catch (error) {
            console.error(`SofaScore fetchEventDetails Error for ${eventId}:`, error);
            return null;
        }
    },

    /**
     * Fetches minute-by-minute attack momentum graph for a match.
     */
    async fetchEventGraph(eventId) {
        if (!eventId) return { graphPoints: [], noGraph: false, isQueued: false };
        const now = Date.now();
        const cached = adapterGraphCache.get(eventId);
        if (cached && (now - cached.time < 60000)) {
            return cached.data;
        }
        if (inFlightGraph.has(eventId)) {
            return inFlightGraph.get(eventId);
        }

        const promise = (async () => {
            try {
                const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const apiBase = isLocalDev
                    ? ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001')
                    : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

                const res = await fetch(`${apiBase}/api/sofascore/event/${eventId}/graph`, {
                    signal: AbortSignal.timeout(4000)
                });
                if (res.ok) {
                    const data = await res.json();
                    const points = data?.graphPoints || data?.graphPointsV2 || [];
                    const result = {
                        graphPoints: Array.isArray(points) ? points : [],
                        noGraph: Boolean(data?.noGraph),
                        isQueued: data?.status === 'queued'
                    };
                    adapterGraphCache.set(eventId, { time: Date.now(), data: result });
                    return result;
                }
            } catch (e) {
                console.warn(`[SOFASCORE_ADAPTER] Graph fetch failed for ${eventId}:`, e.message);
            }
            return { graphPoints: [], noGraph: false, isQueued: false };
        })().finally(() => {
            inFlightGraph.delete(eventId);
        });

        inFlightGraph.set(eventId, promise);
        return promise;
    },

    /**
     * Fetches match incidents (goals, cards, substitutions, periods) for timeline.
     */
    async fetchEventIncidents(eventId) {
        if (!eventId) return [];
        const now = Date.now();
        const cached = adapterIncidentsCache.get(eventId);
        if (cached && (now - cached.time < 60000)) {
            return cached.data;
        }
        if (inFlightIncidents.has(eventId)) {
            return inFlightIncidents.get(eventId);
        }

        const promise = (async () => {
            try {
                const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const apiBase = isLocalDev
                    ? ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001')
                    : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

                const res = await fetch(`${apiBase}/api/sofascore/event/${eventId}/incidents`, {
                    signal: AbortSignal.timeout(4000)
                });
                if (res.ok) {
                    const data = await res.json();
                    const incidents = Array.isArray(data?.incidents) ? data.incidents : [];
                    incidents.isQueued = data?.status === 'queued';
                    incidents.noIncidents = Boolean(data?.noIncidents);
                    adapterIncidentsCache.set(eventId, { time: Date.now(), data: incidents });
                    return incidents;
                }
            } catch (e) {
                console.warn(`[SOFASCORE_ADAPTER] Incidents fetch failed for ${eventId}:`, e.message);
            }
            const empty = [];
            empty.isQueued = false;
            empty.noIncidents = false;
            return empty;
        })().finally(() => {
            inFlightIncidents.delete(eventId);
        });

        inFlightIncidents.set(eventId, promise);
        return promise;
    },

    /**
     * Fetches match statistics (possession, shots, corners, etc.).
     */
    async fetchEventStatistics(eventId) {
        if (!eventId) return [];
        const now = Date.now();
        const cached = adapterStatsCache.get(eventId);
        if (cached && (now - cached.time < 45000)) {
            return cached.data;
        }
        if (inFlightStats.has(eventId)) {
            return inFlightStats.get(eventId);
        }

        const promise = (async () => {
            try {
                const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const apiBase = isLocalDev
                    ? ((typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001')
                    : (import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com');

                const res = await fetch(`${apiBase}/api/sofascore/event/${eventId}/statistics`, {
                    signal: AbortSignal.timeout(4000)
                });
                if (res.ok) {
                    const data = await res.json();
                    const stats = data?.statistics || [];
                    adapterStatsCache.set(eventId, { time: Date.now(), data: stats });
                    return stats;
                }
            } catch (e) {
                console.warn(`[SOFASCORE_ADAPTER] Statistics fetch failed for ${eventId}:`, e.message);
            }
            return [];
        })().finally(() => {
            inFlightStats.delete(eventId);
        });

        inFlightStats.set(eventId, promise);
        return promise;
    },

    /**
     * Fetches central live odds for all active matches in 1 single network call.
     */
    async fetchCentralOdds() {
        try {
            const data = await getLiveOddsMap();
            const formatted = {};
            if (data && typeof data === 'object') {
                for (const [key, val] of Object.entries(data)) {
                    if (val && (val.home !== undefined || val.away !== undefined)) {
                        formatted[key] = {
                            home: parseFloat(val.home) || 0,
                            draw: parseFloat(val.draw) || 0,
                            away: parseFloat(val.away) || 0,
                            source: val.source || 'LIVE_ODDS'
                        };
                    }
                }
            }
            return formatted;
        } catch (e) {
            return {};
        }
    },

    /**
     * Fetches live odds (1-X-2) for a specific event directly from SofaScore or Proxy.
     */
    async fetchEventOdds(eventId) {
        try {
            // 1. Instant check from central live odds map (prevents 40 redundant HTTP requests)
            const central = await getLiveOddsMap();
            const strId = String(eventId);
            const numId = Number(eventId);
            const matchOdds = central[strId] || central[numId] || (central.matches && central.matches.find(m => String(m.id || m.eventId) === strId)?.odds);
            if (matchOdds && (matchOdds.home !== undefined || matchOdds.away !== undefined)) {
                return {
                    home: parseFloat(matchOdds.home) || 0,
                    draw: parseFloat(matchOdds.draw) || 0,
                    away: parseFloat(matchOdds.away) || 0,
                    source: matchOdds.source || 'CENTRAL_ODDS'
                };
            }

            const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            let data = null;

            if (isLocalDev) {
                // LOCAL: Use proxy for odds (much faster)
                const proxyBase = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || 'http://127.0.0.1:3001';
                const res = await fetch(`${proxyBase}/api/sofascore/event/${eventId}/odds/1/all`, { signal: AbortSignal.timeout(3000) });
                if (res.ok) data = await res.json();
            } else {
                // PRODUCTION: Use Render backend proxy, Firebase as fallback
                const renderBase = import.meta.env?.VITE_API_BASE_URL || 'https://live-bet-mentor.onrender.com';
                try {
                    const res = await fetch(`${renderBase}/api/sofascore/event/${eventId}/odds/1/all`, { signal: AbortSignal.timeout(3000) });
                    if (res.ok) data = await res.json();
                } catch {
                    try {
                        const snapshot = await get(ref(database, `odds/${eventId}`));
                        if (snapshot.exists()) data = snapshot.val();
                    } catch {}
                }
            }

            if (!data) return null;

            // Direct 1-X-2 format (from proxy or live_odds.json)
            if (data.home !== undefined && data.away !== undefined) {
                return {
                    home: parseFloat(data.home) || 0,
                    draw: parseFloat(data.draw) || 0,
                    away: parseFloat(data.away) || 0,
                    source: data.source || 'LOCAL_PROXY'
                };
            }

            // SofaScore market structure (Full Time 1X2 market)
            if (data.markets) {
                const ftMarket = data.markets.find(m => m.id === 1 || m.marketId === 1 || m.marketName?.toLowerCase() === 'full time' || m.marketGroup === '1X2');
                if (ftMarket && ftMarket.choices) {
                    const parseChoice = (c) => {
                        if (!c) return 0;
                        for (const k of ['decimalValue', 'value']) {
                            if (c[k] !== undefined && c[k] !== null) {
                                const v = parseFloat(c[k]);
                                if (!isNaN(v) && v > 0) return v;
                            }
                        }
                        const frac = c.fractionalValue || c.initialFractionalValue;
                        if (frac) {
                            const parts = String(frac).trim().split('/');
                            if (parts.length === 2) {
                                const num = parseFloat(parts[0]);
                                const den = parseFloat(parts[1]);
                                if (!isNaN(num) && !isNaN(den) && den > 0) {
                                    return parseFloat(((num / den) + 1.0).toFixed(2));
                                }
                            }
                        }
                        return 0;
                    };

                    const homeChoice = ftMarket.choices.find(c => c.name === '1' || c.idx === 1);
                    const drawChoice = ftMarket.choices.find(c => c.name === 'X' || c.idx === 2);
                    const awayChoice = ftMarket.choices.find(c => c.name === '2' || c.idx === 3);

                    const homeOdds = parseChoice(homeChoice);
                    const drawOdds = parseChoice(drawChoice);
                    const awayOdds = parseChoice(awayChoice);

                    if (homeOdds > 0 || awayOdds > 0) {
                        return {
                            home: homeOdds,
                            draw: drawOdds,
                            away: awayOdds,
                            source: 'SOFASCORE_DIRECT'
                        };
                    }
                }
            }
            return null;
        } catch (error) {
            console.warn(`[SOFASCORE_ADAPTER] Odds fetch failed for ${eventId}:`, error.message);
            return null;
        }
    },

    /**
     * Normalizes SofaScore data to our internal schema.
     */
    normalize(detail, stats) {
        const event = detail.event;
        let isPartial = false;
        let dataQuality = 'OK';

        const normalizedStats = {
            possession: { home: 0, away: 0 },
            shotsOnGoal: { home: 0, away: 0 },
            dangerousAttacks: { home: 0, away: 0 },
            corners: { home: 0, away: 0 },
            xg: { home: 0, away: 0 },
            bigChances: { home: 0, away: 0 },
            totalShots: { home: 0, away: 0 },
            cards: { home: { yellow: 0, red: 0 }, away: { yellow: 0, red: 0 } },
            rawStats: {}
        };

        if (stats.statistics && stats.statistics.length > 0) {
            const allStats = stats.statistics.find(s => s.period === 'ALL');
            if (allStats) {
                normalizedStats.groups = allStats.groups;
                allStats.groups.forEach(group => {
                    group.statisticsItems.forEach(item => {
                        const name = item.name.toLowerCase();
                        const homeVal = item.home;
                        const awayVal = item.away;

                        const parseVal = (v) => {
                            if (typeof v === 'string') {
                                return parseFloat(v.replace('%', '')) || 0;
                            }
                            return parseFloat(v) || 0;
                        };

                        // Unified mapping with fallbacks and more synonyms
                        if (name.includes('possession')) {
                            normalizedStats.possession.home = parseVal(homeVal);
                            normalizedStats.possession.away = parseVal(awayVal);
                        }

                        if (name.includes('shots on target') || name === 'shots on goal' || name === 'isabetli şut') {
                            normalizedStats.shotsOnGoal.home = parseVal(homeVal);
                            normalizedStats.shotsOnGoal.away = parseVal(awayVal);
                        }

                        if (name === 'total shots' || name === 'shots' || name === 'toplam şut') {
                            normalizedStats.totalShots.home = parseVal(homeVal);
                            normalizedStats.totalShots.away = parseVal(awayVal);
                        }

                        if (name === 'dangerous attacks' || name === 'dangerous attack' || name === 'tehlikeli atak') {
                            normalizedStats.dangerousAttacks.home = parseVal(homeVal);
                            normalizedStats.dangerousAttacks.away = parseVal(awayVal);
                        } else if (name === 'final third entries' || name === 'final third phase') {
                            if (normalizedStats.dangerousAttacks.home === 0 && normalizedStats.dangerousAttacks.away === 0) {
                                normalizedStats.dangerousAttacks.home = parseVal(homeVal);
                                normalizedStats.dangerousAttacks.away = parseVal(awayVal);
                            }
                        } else if (name === 'touches in penalty area' && normalizedStats.dangerousAttacks.home === 0 && normalizedStats.dangerousAttacks.away === 0) {
                            normalizedStats.dangerousAttacks.home = parseVal(homeVal);
                            normalizedStats.dangerousAttacks.away = parseVal(awayVal);
                        }

                        if (name === 'big chances' || name === 'büyük şans') {
                            normalizedStats.bigChances.home = parseVal(homeVal);
                            normalizedStats.bigChances.away = parseVal(awayVal);
                        }

                        if ((name === 'expected goals' || name === 'xg' || name === 'beklenen gol') && !name.includes('target')) {
                            normalizedStats.xg.home = parseVal(homeVal);
                            normalizedStats.xg.away = parseVal(awayVal);
                        } else if (name.includes('expected goals on target') || name === 'xgot') {
                            normalizedStats.xgot = { home: parseVal(homeVal), away: parseVal(awayVal) };
                        }

                        if (name === 'corner kicks' || name === 'corners' || name === 'köşe vuruşu') {
                            normalizedStats.corners.home = parseVal(homeVal);
                            normalizedStats.corners.away = parseVal(awayVal);
                        }

                        if (name === 'yellow cards') {
                            normalizedStats.cards.home.yellow = parseVal(homeVal);
                            normalizedStats.cards.away.yellow = parseVal(awayVal);
                        }
                        if (name === 'red cards') {
                            normalizedStats.cards.home.red = parseVal(homeVal);
                            normalizedStats.cards.away.red = parseVal(awayVal);
                        }

                        normalizedStats.rawStats[item.name] = { home: homeVal, away: awayVal };
                    });
                });
                normalizedStats.groups = allStats.groups;
                if (event) {
                    normalizedStats.cards.home.red = Math.max(normalizedStats.cards.home.red || 0, event.homeRedCards || 0);
                    normalizedStats.cards.away.red = Math.max(normalizedStats.cards.away.red || 0, event.awayRedCards || 0);
                }

                // Fallback: If dangerous attacks not explicitly tracked by league, estimate from actual actions (shots & corners)
                if (normalizedStats.dangerousAttacks.home === 0 && normalizedStats.dangerousAttacks.away === 0) {
                    const shotsHome = normalizedStats.totalShots.home || 0;
                    const shotsAway = normalizedStats.totalShots.away || 0;
                    const cornersHome = normalizedStats.corners.home || 0;
                    const cornersAway = normalizedStats.corners.away || 0;
                    if (shotsHome > 0 || shotsAway > 0 || cornersHome > 0 || cornersAway > 0) {
                        normalizedStats.dangerousAttacks.home = Math.round((shotsHome * 2) + (cornersHome * 2));
                        normalizedStats.dangerousAttacks.away = Math.round((shotsAway * 2) + (cornersAway * 2));
                    }
                }

                // Determine quality based on major stats
                const hasMajorStats = normalizedStats.shotsOnGoal.home > 0 || normalizedStats.shotsOnGoal.away > 0 ||
                    normalizedStats.dangerousAttacks.home > 0 || normalizedStats.dangerousAttacks.away > 0;

                // We only mark as partial if we have absolutely no groups or very few items
                const totalItems = allStats.groups.reduce((acc, g) => acc + g.statisticsItems.length, 0);

                if (totalItems < 3) {
                    isPartial = true;
                    dataQuality = 'PARTIAL';
                } else if (!hasMajorStats) {
                    isPartial = false; // Show what we have
                    dataQuality = 'LIMITED';
                } else {
                    isPartial = false;
                    dataQuality = 'OK';
                }
            } else {
                // No 'ALL' period stats found - but we might have other periods?
                // For now, treat as partial but KEEP the metadata from detail
                isPartial = true;
                dataQuality = 'PARTIAL';
            }
        } else {
            // No stats object at all - check if we have basic info in detail
            isPartial = true;
            dataQuality = 'EMPTY';
        }

        const homeTeamId = event?.homeTeam?.id;
        const awayTeamId = event?.awayTeam?.id;

        return {
            id: event.id,
            homeTeam: event.homeTeam?.name || 'Home',
            awayTeam: event.awayTeam?.name || 'Away',
            homeTeamId,
            awayTeamId,
            homeTeamLogo: homeTeamId ? `https://img.sofascore.com/api/v1/team/${homeTeamId}/image` : null,
            awayTeamLogo: awayTeamId ? `https://img.sofascore.com/api/v1/team/${awayTeamId}/image` : null,
            homeColors: event.homeTeam?.teamColors,
            awayColors: event.awayTeam?.teamColors,
            league: event.tournament?.name || 'Unknown',
            leagueName: event.tournament?.name || 'Unknown',
            leagueId: event.tournament?.id,
            category: event.tournament?.category?.name,
            status: event.status?.description,
            minute: this.calculateMinute ? this.calculateMinute(event) : (event.status?.description || '0\''),
            score: {
                home: event.homeScore?.current || 0,
                away: event.awayScore?.current || 0
            },
            stats: normalizedStats,
            cards: normalizedStats.cards,
            isPartial,
            dataQuality,
            timestamp: Date.now(),
            source: 'SOFASCORE'
        };
    },

    /**
     * Calculates the current live minute from SofaScore statusTime.
     */
    calculateMinute(event) {
        if (!event || !event.status) return "0'";

        const status = event.status || {};
        const code = status.code;
        const statusType = (status.type || '').toLowerCase();
        const desc = (status.description || '').trim();
        const descLower = desc.toLowerCase();

        // 1. Canceled / Postponed / Suspended / Interrupted / Abandoned
        if (code === 91 || code === 92 || code === 93 || code === 94 || code === 95 ||
            descLower.includes('postponed') || descLower.includes('canceled') || 
            descLower.includes('interrupted') || descLower.includes('suspended') || 
            descLower.includes('abandoned') || descLower.includes('ertele') || descLower.includes('iptal')) {
            return desc || 'Ert.';
        }

        // 2. Not started
        if (statusType === 'notstarted' || code === 0) {
            return desc || "0'";
        }

        // 3. Halftime / Devre Arası (CRITICAL: Must check BEFORE finished because 'halftime' contains 'ft')
        if (code === 31 || descLower === 'halftime' || descLower === 'ht' || 
            descLower.includes('halftime') || descLower.includes('half-time') || 
            (descLower.includes('half') && descLower.includes('time')) || descLower.includes('devre')) {
            return 'İY';
        }

        // 4. Finished / Maç Sonu
        if (statusType === 'finished' || code === 100 || 
            descLower === 'ft' || descLower === 'ended' || descLower === 'finished' || 
            descLower.includes('bitti') || descLower.includes('sona') ||
            /\b(ft|finished|ended|full time|full-time)\b/i.test(desc)) {
            return 'MS';
        }

        // 5. Live in progress: Use SofaScore's own clock formula
        // SofaScore calculates: displaySec = min(initial + elapsedFromPeriodStart, max)
        const timeObj = event.time || {};
        const statusTime = event.statusTime || {};
        const now = Math.floor(Date.now() / 1000);

        // Overtime / Extra time
        if (descLower.includes('extra') || code === 14 || code === 15 || code === 16) {
            const periodStart = statusTime.timestamp || timeObj.currentPeriodStartTimestamp;
            const periodElapsedMin = periodStart ? Math.floor(Math.max(0, now - periodStart) / 60) : 0;
            return `${90 + periodElapsedMin}'`;
        }

        // Penaltılar
        if (descLower.includes('penalties') || code === 120) {
            return 'Pen.';
        }

        // Use SofaScore's clock fields: initial, max, extra, timestamp
        const initialSec = statusTime.initial ?? timeObj.initial ?? (code === 7 ? 2700 : 0);
        const maxSec = statusTime.max ?? timeObj.max ?? (code === 7 ? 5400 : 2700);
        const extraSec = statusTime.extra ?? timeObj.extra ?? 540; // 9 min default
        const periodTimestamp = statusTime.timestamp || timeObj.currentPeriodStartTimestamp || event.startTimestamp;

        const elapsedSec = periodTimestamp ? Math.max(0, now - periodTimestamp) : 0;

        // SofaScore formula: clamp to max
        const rawSec = initialSec + elapsedSec;
        const maxMinute = Math.floor(maxSec / 60); // 45 for 1st half, 90 for 2nd half

        // Check if we're in stoppage/injury time (past 45' in 1st half, or past 90' in 2nd half)
        if (rawSec > maxSec) {
            // Extreme safety guard: if a match has been running for > 80 mins in a single period
            // and the feed died, force end it
            if (elapsedSec > 80 * 60) {
                if (code === 6 || descLower.includes('1st')) {
                    return 'İY';
                }
                return 'MS';
            }
            // During live in-progress stoppage time, SofaScore displays "90+" or "45+"
            return `${maxMinute}+`;
        }

        // Normal time within period
        const displayMin = Math.floor(rawSec / 60);
        return `${Math.max(1, displayMin)}'`;
    }
};
