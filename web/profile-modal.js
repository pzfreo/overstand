import { state, elements } from './state.js';
import * as ui from './ui.js';
import { escapeHtml, showErrorModal, showConfirmModal, showPromptModal } from './modal.js';
import { isAuthenticated, getCurrentUser } from './auth.js';
import { deleteCloudPreset, isPresetPublished, checkPublishedName, publishToCommunity, loadCommunityProfiles, unpublishFromCommunity, loadCommunityProfileParameters, getUserBookmarks, toggleBookmark } from './cloud_presets.js';
import { debounce, collectParameters, applyParametersToForm, refreshAfterParameterLoad, confirmDiscardChanges, updateSaveIndicator, closeOverlay } from './params.js';
import { showLoginModal, refreshCloudPresets } from './auth-ui.js';

// Forward declaration for loadPreset — injected by app.js to avoid circular dependency
let _loadPreset = null;

export function setLoadPresetCallback(fn) {
    _loadPreset = fn;
}

export function showLoadProfileModal() {
    const overlay = document.getElementById('load-profile-overlay');
    if (!overlay) return;

    populateStandardProfilesTab();
    populateMyProfilesTab();
    populateCommunityTab();

    switchProfileTab('standard');

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

export function closeLoadProfileModal() {
    closeOverlay('load-profile-overlay');
}

export function switchProfileTab(tabName) {
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.getElementById('standard-profiles-list').style.display = tabName === 'standard' ? '' : 'none';
    document.getElementById('my-profiles-list').style.display = tabName === 'my-profiles' ? '' : 'none';
    document.getElementById('community-profiles-list').style.display = tabName === 'community' ? '' : 'none';
}

function populateStandardProfilesTab() {
    const list = document.getElementById('standard-profiles-list');
    if (!list) return;
    list.innerHTML = '';

    const presetIds = Object.keys(state.presets || {});
    if (presetIds.length === 0) {
        list.innerHTML = '<div class="profile-empty-message">No standard presets found.</div>';
        return;
    }

    for (const presetId of presetIds) {
        const preset = state.presets[presetId];
        const row = document.createElement('div');
        row.className = 'profile-row';
        row.innerHTML = `
            <span class="profile-row-name">${escapeHtml(preset.name)}</span>
            <div class="profile-row-actions">
                <button class="profile-action-btn load-btn" data-preset-id="${escapeHtml(presetId)}">Load</button>
            </div>
        `;
        row.querySelector('.load-btn').addEventListener('click', () => {
            loadStandardPreset(presetId);
        });
        list.appendChild(row);
    }
}

function populateMyProfilesTab() {
    const list = document.getElementById('my-profiles-list');
    if (!list) return;
    list.innerHTML = '';

    if (!isAuthenticated()) {
        list.innerHTML = '<div class="profile-empty-message">Sign in to access your cloud profiles.</div>';
        return;
    }

    if (state.cloudPresets.length === 0) {
        list.innerHTML = '<div class="profile-empty-message">No saved profiles yet. Use Save Profile to create one.</div>';
        return;
    }

    for (const preset of state.cloudPresets) {
        const row = document.createElement('div');
        row.className = 'profile-row';
        const descHtml = preset.description ? `<div class="profile-row-description">${escapeHtml(preset.description)}</div>` : '';
        row.innerHTML = `
            <div class="profile-row-info">
                <span class="profile-row-name">${escapeHtml(preset.preset_name)}</span>
                ${descHtml}
            </div>
            <div class="profile-row-actions">
                <button class="profile-action-btn load-btn">Load</button>
                <button class="profile-action-btn delete-btn">Del</button>
            </div>
        `;
        row.querySelector('.load-btn').addEventListener('click', () => {
            loadCloudPreset(preset);
        });
        row.querySelector('.delete-btn').addEventListener('click', async () => {
            const published = await isPresetPublished(preset.preset_name);
            if (published) {
                const typed = await showPromptModal('Delete Published Profile',
                    `"${preset.preset_name}" is published to the community. Deleting it will also remove it from community profiles.\n\nType the profile name to confirm:`);
                if (typed !== preset.preset_name) {
                    if (typed !== null) showErrorModal('Delete Cancelled', 'The name you entered did not match.');
                    return;
                }
            } else {
                if (!await showConfirmModal('Delete Profile', `Delete profile "${preset.preset_name}"?`)) return;
            }
            try {
                await deleteCloudPreset(preset.id);
                await refreshCloudPresets();
                populateMyProfilesTab();
                ui.setStatus('ready', `Deleted "${preset.preset_name}"`);
            } catch (e) {
                showErrorModal('Delete Failed', e.message);
            }
        });
        list.appendChild(row);
    }
}

async function loadStandardPreset(presetId) {
    if (elements.presetSelect) elements.presetSelect.value = presetId;
    closeLoadProfileModal();
    if (_loadPreset) await _loadPreset();
}

async function loadCloudPreset(preset) {
    if (!preset || !preset.parameters) return;

    if (!await confirmDiscardChanges(`Loading "${preset.preset_name}" will overwrite your current parameter values.`)) return;

    applyParametersToForm(preset.parameters);

    const descEl = document.getElementById('profile-description');
    if (descEl) descEl.value = preset.description || '';

    if (elements.presetSelect) elements.presetSelect.value = '';
    state.parametersModified = false;
    state.currentProfileName = preset.preset_name;
    updateSaveIndicator();

    refreshAfterParameterLoad();
    ui.setStatus('ready', `☁️ Loaded "${preset.preset_name}"`);

    closeLoadProfileModal();
}

// ============================================================================
// Community Profiles
// ============================================================================

const INSTRUMENT_FAMILY_DISPLAY = {
    'VIOLIN': 'Violin',
    'VIOLA': 'Viola',
    'CELLO': 'Cello',
    'VIOL': 'Viol',
    'GUITAR_MANDOLIN': 'Guitar/Mandolin'
};

function buildCommunityControls() {
    const controls = document.createElement('div');
    controls.className = 'community-controls';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'community-search-input';
    searchInput.placeholder = 'Search profiles...';
    searchInput.id = 'community-search';

    const filterSelect = document.createElement('select');
    filterSelect.className = 'community-filter-select';
    filterSelect.id = 'community-filter';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Instruments';
    filterSelect.appendChild(allOption);

    for (const [value, label] of Object.entries(INSTRUMENT_FAMILY_DISPLAY)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        filterSelect.appendChild(option);
    }

    const debouncedSearch = debounce(() => populateCommunityTab(), 300);
    searchInput.addEventListener('input', debouncedSearch);
    filterSelect.addEventListener('change', () => populateCommunityTab());

    controls.appendChild(searchInput);
    controls.appendChild(filterSelect);
    return controls;
}

export async function populateCommunityTab() {
    const list = document.getElementById('community-profiles-list');
    if (!list) return;

    let controls = list.querySelector('.community-controls');
    if (!controls) {
        list.innerHTML = '';
        controls = buildCommunityControls();
        list.appendChild(controls);
    }

    while (controls.nextSibling) {
        list.removeChild(controls.nextSibling);
    }

    const searchQuery = document.getElementById('community-search')?.value || '';
    const instrumentFamily = document.getElementById('community-filter')?.value || '';

    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'profile-empty-message';
    loadingMsg.textContent = 'Loading community profiles...';
    list.appendChild(loadingMsg);

    const isLoggedIn = isAuthenticated();

    try {
        const [profiles, bookmarkedIds] = await Promise.all([
            loadCommunityProfiles(searchQuery, instrumentFamily),
            isLoggedIn ? getUserBookmarks() : Promise.resolve([])
        ]);
        list.removeChild(loadingMsg);

        if (profiles.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'profile-empty-message';
            empty.textContent = searchQuery || instrumentFamily
                ? 'No profiles match your search.'
                : 'No community profiles yet. Be the first to publish!';
            list.appendChild(empty);
            return;
        }

        const userBookmarks = new Set(bookmarkedIds);
        const currentUserId = getCurrentUser()?.id;

        profiles.sort((a, b) => {
            const aBookmarked = userBookmarks.has(a.id) ? 1 : 0;
            const bBookmarked = userBookmarks.has(b.id) ? 1 : 0;
            if (bBookmarked !== aBookmarked) return bBookmarked - aBookmarked;
            return 0;
        });

        for (const profile of profiles) {
            const row = document.createElement('div');
            row.className = 'profile-row';

            const familyDisplay = INSTRUMENT_FAMILY_DISPLAY[profile.instrument_family] || profile.instrument_family || '';
            const descHtml = profile.description
                ? `<div class="profile-row-description">${escapeHtml(profile.description)}</div>`
                : '';
            const bookmarkInfo = profile.bookmark_count ? ` · ${profile.bookmark_count} bookmarks` : '';
            const metaHtml = `<div class="profile-row-meta">${escapeHtml(profile.author_name || 'Anonymous')}${familyDisplay ? ' · ' + escapeHtml(familyDisplay) : ''}${profile.view_count ? ' · ' + profile.view_count + ' views' : ''}${bookmarkInfo}</div>`;

            const isOwner = currentUserId && profile.owner_id === currentUserId;
            const unpublishBtn = isOwner
                ? `<button class="profile-action-btn unpublish-btn">Unpublish</button>`
                : '';

            const isBookmarked = userBookmarks.has(profile.id);
            const starBtn = isLoggedIn
                ? `<button class="profile-action-btn star-btn${isBookmarked ? ' bookmarked' : ''}" title="${isBookmarked ? 'Remove bookmark' : 'Bookmark this profile'}">${isBookmarked ? '★' : '☆'}</button>`
                : '';

            row.innerHTML = `
                <div class="profile-row-info">
                    <span class="profile-row-name">${escapeHtml(profile.preset_name)}</span>
                    ${descHtml}
                    ${metaHtml}
                </div>
                <div class="profile-row-actions">
                    ${starBtn}
                    <button class="profile-action-btn load-btn">Load</button>
                    ${unpublishBtn}
                </div>
            `;

            row.querySelector('.load-btn').addEventListener('click', () => {
                loadCommunityPreset(profile);
            });

            const starEl = row.querySelector('.star-btn');
            if (starEl) {
                starEl.addEventListener('click', async () => {
                    const wasBookmarked = userBookmarks.has(profile.id);
                    try {
                        const nowBookmarked = await toggleBookmark(profile.id, wasBookmarked);
                        if (nowBookmarked) {
                            userBookmarks.add(profile.id);
                            starEl.textContent = '★';
                            starEl.classList.add('bookmarked');
                            starEl.title = 'Remove bookmark';
                        } else {
                            userBookmarks.delete(profile.id);
                            starEl.textContent = '☆';
                            starEl.classList.remove('bookmarked');
                            starEl.title = 'Bookmark this profile';
                        }
                    } catch (e) {
                        console.error('[Bookmark] Toggle failed:', e);
                    }
                });
            }

            const unpublishEl = row.querySelector('.unpublish-btn');
            if (unpublishEl) {
                unpublishEl.addEventListener('click', async () => {
                    if (!await showConfirmModal('Unpublish Profile', `Remove "${profile.preset_name}" from community profiles?`)) return;
                    try {
                        await unpublishFromCommunity(profile.id);
                        populateCommunityTab();
                        ui.setStatus('ready', `Unpublished "${profile.preset_name}"`);
                    } catch (e) {
                        showErrorModal('Unpublish Failed', e.message);
                    }
                });
            }

            list.appendChild(row);
        }
    } catch (e) {
        list.removeChild(loadingMsg);
        const errMsg = document.createElement('div');
        errMsg.className = 'profile-empty-message';
        errMsg.textContent = 'Failed to load community profiles.';
        list.appendChild(errMsg);
        console.error('[Community] Load failed:', e);
    }
}

async function loadCommunityPreset(profile) {
    if (!await confirmDiscardChanges(`Loading "${profile.preset_name}" will overwrite your current parameter values.`)) return;

    try {
        ui.setStatus('loading', 'Loading community profile...');
        const full = await loadCommunityProfileParameters(profile.id);
        if (!full || !full.parameters) {
            showErrorModal('Load Failed', 'Could not load profile parameters.');
            ui.setStatus('error', 'Failed to load community profile');
            return;
        }

        applyParametersToForm(full.parameters);

        const descEl = document.getElementById('profile-description');
        if (descEl) descEl.value = full.description || '';

        if (elements.presetSelect) elements.presetSelect.value = '';
        state.parametersModified = false;
        state.currentProfileName = full.preset_name;
        updateSaveIndicator();

        refreshAfterParameterLoad();
        ui.setStatus('ready', `Loaded "${full.preset_name}" by ${full.author_name || 'Anonymous'}`);
        closeLoadProfileModal();
    } catch (e) {
        console.error('[Community] Load preset failed:', e);
        showErrorModal('Load Failed', e.message);
        ui.setStatus('error', 'Failed to load community profile');
    }
}

export async function handlePublish(preset) {
    if (!preset || !preset.parameters) return;

    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }

    const authorName = user.user_metadata?.full_name || user.email || 'Anonymous';
    const instrumentFamily = preset.parameters.instrument_family || '';

    const published = await checkPublishedName(preset.preset_name);
    if (published.exists && !published.isOwner) {
        showErrorModal('Name Taken', `A community profile named "${preset.preset_name}" is already published by another user. Please choose a different name.`);
        return;
    }

    const confirmMsg = published.exists && published.isOwner
        ? `Update your published profile "${preset.preset_name}" with new parameters?\n\nAuthor: ${authorName}\nThis will be visible to all Overstand users.`
        : `Publish "${preset.preset_name}" to the community?\n\nAuthor: ${authorName}\nThis will be visible to all Overstand users.`;
    const confirmed = await showConfirmModal(
        published.isOwner ? 'Update Published Profile' : 'Publish Profile',
        confirmMsg
    );
    if (!confirmed) return;

    try {
        ui.setStatus('loading', 'Publishing to community...');
        await publishToCommunity(
            preset.preset_name,
            preset.description || '',
            preset.parameters,
            authorName,
            instrumentFamily
        );
        ui.setStatus('ready', `Published "${preset.preset_name}" to community`);
    } catch (e) {
        console.error('[Community] Publish failed:', e);
        showErrorModal('Publish Failed', e.message);
        ui.setStatus('error', 'Publish failed');
    }
}
