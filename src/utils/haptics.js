/**
 * HAPTIC FEEDBACK UTILITY (Mobile Vibration Engine)
 * Provides physical haptic feedback for mobile actions and live momentum alerts.
 */

import { telegramWebApp } from './telegramWebApp.js';

export const triggerHaptic = (type = 'light') => {
    // 1. First attempt Telegram WebApp native haptics if inside Telegram
    try {
        if (telegramWebApp.isInTelegram()) {
            if (type === 'success' || type === 'warning') {
                telegramWebApp.notification(type);
                return;
            } else if (type === 'flame' || type === 'fire' || type === 'heavy') {
                telegramWebApp.impact('heavy');
                return;
            } else {
                telegramWebApp.impact(type === 'medium' ? 'medium' : 'light');
                return;
            }
        }
    } catch (e) {}

    // 2. Standard Web Vibration API
    if (typeof window === 'undefined' || !navigator || typeof navigator.vibrate !== 'function') {
        return;
    }

    try {
        switch (type) {
            case 'light':
                navigator.vibrate(25);
                break;
            case 'medium':
                navigator.vibrate(45);
                break;
            case 'heavy':
                navigator.vibrate(75);
                break;
            case 'flame':
            case 'fire':
                // Special double pulse for fire / alev alert
                navigator.vibrate([40, 50, 40]);
                break;
            case 'success':
                navigator.vibrate([30, 40, 80]);
                break;
            case 'warning':
                navigator.vibrate([60, 40, 60]);
                break;
            default:
                navigator.vibrate(30);
        }
    } catch (e) {
        // Silently catch if browser restricts vibration
    }
};
