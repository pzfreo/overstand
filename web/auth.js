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
        const params = new URLSearchParams(window.location.search);
        if (params.has('code')) {
            console.log('[Auth] OAuth code detected, exchanging for session...');
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

        notifyListeners(currentUser, 'INITIAL');
    } catch (error) {
        console.error('[Auth] Initialization failed:', error);
    }
}

/**
 * Sign in with an OAuth provider.
 * @param {'google'|'github'} provider
 */
export async function signInWithProvider(provider) {
    if (!supabase) return;

    const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });

    if (error) {
        console.error(`[Auth] ${provider} sign-in failed:`, error);
        throw error;
    }
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
