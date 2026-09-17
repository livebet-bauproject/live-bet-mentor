import crypto from 'crypto';

/**
 * 1. Cryptographic Password Hashing with PBKDF2 (100,000 iterations)
 */
export function hashPassword(password, salt) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

/**
 * 2. Timing-Safe Password Verification
 */
export function verifyPassword(password, storedHash, salt) {
    if (!password || !storedHash || !salt) return false;
    try {
        const hashToVerify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
        const a = Buffer.from(hashToVerify, 'hex');
        const b = Buffer.from(storedHash, 'hex');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (e) {
        return false;
    }
}

/**
 * 3. HMAC-SHA256 Signed Token Generation (Stateless & Cryptographically Signed)
 */
export function generateSecureToken(payload, secretKey, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Date.now() + expiresInMs;
    const fullPayload = { ...payload, exp, iat: Date.now() };
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secretKey).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

/**
 * 4. HMAC-SHA256 Signed Token Verification
 */
export function verifySecureToken(token, secretKey) {
    if (!token || typeof token !== 'string') return null;
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    try {
        const expectedSig = crypto.createHmac('sha256', secretKey).update(`${header}.${body}`).digest('base64url');
        const a = Buffer.from(signature);
        const b = Buffer.from(expectedSig);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return null; // Tampered token
        }
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) {
            return null; // Expired token
        }
        return payload;
    } catch (e) {
        return null;
    }
}

/**
 * 5. Strict Integer ID Validation (Prevents parameter-based RCE & command injection)
 */
export function isValidNumericId(id) {
    if (typeof id === 'number') return Number.isInteger(id) && id > 0;
    if (typeof id !== 'string') return false;
    return /^\d{1,12}$/.test(id.trim());
}

/**
 * 6. Lightweight In-Memory IP Rate Limiter (Protects against DoS & Brute Force)
 */
export function createRateLimiter({ windowMs = 60 * 1000, maxRequests = 100, message = 'Çok fazla istek yapıldı, lütfen biraz bekleyiniz.' }) {
    const ipHits = new Map();

    // Auto cleanup old entries every minute
    setInterval(() => {
        const now = Date.now();
        for (const [ip, timestamps] of ipHits.entries()) {
            const valid = timestamps.filter(t => now - t < windowMs);
            if (valid.length === 0) {
                ipHits.delete(ip);
            } else {
                ipHits.set(ip, valid);
            }
        }
    }, 60000);

    return (req, res, next) => {
        const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
        const clientIp = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();
        const now = Date.now();

        let timestamps = ipHits.get(clientIp) || [];
        timestamps = timestamps.filter(t => now - t < windowMs);

        if (timestamps.length >= maxRequests) {
            const retryAfterSec = Math.ceil((windowMs - (now - timestamps[0])) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                error: message,
                retryAfter: retryAfterSec
            });
        }

        timestamps.push(now);
        ipHits.set(clientIp, timestamps);
        next();
    };
}
