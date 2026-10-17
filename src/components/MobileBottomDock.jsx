import React from 'react';
import { triggerHaptic } from '../utils/haptics';

export const MobileBottomDock = ({
    currentView = 'TERMINAL',
    onSelectView = () => {},
    activeCategoryFilter = 'ALL',
    onSelectFilter = () => {},
    hotMatchesCount = 0,
    openMatchesCount = 0,
    lang = 'tr'
}) => {
    const isTerminal = currentView === 'TERMINAL' && activeCategoryFilter !== 'HOT';
    const isHotActive = currentView === 'TERMINAL' && activeCategoryFilter === 'HOT';
    const isRadar = currentView === 'RADAR' || currentView === 'SHARP_PICKS';
    const isPortfolio = currentView === 'PORTFOLIO';

    const handleTabClick = (tabKey) => {
        if (tabKey === 'HOT') {
            triggerHaptic('flame');
            onSelectView('TERMINAL');
            onSelectFilter('HOT');
        } else if (tabKey === 'TERMINAL') {
            triggerHaptic('light');
            onSelectView('TERMINAL');
            onSelectFilter('ALL');
        } else {
            triggerHaptic('light');
            onSelectView(tabKey);
        }
    };

    return (
        <nav
            aria-label="Mobile Navigation Dock"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'calc(62px + env(safe-area-inset-bottom, 0px))',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: 'rgba(10, 14, 23, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                zIndex: 9999,
                boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.45)'
            }}
        >
            {/* 1. Canlı Terminal */}
            <button
                onClick={() => handleTabClick('TERMINAL')}
                style={{
                    background: 'none',
                    border: 'none',
                    color: isTerminal ? '#38bdf8' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    minWidth: '60px'
                }}
            >
                <span style={{ fontSize: '1.2rem' }}>⚡</span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isTerminal ? 800 : 600,
                    letterSpacing: '-0.2px'
                }}>
                    {lang === 'tr' ? 'Terminal' : 'Terminal'}
                </span>
                {isTerminal && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '16px',
                        height: '2px',
                        background: '#38bdf8',
                        borderRadius: '2px',
                        boxShadow: '0 0 8px #38bdf8'
                    }} />
                )}
            </button>

            {/* 2. 🔥 Alev Alanlar */}
            <button
                onClick={() => handleTabClick('HOT')}
                style={{
                    background: isHotActive ? 'rgba(249, 115, 22, 0.12)' : 'none',
                    border: isHotActive ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid transparent',
                    borderRadius: '12px',
                    color: isHotActive ? '#f97316' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    minWidth: '64px'
                }}
            >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <span style={{ fontSize: '1.25rem' }}>🔥</span>
                    {hotMatchesCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-10px',
                            background: '#ef4444',
                            color: '#fff',
                            fontSize: '0.55rem',
                            fontWeight: 900,
                            padding: '1px 4px',
                            borderRadius: '10px',
                            minWidth: '14px',
                            textAlign: 'center',
                            boxShadow: '0 0 6px rgba(239, 68, 68, 0.8)'
                        }}>
                            {hotMatchesCount}
                        </span>
                    )}
                </div>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isHotActive ? 900 : 600,
                    letterSpacing: '-0.2px',
                    color: isHotActive ? '#ffedd5' : '#94a3b8'
                }}>
                    {lang === 'tr' ? 'Alev Alanlar' : (lang === 'de' ? 'Flammen' : 'Hot Picks')}
                </span>
            </button>

            {/* 3. 🎯 Radar / Sıcak Seçimler */}
            <button
                onClick={() => handleTabClick('RADAR')}
                style={{
                    background: 'none',
                    border: 'none',
                    color: isRadar ? '#10b981' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    minWidth: '60px'
                }}
            >
                <span style={{ fontSize: '1.2rem' }}>🎯</span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isRadar ? 800 : 600,
                    letterSpacing: '-0.2px'
                }}>
                    {lang === 'tr' ? 'Radar' : 'Radar'}
                </span>
                {isRadar && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '16px',
                        height: '2px',
                        background: '#10b981',
                        borderRadius: '2px',
                        boxShadow: '0 0 8px #10b981'
                    }} />
                )}
            </button>

            {/* 4. 💼 Kasa & Portföy */}
            <button
                onClick={() => handleTabClick('PORTFOLIO')}
                style={{
                    background: 'none',
                    border: 'none',
                    color: isPortfolio ? '#a78bfa' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    minWidth: '60px'
                }}
            >
                <span style={{ fontSize: '1.2rem' }}>💼</span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isPortfolio ? 800 : 600,
                    letterSpacing: '-0.2px'
                }}>
                    {lang === 'tr' ? 'Kasa' : (lang === 'de' ? 'Kassa' : 'Bankroll')}
                </span>
                {isPortfolio && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '16px',
                        height: '2px',
                        background: '#a78bfa',
                        borderRadius: '2px',
                        boxShadow: '0 0 8px #a78bfa'
                    }} />
                )}
            </button>
        </nav>
    );
};
