import React, { useState, useEffect } from 'react';

const DE_TO_TR_TEAMS = {
    'Türkei': 'Türkiye',
    'Frankreich': 'Fransa',
    'Italien': 'İtalya',
    'Belgien': 'Belçika',
    'Montenegro': 'Karadağ',
    'Zypern': 'Kıbrıs',
    'Ungarn': 'Macaristan',
    'Ukraine': 'Ukrayna',
    'Marokko': 'Fas',
    'Gabun': 'Gabon',
    'Ägypten': 'Mısır',
    'Angola': 'Angola',
    'Slowenien': 'Slovenya',
    'Schottland': 'İskoçya',
    'Algerien': 'Cezayir',
    'Sambia': 'Zambiya',
    'England': 'İngiltere',
    'Kasachstan': 'Kazakistan',
    'Deutschland': 'Almanya',
    'Spanien': 'İspanya',
    'Niederlande': 'Hollanda',
    'Portugal': 'Portekiz',
    'Kroatien': 'Hırvatistan',
    'Dänemark': 'Danimarka',
    'Schweden': 'İsveç',
    'Schweiz': 'İsviçre',
    'Polen': 'Polonya',
    'Serbien': 'Sırbistan',
    'Bosnien': 'Bosna Hersek',
    'Bosnien und Herzegowina': 'Bosna Hersek',
    'Albanien': 'Arnavutluk',
    'Griechenland': 'Yunanistan',
    'Tschechien': 'Çekya',
    'Slowakei': 'Slovakya',
    'Rumänien': 'Romanya',
    'Bulgarien': 'Bulgaristan',
    'Österreich': 'Avusturya',
    'Norwegen': 'Norveç',
    'Finnland': 'Finlandiya',
    'Island': 'İzlanda',
    'Irland': 'İrlanda',
    'Nordirland': 'Kuzey İrlanda',
    'Wales': 'Galler',
    'Georgien': 'Gürcistan',
    'Armenien': 'Ermenistan',
    'Aserbaidschan': 'Azerbaycan',
    'Israel': 'İsrail',
    'Saudi-Arabien': 'Suudi Arabistan',
    'Katar': 'Katar',
    'Vereinigte Arabische Emirate': 'BAE',
    'Iran': 'İran',
    'Irak': 'Irak',
    'Japan': 'Japonya',
    'Südkorea': 'Güney Kore',
    'Australien': 'Avustralya',
    'USA': 'ABD',
    'Mexiko': 'Meksika',
    'Kanada': 'Kanada',
    'Brasilien': 'Brezilya',
    'Argentinien': 'Arjantin',
    'Kolombien': 'Kolombiya',
    'Uruguay': 'Uruguay',
    'Chile': 'Şili',
    'Peru': 'Peru',
    'Ecuador': 'Ekvador',
    'Paraguay': 'Paraguay',
    'Venezuela': 'Venezuela',
    'Bolivien': 'Bolivya',
    'Südafrika': 'Güney Afrika',
    'Nigeria': 'Nijerya',
    'Senegal': 'Senegal',
    'Kamerun': 'Kamerun',
    'Ghana': 'Gana',
    'Elfenbeinküste': 'Fildişi Sahili',
    'Tunesien': 'Tunus',
    'Mali': 'Mali',
    'Burkina Faso': 'Burkina Faso',
    'Kongo': 'Kongo',
    'DR Kongo': 'Kongo DC',
    'Guinea': 'Gine',
    'Kap Verde': 'Yeşil Burun Adaları',
    'Madagaskar': 'Madagaskar',
    'Mosambik': 'Mozambik',
    'Benin': 'Benin',
    'Togo': 'Togo',
    'Uganda': 'Uganda',
    'Kenia': 'Kenya',
    'Tansania': 'Tanzanya',
    'Simbabwe': 'Zimbabve',
    'Sudan': 'Sudan',
    'Libyen': 'Libya',
    'Nordmazedonien': 'Kuzey Makedonya',
    'Kosovo': 'Kosova',
    'Moldawien': 'Moldova',
    'Litauen': 'Litvanya',
    'Lettland': 'Letonya',
    'Estland': 'Estonya',
    'Luxemburg': 'Lüksemburg',
    'Malta': 'Malta',
    'Andorra': 'Andorra',
    'San Marino': 'San Marino',
    'Gibraltar': 'Cebelitarık',
    'Liechtenstein': 'Lihtenştayn',
    'Färöer': 'Faroe Adaları',
    'Usbekistan': 'Özbekistan',
    'Jordanien': 'Ürdün',
    'Bayern München': 'Bayern Münih',
    'Roter Stern Belgrad': 'Kızılyıldız',
    'Sporting Lissabon': 'Sporting Lizbon',
    'Inter Mailand': 'Inter',
    'AC Mailand': 'Milan',
    'Juventus Turin': 'Juventus'
};

const DE_TO_TR_LEAGUES = {
    'Nations League A': 'UEFA Uluslar Ligi A',
    'Nations League B': 'UEFA Uluslar Ligi B',
    'Nations League C': 'UEFA Uluslar Ligi C',
    'Nations League D': 'UEFA Uluslar Ligi D',
    'UEFA Nations League': 'UEFA Uluslar Ligi',
    'Afrika Cup Der Nationen - Qualifikationsspiele': 'Afrika Uluslar Kupası Elemeleri',
    'Afrika Cup der Nationen - Qualifikation': 'Afrika Uluslar Kupası Elemeleri',
    'Afrika Cup': 'Afrika Uluslar Kupası',
    'Europäische Meisterschaft - Qualifikationsspiele U21': 'Avrupa U21 Şampiyonası Elemeleri',
    'Europäische Meisterschaft - Qualifikationsspiele': 'Avrupa Şampiyonası Elemeleri',
    'Europameisterschaft - Qualifikation': 'Avrupa Şampiyonası Elemeleri',
    'Weltmeisterschaft - Qualifikation': 'Dünya Kupası Elemeleri',
    'Champions League': 'UEFA Şampiyonlar Ligi',
    'Europa League': 'UEFA Avrupa Ligi',
    'Conference League': 'UEFA Konferans Ligi',
    'Freundschaftsspiele': 'Hazırlık Maçları',
    'Internationale Freundschaftsspiele': 'Uluslararası Hazırlık Maçları',
    'Premier League': 'İngiltere Premier Lig',
    'LaLiga': 'İspanya La Liga',
    'Serie A': 'İtalya Serie A',
    'Bundesliga': 'Almanya Bundesliga',
    '2. Bundesliga': 'Almanya 2. Bundesliga',
    'Ligue 1': 'Fransa Ligue 1',
    'Süper Lig': 'Trendyol Süper Lig'
};

const DE_TO_TR_MARKETS = {
    'Endergebnis SuperQuoten': 'Maç Sonucu (Süper Oran)',
    'Endergebnis Super Quoten': 'Maç Sonucu (Süper Oran)',
    'Endergebnis': 'Maç Sonucu',
    'Sieger': 'Maç Sonucu',
    'Über/Unter Tore Gesamt': 'Toplam Gol Alt/Üst',
    'Über / Unter Tore Gesamt': 'Toplam Gol Alt/Üst',
    'Tore Gesamt': 'Toplam Gol',
    'Beide Teams treffen': 'Karşılıklı Gol (KG)',
    'Beide Teams treffen?': 'Karşılıklı Gol (KG)',
    'Doppelte Chance': 'Çifte Şans',
    'Halbzeit/Endstand': 'İlk Yarı / Maç Sonucu',
    'Erste Halbzeit - Endergebnis': 'İlk Yarı Sonucu',
    'Zweite Halbzeit - Endergebnis': 'İkinci Yarı Sonucu',
    'Eckbälle Gesamt': 'Toplam Korner',
    'Karten Gesamt': 'Toplam Kart'
};

function formatSingleTeam(name, isTr = true) {
    if (!name || !isTr) return name || '';
    let clean = name.trim();
    let suffix = '';
    for (const s of [' U21', ' U19', ' U20', ' U23', ' Frauen', ' (F)']) {
        if (clean.endsWith(s)) {
            suffix = s === ' Frauen' || s === ' (F)' ? ' Kadınlar' : s;
            clean = clean.slice(0, -s.length).trim();
            break;
        }
    }
    return (DE_TO_TR_TEAMS[clean] || clean) + suffix;
}

function formatTeamName(name, isTr = true) {
    if (!name) return '';
    if (!isTr) return name;
    if (name.includes(' - ')) {
        const [t1, t2] = name.split(' - ');
        return `${formatSingleTeam(t1, isTr)} - ${formatSingleTeam(t2, isTr)}`;
    }
    return formatSingleTeam(name, isTr);
}

function formatLeagueName(league, isTr = true) {
    if (!league || !isTr) return league || '';
    const clean = league.trim();
    if (DE_TO_TR_LEAGUES[clean]) return DE_TO_TR_LEAGUES[clean];
    let res = clean;
    res = res.replace(/Nations League/g, 'UEFA Uluslar Ligi')
             .replace(/Afrika Cup Der Nationen/g, 'Afrika Uluslar Kupası')
             .replace(/Afrika Cup der Nationen/g, 'Afrika Uluslar Kupası')
             .replace(/Europäische Meisterschaft/g, 'Avrupa Şampiyonası')
             .replace(/Europameisterschaft/g, 'Avrupa Şampiyonası')
             .replace(/Weltmeisterschaft/g, 'Dünya Kupası')
             .replace(/Qualifikationsspiele/g, 'Elemeleri')
             .replace(/Qualifikation/g, 'Elemeleri')
             .replace(/Freundschaftsspiele/g, 'Hazırlık Maçları');
    return res;
}

function formatMarketName(market, isTr = true) {
    if (!market || !isTr) return market || '';
    const clean = market.trim();
    if (DE_TO_TR_MARKETS[clean]) return DE_TO_TR_MARKETS[clean];
    let res = clean;
    res = res.replace(/Endergebnis SuperQuoten/g, 'Maç Sonucu (Süper Oran)')
             .replace(/Endergebnis/g, 'Maç Sonucu')
             .replace(/Über\/Unter Tore Gesamt/g, 'Toplam Gol Alt/Üst')
             .replace(/Über \/ Unter Tore Gesamt/g, 'Toplam Gol Alt/Üst')
             .replace(/Tore Gesamt/g, 'Toplam Gol')
             .replace(/Beide Teams treffen/g, 'Karşılıklı Gol');
    return res;
}

function formatSelectionName(sel, leg = {}, isTr = true) {
    if (!sel || !isTr) return sel || '';
    const clean = sel.trim();
    if (clean === 'Über 0.5') return '0.5 Gol Üst';
    if (clean === 'Über 1.5') return '1.5 Gol Üst';
    if (clean === 'Über 2.5') return '2.5 Gol Üst';
    if (clean === 'Über 3.5') return '3.5 Gol Üst';
    if (clean === 'Unter 0.5') return '0.5 Gol Alt';
    if (clean === 'Unter 1.5') return '1.5 Gol Alt';
    if (clean === 'Unter 2.5') return '2.5 Gol Alt';
    if (clean === 'Unter 3.5') return '3.5 Gol Alt';
    if (clean.startsWith('Über ')) return clean.replace('Über ', '') + ' Gol Üst';
    if (clean.startsWith('Unter ')) return clean.replace('Unter ', '') + ' Gol Alt';
    if (clean.toLowerCase().includes('unentschieden')) return 'Beraberlik (X)';
    if (clean === 'Ja') return 'Evet (KG Var)';
    if (clean === 'Nein') return 'Hayır (KG Yok)';

    const home = leg.home || (leg.event_name ? leg.event_name.split(' - ')[0] : '');
    const away = leg.away || (leg.event_name ? leg.event_name.split(' - ')[1] : '');
    if (home && (clean.toLowerCase() === home.toLowerCase() || DE_TO_TR_TEAMS[clean] === home)) {
        return `${formatSingleTeam(clean, isTr)} (MS 1)`;
    }
    if (away && (clean.toLowerCase() === away.toLowerCase() || DE_TO_TR_TEAMS[clean] === away)) {
        return `${formatSingleTeam(clean, isTr)} (MS 2)`;
    }
    return formatSingleTeam(clean, isTr);
}

export const BetanoRadarCard = ({ lang = 'tr', t = {}, onClose }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCardIndex, setActiveCardIndex] = useState(0);

    const fetchBetanoCards = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setRefreshing(true);
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const proxyBase = import.meta.env?.VITE_API_BASE_URL || (isLocal ? 'http://localhost:3001' : 'https://live-bet-mentor.onrender.com');
            const url = `${proxyBase}/api/betano/cards${forceRefresh ? '?refresh=1&t=' + Date.now() : ''}`;
            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                if (json && json.cards && json.cards.length > 0) {
                    setData(json);
                }
            }
        } catch (err) {
            console.error('[BETANO_RADAR] Fetch error:', err);
        } finally {
            setLoading(false);
            if (forceRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        fetchBetanoCards();
        const interval = setInterval(() => {
            if (isMounted) fetchBetanoCards();
        }, 120000); // 2 min auto refresh
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const cards = data?.cards || [];
    const activeCard = cards[activeCardIndex] || cards[0];
    const metrics = activeCard?.metrics || {};
    const diamondPick = metrics?.diamond_pick;
    const legs = activeCard?.events || [];

    return (
        <div style={{
            background: 'linear-gradient(145deg, rgba(17, 24, 39, 0.96), rgba(15, 23, 42, 0.98))',
            borderRadius: '24px',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(249, 115, 22, 0.15)',
            color: '#f8fafc',
            overflow: 'hidden',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                padding: '1.5rem 1.8rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'linear-gradient(90deg, rgba(249, 115, 22, 0.12), rgba(0, 0, 0, 0))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f97316, #ea580c)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)'
                    }}>
                        🔥
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>
                                {isTr ? '🔥 GÜNÜN SICAK SEÇİMLERİ (HOT PICKS)' : isDe ? '🔥 GLOBAL HOT-PICKS & TRENDS' : '🔥 GLOBAL HOT PICKS & TRENDS'}
                            </h2>
                            <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: 'rgba(249, 115, 22, 0.2)',
                                color: '#f97316',
                                border: '1px solid rgba(249, 115, 22, 0.4)',
                                letterSpacing: '0.5px'
                            }}>
                                TREND RADAR
                            </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                            {isTr
                                ? 'Global piyasalarda en çok oynanan trend maçlar, kümülatif marj analizi ve ayıklanan değerli tekli seçimler'
                                : isDe
                                ? 'Meistgespielte globale Trend-Tipps, Marge-Audit (%24+) & selektierte Value-Tipps'
                                : 'Most popular market trend picks, compounded margin audit & extracted value singles'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                        onClick={() => fetchBetanoCards(true)}
                        disabled={refreshing}
                        style={{
                            padding: '0.55rem 1rem',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: '#e2e8f0',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span style={{ display: 'inline-block', transform: refreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.8s ease' }}>
                            🔄
                        </span>
                        {refreshing ? (isTr ? 'Taranıyor...' : 'Laden...') : (isTr ? 'Yenile' : 'Aktualisieren')}
                    </button>

                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#94a3b8',
                                fontSize: '1.1rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Card Tabs */}
            {cards.length > 0 && (
                <div style={{
                    display: 'flex',
                    gap: '0.6rem',
                    padding: '1rem 1.8rem 0.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    overflowX: 'auto'
                }}>
                    {cards.map((c, idx) => {
                        const isActive = idx === activeCardIndex;
                        const cardOdds = c.total_odds || '1.0';
                        const trap = c.metrics?.trap_score || 50;
                        const trapColor = trap >= 65 ? '#ef4444' : trap >= 45 ? '#f59e0b' : '#10b981';

                        return (
                            <button
                                key={idx}
                                onClick={() => setActiveCardIndex(idx)}
                                style={{
                                    padding: '0.65rem 1.2rem',
                                    borderRadius: '12px',
                                    border: isActive ? '1px solid #f97316' : '1px solid rgba(255, 255, 255, 0.08)',
                                    background: isActive ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.25), rgba(249, 115, 22, 0.05))' : 'rgba(255, 255, 255, 0.02)',
                                    color: isActive ? '#fff' : '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.6rem',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    boxShadow: isActive ? '0 4px 15px rgba(249, 115, 22, 0.2)' : 'none'
                                }}
                            >
                                <span>
                                    {isTr
                                        ? (c.title || 'Sıcak Seçimler').replace(/Beliebte Kombiwette/gi, 'Sıcak Trend Seçim').replace(/Hot Picks/gi, 'Sıcak Seçimler')
                                        : isDe
                                        ? (c.title || 'Hot-Picks')
                                        : (c.title || 'Hot Picks')}
                                </span>
                                <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    background: isActive ? '#f97316' : 'rgba(255, 255, 255, 0.08)',
                                    color: isActive ? '#000' : '#e2e8f0',
                                    fontSize: '0.7rem',
                                    fontWeight: 900
                                }}>
                                    @{cardOdds}
                                </span>
                                <span style={{
                                    fontSize: '0.65rem',
                                    color: trapColor,
                                    fontWeight: 900
                                }}>
                                    ⚠️ {trap}/100
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Content Body */}
            <div style={{ padding: '1.5rem 1.8rem' }}>
                {loading ? (
                    <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🔥</div>
                        <p>{isTr ? 'Global trend piyasalarından günün sıcak seçimleri taranıyor...' : 'Lade Trend-Picks...'}</p>
                    </div>
                ) : !activeCard ? (
                    <div style={{ padding: '3rem 0', textAlign: 'center', color: '#94a3b8' }}>
                        <p>{isTr ? 'Şu anda taranan sıcak seçim bulunamadı.' : 'Keine Daten gefunden.'}</p>
                    </div>
                ) : (
                    <div>
                        {/* Metrics Bar */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.5rem'
                        }}>
                            {/* Total Odds */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1rem 1.2rem'
                            }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                    {isTr ? 'Büro Kupon Oranı' : 'Kombi-Quote'}
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f97316', marginTop: '0.3rem' }}>
                                    @{activeCard.total_odds}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                                    {activeCard.events_count} {isTr ? 'Maç Kombine' : 'Spiele'}
                                </div>
                            </div>

                            {/* True Win Probability */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1rem 1.2rem'
                            }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                    {isTr ? 'Gerçek Kazanma Şansı' : 'Echte Gewinnchance'}
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: metrics.true_win_prob_pct < 8 ? '#ef4444' : '#10b981', marginTop: '0.3rem' }}>
                                    %{metrics.true_win_prob_pct}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                                    {isTr ? 'Matematiksel kümülatif ihtimal' : 'Kumulierte Wahrscheinlichkeit'}
                                </div>
                            </div>

                            {/* Compounded Margin */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1rem 1.2rem'
                            }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                    {isTr ? 'Gizli Kasa Marjı (Vig)' : 'Buchmacher-Marge (Vig)'}
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#f59e0b', marginTop: '0.3rem' }}>
                                    %{metrics.compounded_vig_pct}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                                    {isTr ? '5 maçta katlanan kasa avantajı' : 'Marge auf 5 Auswahlen'}
                                </div>
                            </div>

                            {/* Trap Score */}
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                borderRadius: '16px',
                                padding: '1rem 1.2rem'
                            }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                                    {isTr ? 'Tuzak Riski Skoru' : 'Fallen-Risiko'}
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: metrics.trap_score >= 65 ? '#ef4444' : '#10b981', marginTop: '0.3rem' }}>
                                    {metrics.trap_score} <span style={{ fontSize: '0.9rem', color: '#64748b' }}>/ 100</span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem', fontWeight: 700 }}>
                                    {metrics.verdict}
                                </div>
                            </div>
                        </div>

                        {/* Extracted Diamond Pick Banner */}
                        {diamondPick && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 78, 59, 0.25))',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: '18px',
                                padding: '1.2rem 1.5rem',
                                marginBottom: '1.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '1rem',
                                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.1)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '14px',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                                    }}>
                                        💎
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.68rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                            {isTr ? 'KOMBİDEN AYIKLANAN CEVHER SEÇİM (TEKLİ DEĞER)' : 'AUS DER KOMBI SELEKTIERTER VALUE-TIPP'}
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: '0.2rem' }}>
                                            {formatTeamName(diamondPick.event_name, isTr)}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                            <span style={{ color: '#cbd5e1' }}>[{formatLeagueName(diamondPick.league, isTr)}]</span> &bull; {formatMarketName(diamondPick.market, isTr)}: <strong style={{ color: '#10b981' }}>{formatSelectionName(diamondPick.selection, diamondPick, isTr)}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>
                                            {isTr ? 'Oynanma / Popülerlik' : 'Gespielt'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#cbd5e1' }}>
                                            🔥 {diamondPick.selection_count}+ {isTr ? 'Kişi' : 'Tipps'}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '0.5rem 1.2rem',
                                        borderRadius: '12px',
                                        background: '#10b981',
                                        color: '#000',
                                        fontWeight: 900,
                                        fontSize: '1.2rem',
                                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
                                    }}>
                                        @{diamondPick.price}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* All Legs Table */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#cbd5e1', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📋</span> {isTr ? 'Kuponun Tüm Maçları & Risk Süzgeci' : 'Alle Kombi-Auswahlen & Risiko-Filter'}
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.6rem'
                            }}>
                                {legs.map((leg, i) => {
                                    const isDiamond = diamondPick && leg.event_name === diamondPick.event_name && leg.selection === diamondPick.selection;
                                    const isTrap = leg.is_trap;

                                    return (
                                        <div
                                            key={i}
                                            style={{
                                                padding: '0.9rem 1.2rem',
                                                borderRadius: '14px',
                                                background: isDiamond
                                                    ? 'rgba(16, 185, 129, 0.08)'
                                                    : isTrap
                                                    ? 'rgba(239, 68, 68, 0.05)'
                                                    : 'rgba(255, 255, 255, 0.02)',
                                                border: isDiamond
                                                    ? '1px solid rgba(16, 185, 129, 0.3)'
                                                    : isTrap
                                                    ? '1px solid rgba(239, 68, 68, 0.25)'
                                                    : '1px solid rgba(255, 255, 255, 0.05)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                gap: '0.8rem'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                <div style={{
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800,
                                                    color: '#94a3b8'
                                                }}>
                                                    {i + 1}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                                        {formatTeamName(leg.event_name, isTr)}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                                        <span style={{ color: '#64748b' }}>[{formatLeagueName(leg.league, isTr)}]</span> &bull; {formatMarketName(leg.market, isTr)}: <strong style={{ color: isDiamond ? '#10b981' : isTrap ? '#f87171' : '#e2e8f0' }}>{formatSelectionName(leg.selection, leg, isTr)}</strong>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 800,
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        background: isDiamond ? 'rgba(16, 185, 129, 0.2)' : isTrap ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                                                        color: isDiamond ? '#10b981' : isTrap ? '#ef4444' : '#f59e0b',
                                                        border: isDiamond ? '1px solid rgba(16, 185, 129, 0.4)' : isTrap ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.3)'
                                                    }}>
                                                        {isDiamond ? (isTr ? '💎 CEVHER (SEÇİLDİ)' : '💎 VALUE-TIPP') : isTrap ? (isTr ? '⚠️ TUZAK (ELENDİ)' : '⚠️ FALLE') : (isTr ? 'ORTA RİSK' : 'MITTEL')}
                                                    </span>
                                                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.2rem' }}>
                                                        {leg.selection_count > 0 ? (isTr ? `${leg.selection_count} Oynanma` : `${leg.selection_count} Tipps`) : ''}
                                                    </div>
                                                </div>

                                                <div style={{
                                                    fontSize: '1rem',
                                                    fontWeight: 900,
                                                    color: '#fff',
                                                    padding: '0.3rem 0.7rem',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255, 255, 255, 0.06)'
                                                }}>
                                                    @{leg.price}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Strategy Footer Note */}
                        <div style={{
                            padding: '1rem 1.2rem',
                            borderRadius: '14px',
                            background: 'rgba(249, 115, 22, 0.06)',
                            border: '1px solid rgba(249, 115, 22, 0.2)',
                            fontSize: '0.78rem',
                            color: '#cbd5e1',
                            lineHeight: 1.5
                        }}>
                            💡 <strong style={{ color: '#f97316' }}>{isTr ? 'Quant Kasa Yönetimi Kuralı:' : 'Quant-Regel:'}</strong>{' '}
                            {isTr
                                ? 'Bahis büroları 5 maçlık kuponları kasanın matematiksel kar marjını %24\'e katlamak için vitrine koyar. Kuponu olduğu gibi 5 maç oynamak tek maçtan yatma riskini %96\'ya çıkarır. Yalnızca yukarıda 💎 Cevher olarak ayıklanan seçimi tekli veya maksimum ikili olarak kasanıza ekleyin.'
                                : 'Buchmacher nutzen 5er-Kombis, um ihre Marge auf 24% zu vervierfachen. Spielen Sie den Wettschein niemals als Ganzes nach. Nutzen Sie ausschließlich den selektierten 💎 Value-Tipp.'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
