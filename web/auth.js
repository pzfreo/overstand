/**
 * Authentication Module
 *
 * Handles Supabase auth: OAuth sign-in (Google/GitHub), session management,
 * and auth state change notifications.
 *
 * Sign-in uses a popup window to avoid reloading the main page (and Pyodide).
 * The popup completes OAuth, writes tokens (implicit) or code (PKCE) to localStorage,
 * and the opener picks it up via polling and sets the session.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let supabase = null;
let authStateListeners = [];
let currentUser = null;
let exchangingCode = false;

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

        // Listen for oauth-result from popup via localStorage (storage event fires cross-window)
        window.addEventListener('storage', handleOAuthStorage);

        notifyListeners(currentUser, 'INITIAL');
    } catch (error) {
        console.error('[Auth] Initialization failed:', error);
    }
}

/**
 * Handle localStorage change from OAuth popup.
 * The storage event fires in other windows when localStorage is modified.
 * This is a backup — signInWithProvider also polls localStorage directly.
 */
async function handleOAuthStorage(event) {
    if (event.key !== 'oauth-result' || !event.newValue) return;

    const result = event.newValue;
    localStorage.removeItem('oauth-result');
    await handleOAuthResult(result);
}

/**
 * Process OAuth result from the popup (either implicit tokens or PKCE code).
 * Called by both the storage event handler and the polling fallback.
 */
async function handleOAuthResult(resultJson) {
    if (!supabase || exchangingCode) return;
    exchangingCode = true;

    try {
        const result = JSON.parse(resultJson);

        if (result.access_token && result.refresh_token) {
            // Implicit flow — set session directly from tokens
            console.log('[Auth] Setting session from popup tokens...');
            const { data, error } = await supabase.auth.setSession({
                access_token: result.access_token,
                refresh_token: result.refresh_token
            });
            if (error) {
                console.error('[Auth] setSession failed:', error);
            } else {
                currentUser = data.session?.user || null;
                console.log('[Auth] Popup sign-in succeeded:', currentUser?.email);
                notifyListeners(currentUser, 'SIGNED_IN');
            }
        } else if (result.code) {
            // PKCE flow — exchange code for session
            console.log('[Auth] Exchanging oauth code for session...');
            const { data, error } = await supabase.auth.exchangeCodeForSession(result.code);
            if (error) {
                console.error('[Auth] Code exchange failed:', error);
            } else {
                currentUser = data.session?.user || null;
                console.log('[Auth] Popup sign-in succeeded:', currentUser?.email);
                notifyListeners(currentUser, 'SIGNED_IN');
            }
        }
    } catch (e) {
        console.error('[Auth] OAuth result processing error:', e);
    } finally {
        exchangingCode = false;
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
    localStorage.removeItem('oauth-result');

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
        return;
    }

    // Poll localStorage as a fallback — the storage event can be unreliable
    // when the popup closes immediately after writing.
    const pollInterval = setInterval(async () => {
        const result = localStorage.getItem('oauth-result');
        if (result) {
            clearInterval(pollInterval);
            localStorage.removeItem('oauth-result');
            await handleOAuthResult(result);
        }
    }, 300);

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
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
