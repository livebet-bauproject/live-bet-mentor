import React from 'react';
import { triggerHaptic } from '../utils/haptics';

export const MobileBottomDock = ({
    currentView = 'DASHBOARD',
    onSelectView = () => {},
    activeCategoryFilter = 'ALL',
    onSelectFilter = () => {},
    hotMatchesCount = 0,
    openMatchesCount = 0,
    lang = 'tr',
    onToggleMenu = () => {},
    isMenuOpen = false,
    isAdmin = false
}) => {
    const isLiveActive = (currentView === 'DASHBOARD' || currentView === 'TERMINAL') && activeCategoryFilter !== 'HOT' && !isMenuOpen;
    const isHotActive = (currentView === 'DASHBOARD' || currentView === 'TERMINAL') && activeCategoryFilter === 'HOT' && !isMenuOpen;
    const isRadarActive = (currentView === 'RADAR' || currentView === 'SHARP_PICKS') && !isMenuOpen;
    const isPortfolioActive = currentView === 'PORTFOLIO' && !isMenuOpen;

    const handleTabClick = (tabKey) => {
        if (isMenuOpen && tabKey !== 'MENU') {
            onToggleMenu();
        }

        if (tabKey === 'HOT') {
            triggerHaptic('flame');
            onSelectView('DASHBOARD');
            onSelectFilter('HOT');
        } else if (tabKey === 'TERMINAL') {
            triggerHaptic('light');
            onSelectView('DASHBOARD');
            onSelectFilter('ALL');
        } else if (tabKey === 'MENU') {
            triggerHaptic('light');
            onToggleMenu();
        } else {
            triggerHaptic('light');
            onSelectView(tabKey);
        }
    };

    return (
        <nav
            className="mobile-bottom-dock"
            aria-label={lang === 'tr' ? 'Mobil Gezinme Menüsü' : (lang === 'de' ? 'Mobile Navigation' : 'Mobile Navigation Dock')}
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                background: 'rgba(8, 13, 24, 0.96)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(56, 189, 248, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-around',
                zIndex: 10001,
                boxShadow: '0 -8px 28px rgba(0, 0, 0, 0.7), 0 -1px 8px rgba(56, 189, 248, 0.12)'
            }}
        >
            {/* 1. ⚡ Canlı Terminal */}
            <button
                type="button"
                onClick={() => handleTabClick('TERMINAL')}
                style={{
                    background: isLiveActive ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                    border: 'none',
                    borderRadius: '10px',
                    color: isLiveActive ? '#38bdf8' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    flex: '1 1 0',
                    maxWidth: '72px',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                }}
            >
                <span style={{ fontSize: '1.25rem', lineHeight: '1.25rem' }}>⚡</span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isLiveActive ? 800 : 600,
                    letterSpacing: '-0.2px'
                }}>
                    {lang === 'tr' ? 'Canlı' : 'Live'}
                </span>
                {isLiveActive && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '20px',
                        height: '2.5px',
                        background: '#38bdf8',
                        borderRadius: '2px',
                        boxShadow: '0 0 10px #38bdf8'
                    }} />
                )}
            </button>

            {/* 2. 🔥 Alev Alanlar */}
            <button
                type="button"
                onClick={() => handleTabClick('HOT')}
                style={{
                    background: isHotActive ? 'rgba(249, 115, 22, 0.14)' : 'transparent',
                    border: isHotActive ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid transparent',
                    borderRadius: '10px',
                    color: isHotActive ? '#f97316' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    flex: '1 1 0',
                    maxWidth: '74px',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                }}
            >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <span style={{ fontSize: '1.25rem', lineHeight: '1.25rem' }}>🔥</span>
                    {hotMatchesCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: '-5px',
                            right: '-11px',
                            background: 'linear-gradient(135deg, #ef4444, #f97316)',
                            color: '#fff',
                            fontSize: '0.55rem',
                            fontWeight: 900,
                            padding: '1px 4px',
                            borderRadius: '10px',
                            minWidth: '14px',
                            textAlign: 'center',
                            boxShadow: '0 0 8px rgba(239, 68, 68, 0.9)'
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
                    {lang === 'tr' ? 'Alev Alan' : (lang === 'de' ? 'Heiße Picks' : 'Hot Picks')}
                </span>
                {isHotActive && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '20px',
                        height: '2.5px',
                        background: '#f97316',
                        borderRadius: '2px',
                        boxShadow: '0 0 10px #f97316'
                    }} />
                )}
            </button>

            {/* 3. 🎯 Günlük Radar */}
            <button
                type="button"
                onClick={() => handleTabClick('RADAR')}
                style={{
                    background: isRadarActive ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                    border: 'none',
                    borderRadius: '10px',
                    color: isRadarActive ? '#10b981' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    flex: '1 1 0',
                    maxWidth: '72px',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                }}
            >
                <span style={{ fontSize: '1.25rem', lineHeight: '1.25rem' }}>🎯</span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isRadarActive ? 800 : 600,
                    letterSpacing: '-0.2px'
                }}>
                    {lang === 'tr' ? 'Radar' : 'Radar'}
                </span>
                {isRadarActive && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '20px',
                        height: '2.5px',
                        background: '#10b981',
                        borderRadius: '2px',
                        boxShadow: '0 0 10px #10b981'
                    }} />
                )}
            </button>

            {/* 4. 💼 Kasa & Portföy */}
            <button
                type="button"
                onClick={() => handleTabClick('PORTFOLIO')}
                style={{
                    background: isPortfolioActive ? 'rgba(167, 139, 250, 0.08)' : 'transparent',
                    border: 'none',
                    borderRadius: '10px',
                    color: isPortfolioActive ? '#a78bfa' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    flex: '1 1 0',
                    maxWidth: '72px',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                }}
            >
                <span style={{ fontSize: '1.25rem', lineHeight: '1.25rem' }}>💼</span>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isPortfolioActive ? 800 : 600,
                    letterSpacing: '-0.2px'
                }}>
                    {lang === 'tr' ? 'Kasa' : (lang === 'de' ? 'Kassa' : 'Bankroll')}
                </span>
                {isPortfolioActive && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '20px',
                        height: '2.5px',
                        background: '#a78bfa',
                        borderRadius: '2px',
                        boxShadow: '0 0 10px #a78bfa'
                    }} />
                )}
            </button>

            {/* 5. ☰ Hızlı Menü & Araçlar */}
            <button
                type="button"
                onClick={() => handleTabClick('MENU')}
                style={{
                    background: isMenuOpen ? 'rgba(56, 189, 248, 0.16)' : 'transparent',
                    border: isMenuOpen ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                    borderRadius: '10px',
                    color: isMenuOpen ? '#38bdf8' : '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    flex: '1 1 0',
                    maxWidth: '72px',
                    position: 'relative',
                    transition: 'all 0.15s ease'
                }}
                aria-label={isMenuOpen ? (lang === 'tr' ? 'Menüyü Kapat' : (lang === 'de' ? 'Menü schließen' : 'Close Menu')) : (lang === 'tr' ? 'Hızlı Menü' : (lang === 'de' ? 'Schnellmenü' : 'Quick Menu'))}
            >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <span style={{ fontSize: '1.2rem', lineHeight: '1.25rem', fontWeight: 900 }}>
                        {isMenuOpen ? '✕' : '☰'}
                    </span>
                    {isAdmin && (
                        <span style={{
                            position: 'absolute',
                            top: '-3px',
                            right: '-6px',
                            background: '#f59e0b',
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            boxShadow: '0 0 6px #f59e0b'
                        }} />
                    )}
                </div>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isMenuOpen ? 800 : 600,
                    letterSpacing: '-0.2px',
                    color: isMenuOpen ? '#38bdf8' : '#94a3b8'
                }}>
                    {isMenuOpen 
                        ? (lang === 'tr' ? 'Kapat' : (lang === 'de' ? 'Schließen' : 'Close'))
                        : (lang === 'tr' ? 'Menü' : (lang === 'de' ? 'Menü' : 'Menu'))}
                </span>
                {isMenuOpen && (
                    <span style={{
                        position: 'absolute',
                        top: 0,
                        width: '20px',
                        height: '2.5px',
                        background: '#38bdf8',
                        borderRadius: '2px',
                        boxShadow: '0 0 10px #38bdf8'
                    }} />
                )}
            </button>
        </nav>
    );
};
