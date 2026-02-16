/**
 * Authentication Module
 *
 * Handles Supabase auth: OAuth sign-in (Google/GitHub), session management,
 * and auth state change notifications.
 *
 * Sign-in uses a popup window to avoid reloading the main page (and Pyodide).
 * The popup completes OAuth, writes the auth code to localStorage,
 * and the opener picks it up via the storage event and exchanges it.
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

        // Handle OAuth redirect (only when popup was blocked and we got a full redirect)
        const params = new URLSearchParams(window.location.search);
        if (params.has('code') && !window.opener) {
            console.log('[Auth] OAuth code detected (redirect fallback), exchanging...');
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.get('code'));
            if (exchangeError) {
                console.error('[Auth] Code exchange failed:', exchangeError);
            } else {
                currentUser = data.session?.user || null;
                console.log('[Auth] Code exchange succeeded:', currentUser?.email);
            }
            cleanupOAuthRedirect();
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

        // Listen for oauth-code from popup via localStorage (storage event fires cross-window)
        window.addEventListener('storage', handleOAuthStorage);

        notifyListeners(currentUser, 'INITIAL');
    } catch (error) {
        console.error('[Auth] Initialization failed:', error);
    }
}

/**
 * Handle localStorage change from OAuth popup.
 * The storage event fires in other windows when localStorage is modified.
 */
async function handleOAuthStorage(event) {
    if (event.key !== 'oauth-code' || !event.newValue) return;

    const code = event.newValue;
    localStorage.removeItem('oauth-code');

    if (!supabase) return;

    console.log('[Auth] Received oauth-code from popup, exchanging...');
    try {
        const { data: sessionData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
            console.error('[Auth] Code exchange failed:', exchangeError);
        } else {
            currentUser = sessionData.session?.user || null;
            console.log('[Auth] Popup sign-in succeeded:', currentUser?.email);
            notifyListeners(currentUser, 'SIGNED_IN');
        }
    } catch (e) {
        console.error('[Auth] Code exchange error:', e);
    }
}

/**
 * Sign in with an OAuth provider using a popup window.
 * This avoids a full page reload (which would re-initialize Pyodide).
 * Falls back to redirect if popup is blocked.
 * @param {'google'|'github'} provider
 */
export async function signInWithProvider(provider) {
    if (!supabase) return;

    // Get the OAuth URL without redirecting
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'oauth-callback.html',
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

    // Clear any stale oauth code
    localStorage.removeItem('oauth-code');

    // Open in a centered popup
    const width = 500, height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
        data.url,
        'oauth-popup',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
        // Popup blocked — fall back to full redirect
        console.warn('[Auth] Popup blocked, falling back to redirect');
        window.location.href = data.url;
    }

    // The popup redirects to oauth-callback.html, which writes the code
    // to localStorage. The storage event handler picks it up from here.
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
