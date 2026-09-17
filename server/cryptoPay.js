/**
 * ⚡ CRYPTO PAY SERVICE (CryptoBot API Integration)
 * Handles automated invoice creation, instant payment detection, and automated VIP granting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROCESSED_FILE = path.join(__dirname, 'crypto_processed_payments.json');
const INVOICES_FILE = path.join(__dirname, 'crypto_invoices.json');

export class CryptoPayClient {
    constructor() {
        this.token = process.env.CRYPTO_PAY_TOKEN || '635745:AAfDBpdMO2zVWQ2O5UPYE51phir59gmhVU7';
        this.baseUrl = 'https://pay.crypt.bot/api';
        this.processedInvoices = new Set();
        this.loadProcessed();
    }

    loadProcessed() {
        try {
            if (fs.existsSync(PROCESSED_FILE)) {
                const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
                if (Array.isArray(data)) {
                    this.processedInvoices = new Set(data);
                }
            }
        } catch (e) {
            this.processedInvoices = new Set();
        }
    }

    saveProcessed() {
        try {
            fs.writeFileSync(PROCESSED_FILE, JSON.stringify(Array.from(this.processedInvoices), null, 2), 'utf8');
        } catch (e) {
            console.error('[CRYPTO_PAY] Error saving processed invoices:', e.message);
        }
    }

    async apiCall(endpoint, body = {}) {
        try {
            const res = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Crypto-Pay-API-Token': this.token
                },
                body: JSON.stringify(body)
            });
            return await res.json();
        } catch (e) {
            console.error(`[CRYPTO_PAY] API call ${endpoint} error:`, e.message);
            return { ok: false, error: e.message };
        }
    }

    /**
     * Create an instant CryptoBot invoice
     */
    async createInvoice({
        userId,
        username = 'User',
        amount = '29',
        currencyType = 'fiat',
        fiat = 'EUR',
        asset = 'USDT',
        description = 'Live Bet Mentor - Profesyonel Paket (30 Gün)',
        plan = 'PROFESYONEL',
        days = 30
    }) {
        try {
            const botUser = process.env.TELEGRAM_BOT_USERNAME || 'Livebetdeskbot';
            const payload = JSON.stringify({
                userId: String(userId),
                username,
                plan,
                days,
                createdAt: Date.now()
            });

            const params = {
                amount: String(amount),
                description,
                payload,
                paid_btn_name: 'openBot',
                paid_btn_url: `https://t.me/${botUser}`
            };

            if (currencyType === 'fiat') {
                params.currency_type = 'fiat';
                params.fiat = fiat || 'EUR';
            } else {
                params.currency_type = 'crypto';
                params.asset = asset || 'USDT';
            }

            const data = await this.apiCall('createInvoice', params);

            if (!data.ok || !data.result) {
                console.error('[CRYPTO_PAY] Failed to create invoice:', data);
                return { success: false, error: data.error || 'Invoice creation failed' };
            }

            const inv = data.result;
            this.saveInvoiceRecord(inv, { userId, username, plan, days });

            return {
                success: true,
                invoiceId: inv.invoice_id,
                payUrl: inv.bot_invoice_url || inv.pay_url,
                miniAppUrl: inv.mini_app_invoice_url,
                asset: inv.asset || inv.fiat || 'EUR',
                amount: inv.amount,
                status: inv.status
            };
        } catch (e) {
            console.error('[CRYPTO_PAY] Error in createInvoice:', e.message);
            return { success: false, error: e.message };
        }
    }

    saveInvoiceRecord(inv, meta) {
        try {
            let list = [];
            if (fs.existsSync(INVOICES_FILE)) {
                list = JSON.parse(fs.readFileSync(INVOICES_FILE, 'utf8'));
            }
            list.unshift({
                invoiceId: inv.invoice_id,
                userId: meta.userId,
                username: meta.username,
                amount: inv.amount,
                asset: inv.asset || inv.fiat || 'EUR',
                plan: meta.plan,
                days: meta.days,
                payUrl: inv.bot_invoice_url || inv.pay_url,
                createdAt: new Date().toISOString()
            });
            if (list.length > 200) list = list.slice(0, 200);
            fs.writeFileSync(INVOICES_FILE, JSON.stringify(list, null, 2), 'utf8');
        } catch (e) {}
    }

    /**
     * Check if a specific invoice has been paid
     */
    async checkInvoiceStatus(invoiceId) {
        try {
            const data = await this.apiCall('getInvoices', {
                invoice_ids: [parseInt(invoiceId, 10)]
            });

            if (!data.ok || !data.result || !data.result.items || data.result.items.length === 0) {
                return { success: false, status: 'NOT_FOUND' };
            }

            const item = data.result.items[0];
            return {
                success: true,
                status: item.status, // 'active', 'paid', 'expired'
                isPaid: item.status === 'paid',
                amount: item.amount,
                asset: item.asset || item.fiat || 'EUR',
                payload: item.payload ? JSON.parse(item.payload) : null
            };
        } catch (e) {
            console.error('[CRYPTO_PAY] Error checking invoice status:', e.message);
            return { success: false, error: e.message };
        }
    }

    /**
     * Poll recent paid invoices and activate VIP automatically
     */
    async syncRecentPayments(onPaymentSettled = null) {
        try {
            const data = await this.apiCall('getInvoices', {
                status: 'paid',
                count: 50
            });

            if (!data.ok || !data.result || !Array.isArray(data.result.items)) {
                return { count: 0 };
            }

            let newSettled = 0;
            for (const item of data.result.items) {
                const invId = String(item.invoice_id);
                if (this.processedInvoices.has(invId)) {
                    continue; // already activated
                }

                let meta = null;
                try {
                    meta = item.payload ? JSON.parse(item.payload) : null;
                } catch (e) {}

                const currency = item.asset || item.fiat || 'EUR';

                if (meta && meta.userId) {
                    this.processedInvoices.add(invId);
                    newSettled++;

                    console.log(`[CRYPTO_PAY] 💰 NEW PAYMENT CONFIRMED: ${item.amount} ${currency} from @${meta.username || meta.userId} (Invoice #${invId})`);

                    if (typeof onPaymentSettled === 'function') {
                        try {
                            await onPaymentSettled({
                                invoiceId: invId,
                                userId: meta.userId,
                                username: meta.username || 'User',
                                amount: item.amount,
                                asset: currency,
                                plan: meta.plan || 'PROFESYONEL',
                                days: meta.days || 30
                            });
                        } catch (err) {
                            console.error('[CRYPTO_PAY] Error in onPaymentSettled callback:', err.message);
                        }
                    }
                }
            }

            if (newSettled > 0) {
                this.saveProcessed();
            }

            return { count: newSettled };
        } catch (e) {
            console.error('[CRYPTO_PAY] Error syncing payments:', e.message);
            return { count: 0, error: e.message };
        }
    }
}

export const cryptoPay = new CryptoPayClient();
