import React from 'react';
import { liveMatchFollower } from '../utils/liveMatchFollower.js';
import { triggerHaptic } from '../utils/haptics.js';

export const PinnedMatchHUD = ({ fixtures = [], onOpenCopilot, onOpenPaperBet, onUnpin, lang = 'tr' }) => {
    const pinnedId = liveMatchFollower.getPinnedMatchId();
    if (!pinnedId || !fixtures || fixtures.length === 0) return null;

    const match = fixtures.find(f => String(f.id || f.matchId) === pinnedId);
    if (!match) return null;

    const defaultHome = lang === 'tr' ? 'Ev Sahibi' : (lang === 'de' ? 'Heimteam' : 'Home Team');
    const defaultAway = lang === 'tr' ? 'Deplasman' : (lang === 'de' ? 'Auswärtsteam' : 'Away Team');
    const home = match.homeTeam || match.home?.name || defaultHome;
    const away = match.awayTeam || match.away?.name || defaultAway;
    const score = match.score || { home: 0, away: 0 };
    const minute = match.minute || 0;
    const pressure = Number(match.observations?.pressure?.total || match.pressure?.total || 0);
    const isFlame = pressure >= 75;

    const handleUnpin = (e) => {
        e.stopPropagation();
        liveMatchFollower.togglePin(match, lang);
        if (typeof onUnpin === 'function') onUnpin();
        triggerHaptic('light');
    };

    return (
        <div className="pinned-match-hud" style={{
            position: 'fixed',
            bottom: '72px', // Clears the mobile bottom dock
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 8888,
            width: 'calc(100% - 24px)',
            maxWidth: '480px',
            background: 'linear-gradient(135deg, rgba(13, 21, 39, 0.95), rgba(10, 14, 26, 0.98))',
            border: isFlame ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(56, 189, 248, 0.4)',
            boxShadow: isFlame
                ? '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(239, 68, 68, 0.25)'
                : '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.2)',
            borderRadius: '14px',
            padding: '10px 14px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            {/* Match info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.85rem' }}>📌</span>
                    <strong style={{
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {home} vs {away}
                    </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: '0.9rem' }}>
                        {score.home} - {score.away}
                    </span>
                    <span>•</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>{minute}'</span>
                    <span>•</span>
                    <span style={{ color: isFlame ? '#ef4444' : '#38bdf8', fontWeight: 700 }}>
                        {isFlame ? `🔥 ${pressure}/100` : `⚡ ${pressure}/100`}
                    </span>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                    onClick={() => {
                        triggerHaptic('medium');
                        if (typeof onOpenCopilot === 'function') onOpenCopilot(match);
                    }}
                    style={{
                        background: 'rgba(56, 189, 248, 0.2)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                    }}
                    title={lang === 'tr' ? 'AI Canlı Asistanı' : (lang === 'de' ? 'KI-Copilot' : 'AI Copilot')}
                >
                    🤖 {lang === 'tr' ? 'Asistan' : (lang === 'de' ? 'Assistent' : 'Copilot')}
                </button>

                <button
                    onClick={handleUnpin}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        padding: '4px 6px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                    title={lang === 'tr' ? 'Takipten Çıkar' : (lang === 'de' ? 'Entpinnen' : 'Unpin')}
                >
                    ✕
                </button>
            </div>
        </div>
    );
};
