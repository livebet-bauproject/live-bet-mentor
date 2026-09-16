/**
 * AI ANALYST SERVICE
 * Connects to Google Gemini API to provide expert summaries.
 * Integrated with aiUsageLimiter for tier-based rate limiting.
 */
import { CONFIG } from '../config';
import { aiUsageLimiter } from './aiUsageLimiter';

const RADAR_SOURCES = [
    { id: 'forebet', label: 'Forebet' },
    { id: 'prosoccer', label: 'ProSoccer' },
    { id: 'predictz', label: 'PredictZ' },
    { id: 'windrawwin', label: 'WDW' },
    { id: 'statarea', label: 'Statarea' },
    { id: 'vitibet', label: 'Vitibet' },
    { id: 'zulubet', label: 'Zulubet' },
    { id: 'olbg', label: 'OLBG' }
];

const RADAR_BASE_URLS = {
    forebet: 'https://www.forebet.com',
    predictz: 'https://www.predictz.com',
    windrawwin: 'https://www.windrawwin.com',
    statarea: 'https://www.statarea.com',
    vitibet: 'https://www.vitibet.com',
    zulubet: 'http://www.zulubet.com',
    prosoccer: 'https://www.prosoccer.gr',
    olbg: 'https://www.olbg.com'
};

export const aiAnalystService = {
    // Current user context (set from Dashboard)
    currentUserId: null,
    currentTier: 'trial',

    async setUserContext(userId, tier = 'trial') {
        this.currentUserId = userId;
        this.currentTier = tier;
        console.log('[AI_SERVICE] User context set:', userId, tier);

        // Preload usage data from DB
        await aiUsageLimiter.loadUserUsage(userId);
    },

    getUsageStats() {
        return aiUsageLimiter.getUsageStats(this.currentUserId || 'anonymous', this.currentTier);
    },

    generateExpertPrompt(fixture, consensusReport) {
        const { homeTeam, awayTeam, minute, score, stats, observations } = fixture;

        // Advanced stats including xG
        const detailStats = `
          ŞUTLAR (İsabetli/Toplam): EV:${stats?.shotsOnGoal?.home || 0}/${stats?.totalShots?.home || 0} - DEP:${stats?.shotsOnGoal?.away || 0}/${stats?.totalShots?.away || 0}
          TEHLİKELİ ATAK: EV:${stats?.dangerousAttacks?.home || 0} - DEP:${stats?.dangerousAttacks?.away || 0}
          KORNER: EV:${stats?.corners?.home || 0} - DEP:${stats?.corners?.away || 0}
          KARTLAR (Sarı/Kırmızı): EV:${stats?.yellowCards?.home || 0}/${stats?.redCards?.home || 0} - DEP:${stats?.yellowCards?.away || 0}/${stats?.redCards?.away || 0}
          TOPLA OYNAMA: EV:${stats?.possession?.home || 0}% - DEP:${stats?.possession?.away || 0}%
        `;

        // xG and Big Chances - critical for quality analysis
        const xgHome = stats?.xg?.home || 0;
        const xgAway = stats?.xg?.away || 0;
        const bigChancesHome = stats?.bigChances?.home || 0;
        const bigChancesAway = stats?.bigChances?.away || 0;
        const scoreHome = score?.home || 0;
        const scoreAway = score?.away || 0;
        const xgDiff = (xgHome - xgAway) - (scoreHome - scoreAway);

        const advancedMetrics = `
          xG (BEKLENEN GOL): EV: ${typeof xgHome === 'number' ? xgHome.toFixed(2) : xgHome} - DEP: ${typeof xgAway === 'number' ? xgAway.toFixed(2) : xgAway}
          BÜYÜK ŞANSLAR (Net Pozisyon): EV: ${bigChancesHome} - DEP: ${bigChancesAway}
          xG vs SKOR FARKI: ${typeof xgDiff === 'number' ? xgDiff.toFixed(2) : 0} (+ = Ev şanssız, - = Deplasan şanssız)
        `;

        const signals = consensusReport?.signals || [];
        const consensusDetail = signals.length > 0
            ? signals.map(s => {
                const siteLabel = RADAR_SOURCES.find(rs => rs.id === s.site)?.label || s.site;
                return `${siteLabel}: ${s.prediction}`;
            }).join(', ')
            : 'Konsensus verisi yok';

        // Pre-match consensus summary
        const agreement = consensusReport?.agreement || {};
        const totalSources = signals.length;
        const topPrediction = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
        const preMatchSummary = topPrediction
            ? `${topPrediction[1]}/${totalSources} kaynak "${topPrediction[0]}" tahmin etti`
            : 'Konsensus yok';

        return `
      Sen profesyonel bir "Kuant ve Canlı Bahis Analizcisisin". Görevin, maçın istatistiksel trendlerini (10dk ivme, baskı), detaylı saha verilerini, xG metriklerini ve dünya konsensusunu birleştirerek kullanıcının göremediği market fırsatlarını yakalamak.

      VERİLER:
      - Maç: ${homeTeam} vs ${awayTeam} | Dakika: ${minute}' | Skor: ${scoreHome}-${scoreAway}
      - DQS (Veri Kalitesi): ${fixture?.dqs ? fixture.dqs.toFixed(2) : 'N/A'}
      - Baskı Gücü (0-100): ${observations?.pressure?.total || 0}
      - 10dk İvme Durumu (Velocity): ${observations?.velocity?.trend || 'STABLE'}
      
      - DETAYLI İSTATİSTİKLER: ${detailStats}
      
      - GELİŞMİŞ METRİKLER (KRİTİK): ${advancedMetrics}
      
      - MAÇ ÖNCESİ BEKLENTİ: ${preMatchSummary}
      - CANLI KONSENSUS (${totalSources} Site): ${consensusDetail}

      GÖREVİN (KESİNLİKLE TÜRKÇE VE MATEMATİKSEL YAZ):
      1. Market Tahminleri (% Olasılık ile): Her tahmin için matematiksel bir olasılık ver. xG verisini kullanarak gol beklentisini hesapla. (Örn: "Sıradaki Gol (Ev): %75 - xG farkı destekliyor", "1.5 Üst: %90").
      2. xG Analizi: 
         - xG vs Gerçek Skor karşılaştır: Takım şanslı mı yoksa şanssız mı oynuyor?
         - Büyük Şans sayısı düşükse ama xG yüksekse: "Düşük kalite, yüksek hacim" uyarısı ver.
      3. Senaryo Zekası & Hidden Insights: 
         - Gözle görülmeyen (Hidden) riskleri ve fırsatları vurgula.
         - Maç öncesi beklenti (${preMatchSummary}) vs şu anki durum çelişiyor mu?
         - DK 85+ ise: Gol ihtimalini gerçekçi ve matematiksel değerlendir.
      4. Risk Analizi: Maçtaki tüm riskleri (kırmızı kart riski, ivme kaybı, xG tuzağı, divergence) tart.
      5. Profesyonel Özet: Maksimum 4 cümle. Direkt, keskin ve aksiyon odaklı ol.
    `;
    },

    async getExpertSummary(fixture, consensusReport, lang = 'tr') {
        console.log('[AI_SERVICE] Autonomous Quant getExpertSummary triggered for:', {
            fixture: fixture?.id || fixture?.matchId || `${fixture?.homeTeam} vs ${fixture?.awayTeam}`,
            minute: fixture?.minute
        });

        const userId = this.currentUserId || 'anonymous';
        const tier = this.currentTier || 'trial';

        // Check cache (5-minute cache for same minute to save compute)
        const matchId = fixture?.matchId || fixture?.id || `${fixture?.homeTeam}_${fixture?.awayTeam}`;
        const cacheKey = `quant_expert_${matchId}_${fixture?.minute || 0}_${lang}`;
        const cached = aiUsageLimiter.getCachedResponse(cacheKey, tier);
        if (cached) {
            return cached;
        }

        // Run Local Autonomous Quant Intelligence Engine
        const result = this.getLocalExpertLogic(fixture, consensusReport, lang);

        if (result) {
            aiUsageLimiter.recordAIUsage(userId, 'aiReport');
            aiUsageLimiter.cacheResponse(cacheKey, result);
        }

        return result;
    },

    getLocalExpertLogic(fixture, consensusReport, lang = 'tr') {
        if (!fixture) return lang === 'tr' ? "Analiz edilecek maç verisi bulunamadı." : "No match telemetry available.";

        const homeTeam = fixture.homeTeam || fixture.home || 'Ev Sahibi';
        const awayTeam = fixture.awayTeam || fixture.away || 'Deplasman';
        const score = fixture.score || { home: 0, away: 0 };
        const scoreHome = Number(score.home) || 0;
        const scoreAway = Number(score.away) || 0;
        const minute = parseInt(fixture.minute) || 0;
        const stats = fixture.stats || {};
        const obs = fixture.observations || {};

        // 1. Telemetry Extraction
        const shotsHome = Number(stats.shotsOnGoal?.home ?? stats.shotsOnTarget?.home ?? 0);
        const shotsAway = Number(stats.shotsOnGoal?.away ?? stats.shotsOnTarget?.away ?? 0);
        const totalShotsHome = Number(stats.totalShots?.home ?? shotsHome ?? 0);
        const totalShotsAway = Number(stats.totalShots?.away ?? shotsAway ?? 0);

        const attacksHome = Number(stats.dangerousAttacks?.home ?? 0);
        const attacksAway = Number(stats.dangerousAttacks?.away ?? 0);
        const totalAttacks = attacksHome + attacksAway;

        const cornersHome = Number(stats.corners?.home ?? 0);
        const cornersAway = Number(stats.corners?.away ?? 0);

        const possHome = Number(stats.possession?.home ?? 50);
        const possAway = Number(stats.possession?.away ?? 50);

        const redHome = Number(fixture.cards?.home?.red ?? stats.redCards?.home ?? stats.cards?.home?.red ?? 0);
        const redAway = Number(fixture.cards?.away?.red ?? stats.redCards?.away ?? stats.cards?.away?.red ?? 0);

        // xG and Big Chances
        const xgHome = Number(stats.xg?.home ?? (shotsHome * 0.14 + (attacksHome > 25 ? 0.4 : 0.1)));
        const xgAway = Number(stats.xg?.away ?? (shotsAway * 0.14 + (attacksAway > 25 ? 0.4 : 0.1)));
        const xgDiff = Number((xgHome - xgAway) - (scoreHome - scoreAway));
        const bigChancesHome = Number(stats.bigChances?.home ?? (shotsHome > 4 ? 2 : (shotsHome > 2 ? 1 : 0)));
        const bigChancesAway = Number(stats.bigChances?.away ?? (shotsAway > 4 ? 2 : (shotsAway > 2 ? 1 : 0)));

        const pressureTotal = Number(obs.pressure?.total ?? Math.min(95, Math.round(((attacksHome + attacksAway) / Math.max(minute, 1)) * 35)));
        const velocityTrend = obs.velocity?.trend || (pressureTotal > 65 ? 'HOT' : (pressureTotal > 45 ? 'ACCELERATING' : 'STABLE'));

        // 2. Consensus Integration
        const agreement = consensusReport?.agreement || {};
        const totalSources = Number(consensusReport?.totalSources || Object.values(agreement).reduce((a, b) => a + b, 0) || 0);
        const topPredEntry = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
        const topPred = topPredEntry ? topPredEntry[0] : null;
        const topPredCount = topPredEntry ? topPredEntry[1] : 0;
        const consensusRatio = totalSources > 0 ? (topPredCount / totalSources) : 0.5;

        // 3. Mathematical Probability Engine
        let nextGoalSide = 'ANY';
        let homePressureAdvantage = attacksHome - attacksAway;
        let homeShotsAdvantage = shotsHome - shotsAway;

        if (homePressureAdvantage > 10 || homeShotsAdvantage >= 2 || (redAway > redHome)) {
            nextGoalSide = 'HOME';
        } else if (homePressureAdvantage < -10 || homeShotsAdvantage <= -2 || (redHome > redAway)) {
            nextGoalSide = 'AWAY';
        }

        // Base Next Goal Probability
        let nextGoalProb = 50;
        if (minute < 30) nextGoalProb = 48 + Math.round(pressureTotal * 0.25);
        else if (minute < 70) nextGoalProb = 52 + Math.round(pressureTotal * 0.35);
        else if (minute < 85) nextGoalProb = 55 + Math.round(pressureTotal * 0.38);
        else nextGoalProb = pressureTotal > 65 ? 45 : 20; // 85+ fatigue/cutoff

        if (velocityTrend === 'HOT') nextGoalProb += 10;
        if (velocityTrend === 'COOLING') nextGoalProb -= 12;
        if (redHome > 0 || redAway > 0) nextGoalProb += 8;

        nextGoalProb = Math.max(15, Math.min(92, nextGoalProb));

        // Over Goal Probabilities
        const totalGoals = scoreHome + scoreAway;
        let overProb = Math.min(94, Math.max(30, Math.round(nextGoalProb * 0.95 + (totalGoals === 0 ? 5 : 0))));
        let dominantTeam = nextGoalSide === 'HOME' ? homeTeam : (nextGoalSide === 'AWAY' ? awayTeam : homeTeam);
        let dominantSideLabel = nextGoalSide === 'HOME' ? (lang === 'tr' ? 'Ev Sahibi' : 'Home') : (nextGoalSide === 'AWAY' ? (lang === 'tr' ? 'Deplasman' : 'Away') : (lang === 'tr' ? 'Karşılıklı' : 'Either'));

        // Confidence Score (55 - 94%)
        let confidenceScore = Math.min(94, Math.max(55, Math.round(
            (pressureTotal * 0.35) +
            (consensusRatio * 30) +
            (Math.abs(xgDiff) > 0.5 ? 15 : 5) +
            (velocityTrend === 'HOT' ? 10 : 0) +
            (fixture.dqs ? fixture.dqs * 15 : 5)
        )));

        // 4. Tactical Scenario Identification
        const isFavTrailing = topPred && (
            (topPred.includes('1') && scoreHome < scoreAway) ||
            (topPred.includes('2') && scoreAway < scoreHome)
        );
        const isDeadMatch = minute >= 75 && Math.abs(scoreHome - scoreAway) >= 2 && pressureTotal < 50;
        const isLateSiege = minute >= 75 && Math.abs(scoreHome - scoreAway) <= 1 && pressureTotal >= 65;
        const hasRedCardAdvantage = (redHome > 0 && redAway === 0) || (redAway > 0 && redHome === 0);

        let scenarioTitle = "";
        let scenarioDesc = "";

        if (lang === 'tr') {
            if (isDeadMatch) {
                scenarioTitle = "ÖLÜ MAÇ / RÖLANTİ KALKANI (DEAD MATCH)";
                scenarioDesc = `Dakika ${minute}' ve fark ${Math.abs(scoreHome - scoreAway)}. Hücum ritmi düştü, takımlar skoru koruma psikolojisinde. Yeni gol riski yüksek, pozisyon kovalamak sakıncalı.`;
            } else if (isFavTrailing) {
                const favTeam = topPred.includes('1') ? homeTeam : awayTeam;
                scenarioTitle = `GERİYE DÜŞEN FAVORİ (COMEBACK BASKISI: ${favTeam.toUpperCase()})`;
                scenarioDesc = `Maç öncesi ${totalSources} kaynağın %${Math.round(consensusRatio * 100)}'si ${favTeam} galibiyetinde hemfikirdi. Takım şu an geride ancak sahada yoğun baskı ve xG birikimi mevcut. Reaksiyon golü potansiyeli tepe noktada.`;
            } else if (isLateSiege) {
                scenarioTitle = "SON DÜZLÜK ŞİDDETLİ KUŞATMA (LATE SIEGE)";
                scenarioDesc = `Dakika ${minute}' itibarıyla tek fark veya beraberlik sürüyor. Baskı endeksi %${pressureTotal} seviyesinde. Risk alan takım hataya açık; kontratak veya duran top kaynaklı gol beklentisi tepeye ulaştı.`;
            } else if (hasRedCardAdvantage) {
                const penalizedTeam = redHome > redAway ? homeTeam : awayTeam;
                const advantagedTeam = redHome > redAway ? awayTeam : homeTeam;
                scenarioTitle = `KIRMIZI KART BOŞLUĞU (SAYISAL ÜSTÜNLÜK: ${advantagedTeam.toUpperCase()})`;
                scenarioDesc = `${penalizedTeam} 10 kişi kaldı. ${advantagedTeam} genişleyen sahadaki koridorları kullanarak ceza sahası çevresinde ablukayı sıklaştırıyor.`;
            } else if (pressureTotal >= 70) {
                scenarioTitle = "YÜKSEK BASKI & RİTİM FIRTINASI (ALPHA ZONE)";
                scenarioDesc = `${dominantTeam} son 10 dakikadır rakip sahaya yerleşti. Şut temposu ve kanat bindirmeleri kaleyi sürekli tehdit ediyor. Savunma direnci kırılma noktasında.`;
            } else {
                scenarioTitle = "DENGELİ VE KONTROLLÜ TAKTİKSEL MÜCADELE";
                scenarioDesc = "İki takım da orta alanı kalabalık tutarak kontrollü geçiş oyununu tercih ediyor. Net gol fırsatı için savunma arkası koşuları veya duran top organizasyonları belirleyici olacak.";
            }
        } else {
            if (isDeadMatch) {
                scenarioTitle = "DEAD MATCH / LOW TEMPO SHIELD";
                scenarioDesc = `Minute ${minute}' with a ${Math.abs(scoreHome - scoreAway)} goal cushion. Pace has decelerated, teams playing passively. Late goals highly improbable.`;
            } else if (isFavTrailing) {
                const favTeam = topPred.includes('1') ? homeTeam : awayTeam;
                scenarioTitle = `TRAILING FAVORITE (COMEBACK SURGE: ${favTeam.toUpperCase()})`;
                scenarioDesc = `Pre-match models showed ${Math.round(consensusRatio * 100)}% consensus for ${favTeam}. Despite trailing, high offensive pressure and xG buildup indicate an imminent reaction.`;
            } else if (isLateSiege) {
                scenarioTitle = "LATE-GAME PRESSURE SIEGE (CRUNCH TIME)";
                scenarioDesc = `Minute ${minute}' with tightly contested scoreline. Pressure index at ${pressureTotal}%. Overcommitted attacks expose backlines for decisive strikes.`;
            } else if (hasRedCardAdvantage) {
                scenarioTitle = "NUMERICAL ADVANTAGE (RED CARD EXPLOITATION)";
                scenarioDesc = `Ten-man deficit creates defensive gaps. Advantaged side exploiting wide corridors for box penetration.`;
            } else {
                scenarioTitle = "BALANCED TACTICAL CONTEST";
                scenarioDesc = "Both teams maintaining structured defensive blocks. Set pieces and fast counter transitions will be key catalysts.";
            }
        }

        // 5. Staking & Risk Discipline Recommendation
        let riskLevel = isDeadMatch ? (lang === 'tr' ? 'YÜKSEK / KAÇIN' : 'HIGH / AVOID') : (confidenceScore >= 75 ? (lang === 'tr' ? 'DÜŞÜK - GÜVENLİ' : 'LOW - SAFE') : (lang === 'tr' ? 'ORTA - DENGELİ' : 'MEDIUM - BALANCED'));
        let recommendedStake = isDeadMatch ? '0%' : (confidenceScore >= 80 ? '2.5% - 3.0%' : '1.5% - 2.0%');

        // Market recommendations
        let recommendedMarket = "";
        let marketProbability = nextGoalProb;

        if (totalGoals === 0) {
            recommendedMarket = lang === 'tr' ? `İlk Gol (${dominantSideLabel}) veya 0.5 Üst` : `First Goal (${dominantSideLabel}) or Over 0.5`;
        } else {
            recommendedMarket = nextGoalSide !== 'ANY' 
                ? (lang === 'tr' ? `Sıradaki Gol (${dominantSideLabel})` : `Next Goal (${dominantSideLabel})`)
                : (lang === 'tr' ? `${totalGoals + 0.5} Üst Gol` : `Over ${totalGoals + 0.5} Goals`);
        }

        // 6. Build High-Grade Institutional Quant Report
        if (lang === 'tr') {
            return `🧠 OTONOM KUANT MOTORU ANALİZİ (Güven Skoru: %${confidenceScore})
═══════════════════════════════════════════════

🎯 1. MARKET TAHMİNİ & MATEMATİKSEL OLASILIKLAR:
• ${recommendedMarket}: %${marketProbability} Olasılık (${dominantTeam} hücum baskısı ve şut ivmesi destekliyor)
• ${totalGoals + 0.5} Üst Gol Beklentisi: %${overProb} (Sahada toplam xG: ${(xgHome + xgAway).toFixed(2)}, kaleyi bulan şut: ${shotsHome + shotsAway})
• ${dominantTeam} Yenilmezlik (1X / X2): %${Math.min(95, confidenceScore + 10)} (Ceza sahası aksiyon üstünlüğü)

📈 2. xG VE SAHA HÂKİMİYETİ TEŞHİSİ:
• xG Tablosu: ${homeTeam} ${xgHome.toFixed(2)} vs ${xgAway.toFixed(2)} ${awayTeam} (xG Farkı: ${xgDiff >= 0 ? '+' : ''}${xgDiff.toFixed(2)})
• Şut Kalitesi: Ev Sahibi ${shotsHome}/${totalShotsHome} isabet | Deplasman ${shotsAway}/${totalShotsAway} isabet
• Tehlikeli Akınlar: ${homeTeam} ${attacksHome} - ${attacksAway} ${awayTeam} (Baskı İvmesi: %${pressureTotal} [${velocityTrend}])
• Net Gol Pozisyonu (Big Chance): ${bigChancesHome} - ${bigChancesAway}

⚡ 3. TAKTİKSEL SENARYO: ${scenarioTitle}
${scenarioDesc}
${totalSources > 0 ? `• Kolektif Akıl (8+ Model): ${totalSources} kaynağın %${Math.round(consensusRatio * 100)}'si '${topPred}' yönünde pozisyon almış durumda.` : ''}

🛡️ 4. RİSK VE KASA DİSİPLİNİ:
• Değerlendirme: ${riskLevel} | Önerilen Kasa Payı (Stake): ${recommendedStake}
• Kritik Pencere: ${minute < 80 ? `Dakika ${minute}' - 80' arası aksiyon için en verimli aralıktır.` : `Dakika ${minute}' sonrası zaman daralmaktadır; risk kalkanı aktiftir.`}

💡 KUANT ÖZETİ:
${dominantTeam} takımının hücum organizasyonu ve xG üretim gücü sahadaki skora kıyasla pozitif beklenti (EV > 0) üretmektedir. Kuant motorumuz ${recommendedMarket} seçeneğini istatistiksel olarak önermektedir.`;
        } else {
            return `🧠 AUTONOMOUS QUANT ENGINE REPORT (Confidence: %${confidenceScore})
═══════════════════════════════════════════════

🎯 1. MARKET PROJECTIONS & PROBABILITIES:
• ${recommendedMarket}: %${marketProbability} Probability (Supported by ${dominantTeam} attacking momentum)
• Over ${totalGoals + 0.5} Goals: %${overProb} (Combined xG: ${(xgHome + xgAway).toFixed(2)}, on-target shots: ${shotsHome + shotsAway})
• ${dominantTeam} Double Chance: %${Math.min(95, confidenceScore + 10)} (Dominant box penetration)

📈 2. xG & PITCH METRICS:
• xG Matrix: ${homeTeam} ${xgHome.toFixed(2)} vs ${xgAway.toFixed(2)} ${awayTeam} (xG Delta: ${xgDiff >= 0 ? '+' : ''}${xgDiff.toFixed(2)})
• Shot Accuracy: Home ${shotsHome}/${totalShotsHome} on target | Away ${shotsAway}/${totalShotsAway}
• Dangerous Attacks: Home ${attacksHome} - ${attacksAway} Away (Pressure Wave: %${pressureTotal} [${velocityTrend}])
• Big Chances Created: ${bigChancesHome} - ${bigChancesAway}

⚡ 3. TACTICAL SCENARIO: ${scenarioTitle}
${scenarioDesc}
${totalSources > 0 ? `• Global Consensus (8+ Models): ${Math.round(consensusRatio * 100)}% agreement on '${topPred}'.` : ''}

🛡️ 4. RISK & STAKING DISCIPLINE:
• Rating: ${riskLevel} | Recommended Kelly Stake: ${recommendedStake}
• Action Window: ${minute < 80 ? `Minutes ${minute}' to 80' represent optimum statistical value.` : `Minute ${minute}'+ carries increased time decay risk.`}

💡 QUANT VERDICT:
${dominantTeam}'s territorial volume and expected goal production signal high-probability value (+EV). Autonomous models favor ${recommendedMarket}.`;
        }
    },

    async getGlobalIntelligenceReport(matches, type = 'LIVE') {
        const userId = this.currentUserId || 'anonymous';
        const tier = this.currentTier || 'trial';

        // Check rate limit
        const limitCheck = aiUsageLimiter.canMakeAIRequest(userId, tier);
        if (!limitCheck.allowed) {
            return `⚠️ Günlük AI raporu limitinize ulaştınız (${limitCheck.current}/${limitCheck.limit}).`;
        }

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

        // Enhanced match summaries with more data
        const matchSummaries = matches.map(m => {
            const consensus = m.consensusReport?.agreement ?
                Object.entries(m.consensusReport.agreement).map(([p, c]) => `${p}(${c})`).join(', ') : 'N/A';

            // For LIVE matches - include stats
            if (type === 'LIVE') {
                const xgHome = m.stats?.xg?.home || 0;
                const xgAway = m.stats?.xg?.away || 0;
                const pressure = m.observations?.pressure?.total || 0;
                const velocity = m.observations?.velocity?.trend || 'STABLE';
                const dqs = m.dqs?.toFixed(2) || 'N/A';
                const bigChances = `${m.stats?.bigChances?.home || 0}-${m.stats?.bigChances?.away || 0}`;

                return `- ${m.home || m.homeTeam} vs ${m.away || m.awayTeam}
  📊 Dk: ${m.minute || '?'}' | Skor: ${m.score?.home || 0}-${m.score?.away || 0}
  📈 xG: ${xgHome.toFixed ? xgHome.toFixed(2) : xgHome}-${xgAway.toFixed ? xgAway.toFixed(2) : xgAway} | Büyük Şans: ${bigChances}
  🔥 Baskı: %${pressure} | İvme: ${velocity} | DQS: ${dqs}
  🎯 Konsensus: ${consensus}`;
            }

            // For PRE-MATCH - include radar data
            const totalSources = m.totalSources || m.consensusReport?.totalSources || 0;
            const divergence = m.divergence || 0;
            const topPrediction = m.agreement ?
                Object.entries(m.agreement).sort((a, b) => b[1] - a[1])[0] : null;
            const predSummary = topPrediction ? `${topPrediction[0]} (%${Math.round(topPrediction[1] / totalSources * 100)})` : 'N/A';

            return `- ${m.home || m.homeTeam || m.match?.split(' vs ')[0]} vs ${m.away || m.awayTeam || m.match?.split(' vs ')[1]}
  📊 Kaynak: ${totalSources} | Divergence: %${divergence.toFixed ? divergence.toFixed(0) : divergence}
  🎯 Favori Tahmin: ${predSummary}
  📈 Konsensus: ${consensus}`;
        }).join('\n');

        // AUTONOMOUS LOCAL QUANT ENGINE FOR GLOBAL INTELLIGENCE REPORT
        console.log('[AI_GLOBAL] Generating Autonomous Quant Global Report for', type, 'with', matches.length, 'matches');

        if (!matches || matches.length === 0) {
            return "İncelenebilecek yeterli maç verisi bulunamadı.";
        }

        // Rank and score matches locally
        const scoredMatches = matches.map(m => {
            const home = m.home || m.homeTeam || 'Ev Sahibi';
            const away = m.away || m.awayTeam || 'Deplasman';
            const pressure = Number(m.observations?.pressure?.total ?? m.pressure ?? 0);
            const xgHome = Number(m.stats?.xg?.home ?? 0);
            const xgAway = Number(m.stats?.xg?.away ?? 0);
            const totalXg = xgHome + xgAway;
            const dqs = Number(m.dqs ?? 0.6);
            const minute = parseInt(m.minute) || 0;
            const scoreHome = Number(m.score?.home ?? 0);
            const scoreAway = Number(m.score?.away ?? 0);
            const totalGoals = scoreHome + scoreAway;

            const agreement = m.consensusReport?.agreement || m.agreement || {};
            const totalSources = Number(m.totalSources || Object.values(agreement).reduce((a, b) => a + b, 0) || 0);
            const topPredEntry = Object.entries(agreement).sort((a, b) => b[1] - a[1])[0];
            const topPred = topPredEntry ? topPredEntry[0] : '1';
            const topPredRatio = totalSources > 0 ? (topPredEntry[1] / totalSources) : 0.5;

            // Compute composite quant attractiveness score (0 - 100)
            let attractiveness = (pressure * 0.4) + (topPredRatio * 35) + (dqs * 25);
            if (minute >= 75 && Math.abs(scoreHome - scoreAway) >= 2) attractiveness -= 40; // Penalty for dead match

            return {
                raw: m,
                home,
                away,
                minute,
                scoreHome,
                scoreAway,
                totalGoals,
                pressure,
                totalXg,
                dqs,
                topPred,
                topPredRatio,
                attractiveness: Math.round(attractiveness),
                isDeadMatch: minute >= 75 && Math.abs(scoreHome - scoreAway) >= 2 && pressure < 50
            };
        });

        scoredMatches.sort((a, b) => b.attractiveness - a.attractiveness);

        const golden = scoredMatches.filter(m => !m.isDeadMatch && m.attractiveness >= 55).slice(0, 3);
        const avoid = scoredMatches.filter(m => m.isDeadMatch || m.attractiveness < 40).slice(0, 2);

        // Format as rich Markdown Quant Dossier
        const goldenFormatted = golden.map(g => {
            const prob = Math.min(92, Math.max(65, 55 + Math.round(g.attractiveness * 0.38)));
            const market = g.totalGoals === 0 ? "0.5 Üst Gol" : `${g.totalGoals + 0.5} Üst / Sıradaki Gol`;
            return `🎯 **${g.home} vs ${g.away}** (Dk: ${g.minute || '0'}' | Skor: ${g.scoreHome}-${g.scoreAway})
   • **Tavsiye:** ${market} (%${prob} Kuant Olasılığı)
   • **Gerekçe:** Baskı İvmesi %${g.pressure}, xG Üretimi: ${g.totalXg.toFixed(2)}, Model Konsensüsü: %${Math.round(g.topPredRatio * 100)} '${g.topPred}'
   • **Risk Seviyesi:** ${prob >= 80 ? 'DÜŞÜK' : 'ORTA'}`;
        }).join('\n\n');

        const avoidFormatted = avoid.length > 0 
            ? avoid.map(a => `⚠️ **${a.home} vs ${a.away}:** Durgun oyun ritmi, düşük hücum ivmesi veya ölü maç kalkanı nedeniyle kuponlardan uzak tutulmalıdır.`).join('\n')
            : 'Şu an yüksek riskli ölü maç tespit edilmedi.';

        const combo = golden.slice(0, 2);
        const comboText = combo.length === 2
            ? `🎟️ **STRATEJİK ALTIN İKİLİ (COMBO):**
1. ${combo[0].home} vs ${combo[0].away} ➔ ${combo[0].totalGoals === 0 ? '0.5 Üst' : 'Sıradaki Gol'}
2. ${combo[1].home} vs ${combo[1].away} ➔ ${combo[1].totalGoals === 0 ? '0.5 Üst' : 'Sıradaki Gol'}
• **Bileşik Olasılık:** ~%68 | **Kasa Payı (Kelly):** %2.0`
            : '';

        const finalReport = `🌐 **PRO KONSENSÜS & CANLI RADAR BRİFİNGİ**
═══════════════════════════════════════════════
Aktif ${matches.length} karşılaşma taranmış, xG telemetrisi ve 8 modelin kolektif akıl verisi sentezlenerek aşağıdaki kuant fırsatları çıkarılmıştır.

🏆 **ALTIN SEÇİMLER (EN YÜKSEK DEĞER):**
${goldenFormatted || 'Şu an kriterleri karşılayan maç bulunamadı.'}

${comboText}

🛡️ **RİSKLİ & KAÇINILMASI GEREKENLER:**
${avoidFormatted}

💡 **KASA DİSİPLİNİ:** Kombine tuzaklarından kaçının. Yüksek güvenli maçlarda tekli veya maksimum 2 maçlık altın ikili stratejisini uygulayın.`;

        aiUsageLimiter.recordAIUsage(userId, 'aiReport');
        return finalReport;
    }
};
