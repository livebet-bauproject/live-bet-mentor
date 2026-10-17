/**
 * 📱 TELEGRAM MINI APP (TMA) UTILITY
 * Handles Telegram WebApp SDK initialization, lifecycle, theme syncing, and haptics.
 */

class TelegramWebAppService {
    constructor() {
        this.webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
        this.isTMA = Boolean(this.webApp && (this.webApp.initData || this.webApp.platform));
        this.init();
    }

    /**
     * Initialize Telegram WebApp viewport and settings
     */
    init() {
        if (!this.webApp) {
            if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
                this.webApp = window.Telegram.WebApp;
                this.isTMA = Boolean(this.webApp.initData || this.webApp.platform);
            }
        }

        if (this.webApp) {
            try {
                // Signal ready state to Telegram client
                this.webApp.ready();

                // Automatically expand viewport to full height
                this.webApp.expand();

                // Enable closing confirmation to prevent accidental swipe-down exits during match viewing
                if (typeof this.webApp.enableClosingConfirmation === 'function') {
                    this.webApp.enableClosingConfirmation();
                }

                // Sync header color with dark theme
                if (typeof this.webApp.setHeaderColor === 'function') {
                    this.webApp.setHeaderColor('#0a0e17');
                }
                if (typeof this.webApp.setBackgroundColor === 'function') {
                    this.webApp.setBackgroundColor('#0a0e17');
                }

                console.log('[TMA] 🚀 Telegram WebApp initialized successfully. Platform:', this.webApp.platform || 'web');
            } catch (e) {
                console.warn('[TMA] Init warning:', e.message);
            }
        }
    }

    /**
     * Check if the app is currently running inside Telegram
     */
    isInTelegram() {
        return Boolean(this.webApp && (this.webApp.initData || this.webApp.platform));
    }

    /**
     * Get current Telegram user info if running in TMA
     */
    getUser() {
        if (!this.webApp?.initDataUnsafe?.user) return null;
        return this.webApp.initDataUnsafe.user;
    }

    /**
     * Get raw initData string for backend verification
     */
    getInitData() {
        return this.webApp?.initData || '';
    }

    /**
     * Trigger Telegram native haptic feedback
     * @param {'light'|'medium'|'heavy'|'rigid'|'soft'} style 
     */
    impact(style = 'medium') {
        try {
            if (this.webApp?.HapticFeedback?.impactOccurred) {
                this.webApp.HapticFeedback.impactOccurred(style);
                return true;
            }
        } catch (e) {}
        return false;
    }

    /**
     * Trigger Telegram notification haptic
     * @param {'error'|'success'|'warning'} type 
     */
    notification(type = 'success') {
        try {
            if (this.webApp?.HapticFeedback?.notificationOccurred) {
                this.webApp.HapticFeedback.notificationOccurred(type);
                return true;
            }
        } catch (e) {}
        return false;
    }

    /**
     * Open an external link or Telegram link inside Telegram
     */
    openLink(url) {
        if (!url) return;
        if (this.webApp?.openLink && !url.includes('t.me/')) {
            this.webApp.openLink(url);
        } else if (this.webApp?.openTelegramLink && url.includes('t.me/')) {
            this.webApp.openTelegramLink(url);
        } else if (typeof window !== 'undefined') {
            window.open(url, '_blank');
        }
    }

    /**
     * Close the Telegram Mini App
     */
    close() {
        if (this.webApp?.close) {
            this.webApp.close();
        }
    }
}

export const telegramWebApp = new TelegramWebAppService();
