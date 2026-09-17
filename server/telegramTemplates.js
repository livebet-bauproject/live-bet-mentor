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
    const isDe = lang === 'de';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const rec = alert.recommendation || {};
    const key = rec.marketKey || '';
    let label = cleanMd(rec.marketLabel || rec.market || '');
    let team = cleanMd(rec.team || (key.includes('home') ? home : key.includes('away') ? away : ''));
    if (team.toLowerCase() === 'home') team = home;
    if (team.toLowerCase() === 'away') team = away;

    const oddsVal = rec.odds || alert.odds;
    const hasExistingOdds = /\(Oran:|\(Odds:|\(Quote:/i.test(label || '') || /\(Oran:|\(Odds:|\(Quote:/i.test(rec.predictionText || '');
    const oddsStr = (oddsVal && !hasExistingOdds) ? (isTr ? ` (Oran: ${oddsVal})` : isDe ? ` (Quote: ${oddsVal})` : ` (Odds: ${oddsVal})`) : '';

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
        } else if (isDe) {
            pt = pt.replace(/\bNext Goal:\s*/gi, 'Nächstes Tor: ')
                   .replace(/\bOver\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Über $1 Tore')
                   .replace(/\bUnder\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Unter $1 Tore')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*Yes\)\b/gi, 'Beide Teams treffen (BTTS: Ja)')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*No\)\b/gi, 'Beide Teams treffen: Nein')
                   .replace(/\bMatch Winner:\s*/gi, 'Spielgewinner: ')
                   .replace(/\(Odds:\s*([0-9.]+)\)/gi, '(Quote: $1)')
                   .replace(/\(Quote:\s*([0-9.]+)\)/gi, '(Quote: $1)');
        }
        return pt;
    }

    // 1. Latency Arbitrage
    if (key === 'market_latency_arbitrage' || rec.edgeType === 'LATENCY') {
        const target = team ? `${team} (${isTr ? 'Sıradaki Gol' : isDe ? 'Nächstes Tor' : 'Next Goal'})` : (isTr ? 'Sıradaki Gol' : isDe ? 'Nächstes Tor' : 'Next Goal');
        return isTr ? `Gecikme Arbitrajı: ${target}${oddsStr}` : isDe ? `Latenz-Arbitrage: ${target}${oddsStr}` : `Latency Arbitrage: ${target}${oddsStr}`;
    }

    // 2. Mathematical Value (+EV)
    if (key === 'market_plus_ev' || rec.edgeType === 'PLUS_EV') {
        return isTr ? `Değer Oran (+EV): ${label || 'Üst Gol'}${oddsStr}` : isDe ? `Mathematischer Value (+EV): ${label || 'Über Tore'}${oddsStr}` : `Value Edge (+EV): ${label || 'Over Goals'}${oddsStr}`;
    }

    // 3. Next Goal - Home / Away
    if (key === 'market_next_goal_home' || key === 'HOME_NEXT_GOAL' || (label.toLowerCase().includes('next goal') && label.includes(home))) {
        return isTr ? `Sıradaki Gol: ${home}${oddsStr}` : isDe ? `Nächstes Tor: ${home}${oddsStr}` : `Next Goal: ${home}${oddsStr}`;
    }
    if (key === 'market_next_goal_away' || key === 'AWAY_NEXT_GOAL' || (label.toLowerCase().includes('next goal') && label.includes(away))) {
        return isTr ? `Sıradaki Gol: ${away}${oddsStr}` : isDe ? `Nächstes Tor: ${away}${oddsStr}` : `Next Goal: ${away}${oddsStr}`;
    }

    // 4. Over / Under Goals
    if (key === 'market_over_goals' || key === 'OVER_NEXT_DYNAMIC' || label.toLowerCase().includes('over') || label.includes('Üst') || label.includes('Über')) {
        const goalsMatch = label.match(/(\d+\.?\d*)/);
        const goals = rec.marketParams?.goals || rec.target || (goalsMatch ? goalsMatch[1] : '2.5');
        return isTr ? `Maçta ${goals} Üst Gol${oddsStr}` : isDe ? `Über ${goals} Tore im Spiel${oddsStr}` : `Over ${goals} Match Goals${oddsStr}`;
    }

    // 5. BTTS
    if (key === 'market_btts' || key === 'btts' || label.toLowerCase().includes('btts') || label.toLowerCase().includes('both teams') || label.includes('KG') || label.includes('Beide Teams')) {
        return isTr ? `Karşılıklı Gol Var (KG Var)${oddsStr}` : isDe ? `Beide Teams treffen (BTTS: Ja)${oddsStr}` : `Both Teams To Score (BTTS: Yes)${oddsStr}`;
    }

    // 6. First Half
    if (key === 'market_fh_over05' || label.toLowerCase().includes('first half') || label.includes('İY 0.5') || label.includes('İlk Yarı') || label.includes('1. Halbzeit')) {
        return isTr ? `İlk Yarı 0.5 Üst${oddsStr}` : isDe ? `1. Halbzeit Über 0.5 Tore${oddsStr}` : `First Half Over 0.5 Goals${oddsStr}`;
    }

    // 7. Match Winner
    if (key === 'HOME_WIN_NEXT' || label.toLowerCase().includes('home win')) {
        return isTr ? `Maç Sonucu: ${home}${oddsStr}` : isDe ? `Spielgewinner: ${home}${oddsStr}` : `Match Winner: ${home}${oddsStr}`;
    }
    if (key === 'AWAY_WIN_NEXT' || label.toLowerCase().includes('away win')) {
        return isTr ? `Maç Sonucu: ${away}${oddsStr}` : isDe ? `Spielgewinner: ${away}${oddsStr}` : `Match Winner: ${away}${oddsStr}`;
    }

    // Fallback translation of English labels
    if (label) {
        let cleanL = label;
        if (isTr) {
            cleanL = cleanL
                .replace(/\bNext Goal:\s*/gi, 'Sıradaki Gol: ')
                .replace(/\bOver\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Üst Gol')
                .replace(/\bUnder\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Alt Gol')
                .replace(/\bBoth Teams To Score\s*\(BTTS:\s*Yes\)\b/gi, 'Karşılıklı Gol Var (KG Var)')
                .replace(/\(Odds:\s*([0-9.]+)\)/gi, '(Oran: $1)');
        } else if (isDe) {
            cleanL = cleanL
                .replace(/\bNext Goal:\s*/gi, 'Nächstes Tor: ')
                .replace(/\bOver\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Über $1 Tore')
                .replace(/\bUnder\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Unter $1 Tore')
                .replace(/\bBoth Teams To Score\s*\(BTTS:\s*Yes\)\b/gi, 'Beide Teams treffen (BTTS: Ja)')
                .replace(/\(Odds:\s*([0-9.]+)\)/gi, '(Quote: $1)');
        }
        return `${cleanL}${oddsStr}`;
    }

    return isTr ? `Sıradaki Gol: ${team || home}${oddsStr}` : isDe ? `Nächstes Tor: ${team || home}${oddsStr}` : `Next Goal: ${team || home}${oddsStr}`;
}

export function cleanLeagueTr(rawLeague) {
    if (!rawLeague) return '';
    let str = cleanMd(rawLeague);
    const countryMap = {
        'Spain:': 'İspanya',
        'England:': 'İngiltere',
        'Germany:': 'Almanya',
        'Italy:': 'İtalya',
        'France:': 'Fransa',
        'Turkey:': 'Türkiye',
        'Netherlands:': 'Hollanda',
        'Portugal:': 'Portekiz',
        'Belgium:': 'Belçika',
        'Brazil:': 'Brezilya',
        'Argentina:': 'Arjantin',
        'World:': 'Dünya',
        'Europe:': 'Avrupa',
        'Scotland:': 'İskoçya',
        'Czech Republic:': 'Çekya',
        'Croatia:': 'Hırvatistan',
        'Serbia:': 'Sırbistan',
        'Greece:': 'Yunanistan',
        'Austria:': 'Avusturya',
        'Switzerland:': 'İsviçre',
        'Poland:': 'Polonya',
        'Denmark:': 'Danimarka',
        'Sweden:': 'İsveç',
        'Norway:': 'Norveç'
    };
    for (const [en, tr] of Object.entries(countryMap)) {
        if (str.startsWith(en)) {
            str = str.replace(en, tr + ' -');
        }
    }
    str = str.replace(/\bPremier League\b/gi, 'Premier Lig')
             .replace(/\bChampions League\b/gi, 'Şampiyonlar Ligi')
             .replace(/\bEuropa League\b/gi, 'Avrupa Ligi')
             .replace(/\bConference League\b/gi, 'Konferans Ligi')
             .replace(/\bSuper Lig\b/gi, 'Süper Lig')
             .replace(/\b1\. Liga\b/gi, '1. Lig')
             .replace(/\b2\. Liga\b/gi, '2. Lig')
             .replace(/\bCup\b/gi, 'Kupası')
             .replace(/\bFriendly\b/gi, 'Hazırlık');
    if (str.toLowerCase() === 'genel' || str.toLowerCase() === 'fixture') return '';
    return str.trim();
}

export function cleanLeagueDe(rawLeague) {
    if (!rawLeague) return '';
    let str = cleanMd(rawLeague);
    const countryMap = {
        'Spain:': 'Spanien',
        'England:': 'England',
        'Germany:': 'Deutschland',
        'Italy:': 'Italien',
        'France:': 'Frankreich',
        'Turkey:': 'Türkei',
        'Netherlands:': 'Niederlande',
        'Portugal:': 'Portugal',
        'Belgium:': 'Belgien',
        'Brazil:': 'Brasilien',
        'Argentina:': 'Argentinien',
        'World:': 'Welt',
        'Europe:': 'Europa',
        'Scotland:': 'Schottland',
        'Czech Republic:': 'Tschechien',
        'Croatia:': 'Kroatien',
        'Serbia:': 'Serbien',
        'Greece:': 'Griechenland',
        'Austria:': 'Österreich',
        'Switzerland:': 'Schweiz',
        'Poland:': 'Polen',
        'Denmark:': 'Dänemark',
        'Sweden:': 'Schweden',
        'Norway:': 'Norwegen'
    };
    for (const [en, de] of Object.entries(countryMap)) {
        if (str.startsWith(en)) {
            str = str.replace(en, de + ' -');
        }
    }
    str = str.replace(/\bPremier League\b/gi, 'Premier League')
             .replace(/\bChampions League\b/gi, 'Champions League')
             .replace(/\bEuropa League\b/gi, 'Europa League')
             .replace(/\bConference League\b/gi, 'Conference League')
             .replace(/\bCup\b/gi, 'Pokal')
             .replace(/\bFriendly\b/gi, 'Freundschaftsspiel');
    if (str.toLowerCase() === 'genel' || str.toLowerCase() === 'fixture') return '';
    return str.trim();
}

export function cleanLeague(rawLeague, lang = 'tr') {
    if (lang === 'tr') return cleanLeagueTr(rawLeague);
    if (lang === 'de') return cleanLeagueDe(rawLeague);
    return cleanMd(rawLeague);
}

export function formatVIPSignal(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(alert.homeTeam || 'Ev');
    const away = cleanMd(alert.awayTeam || 'Dep');

    const badge = alert.level === 'ALPHA' ? '💎 ALFA SİNYAL' : '🔥 CANLI ALARM';
    const marketText = resolveMarketText(alert, lang);
    const oddsVal = alert.recommendation?.odds || alert.odds || '1.80';
    const conf = alert.recommendation?.confidence || 82;
    const stake = alert.level === 'ALPHA' ? '1.5' : '1.0';

    if (isTr) {
        return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} - ${away}*
🎯 *Tahmin:* *${marketText}*
📊 *Güven:* %${conf} | *Oran:* ${oddsVal} | *Kasa:* %${stake}
👉 *Canlı Radar:* https://live-bet-mentor-brown.vercel.app`;
    }

    return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} - ${away}*
🎯 *Pick:* *${marketText}*
📊 *Conf:* ${conf}% | *Odds:* ${oddsVal} | *Stake:* ${stake}%
👉 *Live Radar:* https://live-bet-mentor-brown.vercel.app`;
}

export function formatPublicTeaser(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const home = cleanMd(alert.homeTeam || 'Ev');
    const away = cleanMd(alert.awayTeam || 'Dep');
    const botUser = process.env.TELEGRAM_BOT_USERNAME || 'Livebetdeskbot';

    if (isTr) {
        return `⚡ *CANLI GOL BASKISI ALARMI* · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} - ${away}*
🔥 *Yüksek Gol Baskısı & xG İvmesi Yakalandı!*
🔒 _Net tahmin ve oran VIP grubumuzda canlı paylaşıldı._

💎 *Sinyalleri 0 saniye gecikmeyle yakalamak için:*
👉 @${botUser} bota /deneme yazarak *3 Günlük Ücretsiz VIP* başlatın veya /vip ile katılın!
🌐 *Web Terminali:* https://live-bet-mentor-brown.vercel.app`;
    }

    return `⚡ *IN-PLAY PRESSURE ALERT* · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} - ${away}*
🔥 *High Pitch Pressure & Shot Edge Detected!*
🔒 _Full pick & fair odds shared in VIP Syndicate._

💎 *Catch signals live with zero latency:*
👉 Send /trial to @${botUser} for a *3-Day Free VIP Pass* or /vip to join!
🌐 *Web Terminal:* https://live-bet-mentor-brown.vercel.app`;
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
    
    const rawTopPred = topPrediction ? topPrediction[0] : (match.topPred || match.selection || match.pick || 'N/A');
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 10;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);
    const topPredText = resolveConsensusPredName(rawTopPred, lang);

    const home = cleanMd(match.home || match.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(match.away || match.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const league = isTr ? cleanLeagueTr(match.league) : cleanMd(match.league);
    const leagueTag = league ? ` (${league})` : '';
    const timeStr = match.time ? ` · ⏰ ${match.time}` : '';

    if (isTr) {
        return `🎯 *GÜNÜN BANKOSU*${timeStr}
⚽ *${home} - ${away}*${leagueTag}
🔥 *Tahmin:* *${topPredText}*
📊 *Model Onayı:* *%${agreePercent}* (${topCount}/${totalSources} Kaynak)
💰 *Kasa:* %2 · 💎 _Live Bet Mentor VIP_`;
    }

    return `🎯 *TOP CONSENSUS PICK*${timeStr}
⚽ *${home} - ${away}*${leagueTag}
🔥 *Pick:* *${topPredText}*
📊 *Agreement:* *${agreePercent}%* (${topCount}/${totalSources} Models)
💰 *Stake:* 2% · 💎 _Live Bet Mentor VIP_`;
}

export function formatRadarTeaser(match, lang = 'tr') {
    const isTr = lang === 'tr';
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 10;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);

    const home = cleanMd(match.home || match.homeTeam || (isTr ? 'Ev Sahibi' : 'Home'));
    const away = cleanMd(match.away || match.awayTeam || (isTr ? 'Deplasman' : 'Away'));
    const timeStr = match.time ? ` (⏰ ${match.time})` : '';

    if (isTr) {
        return `📡 *GÜNÜN BANKO ALARMI*${timeStr}
⚽ *${home} - ${away}*
⚡ *10 Analiz Modelinden %${agreePercent} Ortak Onay!*
🔒 _Tahmin & kasa yönetimi VIP grupta paylaşıldı._
👉 *Canlı Terminal:* https://live-bet-mentor-brown.vercel.app`;
    }

    return `📡 *CONSENSUS RADAR ALERT*${timeStr}
⚽ *${home} - ${away}*
⚡ *10 AI Models Reached ${agreePercent}% Consensus!*
🔒 _Full pick & bankroll stake released in VIP._
👉 *Live Terminal:* https://live-bet-mentor-brown.vercel.app`;
}

export function formatSignalResult(signal, result, finalScore, currentStats = {}, lang = 'tr') {
    const isTr = lang === 'tr';
    const isWon = result === 'WON';
    const home = cleanMd(signal.homeTeam || signal.match?.split(' vs ')[0] || 'Ev');
    const away = cleanMd(signal.awayTeam || signal.match?.split(' vs ')[1] || 'Dep');
    const market = cleanMd(resolveMarketText(signal, lang) || signal.market || 'Tahmin');
    const scoreStr = finalScore ? (typeof finalScore === 'object' ? `${finalScore.home}-${finalScore.away}` : finalScore) : '';

    if (isTr) {
        if (isWon) {
            return `🟢 *KAZANDI!* ${scoreStr ? `[${scoreStr}]` : ''}
⚽ *${home} - ${away}*
🎯 *Tahmin:* *${market}* ✅
💰 *Kâr kasaya eklendi!* · 💎 _Live Bet Mentor_`;
        } else {
            return `🔴 *KAYBETTİ* ${scoreStr ? `[${scoreStr}]` : ''}
⚽ *${home} - ${away}*
🎯 *Tahmin:* *${market}*
🛡️ *Sermaye koruma devrede, kasa yönetimine sadık kalın.*`;
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
        const minClean = cleanMd(String(p.minute || '').replace(/['’]/g, ''));
        const minDisplay = minClean ? ` (${minClean}')` : '';
        return `${i + 1}️⃣ *${matchTitle}*${minDisplay} ➔ *${market}* (Oran: ${odds})`;
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
    const usdtAddress = process.env.TELEGRAM_USDT_ADDRESS || 'TXDCxXx5XjNWFRLQmNZeHVcwjpHjDDPrvd';
    const shopierLink = process.env.SHOPIER_VIP_LINK || 'https://shopier.com/livebetmentor';
    
    if (isTr) {
        return `💎 *VIP QUANT SYNDICATE ÜYELİK PAKETLERİ*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Yapay zeka xG ivmesi, Poisson oranları ve gecikme arbitrajı sinyallerine 0 saniye gecikmeyle erişin.

🎟️ *Abonelik Paketleri:*
1️⃣ *Haftalık VIP Pass:* *9.90 €* (veya 11 USDT) (7 Günlük tam erişim)
2️⃣ *Aylık VIP Pro (En Popüler):* *14.90 €* (veya 16 USDT) (30 Gün tam erişim)
3️⃣ *Premium Pass:* *34.90 €* (veya 38 USDT) (Tüm AI Modülleri + VIP Bot)

💳 *1. Ödeme Yolu (Kredi Kartı / Havale - Anında Otomatik Aktivasyon):*
👉 [Kredi Kartı ile Güvenli Satın Al](${shopierLink})

💰 *2. Ödeme Yolu (Kripto - USDT TRC-20):*
\`${usdtAddress}\`
_(Kopyalamak için adrese dokunun)_
Ödeme sonrası TXID veya dekontu bu bota mesaj olarak göndermeniz yeterlidir.

🎁 *Sistemi 3 Gün Boyunca Ücretsiz Test Etmek İçin:*
👉 /deneme yazarak *3 Günlük Ücretsiz VIP Erişiminizi* hemen başlatabilirsiniz!
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Syndicate*`;
    }

    return `💎 *VIP QUANT SYNDICATE MEMBERSHIP*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Zero-latency access to in-play algorithmic signals, +EV value edges and live latency arbitrage.

🎟️ *Membership Passes:*
1️⃣ *Weekly Pass:* *9.90 €* (or 11 USDT) (7 Days full access)
2️⃣ *Monthly Pro (Most Popular):* *14.90 €* (or 16 USDT) (30 Days unrestricted)
3️⃣ *Premium Pass:* *34.90 €* (or 38 USDT) (Full Modules + VIP Bot)

💳 *Card / Checkout:*
👉 [Instant Card Checkout](${shopierLink})

💰 *Crypto (USDT TRC-20):*
\`${usdtAddress}\`
_(Tap to copy address)_
Send TXID or screenshot here upon transfer for immediate VIP activation.

🎁 *Instant Free Trial:*
👉 Send /trial to activate your *3-Day Free VIP Pass* instantly!
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
}
