/**
 * DEVICE FINGERPRINTING & ANTI-ABUSE ENGINE
 * Generates a stable hardware/browser fingerprint to prevent serial trial abuse.
 */

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'nocanvas';
        
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('LiveBet, 12345!?', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('LiveBet, 12345!?', 4, 17);
        
        return simpleHash(canvas.toDataURL());
    } catch (e) {
        return 'canvaserr';
    }
}

function getWebGLFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'nowebgl';
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return 'nowebgldebug';
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
        return simpleHash(`${vendor}~${renderer}`);
    } catch (e) {
        return 'webglerr';
    }
}

export function getDeviceFingerprint() {
    if (typeof window === 'undefined') return 'server-env';

    // 1. Compute deterministic hardware attributes (persistent across incognito)
    const screenInfo = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}x${window.devicePixelRatio || 1}`;
    const tz = Intl?.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown_tz';
    const cpuCores = navigator.hardwareConcurrency || 2;
    const canvasHash = getCanvasFingerprint();
    const webglHash = getWebGLFingerprint();
    const platform = navigator.platform || 'unknown_platform';
    const lang = navigator.language || 'unknown_lang';

    const rawSignature = `${screenInfo}|${tz}|${cpuCores}|${canvasHash}|${webglHash}|${platform}|${lang}`;
    const hardwareHash = simpleHash(rawSignature);

    // Return deterministic hardware ID without Math.random() so incognito doesn't bypass detection
    return `hw_${hardwareHash}`;
}
