/**
 * FINTECH TRADING CHIME & AUDIO ALERT (v1.0)
 * Uses native Web Audio API (Zero external assets, zero 404s, works 100% offline).
 * Produces crisp, institutional TradingView/Bloomberg terminal chimes.
 */

class AudioAlertService {
    constructor() {
        this.ctx = null;
        this.enabled = typeof localStorage !== 'undefined' 
            ? localStorage.getItem('lbm_sound_enabled') !== 'false' 
            : true;
    }

    _getContext() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        return this.ctx;
    }

    isEnabled() {
        return this.enabled;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lbm_sound_enabled', String(this.enabled));
        }
        if (this.enabled) {
            this.playChime('TEST');
        }
        return this.enabled;
    }

    /**
     * Play institutional audio alert
     * @param {'ALEV'|'CASHOUT'|'VALUE'|'TEST'} type
     */
    playChime(type = 'ALEV') {
        if (!this.enabled) return;

        try {
            const ctx = this._getContext();
            if (!ctx) return;

            const now = ctx.currentTime;

            if (type === 'CASHOUT') {
                // Warning two-tone: High -> Low (740Hz -> 520Hz)
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(740, now);
                osc.frequency.exponentialRampToValueAtTime(520, now + 0.18);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.35);
            } else {
                // Ascending Terminal Chime: D5 (587Hz) -> A5 (880Hz)
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(587.33, now);
                gain1.gain.setValueAtTime(0.18, now);
                gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(now);
                osc1.stop(now + 0.12);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(880, now + 0.08);
                gain2.gain.setValueAtTime(0.22, now + 0.08);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(now + 0.08);
                osc2.stop(now + 0.38);
            }
        } catch (e) {
            // Silently ignore audio context autoplay restrictions
        }
    }
}

export const audioAlert = new AudioAlertService();
