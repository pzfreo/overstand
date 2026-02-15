/**
 * Cloud Presets Module
 *
 * CRUD operations for user cloud presets and link sharing via Supabase.
 */

import { getSupabaseClient, getCurrentUser, isAuthenticated } from './auth.js';

/**
 * Save (or overwrite) a preset to the cloud.
 * Uses UNIQUE(user_id, preset_name) — same name overwrites.
 *
 * @param {string} presetName - Name for the preset
 * @param {string} description - Optional description
 * @param {Object} parameters - The full parameter object
 * @returns {Object} The saved preset row
 */
export async function saveToCloud(presetName, description, parameters) {
    const supabase = getSupabaseClient();
    const user = getCurrentUser();
    if (!supabase || !user) throw new Error('Not authenticated');

    const metadata = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        description: description || 'Cloud preset'
    };

    const { data, error } = await supabase
        .from('user_presets')
        .upsert({
            user_id: user.id,
            preset_name: presetName,
            description: description || '',
            metadata,
            parameters
        }, {
            onConflict: 'user_id,preset_name'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Load all of the current user's cloud presets.
 * @returns {Array} Array of preset objects, newest first
 */
export async function loadUserPresets() {
    const supabase = getSupabaseClient();
    const user = getCurrentUser();
    if (!supabase || !user) return [];

    const { data, error } = await supabase
        .from('user_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Delete a cloud preset by its UUID.
 * @param {string} presetId - UUID of the preset to delete
 */
export async function deleteCloudPreset(presetId) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('user_presets')
        .delete()
        .eq('id', presetId);

    if (error) throw error;
}

/**
 * Create an immutable share link snapshot.
 * Returns the full shareable URL.
 *
 * @param {string} presetName - Name for the shared preset
 * @param {Object} parameters - The full parameter object
 * @returns {string} The shareable URL
 */
export async function createShareLink(presetName, parameters) {
    const supabase = getSupabaseClient();
    const user = getCurrentUser();
    if (!supabase || !user) throw new Error('Not authenticated');

    // Generate a share token via the DB function
    const { data: tokenData, error: tokenError } = await supabase
        .rpc('generate_share_token');
    if (tokenError) throw tokenError;

    const shareToken = tokenData;

    const metadata = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        shared_by: user.email || user.id
    };

    const { error } = await supabase
        .from('shared_presets')
        .insert({
            share_token: shareToken,
            owner_id: user.id,
            preset_name: presetName,
            metadata,
            parameters
        });

    if (error) throw error;

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?share=${shareToken}`;
}

/**
 * Load a shared preset by its share token.
 * Also increments the view count (fire and forget).
 *
 * @param {string} shareToken - The 8-char share token
 * @returns {Object|null} The shared preset, or null if not found
 */
export async function loadSharedPreset(shareToken) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('shared_presets')
        .select('*')
        .eq('share_token', shareToken)
        .single();

    if (error || !data) return null;

    // Increment view count (fire and forget, no need to await)
    supabase.rpc('increment_view_count', { token: shareToken }).catch(() => {});

    return data;
}

/**
 * Copy text to clipboard with fallback for older browsers.
 * @param {string} text
 * @returns {boolean} Whether the copy succeeded
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers / insecure contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        let success = false;
        try {
            success = document.execCommand('copy');
        } catch {
            // ignore
        }
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * Check if a cloud preset with the given name already exists for the current user.
 * @param {string} presetName
 * @returns {boolean}
 */
export async function cloudPresetExists(presetName) {
    const supabase = getSupabaseClient();
    const user = getCurrentUser();
    if (!supabase || !user) return false;

    const { data, error } = await supabase
        .from('user_presets')
        .select('id')
        .eq('user_id', user.id)
        .eq('preset_name', presetName)
        .maybeSingle();

    if (error) return false;
    return data !== null;
}
