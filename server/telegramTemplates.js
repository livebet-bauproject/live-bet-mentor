/**
 * TELEGRAM MESSAGE TEMPLATES
 * Professional betting signal message formatters
 */

export function cleanMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`\[\]])/g, ' ');
}

export function resolveMarketText(alert) {
    const home = cleanMd(alert.homeTeam || 'Ev Sahibi');
    const away = cleanMd(alert.awayTeam || 'Deplasman');
    const rec = alert.recommendation || {};
    const key = rec.marketKey || '';
    const label = cleanMd(rec.marketLabel || rec.market || '');
    const team = cleanMd(rec.team || (key.includes('home') ? home : key.includes('away') ? away : ''));
    const oddsStr = rec.odds ? ` (Oran: ${rec.odds})` : '';

    // Direct explicit prediction if provided
    if (rec.predictionText) {
        return `${cleanMd(rec.predictionText)}${oddsStr}`;
    }

    // 1. Gecikme Arbitrajı (En yüksek öncelik)
    if (key === 'market_latency_arbitrage' || rec.edgeType === 'LATENCY') {
        const target = team ? `${team} (${label || 'Sıradaki Gol'})` : (label || 'Sıradaki Gol');
        return `Gecikme Arbitrajı: ${target}${oddsStr}`;
    }

    // 2. Matematiksel Değer (+EV)
    if (key === 'market_plus_ev' || rec.edgeType === 'PLUS_EV') {
        return `Değerli Bahis (+EV): ${label || 'Toplam Üst'}${oddsStr}`;
    }

    // 3. Next Goal - Ev / Deplasman
    if (key === 'market_next_goal_home' || key === 'HOME_NEXT_GOAL') {
        return `Sıradaki Golü ${home} Atar${oddsStr}`;
    }
    if (key === 'market_next_goal_away' || key === 'AWAY_NEXT_GOAL') {
        return `Sıradaki Golü ${away} Atar${oddsStr}`;
    }

    // 3b. Kazanmaya Yakın (Match Winner)
    if (key === 'HOME_WIN_NEXT') {
        return `${home} Kazanır (Maç Sonu)${oddsStr}`;
    }
    if (key === 'AWAY_WIN_NEXT') {
        return `${away} Kazanır (Maç Sonu)${oddsStr}`;
    }

    // 4. İlk Yarı 0.5 Üst
    if (key === 'market_fh_over05' || label.includes('İY 0.5') || label.toLowerCase().includes('ilk yarı 0.5')) {
        return `İlk Yarı 0.5 Üst Olur${oddsStr}`;
    }

    // 5. Karşılıklı Gol Var (KG Var)
    if (key === 'market_btts' || key === 'btts' || label.toUpperCase().includes('KG') || label.toLowerCase().includes('karşılıklı gol')) {
        return `Karşılıklı Gol Var (KG Var)${oddsStr}`;
    }

    // 6. Üst / Alt Goller
    if (key === 'market_over_goals' || key === 'OVER_NEXT_DYNAMIC' || label.includes('Üst') || label.toLowerCase().includes('over')) {
        const goalsMatch = label.match(/(\d+\.?\d*)\s*Üst/i);
        const goals = rec.marketParams?.goals || rec.target || (goalsMatch ? goalsMatch[1] : '2.5');
        return `${goals} Üst Olur${oddsStr}`;
    }

    // 7. Sıradaki Gol Label kontrolü
    if (label.toLowerCase().includes('sıradaki gol') || label.toLowerCase().includes('next goal')) {
        const targetTeam = team || (label.includes('Ev') ? home : label.includes('Dep') ? away : home);
        return `Sıradaki Golü ${targetTeam} Atar${oddsStr}`;
    }

    // 7. Strateji Bazlı
    if (key === 'COMEBACK' || key === 'ADV_COMEBACK') {
        return `Geri Dönüş: Sıradaki Golü ${team || home} Atar${oddsStr}`;
    }
    if (key === 'PRESS' || key === 'MOMENTUM_SURGE') {
        return `Baskı Baskın: Sıradaki Golü ${team || home} Atar${oddsStr}`;
    }
    if (key === 'RED_CARD_ADV') {
        return `Kırmızı Kart Avantajı: Sıradaki Golü ${team || home} Atar${oddsStr}`;
    }
    if (key === 'UNDERDOG_RESIST') {
        return `Sürpriz Direnç: ${team || away} Gol Atar / Çifte Şans${oddsStr}`;
    }
    if (key === 'COUNTER_ATTACK') {
        return `Tehlikeli Kontra: Sıradaki Golü ${team || away} Atar${oddsStr}`;
    }

    // 8. Anlamlı label varsa
    if (label && label.length > 0 && label !== 'Strateji Sinyali' && label !== 'Analiz Devam Ediyor') {
        return `${label}${oddsStr}`;
    }

    // 9. Takım varsa
    if (team) {
        return `Sıradaki Golü ${team} Atar${oddsStr}`;
    }

    return `Sıradaki Golü ${home} Atar${oddsStr}`;
}

export function formatVIPSignal(alert) {
    const levelEmoji = {
        'ALPHA': '💎',
        'ALEV': '🔥',
        'SICAK': '⚡'
    };

    const emoji = levelEmoji[alert.level] || '📊';
    const levelText = alert.level === 'ALPHA' ? 'ALPHA SİNYAL' :
                      alert.level === 'ALEV' ? 'ALEV SİNYALİ' : 'SICAK SİNYAL';

    const home = cleanMd(alert.homeTeam || 'Ev Sahibi');
    const away = cleanMd(alert.awayTeam || 'Deplasman');

    // Resolving clean, unambiguous prediction & market text
    const marketText = resolveMarketText(alert);

    // Build strategies section
    const activeStrategies = alert.activeStrategies || [];
    const strategiesText = activeStrategies.length > 0 
        ? activeStrategies.map(s => `${s.icon || '🎯'} *${cleanMd(s.label || s.id)}*`).join('\n')
        : '• Algoritma Onaylı';

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
                if (r.key === 'reason_xg_diff') reasons.push(`• xG Farkı: ${r.params?.diff || ''} üstünlük`);
                else if (r.key === 'reason_pressure') reasons.push(`• Yoğun Hücum Baskısı: ${r.params?.pressure || ''}`);
                else if (r.key === 'reason_value_detected') reasons.push(`• Algoritmik Değer Tespit Edildi (+EV)`);
                else if (r.key === 'reason_alpha_signal') reasons.push(`• Yüksek Olasılıklı Alpha Sinyali`);
                else if (r.key === 'reason_critical_min') reasons.push(`• Kritik Zaman Dilimi (${r.params?.minute}')`);
            }
        });
    }
    if (alert.maxEV > 0.15) reasons.push(`• 💰 Yüksek Değer: EV +%${(alert.maxEV * 100).toFixed(0)}`);
    
    const reasonsText = reasons.length > 0 ? reasons.slice(0, 3).join('\n') : '• Çoklu gösterge ve kuant veri mutabakatı';

    // Confidence bar
    const conf = alert.recommendation?.confidence || 75;
    const filled = Math.round(conf / 10);
    const confBar = '▓'.repeat(filled) + '░'.repeat(10 - filled);

    let evText = '';
    if (alert.bestEV && alert.bestEV.ev >= 5) {
        evText = `💎 *Matematiksel Değer (+EV):* +%${alert.bestEV.ev} (${alert.bestEV.label} | Adil: ${alert.bestEV.fairOdds})`;
    } else if (alert.maxEV > 0.05) {
        evText = `📈 *Beklenen Değer (EV):* +%${(alert.maxEV * 100).toFixed(0)}`;
    }
    const surplusText = alert.xgSurplus > 0 ? `⚽ *xG Surplus:* +${alert.xgSurplus.toFixed(2)}` : '';

    // Red Card Tactical Info
    let redCardInfo = '';
    const homeReds = alert.cards?.home?.red || alert.redCards?.home || 0;
    const awayReds = alert.cards?.away?.red || alert.redCards?.away || 0;
    if (homeReds > 0 || awayReds > 0) {
        if (homeReds !== awayReds) {
            const advTeam = awayReds > homeReds ? home : away;
            const diff = Math.abs(awayReds - homeReds);
            redCardInfo = `🟥 *Sayısal Üstünlük:* ${advTeam} (+${diff} Kişi Fazla)`;
        } else {
            redCardInfo = `🟥 *Kırmızı Kartlar:* ${homeReds} - ${awayReds} (10 vs 10)`;
        }
    }

    // Smart Money / Dropping Odds Info
    let droppingOddsInfo = '';
    if (alert.oddsMovement && alert.oddsMovement.isDropping) {
        droppingOddsInfo = `📉 *Smart Money:* ${alert.oddsMovement.initialOdds} ➔ ${alert.oddsMovement.currentOdds} (%${alert.oddsMovement.dropPct.toFixed(0)} Düşüş)`;
    }

    // Latency Arbitrage Alert
    let latencyInfo = '';
    if (alert.latencyEdge) {
        latencyInfo = `⚡ *Gecikme Arbitrajı:* Büro ${alert.latencyEdge.softOdds} vs Adil ${alert.latencyEdge.sharpFairOdds} (+%${alert.latencyEdge.discrepancyPct} Makas!)`;
    }

    const leagueName = alert.league || alert.leagueName;
    const leagueLine = leagueName ? `🏆 *Lig:* ${cleanMd(leagueName)}\n` : '';

    const message = `${emoji} *${levelText}*
    
⚽ *${home} vs ${away}*
${leagueLine}📊 Skor: ${alert.score} · Dk ${alert.minute}'

${strategiesText}

💡 *Pazar:* ${marketText}
🎯 Güven: ${confBar} %${conf}
${evText}
${surplusText}
${latencyInfo ? latencyInfo + '\n' : ''}${redCardInfo ? redCardInfo + '\n' : ''}${droppingOddsInfo ? droppingOddsInfo + '\n' : ''}${alert.dqs ? `📈 Veri Kalitesi (DQS): ${alert.dqs.toFixed(2)}` : ''}

📋 *Analiz:*
${reasonsText}

💰 *Kasa Yönetimi:*
Önerilen: *%1.00 Kasa* (Quarter-Kelly)

⏰ ${new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}

━━━━━━━━━━━━━━━━━━
🤖 *v4.0 Kuant Motoru Onaylı*
💎 *LIVE BET MENTOR VIP*`;

    return message;
}

export function formatPublicTeaser(alert) {
    const home = cleanMd(alert.homeTeam || 'Ev');
    const away = cleanMd(alert.awayTeam || 'Dep');
    const message = `⚡ *CANLI ANALİZ*

⚽ *${home} vs ${away}*
🏟️ Dk ${alert.minute}'

🔒 _Detaylı analiz ve market önerisi VIP grupta..._

💎 VIP erişim için: /vip`;

    return message;
}

export function formatDailyReport(stats) {
    const date = new Date().toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Istanbul'
    });

    const winRate = stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : '0.0';

    const message = `📊 *GÜNLÜK PERFORMANS RAPORU*

📅 ${date}
━━━━━━━━━━━━━━━━━━

✅ Kazanan: *${stats.won || 0}*
❌ Kaybeden: *${stats.lost || 0}*
⏳ Bekleyen: *${stats.pending || 0}*

📈 *Günlük Başarı: %${winRate}*
🔥 Toplam Sinyal: ${stats.total || 0}

${stats.bestPick ? `🏆 En İyi Seçim: ${cleanMd(stats.bestPick)}` : ''}

━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR*`;

    return message;
}

export function formatSignalResult(signal, result, finalScore, currentStats = {}) {
    const isWon = result === 'WON';
    const home = cleanMd(signal.homeTeam || signal.match?.split(' vs ')[0] || 'Ev Sahibi');
    const away = cleanMd(signal.awayTeam || signal.match?.split(' vs ')[1] || 'Deplasman');
    const market = cleanMd(signal.market || 'Sinyal');
    const scoreStr = finalScore ? (typeof finalScore === 'object' ? `${finalScore.home}-${finalScore.away}` : finalScore) : '';

    const totalResolved = (currentStats.won || 0) + (currentStats.lost || 0);
    const winRate = totalResolved > 0 ? (((currentStats.won || 0) / totalResolved) * 100).toFixed(1) : (isWon ? '100.0' : '0.0');

    if (isWon) {
        return `🟢 *TAHMİN TUTTU! (KAZANDI)* 🟢

⚽ *${home} vs ${away}*
🎯 *Tahmin:* ${market}
${scoreStr ? `📊 *Skor:* ${scoreStr}\n` : ''}✅ *Sonuç:* BAŞARILI!

━━━━━━━━━━━━━━━━━━
📈 *Günlük Başarı:* %${winRate} (${currentStats.won || 1}/${totalResolved || 1} Kazanan)
💎 *LIVE BET MENTOR VIP*`;
    } else {
        return `🔴 *TAHMİN SONUÇLANDI (KAYBETTİ)*

⚽ *${home} vs ${away}*
🎯 *Tahmin:* ${market}
${scoreStr ? `📊 *Son Skor:* ${scoreStr}\n` : ''}❌ *Sonuç:* Kaybetti

━━━━━━━━━━━━━━━━━━
📈 *Günlük Başarı:* %${winRate} (${currentStats.won || 0}/${totalResolved || 1})
💎 *LIVE BET MENTOR VIP*`;
    }
}

export function formatRadarPick(match) {
    // Consensus agreement analysis  
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement)
        .sort((a, b) => b[1] - a[1])[0];
    
    const topPred = topPrediction ? topPrediction[0] : 'N/A';
    const topCount = topPrediction ? topPrediction[1] : 0;
    const totalSources = match.totalSources || 0;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : 0;

    const home = cleanMd(match.home || 'Ev');
    const away = cleanMd(match.away || 'Dep');
    const league = cleanMd(match.league || 'Lig Bilgisi Yok');

    // Source predictions detail
    const predDetails = Object.entries(match.predictions || {})
        .map(([site, pred]) => {
            const prob = match.probabilities?.[site];
            return `  ${cleanMd(site)}: ${cleanMd(pred)}${prob ? ` (%${prob})` : ''}`;
        })
        .join('\n');

    const message = `🎯 *PRE-MATCH TAHMİN*

⚽ *${home} vs ${away}*
🏟️ ${league}
${match.time ? `⏰ Saat: ${match.time}` : ''}
${match.date ? `📅 Tarih: ${match.date}` : ''}

📊 *Konsensüs: ${topPred}* (${topCount}/${totalSources} kaynak — %${agreePercent})

📋 *Kaynak Detayları:*
${predDetails || '  Veri bekleniyor...'}

${match.scorePredictions && Object.keys(match.scorePredictions).length > 0 ? 
`🔢 *Skor Tahminleri:*
${Object.entries(match.scorePredictions).map(([site, score]) => `  ${cleanMd(site)}: ${cleanMd(score)}`).join('\n')}` : ''}

━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR VIP*`;

    return message;
}

export function formatWelcome() {
    return `🏆 *LIVE BET MENTOR Bot*

Profesyonel canlı maç analiz ve sinyal servisi.

📊 *Ne Sunuyoruz?*
• Anlık canlı maç sinyalleri (SICAK/ALEV/ALPHA)
• xG, DQS ve baskı indeksi analizi
• Pre-match konsensüs tahminleri
• Günlük performans raporları

💎 *VIP Erişim:*
Detaylı sinyaller ve anlık bildirimler için VIP gruba katılın.

📩 Komutlar:
/vip — VIP üyelik bilgisi
/stats — Güncel performans istatistikleri

━━━━━━━━━━━━━━━━━━
⚡ Powered by Live Bet Mentor Engine`;
}

export function formatVIPInfo(settings = {}) {
    const whatsapp = settings.whatsapp || '';
    
    return `💎 *VIP ÜYELİK*

🔓 *VIP Gruba Katılmak İçin:*

VIP grupta anlık canlı sinyal, detaylı analiz ve pre-match tahminler alırsınız.

📩 İletişim:
${whatsapp ? `• WhatsApp: ${whatsapp}` : '• Admin ile iletişime geçin'}

━━━━━━━━━━━━━━━━━━
💎 *LIVE BET MENTOR*`;
}
