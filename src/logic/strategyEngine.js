/**
 * MODULAR STRATEGY ENGINE (v2.1)
 * Inspired by BetBallers Manager architecture.
 * Independent algorithms for specific betting markets.
 */

export const strategyEngine = {
    _parseMinute(match) {
        const raw = match.minute ?? 0;
        if (typeof raw === 'number') return raw;
        const str = String(raw).trim();
        if (str === 'MS' || str.includes('FT') || str.toLowerCase().includes('ended') || str === 'Pen.') return 999;
        if (str === 'İY' || str === 'HT') return -2;
        if (str.includes('90+') || str === '90+') return 95;
        if (str.includes('45+') || str === '45+') return 46;
        const num = parseInt(str.replace(/[^0-9]/g, ''));
        return isNaN(num) ? 0 : num;
    },

    _getScoreDiff(match) {
        let home = 0;
        let away = 0;
        if (match.score && typeof match.score === 'object') {
            home = Number(match.score.home ?? 0) || 0;
            away = Number(match.score.away ?? 0) || 0;
        } else if (match.homeScore !== undefined || match.awayScore !== undefined) {
            home = Number(match.homeScore?.current ?? match.homeScore ?? 0) || 0;
            away = Number(match.awayScore?.current ?? match.awayScore ?? 0) || 0;
        } else if (typeof match.score === 'string' && match.score.includes('-')) {
            const parts = match.score.split('-');
            home = parseInt(parts[0]) || 0;
            away = parseInt(parts[1]) || 0;
        }
        return {
            home,
            away,
            total: home + away,
            diff: Math.abs(home - away)
        };
    },

    /**
     * 🔥 BASKI DOMİNASYONU
     * Toplam baskı skoru ve dominant takımın üstünlüğü.
     */
    checkPressureDominance(match) {
        const minute = this._parseMinute(match);
        const score = this._getScoreDiff(match);

        // 1. Katı Erken/Geç Dakika & Bitiş Filtresi (15 altı erken, 82+ dakikada sıradaki gol kumar/ölü sinyaldir)
        if (minute < 15 || minute >= 82 || minute === 999) return { active: false };

        // 2. Taktiksel Rehavet & Kopmuş Maç Filtresi (Game-State Blindness Veto):
        // 2+ farkla önde olan takımlar (örn: 4-1, 3-0, 3-1) rölantiye alır, as oyuncuları çıkarır.
        // Önde olan takıma sıradaki gol verilmesi kesinlikle yasaklanmalıdır!
        const isHomeLeadingComfortably = (score.home - score.away) >= 2;
        const isAwayLeadingComfortably = (score.away - score.home) >= 2;
        if (score.diff >= 3) return { active: false };
        if (minute >= 60 && score.diff >= 2) return { active: false };

        const stats = match.stats || {};
        const observations = match.observations || {};
        const pressure = observations.pressure || {};
        const threshold = 72; // VIP Hassasiyet Eşiği: 72+ Puan

        if (pressure.total >= threshold && pressure.dominantTeam !== 'NONE') {
            // Rehavet Veto: Önde olan takıma "Sıradaki Gol" üretilmesi engellenir
            if (pressure.dominantTeam === 'HOME' && isHomeLeadingComfortably) return { active: false };
            if (pressure.dominantTeam === 'AWAY' && isAwayLeadingComfortably) return { active: false };

            // 3. MOMENTUM ÇELİŞKİSİ VETOSU (Stale Cumulative Stats Guard):
            // Maçın genelinde ev sahibi topla oynamış olsa bile, son 15-20 dakikada rakip takım
            // sahayı tek kaleye çevirmişse (örn: +10 atak, %75+ momentum), oyunu düşmüş takıma sıradaki gol önerilemez!
            const history = (match.history && match.history.length > 0) ? match.history : (match.minuteHistory || []);
            if (history && history.length >= 2) {
                const latest = history[0];
                const prev = history.find(h => (latest.timestamp - h.timestamp) >= 10 * 60 * 1000) || history[history.length - 1];
                if (prev && latest.stats && prev.stats) {
                    const daHomeRecent = (latest.stats.dangerousAttacks?.home || 0) - (prev.stats.dangerousAttacks?.home || 0);
                    const daAwayRecent = (latest.stats.dangerousAttacks?.away || 0) - (prev.stats.dangerousAttacks?.away || 0);
                    
                    if (pressure.dominantTeam === 'HOME' && daAwayRecent >= (daHomeRecent + 8)) {
                        return { active: false }; // Ev sahibinin temposu çöktü, deplasman yükleniyor
                    }
                    if (pressure.dominantTeam === 'AWAY' && daHomeRecent >= (daAwayRecent + 8)) {
                        return { active: false }; // Deplasmanın temposu çöktü, ev sahibi yükleniyor
                    }
                }
            }

            const team = pressure.dominantTeam === 'HOME' ? (match.homeTeam || 'Ev Sahibi') : (match.awayTeam || 'Deplasman');
            // Calibrate confidence percentage realistically (55% - 82%)
            const confidence = Math.min(82, Math.max(55, Math.round(55 + (pressure.total - threshold) * 0.4)));

            return {
                active: true,
                id: 'PRESS',
                label: `Sıradaki Gol: ${team}`,
                icon: '🔥',
                score: confidence,
                confidence,
                pressureScore: pressure.total,
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
        const minute = this._parseMinute(match);
        const score = this._getScoreDiff(match);
        if (minute < 15 || minute >= 82 || minute === 999) return { active: false };
        if (score.diff >= 3 || (minute >= 65 && score.diff >= 2)) return { active: false };

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
            const confidence = Math.min(85, Math.max(58, Math.round(55 + Math.min(growth, 1.0) * 25)));
            return {
                active: true,
                id: 'MOMENTUM',
                label: 'SON 15DK PATLAMASI',
                icon: '⚡',
                score: confidence,
                confidence,
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
            const confidence = Math.min(82, Math.max(58, Math.round(50 + Math.min(pressure, 100) * 0.3)));
            return {
                active: true,
                id: 'FHG',
                label: 'İY 0.5 ÜST',
                icon: '🏆',
                score: confidence,
                confidence,
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
        const minute = this._parseMinute(match);
        const scoreDiff = this._getScoreDiff(match);
        // Geri dönüş uyarısı 20. dakikadan önce (maç henüz oturmamıştır), 80'den sonra veya 3+ gol farkında geçersizdir
        if (minute < 20 || minute >= 80 || minute === 999 || scoreDiff.diff >= 3) return { active: false };

        const score = match.score || { home: 0, away: 0 };
        const observations = match.observations || {};
        const pressure = observations.pressure || {};

        const isHomeTrailing = score.home < score.away && pressure.dominantTeam === 'HOME';
        const isAwayTrailing = score.away < score.home && pressure.dominantTeam === 'AWAY';

        if ((isHomeTrailing || isAwayTrailing) && pressure.total > 60) {
            const confidence = Math.min(80, Math.max(55, Math.round(52 + Math.min(pressure.total, 100) * 0.28)));
            return {
                active: true,
                id: 'COMEBACK',
                label: 'GERİ DÖNÜŞ',
                icon: '💪',
                score: confidence,
                confidence,
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
        const minute = this._parseMinute(match);
        const scoreDiff = this._getScoreDiff(match);
        if (minute < 20 || minute >= 80 || minute === 999 || scoreDiff.diff >= 3) return { active: false };

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
            const confidence = Math.min(84, Math.max(60, Math.round(55 + Math.min(pressure.total, 100) * 0.28)));
            return {
                active: true,
                id: 'ADV_COMEBACK',
                label: 'FAVORİ GERİ DÖNÜŞ',
                icon: '🚀',
                score: confidence,
                confidence,
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
            const confidence = Math.min(84, Math.max(58, Math.round(55 + Math.min(totalPressure - 130, 70) * 0.35)));
            return {
                active: true,
                id: 'OVER_EXPOSURE',
                label: 'SKOR MARUZİYETİ',
                icon: '📈',
                score: confidence,
                confidence,
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
        const minute = this._parseMinute(match);
        const score = this._getScoreDiff(match);
        
        // 1. Örneklem Güvenlik Eşiği: 20. dakikadan önce istatistikler oturmamıştır, erken sinyal engellenir!
        if (minute < 20 || minute >= 85 || minute === 999) return { active: false };
        if ((minute >= 65 && score.diff >= 3) || score.diff >= 4) return { active: false };

        const stats = match.stats || {};
        const sogHome = Number(stats.shotsOnGoal?.home) || 0;
        const sogAway = Number(stats.shotsOnGoal?.away) || 0;
        const xgHome = Number(stats.xg?.home) || 0;
        const xgAway = Number(stats.xg?.away) || 0;
        const possHome = Number(stats.possession?.home) || 50;
        const possAway = Number(stats.possession?.away) || 50;
        const shotsHome = Number(stats.totalShots?.home) || 0;
        const shotsAway = Number(stats.totalShots?.away) || 0;
        const cornersHome = Number(stats.corners?.home) || 0;
        const cornersAway = Number(stats.corners?.away) || 0;

        // 2. Pozitif Topla Oynama Bonusu: Asla puanı eksiye düşüremez! Sadece %50 üzerindeyse ek puan ekler
        const possBonusHome = possHome > 50 ? (possHome - 50) * 0.4 : 0;
        const possBonusAway = possAway > 50 ? (possAway - 50) * 0.4 : 0;

        // Composite stat points: SOG * 3.5 + Shots * 1 + Corners * 1.2 + xG * 12 + possBonus
        const homePoints = (sogHome * 3.5) + shotsHome + (cornersHome * 1.2) + (xgHome * 12) + possBonusHome;
        const awayPoints = (sogAway * 3.5) + shotsAway + (cornersAway * 1.2) + (xgAway * 12) + possBonusAway;

        // 3. Somut Hücum Tehlikesi Şartı: En az 1 isabetli şut veya 0.25 xG veya 3 şut yoksa dominasyon ilan edilemez!
        const hasMinHomeDanger = (sogHome >= 1 || xgHome >= 0.25 || shotsHome >= 3);
        const hasMinAwayDanger = (sogAway >= 1 || xgAway >= 0.25 || shotsAway >= 3);

        const isHome = hasMinHomeDanger && (homePoints >= awayPoints * 1.4 + 14) && possHome >= 40 && (shotsHome >= shotsAway * 0.8);
        const isAway = hasMinAwayDanger && (awayPoints >= homePoints * 1.4 + 14) && possAway >= 40 && (shotsAway >= shotsHome * 0.8);

        if (isHome || isAway) {
            const team = isHome ? (match.homeTeam || 'Ev Sahibi') : (match.awayTeam || 'Deplasman');
            return {
                active: true,
                id: 'STATS',
                label: `Sıradaki Gol: ${team}`,
                icon: '📊',
                score: 76,
                confidence: 76,
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
        const minute = this._parseMinute(match);
        const score = this._getScoreDiff(match);
        if (minute >= 85 || minute === 999) return { active: false };
        if ((minute >= 65 && score.diff >= 3) || score.diff >= 4) return { active: false };

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
            const diff = cornersNow - cornersThen;
            const confidence = Math.min(78, Math.max(55, Math.round(55 + diff * 6)));
            return {
                active: true,
                id: 'CORNERS',
                label: `Sıradaki Gol: ${dominantTeam}`,
                icon: '🚩',
                score: confidence,
                confidence,
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
        const minute = this._parseMinute(match);
        if (minute >= 80 || minute === 999) return { active: false };

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
        const minute = this._parseMinute(match);
        // Global late-game shutdown: At 88'+, stoppage time (90+), or finished (MS/FT), all strategies shut down
        if (minute >= 88 || minute === 999) return [];

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
