/**
 * 🛡️ LIVEBET MENTOR - WEB LIVE SUPPORT & TELEGRAM BRIDGE SERVICE
 * 
 * Features:
 * - 100% Anonymous Web-to-Telegram Live Support
 * - Instant Hybrid AI Knowledge Engine (Pricing, Trial, System, Betting Math)
 * - Multi-Operator / Support Staff Management
 * - Seamless 2-Way Real-time Telegram Routing for Human Admin & Operators
 * - Session Persistence & History
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSecureToken } from './securityUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHATS_FILE = path.join(__dirname, 'support_chats.json');
const OPERATORS_FILE = path.join(__dirname, 'support_operators.json');
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET || 'lbm_sec_vault_2026_981aed67_prod_shield';
const APP_ORIGIN = process.env.APP_ORIGIN || 'https://livebetmentor.com';

class SupportChatService {
    constructor() {
        this.chats = new Map(); // sessionId -> sessionData
        this.telegramMsgMap = new Map(); // telegramMsgId -> sessionId
        this.operators = []; // [{ id, name, telegramChatId, telegramUsername, active, addedAt }]
        this.translationCache = new Map(); // cacheKey -> translatedText
        this.loadChats();
        this.loadOperators();
    }

    /**
     * 🌐 High-Speed Free Translation Engine (Cached & Safe)
     * Auto-detects or translates between TR, DE, EN with fallback
     */
    async translateText(text, sourceLang = 'auto', targetLang = 'tr') {
        if (!text || !text.trim()) return '';
        const cleanText = text.trim();
        const sLang = (sourceLang || 'auto').toLowerCase();
        const tLang = (targetLang || 'tr').toLowerCase();

        if (sLang === tLang) return cleanText;

        const cacheKey = `${sLang}->${tLang}:${cleanText}`;
        if (this.translationCache && this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }

        try {
            const pair = `${sLang === 'auto' ? 'autodetect' : sLang}|${tLang}`;
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${pair}&de=support@livebetmentor.com`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(url, {
                headers: { 'User-Agent': 'LiveBetMentorSupport/1.0' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                let trans = data?.responseData?.translatedText;
                if (trans && typeof trans === 'string' && !trans.toUpperCase().includes('MYMEMORY WARNING') && trans.trim()) {
                    trans = trans
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&apos;/g, "'")
                        .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
                        .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
                        .trim();

                    if (!this.translationCache) this.translationCache = new Map();
                    this.translationCache.set(cacheKey, trans);
                    return trans;
                }
            }
        } catch (e) {
            console.warn(`[SUPPORT] Translation warning (${sLang}->${tLang}):`, e.message);
        }

        return cleanText;
    }

    loadChats() {
        try {
            if (fs.existsSync(CHATS_FILE)) {
                const data = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8'));
                for (const [sId, chat] of Object.entries(data)) {
                    this.chats.set(sId, chat);
                    if (chat.adminTelegramMsgId) {
                        this.telegramMsgMap.set(chat.adminTelegramMsgId, sId);
                    }
                }
                console.log(`[SUPPORT] 💬 Loaded ${this.chats.size} support chat sessions`);
            }
        } catch (e) {
            console.error('[SUPPORT] Error loading support chats:', e.message);
        }
    }

    saveChats() {
        try {
            const obj = {};
            // Keep last 1000 sessions with full persistent audit trail
            const entries = Array.from(this.chats.entries()).slice(-1000);
            for (const [k, v] of entries) {
                obj[k] = v;
            }
            fs.writeFileSync(CHATS_FILE, JSON.stringify(obj, null, 2), 'utf8');
        } catch (e) {
            console.error('[SUPPORT] Error saving support chats:', e.message);
        }
    }

    generateQuickAuthToken(sessionId = '') {
        try {
            return generateSecureToken(
                { role: 'admin', email: 'admin@livebetmentor.com', purpose: 'quick_support', sessionId },
                JWT_SECRET,
                72 * 60 * 60 * 1000 // 72 hours validity
            );
        } catch (e) {
            return '';
        }
    }

    loadOperators() {
        try {
            if (fs.existsSync(OPERATORS_FILE)) {
                this.operators = JSON.parse(fs.readFileSync(OPERATORS_FILE, 'utf8'));
                console.log(`[SUPPORT] 👥 Loaded ${this.operators.length} support operators`);
            } else {
                this.operators = [];
            }
        } catch (e) {
            console.error('[SUPPORT] Error loading support operators:', e.message);
            this.operators = [];
        }
    }

    saveOperators() {
        try {
            fs.writeFileSync(OPERATORS_FILE, JSON.stringify(this.operators, null, 2), 'utf8');
        } catch (e) {
            console.error('[SUPPORT] Error saving support operators:', e.message);
        }
    }

    getOperators() {
        return this.operators || [];
    }

    addOperator({ name, telegramChatId, telegramUsername, email }) {
        if (!telegramChatId) return { success: false, error: 'Telegram Chat ID gereklidir.' };

        const cleanChatId = String(telegramChatId).trim();
        const existing = this.operators.find(op => String(op.telegramChatId) === cleanChatId);
        if (existing) {
            return { success: false, error: 'Bu Telegram ID zaten operatör olarak kayıtlı.' };
        }

        const newOp = {
            id: 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 5),
            name: (name || 'Destek Temsilcisi').trim(),
            telegramChatId: cleanChatId,
            telegramUsername: (telegramUsername || '').replace(/^@/, '').trim(),
            email: (email || '').trim().toLowerCase(),
            active: true,
            addedAt: new Date().toISOString()
        };

        this.operators.push(newOp);
        this.saveOperators();
        console.log(`[SUPPORT] ➕ Added support operator: ${newOp.name} (${newOp.telegramChatId}, ${newOp.email || 'no email'})`);
        return { success: true, operator: newOp };
    }

    removeOperator(id) {
        const idx = this.operators.findIndex(op => op.id === id || String(op.telegramChatId) === String(id));
        if (idx === -1) return { success: false, error: 'Operatör bulunamadı.' };

        const removed = this.operators.splice(idx, 1)[0];
        this.saveOperators();
        console.log(`[SUPPORT] 🗑️ Removed support operator: ${removed.name}`);
        return { success: true, removed };
    }

    toggleOperator(id) {
        const op = this.operators.find(o => o.id === id);
        if (!op) return { success: false, error: 'Operatör bulunamadı.' };

        op.active = !op.active;
        this.saveOperators();
        return { success: true, operator: op };
    }

    isOperator(chatId) {
        if (!chatId) return false;
        const strId = String(chatId).trim();
        return this.operators.some(op => op.active && String(op.telegramChatId) === strId);
    }

    isOperatorEmail(email) {
        if (!email) return false;
        const clean = String(email).trim().toLowerCase();
        return this.operators.some(op => op.active && op.email && op.email.toLowerCase() === clean);
    }

    closeSession(sessionId) {
        const session = this.chats.get(sessionId);
        if (!session) return false;
        session.status = 'closed';
        session.updatedAt = Date.now();
        this.saveChats();
        return true;
    }

    getOperatorName(chatId) {
        const strId = String(chatId).trim();
        const op = this.operators.find(o => String(o.telegramChatId) === strId);
        return op ? op.name : null;
    }

    getAllNotificationChatIds() {
        const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '8965087988').split(',').map(s => s.trim()).filter(Boolean);
        const opIds = this.operators.filter(op => op.active).map(op => String(op.telegramChatId).trim());
        return Array.from(new Set([...adminIds, ...opIds]));
    }

    getOrCreateSession(sessionId, lang = 'tr', userInfo = {}) {
        let cleanId = sessionId;
        if (!cleanId) {
            cleanId = 'web_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
        }

        let session = this.chats.get(cleanId);
        if (!session) {
            session = {
                sessionId: cleanId,
                lang: lang || 'tr',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                userInfo: userInfo || {},
                status: 'active', // 'active' | 'waiting_admin' | 'resolved'
                adminTelegramMsgId: null,
                messages: [
                    {
                        id: 'msg_welcome',
                        sender: 'bot',
                        text: this.getWelcomeMessage(lang || 'tr'),
                        timestamp: Date.now()
                    }
                ]
            };
            this.chats.set(cleanId, session);
            this.saveChats();
        } else {
            if (userInfo && Object.keys(userInfo).length > 0) {
                session.userInfo = { ...session.userInfo, ...userInfo };
            }
            if (lang && session.lang !== lang) {
                session.lang = lang;
            }
        }

        return session;
    }

    getWelcomeMessage(lang = 'tr') {
        if (lang === 'de') {
            return `👋 Hallo! Willkommen beim offiziellen LiveBet Mentor Support-Desk.\n\nIch bin Ihr KI-Assistent. Wie kann ich Ihnen heute bezüglich VIP-Plänen, Testphasen oder Live-Radar-Fragen helfen?`;
        }
        if (lang === 'en') {
            return `👋 Hello! Welcome to the official LiveBet Mentor Support Desk.\n\nI am your AI assistant. How can I assist you with VIP memberships, trial access, or live quant radar strategies today?`;
        }
        return `👋 Merhaba! LiveBet Mentor Resmi Destek Masasına hoş geldiniz.\n\nBen canlı destek asistanınızım. VIP üyelik paketleri, 3 günlük ücretsiz deneme veya canlı xG radarı hakkında size nasıl yardımcı olabilirim?`;
    }

    /**
     * Get knowledge base AI response if query matches common patterns
     */
    matchKnowledgeBase(text, lang = 'tr') {
        const t = (text || '').toLowerCase().trim();
        const isTr = lang === 'tr';
        const isDe = lang === 'de';

        // 1. VIP Fiyatları & Satın Alma & Paketler
        if (/\b(fiyat|fiyatı|ucret|ücret|kac para|kaç para|ne kadar|paket|vip|uyelik|üyelik|abone|abonelik|price|kosten|preise|plans|cost|subscription)\b/i.test(t)) {
            if (isDe) {
                return `💎 **LiveBet Mentor VIP PRO Mitgliedschaft:**\n\n• **VIP PRO Monatspass:** 29€ / Monat (Alle Live-xG-Radare, In-Play-Toralarm, KI-Briefings und Telegram-VIP-Kanal inklusive).\n• **Zahlungsmethoden:** Kreditkarte (Sofortaktivierung über Shopier) oder Krypto (USDT / TON / BTC).\n\n💳 Möchten Sie direkt mit einer Kreditkarte bezahlen oder mit unserem Kundenservice sprechen? Wählen Sie eine Option unten oder schreiben Sie "Mensch"!`;
            }
            if (!isTr) {
                return `💎 **LiveBet Mentor VIP PRO Membership:**\n\n• **VIP PRO Monthly Pass:** 29€ / month (Full access to in-play xG radar, live goal surge alerts, AI consensus desk and VIP Telegram syndicate).\n• **Payment Methods:** Instant Credit Card via Shopier, or Crypto (USDT / TON / BTC).\n\n💳 To activate your VIP pass instantly or talk with a human representative, simply tap below or type "Human"!`;
            }
            return `💎 **LiveBet Mentor VIP PRO Paketleri:**\n\n• **VIP PRO Aylık Paket:** 29€ / Ay (Tüm canlı xG radarları, son 20dk baskı alarmları, 68'-85' altın dakika fırsatları ve VIP Telegram kanalı dahildir).\n• **Ödeme Yöntemleri:** Kredi Kartı (Shopier ile anında otomatik açılır) veya Kripto (USDT / TON / BTC).\n\n💳 Kredi kartı ile güvenle anında satın alabilir veya özel ödeme (Havale/EFT) için canlı temsilcimize bağlanabilirsiniz!`;
        }

        // 2. 3 Günlük Ücretsiz Deneme
        if (/\b(deneme|ucretsiz|ücretsiz|free|trial|test|72 saat|3 gun|3 gün|tage|kostenlos)\b/i.test(t)) {
            if (isDe) {
                return `🚀 **3-Tage (72h) Kostenloser VIP-Test:**\n\nAlle neuen Nutzer erhalten vollen Zugriff auf das VIP PRO Dashboard für 72 Stunden kostenlos. Sie können alle Live-Metriken, xG-Unterschiede und Druckmomente in Echtzeit testen.\n\nMelden Sie sich einfach auf der Startseite an, um Ihren Testzugang zu aktivieren!`;
            }
            if (!isTr) {
                return `🚀 **3-Day (72h) Free VIP Trial Pass:**\n\nAll newly registered members receive full complimentary VIP PRO access for 72 hours. Test live xG telemetry, high-probability goal filters, and AI consensus with zero risk.\n\nSimply register on the homepage to start your trial immediately!`;
            }
            return `🚀 **3 Günlük (72 Saat) Ücretsiz VIP PRO Deneme:**\n\nSitemize ilk kez kayıt olan tüm üyelerimize 3 gün boyunca VIP PRO özellikleri tamamen ücretsiz ve koşulsuz olarak açılır. Canlı maç radarlarını, beklenen gol (xG) açıklarını ve momentum grafiklerini anlık test edebilirsiniz.\n\nDeneme sürenizi başlatmak için ana sayfadan ücretsiz kayıt olmanız yeterlidir!`;
        }

        // 3. Sistem Nasıl Çalışır & xG & DQS Nedir?
        if (/\b(nasil calisir|nasıl çalışır|nedir|xg|dqs|kelly|algoritma|model|guven|güven|orani|oranı|basari|başarı|accuracy|wie funktioniert|how it works)\b/i.test(t)) {
            if (isDe) {
                return `🧠 **Wie LiveBet Mentor funktioniert:**\n\n1. **Live-xG-Telemetrie:** Erkennt Teams mit hohem Angriffsdruck, deren Torerfolg noch überfällig ist.\n2. **DQS (Dynamischer Qualitätsscore):** Bewertet die Spielintensität von 0 bis 100 (Werte ab 0.50 gelten als Top-Gelegenheiten).\n3. **68'-85' Goldene Minuten:** Nutzt späte Spielphasen mit maximierten Live-Quoten.\n4. **Kelly-Kriterium:** Schützt Ihre Bankroll mit wissenschaftlichem Risikomanagement.`;
            }
            if (!isTr) {
                return `🧠 **How LiveBet Mentor Works:**\n\n1. **Live xG Telemetry:** Uncovers teams creating heavy offensive threat not yet reflected on the scoreboard.\n2. **DQS (Dynamic Quality Score):** Rates match tempo and goal probability (DQS >= 0.50 indicates prime value).\n3. **68'-85' Golden Minutes:** Captures high-intensity late game opportunities with peak odds.\n4. **Kelly Bankroll Management:** Preserves capital using proven mathematical staking.`;
            }
            return `🧠 **LiveBet Mentor Sistemi Nasıl Çalışır?**\n\nSistemimiz 8 farklı küresel veri kaynağından anlık canlı maç verilerini tarar:\n1. **Canlı xG (Beklenen Gol):** Sahada yoğun baskı kuran ancak henüz gol atamamış takımların değerli oranlarını yakalar.\n2. **DQS (Dinamik Kalite Skoru):** Maçın temposunu 0-100 arasında puanlar (0.50 üzeri yüksek değerli maçlardır).\n3. **68'-85' Altın Dakikalar:** Canlı bahiste oranların tavan yaptığı kritik dakikalardaki fırsatları listeler.\n4. **Kelly Kasa Yönetimi:** Kasanızı korumak için bilimsel risk yüzdeleri hesaplar.`;
        }

        // 4. Havale / EFT / İletişim / Temsilci Talebi
        if (/\b(havale|eft|iban|temsilci|yetkili|canli destek|canlı destek|insan|yetkiliye|human|agent|operator|mitarbeiter|support team)\b/i.test(t)) {
            return null; // Trigger human agent escalation
        }

        // 5. Selamlaşma & Giriş
        if (/^(selam|merhaba|selamlar|slm|sa|s\.a|iyi günler|iyi aksamlar|iyi akşamlar|günaydın|gunaydin|hello|hi|hey|guten tag|hallo)\b/i.test(t)) {
            if (isDe) {
                return `👋 **Hallo! Willkommen beim LiveBet Mentor Support-Desk.**\n\nIch bin Ihr KI-Assistent. Wie kann ich Ihnen heute bezüglich VIP-Plänen, Testphasen oder Live-Radar-Fragen helfen? Schreiben Sie mir gerne Ihre Frage oder wählen Sie eine Option unten!`;
            }
            if (!isTr) {
                return `👋 **Hello! Welcome to LiveBet Mentor Support Desk.**\n\nI am your AI assistant. How can I help you today regarding VIP plans, free trial access, or live radar strategies? Feel free to ask or pick an option below!`;
            }
            return `👋 **Merhaba! LiveBet Mentor Canlı Destek Masasına hoş geldiniz.**\n\nBen canlı destek asistanınızım. VIP üyelik paketleri, 3 günlük ücretsiz deneme veya canlı xG radarı hakkında size nasıl yardımcı olabilirim? Sorunuzu doğrudan yazabilir veya aşağıdaki butonları kullanabilirsiniz!`;
        }

        return null;
    }

    /**
     * Process incoming user message
     */
    async handleUserMessage(sessionId, text, lang = 'tr', userInfo = {}, telegramBotInstance = null) {
        const session = this.getOrCreateSession(sessionId, lang, userInfo);
        const cleanText = (text || '').trim();
        if (!cleanText) return { success: false, error: 'Empty message' };

        // Real-time automatic translation to Turkish for admin & Telegram team if customer uses DE/EN
        let translatedText = null;
        if (session.lang && session.lang !== 'tr') {
            try {
                translatedText = await this.translateText(cleanText, session.lang, 'tr');
            } catch (e) {
                console.warn('[SUPPORT] Failed to auto-translate customer message:', e.message);
            }
        }

        const userMsg = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
            sender: 'user',
            text: cleanText,
            translatedText: (session.lang !== 'tr' && translatedText && translatedText !== cleanText) ? translatedText : null,
            lang: session.lang || 'tr',
            timestamp: Date.now()
        };
        session.messages.push(userMsg);
        session.updatedAt = Date.now();

        // 1. Try AI Knowledge Base Response
        const aiAnswer = this.matchKnowledgeBase(cleanText, session.lang);

        if (aiAnswer) {
            const botReply = {
                id: 'msg_ai_' + Date.now(),
                sender: 'bot',
                text: aiAnswer,
                timestamp: Date.now() + 300 // slight delay simulation
            };
            session.messages.push(botReply);
            this.saveChats();

            // Also silently inform admin & operators on Telegram so team is aware
            if (telegramBotInstance) {
                this.notifyAdminSilently(session, cleanText, aiAnswer, telegramBotInstance, userMsg.translatedText);
            }

            return {
                success: true,
                session,
                reply: botReply
            };
        }

        // 2. Escalate to Human Telegram Admin & Operators
        session.status = 'waiting_admin';
        const waitMsg = {
            id: 'msg_wait_' + Date.now(),
            sender: 'bot',
            text: session.lang === 'de'
                ? `🛎️ Ihre Anfrage wurde an unser diensthabendes Support-Team weitergeleitet. Ein Support-Mitarbeiter wird Ihnen in Kürze direkt hier im Chat antworten.`
                : session.lang === 'en'
                ? `🛎️ Your inquiry has been escalated to our on-duty support team. An agent will reply to you directly right here in this chat shortly.`
                : `🛎️ Mesajınız nöbetçi canlı destek ekibimize iletildi. Yetkili temsilcimiz en kısa sürede doğrudan bu sohbete yazarak size yanıt verecektir. Lütfen sayfayı kapatmayınız.`,
            timestamp: Date.now() + 200
        };
        session.messages.push(waitMsg);
        this.saveChats();

        // Forward to all Admin & Support Operator Telegrams with 1-click Reply capability
        if (telegramBotInstance) {
            await this.forwardToAdminTelegram(session, cleanText, telegramBotInstance, userMsg.translatedText);
        }

        return {
            success: true,
            session,
            reply: waitMsg
        };
    }

    /**
     * Send instant alert to Admin and all active Support Operators on Telegram
     */
    async forwardToAdminTelegram(session, latestText, telegramBot, translatedText = null) {
        try {
            const isMember = session.userInfo?.isMember || !!session.userInfo?.email;
            const memberStatusText = isMember 
                ? `👑 *KAYITLI ÜYE:* ${session.userInfo?.email} [${(session.userInfo?.plan || 'trial').toUpperCase()}]`
                : `🌐 *MİSAFİR ZİYARETÇİ:* #${session.sessionId.slice(-6)} (Kayıtsız)`;
            const deviceText = session.userInfo?.device?.isMobile ? '📱 Mobil' : '💻 Masaüstü';

            const isForeign = session.lang && session.lang !== 'tr';
            const langName = session.lang === 'de' ? '🇩🇪 ALMANCA' : (session.lang === 'en' ? '🇬🇧 İNGİLİZCE' : (session.lang || 'tr').toUpperCase());

            const translationSection = (isForeign && translatedText)
                ? `\n🇹🇷 *Türkçe Çevirisi:*\n"${translatedText}"\n`
                : '';

            const replyHelp = isForeign
                ? `👉 Bu mesaja Telegram'da doğrudan **"Yanıtla" (Reply)** yaparak Türkçe yazabilirsiniz (sistem müşteriye ${session.lang === 'de' ? 'Almanca' : 'İngilizce'} olarak iletir)!`
                : `👉 Bu mesaja Telegram'da doğrudan **"Yanıtla" (Reply)** yaparak yazabilirsiniz!`;

            const adminAlert = `💬 *YENİ SİTE CANLI DESTEK MESAJI!* 💬
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 ${memberStatusText}
📱 *Cihaz:* ${deviceText}
🌐 *Dil:* ${langName}
🆔 *Oturum:* \`${session.sessionId}\`

📝 *Orijinal Mesaj:*
"${latestText}"
${translationSection}━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *Müşteriye Cevap Vermek İçin:*
${replyHelp}
👉 Veya tek tıkla web paneline bağlanmak için aşağıdaki butona basın:
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ *LiveBet Mentor Canlı Destek Masası*`;

            const quickToken = this.generateQuickAuthToken(session.sessionId);
            const webUrl = `${APP_ORIGIN}/?tab=support_staff&session=${encodeURIComponent(session.sessionId)}&auth=${quickToken}`;
            const keyboardOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '⚡ Sohbete Bağlan (Web Panel)',
                                url: webUrl
                            }
                        ]
                    ]
                }
            };

            const recipientIds = this.getAllNotificationChatIds();
            for (const recId of recipientIds) {
                const sentMsg = await telegramBot.sendMessage(recId, adminAlert, keyboardOptions);
                if (sentMsg && sentMsg.message_id) {
                    session.adminTelegramMsgId = sentMsg.message_id;
                    this.telegramMsgMap.set(sentMsg.message_id, session.sessionId);
                }
            }
            this.saveChats();
        } catch (e) {
            console.error('[SUPPORT] Error forwarding to Telegram team:', e.message);
        }
    }

    /**
     * Silently log AI conversation to Admin and active Operators
     */
    async notifyAdminSilently(session, userQuery, aiAnswer, telegramBot, translatedText = null) {
        try {
            const isMember = session.userInfo?.isMember || !!session.userInfo?.email;
            const memberStatusText = isMember 
                ? `👑 ${session.userInfo?.email} [${(session.userInfo?.plan || 'trial').toUpperCase()}]`
                : `🌐 Misafir #${session.sessionId.slice(-6)}`;

            const isForeign = session.lang && session.lang !== 'tr';
            const translationSection = (isForeign && translatedText)
                ? `\n🇹🇷 *Çeviri:* "${translatedText.substring(0, 100)}..."`
                : '';

            const preview = `🤖 *SİTE ASİSTANI (Otomatik Yanıtlandı)*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Kullanıcı:* ${memberStatusText}
💬 *Soru:* "${userQuery.substring(0, 100)}"${translationSection}
💡 *AI Yanıtı:* "${aiAnswer.substring(0, 120)}..."
━━━━━━━━━━━━━━━━━━━━━━━━━━
_Müdahale etmek veya sohbete bağlanmak için butona basabilirsiniz:_`;

            const quickToken = this.generateQuickAuthToken(session.sessionId);
            const webUrl = `${APP_ORIGIN}/?tab=support_staff&session=${encodeURIComponent(session.sessionId)}&auth=${quickToken}`;
            const keyboardOptions = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '⚡ Sohbete Bağlan (Web Panel)',
                                url: webUrl
                            }
                        ]
                    ]
                }
            };

            const recipientIds = this.getAllNotificationChatIds();
            for (const recId of recipientIds) {
                const sent = await telegramBot.sendMessage(recId, preview, keyboardOptions);
                if (sent && sent.message_id) {
                    this.telegramMsgMap.set(sent.message_id, session.sessionId);
                }
            }
        } catch (e) {}
    }

    /**
     * Get the most recently active web chat session
     */
    getLastActiveSession() {
        let best = null;
        let bestTime = 0;
        for (const session of this.chats.values()) {
            if (session.status !== 'closed' && (session.updatedAt || 0) > bestTime) {
                bestTime = session.updatedAt;
                best = session;
            }
        }
        return best;
    }

    closeSession(sessionId) {
        const session = this.chats.get(sessionId);
        if (!session) return false;
        session.status = 'closed';
        session.updatedAt = Date.now();
        this.saveChats();
        return true;
    }

    archiveSession(sessionId) {
        const session = this.chats.get(sessionId);
        if (!session) return false;
        session.status = 'archived';
        session.updatedAt = Date.now();
        this.saveChats();
        return true;
    }

    unarchiveSession(sessionId) {
        const session = this.chats.get(sessionId);
        if (!session) return false;
        session.status = 'active';
        session.updatedAt = Date.now();
        this.saveChats();
        return true;
    }

    deleteSession(sessionId) {
        const deleted = this.chats.delete(sessionId);
        if (deleted) {
            this.saveChats();
        }
        return deleted;
    }

    clearClosedSessions() {
        let count = 0;
        for (const [id, session] of this.chats.entries()) {
            if (session.status === 'closed' || session.status === 'archived') {
                this.chats.delete(id);
                count++;
            }
        }
        if (count > 0) this.saveChats();
        return count;
    }

    /**
     * Deliver reply from Admin or Support Staff to the user's web session
     * Automatically translates to session language (e.g. DE, EN) if needed
     */
    async addAdminReply(sessionId, replyText, senderName = null, originalText = null) {
        const session = this.chats.get(sessionId);
        if (!session) {
            console.warn(`[SUPPORT] Session not found for admin reply: ${sessionId}`);
            return false;
        }

        const cleanReply = (replyText || '').trim();
        if (!cleanReply) return false;

        let deliveredText = cleanReply;
        let savedOriginalText = originalText ? originalText.trim() : cleanReply;

        // If target customer language is not Turkish, ensure deliveredText is translated into customer's language
        if (session.lang && session.lang !== 'tr') {
            if (originalText && originalText.trim() && originalText.trim() !== cleanReply) {
                // Caller explicitly provided pre-translated text in cleanReply and Turkish in originalText
                deliveredText = cleanReply;
                savedOriginalText = originalText.trim();
            } else {
                // Admin replied in Turkish -> translate to customer's session language
                try {
                    const autoTranslated = await this.translateText(cleanReply, 'tr', session.lang);
                    if (autoTranslated && autoTranslated.trim()) {
                        deliveredText = autoTranslated.trim();
                        savedOriginalText = cleanReply;
                    }
                } catch (e) {
                    console.warn(`[SUPPORT] Failed auto-translating reply to ${session.lang}:`, e.message);
                }
            }
        }

        const adminMsg = {
            id: 'msg_admin_' + Date.now(),
            sender: 'admin',
            text: deliveredText,
            originalText: savedOriginalText,
            targetLang: session.lang || 'tr',
            senderName: senderName || 'Destek Yetkilisi',
            timestamp: Date.now()
        };

        session.messages.push(adminMsg);
        session.status = 'active';
        session.updatedAt = Date.now();
        this.saveChats();
        console.log(`[SUPPORT] ✅ Reply delivered to session ${sessionId} (${session.lang}): "${deliveredText.substring(0, 40)}..." (orig: "${savedOriginalText.substring(0, 40)}...")`);
        return { success: true, adminMsg };
    }

    getSessionHistory(sessionId) {
        const session = this.chats.get(sessionId);
        if (!session) return [];
        return session.messages || [];
    }

    getNewMessages(sessionId, lastTimestamp = 0) {
        const session = this.chats.get(sessionId);
        if (!session) return [];
        const ts = parseInt(lastTimestamp, 10) || 0;
        return (session.messages || []).filter(m => m.timestamp > ts);
    }

    getAllSessionsSummary() {
        const list = [];
        for (const [sId, chat] of this.chats.entries()) {
            const msgs = chat.messages || [];
            const lastMsg = msgs[msgs.length - 1];
            list.push({
                sessionId: sId,
                status: chat.status || 'active',
                userInfo: chat.userInfo || {},
                lang: chat.lang || 'tr',
                totalMessages: msgs.length,
                lastMessage: lastMsg ? { text: lastMsg.text, sender: lastMsg.sender, timestamp: lastMsg.timestamp } : null,
                createdAt: chat.createdAt,
                updatedAt: chat.updatedAt
            });
        }
        return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
}

export const supportChatService = new SupportChatService();
