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
    const isDe = lang === 'de';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Dep' : isDe ? 'Auswärts' : 'Away'));

    const badge = alert.level === 'ALPHA' ? (isTr ? '💎 ALFA SİNYAL' : isDe ? '💎 ALPHA-SIGNAL' : '💎 ALPHA SIGNAL') : (isTr ? '🔥 CANLI ALARM' : isDe ? '🔥 LIVE-ALARM' : '🔥 LIVE ALERT');
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

    if (isDe) {
        return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} - ${away}*
🎯 *Tipp:* *${marketText}*
📊 *Konfidenz:* ${conf}% | *Quote:* ${oddsVal} | *Einsatz:* ${stake}%
👉 *Live-Radar:* https://live-bet-mentor-brown.vercel.app`;
    }

    return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} - ${away}*
🎯 *Pick:* *${marketText}*
📊 *Conf:* ${conf}% | *Odds:* ${oddsVal} | *Stake:* ${stake}%
👉 *Live Radar:* https://live-bet-mentor-brown.vercel.app`;
}

export function formatPublicTeaser(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Dep' : isDe ? 'Auswärts' : 'Away'));
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

    if (isDe) {
        return `⚡ *LIVE-TORDRUCK ALARM* · *${alert.minute}'* [*${alert.score || '0-0'}*]
⚽ *${home} - ${away}*
🔥 *Hoher Spieldruck & xG-Momentum erkannt!*
🔒 _Vollständiger Tipp & faire Quote im VIP-Kanal geteilt._

💎 *Signale ohne Verzögerung (0s Latenz) erhalten:*
👉 Sende /trial oder /test an @${botUser} für einen *3-Tage VIP-Pass* oder /vip zum Beitreten!
🌐 *Web-Terminal:* https://live-bet-mentor-brown.vercel.app`;
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
    const isDe = lang === 'de';

    if (isTr) {
        if (p === '1') return 'Ev Sahibi (MS 1)';
        if (p === 'X' || p === 'x') return 'Beraberlik (MS X)';
        if (p === '2') return 'Deplasman (MS 2)';
        if (p === '1X' || p === '1x') return 'Çifte Şans (1X)';
        if (p === 'X2' || p === 'x2') return 'Çifte Şans (X2)';
        if (p === '12') return 'Çifte Şans (12)';
        if (p.toLowerCase().includes('üst') || p.toLowerCase().includes('over')) return '2.5 Gol Üstü';
        if (p.toLowerCase().includes('alt') || p.toLowerCase().includes('under')) return '2.5 Gol Altı';
        if (p.toLowerCase().includes('var') || p.toLowerCase().includes('yes') || p.toLowerCase().includes('btts')) return 'Karşılıklı Gol Var (KG Var)';
        if (p.toLowerCase().includes('yok') || p.toLowerCase().includes('no')) return 'Karşılıklı Gol Yok';
        return p;
    }

    if (isDe) {
        if (p === '1') return 'Heimsieg (MS 1)';
        if (p === 'X' || p === 'x') return 'Unentschieden (MS X)';
        if (p === '2') return 'Auswärtssieg (MS 2)';
        if (p === '1X' || p === '1x') return 'Doppelte Chance (1X)';
        if (p === 'X2' || p === 'x2') return 'Doppelte Chance (X2)';
        if (p === '12') return 'Doppelte Chance (12)';
        if (p.toLowerCase().includes('üst') || p.toLowerCase().includes('over') || p.toLowerCase().includes('über')) return 'Über 2.5 Tore';
        if (p.toLowerCase().includes('alt') || p.toLowerCase().includes('under') || p.toLowerCase().includes('unter')) return 'Unter 2.5 Tore';
        if (p.toLowerCase().includes('var') || p.toLowerCase().includes('yes') || p.toLowerCase().includes('btts')) return 'Beide Teams treffen (BTTS: Ja)';
        if (p.toLowerCase().includes('yok') || p.toLowerCase().includes('no')) return 'Beide Teams treffen: Nein';
        return p;
    }

    if (p === '1') return 'Home Win (1)';
    if (p === 'X' || p === 'x') return 'Draw (X)';
    if (p === '2') return 'Away Win (2)';
    if (p === '1X' || p === '1x') return 'Double Chance (1X)';
    if (p === 'X2' || p === 'x2') return 'Double Chance (X2)';
    if (p === '12') return 'Double Chance (12)';
    if (p.toLowerCase().includes('üst') || p.toLowerCase().includes('over')) return 'Over 2.5 Goals';
    if (p.toLowerCase().includes('alt') || p.toLowerCase().includes('under')) return 'Under 2.5 Goals';
    if (p.toLowerCase().includes('var') || p.toLowerCase().includes('yes') || p.toLowerCase().includes('btts')) return 'Both Teams To Score (BTTS: Yes)';
    if (p.toLowerCase().includes('yok') || p.toLowerCase().includes('no')) return 'Both Teams To Score (BTTS: No)';
    return p;
}

export function formatRadarPick(match, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
    
    const rawTopPred = topPrediction ? topPrediction[0] : (match.topPred || match.selection || match.pick || 'N/A');
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 10;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);
    const topPredText = resolveConsensusPredName(rawTopPred, lang);

    const home = cleanMd(match.home || match.homeTeam || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(match.away || match.awayTeam || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const league = cleanLeague(match.league, lang);
    const leagueTag = league ? ` (${league})` : '';
    const timeStr = match.time ? ` · ⏰ ${match.time}` : '';

    if (isTr) {
        return `🎯 *GÜNÜN BANKOSU*${timeStr}
⚽ *${home} - ${away}*${leagueTag}
🔥 *Tahmin:* *${topPredText}*
📊 *Model Onayı:* *%${agreePercent}* (${topCount}/${totalSources} Kaynak)
💰 *Kasa:* %2 · 💎 _Live Bet Mentor VIP_`;
    }

    if (isDe) {
        return `🎯 *TIPP DES TAGES*${timeStr}
⚽ *${home} - ${away}*${leagueTag}
🔥 *Tipp:* *${topPredText}*
📊 *Modell-Konsens:* *${agreePercent}%* (${topCount}/${totalSources} Quellen)
💰 *Einsatz:* 2% · 💎 _Live Bet Mentor VIP_`;
    }

    return `🎯 *TOP CONSENSUS PICK*${timeStr}
⚽ *${home} - ${away}*${leagueTag}
🔥 *Pick:* *${topPredText}*
📊 *Agreement:* *${agreePercent}%* (${topCount}/${totalSources} Models)
💰 *Stake:* 2% · 💎 _Live Bet Mentor VIP_`;
}

export function formatRadarTeaser(match, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 10;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);

    const home = cleanMd(match.home || match.homeTeam || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(match.away || match.awayTeam || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const timeStr = match.time ? ` (⏰ ${match.time})` : '';

    if (isTr) {
        return `📡 *GÜNÜN BANKO ALARMI*${timeStr}
⚽ *${home} - ${away}*
⚡ *10 Analiz Modelinden %${agreePercent} Ortak Onay!*
🔒 _Tahmin & kasa yönetimi VIP grupta paylaşıldı._
👉 *Canlı Terminal:* https://live-bet-mentor-brown.vercel.app`;
    }

    if (isDe) {
        return `📡 *KONSENS-RADAR ALARM*${timeStr}
⚽ *${home} - ${away}*
⚡ *10 KI-Modelle erzielen ${agreePercent}% Übereinstimmung!*
🔒 _Tipp & Bankroll-Einsatz im VIP-Kanal freigeschaltet._
👉 *Live-Terminal:* https://live-bet-mentor-brown.vercel.app`;
    }

    return `📡 *CONSENSUS RADAR ALERT*${timeStr}
⚽ *${home} - ${away}*
⚡ *10 AI Models Reached ${agreePercent}% Consensus!*
🔒 _Full pick & bankroll stake released in VIP._
👉 *Live Terminal:* https://live-bet-mentor-brown.vercel.app`;
}

export function formatSignalResult(signal, result, finalScore, currentStats = {}, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const isWon = result === 'WON';
    const home = cleanMd(signal.homeTeam || signal.match?.split(' vs ')[0] || (isTr ? 'Ev' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(signal.awayTeam || signal.match?.split(' vs ')[1] || (isTr ? 'Dep' : isDe ? 'Auswärts' : 'Away'));
    const market = cleanMd(resolveMarketText(signal, lang) || signal.market || (isTr ? 'Tahmin' : isDe ? 'Tipp' : 'Pick'));
    const scoreStr = finalScore ? (typeof finalScore === 'object' ? `${finalScore.home}-${finalScore.away}` : finalScore) : '';

    const totalResolved = (currentStats.won || 0) + (currentStats.lost || 0);
    const winRate = totalResolved > 0 ? (((currentStats.won || 0) / totalResolved) * 100).toFixed(1) : '0.0';

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

    if (isDe) {
        if (isWon) {
            return `🟢 *GEWONNEN!* ${scoreStr ? `[${scoreStr}]` : ''}
⚽ *${home} vs ${away}*
🎯 *Tipp:* *${market}* ✅
📈 *Heute:* %${winRate} (${currentStats.won || 1}/${totalResolved || 1} Treffer)
💰 *Gewinn zur Bankroll hinzugefügt!* · 💎 _Live Bet Mentor VIP_`;
        } else {
            return `🔴 *VERLOREN* ${scoreStr ? `[${scoreStr}]` : ''}
⚽ *${home} vs ${away}*
🎯 *Tipp:* *${market}*
📈 *Heute:* %${winRate} (${currentStats.won || 0}/${totalResolved || 1})
🛡️ *Kapitalschutz aktiv, diszipliniert im Bankroll-Plan bleiben.*`;
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
    const isDe = lang === 'de';
    const home = cleanMd(cashOut.matchTitle?.split(' vs ')[0] || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(cashOut.matchTitle?.split(' vs ')[1] || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const market = cleanMd(cashOut.market || (isTr ? 'Aktif Bahis' : isDe ? 'Aktiver Tipp' : 'Active Market'));
    const reason = cleanMd(cashOut.reason || (isTr ? 'Hücum temposu düştü' : isDe ? 'Spieltempo verlangsamt' : 'Momentum decline'));

    if (isTr) {
        return `🚨 *BAHİS BOZDUR / STOP-LOSS UYARISI* 🚨
⚽ *${home} vs ${away}* (${cashOut.minute}' · [*${cashOut.score}*])
🎯 *Aktif Bahis:* ${market}
⚠️ *Durum:* ${reason}

💡 *Aksiyon:* Kârı kilitleyin veya sermayeyi korumak için bahsi bozdurun!
🛡️ *Live Bet Mentor Kasa Koruma*`;
    }

    if (isDe) {
        return `🚨 *CASHOUT / STOP-LOSS WARNUNG* 🚨
⚽ *${home} vs ${away}* (${cashOut.minute}' · [*${cashOut.score}*])
🎯 *Aktiver Tipp:* ${market}
⚠️ *Status:* ${reason}

💡 *Aktion:* Gewinne sichern oder Stop-Loss ausführen zum Kapitalschutz!
🛡️ *Live Bet Mentor Kapitalschutz*`;
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
    const isDe = lang === 'de';

    const picksText = combo.picks.map((p, i) => {
        const matchTitle = cleanMd(p.matchTitle);
        const market = cleanMd(p.market);
        const odds = p.odds || '1.50';
        const minClean = cleanMd(String(p.minute || '').replace(/['’]/g, ''));
        const minDisplay = minClean ? ` (${minClean}')` : '';
        const oddsTag = isTr ? `Oran: ${odds}` : isDe ? `Quote: ${odds}` : `Odds: ${odds}`;
        return `${i + 1}️⃣ *${matchTitle}*${minDisplay} ➔ *${market}* (${oddsTag})`;
    }).join('\n');

    if (isTr) {
        return `🔥 *CANLI ALTIN ÇİFTE (GÜNÜN KOMBİNESİ)* 🔥
💰 *Toplam Oran:* *${combo.totalOdds || '2.25'}* | *Güven:* %${combo.averageConfidence || 82}

${picksText}

💡 *Kasa Tavsiyesi:* %2.0 (Dengeli Değer İkilisi)
💎 *Live Bet Mentor VIP*`;
    }

    if (isDe) {
        return `🔥 *LIVE GOLD-KOMBI (TIPP DES TAGES)* 🔥
💰 *Gesamtquote:* *${combo.totalOdds || '2.25'}* | *Konfidenz:* ${combo.averageConfidence || 82}%

${picksText}

💡 *Einsatz-Empfehlung:* 2.0% Bankroll (Value-Doppel)
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
    const isDe = lang === 'de';
    const home = cleanMd(arb.homeTeam || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(arb.awayTeam || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const defaultMarket = isTr ? 'Sıradaki Gol / Üst' : isDe ? 'Nächstes Tor / Über' : 'Next Goal / Over';

    if (isTr) {
        return `⚡ *BÜRO ORAN AÇIĞI (GECİKME ARBİTRAJI)* ⚡
⚽ *${home} vs ${away}* (${arb.minute}')
🎯 *Bahis:* ${cleanMd(arb.market || defaultMarket)}
📊 *Büro Oranı:* *${arb.bookmakerOdds || '1.75'}* | *Adil Piyasa:* *${arb.fairOdds || '1.45'}* (+%${arb.discrepancyPct || 20} Değer!)
⚡ Büro oranı güncellemeden önce değerlendirin!

💎 *Live Bet Mentor VIP*`;
    }

    if (isDe) {
        return `⚡ *LATENZ-ARBITRAGE ALARM (QUOTEN-VORTEIL)* ⚡
⚽ *${home} vs ${away}* (${arb.minute}')
🎯 *Tipp:* ${cleanMd(arb.market || defaultMarket)}
📊 *Buchmacher-Quote:* *${arb.bookmakerOdds || '1.75'}* | *Faire Quote:* *${arb.fairOdds || '1.45'}* (+${arb.discrepancyPct || 20}% Vorteil!)
⚡ Nutzen, bevor der Buchmacher die Quoten korrigiert!

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
    const isDe = lang === 'de';
    const date = new Date().toLocaleDateString(isTr ? 'tr-TR' : isDe ? 'de-DE' : 'en-GB', {
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

    if (isDe) {
        return `📊 *TÄGLICHER QUANT-BERICHT (${date})*
━━━━━━━━━━━━━━━━━━
✅ Gewonnen: *${stats.won || 0}*
❌ Verloren: *${stats.lost || 0}*
⏳ Offen: *${stats.pending || 0}*

📈 *Trefferquote: ${winRate}%*
🔥 Gesamt-Signale: ${stats.total || 0}
${stats.bestPick ? `🏆 Bester Tipp: ${cleanMd(stats.bestPick)}\n` : ''}━━━━━━━━━━━━━━━━━━
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
    const isDe = lang === 'de';

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
/deneme — *3 Günlük (72 Saat) Ücretsiz VIP Üyeliğinizi* hemen başlatın!

📩 *Hızlı Komutlar:*
/deneme — 3 günlük (72 saat) ücretsiz VIP deneme
/profil — VIP üyelik durumunu sorgula
/kupon — Günün canlı altın kombinesi
/stats — Günlük performans tablosu
/vip — VIP üyelik paketleri
/dil — Dil seçimi (TR / EN / DE)
/id — Telegram Chat ID bilginiz
━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Engine*`;
    }

    if (isDe) {
        return `🏆 *LIVE BET MENTOR BOT*
KI-gestützter Live-Fußballanalyse- und Value-Signal-Service.

📊 *Funktionen:*
• Live-Value-Signale (HOT / FLAME / ALPHA)
• 🛡️ Cash-Out & Stop-Loss Kapitalschutz-Radar
• 🎟️ Tägliche Gold-Kombi (Kombi-Assistent)
• ⚡ Buchmacher-Latenz & Quoten-Arbitrage
• Transparente tägliche Erfolgsbilanz

🎁 *Kostenlose Testphase:*
/trial oder /test — Starten Sie sofort Ihren *3-Tage (72h) VIP-Pass*!

📩 *Befehle:*
/trial oder /test — 3 Tage (72 Stunden) kostenloser VIP-Zugang
/profil — Abonnement-Status prüfen
/kombi — Tägliche Gold-Kombi
/stats — Tagesperformance
/vip — VIP-Mitgliedschaften
/sprache — Sprache wählen (TR / EN / DE)
/id — Ihre Telegram Chat-ID
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
/trial — Activate your *3-Day (72h) Free VIP Pass* instantly!

📩 *Commands:*
/trial — 3-day (72-hour) free VIP trial
/profile — Check subscription status
/combo — Daily Golden Double
/stats — Performance ledger
/vip — VIP membership tiers
/lang — Choose language (TR / EN / DE)
/id — Your Telegram Chat ID
━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Engine*`;
}

export function formatVIPInfo(settings = {}, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const usdtAddress = process.env.TELEGRAM_USDT_ADDRESS || 'TXDCxXx5XjNWFRLQmNZeHVcwjpHjDDPrvd';
    const shopierLink = process.env.SHOPIER_VIP_LINK || 'https://www.shopier.com/QuantDataLabs';
    
    if (isTr) {
        return `💎 *LIVE BET MENTOR ÜYELİK VE VIP PAKETLERİ*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Yapay zeka xG ivmesi, Poisson oranları ve anlık değer sinyallerine 0 saniye gecikmeyle erişin.

🎟️ *Resmi Paket Seçenekleri:*

1️⃣ 🎁 *DENEME — 3 Gün Ücretsiz (72 Saat)*
• Kredi kartsız & anında erişim
• 3 gün (72 saat) kesintisiz PRO deneme erişimi
• Canlı xG radarı & alevli maç alarmları
• Tüm konsensüs kaynakları & momentum grafikleri
👉 _Hemen başlatmak için:_ /deneme

2️⃣ 💎 *PROFESYONEL*
• 🗓️ *Aylık Plan:* *29 € / Ay*
• 🌟 *Yıllık Plan (2 Ay Hediye):* *228 € / Yıl* _(Aylık 19 €'ya gelir)_
• Tam Kapsamlı Analiz & DQS Motoru
• Gelişmiş Küresel Ligler (Tier 1 & Tier 2 Tam Erişim)
• Tüm Konsensus Kaynakları (IQ Ağırlıklı)
• Günlük 15 AI Uzman Raporu & 150 Akıllı Alarm

3️⃣ 👑 *PREMIUM (EN POPÜLER)*
• 🗓️ *Aylık Plan:* *79 € / Ay*
• 🌟 *Yıllık Plan (2 Ay Hediye):* *660 € / Yıl* _(Aylık 55 €'ya gelir)_
• Tüm Pro Özellikleri Dahil
• 📱 VIP Telegram Botu (Telefona Anında Canlı Sinyal)
• Günlük 50 AI Derin Analiz Raporu & Sınırsız Akıllı Alarm
• 💰 Kasa Yönetimi & Otomatik Kelly Bahis Miktarı
• 💎 Erken Değer (Value Bet) & Arbitraj Radarı
• 7/24 Öncelikli VIP Telegram Destek Hattı

⚡ *Anında Satın Alma:*
Aşağıdaki butonları kullanarak CryptoBot ile (USDT, TON, Kart veya Telegram Cüzdanınızla) anında ödeyebilirsiniz.
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Syndicate*`;
    }

    if (isDe) {
        return `💎 *LIVE BET MENTOR MITGLIEDSCHAFT & VIP-PAKETE*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Zugriff ohne Verzögerung auf In-Play Quant-Signale, +EV Value-Wetten und Latenz-Arbitrage.

🎟️ *Offizielle Mitgliedschaftspakete:*

1️⃣ 🎁 *TESTPHASE — 3 Tage Kostenlos (72 Stunden)*
• Sofortiger Zugriff ohne Kreditkarte
• 3 Tage (72 Stunden) uneingeschränkter PRO-Testzugang
• Live-xG-Radar & Flammen-Match-Alarme
• Alle Konsensquellen & Momentum-Grafiken
👉 _Jetzt starten:_ /test oder /trial

2️⃣ 💎 *PROFESSIONELL*
• 🗓️ *Monatlich:* *29 € / Monat*
• 🌟 *Jährlich (2 Monate Gratis):* *228 € / Jahr* _(entspricht 19 €/M)_
• Vollständige DQS- und Risikoanalyse
• Globale Ligen (Tier 1 & Tier 2 Vollzugriff)
• Alle Konsensquellen (IQ-gewichtet)
• 15 tägliche KI-Expertenberichte & 150 Alarme

3️⃣ 👑 *PREMIUM (BELIEBTESTE)*
• 🗓️ *Monatlich:* *79 € / Monat*
• 🌟 *Jährlich (2 Monate Gratis):* *660 € / Jahr* _(entspricht 55 €/M)_
• Alle Pro-Funktionen enthalten
• 📱 VIP Telegram Bot (Sofortige Live-Signale aufs Handy)
• 50 tägliche KI-Tiefenanalyse-Berichte & Unbegrenzte Alarme
• 💰 Bankroll-Management & Kelly-Einsatz
• 💎 Value-Wetten & Arbitrage-Radar
• 7/24 Prioritäts-Support via VIP Telegram

⚡ *Sofortige Freischaltung:*
Klicken Sie unten auf die Schaltflächen, um direkt über CryptoBot (USDT, TON oder Wallet) zu bezahlen.
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Syndicate*`;
    }

    return `💎 *LIVE BET MENTOR MEMBERSHIP & VIP TIERS*
━━━━━━━━━━━━━━━━━━━━━━━━━━
Institutional zero-latency algorithmic signals, Poisson distributions and real-time edge alerts.

🎟️ *Official Subscription Tiers:*

1️⃣ 🎁 *TRIAL — 3 Days Free (72 Hours)*
• Instant activation, no credit card required
• 3 days (72 hours) unrestricted PRO trial access
• Live xG radar & flame match alerts
• All consensus sources & momentum charts
👉 _Start now:_ /trial

2️⃣ 💎 *PROFESSIONAL*
• 🗓️ *Monthly Pass:* *29 € / Month*
• 🌟 *Annual Pass (2 Months Free):* *228 € / Year* _(equals 19 €/mo)_
• Full-stack DQS and match analytics
• Global leagues (Tier 1 & Tier 2 full access)
• All consensus ingestion sources (IQ-weighted)
• 15 daily AI expert reports & 150 smart alerts

3️⃣ 👑 *PREMIUM (MOST POPULAR)*
• 🗓️ *Monthly Pass:* *79 € / Month*
• 🌟 *Annual Pass (2 Months Free):* *660 € / Year* _(equals 55 €/mo)_
• All Pro features included
• 📱 VIP Telegram Bot (Instant push signals to your phone)
• 50 daily AI deep quantitative reports & unlimited alerts
• 💰 Bankroll management & auto-Kelly staking
• 💎 Early value bet & arbitrage radar
• 24/7 priority VIP Telegram support line

⚡ *Instant Checkout:*
Use the buttons below to pay securely via CryptoBot (USDT, TON, cards or Telegram wallet).
━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quant Syndicate*`;
}

export function formatFomoWinningCard(signal, result, finalScore = null, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const botUser = process.env.TELEGRAM_BOT_USERNAME || 'Livebetdeskbot';
    
    const home = cleanMd(signal.homeTeam || signal.match?.split(' vs ')[0] || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(signal.awayTeam || signal.match?.split(' vs ')[1] || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const market = cleanMd(resolveMarketText(signal, lang) || signal.market || (isTr ? 'Tahmin' : isDe ? 'Tipp' : 'Pick'));
    const odds = signal.recommendation?.odds || signal.odds || '1.80';
    const alertMin = signal.minute ? `${signal.minute}'` : '';
    const scoreStr = finalScore ? (typeof finalScore === 'object' ? `${finalScore.home}-${finalScore.away}` : finalScore) : (signal.resultScore || '');

    if (isTr) {
        return `🎯 *DÜDÜK ÇALDI, KASA KAZANDI!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
⏱️ *Sinyal Dakikası:* ${alertMin || 'Canlı'}
🎯 *Hedef Bahis:* *${market}* ✅
📊 *Yakalanan Oran:* *${odds}* | *Kâr Kasaya Eklendi!*

🔒 _VIP Kulübümüz bu değeri 0 saniye gecikmeyle canlıda yakaladı._

🔥 *Sıradaki kazanan sinyali kaçırmamak için:*
👉 Hemen bota gidin ve /deneme yazarak *3 Günlük Ücretsiz VIP* başlatın: @${botUser}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
    }

    if (isDe) {
        return `🎯 *SPIEL BEENDET, GEWINN GESICHERT!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
⏱️ *Signal-Minute:* ${alertMin || 'Live'}
🎯 *Erfolgreicher Tipp:* *${market}* ✅
📊 *Quote:* *${odds}* | *Gewinn verbucht!*

🔒 _Unser VIP-Syndikat hat diesen Pick mit 0s Latenz live erfasst._

🔥 *Um die nächsten Treffer nicht zu verpassen:*
👉 Jetzt @${botUser} anschreiben und /trial für den *3-Tage (72h) VIP-Pass* senden!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
    }

    return `🎯 *TARGET HIT, PROFIT SECURED!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
⏱️ *Alert Minute:* ${alertMin || 'In-Play'}
🎯 *Winning Pick:* *${market}* ✅
📊 *Locked Odds:* *${odds}* | *Profit Added to Ledger!*

🔒 _Our VIP Syndicate captured this value in-play with zero delay._

🔥 *Don't miss the next verified in-play alert:*
👉 Start your *3-Day (72h) Free VIP Pass* now by sending /trial to @${botUser}!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
}

export function formatTrialExpiringOffer(user, hoursRemaining = 4, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const username = user.username || 'Üye';
    const shopierLink = process.env.SHOPIER_VIP_LINK || 'https://www.shopier.com/QuantDataLabs';

    if (isTr) {
        return `⏳ *DİKKAT: ÜCRETSİZ VIP DENEMENİZİN BİTMESİNE ${hoursRemaining} SAAT KALDI!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sayın @${username},
3 günlük (72 saat) deneme süreniz sona ermek üzere. VIP kanalımızdaki canlı xG baskı alarmlarına, +EV fırsatlarına ve kasa koruma bildirimlerine kesintisiz erişmeye devam etmek için:

💎 *Özel Kampanya:* Bugün yenileme yapanlara Aylık Pro pakette anında indirim tanımlandı.

👉 *VIP Aboneliğinizi Hemen Uzatın:* /vip
👉 *Doğrudan Kartla Öde & Otomatik Aç:* [Buraya Tıklayın](${shopierLink})

_Herhangi bir sorunuz varsa bize bu sohbet üzerinden mesaj atabilirsiniz._
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Kulübü*`;
    }

    if (isDe) {
        return `⏳ *ACHTUNG: IHRE KOSTENLOSE VIP-TESTPHASE ENDET IN ${hoursRemaining} STUNDEN!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Liebe(r) @${username},
Ihr 3-Tage (72h) Testpass läuft bald ab. Sichern Sie sich unterbrechungsfreien Zugriff auf Live-Signale und Latenz-Radar:

💎 *Sonderangebot:* Verlängern Sie jetzt mit Sonderrabatt auf den Monats-Pass!

👉 *VIP-Status verlängern:* Senden Sie /vip
👉 *Sofort per Karte aktivieren:* [Hier klicken](${shopierLink})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
    }

    return `⏳ *NOTICE: YOUR FREE VIP PASS EXPIRES IN ${hoursRemaining} HOURS!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dear @${username},
Your complimentary 3-day (72h) trial is about to conclude. To maintain uninterrupted zero-latency access to institutional in-play signals & capital shields:

💎 *Special Renewal Offer:* Activate your monthly pass today to lock in priority pricing!

👉 *Renew VIP Access:* Send /vip
👉 *Direct Card Checkout:* [Click Here](${shopierLink})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor VIP Syndicate*`;
}

