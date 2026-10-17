/**
 * 📌 LIVE MATCH FOLLOWER & LOCK-SCREEN TELEMETRY ENGINE (v1.0)
 * Allows users to pin matches and receive real-time web notifications,
 * dynamic tab title ticker, lock-screen alerts, and audio/haptic triggers.
 */

import { triggerHaptic } from './haptics.js';
import { audioAlert } from './audioAlert.js';

class LiveMatchFollower {
    constructor() {
        this.pinnedMatchId = null;
        this.lastState = null; // { scoreHome, scoreAway, pressure, minute }
        this.hasNotificationPermission = false;
        this.originalTitle = typeof document !== 'undefined' ? document.title : 'LiveBet Mentor';

        this.init();
    }

    init() {
        if (typeof window === 'undefined') return;

        // Restore pinned match from localStorage
        try {
            const saved = localStorage.getItem('pinned_match_id');
            if (saved) {
                this.pinnedMatchId = saved;
            }
        } catch (e) {}

        // Check notification permission
        if (typeof Notification !== 'undefined') {
            this.hasNotificationPermission = Notification.permission === 'granted';
        }
    }

    /**
     * Request browser notification permission
     */
    async requestPermission() {
        if (typeof Notification === 'undefined') return false;
        try {
            const res = await Notification.requestPermission();
            this.hasNotificationPermission = res === 'granted';
            return this.hasNotificationPermission;
        } catch (e) {
            return false;
        }
    }

    /**
     * Toggle pinning a match
     */
    togglePin(match, lang = 'tr') {
        if (!match) return false;
        const matchId = String(match.id || match.matchId);
        this.lang = lang || this.lang || 'tr';

        if (this.pinnedMatchId === matchId) {
            // Unpin
            this.pinnedMatchId = null;
            this.lastState = null;
            localStorage.removeItem('pinned_match_id');
            if (typeof document !== 'undefined') {
                document.title = this.originalTitle;
            }
            triggerHaptic('light');
            return false;
        } else {
            // Pin
            this.pinnedMatchId = matchId;
            localStorage.setItem('pinned_match_id', matchId);
            this.requestPermission();
            triggerHaptic('success');

            const isTr = this.lang === 'tr';
            const isDe = this.lang === 'de';

            const defaultHome = isTr ? 'Ev Sahibi' : (isDe ? 'Heimteam' : 'Home Team');
            const defaultAway = isTr ? 'Deplasman' : (isDe ? 'Auswärtsteam' : 'Away Team');
            const home = match.homeTeam || match.home?.name || defaultHome;
            const away = match.awayTeam || match.away?.name || defaultAway;
            const score = match.score || { home: 0, away: 0 };
            const pressure = Number(match.observations?.pressure?.total || match.pressure?.total || 0);

            this.lastState = {
                scoreHome: Number(score.home || 0),
                scoreAway: Number(score.away || 0),
                pressure,
                minute: Number(match.minute || 0)
            };

            const notifTitle = isTr 
                ? `📌 Takibe Alındı: ${home} vs ${away}` 
                : (isDe ? `📌 Angeheftet: ${home} vs. ${away}` : `📌 Match Pinned: ${home} vs ${away}`);
            const notifBody = isTr 
                ? `Canlı Skor: ${score.home}-${score.away} • Dakika: ${match.minute}'` 
                : (isDe ? `Live-Stand: ${score.home}-${score.away} • Minute: ${match.minute}'` : `Live Score: ${score.home}-${score.away} • Minute: ${match.minute}'`);

            this.sendNotification(notifTitle, notifBody);
            return true;
        }
    }

    isPinned(matchId) {
        return this.pinnedMatchId === String(matchId);
    }

    getPinnedMatchId() {
        return this.pinnedMatchId;
    }

    /**
     * Process live events stream and dispatch notifications / title updates
     */
    updateTelemetry(fixtures = [], lang = null) {
        if (!this.pinnedMatchId || !Array.isArray(fixtures)) return;
        if (lang) this.lang = lang;
        const isTr = this.lang === 'tr';
        const isDe = this.lang === 'de';

        const match = fixtures.find(f => String(f.id || f.matchId) === this.pinnedMatchId);
        if (!match) return;

        const defaultHome = isTr ? 'Ev Sahibi' : (isDe ? 'Heimteam' : 'Home Team');
        const defaultAway = isTr ? 'Deplasman' : (isDe ? 'Auswärtsteam' : 'Away Team');
        const home = match.homeTeam || match.home?.name || defaultHome;
        const away = match.awayTeam || match.away?.name || defaultAway;
        const score = match.score || { home: 0, away: 0 };
        const scoreHome = Number(score.home || 0);
        const scoreAway = Number(score.away || 0);
        const minute = Number(match.minute || 0);
        const pressure = Number(match.observations?.pressure?.total || match.pressure?.total || 0);

        // 1. Dynamic Document Title Ticker (Works when user switches tabs or locks screen on PWA)
        if (typeof document !== 'undefined') {
            const flameTag = pressure >= 75 ? ' 🔥' : '';
            document.title = `(${scoreHome}-${scoreAway}) ⚽ ${minute}' ${home} vs ${away}${flameTag} | LiveBet`;
        }

        // 2. State delta detection
        if (this.lastState) {
            // Goal check
            if (scoreHome > this.lastState.scoreHome || scoreAway > this.lastState.scoreAway) {
                const scoringTeam = scoreHome > this.lastState.scoreHome ? home : away;
                const goalTitle = isTr 
                    ? `⚽ GOOOOL! ${scoringTeam}` 
                    : (isDe ? `⚽ TOOOOR! ${scoringTeam}` : `⚽ GOAL! ${scoringTeam}`);
                this.sendNotification(
                    goalTitle,
                    `${home} ${scoreHome} - ${scoreAway} ${away} (${minute}')`
                );
                triggerHaptic('flame');
                try { audioAlert?.playGoal?.(); } catch (e) {}
            }

            // Flame / Pressure surge check (Jump into >= 75 ALEV)
            if (pressure >= 75 && this.lastState.pressure < 75) {
                const flameTitle = isTr 
                    ? `🔥 ALEV ALDI: ${home} vs ${away}` 
                    : (isDe ? `🔥 FLAMMEN-ALARM: ${home} vs. ${away}` : `🔥 FLAME SURGE: ${home} vs ${away}`);
                const flameBody = isTr 
                    ? `Baskı Endeksi 75'i aştı (${pressure}/100)! Gol kokusu çok yüksek.` 
                    : (isDe ? `Druck-Index übersteigt 75 (${pressure}/100)! Akute Torgefahr.` : `Pressure index surged over 75 (${pressure}/100)! High goal danger.`);
                this.sendNotification(flameTitle, flameBody);
                triggerHaptic('fire');
            }
        }

        this.lastState = { scoreHome, scoreAway, pressure, minute };
    }

    /**
     * Dispatch browser push notification
     */
    sendNotification(title, body) {
        if (!this.hasNotificationPermission || typeof Notification === 'undefined') return;

        try {
            new Notification(title, {
                body,
                icon: '/logo.svg',
                tag: 'livebet-match-alert'
            });
        } catch (e) {}
    }
}

export const liveMatchFollower = new LiveMatchFollower();
