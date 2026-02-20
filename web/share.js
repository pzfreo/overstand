import { state, elements } from './state.js';
import * as ui from './ui.js';
import { showErrorModal } from './modal.js';
import { isAuthenticated, getCurrentUser } from './auth.js';
import { saveToCloud, createShareLink, loadSharedPreset, copyToClipboard, cloudPresetExists, publishToCommunity } from './cloud_presets.js';
import { collectParameters, applyParametersToForm, refreshAfterParameterLoad, confirmDiscardChanges, updateSaveIndicator, closeOverlay } from './params.js';
import { showLoginModal, refreshCloudPresets } from './auth-ui.js';

export function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
        window.matchMedia('(pointer: coarse)').matches;
}

export async function handleShareFromProfile(preset) {
    if (!preset || !preset.parameters) return;

    try {
        ui.setStatus('loading', 'Creating share link...');
        const url = await createShareLink(preset.preset_name, preset.parameters);

        if (navigator.share && isMobileDevice()) {
            try {
                await navigator.share({
                    title: `Overstand: ${preset.preset_name}`,
                    text: `Check out my instrument profile "${preset.preset_name}" on Overstand`,
                    url: url
                });
                ui.setStatus('ready', 'Shared successfully!');
                return;
            } catch (e) {
                if (e.name === 'AbortError') {
                    ui.setStatus('ready', 'Share cancelled');
                    return;
                }
            }
        }

        showShareModal(preset.preset_name, url);
        ui.setStatus('ready', 'Share link created');
    } catch (e) {
        console.error('[Share] Failed:', e);
        showErrorModal('Share Failed', e.message);
        ui.setStatus('error', 'Share link creation failed');
    }
}

export function showShareModal(profileName, shareUrl) {
    const overlay = document.getElementById('share-profile-overlay');
    if (!overlay) return;

    document.getElementById('share-profile-name').textContent = `"${profileName}"`;
    document.getElementById('share-url-input').value = shareUrl;

    const copyBtn = document.getElementById('share-copy-btn');
    copyBtn.textContent = '📋';
    copyBtn.classList.remove('copied');

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

export function closeShareModal() {
    closeOverlay('share-profile-overlay');
}

export async function handleShareCopy() {
    const urlInput = document.getElementById('share-url-input');
    const copyBtn = document.getElementById('share-copy-btn');
    if (!urlInput) return;

    const copied = await copyToClipboard(urlInput.value);
    if (copied) {
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
            copyBtn.textContent = '📋';
            copyBtn.classList.remove('copied');
        }, 2000);
    }
}

export function shareViaEmail() {
    const url = document.getElementById('share-url-input')?.value;
    if (!url) return;
    const name = document.getElementById('share-profile-name')?.textContent || 'an instrument profile';
    const subject = encodeURIComponent(`Check out my Overstand instrument profile`);
    const body = encodeURIComponent(`I created ${name} on Overstand. Take a look:\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
}

export function shareViaWhatsApp() {
    const url = document.getElementById('share-url-input')?.value;
    if (!url) return;
    const name = document.getElementById('share-profile-name')?.textContent || 'an instrument profile';
    const text = encodeURIComponent(`Check out my Overstand instrument profile ${name}: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

export function shareViaFacebook() {
    const url = document.getElementById('share-url-input')?.value;
    if (!url) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
}

export async function handleCloudSave() {
    if (!isAuthenticated()) { showLoginModal(); return; }

    const params = collectParameters();
    const defaultName = params.instrument_name || 'My Preset';

    const presetName = prompt('Profile name:', defaultName);
    if (!presetName) return;

    try {
        const exists = await cloudPresetExists(presetName);
        if (exists) {
            if (!confirm(`A profile named "${presetName}" already exists. Overwrite it?`)) return;
        }

        const description = document.getElementById('profile-description')?.value || '';
        await saveToCloud(presetName, description, params);
        await refreshCloudPresets();
        ui.setStatus('ready', `☁️ Saved "${presetName}" to cloud`);
        state.parametersModified = false;
        state.currentProfileName = presetName;
        updateSaveIndicator();
    } catch (e) {
        console.error('[Cloud] Save failed:', e);
        showErrorModal('Save Failed', e.message);
    }
}

export async function handleShare() {
    if (!isAuthenticated()) { showLoginModal(); return; }

    const params = collectParameters();
    const presetName = params.instrument_name || 'Shared Preset';

    try {
        ui.setStatus('loading', 'Creating share link...');
        const url = await createShareLink(presetName, params);

        if (navigator.share && isMobileDevice()) {
            try {
                await navigator.share({
                    title: `Overstand: ${presetName}`,
                    text: `Check out my instrument profile "${presetName}" on Overstand`,
                    url: url
                });
                ui.setStatus('ready', 'Shared successfully!');
                return;
            } catch (e) {
                if (e.name === 'AbortError') {
                    ui.setStatus('ready', 'Share cancelled');
                    return;
                }
            }
        }

        showShareModal(presetName, url);
        ui.setStatus('ready', 'Share link created');
    } catch (e) {
        console.error('[Share] Failed:', e);
        showErrorModal('Share Failed', e.message);
        ui.setStatus('error', 'Share link creation failed');
    }
}

export async function handleMenuPublish() {
    if (!isAuthenticated()) { showLoginModal(); return; }

    const params = collectParameters();
    const defaultName = state.currentProfileName || params.instrument_name || 'My Profile';

    const presetName = prompt('Publish to community as:', defaultName);
    if (!presetName) return;

    try {
        const exists = await cloudPresetExists(presetName);
        if (exists) {
            if (!confirm(`A profile named "${presetName}" already exists. Overwrite and publish?`)) return;
        }

        ui.setStatus('loading', 'Saving and publishing...');

        const description = document.getElementById('profile-description')?.value || '';
        await saveToCloud(presetName, description, params);
        await refreshCloudPresets();

        const user = getCurrentUser();
        const authorName = user.user_metadata?.full_name || user.email || 'Anonymous';
        const instrumentFamily = params.instrument_family || '';

        await publishToCommunity(presetName, description, params, authorName, instrumentFamily);

        state.parametersModified = false;
        state.currentProfileName = presetName;
        updateSaveIndicator();
        ui.setStatus('ready', `📢 Published "${presetName}" to community`);
    } catch (e) {
        console.error('[Publish] Failed:', e);
        showErrorModal('Publish Failed', e.message);
        ui.setStatus('error', 'Publish failed');
    }
}

export async function handleShareURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('share');
    if (!shareToken) return false;

    try {
        const shared = await loadSharedPreset(shareToken);
        if (!shared || !shared.parameters) {
            console.warn('[Share] Shared preset not found:', shareToken);
            window.history.replaceState({}, document.title,
                window.location.origin + window.location.pathname);
            return false;
        }

        state.sharedPreset = shared;

        applyParametersToForm(shared.parameters);

        const descEl = document.getElementById('profile-description');
        if (descEl) descEl.value = shared.description || '';

        const banner = document.getElementById('share-banner');
        const bannerText = document.getElementById('share-banner-text');
        if (banner && bannerText) {
            bannerText.textContent = `Viewing shared preset: "${shared.preset_name}"`;
            banner.style.display = 'flex';
        }

        if (elements.presetSelect) elements.presetSelect.value = '';
        state.parametersModified = false;
        state.currentProfileName = shared.preset_name;
        updateSaveIndicator();

        window.history.replaceState({}, document.title,
            window.location.origin + window.location.pathname);

        refreshAfterParameterLoad();

        return true;
    } catch (e) {
        console.error('[Share] Failed to load shared preset:', e);
        return false;
    }
}

export async function handleShareSave() {
    if (!isAuthenticated() || !state.sharedPreset) return;

    const presetName = prompt('Save profile as:', state.sharedPreset.preset_name);
    if (!presetName) return;

    try {
        const description = document.getElementById('profile-description')?.value || '';
        await saveToCloud(presetName, description, state.sharedPreset.parameters);
        await refreshCloudPresets();
        ui.setStatus('ready', `☁️ Saved "${presetName}" to cloud`);

        const banner = document.getElementById('share-banner');
        if (banner) banner.style.display = 'none';
        state.sharedPreset = null;
    } catch (e) {
        showErrorModal('Save Failed', e.message);
    }
}
