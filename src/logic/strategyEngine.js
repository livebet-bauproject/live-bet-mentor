/**
 * MODULAR STRATEGY ENGINE (v2.1)
 * Inspired by BetBallers Manager architecture.
 * Independent algorithms for specific betting markets.
 */

export const strategyEngine = {
    /**
     * 🔥 BASKI DOMİNASYONU
     * Toplam baskı skoru ve dominant takımın üstünlüğü.
     */
    checkPressureDominance(match) {
        const stats = match.stats || {};
        const minute = match.minute || 0;
        const observations = match.observations || {};
        const pressure = observations.pressure || {};
        const threshold = 70; // 70+ Puan

        if (pressure.total >= threshold && pressure.dominantTeam !== 'NONE') {
            const team = pressure.dominantTeam === 'HOME' ? (match.homeTeam || 'Ev Sahibi') : (match.awayTeam || 'Deplasman');
            return {
                active: true,
                id: 'PRESS',
                label: `Sıradaki Gol: ${team}`,
                icon: '🔥',
                score: pressure.total,
                verdict: `${pressure.dominantTeam === 'HOME' ? 'Ev' : 'Dep'} Baskısı: ${pressure.total.toFixed(0)} Puan`,
                team
            };
        }
        return { active: false };
    },

    /**
     * ⚡ SON 15 DAKİKA İVMESİ (Momentum Burst)
     * Maçın genel gidişatına göre son 15 dakikadaki hızlanma.
     */
    checkMomentumBurst(match) {
        const history = (match.history && match.history.length > 0) ? match.history : (match.minuteHistory || []);
        const observations = match.observations || {};
        if (!history || history.length < 5) return { active: false };

        const latest = history[0];
        const fifteenAgo = history.find(h => (latest.timestamp - h.timestamp) >= 12 * 60 * 1000) || 
            (match.minuteHistory && match.minuteHistory.find(h => (latest.timestamp - h.timestamp) >= 12 * 60 * 1000)) || 
            history[history.length - 1];

        // Ensure at least 4 minutes of tracking elapsed
        if ((latest.timestamp - fifteenAgo.timestamp) < 4 * 60 * 1000) return { active: false };

        const attNow = (latest.stats?.dangerousAttacks?.home || 0) + (latest.stats?.dangerousAttacks?.away || 0);
        const attThen = (fifteenAgo.stats?.dangerousAttacks?.home || 0) + (fifteenAgo.stats?.dangerousAttacks?.away || 0);

        const growth = attThen > 0 ? (attNow - attThen) / Math.max(1, attThen) : 0;

        if (growth > 0.35 && observations.pressure?.total > 50) {
            return {
                active: true,
                id: 'MOMENTUM',
                label: 'SON 15DK PATLAMASI',
                icon: '⚡',
                score: growth * 100,
                verdict: `Son 15dk: %${(growth * 100).toFixed(0)} İvme Artışı`
            };
        }
        return { active: false };
    },

    /**
     * ⚽ İY 0.5 ÜST (Early Goal Expectation)
     * İlk 30 dakika içindeki yüksek tempo.
     */
    checkFHG(match) {
        const minute = match.minute || 0;
        const score = match.score || { home: 0, away: 0 };
        const observations = match.observations || {};
        const pressure = observations.pressure?.total || 0;

        if (minute > 10 && minute < 35 && score.home === 0 && score.away === 0 && pressure > 65) {
            return {
                active: true,
                id: 'FHG',
                label: 'İY 0.5 ÜST',
                icon: '🏆',
                score: pressure,
                verdict: `Dk:${minute} Erken Baskı Mevcut`
            };
        }
        return { active: false };
    },

    /**
     * 🔄 GERİ DÖNÜŞ (Comeback Alert)
     * Geriye düşen favori veya dominant takımın baskısı.
     */
    checkComeback(match) {
        const score = match.score || { home: 0, away: 0 };
        const observations = match.observations || {};
        const pressure = observations.pressure || {};

        const isHomeTrailing = score.home < score.away && pressure.dominantTeam === 'HOME';
        const isAwayTrailing = score.away < score.home && pressure.dominantTeam === 'AWAY';

        if ((isHomeTrailing || isAwayTrailing) && pressure.total > 60) {
            return {
                active: true,
                id: 'COMEBACK',
                label: 'GERİ DÖNÜŞ',
                icon: '💪',
                score: pressure.total,
                verdict: `Geriye Düşen Takım Baskıyı Artırdı`,
                team: isHomeTrailing ? match.homeTeam : match.awayTeam
            };
        }
        return { active: false };
    },

    /**
     * 🚀 GELİŞMİŞ GERİ DÖNÜŞ (Favorite Comeback)
     * Favori olup da geriye düşen takımın istatistiksel baskısı.
     */
    checkAdvancedComeback(match) {
        const score = match.score || { home: 0, away: 0 };
        const stats = match.stats || {};
        const observations = match.observations || {};
        const pressure = observations.pressure || {};
        
        // Favorite usually has significantly higher dangerous attacks or SOG
        const isHomeFav = (stats.shotsOnGoal?.home || 0) > (stats.shotsOnGoal?.away || 0) + 3;
        const isAwayFav = (stats.shotsOnGoal?.away || 0) > (stats.shotsOnGoal?.home || 0) + 3;

        const isHomeTrailing = score.home < score.away && isHomeFav && pressure.dominantTeam === 'HOME';
        const isAwayTrailing = score.away < score.home && isAwayFav && pressure.dominantTeam === 'AWAY';

        if ((isHomeTrailing || isAwayTrailing) && pressure.total > 75) {
            return {
                active: true,
                id: 'ADV_COMEBACK',
                label: 'FAVORİ GERİ DÖNÜŞ',
                icon: '🚀',
                score: pressure.total + 10,
                verdict: `Haksız Skor (Favori Baskıda)`,
                team: isHomeTrailing ? match.homeTeam : match.awayTeam
            };
        }
        return { active: false };
    },

    /**
     * 📈 YÜKSEK SKOR MARUZİYETİ (Over Exposure)
     * Her iki takımın da vites yükselttiği durumlar (2-0, 2-1 vb fark etmeksizin).
     */
    checkOverExposure(match) {
        const stats = match.stats || {};
        const observations = match.observations || {};
        const pressure = observations.pressure || {};
        const minute = match.minute || 0;

        const totalPressure = (pressure.home || 0) + (pressure.away || 0);
        const totalSog = (stats.shotsOnGoal?.home || 0) + (stats.shotsOnGoal?.away || 0);

        if (totalPressure > 130 && totalSog > 8 && minute > 50 && minute < 85) {
            return {
                active: true,
                id: 'OVER_EXPOSURE',
                label: 'SKOR MARUZİYETİ',
                icon: '📈',
                score: totalPressure / 1.5,
                verdict: `Açık Oyun & Çift Taraflı Baskı`
            };
        }
        return { active: false };
    },

    /**
     * 🎯 STAT DOMİNASYONU
     * Şut, korner, topla oynama ve xG verilerindeki belirgin üstünlük.
     */
    checkStatDominance(match) {
        const stats = match.stats || {};
        const sogHome = stats.shotsOnGoal?.home || 0;
        const sogAway = stats.shotsOnGoal?.away || 0;
        const xgHome = stats.xg?.home || 0;
        const xgAway = stats.xg?.away || 0;
        const possHome = stats.possession?.home || 50;
        const possAway = stats.possession?.away || 50;
        const shotsHome = stats.totalShots?.home || 0;
        const shotsAway = stats.totalShots?.away || 0;
        const cornersHome = stats.corners?.home || 0;
        const cornersAway = stats.corners?.away || 0;

        // Composite stat points: SOG * 3 + Shots * 1 + Corners * 1.5 + xG * 10 + (Poss - 50) * 0.8
        const homePoints = (sogHome * 3) + shotsHome + (cornersHome * 1.5) + (xgHome * 10) + ((possHome - 50) * 0.8);
        const awayPoints = (sogAway * 3) + shotsAway + (cornersAway * 1.5) + (xgAway * 10) + ((possAway - 50) * 0.8);

        // A team CANNOT be statistically dominant if in severe possession deficit (< 38%) or heavily outshot!
        const isHome = (homePoints > awayPoints * 1.35 + 15) && possHome >= 38 && (shotsHome >= shotsAway * 0.7);
        const isAway = (awayPoints > homePoints * 1.35 + 15) && possAway >= 38 && (shotsAway >= shotsHome * 0.7);

        if (isHome || isAway) {
            const team = isHome ? (match.homeTeam || 'Ev Sahibi') : (match.awayTeam || 'Deplasman');
            return {
                active: true,
                id: 'STATS',
                label: `Sıradaki Gol: ${team}`,
                icon: '📊',
                score: 80,
                verdict: `${isHome ? 'Ev' : 'Dep'} Net İstatistik Üstünlüğü`,
                team
            };
        }
        return { active: false };
    },

    /**
     * 🚩 KORNER BASKISI
     * Kısa sürede artan korner sayısı (Tehlikeli duran toplar).
     */
    checkCornerPressure(match) {
        const history = (match.history && match.history.length > 0) ? match.history : (match.minuteHistory || []);
        if (!history || history.length < 3) return { active: false };

        const latest = history[0];
        const tenAgo = history.find(h => (latest.timestamp - h.timestamp) >= 8 * 60 * 1000) || 
            (match.minuteHistory && match.minuteHistory.find(h => (latest.timestamp - h.timestamp) >= 8 * 60 * 1000)) || 
            history[history.length - 1];

        // Ensure at least 3 minutes of tracking elapsed
        if ((latest.timestamp - tenAgo.timestamp) < 3 * 60 * 1000) return { active: false };

        const cornersNow = (latest.stats?.corners?.home || 0) + (latest.stats?.corners?.away || 0);
        const cornersThen = (tenAgo.stats?.corners?.home || 0) + (tenAgo.stats?.corners?.away || 0);

        if ((cornersNow - cornersThen) >= 3) {
            const dominantTeam = (match.stats?.corners?.home || 0) > (match.stats?.corners?.away || 0) ? (match.homeTeam || 'Ev Sahibi') : (match.awayTeam || 'Deplasman');
            return {
                active: true,
                id: 'CORNERS',
                label: `Sıradaki Gol: ${dominantTeam}`,
                icon: '🚩',
                score: (cornersNow - cornersThen) * 20,
                verdict: `Son 10dk: ${cornersNow - cornersThen} Yeni Korner`,
                team: dominantTeam
            };
        }
        return { active: false };
    },

    /**
     * 🤝 KG VAR (BTTS)
     * Her iki takımın da gol pozisyonlarına girmesi.
     * SADECE henüz her iki takım birden gol atmamışsa aktiftir!
     */
    checkBTTS(match) {
        const curHome = Number(match.score?.home ?? match.homeScore?.current ?? 0);
        const curAway = Number(match.score?.away ?? match.awayScore?.current ?? 0);

        // Kural: Her iki takım zaten gol atmışsa (1-1, 1-2, 2-1 vb.) KG Var BİTMİŞTİR, canlıda önerilemez!
        if (curHome >= 1 && curAway >= 1) {
            return { active: false };
        }

        const stats = match.stats || {};
        const observations = match.observations || {};
        const xg = stats.xg || { home: 0, away: 0 };
        const pressure = observations.pressure?.total || 0;

        if (xg.home > 0.8 && xg.away > 0.8 && pressure > 50) {
            return {
                active: true,
                id: 'BTTS',
                label: 'KG VAR',
                icon: '🤝',
                score: 75,
                verdict: `Çift Taraflı xG ve Baskı`
            };
        }
        return { active: false };
    },

    /**
     * 🟥 SAYISAL ÜSTÜNLÜK (Red Card Tactical Advantage)
     * Rakip takım 10 kişi kalmışken dominant tarafın baskısı.
     */
    checkRedCardAdvantage(match) {
        const observations = match.observations || {};
        const pressure = observations.pressure || {};
        const redCards = pressure.redCards || {};
        const minute = parseInt(match.minute) || 0;

        if (redCards.advantage && redCards.advantage !== 'NONE' && redCards.advantage !== 'BALANCED_REDS') {
            const advTeam = redCards.advantage === 'HOME' ? match.homeTeam : match.awayTeam;
            const diffCards = Math.abs((redCards.home || 0) - (redCards.away || 0));
            const teamPressure = redCards.advantage === 'HOME' ? (pressure.home || 0) : (pressure.away || 0);

            // Condition: Advantage team has at least 45 pressure, match before 85'
            if (teamPressure >= 45 && minute < 85) {
                return {
                    active: true,
                    id: 'RED_CARD_ADV',
                    label: 'SAYISAL ÜSTÜNLÜK',
                    icon: '🟥',
                    score: Math.min(100, teamPressure + (diffCards * 15)),
                    verdict: `${advTeam} +${diffCards} Kişi Fazla Oynuyor (${teamPressure} Baskı)`,
                    team: advTeam
                };
            }
        }
        return { active: false };
    },

    /**
     * Runs all enabled strategies and returns results.
     */
    runAll(match, enabledStrategies = {}) {
        const results = [];
        
        // Final fallback consistency check (requested by user)
        const hasXG = match.stats?.xg?.home > 0 || match.stats?.xg?.away > 0;
        if (enabledStrategies.ONLY_XG && !hasXG) return [];

        const strategyList = [
            this.checkPressureDominance,
            this.checkMomentumBurst,
            this.checkFHG,
            this.checkComeback,
            this.checkAdvancedComeback,
            this.checkOverExposure,
            this.checkStatDominance,
            this.checkCornerPressure,
            this.checkBTTS,
            this.checkRedCardAdvantage
        ];

        for (const stratFn of strategyList) {
            const res = stratFn.call(this, match);
            if (res.active) {
                // If strategy is explicitly disabled in settings, skip it
                if (enabledStrategies[res.id] !== false) {
                    results.push(res);
                }
            }
        }

        return results;
    }
};
