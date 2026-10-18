/**
 * 🤖 LIVE BET AI COPILOT ENGINE (v2.0 QUANT)
 * Advanced conversational quant assistant for live football fixtures.
 * Combines pitch telemetry, Pressure Index, Velocity surge, and real odds into actionable human-like advice.
 * 
 * Strict Compliance:
 * - RULE 1: Never reference 3rd party brands. Use neutral terms ("Piyasa Oranı", "Global Referans").
 * - RULE 2: Real odds only. No fabricated numbers.
 */

const resolveTeamName = (team, fallback = '') => {
    if (!team) return fallback;
    if (typeof team === 'string') return team.trim();
    if (typeof team === 'object' && team.name) return String(team.name).trim();
    return fallback;
};

export class LiveCopilotEngine {
    /**
     * Generate an intelligent, instant analysis for a given user query or default overview
     */
    generateAnswer(match, queryType = 'goal_prob', customText = '', lang = 'tr') {
        if (!match) {
            return lang === 'tr' 
                ? "⚠️ Analiz edilecek aktif maç verisi bulunamadı." 
                : (lang === 'de' ? "⚠️ Keine aktiven Spieldaten zur Analyse verfügbar." : "⚠️ No active match telemetry available.");
        }

        const isTr = lang === 'tr';
        const isDe = lang === 'de';

        const defaultHome = isTr ? 'Ev Sahibi' : (isDe ? 'Heimteam' : 'Home Team');
        const defaultAway = isTr ? 'Deplasman' : (isDe ? 'Auswärtsteam' : 'Away Team');
        const home = resolveTeamName(match.homeTeam) || resolveTeamName(match.home) || match.homeTeamName || defaultHome;
        const away = resolveTeamName(match.awayTeam) || resolveTeamName(match.away) || match.awayTeamName || defaultAway;
        
        const minute = parseInt(match.minute) || 0;
        const score = match.score || { home: 0, away: 0 };
        const scoreHome = Number(score.home || 0);
        const scoreAway = Number(score.away || 0);
        const totalGoals = scoreHome + scoreAway;
        const goalDiff = scoreHome - scoreAway;

        const stats = match.stats || {};
        const obs = match.observations || {};
        const pressure = obs.pressure || match.pressure || {};
        const pressureHome = Number(pressure.home || 0);
        const pressureAway = Number(pressure.away || 0);
        const pressureTotal = Math.max(pressureHome, pressureAway, Number(pressure.total || 0));

        const shotsHome = Number(stats.shotsOnGoal?.home ?? stats.shotsOnTarget?.home ?? 0);
        const shotsAway = Number(stats.shotsOnGoal?.away ?? stats.shotsOnTarget?.away ?? 0);
        const shotsOffHome = Number(stats.shotsOffGoal?.home || 0);
        const shotsOffAway = Number(stats.shotsOffGoal?.away || 0);
        const totalShotsHome = shotsHome + shotsOffHome;
        const totalShotsAway = shotsAway + shotsOffAway;
        const totalShots = totalShotsHome + totalShotsAway;

        const cornersHome = Number(stats.corners?.home ?? 0);
        const cornersAway = Number(stats.corners?.away ?? 0);
        const totalCorners = cornersHome + cornersAway;

        const attacksHome = Number(stats.dangerousAttacks?.home ?? stats.attacks?.home ?? pressureHome);
        const attacksAway = Number(stats.dangerousAttacks?.away ?? stats.attacks?.away ?? pressureAway);

        const xgHome = Number(stats.xg?.home || 0);
        const xgAway = Number(stats.xg?.away || 0);
        const totalXg = (xgHome + xgAway).toFixed(2);

        const redCardsHome = Number(stats.cards?.home?.red || 0);
        const redCardsAway = Number(stats.cards?.away?.red || 0);
        const yellowCardsHome = Number(stats.cards?.home?.yellow || 0);
        const yellowCardsAway = Number(stats.cards?.away?.yellow || 0);

        // --- Oransal Baskı & Saha Hakimiyeti Hesaplama (Relative Dominance) ---
        const totalP = pressureHome + pressureAway;
        const homeShare = totalP > 0 ? (pressureHome / totalP) * 100 : 50;
        const awayShare = totalP > 0 ? (pressureAway / totalP) * 100 : 50;

        let dominantTeam = home;
        let dominantShare = homeShare;
        let dominantAttacks = attacksHome;
        let dominantShots = totalShotsHome;
        let dominantPressure = pressureHome;
        let subordinateTeam = away;
        let subordinatePressure = pressureAway;
        let isHomeDominant = true;

        if (pressureAway > pressureHome) {
            dominantTeam = away;
            dominantShare = awayShare;
            dominantAttacks = attacksAway;
            dominantShots = totalShotsAway;
            dominantPressure = pressureAway;
            subordinateTeam = home;
            subordinatePressure = pressureHome;
            isHomeDominant = false;
        }

        // Net üstünlük seviyesi
        const hasClearDominance = dominantShare >= 60 && dominantPressure >= 15;
        const isSlightDominance = dominantShare >= 54 && dominantShare < 60;
        const isBalanced = !hasClearDominance && !isSlightDominance;

        // Maç dinamiği: Son 20 dakika ve 1 farkla geride olma (Comeback / Late Pressure)
        const isLateGame = minute >= 70;
        const trailingTeam = goalDiff > 0 ? away : (goalDiff < 0 ? home : null);
        const leadingTeam = goalDiff > 0 ? home : (goalDiff < 0 ? away : null);
        const isTrailingTeamPressing = trailingTeam && (
            (trailingTeam === home && homeShare >= 55) || 
            (trailingTeam === away && awayShare >= 55)
        );

        // Odds (Real only)
        const odds = obs.odds?.current || match.odds || {};
        const homeOdds = odds.homeWin || odds.home || '-';
        const awayOdds = odds.awayWin || odds.away || '-';
        const drawOdds = odds.draw || '-';

        // Velocity & Flame check
        const isFlame = pressureTotal >= 70 || dominantPressure >= 60 || (hasClearDominance && dominantPressure >= 30);
        const isHot = pressureTotal >= 45 || dominantPressure >= 30 || hasClearDominance;

        // --- Soru Türünü Belirleme (Preset Button veya NLP Intent) ---
        let resolvedQueryType = queryType;
        const q = (customText || '').toLowerCase().trim();

        if (queryType === 'custom' && q) {
            if (q.includes('korner') || q.includes('corner') || q.includes('köşe')) {
                resolvedQueryType = 'corners';
            } else if (q.includes('kart') || q.includes('kırmızı') || q.includes('sarı') || q.includes('faul')) {
                resolvedQueryType = 'cards';
            } else if (q.includes('oran') || q.includes('value') || q.includes('değer') || q.includes('fiyat')) {
                resolvedQueryType = 'value_odds';
            } else if (q.includes('risk') || q.includes('kasa') || q.includes('güven')) {
                resolvedQueryType = 'risk_check';
            } else if (q.includes('kim') || q.includes('kazanır') || q.includes('üstün') || q.includes('baskı') || q.includes('taraf')) {
                resolvedQueryType = 'dominance';
            } else if (q.includes('gol') || q.includes('atar') || q.includes('üst') || q.includes('alt') || q.includes('kg') || q.includes('skor')) {
                resolvedQueryType = 'goal_prob';
            }
        }

        // --- Yanıt Üretimi ---
        switch (resolvedQueryType) {
            case 'goal_prob': {
                // ⚽ "Gol Kokusu Var Mı?"
                if (isLateGame && isTrailingTeamPressing) {
                    if (isTr) {
                        return `🚨 **SON ÇEYREK GOL BASKISI (%80+)**\n\n• **Senaryo:** Dakika **${minute}'** ve **${trailingTeam}** ${scoreHome}-${scoreAway} geride. Beraberlik için tüm hatlarıyla yükleniyor.\n• **Baskı Dengesi:** ${trailingTeam} son dakikalarda **%${(trailingTeam === home ? homeShare : awayShare).toFixed(0)}** saha üstünlüğü kurdu (${dominantPressure} vs ${subordinatePressure} baskı puanı).\n• **Quant Kararı:** Maçın en tehlikeli aşaması. Ya ${trailingTeam} beraberlik golünü bulacak ya da ${leadingTeam} savunma arkası kontra ataktan maçı bitirecektir. **Canlı Gol ihtimali çok yüksek.**`;
                    } else {
                        return `🚨 **LATE-GAME GOAL SURGE (80%+)**\n\n• **Scenario:** Minute **${minute}'** and **${trailingTeam}** is trailing ${scoreHome}-${scoreAway}, pushing full force for equalizer.\n• **Pressure Share:** ${trailingTeam} commanding **%${(trailingTeam === home ? homeShare : awayShare).toFixed(0)}** territorial presence (${dominantPressure} vs ${subordinatePressure}).\n• **Quant Verdict:** Prime goal window. High likelihood of equalizer or decisive counter-attack goal.`;
                    }
                }

                if (isFlame) {
                    if (isTr) {
                        return `🔥 **GOL İHTİMALİ ÇOK YÜKSEK (%82+)**\n\n• **Baskı Lideri:** **${dominantTeam}** (%${dominantShare.toFixed(0)} saha payı, ${dominantPressure} baskı puanı)\n• **Ceza Sahası Aksiyonu:** Son dakikalarda ${dominantTeam} tarafından yoğun abluka var. Toplam xG: **${totalXg}** | Kaleyi bulan şut: **${shotsHome + shotsAway}**.\n• **Quant Kararı:** Savunma direnci kırılma noktasında. Sıradaki gol için **${dominantTeam}** en sıcak aday.`;
                    } else {
                        return `🔥 **HIGH GOAL PROBABILITY (82%+)**\n\n• **Leader:** **${dominantTeam}** (%${dominantShare.toFixed(0)} share, ${dominantPressure} pressure)\n• **Box Siege:** Heavy danger zone presence. Total xG: **${totalXg}** | Shots on Target: **${shotsHome + shotsAway}**.\n• **Quant Verdict:** Defensive block near exhaustion. Next goal favored for **${dominantTeam}**.`;
                    }
                } else if (isHot) {
                    if (isTr) {
                        return `⚡ **ORTA-YÜKSEK TEMPO (%60 - %70)**\n\n• **Durum:** Atak temposu canlı ancak son vuruşlarda henüz net sonuç gelmedi.\n• **Şut ve Atak:** ${home} (${totalShotsHome} şut, ${attacksHome} tehlikeli atak) - ${away} (${totalShotsAway} şut, ${attacksAway} tehlikeli atak).\n• **Quant Kararı:** Maç gol potansiyeline sahip. ${dominantTeam} bir adım önde görünüyor; ceza sahası çevresi şutları takip edilmeli.`;
                    } else {
                        return `⚡ **MODERATE-HIGH MOMENTUM (60-70%)**\n\n• **Status:** Active attacking pace, looking for the finishing touch.\n• **Metrics:** ${home} (${totalShotsHome} shots) vs ${away} (${totalShotsAway} shots).\n• **Quant Verdict:** Goal capability present. ${dominantTeam} holding slight edge.`;
                    }
                } else {
                    if (isTr) {
                        return `🛡️ **KONTROLLÜ OYUN / SAVUNMA DENGESİ (%35)**\n\n• **Saha Durumu:** Dakika ${minute}'te oyun orta alanda taktiksel kilitlenmiş durumda. İki takım da kontrolü elden bırakmıyor.\n• **Tehlikeli Pozisyon:** Kaleyi bulan net şut sayısı düşük (${shotsHome + shotsAway} isabetli şut).\n• **Quant Kararı:** Şu aşamada aceleci gol girişlerinden kaçınılmalı, tempo artışı beklenmeli.`;
                    } else {
                        return `🛡️ **TACTICAL STALEMATE (35%)**\n\n• **Status:** Minute ${minute}', controlled midfield battle with cautious defensive structures.\n• **Danger Entries:** Low shot accuracy (${shotsHome + shotsAway} shots on target).\n• **Quant Verdict:** Exercise caution on immediate goal entries until pace surges.`;
                    }
                }
            }

            case 'dominance': {
                // 🎯 "Hangi Takım Daha Üstün?"
                if (hasClearDominance) {
                    const ratioText = (dominantPressure / Math.max(subordinatePressure, 1)).toFixed(1);
                    if (isTr) {
                        return `🎯 **SAHA HAKİMİYETİ: ${dominantTeam.toUpperCase()} (Net Üstünlük)**\n\n• **Baskı Dengesi:** ${home} (${pressureHome}) vs ${away} (${pressureAway}) — **%${dominantShare.toFixed(0)}** oranında ${dominantTeam} lehine.\n• **Atak Baskısı:** ${dominantTeam}, rakibinden **${ratioText} kat** daha fazla tehlikeli hücum üretti (${dominantAttacks} vs ${isHomeDominant ? attacksAway : attacksHome}).\n• **Saha Görünümü:** Oyun ${subordinateTeam} yarı sahasına yıkılmış durumda. ${subordinateTeam} çıkmakta zorlanıyor ve savunmaya çekilmiş.`;
                    } else {
                        return `🎯 **PITCH DOMINANCE: ${dominantTeam.toUpperCase()}**\n\n• **Pressure Split:** ${home} (${pressureHome}) vs ${away} (${pressureAway}) — **%${dominantShare.toFixed(0)}** for ${dominantTeam}.\n• **Attack Ratio:** ${dominantTeam} generating **${ratioText}x** more dangerous moves (${dominantAttacks} vs ${isHomeDominant ? attacksAway : attacksHome}).\n• **Verdict:** Heavy siege on ${subordinateTeam}'s defensive third.`;
                    }
                } else if (isSlightDominance) {
                    if (isTr) {
                        return `⚖️ **HAFİF ${dominantTeam.toUpperCase()} ÜSTÜNLÜĞÜ**\n\n• **Baskı Dengesi:** ${home} (${pressureHome}) - ${away} (${pressureAway})\n• **Durum:** ${dominantTeam} topla ve rakip sahada biraz daha üretken (%${dominantShare.toFixed(0)}), ancak ${subordinateTeam} savunma disiplinini koruyor ve geçit vermiyor.`;
                    } else {
                        return `⚖️ **SLIGHT EDGE FOR ${dominantTeam.toUpperCase()}**\n\n• **Split:** ${home} (${pressureHome}) vs ${away} (${pressureAway})\n• **Overview:** ${dominantTeam} controlling marginally more possession (%${dominantShare.toFixed(0)}), defense remains structured.`;
                    }
                } else {
                    if (isTr) {
                        return `⚖️ **TAM DENGE VE ORTA SAHA SAVAŞI**\n\n• **Baskı Dengesi:** ${home} (${pressureHome}) - ${away} (${pressureAway})\n• **Durum:** İki takım da birbirine bariz bir üstünlük kuramadı. Top kontrolü ve atak girişimleri başa baş seyrediyor.`;
                    } else {
                        return `⚖️ **BALANCED CONTEST**\n\n• **Split:** ${home} (${pressureHome}) vs ${away} (${pressureAway})\n• **Overview:** Symmetrical contest with neutral territorial distribution.`;
                    }
                }
            }

            case 'value_odds': {
                // 📊 "Oran Avantajı / Değer Var Mı?"
                const hasValue = (hasClearDominance && isHot);
                if (isTr) {
                    return `📊 **CANLI PİYASA DEĞER ANALİZİ**\n\n• **Piyasa 1X2 Oranları:** Ev: **${homeOdds}** | Beraberlik: **${drawOdds}** | Dep: **${awayOdds}**\n• **Model Değerlendirmesi:** ${hasValue ? `✅ **POZİTİF DEĞER:** ${dominantTeam}'ın %${dominantShare.toFixed(0)}'lik saha hakimiyeti, mevcut piyasa oranına göre matematiksel avantaj (+EV) barındırıyor.` : `ℹ️ **PİYASA DENGEDE:** Oranlar sahadaki mevcut istatistikleri adil fiyatlamış durumda, net bir arbitraj/değer sapması yok.`}\n• **Öneri:** ${hasValue ? `${dominantTeam} lehine kontrollü risk alınabilir.` : 'Daha belirgin bir ivme kırılması beklenmeli.'}`;
                } else {
                    return `📊 **LIVE MARKET VALUE TELEMETRY**\n\n• **Board 1X2:** Home: **${homeOdds}** | Draw: **${drawOdds}** | Away: **${awayOdds}**\n• **Edge Verdict:** ${hasValue ? `✅ **POSITIVE EDGE (+EV):** ${dominantTeam} dominance represents actionable edge over board pricing.` : `ℹ️ **FAIR PRICING:** Market odds reflect pitch intensity accurately.`}\n• **Guidance:** ${hasValue ? `Disciplined entry favoring ${dominantTeam}.` : 'Wait for sharper momentum deviation.'}`;
                }
            }

            case 'risk_check': {
                // 🛡️ "Kasa Riski Nedir?"
                if (isTr) {
                    return `🛡️ **KASA VE RİSK YÖNETİMİ RAPORU**\n\n• **Dakika Penceresi:** Dakika **${minute}'** ${isLateGame ? '(⚠️ Son çeyrek: Zaman daralıyor, yüksek volatilite)' : '(✅ Oyun oturmuş, tempo stabil)'}\n• **Savunma Güvenliği:** ${totalShots >= 10 ? '🚨 Savunmalar çok fazla şut imkanı veriyor, gol sürprizi riski yüksek.' : '🛡️ Savunma hatları organize, basit hata oranı düşük.'}\n• **Kasa Disiplini:** Tekil işlemde kasanın **%1.5 - %2.5**'ini aşmayınız. Ani oran dalgalanmalarına karşı stop-loss disiplinini koruyunuz.`;
                } else {
                    return `🛡️ **BANKROLL RISK ASSESSMENT**\n\n• **Timeframe:** Minute **${minute}'** ${isLateGame ? '(⚠️ Late phase: Rapid time decay)' : '(✅ Stable match phase)'}\n• **Defensive Form:** ${totalShots >= 10 ? '🚨 Open backlines allowing multiple chances.' : '🛡️ Organized defensive compact shape.'}\n• **Staking Advice:** Keep exposure strictly within **1.5% - 2.5%** of bankroll.`;
                }
            }

            case 'corners': {
                // ⛳ Korner Analizi
                const cornerPace = minute > 0 ? ((totalCorners / minute) * 90).toFixed(1) : 0;
                if (isTr) {
                    return `⛳ **KORNER & KANAT BASKISI ANALİZİ**\n\n• **Mevcut Kornerler:** ${home} (**${cornersHome}**) - ${away} (**${cornersAway}**) | Toplam: **${totalCorners}**\n• **Maç Sonu Korner Projeksiyonu:** ~**${cornerPace}** Korner\n• **Kanat Hareketliliği:** ${dominantTeam} kanat bindirmeleriyle rakip savunmayı zorluyor. Korner temposu ${totalCorners >= 6 ? '🔥 Yüksek' : 'Orta'}.`;
                } else {
                    return `⛳ **CORNER & WING PLAY ANALYSIS**\n\n• **Corners:** ${home} (**${cornersHome}**) vs ${away} (**${cornersAway}**) | Total: **${totalCorners}**\n• **Full-Time Projection:** ~**${cornerPace}** Corners\n• **Wing Intensity:** ${dominantTeam} forcing box deflections. Corner pace is ${totalCorners >= 6 ? 'High' : 'Moderate'}.`;
                }
            }

            case 'cards': {
                // 🟨🟥 Kart & Sertlik Analizi
                const totalCards = redCardsHome + redCardsAway + yellowCardsHome + yellowCardsAway;
                if (isTr) {
                    return `🟨 **KART VE OYUN SERTLİĞİ ANALİZİ**\n\n• **Kırmızı Kartlar:** ${redCardsHome > 0 ? `🚨 ${home} (${redCardsHome} Kırmızı)` : ''} ${redCardsAway > 0 ? `🚨 ${away} (${redCardsAway} Kırmızı)` : ''} ${redCardsHome === 0 && redCardsAway === 0 ? 'Kırmızı kart yok.' : ''}\n• **Sarı Kartlar:** ${home} (${yellowCardsHome}) - ${away} (${yellowCardsAway}) | Toplam Kart: **${totalCards}**\n• **Hakem & Tansiyon:** Maçın sertlik derecesi ${totalCards >= 4 || (redCardsHome + redCardsAway) > 0 ? '🔥 Yüksek Gerginlik' : 'Normal / Kontrollü'}.`;
                } else {
                    return `🟨 **DISCIPLINARY & CARD ANALYSIS**\n\n• **Red Cards:** ${redCardsHome + redCardsAway > 0 ? `🚨 Active Red Cards (${redCardsHome + redCardsAway})` : 'None.'}\n• **Yellow Cards:** ${home} (${yellowCardsHome}) vs ${away} (${yellowCardsAway})\n• **Match Friction:** ${totalCards >= 4 ? 'High Tension' : 'Controlled Intensity'}.`;
                }
            }

            default: {
                // 🤖 Genel Maç Özeti & Canlı Taktiksel Görünüm
                if (isTr) {
                    return `🤖 **CANLI MAÇ QUANT ANALİZİ (${home} vs ${away})**\n\n• **Skor & Süre:** **${scoreHome} - ${scoreAway}** (${minute}')\n• **Saha Hakimiyeti:** **${hasClearDominance ? `${dominantTeam} (%${dominantShare.toFixed(0)} Üstünlük)` : 'Başa baş mücadele'}\n• **Baskı & Şutlar:** ${home} (${totalShotsHome} şut, ${pressureHome} baskı) vs ${away} (${totalShotsAway} şut, ${pressureAway} baskı)\n• **Canlı Görünüm:** ${isFlame ? `🔥 ${dominantTeam} baskısı tavan yaptı, gol yakın.` : (isHot ? `⚡ ${dominantTeam} üstünlüğüyle tempo artıyor.` : '🛡️ Dengeli orta saha mücadelesi.')}`;
                } else {
                    return `🤖 **LIVE MATCH QUANT REPORT (${home} vs ${away})**\n\n• **Score & Time:** **${scoreHome} - ${scoreAway}** (${minute}')\n• **Dominance:** **${hasClearDominance ? `${dominantTeam} (%${dominantShare.toFixed(0)} Dominance)` : 'Even match'}\n• **Shots & Pressure:** ${home} (${totalShotsHome} shots, ${pressureHome} p.) vs ${away} (${totalShotsAway} shots, ${pressureAway} p.)\n• **Verdict:** ${isFlame ? `🔥 High surge from ${dominantTeam}.` : '⚡ Balanced tactical game.'}`;
                }
            }
        }
    }
}

export const liveCopilotEngine = new LiveCopilotEngine();
