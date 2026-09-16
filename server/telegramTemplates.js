/**
 * TELEGRAM MESSAGE TEMPLATES
 * Professional betting signal message formatters - Compact & Concise
 */

export function cleanMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`\[\]])/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveMarketText(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const rec = alert.recommendation || {};
    const key = rec.marketKey || '';
    let label = cleanMd(rec.marketLabel || rec.market || '');
    let team = cleanMd(rec.team || (key.includes('home') ? home : key.includes('away') ? away : ''));
    if (team.toLowerCase() === 'home') team = home;
    if (team.toLowerCase() === 'away') team = away;

    const oddsVal = rec.odds || alert.odds;
    const oddsStr = oddsVal ? (isTr ? ` (Oran: ${oddsVal})` : ` (Odds: ${oddsVal})`) : '';

    // Direct explicit prediction if provided
    if (rec.predictionText) {
        let pt = cleanMd(rec.predictionText);
        if (isTr) {
            pt = pt.replace(/\bNext Goal:\s*/gi, 'Sıradaki Gol: ')
                   .replace(/\bOver\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Üst Gol')
                   .replace(/\bUnder\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Alt Gol')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*Yes\)\b/gi, 'Karşılıklı Gol Var (KG Var)')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*No\)\b/gi, 'Karşılıklı Gol Yok (KG Yok)')
                   .replace(/\bMatch Winner:\s*/gi, 'Maç Sonucu: ')
                   .replace(/\(Odds:\s*([0-9.]+)\)/gi, '(Oran: $1)')
                   .replace(/\(Oran:\s*([0-9.]+)\)/gi, '(Oran: $1)');
        }
        return pt;
    }

    // 1. Latency Arbitrage
    if (key === 'market_latency_arbitrage' || rec.edgeType === 'LATENCY') {
        const target = team ? `${team} (Sıradaki Gol)` : 'Sıradaki Gol';
        return isTr ? `Gecikme Arbitrajı: ${target}${oddsStr}` : `Latency Arbitrage: ${target}${oddsStr}`;
    }

    // 2. Mathematical Value (+EV)
    if (key === 'market_plus_ev' || rec.edgeType === 'PLUS_EV') {
        return isTr ? `Değer Oran (+EV): ${label || 'Üst Gol'}${oddsStr}` : `Value Edge (+EV): ${label || 'Over Goals'}${oddsStr}`;
    }

    // 3. Next Goal - Home / Away
    if (key === 'market_next_goal_home' || key === 'HOME_NEXT_GOAL' || (label.toLowerCase().includes('next goal') && label.includes(home))) {
        return isTr ? `Sıradaki Gol: ${home}${oddsStr}` : `Next Goal: ${home}${oddsStr}`;
    }
    if (key === 'market_next_goal_away' || key === 'AWAY_NEXT_GOAL' || (label.toLowerCase().includes('next goal') && label.includes(away))) {
        return isTr ? `Sıradaki Gol: ${away}${oddsStr}` : `Next Goal: ${away}${oddsStr}`;
    }

    // 4. Over / Under Goals
    if (key === 'market_over_goals' || key === 'OVER_NEXT_DYNAMIC' || label.toLowerCase().includes('over') || label.includes('Üst')) {
        const goalsMatch = label.match(/(\d+\.?\d*)/);
        const goals = rec.marketParams?.goals || rec.target || (goalsMatch ? goalsMatch[1] : '2.5');
        return isTr ? `Maçta ${goals} Üst Gol${oddsStr}` : `Over ${goals} Match Goals${oddsStr}`;
    }

    // 5. BTTS
    if (key === 'market_btts' || key === 'btts' || label.toLowerCase().includes('btts') || label.toLowerCase().includes('both teams') || label.includes('KG')) {
        return isTr ? `Karşılıklı Gol Var (KG Var)${oddsStr}` : `Both Teams To Score (BTTS: Yes)${oddsStr}`;
    }

    // 6. First Half
    if (key === 'market_fh_over05' || label.toLowerCase().includes('first half') || label.includes('İY 0.5') || label.includes('İlk Yarı')) {
        return isTr ? `İlk Yarı 0.5 Üst${oddsStr}` : `First Half Over 0.5 Goals${oddsStr}`;
    }

    // 7. Match Winner
    if (key === 'HOME_WIN_NEXT' || label.toLowerCase().includes('home win')) {
        return isTr ? `Maç Sonucu: ${home}${oddsStr}` : `Match Winner: ${home}${oddsStr}`;
    }
    if (key === 'AWAY_WIN_NEXT' || label.toLowerCase().includes('away win')) {
        return isTr ? `Maç Sonucu: ${away}${oddsStr}` : `Match Winner: ${away}${oddsStr}`;
    }

    // Fallback translation of English labels
    if (label) {
        let cleanL = label
            .replace(/\bNext Goal:\s*/gi, 'Sıradaki Gol: ')
            .replace(/\bOver\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Üst Gol')
            .replace(/\bUnder\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Alt Gol')
            .replace(/\bBoth Teams To Score\s*\(BTTS:\s*Yes\)\b/gi, 'Karşılıklı Gol Var (KG Var)')
            .replace(/\(Odds:\s*([0-9.]+)\)/gi, '(Oran: $1)');
        return `${cleanL}${oddsStr}`;
    }

    return isTr ? `Sıradaki Gol: ${team || home}${oddsStr}` : `Next Goal: ${team || home}${oddsStr}`;
}

export function formatVIPSignal(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const leagueName = alert.league || alert.leagueName;
    const leagueLine = leagueName ? `🏆 ${cleanMd(leagueName)}\n` : '';

    const badge = alert.level === 'ALPHA' ? '💎 ALFA SİNYAL' : '🔥 CANLI ALARM';
    const marketText = resolveMarketText(alert, lang);
    const oddsVal = alert.recommendation?.odds || alert.odds || '1.80';
    const conf = alert.recommendation?.confidence || 82;
    const stake = alert.level === 'ALPHA' ? '1.5' : '1.0';

    // Concise single-line analysis
    let reasonText = '';
    if (alert.recommendation?.reasoning && Array.isArray(alert.recommendation.reasoning) && alert.recommendation.reasoning.length > 0) {
        reasonText = cleanMd(alert.recommendation.reasoning[0]);
    } else if (alert.activeStrategies && alert.activeStrategies[0]?.verdict) {
        reasonText = cleanMd(alert.activeStrategies[0].verdict);
    }
    
    // Turkish translation for reason if in English
    if (isTr && reasonText) {
        reasonText = reasonText
            .replace(/Relentless pitch siege by (.*?) \((\d+)% possession\)/gi, '$1 yoğun baskı kurdu (%$2 topla oynama)')
            .replace(/High away dominance by (.*?) \((\d+)% possession\)/gi, '$1 deplasmanda üstün (%$2 topla oynama)')
            .replace(/High in-play tempo with (\d+) shots on target/gi, 'Yüksek tempo ve $1 isabetli şut')
            .replace(/Both sides demonstrating dangerous vertical penetration/gi, 'Karşılıklı tehlikeli hücumlar ve açık oyun')
            .replace(/Major penalty box infiltration \((\d+) touches in box\)/gi, 'Ceza sahasında yoğun temas ($1 topla buluşma)')
            .replace(/Unanswered shot supremacy/gi, 'Belirgin şut üstünlüğü');
    }

    if (!reasonText) {
        reasonText = isTr 
            ? (alert.xgSurplus > 0 ? `Yoğun hücum baskısı ve xG üstünlüğü (+${alert.xgSurplus.toFixed(2)})` : 'Saha baskısı ve yüksek tempo onaylandı')
            : 'Strong pitch pressure and high tempo confirmed';
    }

    // Red card or dropping odds highlight (if any)
    let extraLine = '';
    const homeReds = alert.cards?.home?.red || alert.redCards?.home || 0;
    const awayReds = alert.cards?.away?.red || alert.redCards?.away || 0;
    if (homeReds > 0 || awayReds > 0) {
        if (homeReds !== awayReds) {
            const advTeam = awayReds > homeReds ? home : away;
            extraLine += isTr ? `\n🟥 *Kırmızı Kart:* ${advTeam} (+1 Kişi Avantajı)` : `\n🟥 *Red Card:* ${advTeam} (+1 Man Advantage)`;
        }
    }
    if (alert.oddsMovement && alert.oddsMovement.isDropping) {
        extraLine += isTr 
            ? `\n📉 *Oran Düşüşü:* %${alert.oddsMovement.dropPct.toFixed(0)} düşüş (Akıllı Para Akışı)`
            : `\n📉 *Dropping Odds:* ${alert.oddsMovement.dropPct.toFixed(0)}% squeeze`;
    }

    if (isTr) {
        return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} vs ${away}*
${leagueLine}
🎯 *TAHMİN:* *${marketText}*
⚡ *Oran:* *${oddsVal}* | *Güven:* %${conf} | *Kasa:* %${stake}
📊 *Analiz:* ${reasonText}${extraLine}

💎 *Live Bet Mentor VIP*`;
    }

    return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} vs ${away}*
${leagueLine}
🎯 *TARGET:* *${marketText}*
⚡ *Odds:* *${oddsVal}* | *Confidence:* ${conf}% | *Stake:* ${stake}%
📊 *Analysis:* ${reasonText}${extraLine}

💎 *Live Bet Mentor VIP*`;
}

export function formatPublicTeaser(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const leagueName = alert.league || alert.leagueName;
    const leagueLine = leagueName ? `🏆 ${cleanMd(leagueName)}\n` : '';
    
    if (isTr) {
        return `📡 *CANLI MAÇ RADARI ALARMI*
⚽ *${home} vs ${away}*
⏱️ Canlı: *${alert.minute}'* · Skor: *[${alert.score || '0-0'}]*
${leagueLine}
⚡ *Yüksek Gol Baskısı & Algoritmik Değer Tespit Edildi!*
🔒 _Tam tahmin, adil oran ve kasa yönetimi VIP grubumuzda paylaşıldı._

👉 *VIP Giriş & Bilgi:* @Livebetmentorbot`;
    }

    return `📡 *LIVE IN-PLAY RADAR ALERT*
⚽ *${home} vs ${away}*
⏱️ In-Play: *${alert.minute}'* · Score: *[${alert.score || '0-0'}]*
${leagueLine}
⚡ *High In-Play Pressure & Value Edge Detected!*
🔒 _Full prediction, fair odds & stake sizing dispatched to VIP Syndicate._

👉 *Unlock VIP Access:* @Livebetmentorbot`;
}

export function resolveConsensusPredName(pred, lang = 'tr') {
    if (!pred) return 'N/A';
    const p = String(pred).trim();
    const isTr = lang === 'tr';

    if (p === '1') return isTr ? 'Ev Sahibi (MS 1)' : 'Home Win (1)';
    if (p === 'X' || p === 'x') return isTr ? 'Beraberlik (MS X)' : 'Draw (X)';
    if (p === '2') return isTr ? 'Deplasman (MS 2)' : 'Away Win (2)';
    if (p === '1X' || p === '1x') return isTr ? 'Çifte Şans (1X)' : 'Double Chance (1X)';
    if (p === 'X2' || p === 'x2') return isTr ? 'Çifte Şans (X2)' : 'Double Chance (X2)';
    if (p === '12') return isTr ? 'Çifte Şans (12)' : 'Double Chance (12)';
    if (p.toLowerCase().includes('üst') || p.toLowerCase().includes('over')) return isTr ? '2.5 Gol Üstü' : 'Over 2.5 Goals';
    if (p.toLowerCase().includes('alt') || p.toLowerCase().includes('under')) return isTr ? '2.5 Gol Altı' : 'Under 2.5 Goals';
    if (p.toLowerCase().includes('var') || p.toLowerCase().includes('yes') || p.toLowerCase().includes('btts')) return isTr ? 'Karşılıklı Gol Var (KG Var)' : 'Both Teams To Score (BTTS: Yes)';
    if (p.toLowerCase().includes('yok') || p.toLowerCase().includes('no')) return isTr ? 'Karşılıklı Gol Yok' : 'Both Teams To Score (BTTS: No)';
    return p;
}

export function formatRadarPick(match, lang = 'tr') {
    const isTr = lang === 'tr';
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
    
    const rawTopPred = topPrediction ? topPrediction[0] : (match.topPred || 'N/A');
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 10;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);
    const topPredText = resolveConsensusPredName(rawTopPred, lang);

    const home = cleanMd(match.home || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(match.away || (isTr ? 'Deplasman' : 'Away'));
    const league = cleanMd(match.league || (isTr ? 'Bülten Maçı' : 'Fixture'));

    // Top predicted score if available
    let topScore = '';
    if (match.scorePredictions && Object.keys(match.scorePredictions).length > 0) {
        const scores = Object.values(match.scorePredictions);
        const scoreCounts = {};
        scores.forEach(s => { scoreCounts[s] = (scoreCounts[s] || 0) + 1; });
        const sortedScores = Object.entries(scoreCounts).sort((a, b) => b[1] - a[1]);
        if (sortedScores[0]) topScore = sortedScores[0][0];
    }

    if (isTr) {
        return `🎯 *GÜNÜN KONSENSÜS TAHMİNİ*
⚽ *${home} vs ${away}* (${match.time ? `⏰ ${match.time}` : ''})
🏆 ${league}

🔥 *ORTAK TAHMİN:* *${topPredText}*
📊 *Konsensüs:* *%${agreePercent}* (${topCount}/${totalSources} Analiz Kaynağı Aynı Fikirde)
${topScore ? `🔢 *Öne Çıkan Skor:* *${topScore}*\n` : ''}💰 *Kasa Tavsiyesi:* %1.5 - %2.0
━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP*`;
    }

    return `🎯 *TODAY'S CONSENSUS RADAR PICK*
⚽ *${home} vs ${away}* (${match.time ? `⏰ ${match.time}` : ''})
🏆 ${league}

🔥 *CONSENSUS PICK:* *${topPredText}*
📊 *Agreement:* *${agreePercent}%* (${topCount}/${totalSources} Sources Concurring)
${topScore ? `🔢 *Top Score Forecast:* *${topScore}*\n` : ''}💰 *Staking:* 1.5% - 2.0% Bankroll
━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP*`;
}

export function formatRadarTeaser(match, lang = 'tr') {
    const isTr = lang === 'tr';
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 10;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);

    const home = cleanMd(match.home || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(match.away || (isTr ? 'Deplasman' : 'Away'));
    const league = cleanMd(match.league || (isTr ? 'Bülten Maçı' : 'Fixture'));

    if (isTr) {
        return `📡 *MAÇ ÖNCESİ KONSENSÜS ALARMI*
⚽ *${home} vs ${away}* (${match.time ? `⏰ ${match.time}` : ''})
🏆 ${league}

⚡ *10 Küresel Analiz Modeli %${agreePercent} Konsensüse Ulaştı!*
🔒 _Ortak tahmin, skor analizi ve kasa miktarı VIP grupta paylaşıldı._

👉 *3 Günlük Ücretsiz VIP Deneme:* /deneme
💎 *Live Bet Mentor*`;
    }

    return `📡 *PRE-MATCH CONSENSUS RADAR ALERT*
⚽ *${home} vs ${away}* (${match.time ? `⏰ ${match.time}` : ''})
🏆 ${league}

⚡ *10 Predictive Models Reached ${agreePercent}% Consensus!*
🔒 _Full pick, score forecast & bankroll stake released in VIP._

👉 *Claim 3-Day Free VIP:* /trial
💎 *Live Bet Mentor*`;
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
            return `🟢 *HEDEF BAŞARILI! (KAZANDI)*
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
🎯 *Tahmin:* ${market} ✅
📈 *Bugün:* %${winRate} (${currentStats.won || 1}/${totalResolved || 1} Kazandı)
💎 *Live Bet Mentor VIP*`;
        } else {
            return `🔴 *MAÇ SONUÇLANDI*
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
🎯 *Tahmin:* ${market}
📈 *Bugün:* %${winRate} (${currentStats.won || 0}/${totalResolved || 1})
💎 *Live Bet Mentor VIP*`;
        }
    }

    if (isWon) {
        return `🟢 *TARGET HIT! (WON)*
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
🎯 *Pick:* ${market} ✅
📈 *Today:* ${winRate}% (${currentStats.won || 1}/${totalResolved || 1} Won)
💎 *Live Bet Mentor VIP*`;
    } else {
        return `🔴 *MATCH SETTLED*
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
🎯 *Pick:* ${market}
📈 *Today:* ${winRate}% (${currentStats.won || 0}/${totalResolved || 1})
💎 *Live Bet Mentor VIP*`;
    }
}

export function formatCashOutAlert(cashOut, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(cashOut.matchTitle?.split(' vs ')[0] || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(cashOut.matchTitle?.split(' vs ')[1] || (isTr ? 'Deplasman' : 'Away'));
    const market = cleanMd(cashOut.market || (isTr ? 'Aktif Bahis' : 'Active Market'));
    const reason = cleanMd(cashOut.reason || (isTr ? 'Hücum temposu düştü' : 'Momentum decline'));

    if (isTr) {
        return `🚨 *BAHİS BOZDUR / STOP-LOSS UYARISI* 🚨
⚽ *${home} vs ${away}* (${cashOut.minute}' · [*${cashOut.score}*])
🎯 *Aktif Bahis:* ${market}
⚠️ *Durum:* ${reason}

💡 *Aksiyon:* Kârı kilitleyin veya sermayeyi korumak için bahsi bozdurun!
🛡️ *Live Bet Mentor Kasa Koruma*`;
    }

    return `🚨 *CASHOUT / STOP-LOSS ALERT* 🚨
⚽ *${home} vs ${away}* (${cashOut.minute}' · [*${cashOut.score}*])
🎯 *Active Market:* ${market}
⚠️ *Status:* ${reason}

💡 *Action:* Lock in profit or execute stop-loss to preserve bankroll!
🛡️ *Live Bet Mentor Capital Shield*`;
}

export function formatGoldenCombo(combo, lang = 'tr') {
    if (!combo || !combo.picks || combo.picks.length === 0) return '';
    const isTr = lang === 'tr';

    const picksText = combo.picks.map((p, i) => {
        const matchTitle = cleanMd(p.matchTitle);
        const market = cleanMd(p.market);
        const odds = p.odds || '1.50';
        return `${i + 1}️⃣ *${matchTitle}* (${p.minute}') ➔ *${market}* (Oran: ${odds})`;
    }).join('\n');

    if (isTr) {
        return `🔥 *CANLI ALTIN ÇİFTE (GÜNÜN KOMBİNESİ)* 🔥
💰 *Toplam Oran:* *${combo.totalOdds || '2.25'}* | *Güven:* %${combo.averageConfidence || 82}

${picksText}

💡 *Kasa Tavsiyesi:* %2.0 (Dengeli Değer İkilisi)
💎 *Live Bet Mentor VIP*`;
    }

    return `🔥 *IN-PLAY GOLDEN DOUBLE* 🔥
💰 *Total Odds:* *${combo.totalOdds || '2.25'}* | *Confidence:* ${combo.averageConfidence || 82}%

${picksText}

💡 *Staking:* 2.0% Bankroll (Value Double)
💎 *Live Bet Mentor VIP*`;
}

export function formatLatencyArbitrageAlert(arb, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(arb.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(arb.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const defaultMarket = isTr ? 'Sıradaki Gol / Üst' : 'Next Goal / Over';

    if (isTr) {
        return `⚡ *BÜRO ORAN AÇIĞI (GECİKME ARBİTRAJI)* ⚡
⚽ *${home} vs ${away}* (${arb.minute}')
🎯 *Bahis:* ${cleanMd(arb.market || defaultMarket)}
📊 *Büro Oranı:* *${arb.bookmakerOdds || '1.75'}* | *Adil Piyasa:* *${arb.fairOdds || '1.45'}* (+%${arb.discrepancyPct || 20} Değer!)
⚡ Büro oranı güncellemeden önce değerlendirin!

💎 *Live Bet Mentor VIP*`;
    }

    return `⚡ *LATENCY ARBITRAGE ALERT* ⚡
⚽ *${home} vs ${away}* (${arb.minute}')
🎯 *Market:* ${cleanMd(arb.market || defaultMarket)}
📊 *Bookmaker Odds:* *${arb.bookmakerOdds || '1.75'}* | *Fair Odds:* *${arb.fairOdds || '1.45'}* (+${arb.discrepancyPct || 20}% Edge!)
⚡ Capitalize before bookmaker price correction!

💎 *Live Bet Mentor VIP*`;
}

export function formatDailyReport(stats, lang = 'tr') {
    const isTr = lang === 'tr';
    const date = new Date().toLocaleDateString(isTr ? 'tr-TR' : 'en-GB', {
        day: '2-digit',
        month: 'short'
    });

    const winRate = stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : '0.0';

    if (isTr) {
        return `📊 *GÜNLÜK ALGORİTMİK RAPOR (${date})*
━━━━━━━━━━━━━━━━━━
✅ Kazandı: *${stats.won || 0}*
❌ Kaybetti: *${stats.lost || 0}*
⏳ Devam Eden: *${stats.pending || 0}*

📈 *Başarı Oranı: %${winRate}*
🔥 Toplam Sinyal: ${stats.total || 0}
${stats.bestPick ? `🏆 En İyi Tahmin: ${cleanMd(stats.bestPick)}\n` : ''}━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Labs*`;
    }

    return `📊 *DAILY QUANT REPORT (${date})*
━━━━━━━━━━━━━━━━━━
✅ Won: *${stats.won || 0}*
❌ Lost: *${stats.lost || 0}*
⏳ In-Play: *${stats.pending || 0}*

📈 *Win Rate: ${winRate}%*
🔥 Total Signals: ${stats.total || 0}
${stats.bestPick ? `🏆 Top Pick: ${cleanMd(stats.bestPick)}\n` : ''}━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Labs*`;
}

export function formatWelcome(lang = 'tr') {
    const isTr = lang === 'tr';
    if (isTr) {
        return `🏆 *LIVE BET MENTOR BOT*
Yapay zeka destekli canlı analiz ve otonom değer sinyalleri servisi.

📊 *Özellikler:*
• Canlı Değer Sinyalleri (HOT / ALEV / ALPHA)
• 🛡️ Bahis Bozdur & Stop-Loss Kasa Koruma Radarı
• 🎟️ Günün Canlı Altın İkilisi (Kombine Sihirbazı)
• ⚡ Büro Oran Açığı & Gecikme Arbitrajı
• Şeffaf günlük başarı takibi

🎁 *Ücretsiz Deneme:*
/deneme — *3 Günlük Ücretsiz VIP Üyeliğinizi* hemen başlatın!

📩 *Hızlı Komutlar:*
/deneme — 3 günlük ücretsiz VIP deneme
/profil — VIP üyelik durumunu sorgula
/kupon — Günün canlı altın kombinesi
/stats — Günlük performans tablosu
/vip — VIP üyelik paketleri
/id — Telegram Chat ID bilginiz
━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Engine*`;
    }

    return `🏆 *LIVE BET MENTOR BOT*
AI-powered live football analysis & value signal service.

📊 *Features:*
• Real-Time Value Signals (HOT / FLAME / ALPHA)
• 🛡️ Cash-Out & Stop-Loss Capital Shield
• 🎟️ Daily Golden Double (Combo Wizard)
• ⚡ Bookmaker Lag & Latency Arbitrage

🎁 *Free Trial:*
/trial — Activate your *3-Day Free VIP Pass* instantly!

📩 *Commands:*
/trial — 3-day free VIP trial
/profile — Check subscription status
/combo — Daily Golden Double
/stats — Performance ledger
/vip — VIP membership tiers
/id — Your Telegram Chat ID
━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Engine*`;
}

export function formatVIPInfo(settings = {}, lang = 'tr') {
    const isTr = lang === 'tr';
    const usdtAddress = 'TXDCxXx5XjNWFRLQmNZeHVcwjpHjDDPrvd';
    
    if (isTr) {
        return `💎 *VIP QUANT SYNDICATE ÜYELİK PAKETLERİ*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Canlı sinyallere, +EV fırsatlarına, gecikme arbitrajına ve konsensüs radarına anında erişin.

🎟️ *Paketler:*
1️⃣ *Haftalık VIP:* *$19 USDT* (7 Günlük tam erişim)
2️⃣ *Aylık VIP (Popüler):* *$49 USDT* (30 Günlük sınırsız erişim)
3️⃣ *3 Aylık Sezonluk Pass:* *$119 USDT* (90 Günlük tam erişim)

💳 *Ödeme Adresi (USDT TRC-20):*
\`${usdtAddress}\`
_(Kopyalamak için adrese dokunun)_

⚡ *Aktivasyon:*
1. Tutarı yukarıdaki adrese gönderin.
2. Dekontu (ekran görüntüsü veya TXID) buraya bota mesaj olarak atın.
3. VIP giriş bağlantınız anında gönderilecektir!

🎁 *Ücretsiz denemek için:* /deneme
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
    }

    return `💎 *VIP QUANT SYNDICATE MEMBERSHIP*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Instant access to live in-play signals, +EV edges, latency arbitrage & consensus radar.

🎟️ *Tiers:*
1️⃣ *Weekly Pass:* *$19 USDT* (7 Days full access)
2️⃣ *Monthly Pro:* *$49 USDT* (30 Days unrestricted)
3️⃣ *Quarterly Pass:* *$119 USDT* (90 Days full access)

💳 *Payment (USDT TRC-20):*
\`${usdtAddress}\`
_(Tap to copy)_

⚡ *Activation:*
1. Send tier amount in USDT (TRC-20).
2. Send screenshot or TXID here to this chat.
3. Instant VIP access link will be dispatched!

🎁 *Free trial:* /trial
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
}
