import React, { useMemo, useState } from 'react';
import { calculateMatchHeatScore } from '../logic/liveSortEngine';

const resolveTeamName = (team, fallback = '') => {
    if (!team) return fallback;
    if (typeof team === 'string') return team.trim();
    if (typeof team === 'object' && team.name) return String(team.name).trim();
    return fallback;
};

export const OneGlanceFireCard = ({
    matches = [],
    opportunitiesMap = null,
    onSelectMatch = () => {},
    onOpenCopilot = () => {},
    onOpenPaperBet = () => {},
    onTogglePin = () => {},
    pinnedMatchId = null,
    lang = 'tr'
}) => {
    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            return localStorage.getItem('hide_one_glance_fire') === 'true';
        } catch (e) {
            return false;
        }
    });

    const toggleCollapse = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            try {
                localStorage.setItem('hide_one_glance_fire', String(next));
            } catch (e) {}
            return next;
        });
    };

    // Find top 1-3 hottest active matches
    const hotMatches = useMemo(() => {
        if (!Array.isArray(matches) || matches.length === 0) return [];

        const candidates = matches.map(m => {
            const opp = opportunitiesMap instanceof Map ? opportunitiesMap.get(m.id) : null;
            const heat = opp?.score || calculateMatchHeatScore(m);
            const isAlev = opp?.level === 'ALEV' || heat >= 75;
            
            // Generate concise "Neden Oyna?" explanation in user language
            let reason = '';
            const s = m.stats || {};
            const hSot = s.shotsOnGoal?.home || 0;
            const aSot = s.shotsOnGoal?.away || 0;
            const hPoss = s.possession?.home || 50;
            const aPoss = s.possession?.away || 50;
            const hRed = s.cards?.home?.red || 0;
            const aRed = s.cards?.away?.red || 0;

            const homeLabel = resolveTeamName(m.homeTeam) || resolveTeamName(m.home) || m.homeTeamName || (isTr ? 'Ev Sahibi' : (isDe ? 'Heim' : 'Home'));
            const awayLabel = resolveTeamName(m.awayTeam) || resolveTeamName(m.away) || m.awayTeamName || (isTr ? 'Deplasman' : (isDe ? 'Auswärts' : 'Away'));

            if (hRed > 0 || aRed > 0) {
                const redSide = hRed > 0 ? homeLabel : awayLabel;
                if (isTr) reason = `${redSide} 10 kişi kaldı. Sayısal avantajla tek kale hücum baskısı kuruldu.`;
                else if (isDe) reason = `${redSide} mit Roter Karte (10 Mann). Überzahl sorgt für dauerhaften Belagerungszustand.`;
                else reason = `${redSide} down to 10 men. Numerical advantage creating one-sided siege.`;
            } else if (hPoss >= 62 || aPoss >= 62) {
                const dominant = hPoss >= 62 ? homeLabel : awayLabel;
                const maxP = Math.max(hPoss, aPoss);
                if (isTr) reason = `${dominant} %${maxP} topla oynama ve yoğun ceza sahası ablukası uyguluyor.`;
                else if (isDe) reason = `${dominant} dominiert mit ${maxP}% Ballbesitz und Dauerdruck im Strafraum.`;
                else reason = `${dominant} dominating with ${maxP}% possession and persistent box presence.`;
            } else if ((hSot + aSot) >= 6) {
                const totalSot = hSot + aSot;
                if (isTr) reason = `Karşılıklı tempolu hücumlar ve kaleyi bulan ${totalSot} isabetli şut ile gol kokuyor.`;
                else if (isDe) reason = `Offener Schlagabtausch mit ${totalSot} Torschüssen; Tor liegt in der Luft.`;
                else reason = `High-tempo exchange with ${totalSot} shots on target; heavy goal scent.`;
            } else {
                if (isTr) reason = opp?.recommendation?.reasoning?.[0] || 'Son 10 dakikada vites yükseldi, gol beklentisi ve ceza sahası baskısı zirvede.';
                else if (isDe) reason = 'Tempo in den letzten 10 Minuten massiv angezogen; Höchstwert bei Torgefahr.';
                else reason = 'Tempo surged in the last 10 minutes; peak box pressure and goal probability.';
            }

            // Stake recommendation based on confidence
            const confidence = opp?.confidence || heat;
            let stakeText = isTr ? "Kasanın %1.5'i (1 Ünite)" : (isDe ? '1,5% des Kapitals (1 Einheit)' : '1.5% of Bankroll (1 Unit)');
            if (confidence >= 85) {
                stakeText = isTr ? "Kasanın %2.5'i (2 Ünite) · Yüksek Güven" : (isDe ? '2,5% des Kapitals (2 Einheiten) · Hohes Vertrauen' : '2.5% of Bankroll (2 Units) · High Confidence');
            } else if (confidence >= 78) {
                stakeText = isTr ? "Kasanın %2.0'si (1.5 Ünite) · Standart" : (isDe ? '2,0% des Kapitals (1,5 Einheiten) · Standard' : '2.0% of Bankroll (1.5 Units) · Standard');
            }

            return {
                match: m,
                heat,
                isAlev,
                opp,
                reason,
                stakeText
            };
        });

        // Filter and sort by heat
        return candidates
            .filter(c => c.isAlev && c.match.status?.type === 'inprogress')
            .sort((a, b) => b.heat - a.heat)
            .slice(0, 3);
    }, [matches, opportunitiesMap]);

    if (hotMatches.length === 0) return null;

    if (isCollapsed) {
        return (
            <div
                onClick={toggleCollapse}
                title={lang === 'tr' ? 'Alevli Maçlar Panelini Genişlet' : 'Expand Hot Matches Panel'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(249, 115, 22, 0.04), rgba(15, 23, 42, 0.6))',
                    border: '1px solid rgba(249, 115, 22, 0.25)',
                    borderRadius: '10px',
                    padding: '0.5rem 1rem',
                    marginBottom: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#ffedd5', fontWeight: 800 }}>
                    <span style={{ fontSize: '1rem' }}>🔥</span>
                    <span>{lang === 'tr' ? 'TEK BAKIŞTA ALEV ALANLAR' : 'ONE-GLANCE FIRE RADAR'}</span>
                    <span style={{ fontSize: '0.65rem', background: '#f97316', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 900 }}>
                        {hotMatches.length} {lang === 'tr' ? 'Maç' : 'Matches'}
                    </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                    <span>{lang === 'tr' ? 'Genişlet ▾' : 'Expand ▾'}</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(249, 115, 22, 0.06), rgba(15, 23, 42, 0.8))',
            border: '1px solid rgba(249, 115, 22, 0.35)',
            borderRadius: '16px',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 32px rgba(249, 115, 22, 0.15)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Header Banner */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.85rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '0.65rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{
                        fontSize: '1.25rem',
                        animation: 'pulse 1.5s infinite',
                        display: 'inline-block'
                    }}>🔥</span>
                    <div>
                        <div style={{
                            fontSize: '0.95rem',
                            fontWeight: 900,
                            letterSpacing: '-0.3px',
                            color: '#ffedd5',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}>
                            {lang === 'tr' ? 'TEK BAKIŞTA ALEV ALANLAR' : (lang === 'de' ? 'FLAMMEN-RADAR' : 'ONE-GLANCE FIRE RADAR')}
                            <span style={{
                                fontSize: '0.6rem',
                                background: 'linear-gradient(135deg, #f97316, #ef4444)',
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 800
                            }}>{lang === 'tr' ? 'CANLI' : 'LIVE'}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {lang === 'tr' 
                                ? 'Şu an sahada baskısı ve gol beklentisi tavan yapan anlık fırsatlar' 
                                : (lang === 'de'
                                    ? 'Höchster Offensivdruck und akute Tor-Gelegenheiten in Echtzeit'
                                    : 'Highest offensive pressure and live surge opportunities')}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        fontSize: '0.7rem',
                        color: '#f97316',
                        fontWeight: 700,
                        background: 'rgba(249, 115, 22, 0.12)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(249, 115, 22, 0.3)'
                    }}>
                        {hotMatches.length} {lang === 'tr' ? 'Maç Alevli' : (lang === 'de' ? 'Spiele heiß' : 'Hot Matches')}
                    </div>
                    <button
                        onClick={toggleCollapse}
                        title={lang === 'tr' ? 'Paneli Küçült / Gizle' : 'Collapse Panel'}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#f97316'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
                    >
                        ✕ {lang === 'tr' ? 'Gizle' : 'Hide'}
                    </button>
                </div>
            </div>

            {/* Match Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: hotMatches.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.85rem'
            }}>
                {hotMatches.map(({ match, heat, opp, reason, stakeText }) => {
                    const homeName = resolveTeamName(match.homeTeam) || resolveTeamName(match.home) || match.homeTeamName || (lang === 'tr' ? 'Ev Sahibi' : (lang === 'de' ? 'Heim' : 'Home'));
                    const awayName = resolveTeamName(match.awayTeam) || resolveTeamName(match.away) || match.awayTeamName || (lang === 'tr' ? 'Deplasman' : (lang === 'de' ? 'Ausw.' : 'Away'));
                    const minute = match.minute ? `${match.minute}'` : (lang === 'tr' ? 'Canlı' : 'LIVE');
                    const score = match.score ? `${match.score.home ?? 0} - ${match.score.away ?? 0}` : '0 - 0';
                    const odds = opp?.recommendation?.odds;
                    const isRealOdds = opp?.recommendation?.isRealOdds;
                    const marketLabel = opp?.recommendation?.marketLabel || (lang === 'tr' ? 'Canlı Fırsat' : (lang === 'de' ? 'Live-Chance' : 'Live Opportunity'));

                    return (
                        <div
                            key={match.id}
                            onClick={() => onSelectMatch(match)}
                            style={{
                                background: 'rgba(15, 23, 42, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                padding: '0.85rem 1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#f97316'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                        >
                            {/* Match Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    color: '#38bdf8',
                                    background: 'rgba(56, 189, 248, 0.12)',
                                    padding: '2px 6px',
                                    borderRadius: '4px'
                                }}>
                                    ⏱️ {minute}
                                </span>
                                <span style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 900,
                                    color: '#f8fafc',
                                    letterSpacing: '0.5px'
                                }}>
                                    {score}
                                </span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    color: '#f97316',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                }}>
                                    🔥 %{heat}
                                </span>
                            </div>

                            {/* Teams */}
                            <div style={{
                                fontSize: '0.9rem',
                                fontWeight: 800,
                                color: '#f1f5f9',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {homeName} <span style={{ color: '#64748b' }}>vs</span> {awayName}
                            </div>

                            {/* Neden Oyna? (AI Gerekçe) */}
                            <div style={{
                                fontSize: '0.75rem',
                                color: '#cbd5e1',
                                background: 'rgba(255, 255, 255, 0.03)',
                                padding: '0.4rem 0.6rem',
                                borderRadius: '6px',
                                borderLeft: '3px solid #f97316',
                                lineHeight: '1.3'
                            }}>
                                💡 <strong style={{ color: '#f97316' }}>{lang === 'tr' ? 'Gerekçe:' : (lang === 'de' ? 'Begründung:' : 'Rationale:')}</strong> {reason}
                            </div>

                            {/* Bottom Footer: Market, Stake, Odds */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginTop: '0.2rem',
                                paddingTop: '0.4rem',
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                fontSize: '0.72rem'
                            }}>
                                <span style={{ color: '#10b981', fontWeight: 700 }}>
                                    🎯 {marketLabel}
                                </span>
                                <span style={{ color: '#94a3b8' }}>
                                    {isRealOdds && odds 
                                        ? (lang === 'tr' ? `Global Oran: ${Number(odds).toFixed(2)}` : (lang === 'de' ? `Globale Quote: ${Number(odds).toFixed(2)}` : `Global Odds: ${Number(odds).toFixed(2)}`))
                                        : (lang === 'tr' ? 'Oran Bekleniyor' : (lang === 'de' ? 'Quote ausstehend' : 'Awaiting Odds'))}
                                </span>
                            </div>

                            {/* Staking Guide */}
                            <div style={{
                                fontSize: '0.68rem',
                                color: '#a78bfa',
                                background: 'rgba(167, 139, 250, 0.08)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                textAlign: 'center',
                                fontWeight: 600
                            }}>
                                🛡️ {stakeText}
                            </div>

                            {/* Quick 1-Click Action Buttons */}
                            <div style={{
                                display: 'flex',
                                gap: '6px',
                                marginTop: '0.35rem'
                            }}>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenCopilot(match);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '5px 0',
                                        borderRadius: '6px',
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        color: '#38bdf8',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🤖 {lang === 'tr' ? 'Asistan' : (lang === 'de' ? 'Assistent' : 'Copilot')}
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenPaperBet(match);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '5px 0',
                                        borderRadius: '6px',
                                        background: 'rgba(245, 158, 11, 0.15)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        color: '#f59e0b',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    🧪 {lang === 'tr' ? 'Kupon' : (lang === 'de' ? 'Schein' : 'Paper Bet')}
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTogglePin(match);
                                    }}
                                    style={{
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        background: String(pinnedMatchId) === String(match.id) ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                        border: String(pinnedMatchId) === String(match.id) ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                                        color: String(pinnedMatchId) === String(match.id) ? '#22c55e' : '#94a3b8',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer'
                                    }}
                                    title={lang === 'tr' ? 'Kilit Ekranı / Canlı Takip' : (lang === 'de' ? 'Sperrbildschirm / Live-Aktivität' : 'Lock-Screen / Live Activity')}
                                >
                                    📌
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
