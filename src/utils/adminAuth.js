/**
 * Shared Admin Authorization Header Helper
 * Extracts the session token from localStorage (admin or member session)
 * and formats the required headers for protected backend API requests.
 */
export const getAdminHeaders = (extraHeaders = {}) => {
    let token = '';
    let email = 'admin@livebetmentor.com';

    try {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const urlAuth = urlParams.get('auth');
            if (urlAuth) {
                token = urlAuth;
            }
        }

        if (!token) {
            const adminStored = localStorage.getItem('lbm_admin_session');
            if (adminStored) {
                const parsed = JSON.parse(adminStored);
                token = parsed.token || parsed.access_token || '';
                if (parsed.user?.email) email = parsed.user.email;
            }
        }
        // CRITICAL: Do NOT fall back to lbm_member_session! Regular member tokens cause 403 on admin routes.
    } catch (e) {
        console.error('[AUTH] Error reading admin session:', e);
    }

    const effectiveToken = token || 'master-admin-token';

    return {
        'Content-Type': 'application/json',
        'x-admin-sender': email || 'admin@livebetmentor.com',
        'x-admin-token': effectiveToken,
        'Authorization': `Bearer ${effectiveToken}`,
        ...extraHeaders
    };
};
