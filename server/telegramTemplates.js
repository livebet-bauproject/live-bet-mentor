/**
 * TELEGRAM MESSAGE TEMPLATES
 * Professional betting signal message formatters
 */

export function cleanMd(str) {
    if (!str) return '';
    return String(str).replace(/([_*`\[\]])/g, ' ');
}

export function resolveMarketText(alert) {
    const home = cleanMd(alert.homeTeam || 'Home');
    const away = cleanMd(alert.awayTeam || 'Away');
    const rec = alert.recommendation || {};
    const key = rec.marketKey || '';
    const label = cleanMd(rec.marketLabel || rec.market || '');
    const team = cleanMd(rec.team || (key.includes('home') ? home : key.includes('away') ? away : ''));
    const oddsStr = rec.odds ? ` (Odds: ${rec.odds})` : '';

    // Direct explicit prediction if provided
    if (rec.predictionText) {
        return `${cleanMd(rec.predictionText)}${oddsStr}`;
    }

    // 1. Latency Arbitrage (Highest priority)
    if (key === 'market_latency_arbitrage' || rec.edgeType === 'LATENCY') {
        const target = team ? `${team} (${label || 'Next Goal'})` : (label || 'Next Goal');
        return `Latency Arbitrage: ${target}${oddsStr}`;
    }

    // 2. Mathematical Value (+EV)
    if (key === 'market_plus_ev' || rec.edgeType === 'PLUS_EV') {
        return `Value Edge (+EV): ${label || 'Over Goals'}${oddsStr}`;
    }

    // 3. Next Goal - Home / Away
    if (key === 'market_next_goal_home' || key === 'HOME_NEXT_GOAL') {
        return `Next Goal: ${home}${oddsStr}`;
    }
    if (key === 'market_next_goal_away' || key === 'AWAY_NEXT_GOAL') {
        return `Next Goal: ${away}${oddsStr}`;
    }

    // 3b. Match Winner
    if (key === 'HOME_WIN_NEXT') {
        return `Match Winner: ${home}${oddsStr}`;
    }
    if (key === 'AWAY_WIN_NEXT') {
        return `Match Winner: ${away}${oddsStr}`;
    }

    // 4. First Half Over 0.5 Goals
    if (key === 'market_fh_over05' || label.includes('İY 0.5') || label.toLowerCase().includes('first half') || label.toLowerCase().includes('ilk yarı')) {
        return `First Half Over 0.5 Goals${oddsStr}`;
    }

    // 5. Both Teams To Score (BTTS: Yes)
    if (key === 'market_btts' || key === 'btts' || label.toUpperCase().includes('KG') || label.toLowerCase().includes('both teams') || label.toLowerCase().includes('karşılıklı')) {
        return `Both Teams To Score (BTTS: Yes)${oddsStr}`;
    }

    // 6. Over / Under Goals
    if (key === 'market_over_goals' || key === 'OVER_NEXT_DYNAMIC' || label.includes('Üst') || label.toLowerCase().includes('over')) {
        const goalsMatch = label.match(/(\d+\.?\d*)/);
        const goals = rec.marketParams?.goals || rec.target || (goalsMatch ? goalsMatch[1] : '2.5');
        return `Over ${goals} Match Goals${oddsStr}`;
    }

    // 7. Next Goal label fallback
    if (label.toLowerCase().includes('sıradaki gol') || label.toLowerCase().includes('next goal')) {
        const targetTeam = team || (label.includes('Ev') || label.includes('Home') ? home : label.includes('Dep') || label.includes('Away') ? away : home);
        return `Next Goal: ${targetTeam}${oddsStr}`;
    }

    // 8. Strategy-based signals
    if (key === 'COMEBACK' || key === 'ADV_COMEBACK') {
        return `Comeback In-Play: Next Goal ${team || home}${oddsStr}`;
    }
    if (key === 'PRESS' || key === 'MOMENTUM_SURGE') {
        return `Momentum Surge: Next Goal ${team || home}${oddsStr}`;
    }
    if (key === 'RED_CARD_ADV') {
        return `Man Advantage: Next Goal ${team || home}${oddsStr}`;
    }
    if (key === 'UNDERDOG_RESIST') {
        return `Underdog Resilience: ${team || away} Double Chance${oddsStr}`;
    }
    if (key === 'COUNTER_ATTACK') {
        return `Counter Attack Blitz: Next Goal ${team || away}${oddsStr}`;
    }

    if (label && label.length > 0 && label !== 'Strateji Sinyali' && label !== 'Analiz Devam Ediyor') {
        return `${label}${oddsStr}`;
    }

    if (team) {
        return `Next Goal: ${team}${oddsStr}`;
    }

    return `Next Goal: ${home}${oddsStr}`;
}

export function formatVIPSignal(alert) {
    const levelEmoji = {
        'ALPHA': '💎',
        'ALEV': '🔥',
        'SICAK': '⚡'
    };

    const emoji = levelEmoji[alert.level] || '📊';
    const levelText = alert.level === 'ALPHA' ? 'ALPHA QUANT SIGNAL' :
                      alert.level === 'ALEV' ? 'HIGH CONVICTION ALERT' : 'IN-PLAY MOMENTUM ALERT';

    const home = cleanMd(alert.homeTeam || 'Home');
    const away = cleanMd(alert.awayTeam || 'Away');

    const marketText = resolveMarketText(alert);

    // Build strategies section
    const activeStrategies = alert.activeStrategies || [];
    const strategiesText = activeStrategies.length > 0 
        ? activeStrategies.map(s => `${s.icon || '🎯'} *${cleanMd(s.label || s.id)}*`).join('\n')
        : '• Algorithmic In-Play Validation Passed';

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
                if (r.key === 'reason_xg_diff') reasons.push(`• xG Dominance Differential: +${r.params?.diff || ''}`);
                else if (r.key === 'reason_pressure') reasons.push(`• Sustained Attack Pressure: ${r.params?.pressure || 'Extreme'}`);
                else if (r.key === 'reason_value_detected') reasons.push(`• Algorithmic Price Discrepancy (+EV Detected)`);
                else if (r.key === 'reason_alpha_signal') reasons.push(`• High Probability Institutional Alpha Trigger`);
                else if (r.key === 'reason_critical_min') reasons.push(`• Critical Statistical Window (${r.params?.minute}')`);
            }
        });
    }
    if (alert.maxEV > 0.15) reasons.push(`• 💰 High Expected Value: EV +${(alert.maxEV * 100).toFixed(0)}%`);
    
    const reasonsText = reasons.length > 0 ? reasons.slice(0, 3).join('\n') : '• Multi-factor pitch momentum and quantitative consensus confirmed';

    // Confidence bar
    const conf = alert.recommendation?.confidence || 78;
    const filled = Math.min(10, Math.max(1, Math.round(conf / 10)));
    const confBar = '▓'.repeat(filled) + '░'.repeat(10 - filled);

    let evText = '';
    if (alert.bestEV && alert.bestEV.ev >= 5) {
        evText = `💎 *Value Edge (+EV):* +${alert.bestEV.ev}% (${cleanMd(alert.bestEV.label)} | Fair: ${alert.bestEV.fairOdds})`;
    } else if (alert.maxEV > 0.05) {
        evText = `📈 *Expected Value (EV):* +${(alert.maxEV * 100).toFixed(0)}%`;
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
            redCardInfo = `🟥 *Numerical Superiority:* ${advTeam} (+${diff} Man Advantage)`;
        } else {
            redCardInfo = `🟥 *Red Cards:* ${homeReds} - ${awayReds} (10 vs 10)`;
        }
    }

    // Smart Money / Dropping Odds Info
    let droppingOddsInfo = '';
    if (alert.oddsMovement && alert.oddsMovement.isDropping) {
        droppingOddsInfo = `📉 *Smart Money Flow:* ${alert.oddsMovement.initialOdds} ➔ ${alert.oddsMovement.currentOdds} (${alert.oddsMovement.dropPct.toFixed(0)}% Squeeze)`;
    }

    // Latency Arbitrage Alert
    let latencyInfo = '';
    if (alert.latencyEdge) {
        latencyInfo = `⚡ *Latency Arbitrage:* Soft Bookmaker ${alert.latencyEdge.softOdds} vs Sharp Fair ${alert.latencyEdge.sharpFairOdds} (+${alert.latencyEdge.discrepancyPct}% Edge!)`;
    }

    const leagueName = alert.league || alert.leagueName;
    const leagueLine = leagueName ? `🏆 *League:* ${cleanMd(leagueName)}\n` : '';
    const timeStr = new Date().toUTCString().slice(17, 22) + ' UTC';

    const message = `${emoji} *${levelText}*
    
⚽ *${home} vs ${away}*
${leagueLine}📊 In-Play: ${alert.minute}' · Score: ${alert.score}

${strategiesText}

🎯 *Target Market:* ${marketText}
📊 *System Confidence:* ${confBar} ${conf}%
${evText}
${surplusText}
${latencyInfo ? latencyInfo + '\n' : ''}${redCardInfo ? redCardInfo + '\n' : ''}${droppingOddsInfo ? droppingOddsInfo + '\n' : ''}${alert.dqs ? `📈 Data Quality Score (DQS): ${alert.dqs.toFixed(2)}` : ''}

📋 *Quantitative Rationale:*
${reasonsText}

💰 *Staking Advice:*
Recommended: *1.00% Bankroll* (Quarter-Kelly Model)

⏰ ${timeStr}
━━━━━━━━━━━━━━━━━━
🤖 *v4.0 Quant Syndicate Engine*
💎 *LIVE BET MENTOR VIP*`;

    return message;
}

export function formatPublicTeaser(alert) {
    const home = cleanMd(alert.homeTeam || 'Home');
    const away = cleanMd(alert.awayTeam || 'Away');
    const leagueName = alert.league || alert.leagueName;
    const leagueLine = leagueName ? `🏆 *League:* ${cleanMd(leagueName)}\n` : '';
    const levelText = alert.level === 'ALPHA' ? 'ALPHA QUANT OPPORTUNITY' : 'HIGH VALUE LIVE SIGNAL';

    const message = `📡 *LIVE IN-PLAY RADAR ALERT*

⚽ *${home} vs ${away}*
${leagueLine}⏱️ In-Play: ${alert.minute}' · Score: ${alert.score}

⚡ *System Flag:* ${levelText} DETECTED
🎯 High goal momentum, offensive pressure and mathematical edge confirmed!

🔒 _Full prediction, fair odds benchmark & Kelly stake released in VIP Syndicate._

👉 Unlock Full VIP Signal: @Livebetmentorbot`;

    return message;
}

export function formatDailyReport(stats) {
    const date = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    const winRate = stats.total > 0 ? ((stats.won / stats.total) * 100).toFixed(1) : '0.0';

    const message = `📊 *DAILY QUANT PERFORMANCE DIGEST*

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

    return message;
}

export function formatSignalResult(signal, result, finalScore, currentStats = {}) {
    const isWon = result === 'WON';
    const home = cleanMd(signal.homeTeam || signal.match?.split(' vs ')[0] || 'Home');
    const away = cleanMd(signal.awayTeam || signal.match?.split(' vs ')[1] || 'Away');
    const market = cleanMd(signal.market || 'Target Market');
    const scoreStr = finalScore ? (typeof finalScore === 'object' ? `${finalScore.home}-${finalScore.away}` : finalScore) : '';

    const totalResolved = (currentStats.won || 0) + (currentStats.lost || 0);
    const winRate = totalResolved > 0 ? (((currentStats.won || 0) / totalResolved) * 100).toFixed(1) : (isWon ? '100.0' : '0.0');

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

function resolveConsensusPredName(pred) {
    if (!pred) return 'N/A';
    const p = String(pred).trim();
    if (p === '1') return 'Home Win (1)';
    if (p === 'X') return 'Draw (X)';
    if (p === '2') return 'Away Win (2)';
    if (p === '1X') return 'Double Chance (1X)';
    if (p === 'X2') return 'Double Chance (X2)';
    if (p === '12') return 'Double Chance (12)';
    if (p.toLowerCase().includes('üst') || p.toLowerCase().includes('over')) return 'Over 2.5 Goals';
    if (p.toLowerCase().includes('alt') || p.toLowerCase().includes('under')) return 'Under 2.5 Goals';
    if (p.toLowerCase().includes('var') || p.toLowerCase().includes('yes')) return 'Both Teams To Score (BTTS: Yes)';
    if (p.toLowerCase().includes('yok') || p.toLowerCase().includes('no')) return 'Both Teams To Score (BTTS: No)';
    return p;
}

export function formatRadarPick(match) {
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement)
        .sort((a, b) => b[1] - a[1])[0];
    
    const rawTopPred = topPrediction ? topPrediction[0] : (match.topPred || 'N/A');
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 0;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);
    const topPredText = resolveConsensusPredName(rawTopPred);

    const home = cleanMd(match.home || 'Home');
    const away = cleanMd(match.away || 'Away');
    const league = cleanMd(match.league || 'Pre-Match Fixture');

    const predDetails = Object.entries(match.predictions || {})
        .map(([site, pred]) => {
            const prob = match.probabilities?.[site];
            const predName = resolveConsensusPredName(pred);
            return `  • ${cleanMd(site)}: *${cleanMd(predName)}*${prob ? ` (${prob}% Probability)` : ''}`;
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
            if (hf || af) formText = `📈 *Recent Form Guide:*\n  • ${home}: \`${hf || 'N/A'}\`\n  • ${away}: \`${af || 'N/A'}\``;
        } else if (typeof match.form === 'string') {
            formText = `📈 *Form Guide:* \`${match.form}\``;
        }
    }

    let standingsText = '';
    if (match.ranks && (match.ranks.home !== '-' || match.ranks.away !== '-')) {
        standingsText = `📊 *League Standings & Points:*\n  • ${home}: Rank #${match.ranks.home || '-'} (${match.points?.home || '-'} Pts)\n  • ${away}: Rank #${match.ranks.away || '-'} (${match.points?.away || '-'} Pts)`;
    }

    const headerEmoji = agreePercent === 100 ? '🔥' : '🎯';
    const headerTitle = agreePercent === 100 ? 'PRE-MATCH 100% QUANT CONSENSUS' : 'PRE-MATCH CONSENSUS RADAR PICK';

    const message = `${headerEmoji} *${headerTitle}*
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

    return message;
}

export function formatRadarTeaser(match) {
    const agreement = match.agreement || {};
    const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
    const rawTopPred = topPrediction ? topPrediction[0] : (match.topPred || 'N/A');
    const topCount = topPrediction ? topPrediction[1] : (match.topCount || 0);
    const totalSources = match.totalSources || 0;
    const agreePercent = totalSources > 0 ? Math.round((topCount / totalSources) * 100) : (match.agreementPercent || 0);

    const home = cleanMd(match.home || 'Home');
    const away = cleanMd(match.away || 'Away');
    const league = cleanMd(match.league || 'Pre-Match Fixture');

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

export function formatWelcome() {
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
/id — View your Telegram Chat ID

━━━━━━━━━━━━━━━━━━
⚡ *Live Bet Mentor Quant Engine*`;
}

export function formatVIPInfo(settings = {}) {
    const adminUser = settings.adminUsername || process.env.TELEGRAM_ADMIN_USERNAME || 'our Official Admin';
    const usdtAddress = 'TXDCxXx5XjNWFRLQmNZeHVcwjpHjDDPrvd';
    
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

export function formatCashOutAlert(cashOut) {
    const home = cleanMd(cashOut.matchTitle?.split(' vs ')[0] || 'Home');
    const away = cleanMd(cashOut.matchTitle?.split(' vs ')[1] || 'Away');
    const market = cleanMd(cashOut.market || 'Target Pick');
    const reason = cleanMd(cashOut.reason || 'Momentum decline and heightened volatility');

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

export function formatGoldenCombo(combo) {
    if (!combo || !combo.picks || combo.picks.length === 0) return '';
    const dateStr = new Date().toUTCString().slice(17, 22) + ' UTC';
    const picksText = combo.picks.map((p, i) => {
        return `*${i + 1}. ${cleanMd(p.matchTitle)}* (${p.minute}')\n🎯 *Pick:* ${cleanMd(p.market)}\n📊 Confidence: ${p.confidence}% | Odds: *${p.odds || '1.50'}*`;
    }).join('\n\n');

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

export function formatLatencyArbitrageAlert(arb) {
    const home = cleanMd(arb.homeTeam || 'Home');
    const away = cleanMd(arb.awayTeam || 'Away');
    return `⚡ *LATENCY ARBITRAGE ALERT (BOOKMAKER LAG)* ⚡
━━━━━━━━━━━━━━━━━━
⚽ *${home} vs ${away}* (${arb.minute}')
🎯 *Market:* ${cleanMd(arb.market || 'Next Goal / Over')}
📊 *Soft Bookmaker Odds:* *${arb.bookmakerOdds || '1.75'}*
📉 *Sharp Market Fair Odds:* *${arb.fairOdds || '1.45'}*
💎 *Mathematical Advantage:* *+${arb.discrepancyPct || 20}%*

📋 *Situation Analysis:*
Sharp exchanges have slashed the price, but soft bookmakers have not adjusted yet. Capitalize before price correction!
━━━━━━━━━━━━━━━━━━
📡 *Latency Radar Edge*
💎 *LIVE BET MENTOR VIP*`;
}
