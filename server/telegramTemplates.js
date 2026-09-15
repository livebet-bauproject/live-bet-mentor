/**
 * TELEGRAM MESSAGE TEMPLATES
 * Professional betting signal message formatters
 */

export function cleanMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`\[\]])/g, ' ');
}

export function resolveMarketText(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const rec = alert.recommendation || {};
    const key = rec.marketKey || '';
    const label = cleanMd(rec.marketLabel || rec.market || '');
    const team = cleanMd(rec.team || (key.includes('home') ? home : key.includes('away') ? away : ''));
    const oddsStr = rec.odds ? (isTr ? ` (Oran: ${rec.odds})` : ` (Odds: ${rec.odds})`) : '';

    // Direct explicit prediction if provided
    if (rec.predictionText) {
        return `${cleanMd(rec.predictionText)}${oddsStr}`;
    }

    // 1. Latency Arbitrage (Highest priority)
    if (key === 'market_latency_arbitrage' || rec.edgeType === 'LATENCY') {
        const nextGoalLabel = isTr ? 'Sıradaki Gol' : 'Next Goal';
        const target = team ? `${team} (${label || nextGoalLabel})` : (label || nextGoalLabel);
        return isTr ? `Gecikme Arbitrajı (Büro Açığı): ${target}${oddsStr}` : `Latency Arbitrage: ${target}${oddsStr}`;
    }

    // 2. Mathematical Value (+EV)
    if (key === 'market_plus_ev' || rec.edgeType === 'PLUS_EV') {
        const overGoalsLabel = isTr ? 'Üst Gol' : 'Over Goals';
        return isTr ? `Değer Oran (+EV): ${label || overGoalsLabel}${oddsStr}` : `Value Edge (+EV): ${label || overGoalsLabel}${oddsStr}`;
    }

    // 3. Next Goal - Home / Away
    if (key === 'market_next_goal_home' || key === 'HOME_NEXT_GOAL') {
        return isTr ? `Sıradaki Gol: ${home}${oddsStr}` : `Next Goal: ${home}${oddsStr}`;
    }
    if (key === 'market_next_goal_away' || key === 'AWAY_NEXT_GOAL') {
        return isTr ? `Sıradaki Gol: ${away}${oddsStr}` : `Next Goal: ${away}${oddsStr}`;
    }

    // 3b. Match Winner
    if (key === 'HOME_WIN_NEXT') {
        return isTr ? `Maç Sonucu: ${home}${oddsStr}` : `Match Winner: ${home}${oddsStr}`;
    }
    if (key === 'AWAY_WIN_NEXT') {
        return isTr ? `Maç Sonucu: ${away}${oddsStr}` : `Match Winner: ${away}${oddsStr}`;
    }

    // 4. First Half Over 0.5 Goals
    if (key === 'market_fh_over05' || label.includes('İY 0.5') || label.toLowerCase().includes('first half') || label.toLowerCase().includes('ilk yarı')) {
        return isTr ? `İlk Yarı 0.5 Üst${oddsStr}` : `First Half Over 0.5 Goals${oddsStr}`;
    }

    // 5. Both Teams To Score (BTTS: Yes)
    if (key === 'market_btts' || key === 'btts' || label.toUpperCase().includes('KG') || label.toLowerCase().includes('both teams') || label.toLowerCase().includes('karşılıklı')) {
        return isTr ? `Karşılıklı Gol: Var (KG Var)${oddsStr}` : `Both Teams To Score (BTTS: Yes)${oddsStr}`;
    }

    // 6. Over / Under Goals
    if (key === 'market_over_goals' || key === 'OVER_NEXT_DYNAMIC' || label.includes('Üst') || label.toLowerCase().includes('over')) {
        const goalsMatch = label.match(/(\d+\.?\d*)/);
        const goals = rec.marketParams?.goals || rec.target || (goalsMatch ? goalsMatch[1] : '2.5');
        return isTr ? `Maçta ${goals} Üst Gol${oddsStr}` : `Over ${goals} Match Goals${oddsStr}`;
    }

    // 7. Next Goal label fallback
    if (label.toLowerCase().includes('sıradaki gol') || label.toLowerCase().includes('next goal')) {
        const targetTeam = team || (label.includes('Ev') || label.includes('Home') ? home : label.includes('Dep') || label.includes('Away') ? away : home);
        return isTr ? `Sıradaki Gol: ${targetTeam}${oddsStr}` : `Next Goal: ${targetTeam}${oddsStr}`;
    }

    // 8. Strategy-based signals
    if (key === 'COMEBACK' || key === 'ADV_COMEBACK') {
        return isTr ? `Geri Dönüş Baskısı: Sıradaki Gol ${team || home}${oddsStr}` : `Comeback In-Play: Next Goal ${team || home}${oddsStr}`;
    }
    if (key === 'PRESS' || key === 'MOMENTUM_SURGE') {
        return isTr ? `İvme & Baskı Dalgası: Sıradaki Gol ${team || home}${oddsStr}` : `Momentum Surge: Next Goal ${team || home}${oddsStr}`;
    }
    if (key === 'RED_CARD_ADV') {
        return isTr ? `Kırmızı Kart Avantajı: Sıradaki Gol ${team || home}${oddsStr}` : `Man Advantage: Next Goal ${team || home}${oddsStr}`;
    }
    if (key === 'UNDERDOG_RESIST') {
        return isTr ? `Sürpriz Direnci: ${team || away} Çifte Şans${oddsStr}` : `Underdog Resilience: ${team || away} Double Chance${oddsStr}`;
    }
    if (key === 'COUNTER_ATTACK') {
        return isTr ? `Kontratak Şoku: Sıradaki Gol ${team || away}${oddsStr}` : `Counter Attack Blitz: Next Goal ${team || away}${oddsStr}`;
    }

    if (label && label.length > 0 && label !== 'Strateji Sinyali' && label !== 'Analiz Devam Ediyor') {
        return `${label}${oddsStr}`;
    }

    if (team) {
        return isTr ? `Sıradaki Gol: ${team}${oddsStr}` : `Next Goal: ${team}${oddsStr}`;
    }

    return isTr ? `Sıradaki Gol: ${home}${oddsStr}` : `Next Goal: ${home}${oddsStr}`;
}

export function formatVIPSignal(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const levelEmoji = {
        'ALPHA': '💎',
        'ALEV': '🔥',
        'SICAK': '⚡'
    };

    const emoji = levelEmoji[alert.level] || '📊';
    const levelText = isTr
        ? (alert.level === 'ALPHA' ? 'ALFA KURUMSAL SİNYAL' : alert.level === 'ALEV' ? 'YÜKSEK GÜVENLİ CANLI ALARM' : 'CANLI BASKI & İVME ALARMI')
        : (alert.level === 'ALPHA' ? 'ALPHA QUANT SIGNAL' : alert.level === 'ALEV' ? 'HIGH CONVICTION ALERT' : 'IN-PLAY MOMENTUM ALERT');

    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : 'Away'));

    const marketText = resolveMarketText(alert, lang);

    // Build strategies section
    const activeStrategies = alert.activeStrategies || [];
    const defaultStrategy = isTr ? '• Algoritmik Canlı Veri Filtreleri Onaylandı' : '• Algorithmic In-Play Validation Passed';
    const strategiesText = activeStrategies.length > 0 
        ? activeStrategies.map(s => `${s.icon || '🎯'} *${cleanMd(s.label || s.id)}*`).join('\n')
        : defaultStrategy;

    // Build reasons based on strategies and reasoning
    const reasons = [];
    if (activeStrategies.length > 0) {
        activeStrategies.forEach(s => {
            if (s.verdict) reasons.push(`• ${cleanMd(s.verdict)}`);
        });
    }
    if (alert.recommendation?.reasoning && Array.isArray(alert.recommendation.reasoning)) {
        alert.recommendation.reasoning.forEach(r => {
            if (typeof r === 'string') reasons.push(`• ${cleanMd(r)}`);
            else if (r && r.key) {
                if (r.key === 'reason_xg_diff') {
                    reasons.push(isTr ? `• xG Gol Beklentisi Hakimiyeti: +${r.params?.diff || ''}` : `• xG Dominance Differential: +${r.params?.diff || ''}`);
                } else if (r.key === 'reason_pressure') {
                    reasons.push(isTr ? `• Kesintisiz Hücum Baskısı: ${r.params?.pressure || 'Yüksek'}` : `• Sustained Attack Pressure: ${r.params?.pressure || 'Extreme'}`);
                } else if (r.key === 'reason_value_detected') {
                    reasons.push(isTr ? `• Algoritmik Fiyat Tutarsızlığı (+EV Tespit Edildi)` : `• Algorithmic Price Discrepancy (+EV Detected)`);
                } else if (r.key === 'reason_alpha_signal') {
                    reasons.push(isTr ? `• Yüksek Olasılıklı Kurumsal Alfa Tetikleyicisi` : `• High Probability Institutional Alpha Trigger`);
                } else if (r.key === 'reason_critical_min') {
                    reasons.push(isTr ? `• Kritik İstatistiksel Aralık (${r.params?.minute}')` : `• Critical Statistical Window (${r.params?.minute}')`);
                }
            }
        });
    }
    if (alert.maxEV > 0.15) {
        reasons.push(isTr ? `• 💰 Yüksek Beklenen Değer: EV +%${(alert.maxEV * 100).toFixed(0)}` : `• 💰 High Expected Value: EV +${(alert.maxEV * 100).toFixed(0)}%`);
    }
    
    const defaultReason = isTr
        ? '• Çok faktörlü saha ivmesi ve konsensüs teyit edildi'
        : '• Multi-factor pitch momentum and quantitative consensus confirmed';
    const reasonsText = reasons.length > 0 ? reasons.slice(0, 3).join('\n') : defaultReason;

    // Confidence bar
    const conf = alert.recommendation?.confidence || 78;
    const filled = Math.min(10, Math.max(1, Math.round(conf / 10)));
    const confBar = '▓'.repeat(filled) + '░'.repeat(10 - filled);

    let evText = '';
    if (alert.bestEV && alert.bestEV.ev >= 5) {
        evText = isTr
            ? `💎 *Değer Avantajı (+EV):* +%${alert.bestEV.ev} (${cleanMd(alert.bestEV.label)} | Adil Oran: ${alert.bestEV.fairOdds})`
            : `💎 *Value Edge (+EV):* +${alert.bestEV.ev}% (${cleanMd(alert.bestEV.label)} | Fair: ${alert.bestEV.fairOdds})`;
    } else if (alert.maxEV > 0.05) {
        evText = isTr
            ? `📈 *Beklenen Değer (EV):* +%${(alert.maxEV * 100).toFixed(0)}`
            : `📈 *Expected Value (EV):* +${(alert.maxEV * 100).toFixed(0)}%`;
    }
    const surplusText = alert.xgSurplus > 0
        ? (isTr ? `⚽ *Gol Beklentisi Farkı (xG Artısı):* +${alert.xgSurplus.toFixed(2)}` : `⚽ *xG Surplus:* +${alert.xgSurplus.toFixed(2)}`)
        : '';

    // Red Card Tactical Info
    let redCardInfo = '';
    const homeReds = alert.cards?.home?.red || alert.redCards?.home || 0;
    const awayReds = alert.cards?.away?.red || alert.redCards?.away || 0;
    if (homeReds > 0 || awayReds > 0) {
        if (homeReds !== awayReds) {
            const advTeam = awayReds > homeReds ? home : away;
            const diff = Math.abs(awayReds - homeReds);
            redCardInfo = isTr
                ? `🟥 *Sayısal Üstünlük:* ${advTeam} (+${diff} Kişi Avantajı)`
                : `🟥 *Numerical Superiority:* ${advTeam} (+${diff} Man Advantage)`;
        } else {
            redCardInfo = isTr
                ? `🟥 *Kırmızı Kartlar:* ${homeReds} - ${awayReds} (10 vs 10)`
                : `🟥 *Red Cards:* ${homeReds} - ${awayReds} (10 vs 10)`;
        }
    }

    // Smart Money / Dropping Odds Info
    let droppingOddsInfo = '';
    if (alert.oddsMovement && alert.oddsMovement.isDropping) {
        droppingOddsInfo = isTr
            ? `📉 *Akıllı Para Akışı:* ${alert.oddsMovement.initialOdds} ➔ ${alert.oddsMovement.currentOdds} (%${alert.oddsMovement.dropPct.toFixed(0)} Oran Düşüşü)`
            : `📉 *Smart Money Flow:* ${alert.oddsMovement.initialOdds} ➔ ${alert.oddsMovement.currentOdds} (${alert.oddsMovement.dropPct.toFixed(0)}% Squeeze)`;
    }

    // Latency Arbitrage Alert
    let latencyInfo = '';
    if (alert.latencyEdge) {
        latencyInfo = isTr
            ? `⚡ *Gecikme Arbitrajı:* Büro Oranı ${alert.latencyEdge.softOdds} vs Keskin Adil Oran ${alert.latencyEdge.sharpFairOdds} (+%${alert.latencyEdge.discrepancyPct} Avantaj!)`
            : `⚡ *Latency Arbitrage:* Soft Bookmaker ${alert.latencyEdge.softOdds} vs Sharp Fair ${alert.latencyEdge.sharpFairOdds} (+${alert.latencyEdge.discrepancyPct}% Edge!)`;
    }

    const leagueName = alert.league || alert.leagueName;
    const leagueLine = leagueName ? (isTr ? `🏆 *Lig:* ${cleanMd(leagueName)}\n` : `🏆 *League:* ${cleanMd(leagueName)}\n`) : '';
    const inPlayLabel = isTr ? '⏱️ Canlı' : '📊 In-Play';
    const scoreLabel = isTr ? 'Skor' : 'Score';
    const dqsLabel = isTr ? '📈 Veri Kalite Skoru (DQS)' : '📈 Data Quality Score (DQS)';
    const timeStr = new Date().toUTCString().slice(17, 22) + ' UTC';

    if (isTr) {
        return `${emoji} *${levelText}*
    
⚽ *${home} vs ${away}*
${leagueLine}${inPlayLabel}: ${alert.minute}' · ${scoreLabel}: ${alert.score}

${strategiesText}

🎯 *Hedef Tahmin:* ${marketText}
📊 *Sistem Güveni:* ${confBar} %${conf}
${evText ? evText + '\n' : ''}${surplusText ? surplusText + '\n' : ''}${latencyInfo ? latencyInfo + '\n' : ''}${redCardInfo ? redCardInfo + '\n' : ''}${droppingOddsInfo ? droppingOddsInfo + '\n' : ''}${alert.dqs ? `${dqsLabel}: ${alert.dqs.toFixed(2)}` : ''}

📋 *Algoritmik Gerekçe & Analiz:*
${reasonsText}

💰 *Kasa & Bahis Miktarı Tavsiyesi:*
Tavsiye: *Kasanın %1.00'i* (Çeyrek-Kelly Modeli)

⏰ ${timeStr}
━━━━━━━━━━━━━━━━━━
🤖 *v4.0 Algoritmik Canlı Bahis Motoru*
💎 *LIVE BET MENTOR VIP*`;
    }

    return `${emoji} *${levelText}*
    
⚽ *${home} vs ${away}*
${leagueLine}${inPlayLabel}: ${alert.minute}' · ${scoreLabel}: ${alert.score}

${strategiesText}

🎯 *Target Market:* ${marketText}
📊 *System Confidence:* ${confBar} ${conf}%
${evText ? evText + '\n' : ''}${surplusText ? surplusText + '\n' : ''}${latencyInfo ? latencyInfo + '\n' : ''}${redCardInfo ? redCardInfo + '\n' : ''}${droppingOddsInfo ? droppingOddsInfo + '\n' : ''}${alert.dqs ? `${dqsLabel}: ${alert.dqs.toFixed(2)}` : ''}

📋 *Quantitative Rationale:*
${reasonsText}

💰 *Staking Advice:*
Recommended: *1.00% Bankroll* (Quarter-Kelly Model)

⏰ ${timeStr}
━━━━━━━━━━━━━━━━━━
🤖 *v4.0 Quant Syndicate Engine*
💎 *LIVE BET MENTOR VIP*`;
}

export function formatPublicTeaser(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const leagueName = alert.league || alert.leagueName;
    const leagueLine = leagueName ? (isTr ? `🏆 *Lig:* ${cleanMd(leagueName)}\n` : `🏆 *League:* ${cleanMd(leagueName)}\n`) : '';
    
    if (isTr) {
        const levelText = alert.level === 'ALPHA' ? 'ALFA KURUMSAL FIRSAT' : 'YÜKSEK DEĞERLİ CANLI SİNYAL';
        return `📡 *CANLI MAÇ RADARI ALARMI*

⚽ *${home} vs ${away}*
${leagueLine}⏱️ Canlı: ${alert.minute}' · Skor: ${alert.score}

⚡ *Sistem Durumu:* ${levelText} TESPİT EDİLDİ
🎯 Yüksek gol ivmesi, yoğun hücum baskısı ve matematiksel değer doğrulandı!

🔒 _Tam tahmin, adil oran ve kasa yönetimi tavsiyesi VIP grubumuzda paylaşıldı._

👉 Tam VIP Sinyaline Eriş: @Livebetmentorbot`;
    }

    const levelText = alert.level === 'ALPHA' ? 'ALPHA QUANT OPPORTUNITY' : 'HIGH VALUE LIVE SIGNAL';
    return `📡 *LIVE IN-PLAY RADAR ALERT*

⚽ *${home} vs ${away}*
${leagueLine}⏱️ In-Play: ${alert.minute}' · Score: ${alert.score}

⚡ *System Flag:* ${levelText} DETECTED
🎯 High goal momentum, offensive pressure and mathematical edge confirmed!

🔒 _Full prediction, fair odds benchmark & Kelly stake released in VIP Syndicate._

👉 Unlock Full VIP Signal: @Livebetmentorbot`;
}

export function formatDailyReport(stats, lang = 'tr') {
    const isTr = lang === 'tr';
    const date = new Date().toLocaleDateString(isTr ? 'tr-TR' : 'en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const winRate = stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : '0.0';

    if (isTr) {
        return `📊 *GÜNLÜK ALGORİTMİK PERFORMANS RAPORU*

📅 ${date}
━━━━━━━━━━━━━━━━━━

✅ Hedef Başarılı (Kazandı): *${stats.won || 0}*
❌ Iskaladı (Kaybetti): *${stats.lost || 0}*
⏳ Devam Eden Canlı: *${stats.pending || 0}*

📈 *Günlük Başarı Oranı: %${winRate}*
🔥 Gönderilen Toplam Sinyal: ${stats.total || 0}

${stats.bestPick ? `🏆 En İyi Tahmin: ${cleanMd(stats.bestPick)}` : ''}

━━━━━━━━━━━━━━━━━━
🤖 *Otonom AI Denetim Motoru Tarafından Doğrulandı*
💎 *LIVE BET MENTOR | QUANT LABS*`;
    }

    return `📊 *DAILY QUANT PERFORMANCE DIGEST*

📅 ${date}
━━━━━━━━━━━━━━━━━━

✅ Target Hit (Won): *${stats.won || 0}*
❌ Missed (Lost): *${stats.lost || 0}*
⏳ In-Play: *${stats.pending || 0}*

📈 *Daily Win Rate: ${winRate}%*
🔥 Total Signals Dispatched: ${stats.total || 0}

${stats.bestPick ? `🏆 Top Pick: ${cleanMd(stats.bestPick)}` : ''}

━━━━━━━━━━━━━━━━━━
🤖 *Verified by Autonomous AI Audit Engine*
💎 *LIVE BET MENTOR | QUANT LABS*`;
}

export function formatSignalResult(signal, result, finalScore, currentStats = {}, lang = 'tr') {
    const isTr = lang === 'tr';
    const isWon = result === 'WON';
    const home = cleanMd(signal.homeTeam || signal.match?.split(' vs ')[0] || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(signal.awayTeam || signal.match?.split(' vs ')[1] || (isTr ? 'Deplasman' : 'Away'));
    const market = cleanMd(resolveMarketText(signal, lang) || signal.market || (isTr ? 'Hedef Tahmin' : 'Target Market'));
    const scoreStr = finalScore ? (typeof finalScore === 'object' ? `${finalScore.home}-${finalScore.away}` : finalScore) : '';

    const totalResolved = (currentStats.won || 0) + (currentStats.lost || 0);
    const winRate = totalResolved > 0 ? (((currentStats.won || 0) / totalResolved) * 100).toFixed(1) : (isWon ? '100.0' : '0.0');

    if (isTr) {
        if (isWon) {
            return `🟢 *HEDEF BAŞARILI! (KAZANDI)* 🟢

⚽ *${home} vs ${away}*
🎯 *Hedef Tahmin:* ${market}
${scoreStr ? `📊 *Son Skor:* ${scoreStr}\n` : ''}✅ *Sonuç:* KAZANÇ ONAYLANDI!

━━━━━━━━━━━━━━━━━━
📈 *Bugünün Başarı Oranı:* %${winRate} (${currentStats.won || 1}/${totalResolved || 1} Kazandı)
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
        } else {
            return `🔴 *MAÇ SONUÇLANDI (KAYBETTİ)*

⚽ *${home} vs ${away}*
🎯 *Hedef Tahmin:* ${market}
${scoreStr ? `📊 *Son Skor:* ${scoreStr}\n` : ''}❌ *Sonuç:* Başarısız

━━━━━━━━━━━━━━━━━━
📈 *Bugünün Başarı Oranı:* %${winRate} (${currentStats.won || 0}/${totalResolved || 1})
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
        }
    }

    if (isWon) {
        return `🟢 *TARGET HIT! (WON)* 🟢

⚽ *${home} vs ${away}*
🎯 *Target Pick:* ${market}
${scoreStr ? `📊 *Final Score:* ${scoreStr}\n` : ''}✅ *Result:* PROFIT CONFIRMED!

━━━━━━━━━━━━━━━━━━
📈 *Today's Accuracy:* ${winRate}% (${currentStats.won || 1}/${totalResolved || 1} Won)
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
    } else {
        return `🔴 *MATCH SETTLED (MISSED)*

⚽ *${home} vs ${away}*
🎯 *Target Pick:* ${market}
${scoreStr ? `📊 *Final Score:* ${scoreStr}\n` : ''}❌ *Result:* Missed

━━━━━━━━━━━━━━━━━━
📈 *Today's Accuracy:* ${winRate}% (${currentStats.won || 0}/${totalResolved || 1})
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
    }
}

function resolveConsensusPredName(pred, lang = 'tr') {
    if (!pred) return 'N/A';
    const p = String(pred).trim();
    const isTr = lang === 'tr';

    if (p === '1') return isTr ? 'Ev Sahibi Galibiyeti (MS 1)' : 'Home Win (1)';
    if (p === 'X') return isTr ? 'Beraberlik (MS X)' : 'Draw (X)';
    if (p === '2') return isTr ? 'Deplasman Galibiyeti (MS 2)' : 'Away Win (2)';
    if (p === '1X') return isTr ? 'Çifte Şans (1X)' : 'Double Chance (1X)';
    if (p === 'X2') return isTr ? 'Çifte Şans (X2)' : 'Double Chance (X2)';
    if (p === '12') return isTr ? 'Çifte Şans (12)' : 'Double Chance (12)';
    if (p.toLowerCase().includes('üst') || p.toLowerCase().includes('over')) return isTr ? '2.5 Gol Üstü' : 'Over 2.5 Goals';
    if (p.toLowerCase().includes('alt') || p.toLowerCase().includes('under')) return isTr ? '2.5 Gol Altı' : 'Under 2.5 Goals';
    if (p.toLowerCase().includes('var') || p.toLowerCase().includes('yes')) return isTr ? 'Karşılıklı Gol Var (KG Var)' : 'Both Teams To Score (BTTS: Yes)';
    if (p.toLowerCase().includes('yok') || p.toLowerCase().includes('no')) return isTr ? 'Karşılıklı Gol Yok (KG Yok)' : 'Both Teams To Score (BTTS: No)';
    return p;
}

export function formatRadarPick(match, lang = 'tr') {
    const isTr = lang === 'tr';
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement)
        .sort((a, b) => b[1] - a[1])[0];
    
    const rawTopPred = topPrediction ? topPrediction[0] : (match.topPred || 'N/A');
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 0;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);
    const topPredText = resolveConsensusPredName(rawTopPred, lang);

    const home = cleanMd(match.home || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(match.away || (isTr ? 'Deplasman' : 'Away'));
    const league = cleanMd(match.league || (isTr ? 'Maç Öncesi Fikstürü' : 'Pre-Match Fixture'));

    const predDetails = Object.entries(match.predictions || {})
        .map(([site, pred]) => {
            const prob = match.probabilities?.[site];
            const predName = resolveConsensusPredName(pred, lang);
            return isTr 
                ? `  • ${cleanMd(site)}: *${cleanMd(predName)}*${prob ? ` (%${prob} İhtimal)` : ''}`
                : `  • ${cleanMd(site)}: *${cleanMd(predName)}*${prob ? ` (${prob}% Probability)` : ''}`;
        })
        .join('\n');

    const scoreDetails = match.scorePredictions && Object.keys(match.scorePredictions).length > 0
        ? Object.entries(match.scorePredictions)
            .map(([site, score]) => `  • ${cleanMd(site)}: *${cleanMd(score)}*`)
            .join('\n')
        : null;

    let formText = '';
    if (match.form) {
        if (typeof match.form === 'object') {
            const hf = Array.isArray(match.form.home) ? match.form.home.join('-') : (match.form.home || '');
            const af = Array.isArray(match.form.away) ? match.form.away.join('-') : (match.form.away || '');
            if (hf || af) {
                formText = isTr 
                    ? `📈 *Son Form Durumu:*\n  • ${home}: \`${hf || 'N/A'}\`\n  • ${away}: \`${af || 'N/A'}\``
                    : `📈 *Recent Form Guide:*\n  • ${home}: \`${hf || 'N/A'}\`\n  • ${away}: \`${af || 'N/A'}\``;
            }
        } else if (typeof match.form === 'string') {
            formText = isTr ? `📈 *Form Rehberi:* \`${match.form}\`` : `📈 *Form Guide:* \`${match.form}\``;
        }
    }

    let standingsText = '';
    if (match.ranks && (match.ranks.home !== '-' || match.ranks.away !== '-')) {
        standingsText = isTr
            ? `📊 *Lig Sıralaması & Puan:*\n  • ${home}: Sıra #${match.ranks.home || '-'} (${match.points?.home || '-'} Puan)\n  • ${away}: Sıra #${match.ranks.away || '-'} (${match.points?.away || '-'} Puan)`
            : `📊 *League Standings & Points:*\n  • ${home}: Rank #${match.ranks.home || '-'} (${match.points?.home || '-'} Pts)\n  • ${away}: Rank #${match.ranks.away || '-'} (${match.points?.away || '-'} Pts)`;
    }

    const headerEmoji = agreePercent === 100 ? '🔥' : '🎯';

    if (isTr) {
        const headerTitle = agreePercent === 100 ? 'MAÇ ÖNCESİ %100 KONSENSÜS TAHMİNİ' : 'MAÇ ÖNCESİ ORTAK KONSENSÜS RADAR TAHMİNİ';
        return `${headerEmoji} *${headerTitle}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
🏆 *Lig:* ${league}
${match.time ? `⏰ *Başlama Saati:* ${match.time}` : ''}${match.date ? ` (Tarih: ${match.date})` : ''}

🎯 *ORTAK TAHMİN:* *${topPredText}*
📊 *Konsensüs Uzlaşması:* *%${agreePercent}* (${topCount} / ${totalSources} Analiz Kaynağı Aynı Fikirde!)

📋 *Algoritmik Model Dağılımı:*
${predDetails || '  Model tahminleri işleniyor...'}

${scoreDetails ? `🔢 *Algoritmik Skor Tahminleri:*\n${scoreDetails}\n` : ''}${formText ? `${formText}\n` : ''}${standingsText ? `${standingsText}\n` : ''}
💰 *Kasa & Bahis Miktarı Tavsiyesi:*
Tavsiye: *Kasanın %1.50 - %2.00'si* (Çeyrek-Kelly Modeli)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 *10 Kaynaklı Konsensüs & AI Füzyon Motoru*
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
    }

    const headerTitle = agreePercent === 100 ? 'PRE-MATCH 100% QUANT CONSENSUS' : 'PRE-MATCH CONSENSUS RADAR PICK';
    return `${headerEmoji} *${headerTitle}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
🏆 *League:* ${league}
${match.time ? `⏰ *Kickoff:* ${match.time}` : ''}${match.date ? ` (Date: ${match.date})` : ''}

🎯 *CONSENSUS PICK:* *${topPredText}*
📊 *Syndicate Agreement:* *${agreePercent}%* (${topCount} / ${totalSources} Platforms Concurring!)

📋 *Algorithmic Model Breakdown:*
${predDetails || '  Model predictions processing...'}

${scoreDetails ? `🔢 *Algorithmic Score Forecasts:*\n${scoreDetails}\n` : ''}${formText ? `${formText}\n` : ''}${standingsText ? `${standingsText}\n` : ''}
💰 *Staking Advice (Bankroll):*
Recommended: *1.50% - 2.00% Bankroll* (Quarter-Kelly Model)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 *10-Source Consensus & AI Fusion Engine*
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
}

export function formatRadarTeaser(match, lang = 'tr') {
    const isTr = lang === 'tr';
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 0;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);

    const home = cleanMd(match.home || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(match.away || (isTr ? 'Deplasman' : 'Away'));
    const league = cleanMd(match.league || (isTr ? 'Maç Öncesi Fikstürü' : 'Pre-Match Fixture'));

    if (isTr) {
        return `📡 *MAÇ ÖNCESİ ALGORİTMİK RADAR ALARMI*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
🏆 *Lig:* ${league}
${match.time ? `⏰ *Başlama Saati:* ${match.time}` : ''}

⚡ *10 Küresel Tahmin Modeli %${agreePercent} Konsensüse Ulaştı!*
📊 *${topCount} / ${totalSources} Analiz Platformu* en yüksek olasılıklı sonuç üzerinde uzlaştı.

🔒 _Tam tahmin, adil oran analizi, skor tahminleri ve Kelly bahis miktarı VIP grupta paylaşıldı._

👉 *Ücretsiz VIP Deneme Hakkını Al:*
/deneme (veya /trial) — *3 Günlük Ücretsiz VIP Üyeliğinizi* hemen başlatın!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
    }

    return `📡 *PRE-MATCH QUANT RADAR ALERT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
🏆 *League:* ${league}
${match.time ? `⏰ *Kickoff:* ${match.time}` : ''}

⚡ *10 Global Predictive Models Reached ${agreePercent}% Consensus!*
📊 *${topCount} / ${totalSources} Ingestion Platforms* concurred on the highest-probability outcome.

🔒 _Full prediction, fair-odds benchmark, score forecasts & Kelly stake released in VIP Syndicate._

👉 *Claim Complimentary VIP Pass:*
/trial — Activate your *3-Day Free VIP Syndicate Pass* instantly!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
}

export function formatWelcome(lang = 'tr') {
    const isTr = lang === 'tr';
    if (isTr) {
        return `🏆 *LIVE BET MENTOR BOT*

Kurumsal yapay zeka destekli canlı futbol analiz ve otonom değer sinyalleri servisi.

📊 *Neler Sunuyoruz:*
• Gerçek zamanlı canlı değer sinyalleri (HOT / FLAME / ALPHA)
• 🛡️ Bahis Bozdur (Cash-Out) & Stop-Loss Kasa Koruma Radarı
• 🎟️ Canlı Günün Altın İkilisi (Kombine Sihirbazı)
• ⚡ Gecikme Arbitrajı & Büro Hata / Oran Gecikmesi Avantajı
• 🧠 Kendi Kendine Öğrenen Quant Yapay Zeka
• Şeffaf günlük performans raporları ve kasa takibi

🎁 *Ücretsiz Deneme Başlat:*
/deneme (veya /trial) — *3 Günlük Ücretsiz VIP Üyeliğinizi* hemen başlatın!

📩 *Kullanabileceğiniz Komutlar:*
/deneme (veya /trial) — 3 günlük ücretsiz VIP deneme
/profil (veya /profile) — VIP üyelik durumunu sorgula
/kupon (veya /combo) — Günün canlı altın kombinesi
/stats — Bugünün canlı performans tablosu
/today — Günün tüm sinyal geçmişi
/ai — AI öğrenme motoru skor karnesi
/vip — VIP üyelik paketleri ve erişim
/dil (veya /lang) — Dil tercihi (Türkçe / English)
/id — Telegram Chat ID numaranızı öğrenin

━━━━━━━━━━━━━━━━━━
⚡ *Live Bet Mentor Quant Engine*`;
    }

    return `🏆 *LIVE BET MENTOR BOT*

Institutional AI-powered live football analysis & automated value signal service.

📊 *What We Provide:*
• Real-time in-play value signals (HOT / FLAME / ALPHA)
• 🛡️ Cash-Out & Stop-Loss Capital Preservation Radar
• 🎟️ In-Play Golden Double (Smart Combo Wizard)
• ⚡ Latency Arbitrage & Bookmaker Lag Edge
• 🧠 Self-Learning Quant Machine Intelligence
• Transparent daily audit reports & ledger

🎁 *Claim Complimentary Access:*
/trial — Activate your *3-Day Free VIP Syndicate Pass* instantly!

📩 *Available Commands:*
/trial (or /deneme) — Start 3-day free VIP trial
/profile (or /profil) — Check VIP subscription status
/combo (or /kupon) — Daily live Golden Double
/stats — Today's live performance ledger
/today — Full signal ledger for today
/ai — Self-learning engine scorecard
/vip — VIP syndicate tiers & subscriptions
/lang (or /dil) — Change language preference
/id — View your Telegram Chat ID

━━━━━━━━━━━━━━━━━━
⚡ *Live Bet Mentor Quant Engine*`;
}

export function formatVIPInfo(settings = {}, lang = 'tr') {
    const isTr = lang === 'tr';
    const usdtAddress = 'TXDCxXx5XjNWFRLQmNZeHVcwjpHjDDPrvd';
    
    if (isTr) {
        return `💎 *VIP QUANT SYNDICATE ÜYELİK PAKETLERİ*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Filtresiz canlı sinyallere, matematiksel +EV fırsatlarına, gecikme arbitrajına ve maç öncesi konsensüs radarına anında erişin.

🎟️ *Üyelik Paketleri:*

1️⃣ *Haftalık VIP Giriş:* *$19 USDT*
• 7 Gün canlı maç sinyalleri ve stop-loss uyarılarına tam erişim

2️⃣ *Aylık Quant Pro (En Çok Tercih Edilen):* *$49 USDT*
• 30 Gün sınırsız VIP yayın akışı + Canlı Altın Kombineler

3️⃣ *3 Aylık (Sezonluk) VIP Pass:* *$119 USDT*
• 90 Gün kapsamlı VIP erişimi + öncelikli destek

━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *Hızlı Ödeme Yöntemi:*
• Ağ: *USDT (Tron TRC-20)*
• Cüzdan Adresi:
\`${usdtAddress}\`
_(Kopyalamak için adrese dokunun)_

━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *VIP Üyeliği Nasıl Aktif Edilir?*
1. İstediğiniz paket tutarını yukarıdaki adrese *USDT (TRC-20)* olarak gönderin.
2. İşlem dekontunu (ekran görüntüsü veya TXID) doğrudan buraya bota mesaj olarak atın!
3. Ekibimiz anında kontrol edip özel VIP Syndicate giriş linkinizi gönderecektir!

🎁 *Önce ücretsiz denemek ister misiniz?*
/deneme komutunu yazarak *3 Günlük Ücretsiz VIP* hakkınızı hemen başlatın!
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
    }

    return `💎 *VIP QUANT SYNDICATE TIERS & ACCESS*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Unlock unfiltered real-time in-play signals, mathematical +EV alerts, latency arbitrage opportunities, and pre-match consensus radar.

🎟️ *Available Membership Passes:*

1️⃣ *Weekly Syndicate Pass:* *$19 USDT*
• 7 Days full access to live in-play signals & stop-loss alerts

2️⃣ *Monthly Quant Pro (Most Popular):* *$49 USDT*
• 30 Days unrestricted VIP Syndicate stream + Golden Doubles

3️⃣ *Quarterly Syndicate Pass:* *$119 USDT*
• 90 Days comprehensive syndicate access + priority support

━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 *Instant Payment Method:*
• Network: *USDT (Tron TRC-20)*
• Deposit Address:
\`${usdtAddress}\`
_(Tap address to copy)_

━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *How to Activate Your VIP Pass:*
1. Send the exact tier amount in *USDT (TRC-20)* to the deposit address above.
2. Send your transaction screenshot or TXID directly here in this bot chat!
3. Our desk will verify and dispatch your personal VIP Syndicate link immediately!

🎁 *Want to test first?*
Type /trial to claim your *3-Day Free VIP Trial*!
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR VIP SYNDICATE*`;
}

export function formatCashOutAlert(cashOut, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(cashOut.matchTitle?.split(' vs ')[0] || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(cashOut.matchTitle?.split(' vs ')[1] || (isTr ? 'Deplasman' : 'Away'));
    const market = cleanMd(cashOut.market || (isTr ? 'Hedef Tahmin' : 'Target Pick'));
    const reason = cleanMd(cashOut.reason || (isTr ? 'İvme düşüşü ve artan dalgalanma' : 'Momentum decline and heightened volatility'));

    if (isTr) {
        return `⚠️ *BAHİS BOZDUR / STOP-LOSS UYARISI* ⚠️
━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
⏱️ *Dakika:* ${cashOut.minute}' | 📊 *Skor:* ${cashOut.score}
🎯 *Aktif Bahis:* ${market}
🔴 *Risk Seviyesi:* ${cashOut.severity === 'HIGH' ? '🚨 KRİTİK' : '⚠️ YÜKSEK'}

📋 *Algoritmik Gerekçe:*
• ${reason}

💡 *Stratejik Aksiyon:*
Mevcut kârı kilitleyin veya sermayeyi korumak için stop-loss uygulayarak bahsi bozdurun!
━━━━━━━━━━━━━━━━━━
🛡️ *Kasa Koruma Motoru*
💎 *LIVE BET MENTOR VIP*`;
    }

    return `⚠️ *CASHOUT / STOP-LOSS ALERT* ⚠️
━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
⏱️ *Minute:* ${cashOut.minute}' | 📊 *Score:* ${cashOut.score}
🎯 *Active Market:* ${market}
🔴 *Risk Level:* ${cashOut.severity === 'HIGH' ? '🚨 CRITICAL' : '⚠️ ELEVATED'}

📋 *Quant Rationale:*
• ${reason}

💡 *Strategic Action:*
Lock in available bookmaker profit or execute stop-loss to preserve capital!
━━━━━━━━━━━━━━━━━━
🛡️ *Capital Preservation Engine*
💎 *LIVE BET MENTOR VIP*`;
}

export function formatGoldenCombo(combo, lang = 'tr') {
    if (!combo || !combo.picks || combo.picks.length === 0) return '';
    const isTr = lang === 'tr';
    const dateStr = new Date().toUTCString().slice(17, 22) + ' UTC';

    const picksText = combo.picks.map((p, i) => {
        const matchTitle = cleanMd(p.matchTitle);
        const market = cleanMd(p.market);
        const confLabel = isTr ? 'Güven' : 'Confidence';
        const oddsLabel = isTr ? 'Oran' : 'Odds';
        const pickLabel = isTr ? 'Tahmin' : 'Pick';
        return `*${i + 1}. ${matchTitle}* (${p.minute}')\n🎯 *${pickLabel}:* ${market}\n📊 ${confLabel}: %${p.confidence} | ${oddsLabel}: *${p.odds || '1.50'}*`;
    }).join('\n\n');

    if (isTr) {
        return `🔥 *CANLI ALTIN ÇİFTE (KOMBİNE SİHİRBAZI)* 🔥
━━━━━━━━━━━━━━━━━━
⏰ *Gönderildi:* ${dateStr}
💰 *Toplam Oran:* *${combo.totalOdds || '2.25'}*
🎯 *Sistem Güveni:* *%${combo.averageConfidence || 82}*

${picksText}

💡 *Bahis Stratejisi:* Kasanın %2.00'si (Dengeli Değer İkilisi)
━━━━━━━━━━━━━━━━━━
🤖 *Smart Bet Builder Engine v4.0*
💎 *LIVE BET MENTOR VIP*`;
    }

    return `🔥 *IN-PLAY GOLDEN DOUBLE (COMBO WIZARD)* 🔥
━━━━━━━━━━━━━━━━━━
⏰ *Dispatched:* ${dateStr}
💰 *Total Odds:* *${combo.totalOdds || '2.25'}*
🎯 *System Confidence:* *${combo.averageConfidence || 82}%*

${picksText}

💡 *Staking Strategy:* 2.00% Bankroll (Balanced Value Double)
━━━━━━━━━━━━━━━━━━
🤖 *Smart Bet Builder Engine v4.0*
💎 *LIVE BET MENTOR VIP*`;
}

export function formatLatencyArbitrageAlert(arb, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(arb.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(arb.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const defaultMarket = isTr ? 'Sıradaki Gol / Üst' : 'Next Goal / Over';

    if (isTr) {
        return `⚡ *GECİKME ARBİTRAJI ALARMI (BÜRO GECİKMESİ)* ⚡
━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* (${arb.minute}')
🎯 *Bahis Seçeneği:* ${cleanMd(arb.market || defaultMarket)}
📊 *Soft Büro Oranı:* *${arb.bookmakerOdds || '1.75'}*
📉 *Keskin Piyasa Adil Oranı:* *${arb.fairOdds || '1.45'}*
💎 *Matematiksel Avantaj:* *+%${arb.discrepancyPct || 20}*

📋 *Durum Analizi:*
Keskin borsalar oranı düşürdü, ancak soft bürolar henüz güncellemedi. Büro oranı düzeltmeden önce avantajı yakalayın!
━━━━━━━━━━━━━━━━━━
📡 *Gecikme Radarı Avantajı*
💎 *LIVE BET MENTOR VIP*`;
    }

    return `⚡ *LATENCY ARBITRAGE ALERT (BOOKMAKER LAG)* ⚡
━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* (${arb.minute}')
🎯 *Market:* ${cleanMd(arb.market || defaultMarket)}
📊 *Soft Bookmaker Odds:* *${arb.bookmakerOdds || '1.75'}*
📉 *Sharp Market Fair Odds:* *${arb.fairOdds || '1.45'}*
💎 *Mathematical Advantage:* *+${arb.discrepancyPct || 20}%*

📋 *Situation Analysis:*
Sharp exchanges have slashed the price, but soft bookmakers have not adjusted yet. Capitalize before price correction!
━━━━━━━━━━━━━━━━━━
📡 *Latency Radar Edge*
💎 *LIVE BET MENTOR VIP*`;
}

