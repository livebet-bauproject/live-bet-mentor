/**
 * 🤖 GEMINI TRADING DESK & NEURAL SYNTHESIS BRIDGE (v1.0)
 * Integrates Google Gemini LLM with the Institutional Quantitative Trading Desk.
 * 
 * Features:
 * - Dynamic API Key resolution (Admin Settings -> .env -> Fallback)
 * - Live Connection & Latency Tester
 * - Multi-Agent Committee Prompt (Quant Analyst + Tactical Scout + Risk Director)
 * - Local Algorithmic Synthesis Fallback (Zero Downtime guarantee)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_FILE = path.join(__dirname, 'gemini_config.json');

export class GeminiTradingBridge {
    constructor() {
        this.activeModel = 'gemini-1.5-flash';
        this.fallbackModel = 'gemini-2.0-flash';
    }

    /**
     * Resolve active Gemini API Key
     */
    getApiKey() {
        // 1. Check saved config file from Admin Panel
        try {
            if (fs.existsSync(CONFIG_FILE)) {
                const conf = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
                if (conf.apiKey && conf.apiKey.trim().length > 10) {
                    return conf.apiKey.trim();
                }
            }
        } catch (e) {}

        // 2. Check environment variables
        const envKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
        if (envKey && envKey.trim().length > 10) {
            return envKey.trim();
        }

        return null;
    }

    /**
     * Save API Key from Admin Panel
     */
    saveApiKey(apiKey) {
        try {
            const cleanKey = (apiKey || '').trim();
            const payload = {
                apiKey: cleanKey,
                updatedAt: new Date().toISOString()
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(payload, null, 2), 'utf8');
            return { success: true, message: 'Gemini API anahtarı başarıyla kaydedildi.' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Test connection to Gemini API
     */
    async testConnection(targetKey = null) {
        const key = targetKey ? targetKey.trim() : this.getApiKey();
        if (!key) {
            return {
                connected: false,
                error: 'Gemini API anahtarı tanımlanmamış. Lütfen geçerli bir Google AI Studio anahtarı giriniz.'
            };
        }

        const start = Date.now();
        try {
            const fetchMod = (await import('node-fetch')).default;
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
            const res = await fetchMod(url, { method: 'GET', timeout: 8000 });
            const data = await res.json();
            const latencyMs = Date.now() - start;

            if (data.models && Array.isArray(data.models)) {
                const availableModels = data.models
                    .map(m => m.name.replace('models/', ''))
                    .filter(name => name.includes('gemini'));

                return {
                    connected: true,
                    latencyMs,
                    keyPrefix: key.substring(0, 8) + '...',
                    models: availableModels.slice(0, 8),
                    message: `Gemini API bağlantısı başarılı! (${latencyMs}ms)`
                };
            } else {
                return {
                    connected: false,
                    latencyMs,
                    error: data.error?.message || 'Geçersiz veya yetkisiz Gemini API anahtarı.'
                };
            }
        } catch (err) {
            return {
                connected: false,
                latencyMs: Date.now() - start,
                error: `Bağlantı hatası: ${err.message}`
            };
        }
    }

    /**
     * Build Prompt for Multi-Agent Sportsbook Committee
     */
    buildCommitteePrompt(matches, deskSummary) {
        const formattedMatches = matches.map((m, idx) => {
            const rationaleText = Array.isArray(m.rationale) ? m.rationale.join(', ') : 'Telemetry destekli';
            return `Karşılaşma #${idx + 1}:
  - Maç: ${m.homeTeam} vs ${m.awayTeam} (${m.league})
  - Dakika: ${m.minute}' | Canlı Skor: ${m.score}
  - Hedef Market: ${m.marketLabel} (Piyasa Oranı: @${m.marketOdds} | Model Adil Oranı: @${m.fairOdds})
  - Kuant Olasılığı: %${m.trueProb} | Beklenen Değer (+EV): +%${m.evPercent}
  - Sinyal Seviyesi: ${m.badge} | Önerilen Kelly Kasa Payı: %${m.recommendedStakePercent}
  - Saha Telemetrisi: Dominans: %${m.dominanceIndex}, İvme Dalgası: %${m.pressureWave}
  - Şut / İsabet: ${m.stats?.shots} (${m.stats?.sot} isabet) | Ceza Sahası Temas: ${m.stats?.box}
  - xG Durumu: Ev ${m.xg?.home?.toFixed(2)} - Dep ${m.xg?.away?.toFixed(2)} (xG Farkı: ${m.xg?.delta?.toFixed(2)})
  - Gerekçe Özeti: ${rationaleText}`;
        }).join('\n\n');

        return `Sen profesyonel bir Kurumsal Bahis Sendikası ve Kuant Masası (Sportsbook Trading Desk) Direktörüsün.
Aşağıdaki maçlar, 5 aşamalı kantitatif filtremizden (+EV, xG İvmesi, Saha Hakimiyet Endeksi, Ölü Maç Kalkanı, Fraksiyonel Kelly Kriteri) başarıyla geçmiş canlı fırsatlardır.

KUANT MASASI ÖZETİ:
- Taranan Maç Sayısı: ${deskSummary?.totalScanned || matches.length}
- Filtreyi Geçen +EV Fırsat Sayısı: ${matches.length}
- Ortalama Beklenen Değer (+EV): +%${deskSummary?.avgEV || 0}

CANLI FIRSATLAR VE TELEMETRİ:
${formattedMatches}

GÖREVİN:
Bu verileri 3 uzman departmanın ortak konsensüsü olarak analiz et:
1. 📊 [KUANT & MATEMATİKSEL DEĞERLEME]: Modelin hesapladığı gerçek olasılık ile büro oranının çeliştiği en karlı noktaları değerlendir.
2. ⚔️ [SAHA & TAKTİKSEL SENARYO]: Dakika, yorgunluk, baskı dalgası ve xG sapmalarının maça etkisini yorumla.
3. 🛡️ [RİSK DİREKTÖRÜ NİHAİ KARARI]:
   - 🎯 EN GÜVENİLİR 1 VEYA 2 TEKLİ DEĞER BAHİSİ (Tekli Oyna)
   - 🎟️ ALTIN İKİLİ KOMBİNE (Eğer uygun 2 maç varsa kombine önerisi, yoksa tekli tavsiye et)
   - ⚠️ KAÇINILMASI GEREKEN TUZAKLAR (Düşük oran tuzakları, ölü maç riski taşıyanlar)
   - 💰 KASA PAYLAŞIMI: Kelly Kriterine göre optimal sermaye yönetimi tavsiyesi.

ÇIKTI KURALLARI:
- Kesinlikle TÜRKÇE, profesyonel, keskin, net ve aksiyon odaklı ol.
- Basmakalıp tahminci jargonu yerine gerçek bir quant fonu yöneticisi gibi konuş.
- Markdown formatında, net başlıklar ve emojilerle yapılandır.`;
    }

    /**
     * Generate Strategic Gemini Briefing
     */
    async generateBriefing(matches = [], deskSummary = {}) {
        if (!matches || matches.length === 0) {
            return {
                mode: 'LOCAL_FALLBACK',
                markdown: '⚠️ Şu anda filtrelere uyan aktif bir canlı değer bahisi bulunamadı. Filtre eşiklerini (Min EV, Dakika) esnetmeyi deneyebilirsiniz.'
            };
        }

        const apiKey = this.getApiKey();

        // If no API key configured, use high-grade local quant fallback
        if (!apiKey) {
            return {
                mode: 'LOCAL_QUANT_ENGINE',
                markdown: this.generateLocalBriefing(matches, deskSummary),
                notice: '💡 Bu rapor Dahili Kuant Motoru tarafından üretildi. Kendi Gemini API anahtarınızı bağlayarak yapay zekâ nöral analizini aktif edebilirsiniz.'
            };
        }

        const prompt = this.buildCommitteePrompt(matches, deskSummary);

        try {
            const fetchMod = (await import('node-fetch')).default;
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.activeModel}:generateContent?key=${apiKey}`;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.35, // Low temperature for high quantitative accuracy
                    maxOutputTokens: 2048
                }
            };

            const res = await fetchMod(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                timeout: 20000
            });

            const data = await res.json();

            if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                const text = data.candidates[0].content.parts[0].text;
                return {
                    mode: 'GEMINI_AI',
                    model: this.activeModel,
                    markdown: text,
                    timestamp: new Date().toISOString()
                };
            } else if (data.error) {
                console.warn('[GEMINI_BRIDGE] Gemini API error, falling back to local engine:', data.error.message);
                return {
                    mode: 'LOCAL_QUANT_ENGINE',
                    markdown: this.generateLocalBriefing(matches, deskSummary),
                    notice: `⚠️ Gemini API hatası (${data.error.message}). Otomatik olarak Kuant Algoritmasına geçildi.`
                };
            }
        } catch (e) {
            console.error('[GEMINI_BRIDGE] Request exception:', e.message);
        }

        // Fallback to local quant synthesis
        return {
            mode: 'LOCAL_QUANT_ENGINE',
            markdown: this.generateLocalBriefing(matches, deskSummary),
            notice: '⚠️ Gemini sunucusu yanıt vermedi, Kuant Motoru analizleri başarıyla tamamladı.'
        };
    }

    /**
     * High-Grade Local Quantitative Synthesis Engine (Fallback)
     */
    generateLocalBriefing(matches, deskSummary) {
        const sorted = [...matches].sort((a, b) => b.evPercent - a.evPercent);
        const topAlpha = sorted.filter(m => m.level === 'ALPHA' || m.evPercent >= 10.0);
        const bestSingle = sorted[0];
        const goldenCombo = sorted.slice(0, 2);

        let goldenComboOdds = 1.0;
        let goldenComboProb = 1.0;
        goldenCombo.forEach(c => {
            goldenComboOdds *= c.marketOdds;
            goldenComboProb *= (c.trueProb / 100);
        });
        goldenComboOdds = Math.round(goldenComboOdds * 100) / 100;
        const comboEV = Math.round(((goldenComboProb * goldenComboOdds) - 1) * 1000) / 10;

        return `🏛️ **KURUMSAL BAHİS OFİSİ & KUANT MASASI STRATEJİK BRİFİNGİ**
════════════════════════════════════════════════════════════
📅 **Tarih / Saat:** ${new Date().toLocaleString('tr-TR')}
📊 **Piyasa Taraması:** ${deskSummary?.totalScanned || matches.length} Canlı Maç | **Filtreyi Geçen +EV Fırsatlar:** ${matches.length} Adet | **Ortalama EV:** +%${deskSummary?.avgEV || 0}

---

### 1. 📊 KUANT & MATEMATİKSEL DEĞERLEME DEPARTMANI
Bu periyotta piyasa oranları ile Dixon-Coles/Poisson gerçek olasılık modelleri arasında en yüksek sapma tespit edilen pozisyonlar:

${sorted.slice(0, 3).map((m, i) => `• **#${i + 1} ${m.homeTeam} vs ${m.awayTeam}** (${m.minute}' | Skor: ${m.score})
  ➔ **Hedef:** ${m.marketLabel} | **Piyasa Oranı:** @${m.marketOdds} (Adil Oran: @${m.fairOdds})
  ➔ **Model Olasılığı:** %${m.trueProb} | **Beklenen Değer (EV):** +%${m.evPercent} [${m.badge}]
  ➔ **Telemetri Doğrulaması:** Saha Dominansı: %${m.dominanceIndex} | xG: ${m.xg?.home?.toFixed(2)} vs ${m.xg?.away?.toFixed(2)}`).join('\n\n')}

---

### 2. ⚔️ SAHA VE TAKTİKSEL SENARYO TEŞHİSİ
${bestSingle ? `• **Mercek Altındaki Maç:** **${bestSingle.homeTeam} vs ${bestSingle.awayTeam}**
  Dakika ${bestSingle.minute}' itibarıyla ${bestSingle.targetTeam !== 'ALL' ? `${bestSingle.targetTeam} takımı` : 'iki takım da'} belirgin bir hücum ivmesi yakalamıştır (%${bestSingle.pressureWave} ivme dalgası). ${bestSingle.stats?.sot} kaleyi bulan şut ve ${bestSingle.stats?.box} ceza sahası aksiyonu, hedef pazar olan "${bestSingle.marketLabel}" tercihini oyun dinamiği olarak net bir şekilde desteklemektedir.` : 'Sahada net ayrışan bir baskı dalgası gözlemlenmedi.'}

---

### 3. 🛡️ RİSK YÖNETİMİ & KUANT MASASI NİHAİ KARARI

🎯 **EN YÜKSEK GÜVENLİ TEKLİ DEĞER BAHİSİ (SINGLE VALUE BET):**
${bestSingle ? `• **Karşılaşma:** ${bestSingle.homeTeam} vs ${bestSingle.awayTeam} (${bestSingle.minute}')
• **Seçim:** **${bestSingle.marketLabel}** (@${bestSingle.marketOdds})
• **Gerçek Kazanma Olasılığı:** %${bestSingle.trueProb} | **Net Matematiksel Avantaj:** +%${bestSingle.evPercent} EV
• **Önerilen Kasa Payı (Quarter Kelly):** %${bestSingle.recommendedStakePercent}` : 'Tekli bahis için yeterli marj bulunamadı.'}

🎟️ **ALTIN İKİLİ KOMBİNE (GOLDEN COMBO):**
${goldenCombo.length === 2 ? `1. **${goldenCombo[0].homeTeam} vs ${goldenCombo[0].awayTeam}** ➔ ${goldenCombo[0].marketLabel} (@${goldenCombo[0].marketOdds})
2. **${goldenCombo[1].homeTeam} vs ${goldenCombo[1].awayTeam}** ➔ ${goldenCombo[1].marketLabel} (@${goldenCombo[1].marketOdds})
• **Toplam Oran:** @${goldenComboOdds.toFixed(2)} | **Bileşik Olasılık:** %${Math.round(goldenComboProb * 100)} | **Bileşik EV:** +%${comboEV}
• **Tavsiye Edilen Kasa Payı:** %1.5 - %2.0` : 'Kombine için yeterli eşleşme yok, tekli kupon tavsiye edilir.'}

⚠️ **MASANIN KAÇINILMASI GEREKENLER LİSTESİ (RISK QUARANTINE):**
• Rölanti evresine giren 75'+ maçlarda skor kovalamaktan kaçının (Ölü Maç Kalkanı).
• 1.15 - 1.30 bandında sunulan ama sahada ceza sahası üretkenliği olmayan sahte favorilere asla girmeyin.
• Kasa disiplinini asla bozmayın; tek bir bahiste portföyün %3.5'inden fazlasını riske atmayın.`;
    }
}

export const geminiTradingBridge = new GeminiTradingBridge();
