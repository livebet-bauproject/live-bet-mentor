import React, { useState } from 'react';

const GUIDE_TEXTS = {
    tr: {
        modalTitle: '100-Birim Kasa Yönetimi & Masadan Kalkma Disiplini',
        modalSubtitle: 'Sermayenizi koruyan, büyüten ve sıfırlanmaktan kurtaran kurumsal kasa modeli',
        tabRules: '📖 Sistem Nasıl Çalışır?',
        tabVs: '⚖️ Klasik Bahisçi vs. Akıllı Kasa',
        tabCalc: '🧮 Canlı Kasa Hesaplayıcı',
        tabShare: '📲 Telegram / Paylaşım Rehberi',
        close: 'Kapat',
        
        // Tab 1: Rules
        rulesHeader: 'KASANIN ASLA SIFIRLANMAMASININ 4 ALTIN KURALI',
        rulesSub: 'Bahiste kaybetmenin sebebi tahminlerin değil, para yönetimi ve masadan kalkma disiplininin olmamasıdır.',
        step1Title: '1. Kasanı 100 Eşit Mermiye Böl (1U Standartı)',
        step1Desc: 'Kasan kaç paraysa sistem onu otomatik olarak 100 eşit parçaya (Birim / Unit - U) böler. Örneğin 2.000 ₺ kasanız varsa 1 Birim = 20 ₺ olur. Tek maça yüksek basıp kasayı tehlikeye atma devri kapanır.',
        step2Title: '2. Sinyal Gücüne Göre Dinamik Atış (1.0 - 2.5 Birim)',
        step2Desc: 'Her maça aynı miktar basılmaz. Standart maçlara 1.0 Birim (20 ₺), yüksek ivmeli abluka maçlarına 2.0 Birim (40 ₺), Alfa Kuant ve 75+ Geç Dakika Gol sinyallerine 2.5 Birim (50 ₺) önerilir.',
        step3Title: '3. Masa Riski Sınırı (Aynı Anda En Fazla 2 Maç)',
        step3Desc: 'Aynı anda 4-5 maça birden kasa açılmaz. Masada en fazla 2 maç açık olabilir. Bu maçlar bitip sonuçlanmadan yeni pozisyon açılamaz. Böylece sermaye dağılmaz ve kontrol kaybolmaz.',
        step4Title: '4. Masadan Kalkma Kuralı (+%5 Kâr Kilidi & -%3 Stop-Loss)',
        step4Desc: 'Günde kasanızın +%5 kârına (örn: 2.000 ₺ için +100 ₺) ulaştığınız an sistem kilitlenir. Kâr cebe konur ve masadan kalkılır. Kötü bir günde ise -%3 zararda (-60 ₺) stop-loss devreye girer, sermayenizin %97\'si kurtarılır.',

        // Tab 2: Comparison
        vsHeader: 'NEDEN KAYBEDİYORLAR? (ZİHNİYET FARKI)',
        vsBadTitle: '❌ KLASİK BAHİSÇİ (NEDEN BATIYOR?)',
        vsGoodTitle: '✅ LİVEBET AKILLI KASA (NASIL BÜYÜYOR?)',
        vsRow1Bad: 'Kafasına göre bazen 200, bazen 1.000 ₺ basar; tek maçta kasanın yarısını yakar.',
        vsRow1Good: 'Kasayı her zaman 100 eşit parçaya böler, en güçlü maçta bile en fazla 2.5 birim riske eder.',
        vsRow2Bad: 'Kaybettikçe sinirlenir, zararını hemen çıkarmak için daha büyük basar (Tilt olur).',
        vsRow2Good: '-%3 günlük stop-loss sınırına geldiğinde sistemi durdurur, kasanın %97\'sini koruyup ertesi günü bekler.',
        vsRow3Bad: 'Kazandıkça açgözlülük yapar, "bugün şanslıyım" deyip tüm kazandığını gece maçlarında geri verir.',
        vsRow3Good: '+%5 günlük hedefine ulaştığı an masadan kalkar, kârını kilitler ve günü yeşil kapatır.',
        vsRow4Bad: 'Aynı anda 5-6 maça birden dalar, hiçbirini doğru analiz edemez ve panikler.',
        vsRow4Good: 'Aynı anda en fazla 2 açık maça izin verir, sermaye asla dağılmaz.',

        // Tab 3: Calculator
        calcHeader: 'CANLI KASA & BİLEŞİK BÜYÜME SİMÜLATÖRÜ',
        calcSub: 'Kendi sermaye miktarınızı seçin, sistemin sizin için hesapladığı mermileri ve hedefleri anında görün.',
        calcInputLabel: 'KASA BAKİYENİZİ BELİRLEYİN (₺):',
        statUnit: '1 Birim (1U) Değeriniz:',
        statElite: 'Elit Maç Atışı (2.5U):',
        statTarget: 'Günlük Kâr Hedefiniz (+%5):',
        statStop: 'Günlük Stop-Loss Limiti (-%3):',
        compoundHeader: '📈 30 GÜNLÜK BİLEŞİK DİSİPLİN PROJEKSİYONU',
        compoundDesc: 'Günde sadece +%5 hedef alıp masadan kalkan bir analistin 30 günlük simülasyonu:',
        day10: '10. Gün (Kasa: ~{val10} ₺)',
        day20: '20. Gün (Kasa: ~{val20} ₺)',
        day30: '30. Gün (Kasa: ~{val30} ₺)',
        compoundNote: '* Bileşik büyüme hesabı kârın kasada kalıp birim boyutunu dinamik büyütmesi esasına dayanır. Gerçekçi piyasa koşullarında disipline uymak kasanızı katlamanın en güvenli yoludur.',

        // Tab 4: Telegram & WhatsApp Share
        shareHeader: 'TOPLULUK & TELEGRAM İÇİN PAYLAŞIM REHBERİ',
        shareSub: 'Bu disiplin rehberini tek tıkla kopyalayıp Telegram kanalınızda veya WhatsApp gruplarınızda paylaşabilirsiniz.',
        copyBtn: '📋 Metni Panoya Kopyala',
        copiedNotice: '✅ Rehber panoya kopyalandı! Telegram veya WhatsApp grubunuza yapıştırabilirsiniz.',
        
        postTemplate: `🛡️ CANLI BAHİSTE KASANIN ASLA SIFIRLANMAMASININ 4 KURALI

Neden her seferinde kasanız sıfırlanıyor?
Çünkü iyi maç bulamadığınız için değil; kasa yönetiminiz ve MASADAN KALKMA DİSİPLİNİNİZ olmadığı için kaybediyorsunuz!

⚡ 100-BİRİM KASA SİSTEMİ NEDİR?
1️⃣ Kasa Kaç Paraysa 100 Eşit Mermiye Bölünür (1 Birim = Kasanın %1'i).
   Örn: 2.000 ₺ Kasa = 1 Birim 20 ₺'dir.

2️⃣ Sinyalin Gücüne Göre Oynanır:
   • Standart Fırsat: 1.0 Birim (20 ₺)
   • Yüksek İvme / Abluka: 2.0 Birim (40 ₺)
   • Alfa Kuant / 75+ Banko: 2.5 Birim (50 ₺)

3️⃣ Masa Riski Kuralı:
   Aynı anda en fazla 2 maç açık olabilir! 3. maça izin verilmez. Sermaye asla dağılmaz.

4️⃣ Masadan Kalkma Disiplini:
   • Günlük +%5 kârı gördüğün an sistem kilitlenir: Masadan kalkılır, kâr cebe atılır!
   • Kötü günde -%3 zararda durulur: Kasanın %97'si her zaman korunur!

👉 Kumar oynamayı bırakın, matematik ve kurallarla portföy yönetin.`
    },

    en: {
        modalTitle: '100-Unit Bankroll Management & Walk-Away Discipline',
        modalSubtitle: 'An institutional bankroll model that preserves, grows, and protects your capital',
        tabRules: '📖 How the System Works',
        tabVs: '⚖️ Gambler vs. Disciplined Trader',
        tabCalc: '🧮 Live Bankroll Calculator',
        tabShare: '📲 Telegram / Share Guide',
        close: 'Close',
        
        // Tab 1: Rules
        rulesHeader: 'THE 4 GOLDEN RULES TO PREVENT CAPITAL DRAWDOWN',
        rulesSub: 'Bettors do not lose because of poor predictions; they lose due to lack of bankroll management and stopping discipline.',
        step1Title: '1. Divide Your Bankroll into 100 Equal Units (1U Standard)',
        step1Desc: 'Whatever your balance is, the system automatically divides it into 100 equal units (1 Unit = 1%). For example, on a 2,000 ₺ bankroll, 1 Unit = 20 ₺. Gone are the days of reckless all-ins.',
        step2Title: '2. Conviction-Based Dynamic Staking (1.0 - 2.5 Units)',
        step2Desc: 'Do not bet the same amount on every game. Standard positive EV signals get 1.0 Unit (20 ₺), momentum siege games get 2.0 Units (40 ₺), and Alpha Quant / 75+ Late Goal signals receive 2.5 Units (50 ₺).',
        step3Title: '3. Exposure Cap (Maximum 2 Concurrent Matches)',
        step3Desc: 'Never hold positions on 4-5 games simultaneously. Maximum 2 active open positions are permitted at any time. Capital stays concentrated and risk remains capped.',
        step4Title: '4. Walk-Away Discipline (+5% Profit Lock & -3% Stop-Loss)',
        step4Desc: 'Reaching +5% daily profit (e.g., +100 ₺ on 2,000 ₺) locks out further bets to bank the day\'s win. On an adverse day, hitting a -3% stop-loss (-60 ₺) halts trading, safeguarding 97% of your capital.',

        // Tab 2: Comparison
        vsHeader: 'WHY MOST PEOPLE GO BROKE (MINDSET CONTRAST)',
        vsBadTitle: '❌ THE TYPICAL GAMBLER (WHY THEY BUST)',
        vsGoodTitle: '✅ LIVEBET QUANT TRADER (HOW THEY COMPOUND)',
        vsRow1Bad: 'Stakes random amounts (200, 1,000 ₺); burns half their bankroll on a single match.',
        vsRow1Good: 'Strictly allocates 100 equal units, risking at most 2.5 units on top-tier signals.',
        vsRow2Bad: 'Chases losses aggressively after a bad beat (tilts and busts).',
        vsRow2Good: 'Halts immediately at -3% daily stop-loss, preserving 97% of capital for tomorrow.',
        vsRow3Bad: 'Gets greedy when winning, keeps wagering until all profits are lost in late-night matches.',
        vsRow3Good: 'Locks gains and walks away the moment the +5% daily target is reached.',
        vsRow4Bad: 'Spreads capital across 5-6 games at once, loses track and panics.',
        vsRow4Good: 'Strictly limits exposure to 2 concurrent matches at any time.',

        // Tab 3: Calculator
        calcHeader: 'LIVE BANKROLL & COMPOUND GROWTH CALCULATOR',
        calcSub: 'Set your capital and instantly view your personalized units, daily targets, and 30-day projection.',
        calcInputLabel: 'SPECIFY YOUR STARTING CAPITAL (₺ / € / $):',
        statUnit: '1 Unit (1U) Size:',
        statElite: 'Elite Conviction Stake (2.5U):',
        statTarget: 'Daily Target (+5%):',
        statStop: 'Daily Stop-Loss (-3%):',
        compoundHeader: '📈 30-DAY COMPOUND DISCIPLINE PROJECTION',
        compoundDesc: 'Projection of taking a disciplined +5% daily target and compounding profits:',
        day10: 'Day 10 (Bankroll: ~{val10} ₺)',
        day20: 'Day 20 (Bankroll: ~{val20} ₺)',
        day30: 'Day 30 (Bankroll: ~{val30} ₺)',
        compoundNote: '* Compounding assumes profits are reinvested to scale unit sizes. In real market conditions, strict walk-away discipline is the only reliable path to long-term profitability.',

        // Tab 4: Telegram Share
        shareHeader: 'COMMUNITY & TELEGRAM BROADCAST GUIDE',
        shareSub: 'One-click copy and broadcast this bankroll blueprint to your VIP groups or community.',
        copyBtn: '📋 Copy Text to Clipboard',
        copiedNotice: '✅ Copied to clipboard! Ready to paste into your Telegram or WhatsApp group.',
        
        postTemplate: `🛡️ THE 4 IRONCLAD RULES TO NEVER BLOW UP YOUR BANKROLL

Why do most sports bettors lose their bankroll?
Not because they cannot pick a winner; but because they have zero bankroll management and NO DISCIPLINE TO WALK AWAY!

⚡ WHAT IS THE 100-UNIT BANKROLL SYSTEM?
1️⃣ Bankroll Divided into 100 Equal Units (1 Unit = 1% of Capital).
   E.g., 2,000 ₺ Capital = 1 Unit is 20 ₺.

2️⃣ Conviction-Based Dynamic Staking:
   • Standard Edge: 1.0 Unit (20 ₺)
   • Pressure Surge / Momentum: 2.0 Units (40 ₺)
   • Alpha Quant / 75+ Conviction: 2.5 Units (50 ₺)

3️⃣ Maximum Table Exposure:
   Max 2 open matches concurrently! Never spread capital across 5 games at once.

4️⃣ The Walk-Away Discipline:
   • Daily +5% Profit: System locks down. Bank the profit and close the book!
   • Daily -3% Stop-Loss: Protects 97% of your capital to trade another day.

👉 Stop gambling blindly. Manage capital like a hedge fund.`
    },

    de: {
        modalTitle: '100-Einheiten-Bankroll & Aufhör-Disziplin',
        modalSubtitle: 'Ein institutionelles Portfoliomodell, das Ihr Kapital schützt, wachsen lässt und vor Totalverlust bewahrt',
        tabRules: '📖 Wie das System funktioniert',
        tabVs: '⚖️ Zocker vs. Disziplinierter Anleger',
        tabCalc: '🧮 Live-Bankroll-Rechner',
        tabShare: '📲 Telegram / Leitfaden teilen',
        close: 'Schließen',
        
        // Tab 1: Rules
        rulesHeader: 'DIE 4 GOLDENEN REGELN GEGEN KAPITALVERLUST',
        rulesSub: 'Wettende verlieren nicht wegen falscher Tipps; sie verlieren wegen fehlendem Moneymanagement und mangelnder Stopp-Disziplin.',
        step1Title: '1. Kapital in 100 gleiche Einheiten teilen (1U-Standard)',
        step1Desc: 'Wie hoch Ihr Guthaben auch ist: Das System teilt es automatisch in 100 Einheiten (1U = 1%). Bei 2.000 ₺ entspricht 1U = 20 ₺. Schluss mit unüberlegten All-Ins.',
        step2Title: '2. Dynamische Einsätze nach Signalstärke (1,0 - 2,5 Units)',
        step2Desc: 'Setzen Sie nicht auf jedes Spiel denselben Betrag. Standard-Werte erhalten 1,0U (20 ₺), hohe Belagerungsphasen 2,0U (40 ₺), Alpha-Quant- und 75+-Signale erhalten 2,5U (50 ₺).',
        step3Title: '3. Maximal 2 offene Spiele gleichzeitig',
        step3Desc: 'Niemals auf 4-5 Spiele gleichzeitig setzen. Maximal 2 aktive Positionen sind erlaubt. Das Kapital bleibt fokussiert und das Risiko begrenzt.',
        step4Title: '4. Aufhör-Disziplin (+5% Tagesziel-Sperre & -3% Stop-Loss)',
        step4Desc: 'Sobald +5% Tagesgewinn erreicht sind (z. B. +100 ₺ bei 2.000 ₺), sperrt das System weitere Einsätze: Gewinne einstreichen und Tisch verlassen! Bei -3% greift der Stop-Loss: 97% des Kapitals sind gerettet.',

        // Tab 2: Comparison
        vsHeader: 'WARUM DIE MEISTEN VERLIEREN (MINDSET-VERGLEICH)',
        vsBadTitle: '❌ DER TYPISCHE ZOCKER (WARUM ER SCHEITERT)',
        vsGoodTitle: '✅ LIVEBET-ANALYST (WIE ER KAPITAL VERVIELFACHT)',
        vsRow1Bad: 'Setzt planlos mal 200, mal 1.000 ₺; verbrennt in einem einzigen Spiel die halbe Bankroll.',
        vsRow1Good: 'Hält sich strikt an 100 Einheiten; riskiert selbst bei Elitesignalen maximal 2,5 Einheiten.',
        vsRow2Bad: 'Versucht Verluste mit Frust-Einsätzen sofort zurückzuholen (Tilt und Ruin).',
        vsRow2Good: 'Stoppt konsequent bei -3% Tages-Stop-Loss und rettet 97% des Kapitals für den nächsten Tag.',
        vsRow3Bad: 'Wird bei Gewinnen gierig und verspielt nachts alles wieder.',
        vsRow3Good: 'Nimmt bei +5% Tagesziel den Gewinn mit, beendet den Tag und schließt das System im Plus ab.',
        vsRow4Bad: 'Verteilt sein Geld auf 5-6 Spiele gleichzeitig und verliert den Überblick.',
        vsRow4Good: 'Begrenzt das Risiko strikt auf maximal 2 offene Spiele gleichzeitig.',

        // Tab 3: Calculator
        calcHeader: 'LIVE-BANKROLL- & ZINSESZINS-RECHNER',
        calcSub: 'Wählen Sie Ihr Kapital und sehen Sie sofort Ihre persönlichen Einheiten, Tagesziele und 30-Tage-Projektion.',
        calcInputLabel: 'STARTKAPITAL FESTLEGEN (₺ / € / $):',
        statUnit: '1 Einheit (1U) Wert:',
        statElite: 'Elite-Einsatz (2,5U):',
        statTarget: 'Tagesgewinnziel (+5%):',
        statStop: 'Tages-Stop-Loss (-3%):',
        compoundHeader: '📈 30-TAGE ZINSESZINS-PROJEKTION',
        compoundDesc: 'Projektion bei täglicher Erreichung des +5%-Tagesziels und diszipliniertem Aufhören:',
        day10: 'Tag 10 (Kapital: ~{val10} ₺)',
        day20: 'Tag 20 (Kapital: ~{val20} ₺)',
        day30: 'Tag 30 (Kapital: ~{val30} ₺)',
        compoundNote: '* Zinseszins-Berechnung basiert auf der Reinvestition von Gewinnen. Diszipliniertes Aufhören ist der einzige mathematisch verlässliche Weg zum dauerhaften Erfolg.',

        // Tab 4: Telegram Share
        shareHeader: 'LEITFADEN FÜR COMMUNITY & TELEGRAM',
        shareSub: 'Kopieren Sie diesen Leitfaden mit einem Klick und teilen Sie ihn in Ihren Telegram- oder WhatsApp-Gruppen.',
        copyBtn: '📋 Text in Zwischenablage kopieren',
        copiedNotice: '✅ In Zwischenablage kopiert! Bereit zum Teilen in Ihrer Gruppe.',
        
        postTemplate: `🛡️ DIE 4 GOLDENEN REGELN GEGEN BANKROLL-VERLUST

Warum verlieren die meisten Sportwetter ihr Geld?
Nicht wegen schlechter Tipps, sondern wegen fehlendem Risikomanagement und FEHLENDER AUFHÖR-DISZIPLIN!

⚡ WAS IST DAS 100-EINHEITEN-SYSTEM?
1️⃣ Kapital in 100 gleiche Teile aufgeteilt (1 Einheit = 1% des Kapitals).
   Z. B. 2.000 ₺ Kapital = 1 Einheit ist 20 ₺.

2️⃣ Einsätze nach Überzeugung:
   • Standard-Chance: 1,0 Unit (20 ₺)
   • Druckphase / Momentum: 2,0 Units (40 ₺)
   • Alpha-Quant / 75+ Banko: 2,5 Units (50 ₺)

3️⃣ Maximal 2 offene Spiele gleichzeitig!
   Niemals das Geld auf 5 Spiele gleichzeitig streuen.

4️⃣ Aufhör-Disziplin:
   • Bei +5% Tagesgewinn: System sperrt ab. Gewinne sichern und Feierabend machen!
   • Bei -3% Stop-Loss: Aufhören. 97% des Kapitals bleiben für morgen geschützt!

👉 Hören Sie auf zu zocken. Verwalten Sie Kapital wie ein Profi.`
    }
};

export const BankrollGuideModal = ({
    isOpen,
    onClose,
    currentCapital = 2000,
    currentCurrency,
    lang = 'tr'
}) => {
    if (!isOpen) return null;

    const defaultCurrency = currentCurrency || (lang === 'de' ? '€' : lang === 'en' ? '$' : '₺');
    const [currency, setCurrencyState] = useState(defaultCurrency);
    const [activeTab, setActiveTab] = useState('rules'); // 'rules', 'vs', 'calc', 'share'
    const [calcAmount, setCalcAmount] = useState(() => {
        if (currentCapital) return currentCapital;
        return (defaultCurrency === '€' || defaultCurrency === '$' || defaultCurrency === '£') ? 500 : 2000;
    });
    const [copied, setCopied] = useState(false);

    const loc = GUIDE_TEXTS[lang] || GUIDE_TEXTS.tr;
    const isWesternCurrency = currency === '€' || currency === '$' || currency === '£';
    const presets = isWesternCurrency ? [50, 100, 250, 500, 1000, 2500] : [500, 1000, 2000, 5000, 10000, 20000];

    // Calculator values
    const unitSize = Math.max(1, Math.round(calcAmount / 100));
    const eliteStake = Math.round(unitSize * 2.5);
    const targetProfit = Math.round(calcAmount * 0.05);
    const stopLoss = Math.round(calcAmount * 0.03);

    // Compound growth simulation: assuming +5% per winning day for 20 active days in a month
    const val10 = Math.round(calcAmount * Math.pow(1.05, 7));
    const val20 = Math.round(calcAmount * Math.pow(1.05, 14));
    const val30 = Math.round(calcAmount * Math.pow(1.05, 20));

    // Dynamic Share Template with selected currency and numbers
    const dynamicSharePost = loc.postTemplate
        .replace(/₺/g, currency)
        .replace(/2\.000/g, calcAmount.toLocaleString())
        .replace(/2,000/g, calcAmount.toLocaleString())
        .replace(/20/g, String(unitSize))
        .replace(/40/g, String(unitSize * 2))
        .replace(/50/g, String(eliteStake));

    const handleCopy = () => {
        navigator.clipboard.writeText(dynamicSharePost).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 3500);
        });
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(3, 7, 18, 0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #0b1329 0%, #030712 100%)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '20px',
                maxWidth: '680px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9)',
                color: '#f8fafc',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    background: 'rgba(15, 23, 42, 0.6)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.8rem' }}>🛡️</span>
                        <div>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, color: '#f8fafc', letterSpacing: '-0.3px' }}>
                                {loc.modalTitle}
                            </h3>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '3px' }}>
                                {loc.modalSubtitle}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: 'none',
                            color: '#94a3b8',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div style={{
                    display: 'flex',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    overflowX: 'auto',
                    scrollbarWidth: 'none'
                }}>
                    {[
                        { id: 'rules', label: loc.tabRules },
                        { id: 'vs', label: loc.tabVs },
                        { id: 'calc', label: loc.tabCalc },
                        { id: 'share', label: loc.tabShare }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: '1 0 auto',
                                padding: '0.85rem 1rem',
                                border: 'none',
                                background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                                borderBottom: `2px solid ${activeTab === tab.id ? '#38bdf8' : 'transparent'}`,
                                color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                                fontWeight: activeTab === tab.id ? 900 : 700,
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Modal Body / Tab Content */}
                <div style={{
                    padding: '1.5rem',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem'
                }}>
                    {/* TAB 1: RULES */}
                    {activeTab === 'rules' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{
                                background: 'rgba(56, 189, 248, 0.08)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                borderRadius: '12px',
                                padding: '0.85rem 1rem'
                            }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#38bdf8' }}>
                                    {loc.rulesHeader}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.4 }}>
                                    {loc.rulesSub}
                                </div>
                            </div>

                            {/* 4 Steps */}
                            {[
                                { title: loc.step1Title, desc: loc.step1Desc, icon: '🎯', color: '#38bdf8' },
                                { title: loc.step2Title, desc: loc.step2Desc, icon: '⚡', color: '#fbbf24' },
                                { title: loc.step3Title, desc: loc.step3Desc, icon: '🛡️', color: '#a78bfa' },
                                { title: loc.step4Title, desc: loc.step4Desc, icon: '🔒', color: '#34d399' }
                            ].map((step, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(15, 23, 42, 0.7)',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '12px',
                                    padding: '0.85rem 1rem',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'flex-start'
                                }}>
                                    <span style={{ fontSize: '1.5rem', marginTop: '2px' }}>{step.icon}</span>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: step.color }}>
                                            {step.title}
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.5 }}>
                                            {step.desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* TAB 2: VS COMPARISON */}
                    {activeTab === 'vs' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ textAlign: 'center', fontSize: '0.82rem', fontWeight: 900, color: '#cbd5e1' }}>
                                {loc.vsHeader}
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                                gap: '1rem'
                            }}>
                                {/* Bad Side */}
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    borderRadius: '14px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#f87171' }}>
                                        {loc.vsBadTitle}
                                    </div>
                                    {[loc.vsRow1Bad, loc.vsRow2Bad, loc.vsRow3Bad, loc.vsRow4Bad].map((text, i) => (
                                        <div key={i} style={{ fontSize: '0.72rem', color: '#fca5a5', lineHeight: 1.4, display: 'flex', gap: '6px' }}>
                                            <span>❌</span>
                                            <span>{text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Good Side */}
                                <div style={{
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                    borderRadius: '14px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.75rem'
                                }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#34d399' }}>
                                        {loc.vsGoodTitle}
                                    </div>
                                    {[loc.vsRow1Good, loc.vsRow2Good, loc.vsRow3Good, loc.vsRow4Good].map((text, i) => (
                                        <div key={i} style={{ fontSize: '0.72rem', color: '#86efac', lineHeight: 1.4, display: 'flex', gap: '6px' }}>
                                            <span>✓</span>
                                            <span>{text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: CALCULATOR */}
                    {activeTab === 'calc' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#38bdf8' }}>
                                    {loc.calcHeader}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}>
                                    {loc.calcSub}
                                </div>
                            </div>

                            {/* Currency Selector */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                padding: '0.6rem 0.85rem',
                                flexWrap: 'wrap',
                                gap: '8px'
                            }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8' }}>
                                    {lang === 'tr' ? 'Para Birimi Seçimi:' : (lang === 'de' ? 'Währung wählen:' : 'Select Currency:')}
                                </span>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    {[
                                        { id: '₺', label: '₺ TRY' },
                                        { id: '€', label: '€ EUR' },
                                        { id: '$', label: '$ USD' },
                                        { id: '£', label: '£ GBP' }
                                    ].map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => {
                                                setCurrencyState(c.id);
                                                if (c.id === '€' || c.id === '$' || c.id === '£') {
                                                    if (calcAmount > 5000) setCalcAmount(1000);
                                                    else if (calcAmount >= 2000) setCalcAmount(500);
                                                } else if (c.id === '₺' && calcAmount < 500) {
                                                    setCalcAmount(2000);
                                                }
                                            }}
                                            style={{
                                                background: currency === c.id ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                                border: `1px solid ${currency === c.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                                                color: currency === c.id ? '#38bdf8' : '#cbd5e1',
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '6px',
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Preset Buttons & Input */}
                            <div style={{
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                borderRadius: '12px',
                                padding: '1rem'
                            }}>
                                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', display: 'block', marginBottom: '0.5rem' }}>
                                    {loc.calcInputLabel.replace(/₺/g, currency)}
                                </label>
                                <input
                                    type="number"
                                    min={isWesternCurrency ? 10 : 100}
                                    max={1000000}
                                    step={isWesternCurrency ? 10 : 100}
                                    value={calcAmount}
                                    onChange={(e) => setCalcAmount(Math.max(10, Number(e.target.value) || 0))}
                                    style={{
                                        width: '100%',
                                        background: '#030712',
                                        border: '1px solid rgba(56, 189, 248, 0.4)',
                                        borderRadius: '8px',
                                        padding: '0.65rem 0.85rem',
                                        color: '#f8fafc',
                                        fontSize: '1.1rem',
                                        fontWeight: 900,
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />

                                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                                    {presets.map(val => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setCalcAmount(val)}
                                            style={{
                                                background: calcAmount === val ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                                border: `1px solid ${calcAmount === val ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                                                color: calcAmount === val ? '#38bdf8' : '#94a3b8',
                                                padding: '0.3rem 0.65rem',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {val.toLocaleString()} {currency}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Calculated Metrics Cards */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '0.65rem'
                            }}>
                                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.66rem', color: '#38bdf8', fontWeight: 800 }}>{loc.statUnit}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: '3px' }}>{unitSize.toLocaleString()} {currency}</div>
                                </div>

                                <div style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.66rem', color: '#fbbf24', fontWeight: 800 }}>{loc.statElite}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: '3px' }}>{eliteStake.toLocaleString()} {currency}</div>
                                </div>

                                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.66rem', color: '#34d399', fontWeight: 800 }}>{loc.statTarget}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#34d399', marginTop: '3px' }}>+{targetProfit.toLocaleString()} {currency}</div>
                                </div>

                                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.66rem', color: '#f87171', fontWeight: 800 }}>{loc.statStop}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f87171', marginTop: '3px' }}>-{stopLoss.toLocaleString()} {currency}</div>
                                </div>
                            </div>

                            {/* Compound Growth Projection Card */}
                            <div style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                padding: '1rem'
                            }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 900, color: '#34d399' }}>
                                    {loc.compoundHeader}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '3px' }}>
                                    {loc.compoundDesc}
                                </div>

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: '8px',
                                    marginTop: '0.85rem',
                                    flexWrap: 'wrap'
                                }}>
                                    <span style={{ fontSize: '0.74rem', color: '#f8fafc', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                                        {loc.day10.replace(/₺/g, currency).replace('{val10}', val10.toLocaleString())}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: '#f8fafc', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
                                        {loc.day20.replace(/₺/g, currency).replace('{val20}', val20.toLocaleString())}
                                    </span>
                                    <span style={{ fontSize: '0.74rem', color: '#34d399', fontWeight: 800, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', padding: '4px 8px', borderRadius: '6px' }}>
                                        {loc.day30.replace(/₺/g, currency).replace('{val30}', val30.toLocaleString())}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.62rem', color: '#64748b', marginTop: '0.75rem', lineHeight: 1.4 }}>
                                    {loc.compoundNote}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 4: TELEGRAM / SOCIAL SHARE */}
                    {activeTab === 'share' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#38bdf8' }}>
                                    {loc.shareHeader}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '3px' }}>
                                    {loc.shareSub}
                                </div>
                            </div>

                            {/* Copy Button */}
                            <button
                                type="button"
                                onClick={handleCopy}
                                style={{
                                    background: copied ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #38bdf8, #0284c7)',
                                    color: copied ? '#fff' : '#000',
                                    border: 'none',
                                    padding: '0.75rem 1.25rem',
                                    borderRadius: '10px',
                                    fontWeight: 900,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 15px rgba(56, 189, 248, 0.35)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span>{copied ? '✅' : '📋'}</span>
                                <span>{copied ? (lang === 'tr' ? 'Kopyalandı!' : (lang === 'de' ? 'Kopiert!' : 'Copied!')) : loc.copyBtn}</span>
                            </button>

                            {copied && (
                                <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, textAlign: 'center' }}>
                                    {loc.copiedNotice}
                                </div>
                            )}

                            {/* Pre-formatted Message Preview */}
                            <div style={{
                                background: '#030712',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                padding: '1rem',
                                fontFamily: 'monospace',
                                fontSize: '0.72rem',
                                color: '#e2e8f0',
                                whiteSpace: 'pre-wrap',
                                lineHeight: '1.5',
                                maxHeight: '280px',
                                overflowY: 'auto'
                            }}>
                                {dynamicSharePost}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    background: 'rgba(15, 23, 42, 0.6)'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            padding: '0.55rem 1.25rem',
                            borderRadius: '8px',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                        }}
                    >
                        {loc.close}
                    </button>
                </div>
            </div>
        </div>
    );
};
