import React, { useState, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';

export const ACADEMY_TOPICS = [
    {
        id: 'xg',
        icon: '⚽',
        title: {
            tr: 'xG (Beklenen Gol / Expected Goals) Nedir ve Canlıda Nasıl Yorumlanır?',
            en: 'What is xG (Expected Goals) and How to Interpret It Live?',
            de: 'Was ist xG (Expected Goals) und wie wird es live interpretiert?'
        },
        summary: {
            tr: 'Bir şutun gol olma ihtimalini 0.00 ile 1.00 arasında ölçen matematiksel kalibre metriğidir.',
            en: 'Mathematical probability metric rating shot conversion likelihood between 0.00 and 1.00.',
            de: 'Mathematische Wahrscheinlichkeitsmetrik, die die Torchance eines Schusses zwischen 0,00 und 1,00 bewertet.'
        },
        content: {
            tr: `### 1. xG (Beklenen Gol) Temel Mantığı
xG (Expected Goals), futbol analitiğinde çekilen her şutun kalitesini, çekildiği mesafeyi, şut açısını, vuruş şeklini (ayak, kafa) ve savunmacıların konumunu analiz ederek gol olma olasılığını hesaplar.

* **Örnek:** Penaltı vuruşunun standart xG değeri **0.78**'dir (Penaltıların %78'i gol olur).
* **Canlı Bahiste Değer Yakalama:** Bir takım 2.45 xG üretmesine rağmen maç 0-0 veya 0-1 gerideyse, takımın bitiricilik şanssızlığı yaşadığı ve savunmanın her an kırılabileceği anlaşılır. Bu durum **"xG Artısı (Surplus)"** olarak adlandırılır ve canlıda yüksek değerli gol fırsatlarına işaret eder.`,
            en: `### 1. Core xG Logic
xG measures the quality of a shot based on angle, distance, assist type, and defensive pressure.

* **Example:** Standard penalty xG is **0.78** (78% historical conversion).
* **In-Play Value Finding:** When a team accumulates 2.45 xG but trails 0-1, regression toward the mean indicates a goal is imminent.`,
            de: `### 1. Grundprinzip von xG
xG bewertet jeden Torschuss anhand von Winkel, Distanz und Druck der Abwehrspieler.

* **Beispiel:** Ein Elfmeter hat standardmäßig einen xG-Wert von **0,78**.
* **In-Play-Mehrwert:** Wenn ein Team 2,45 xG generiert, aber 0:1 zurückliegt, ist ein Tor statistisch überfällig.`
        }
    },
    {
        id: 'pressure',
        icon: '🔥',
        title: {
            tr: 'Pressure Index (Baskı Endeksi 0-100) ve Alev Seviyesi',
            en: 'Pressure Index (0-100) and Flame Alert Thresholds',
            de: 'Druck-Index (0-100) und Flammen-Warnschwellen'
        },
        summary: {
            tr: 'Saha hakimiyeti, ceza sahası aksiyonu ve şut ivmesini birleştiren 0-100 arası anlık maç harareti.',
            en: 'Real-time 0-100 intensity metric combining territorial dominance, box entries, and shot tempo.',
            de: 'Echtzeit-Intensitätsmetrik von 0 bis 100, die Feldüberlegenheit und Strafraumaktionen kombiniert.'
        },
        content: {
            tr: `### 2. Canlı Baskı Endeksi Nasıl Hesaplanır?
Klasik topla oynama oranları yanıltıcıdır; çünkü takımlar kendi sahasında pas yaparak topla oynama yüzdesini şişirebilir. LiveBet Mentor **Pressure Index (Baskı Endeksi)** sadece rakip yarı alanda ve ceza sahasında geçen aktif tehlikeli eylemleri ölçer:

* **Bileşenler:** Son 10 dakikadaki isabetli şutlar, ceza sahası topla buluşma, tehlikeli serbest vuruşlar ve korner ivmesi.
* **Eşik Seviyeleri:**
  * **0 - 45:** Standart / Durgun Oyun (Pasif tempo)
  * **46 - 74 (⚡ SICAK):** Artan hücum baskısı, rakip yarı sahaya yerleşme
  * **75 - 100 (🔥 ALEV):** Savunma kilitlenmesi, yoğun abluka. Bu seviyede maçta gol gelme olasılığı %80'in üzerine çıkar.`,
            en: `### 2. Calculating Live Pressure
Possession can be deceptive. Pressure Index tracks danger zone touches, corners, and continuous box siege.

* **0 - 45:** Low tempo, neutral stalemate.
* **46 - 74 (⚡ HOT):** Sustained offensive momentum.
* **75 - 100 (🔥 FLAME):** Critical defensive breakdown imminent (80%+ goal likelihood).`,
            de: `### 2. Berechnung des Live-Druck-Indexes
Ballbesitz allein täuscht oft. Der Druck-Index misst gezielt Aktionen im gegnerischen Strafraum und Eckbälle.

* **75 - 100 (🔥 FLAMME):** Höchste Alarmstufe, gegnerische Abwehr vor dem Zusammenbruch.`
        }
    },
    {
        id: 'kelly',
        icon: '🛡️',
        title: {
            tr: 'Kelly Kriteri ile Kasa Disiplini ve Stop-Loss Koruma',
            en: 'Kelly Criterion Bankroll Discipline and Stop-Loss Rules',
            de: 'Kelly-Kriterium Kapitalschutz und Stop-Loss-Regeln'
        },
        summary: {
            tr: 'Bahis miktarını duygularla değil, matematiksel avantaj ve kasanın yüzdesiyle belirleme sanatı.',
            en: 'Fractional staking formula preventing bankroll ruin by scaling bets according to true mathematical edge.',
            de: 'Mathematische Einsatzformel zur Vermeidung von Totalverlusten durch anteilige Kelly-Optimierung.'
        },
        content: {
            tr: `### 3. Profesyonel Sermaye Koruma
Bahisçilerin %95'inin kaybetme sebebi tahmin yetersizliği değil, **kasa disiplinsizliğidir**. LiveBet Mentor kurumsal fon yöneticilerinin kullandığı **Fraksiyonel Kelly (1/4 Kelly)** modelini uygular:

* **100 Birim Kuralı:** Toplam kasanız 100 eşit birime bölünür (Örn: 10.000 ₺ kasa için 1 Birim = 100 ₺).
* **Maksimum Masa Riski:** Hiçbir tekil canlı maçta kasanın %2.5 - %3'ünden fazlası riske atılamaz.
* **Stop-Loss Devre Kesici:** Gün içinde arka arkaya 3 kayıp veya kasanın %5'i eridiğinde sistem otonom olarak soğuma moduna geçer ve "NO-BET" kalkanı açar.`,
            en: `### 3. Institutional Bankroll Management
95% of bettors lose due to poor money management. We apply Fractional Kelly (1/4 Kelly):

* **100-Unit Framework:** 10,000 $ capital = 100 $ base unit.
* **Max Exposure:** Never exceed 2.5% - 3.0% on any single fixture.
* **Circuit Breaker:** 3 consecutive losses automatically locks the cockpit into a cooldown freeze.`,
            de: `### 3. Institutionelles Risikomanagement
LiveBet Mentor nutzt fraktioniertes Kelly zur Risikominimierung. Niemals mehr als 2,5% des Kapitals pro Wette einsetzen.`
        }
    },
    {
        id: 'poisson',
        icon: '📐',
        title: {
            tr: 'Poisson Olasılık Modeli ile Gol Tahmini',
            en: 'Poisson Probability Modeling for Goal Distributions',
            de: 'Poisson-Wahrscheinlichkeitsmodell für Torverteilungen'
        },
        summary: {
            tr: 'Futbol gibi düşük skorlu sporlarda kalan süre ve hücum gücüne göre kesin ihtimal eğrisi hesaplama.',
            en: 'Discrete probability distribution calculating goal frequency per minute based on live lambda rates.',
            de: 'Diskrete Wahrscheinlichkeitsverteilung zur Berechnung von Toren basierend auf Live-Intensität.'
        },
        content: {
            tr: `### 4. Poisson Dağılımı Nedir?
Poisson dağılımı, belirli bir zaman aralığında kaç kez gol olacağını tahmin eden istatistiksel bir formüldür:

$$P(k \\text{ gol}) = \\frac{\\lambda^k e^{-\\lambda}}{k!}$$

* **Canlı Lambda (λ):** Maçın o anki dakikası, iki takımın lig genelindeki hücum/savunma gücü ve maçtaki anlık baskı katsayısı birleştirilerek dinamik λ üretilir.
* **Adil Oran Çıkarımı:** Hesaplanan Poisson olasılığı büronun sunduğu oranın üzerine çıktığında (+%10 EV), sistem otonom değer sinyali üretir.`,
            en: `### 4. Poisson Distribution in Football
Poisson calculates the exact likelihood of $k$ goals occurring in the remaining match time based on attack/defense ratings and pitch tempo.`,
            de: `### 4. Poisson-Verteilung im Live-Fußball
Berechnet die mathematisch faire Quote für Über/Unter und Nächstes Tor anhand dynamischer Lambda-Werte.`
        }
    },
    {
        id: 'latency',
        icon: '⚡',
        title: {
            tr: 'Gecikme Arbitrajı (Latency Arbitrage) ve Büro Açığı Nedir?',
            en: 'What is Latency Arbitrage and Bookmaker Delay Windows?',
            de: 'Was ist Latenz-Arbitrage und Buchmacher-Verzögerung?'
        },
        summary: {
            tr: 'Piyasa benchmark tahtası ile yavaş bürolar arasındaki 15-30 saniyelik güncelleme farkını yakalama.',
            en: 'Exploiting 15-30 second lag windows between global benchmark feeds and slower soft bookmakers.',
            de: 'Ausnutzen von 15-30 Sekunden Verzögerung zwischen Referenzmärkten und langsamen Buchmachern.'
        },
        content: {
            tr: `### 5. Gecikme Arbitrajı Mantığı
Bir maçta kırmızı kart çıktığında veya baskı tavan yaptığında global referans piyasada oranlar 1-2 saniye içinde güncellenir veya askıya alınır. Ancak yerel veya bölgesel bazı bürolar bu güncellemeyi 15 ila 30 saniye gecikmeli yansıtır.

* **Sistemimiz Ne Yapar?** Global piyasa tahtasını saniyelik izler. Geciken büroda oran henüz düşmemişken kullanıcıya **"⚡ Gecikme Radarı"** uyarısı gönderir.
* **Avantaj:** Büronun gerçekte 1.40 olması gereken oranı henüz 1.70 iken yakalama şansı tanır (Saf matematiksel değer).`,
            en: `### 5. Latency Edge Mechanics
When intense pitch action or red cards occur, global benchmarks crash odds instantly. Slower bookmakers lag by 15-30 seconds.

Our system alerts you before the window closes.`,
            de: `### 5. Latenz-Vorteil
Globale Referenzmärkte reagieren in Sekunden. Trägere Buchmacher aktualisieren Quoten verzögert.`
        }
    }
];

export const QuantAcademyModal = ({ isOpen, onClose, lang = 'tr' }) => {
    const [selectedTopicId, setSelectedTopicId] = useState('xg');
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!isOpen) return null;

    const isTr = lang === 'tr';
    const isDe = lang === 'de';

    const filteredTopics = ACADEMY_TOPICS.filter(t => {
        const title = (t.title[lang] || t.title.tr).toLowerCase();
        const sum = (t.summary[lang] || t.summary.tr).toLowerCase();
        const q = searchQuery.toLowerCase();
        return title.includes(q) || sum.includes(q);
    });

    const activeTopic = ACADEMY_TOPICS.find(t => t.id === selectedTopicId) || ACADEMY_TOPICS[0];

    return (
        <div
            className="academy-modal-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(3, 7, 18, 0.9)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                zIndex: 100002,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? '8px' : '16px'
            }}
            onClick={onClose}
        >
            <div
                className="academy-modal-card"
                style={{
                    background: 'linear-gradient(160deg, #0e172a 0%, #070d19 100%)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 25px rgba(56, 189, 248, 0.2)',
                    borderRadius: isMobile ? '16px' : '20px',
                    width: '100%',
                    maxWidth: isMobile ? '100%' : '840px',
                    height: isMobile ? '90vh' : '82vh',
                    maxHeight: '740px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    color: '#f8fafc'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: isMobile ? '12px 14px' : '16px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(15, 23, 42, 0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: isMobile ? '1.3rem' : '1.6rem' }}>🎓</span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: isMobile ? '0.95rem' : '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                {isTr ? 'Kuant Akademi & Sözlük' : (isDe ? 'Quant-Akademie & Wettlexikon' : 'Quant Academy & Glossary')}
                            </h2>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>
                                {isTr ? 'xG, Baskı Endeksi, Kelly Kasa & Poisson Modelleri' : 'Expected Goals, Pressure Index & Quant Models'}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#cbd5e1',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                        aria-label="Kapat"
                    >
                        ✕
                    </button>
                </div>

                {/* Mobile View: Top Horizontal Category Strip */}
                {isMobile && (
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        padding: '8px 10px',
                        background: 'rgba(10, 16, 28, 0.95)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        scrollbarWidth: 'none',
                        flexShrink: 0,
                        WebkitOverflowScrolling: 'touch'
                    }}>
                        {filteredTopics.map(t => {
                            const isSelected = t.id === activeTopic.id;
                            const titleShort = (t.title[lang] || t.title.tr).split('(')[0].trim();
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setSelectedTopicId(t.id);
                                    }}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '6px 12px',
                                        borderRadius: '20px',
                                        background: isSelected ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.35), rgba(56, 189, 248, 0.2))' : 'rgba(255, 255, 255, 0.04)',
                                        border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                                        color: isSelected ? '#38bdf8' : '#94a3b8',
                                        fontSize: '0.72rem',
                                        fontWeight: isSelected ? 800 : 600,
                                        whiteSpace: 'nowrap',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                >
                                    <span>{t.icon}</span>
                                    <span>{titleShort}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Body Content */}
                <div style={{
                    display: 'flex',
                    flex: 1,
                    overflow: 'hidden',
                    flexDirection: isMobile ? 'column' : 'row'
                }}>
                    {/* Desktop Sidebar */}
                    {!isMobile && (
                        <div style={{
                            width: '35%',
                            minWidth: '240px',
                            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'rgba(10, 14, 23, 0.5)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Search Input */}
                            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder={isTr ? 'Kavram veya terim ara...' : 'Search concept...'}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '6px',
                                        padding: '8px 10px',
                                        color: '#f8fafc',
                                        fontSize: '0.8rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* List */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                                {filteredTopics.map(t => {
                                    const isSelected = t.id === activeTopic.id;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => {
                                                triggerHaptic('light');
                                                setSelectedTopicId(t.id);
                                            }}
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                                border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                                                color: isSelected ? '#38bdf8' : '#cbd5e1',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '8px',
                                                marginBottom: '4px',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: isSelected ? 800 : 600, lineHeight: 1.3 }}>
                                                    {t.title[lang] || t.title.tr}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Content Detail Panel (Full width on mobile, 65% on desktop) */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: isMobile ? '16px 14px' : '24px 28px',
                        background: 'rgba(13, 21, 39, 0.4)',
                        lineHeight: '1.65'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <span style={{ fontSize: isMobile ? '1.5rem' : '2rem' }}>{activeTopic.icon}</span>
                            <h3 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.3rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.3 }}>
                                {activeTopic.title[lang] || activeTopic.title.tr}
                            </h3>
                        </div>

                        <div style={{
                            background: 'rgba(56, 189, 248, 0.08)',
                            borderLeft: '4px solid #38bdf8',
                            padding: '10px 12px',
                            borderRadius: '0 8px 8px 0',
                            fontSize: isMobile ? '0.8rem' : '0.88rem',
                            color: '#93c5fd',
                            marginBottom: '16px',
                            lineHeight: 1.5
                        }}>
                            💡 <strong>{isTr ? 'Özet:' : 'Summary:'}</strong> {activeTopic.summary[lang] || activeTopic.summary.tr}
                        </div>

                        <div style={{
                            fontSize: isMobile ? '0.85rem' : '0.92rem',
                            color: '#e2e8f0',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6
                        }}>
                            {activeTopic.content[lang] || activeTopic.content.tr}
                        </div>

                        {/* Back to Terminal Action */}
                        <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    width: isMobile ? '100%' : 'auto',
                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '10px 18px',
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>⚡</span>
                                <span>{isTr ? 'Terminale Dön' : 'Back to Terminal'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
