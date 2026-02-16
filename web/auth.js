/**
 * Authentication Module
 *
 * Handles Supabase auth: OAuth sign-in (Google/GitHub), session management,
 * and auth state change notifications.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let supabase = null;
let authStateListeners = [];
let currentUser = null;

/**
 * Initialize the Supabase client and set up auth state listening.
 * Call this once on app startup.
 */
export async function initAuth() {
    if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('[Auth] Supabase not configured. Cloud features disabled.');
        return;
    }

    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Listen for auth state changes (fires after code exchange, sign-in, sign-out)
        supabase.auth.onAuthStateChange((event, session) => {
            const user = session?.user || null;
            currentUser = user;
            console.log(`[Auth] State change: ${event}, user: ${user?.email || 'none'}`);
            notifyListeners(user, event);
        });

        // Handle OAuth redirect — exchange code for session before anything else
        // If we're in a popup, the opener's polling will handle the code exchange.
        // Just let the popup sit with ?code= until the opener reads it and closes it.
        const params = new URLSearchParams(window.location.search);
        if (params.has('code') && !window.opener) {
            // Direct redirect (popup was blocked) — exchange code here
            console.log('[Auth] OAuth code detected (no popup), exchanging for session...');
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.get('code'));
            if (exchangeError) {
                console.error('[Auth] Code exchange failed:', exchangeError);
            } else {
                currentUser = data.session?.user || null;
                console.log('[Auth] Code exchange succeeded:', currentUser?.email);
            }
            cleanupOAuthRedirect();
        } else if (params.has('code') && window.opener) {
            // We're in a popup — the opener will read our URL and exchange the code.
            // Nothing to do here; the opener's polling interval handles everything.
            console.log('[Auth] In popup with code, waiting for opener to handle...');
            return; // Skip the rest of init — no need to load presets etc.
        } else if (window.location.hash.includes('access_token')) {
            // Implicit flow fallback (older Supabase or non-PKCE)
            const { data: { session } } = await supabase.auth.getSession();
            currentUser = session?.user || null;
            cleanupOAuthRedirect();
        } else {
            // No OAuth redirect — just check for existing session
            const { data: { session } } = await supabase.auth.getSession();
            currentUser = session?.user || null;
        }

        notifyListeners(currentUser, 'INITIAL');
    } catch (error) {
        console.error('[Auth] Initialization failed:', error);
    }
}

/**
 * Sign in with an OAuth provider using a popup window.
 * This avoids a full page reload (which would re-initialize Pyodide).
 * @param {'google'|'github'} provider
 */
export async function signInWithProvider(provider) {
    if (!supabase) return;

    // Get the OAuth URL without redirecting
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: window.location.origin + window.location.pathname,
            skipBrowserRedirect: true
        }
    });

    if (error) {
        console.error(`[Auth] ${provider} sign-in failed:`, error);
        throw error;
    }

    if (!data?.url) {
        throw new Error('No OAuth URL returned');
    }

    // Open in a popup
    const width = 500, height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
        data.url,
        'oauth-popup',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
        // Popup blocked — fall back to redirect
        console.warn('[Auth] Popup blocked, falling back to redirect');
        window.location.href = data.url;
        return;
    }

    // Poll for the popup to redirect back with ?code= or to close
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            try {
                // Check if popup navigated back to our origin
                if (popup.location?.origin === window.location.origin) {
                    const popupUrl = new URL(popup.location.href);
                    const code = popupUrl.searchParams.get('code');
                    popup.close();
                    clearInterval(interval);

                    if (code) {
                        const { data: sessionData, error: exchangeError } =
                            await supabase.auth.exchangeCodeForSession(code);
                        if (exchangeError) {
                            console.error('[Auth] Code exchange failed:', exchangeError);
                            reject(exchangeError);
                        } else {
                            currentUser = sessionData.session?.user || null;
                            console.log('[Auth] Popup sign-in succeeded:', currentUser?.email);
                            notifyListeners(currentUser, 'SIGNED_IN');
                            resolve();
                        }
                    } else {
                        resolve(); // No code, user may have cancelled
                    }
                }
            } catch (e) {
                // Cross-origin — popup is still on the OAuth provider's page
            }

            if (popup.closed) {
                clearInterval(interval);
                // Popup closed — check if session was established
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user && session.user.id !== currentUser?.id) {
                    currentUser = session.user;
                    notifyListeners(currentUser, 'SIGNED_IN');
                }
                resolve();
            }
        }, 300);
    });
}

/**
 * Sign out the current user.
 */
export async function signOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('[Auth] Sign out failed:', error);
        throw error;
    }
}

/**
 * Get the currently authenticated user, or null.
 * @returns {Object|null}
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Check if a user is currently authenticated.
 * @returns {boolean}
 */
export function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Get the Supabase client instance (for use by cloud_presets.js).
 * @returns {Object|null}
 */
export function getSupabaseClient() {
    return supabase;
}

/**
 * Register a callback for auth state changes.
 * @param {Function} listener - Called with (user, event) on state change
 */
export function onAuthStateChange(listener) {
    authStateListeners.push(listener);
}

/**
 * Remove all URL fragments and params left by OAuth redirect.
 */
function cleanupOAuthRedirect() {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
}

function notifyListeners(user, event) {
    for (const listener of authStateListeners) {
        try {
            listener(user, event);
        } catch (e) {
            console.error('[Auth] Listener error:', e);
        }
    }
}
