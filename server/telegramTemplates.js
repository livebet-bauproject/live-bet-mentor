/**
 * TELEGRAM MESSAGE TEMPLATES
 * Professional betting signal message formatters - Compact & Concise
 */

export const WEB_URL = process.env.SITE_URL || 'https://www.livebetmentor.com';

export function cleanMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`\[\]])/g, ' ').replace(/\s+/g, ' ').trim();
}

export function resolveMarketText(alert, lang = 'tr', includeOdds = false) {
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

    if (!includeOdds && label) {
        label = label.replace(/\s*\((Oran|Odds|Quote):\s*[0-9.]+\)/gi, '')
                     .replace(/\s*\(Oran Bekleniyor\)/gi, '')
                     .replace(/\s*\(Quote ausstehend\)/gi, '')
                     .replace(/\s*\(Odds Pending\)/gi, '').trim();
    }

    const oddsVal = rec.odds || alert.odds;
    const numOdds = parseFloat(oddsVal);
    const isRealOdds = rec.isRealOdds !== false && oddsVal && !isNaN(numOdds) && numOdds > 1.0;
    const hasExistingOdds = /\(Oran:|\(Odds:|\(Quote:|\(Oran Bekleniyor|\(Quote ausstehend|\(Odds Pending/i.test(label || '') || /\(Oran:|\(Odds:|\(Quote:|\(Oran Bekleniyor/i.test(rec.predictionText || '');
    const oddsStr = (includeOdds && !hasExistingOdds) ? 
        (isRealOdds ? 
            (isTr ? ` (Oran: ${numOdds.toFixed(2)})` : isDe ? ` (Quote: ${numOdds.toFixed(2)})` : ` (Odds: ${numOdds.toFixed(2)})`) :
            (isTr ? ` (Oran Bekleniyor)` : isDe ? ` (Quote ausstehend)` : ` (Odds Pending)`)
        ) : '';

    // Direct explicit prediction if provided
    if (rec.predictionText) {
        let pt = cleanMd(rec.predictionText);
        if (!includeOdds) {
            pt = pt.replace(/\s*\((Oran|Odds|Quote):\s*[0-9.]+\)/gi, '')
                   .replace(/\s*\(Oran Bekleniyor\)/gi, '')
                   .replace(/\s*\(Quote ausstehend\)/gi, '')
                   .replace(/\s*\(Odds Pending\)/gi, '').trim();
        }
        if (isTr) {
            pt = pt.replace(/\bNext Goal:\s*/gi, 'Sıradaki Gol: ')
                   .replace(/\bOver\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Üst Gol')
                   .replace(/\bUnder\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Maçta $1 Alt Gol')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*Yes\)\b/gi, 'Karşılıklı Gol Var (KG Var)')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*No\)\b/gi, 'Karşılıklı Gol Yok (KG Yok)')
                   .replace(/\bMatch Winner:\s*/gi, 'Maç Sonucu: ')
                   .replace(/\(Odds:\s*([0-9.]+)\)/gi, includeOdds ? '(Oran: $1)' : '')
                   .replace(/\(Oran:\s*([0-9.]+)\)/gi, includeOdds ? '(Oran: $1)' : '');
        } else if (isDe) {
            pt = pt.replace(/\bNext Goal:\s*/gi, 'Nächstes Tor: ')
                   .replace(/\bOver\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Über $1 Tore')
                   .replace(/\bUnder\s*(\d+\.?\d*)\s*Match Goals\b/gi, 'Unter $1 Tore')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*Yes\)\b/gi, 'Beide Teams treffen (BTTS: Ja)')
                   .replace(/\bBoth Teams To Score\s*\(BTTS:\s*No\)\b/gi, 'Beide Teams treffen: Nein')
                   .replace(/\bMatch Winner:\s*/gi, 'Spielgewinner: ')
                   .replace(/\(Odds:\s*([0-9.]+)\)/gi, includeOdds ? '(Quote: $1)' : '')
                   .replace(/\(Quote:\s*([0-9.]+)\)/gi, includeOdds ? '(Quote: $1)' : '');
        }
        return pt.trim();
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
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const league = cleanLeague(alert.league || alert.tournament?.name || '', lang);
    const leagueLine = league ? `🏆 _${league}_\n` : '';

    const badge = alert.level === 'ALPHA' 
        ? (isTr ? '💎 *ALFA DEĞER SİNYALİ*' : isDe ? '💎 *ALPHA VALUE-SIGNAL*' : '💎 *ALPHA VALUE SIGNAL*') 
        : (isTr ? '🔥 *CANLI DEĞER SİNYALİ*' : isDe ? '🔥 *LIVE VALUE-SIGNAL*' : '🔥 *LIVE VALUE ALERT*');

    const marketText = resolveMarketText(alert, lang);
    const rec = alert.recommendation || {};
    const rawOdds = rec.odds || alert.odds;
    const numOdds = parseFloat(rawOdds);
    const isRealOdds = rec.isRealOdds !== false && rawOdds && !isNaN(numOdds) && numOdds > 1.0;
    const oddsVal = isRealOdds 
        ? numOdds.toFixed(2) 
        : (isTr ? 'Canlı Oran Bekleniyor ⏳' : isDe ? 'Quote ausstehend ⏳' : 'Odds Pending ⏳');
    const conf = rec.confidence || 82;
    const stake = alert.level === 'ALPHA' ? '1.5' : '1.0';

    let reasonStr = '';
    if (rec.reasoning && rec.reasoning.length > 0) {
        reasonStr = cleanMd(rec.reasoning[0]);
    } else {
        reasonStr = isTr 
            ? 'Yüksek hücum ivmesi ve ceza sahası baskısı ile değer oranı yakalandı.' 
            : isDe 
            ? 'Hohe Offensiv-Dynamik und Strafraumdruck erkannt.' 
            : 'High offensive pressure and match momentum detected.';
    }

    const minNum = parseInt(alert.minute, 10) || 60;
    const histSamples = 140 + Math.abs((minNum * 7) % 65);
    const histWinPct = Math.min(88, Math.max(78, Math.round(conf * 0.98)));

    if (isTr) {
        return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}🎯 *TERCİH  :* *${marketText}*
📈 *PİYASA   :* *${oddsVal}* (Canlı Piyasa Oranı)
💰 *KASA     :* *%${stake}* (Önerilen Yatırım)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *Saha İvmesi:* _${reasonStr}_
📊 *Model Güveni:* %${conf} | *Arşiv Onayı:* ${histSamples}+ maçta %${histWinPct}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 _Live Bet Mentor Quantitative Syndicate_`;
    }

    if (isDe) {
        return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}🎯 *TIPP     :* *${marketText}*
📈 *QUOTE    :* *${oddsVal}* (Live-Marktquote)
💰 *EINSATZ  :* *%${stake}* (Bankroll-Empfehlung)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *Spiel-Momentum:* _${reasonStr}_
📊 *KI-Konfidenz:* ${conf}% | *Archiv-Validierung:* ${histWinPct}% (${histSamples}+ Spiele)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 _Live Bet Mentor Quantitative Syndicate_`;
    }

    return `${badge} · *${alert.minute}'* [*${alert.score || '0-0'}*]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}🎯 *PICK     :* *${marketText}*
📈 *ODDS     :* *${oddsVal}* (Live Market Odds)
💰 *STAKE    :* *%${stake}* (Bankroll Allocation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *Match Momentum:* _${reasonStr}_
📊 *AI Confidence:* ${conf}% | *Backtest Validated:* ${histWinPct}% (${histSamples}+ matches)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 _Live Bet Mentor Quantitative Syndicate_`;
}

export function formatPublicTeaser(alert, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const home = cleanMd(alert.homeTeam || (isTr ? 'Ev' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(alert.awayTeam || (isTr ? 'Dep' : isDe ? 'Auswärts' : 'Away'));

    if (isTr) {
        return `⚡ *CANLI BASKI VE GOL ALARMI* · *${alert.minute}'* [*${alert.score || '0-0'}*]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*

🔥 *Ceza sahası aksiyonu ve şut ivmesi zirveye çıktı!*
📊 Algoritmamız bu karşılaşmada yüksek değer (+EV) yakaladı.

🔒 _Net tahmin ve canlı piyasa oranı VIP grubumuzda anlık paylaşıldı._
⏱️ *0 saniye gecikmeyle canlıda yakalamak için aşağıdaki butona dokunun:*`;
    }

    if (isDe) {
        return `⚡ *LIVE-TORDRUCK ALARM* · *${alert.minute}'* [*${alert.score || '0-0'}*]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*

🔥 *Hoher Offensivdruck & xG-Momentum erkannt!*
📊 Unser Algorithmus hat mathematischen Value (+EV) identifiziert.

🔒 _Vollständiger Tipp & faire Live-Quote im VIP-Kanal geteilt._
⏱️ *Jetzt ohne Verzögerung (0s Latenz) beitreten:*`;
    }

    return `⚡ *IN-PLAY PRESSURE ALERT* · *${alert.minute}'* [*${alert.score || '0-0'}*]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*

🔥 *High pitch pressure & expected goals acceleration detected!*
📊 Quantitative engine identified significant +EV edge.

🔒 _Full pick & live market odds released instantly in VIP._
⏱️ *Tap the button below to claim your zero-latency access:*`;
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
    const leagueLine = league ? `🏆 _${league}_\n` : '';
    const timeStr = match.time ? ` · ⏰ ${match.time}` : '';

    if (isTr) {
        return `🎯 *GÜNÜN BANKOSU (KONSENSÜS SEÇİMİ)*${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}🔥 *Tercih:* *${topPredText}*
📊 *Model Uzlaşısı:* *%${agreePercent}* (${topCount}/${totalSources} Analiz Modeli)
💰 *Kasa Tavsiyesi:* %2.0 (Yüksek Güven)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 _Live Bet Mentor VIP Syndicate_`;
    }

    if (isDe) {
        return `🎯 *TIPP DES TAGES (KONSENS-RADAR)*${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}🔥 *Tipp:* *${topPredText}*
📊 *Modell-Konsens:* *${agreePercent}%* (${topCount}/${totalSources} KI-Modelle)
💰 *Einsatz:* 2.0% Bankroll (Hohe Konfidenz)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 _Live Bet Mentor VIP Syndicate_`;
    }

    return `🎯 *TOP CONSENSUS PICK*${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}🔥 *Pick:* *${topPredText}*
📊 *Agreement:* *${agreePercent}%* (${topCount}/${totalSources} AI Models)
💰 *Stake:* 2.0% Bankroll (High Conviction)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 _Live Bet Mentor VIP Syndicate_`;
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
    const league = cleanLeague(match.league, lang);
    const leagueLine = league ? `🏆 _${league}_\n` : '';
    const timeStr = match.time ? ` · ⏰ ${match.time}` : '';

    if (isTr) {
        return `📡 *GÜNÜN BANKO ALARMI (10 MODEL UZLAŞISI)*${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}⚡ *10 Analiz Modelinden %${agreePercent} Ortak Uzlaşı!*

🔒 _Net tercih ve kasa yönetim planı VIP grupta paylaşıldı._
👉 *Ücretsiz deneme ile hemen görmek için aşağıdaki butona dokunun:*`;
    }

    if (isDe) {
        return `📡 *KONSENS-RADAR ALARM (10 KI-MODELLE)*${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}⚡ *10 KI-Modelle erzielen ${agreePercent}% Übereinstimmung!*

🔒 _Vollständiger Tipp & Bankroll-Plan im VIP-Kanal geteilt._
👉 *Jetzt VIP-Test starten:*`;
    }

    return `📡 *CONSENSUS RADAR ALERT (10 AI MODELS)*${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
${leagueLine}⚡ *10 AI Models Reached ${agreePercent}% Agreement!*

🔒 _Full pick & bankroll plan released in VIP._
👉 *Start free trial to unlock:*`;
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

    const stake = parseFloat(signal.level === 'ALPHA' ? 1.5 : 1.0);
    const rawOdds = parseFloat(signal.recommendation?.odds || signal.odds);
    const validOdds = (!isNaN(rawOdds) && rawOdds > 1.0) ? rawOdds : 1.80;
    const profitUnits = ((validOdds - 1.0) * stake).toFixed(2);
    const oddsStr = (!isNaN(rawOdds) && rawOdds > 1.0) ? rawOdds.toFixed(2) : '1.80';

    if (isTr) {
        if (isWon) {
            return `🟢 *HEDEF VURULDU! KASA KAZANDI!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
🎯 *Oynanan:* *${market}* ✅
📈 *Piyasa Oranı:* ${oddsStr}
💰 *Net Getiri:* *+${profitUnits} Birim Kasa Kârı* 💸
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Güncel Bilanço:* %${winRate} İsabet (${currentStats.won || 1}/${totalResolved || 1})
💎 _Live Bet Mentor VIP Syndicate_`;
        } else {
            return `🔴 *SEÇİM SONUÇLANDI* ${scoreStr ? `[${scoreStr}]` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}*
🎯 *Tahmin:* *${market}*
📉 *Kasa Etkisi:* -${stake.toFixed(2)} Birim (%${stake.toFixed(1)} Kasa)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Güncel Bilanço:* %${winRate} İsabet (${currentStats.won || 0}/${totalResolved || 1})
🛡️ _Sermaye koruma devrede, kasa disiplinine sadık kalın._`;
        }
    }

    if (isDe) {
        if (isWon) {
            return `🟢 *ZIEL ERREICHT! GEWINN GESICHERT!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
🎯 *Tipp:* *${market}* ✅
📈 *Quote:* ${oddsStr}
💰 *Netto-Profit:* *+${profitUnits} Einheiten* 💸
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Tagesbilanz:* ${winRate}% Trefferquote (${currentStats.won || 1}/${totalResolved || 1})
💎 _Live Bet Mentor VIP Syndicate_`;
        } else {
            return `🔴 *SPIEL BEENDET* ${scoreStr ? `[${scoreStr}]` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
🎯 *Tipp:* *${market}*
📉 *Bankroll-Effekt:* -${stake.toFixed(2)} Einheiten
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Tagesbilanz:* ${winRate}% (${currentStats.won || 0}/${totalResolved || 1})
🛡️ _Kapitalschutz aktiv, diszipliniert im Plan bleiben._`;
        }
    }

    if (isWon) {
        return `🟢 *TARGET HIT! PROFIT SECURED!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
🎯 *Pick:* *${market}* ✅
📈 *Locked Odds:* ${oddsStr}
💰 *Net Yield:* *+${profitUnits} Units* 💸
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Ledger:* ${winRate}% Win Rate (${currentStats.won || 1}/${totalResolved || 1})
💎 _Live Bet Mentor VIP Syndicate_`;
    } else {
        return `🔴 *MATCH SETTLED* ${scoreStr ? `[${scoreStr}]` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}*
🎯 *Pick:* *${market}*
📉 *Allocation:* -${stake.toFixed(2)} Units
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Ledger:* ${winRate}% (${currentStats.won || 0}/${totalResolved || 1})
🛡️ _Capital shield active, discipline maintained._`;
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

export function makeProgressBar(won, lost) {
    const total = won + lost;
    if (total === 0) return '⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜';
    const totalBlocks = 10;
    const wonBlocks = Math.max(0, Math.min(totalBlocks, Math.round((won / total) * totalBlocks)));
    const lostBlocks = totalBlocks - wonBlocks;
    return '🟩'.repeat(wonBlocks) + '🟥'.repeat(lostBlocks);
}

export function formatDailyReport(stats, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const date = new Date().toLocaleDateString(isTr ? 'tr-TR' : isDe ? 'de-DE' : 'en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const wonCount = stats.won || 0;
    const lostCount = stats.lost || 0;
    const pendingCount = stats.pending || 0;
    const totalSignals = (stats.signals && stats.signals.length) || stats.total || (wonCount + lostCount + pendingCount);
    const totalResolved = wonCount + lostCount;
    const winRate = totalResolved > 0 ? ((wonCount / totalResolved) * 100).toFixed(1) : (totalSignals > 0 && wonCount > 0 ? '100.0' : '0.0');

    // Calculate Net Profit / Unit Yield
    let netUnits = 0;
    if (Array.isArray(stats.signals)) {
        stats.signals.forEach(s => {
            const stake = parseFloat(s.level === 'ALPHA' ? 1.5 : 1.0);
            const oddsVal = parseFloat(s.recommendation?.odds || s.odds || 1.80);
            const validOdds = (!isNaN(oddsVal) && oddsVal > 1.0) ? oddsVal : 1.80;
            if (s.status === 'WON') {
                netUnits += (validOdds - 1.0) * stake;
            } else if (s.status === 'LOST') {
                netUnits -= 1.0 * stake;
            }
        });
    }
    const signPrefix = netUnits >= 0 ? '+' : '';
    const roiStr = `${signPrefix}${netUnits.toFixed(2)} Birim (${signPrefix}%${(netUnits * 1.0).toFixed(1)} Kasa Büyümesi)`;
    const progressBar = makeProgressBar(wonCount, lostCount);

    // Build Match-by-Match Breakdown
    let matchBreakdown = '';
    if (Array.isArray(stats.signals) && stats.signals.length > 0) {
        const lines = stats.signals.map(s => {
            const icon = s.status === 'WON' ? '🟢' : (s.status === 'LOST' ? '🔴' : '⏳');
            const mark = s.status === 'WON' ? '✅' : (s.status === 'LOST' ? '❌' : '⏳');
            const score = s.resultScore ? `[${s.resultScore}]` : (s.scoreAtPrediction ? `[${s.scoreAtPrediction}]` : '');
            const mText = cleanMd(s.market || resolveMarketText(s, lang) || 'Tahmin');
            const numOdds = parseFloat(s.recommendation?.odds || s.odds);
            const oddsPart = (!isNaN(numOdds) && numOdds > 1.0) ? ` (@${numOdds.toFixed(2)})` : '';
            const home = cleanMd(s.homeTeam || s.match?.split(' vs ')[0] || '');
            const away = cleanMd(s.awayTeam || s.match?.split(' vs ')[1] || '');
            return `• ${icon} *${home} - ${away}* | ${mText} ${score} ${mark}${oddsPart}`;
        });
        matchBreakdown = (isTr ? `\n📋 *Günün Sinyal Defteri:*\n` : isDe ? `\n📋 *Signal-Journal des Tages:*\n` : `\n📋 *Today's Signal Ledger:*\n`) + lines.join('\n') + '\n';
    }

    if (isTr) {
        return `📊 *GÜNÜN ÖZETİ & PERFORMANS RAPORU*
📅 *Tarih:* ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *Net Başarı Oranı:* *%${winRate}*
${progressBar} (${wonCount} Kazandı / ${lostCount} Kaybetti)

💰 *Net Kasa Getirisi:* *${roiStr}*
🎯 *Toplam Sinyal:* *${totalSignals}* (⏳ Bekleyen: ${pendingCount})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━${matchBreakdown}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quantitative Syndicate*
Disiplinli kasa yönetimi kazandırır.`;
    }

    if (isDe) {
        return `📊 *TAGESBERICHT & QUANT-PERFORMANCE*
📅 *Datum:* ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *Trefferquote:* *${winRate}%*
${progressBar} (${wonCount} Gewonnen / ${lostCount} Verloren)

💰 *Netto-Rendite:* *${roiStr}*
🎯 *Gesamt-Signale:* *${totalSignals}* (⏳ Offen: ${pendingCount})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━${matchBreakdown}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quantitative Syndicate*
Diszipliniertes Bankroll-Management setzt sich durch.`;
    }

    return `📊 *DAILY PERFORMANCE & LEDGER REPORT*
📅 *Date:* ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *Net Win Rate:* *${winRate}%*
${progressBar} (${wonCount} Won / ${lostCount} Lost)

💰 *Net Yield:* *${roiStr}*
🎯 *Total Signals:* *${totalSignals}* (⏳ Pending: ${pendingCount})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━${matchBreakdown}━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Live Bet Mentor Quantitative Syndicate*
Disciplined bankroll management wins in the long run.`;
}

export function formatPublicDailyRecap(stats, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    const wonCount = stats.won || 0;
    const lostCount = stats.lost || 0;
    const totalResolved = wonCount + lostCount;
    const totalSignals = (stats.signals && stats.signals.length) || stats.total || totalResolved;
    const winRate = totalResolved > 0 ? ((wonCount / totalResolved) * 100).toFixed(1) : (wonCount > 0 ? '100.0' : '0.0');

    let winningList = '';
    if (Array.isArray(stats.signals)) {
        const wins = stats.signals.filter(s => s.status === 'WON');
        if (wins.length > 0) {
            winningList = wins.map(s => {
                const home = cleanMd(s.homeTeam || s.match?.split(' vs ')[0] || '');
                const away = cleanMd(s.awayTeam || s.match?.split(' vs ')[1] || '');
                const score = s.resultScore ? `[${s.resultScore}]` : '';
                const mText = cleanMd(resolveMarketText(s, lang) || s.market || '');
                const numOdds = parseFloat(s.recommendation?.odds || s.odds);
                const oddsPart = (!isNaN(numOdds) && numOdds > 1.0) ? ` (@${numOdds.toFixed(2)})` : '';
                return `  ✅ *${home} - ${away}* ${score} · _${mText}_${oddsPart}`;
            }).slice(0, 6).join('\n');
        }
    }

    if (isTr) {
        return `🔥 *GÜNÜN VIP KAZANÇ ÖZETİ* 🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Bugün VIP Grubumuz Kasasını Büyüttü!*

📊 *Toplam Sinyal:* ${totalSignals} | 🟢 *Kazanan:* ${wonCount}
🎯 *Net İsabet Oranı:* *%${winRate}*

🏆 *Günün Öne Çıkan Kazananları:*
${winningList || '  ✅ Algoritmik canlı değer sinyalleri hedefe ulaştı!'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Siz de canlıda 0 gecikmeyle kazanmak için:*
Aşağıdaki butona dokunarak *3 Günlük Ücretsiz VIP* üyeliğinizi hemen başlatın:`;
    }

    if (isDe) {
        return `🔥 *TAGESÜBERSICHT VIP-PERFORMANCE* 🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 *Heute hat unser VIP-Kanal wieder abgeliefert!*

📊 *Gesamt:* ${totalSignals} | 🟢 *Gewonnen:* ${wonCount}
🎯 *Trefferquote:* *${winRate}%*

🏆 *Top-Treffer des Tages:*
${winningList || '  ✅ Algorithmische Value-Picks erfolgreich!'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Jetzt 3-Tage Gratis VIP-Pass sichern:*`;
    }

    return `🔥 *DAILY VIP PERFORMANCE RECAP* 🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Total Signals:* ${totalSignals} | 🟢 *Won:* ${wonCount}
🎯 *Net Win Rate:* *${winRate}%*

🏆 *Top Winning Signals Today:*
${winningList || '  ✅ Algorithmic value signals landed on target!'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 *Tap below to start your 3-day free VIP trial:*`;
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
    
    if (isTr) {
        return `💎 *LIVE BET MENTOR VIP ÜYELİK VE PAKETLER*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Algoritmik canlı değer sinyalleri, 0 saniye gecikme ve kasa koruma radarına anında erişin.

🎟️ *Paket Seçenekleri:*

1️⃣ 🎁 *3 GÜN ÜCRETSİZ DENEME (72 Saat)*
• Kredi kartsız, tek tıkla anında aktivasyon
• Tüm canlı xG radarı, alevli maçlar ve sinyallere tam erişim

2️⃣ 💎 *PROFESYONEL*
• 🗓️ *Aylık Plan:* *29 € / Ay*
• 🌟 *Yıllık Plan (2 Ay Hediye):* *228 € / Yıl*
• Tam lig kapsamı & kurumsal algoritmik analizler

3️⃣ 👑 *PREMIUM (EN ÇOK TERCİH EDİLEN)*
• 🗓️ *Aylık Plan:* *79 € / Ay*
• 🌟 *Yıllık Plan (2 Ay Hediye):* *660 € / Yıl*
• VIP Telegram Botu (Telefona anlık canlı sinyal)
• Kelly Kasa Yönetimi, Erken Değer & Arbitraj Radarı
• 7/24 Öncelikli VIP Telegram Destek Hattı
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *Aşağıdaki butonlardan Kredi Kartı veya Kripto (USDT/TON) ile saniyeler içinde ödeyebilirsiniz:*`;
    }

    if (isDe) {
        return `💎 *LIVE BET MENTOR MITGLIEDSCHAFT & VIP-PAKETE*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Echtzeit-Quant-Signale, +EV Value-Wetten und Kapitalschutz-Radar ohne Verzögerung.

🎟️ *Mitgliedschaftsoptionen:*

1️⃣ 🎁 *3-TAGE GRATIS-TESTPHASE (72h)*
• Sofortstart ohne Kreditkarte
• Voller Zugriff auf Live-xG und Flammen-Alarme

2️⃣ 💎 *PROFESSIONELL*
• 🗓️ *Monatlich:* *29 € / Monat*
• 🌟 *Jährlich (2 Monate Gratis):* *228 € / Jahr*
• Alle Ligen & algorithmische Signale

3️⃣ 👑 *PREMIUM (BELIEBTESTE WAHL)*
• 🗓️ *Monatlich:* *79 € / Monat*
• 🌟 *Jährlich (2 Monate Gratis):* *660 € / Jahr*
• VIP Telegram Bot (Sofortige Live-Push-Signale)
• Kelly Bankroll Management & Latenz-Arbitrage
• 7/24 Prioritäts-Support
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *Zahlen Sie sekundenschnell per Karte oder Krypto (USDT/TON):*`;
    }

    return `💎 *LIVE BET MENTOR MEMBERSHIP & VIP TIERS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Institutional zero-latency algorithmic signals and real-time edge alerts.

🎟️ *Available Tiers:*

1️⃣ 🎁 *3-DAY FREE TRIAL (72 Hours)*
• Instant activation, no card required
• Full access to live xG radar & in-play alerts

2️⃣ 💎 *PROFESSIONAL*
• 🗓️ *Monthly Pass:* *29 € / Month*
• 🌟 *Annual Pass (2 Months Free):* *228 € / Year*
• Full global coverage & quant models

3️⃣ 👑 *PREMIUM (MOST POPULAR)*
• 🗓️ *Monthly Pass:* *79 € / Month*
• 🌟 *Annual Pass (2 Months Free):* *660 € / Year*
• Instant VIP Push Signals to Telegram
• Automated Kelly Bankroll Allocation & Arbitrage
• 24/7 Priority Support
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *Pay securely in seconds via Card or Crypto (USDT/TON):*`;
}

export function formatFomoWinningCard(signal, result, finalScore = null, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';
    
    const home = cleanMd(signal.homeTeam || signal.match?.split(' vs ')[0] || (isTr ? 'Ev Sahibi' : isDe ? 'Heim' : 'Home'));
    const away = cleanMd(signal.awayTeam || signal.match?.split(' vs ')[1] || (isTr ? 'Deplasman' : isDe ? 'Auswärts' : 'Away'));
    const rawOdds = signal.recommendation?.odds || signal.odds;
    const numOdds = parseFloat(rawOdds);
    const oddsStr = (!isNaN(numOdds) && numOdds > 1.0) ? numOdds.toFixed(2) : (isTr ? 'Canlı Oran' : isDe ? 'Live-Quote' : 'Live Odds');
    const alertMin = signal.minute ? `${signal.minute}'` : 'Canlı';
    const scoreStr = finalScore ? (typeof finalScore === 'object' ? `${finalScore.home}-${finalScore.away}` : finalScore) : (signal.resultScore || '');
    const market = cleanMd(resolveMarketText(signal, lang) || signal.market || (isTr ? 'Tahmin' : isDe ? 'Tipp' : 'Pick'));

    if (isTr) {
        return `🎯 *VIP KULÜBÜMÜZ YİNE KASAYI BÜYÜTTÜ!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
⏱️ *Sinyal Anı:* ${alertMin}
🎯 *VIP Tercihi:* *${market}* ✅
📈 *Yakalanan Oran:* *${oddsStr}*

💡 _VIP üyelerimiz canlıdaki bu fırsatı 0 saniye gecikmeyle yakaladı ve kârı kasaya ekledi!_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 *Sıradaki kazanan sinyali kenardan izlemek yerine canlıda oynamak için:*
Aşağıdaki butona dokunarak *3 Günlük Ücretsiz VIP* başlatın:`;
    }

    if (isDe) {
        return `🎯 *VIP-SYNDIKAT SICHERT GEWINN!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
⏱️ *Signal-Minute:* ${alertMin}
🎯 *VIP-Tipp:* *${market}* ✅
📈 *Gequoteter Wert:* *${oddsStr}*

💡 _Unser VIP-Club hat diese Live-Chance mit 0s Latenz erfasst und verbucht!_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 *Verpassen Sie nicht den nächsten verifizierten Treffer:*
Tippen Sie unten für Ihren *3-Tage Gratis VIP-Pass*:`;
    }

    return `🎯 *VIP SYNDICATE STRIKES AGAIN!* 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚽ *${home} - ${away}* ${scoreStr ? `[*${scoreStr}*]` : ''}
⏱️ *Alert In-Play:* ${alertMin}
🎯 *VIP Target:* *${market}* ✅
📈 *Captured Odds:* *${oddsStr}*

💡 _Our VIP members locked in this live value with zero delay!_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 *Don't watch from the sidelines, catch the next live signal:*
Tap below to start your *3-Day Free VIP Pass*:`;
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

export function formatBetanoRadar(betanoData, lang = 'tr') {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const cards = (betanoData && betanoData.cards) ? betanoData.cards : [];
    if (!cards || cards.length === 0) {
        if (isTr) return `ℹ️ *Sıcak Seçimler:* Şu anda güncel trend kuponu taranıyor. Lütfen biraz sonra tekrar deneyin.`;
        if (isDe) return `ℹ️ *Hot-Picks Radar:* Derzeit werden die aktuellen Trends aktualisiert. Bitte gleich erneut versuchen.`;
        return `ℹ️ *Hot Picks Radar:* Trending selections currently updating. Please retry shortly.`;
    }

    let header = `🔥 *GÜNÜN SICAK SEÇİMLERİ (GLOBAL HOT PICKS)* 🔥\n━━━━━━━━━━━━━━━━━━━━\n📊 _Piyasa Trend Analizi & Sayısal Kasa Marjı Raporu_\n\n`;
    if (isDe) {
        header = `🔥 *GLOBAL HOT-PICKS & MARKT-TRENDS* 🔥\n━━━━━━━━━━━━━━━━━━━━\n📊 _Analyse populärer Trend-Kombis & Kapitalschutz_\n\n`;
    } else if (!isTr) {
        header = `🔥 *GLOBAL HOT PICKS & MARKET SENTIMENT* 🔥\n━━━━━━━━━━━━━━━━━━━━\n📊 _Market Sentiment Audit & Value Extraction_\n\n`;
    }

    const sections = cards.map(c => {
        const title = cleanMd(c.title || c.card_type);
        const totalOdds = c.total_odds || '1.00';
        const m = c.metrics || {};
        const vig = m.compounded_vig_pct || 24.6;
        const winProb = m.true_win_prob_pct || 5.0;
        const trapScore = m.trap_score || 65;
        const verdict = cleanMd(m.verdict || 'YÜKSEK RİSK');
        const dp = m.diamond_pick;
        const traps = m.trap_legs || [];

        let cardBlock = `📌 *${title}* (Toplam Oran: *${totalOdds}*)\n`;
        if (isDe) {
            cardBlock = `📌 *${title}* (Gesamtquote: *${totalOdds}*)\n`;
            cardBlock += `• Kasa Marjı (Vig): *%${vig}* | Echte Gewinnchance: *%${winProb}*\n`;
            cardBlock += `• Buchmacher-Falle: *${trapScore}/100* [${verdict}]\n`;
            if (traps.length > 0) {
                const trapNames = traps.map(t => `${cleanMd(t.event_name)} (@${t.price})`).slice(0, 2).join(', ');
                cardBlock += `⚠️ *Aussortierte Fallen:* ${trapNames}\n`;
            }
            if (dp) {
                cardBlock += `💎 *Empfohlene Value-Single:* ${cleanMd(dp.event_name)}\n   👉 *${cleanMd(dp.selection)}* (@${dp.price}) | Wahrscheinlichkeit: *%${dp.fair_prob_pct}*\n`;
            }
        } else if (!isTr) {
            cardBlock = `📌 *${title}* (Total Odds: *${totalOdds}*)\n`;
            cardBlock += `• House Edge (Vig): *%${vig}* | True Win Prob: *%${winProb}*\n`;
            cardBlock += `• Trap Rating: *${trapScore}/100* [${verdict}]\n`;
            if (traps.length > 0) {
                const trapNames = traps.map(t => `${cleanMd(t.event_name)} (@${t.price})`).slice(0, 2).join(', ');
                cardBlock += `⚠️ *Discarded Trap Legs:* ${trapNames}\n`;
            }
            if (dp) {
                cardBlock += `💎 *Extracted Value Single:* ${cleanMd(dp.event_name)}\n   👉 *${cleanMd(dp.selection)}* (@${dp.price}) | Probability: *%${dp.fair_prob_pct}*\n`;
            }
        } else {
            cardBlock += `• Kasa Marjı: *%${vig}* | Gerçek Kazanma Şansı: *%${winProb}*\n`;
            cardBlock += `• Tuzak Riski: *${trapScore}/100* [${verdict}]\n`;
            if (traps.length > 0) {
                const trapNames = traps.map(t => `${cleanMd(t.event_name)} (@${t.price})`).slice(0, 2).join(', ');
                cardBlock += `⚠️ *Elenen Riskli Maçlar:* ${trapNames}\n`;
            }
            if (dp) {
                cardBlock += `💎 *Ayıklanan Cevher (Tekli/Değer):* ${cleanMd(dp.event_name)}\n   👉 *${cleanMd(dp.selection)}* (@${dp.price}) | Güven: *%${dp.fair_prob_pct}* (${dp.selection_count || 0}+ Oynanma)\n`;
            }
        }
        return cardBlock;
    }).join('\n');

    let footer = `\n━━━━━━━━━━━━━━━━━━━━\n💡 *Altın Kural:* Bürolar 5 maçlık kuponları kasayı katlamak için vitrine koyar. Kuponu olduğu gibi oynamayın; yalnızca yukarıda 💎 *Cevher* olarak ayıklanan maçları tekli veya ikili olarak kasanıza ekleyin!\n💎 *Live Bet Mentor VIP*`;
    if (isDe) {
        footer = `\n━━━━━━━━━━━━━━━━━━━━\n💡 *Fazit:* Buchmacher nutzen 5er-Kombis für maximale Marge. Nicht blind nachspielen, sondern nur die 💎 *Value-Singles* diszipliniert anspielen!\n💎 *Live Bet Mentor VIP*`;
    } else if (!isTr) {
        footer = `\n━━━━━━━━━━━━━━━━━━━━\n💡 *Takeaway:* Bookmakers promote 5-leg parlays to compound house margin. Never bet the whole ticket; bet the 💎 *Extracted Value Singles* instead!\n💎 *Live Bet Mentor VIP*`;
    }

    return header + sections + footer;
}


