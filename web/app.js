import { state, elements, initElements } from './state.js';
import * as ui from './ui.js';
import { downloadPDF } from './pdf_export.js';
import { registerServiceWorker, initInstallPrompt } from './pwa_manager.js';
import { closeModal, showErrorModal } from './modal.js';
import { ZOOM_CONFIG } from './constants.js';
import * as analytics from './analytics.js';
import { initAuth, signOut, isAuthenticated, onAuthStateChange } from './auth.js';

// Extracted modules
import { collectParameters, setGenerationCallbacks, handleParameterChange, markParametersModified, updateSaveIndicator, confirmDiscardChanges, applyParametersToForm, refreshAfterParameterLoad } from './params.js';
import { generateNeck, updateDerivedValues, debouncedGenerate } from './generation.js';
import { downloadSVG, saveParameters, handleLoadParameters, sanitizeFilename } from './downloads.js';
import { showKeyboardShortcuts, showAbout, clearCacheAndReload } from './info-modals.js';
import { updateAuthUI, showLoginModal, refreshCloudPresets } from './auth-ui.js';
import { showLoadProfileModal, closeLoadProfileModal, switchProfileTab, setLoadPresetCallback } from './profile-modal.js';
import { handleCloudSave, handleShare, handleShareURL, handleShareSave, closeShareModal, handleShareCopy, shareViaEmail, shareViaWhatsApp, shareViaFacebook } from './share.js';
import { initKeyboardShortcuts, setKeyboardActions } from './keyboard.js';

// Wire up circular dependency callbacks
setGenerationCallbacks({ updateDerivedValues, debouncedGenerate });

const UI_CALLBACKS = {
    collectParameters,
    onInputChange: handleParameterChange,
    onEnumChange: handleParameterChange,
    debouncedGenerate
};

async function loadPresetsFromDirectory() {
    const presets = {};
    const presetPaths = ['./presets/', '../presets/'];

    for (const basePath of presetPaths) {
        try {
            const manifestResponse = await fetch(`${basePath}presets.json`);
            if (!manifestResponse.ok) continue;

            const manifest = await manifestResponse.json();
            const presetFiles = manifest.presets || [];

            for (const filename of presetFiles) {
                try {
                    const response = await fetch(`${basePath}${filename}`);
                    if (response.ok) {
                        const presetData = await response.json();
                        const presetId = filename.replace('.json', '');
                        if (presetData.parameters) {
                            presets[presetId] = {
                                name: presetData.parameters.instrument_name || presetId,
                                parameters: presetData.parameters
                            };
                        }
                    }
                } catch (e) { console.warn(`Failed to load preset ${filename}:`, e); }
            }
            if (Object.keys(presets).length > 0) break;
        } catch (e) { console.warn(`Failed to load presets from ${basePath}:`, e); }
    }
    return presets;
}

async function loadVersionInfo() {
    try {
        const response = await fetch('version.json');
        if (response.ok) {
            const versionData = await response.json();
            const versionEl = document.getElementById('version-info');
            if (versionEl) {
                versionEl.textContent = `v${versionData.version} (${versionData.commit})`;
                versionEl.title = `Build #${versionData.buildNumber}\nBuilt: ${new Date(versionData.buildTime).toLocaleString()}`;
            }
            console.log('Version:', versionData);
        }
    } catch (e) {
        console.warn('Could not load version info:', e);
    }
}

async function loadPreset() {
    const presetId = elements.presetSelect.value;
    if (!presetId) return;

    const presetDisplayName = state.uiMetadata?.presets?.[presetId]?.display_name || state.presets?.[presetId]?.name || presetId;
    if (!confirmDiscardChanges(`Loading "${presetDisplayName}" will overwrite your current parameter values.`)) {
        const previousValue = elements.presetSelect?.dataset.previousValue || '';
        if (elements.presetSelect) elements.presetSelect.value = previousValue;
        return;
    }

    let parameters = null;

    const presetPaths = ['./presets/', '../presets/'];
    const filename = `${presetId}.json`;

    for (const basePath of presetPaths) {
        try {
            const response = await fetch(`${basePath}${filename}`);
            if (response.ok) {
                const presetData = await response.json();
                if (presetData.parameters) {
                    parameters = presetData.parameters;
                    break;
                }
            }
        } catch (e) {
            console.warn(`Could not load preset from ${basePath}${filename}:`, e);
        }
    }

    if (!parameters && state.presets && state.presets[presetId]) {
        parameters = state.presets[presetId].parameters;
    }

    if (!parameters && state.uiMetadata && state.uiMetadata.presets && state.uiMetadata.presets[presetId]) {
        parameters = state.uiMetadata.presets[presetId].basic_params;
    }

    if (!parameters) {
        console.error(`Could not load preset: ${presetId}`);
        return;
    }

    applyParametersToForm(parameters);

    const descEl = document.getElementById('profile-description');
    if (descEl) descEl.value = '';

    state.parametersModified = false;
    state.currentProfileName = state.uiMetadata?.presets?.[presetId]?.display_name || state.presets?.[presetId]?.name || presetId;
    updateSaveIndicator();

    if (elements.presetSelect) {
        elements.presetSelect.dataset.previousValue = presetId;
    }

    refreshAfterParameterLoad();
    analytics.trackPresetSelected(presetId, parameters.instrument_family || 'unknown');
}

// Wire up profile-modal's loadPreset callback
setLoadPresetCallback(loadPreset);

// View and zoom
function switchView(viewName) {
    if (!state.views) return;
    state.currentView = viewName;
    ui.displayCurrentView();
    analytics.trackViewChanged(viewName);
}

function zoomIn() { if (state.svgCanvas) state.svgCanvas.zoom(state.svgCanvas.zoom() * ZOOM_CONFIG.factor); }
function zoomOut() { if (state.svgCanvas) state.svgCanvas.zoom(state.svgCanvas.zoom() / ZOOM_CONFIG.factor); }
function zoomReset() {
    if (state.svgCanvas && state.initialViewBox) {
        state.svgCanvas.viewbox(state.initialViewBox.x, state.initialViewBox.y, state.initialViewBox.width, state.initialViewBox.height);
    }
}

// Menu
function openMenu() {
    const overlay = document.getElementById('app-menu-overlay');
    if (overlay) overlay.classList.add('open');
}

function closeMenu() {
    const overlay = document.getElementById('app-menu-overlay');
    if (overlay) overlay.classList.remove('open');
}

async function initializePython() {
    try {
        ui.setStatus('loading', 'Loading Python engine...');
        state.pyodide = await loadPyodide();

        ui.setStatus('loading', 'Installing package manager...');
        await state.pyodide.loadPackage('micropip');

        ui.setStatus('loading', 'Installing Python libraries...');
        await state.pyodide.runPythonAsync(`
            import micropip
            await micropip.install(["numpy", "svgpathtools", "matplotlib"])
        `);

        ui.setStatus('loading', 'Loading instrument neck modules...');
        const modules = [
            'constants.py', 'buildprimitives.py', 'dimension_helpers.py',
            'parameter_registry.py', 'ui_metadata.py', 'preset_loader.py',
            'radius_template.py', 'instrument_geometry.py', 'instrument_generator.py',
            'geometry_engine.py', 'svg_renderer.py', 'view_generator.py'
        ];

        for (const moduleName of modules) {
            const timestamp = new Date().getTime();
            let response = await fetch(`./${moduleName}?t=${timestamp}`);
            if (!response.ok) response = await fetch(`../src/${moduleName}?t=${timestamp}`);
            if (!response.ok) throw new Error(`Could not find ${moduleName}`);
            const code = await response.text();
            state.pyodide.FS.writeFile(moduleName, code);
        }

        await state.pyodide.runPythonAsync(`
            import sys
            import os
            if '' not in sys.path:
                sys.path.insert(0, '')

            # Import dependencies first
            import constants, buildprimitives, dimension_helpers, parameter_registry, radius_template
            import geometry_engine, svg_renderer, view_generator
            # Then orchestrators
            import instrument_geometry, instrument_generator
        `);

        ui.setStatus('loading', 'Loading fonts...');
        try {
            let fontResponse = await fetch('fonts/AllertaStencil-Regular.ttf');
            if (!fontResponse.ok) fontResponse = await fetch('../fonts/AllertaStencil-Regular.ttf');
            if (fontResponse.ok) {
                const fontData = await fontResponse.arrayBuffer();
                state.pyodide.FS.writeFile('/tmp/AllertaStencil-Regular.ttf', new Uint8Array(fontData));
            }
        } catch (e) { console.warn('Could not pre-load font file:', e); }

        ui.setStatus('loading', 'Building interface...');
        const paramDefsJson = await state.pyodide.runPythonAsync(`instrument_generator.get_parameter_definitions()`);
        state.parameterDefinitions = JSON.parse(paramDefsJson);

        const derivedMetaJson = await state.pyodide.runPythonAsync(`instrument_generator.get_derived_value_metadata()`);
        const derivedMetaResult = JSON.parse(derivedMetaJson);
        if (derivedMetaResult.success) state.derivedMetadata = derivedMetaResult.metadata;

        const uiMetaJson = await state.pyodide.runPythonAsync(`instrument_generator.get_ui_metadata()`);
        const uiMetaResult = JSON.parse(uiMetaJson);
        if (uiMetaResult.success) {
            state.uiMetadata = uiMetaResult.metadata;
        } else {
            console.error('Failed to load UI metadata:', uiMetaResult.error);
        }

        state.presets = await loadPresetsFromDirectory();

        ui.generateUI(UI_CALLBACKS);
        ui.populatePresets();

        const loadedShared = await handleShareURL();

        if (loadedShared) {
            // Shared preset already applied parameters
        } else if (elements.presetSelect && elements.presetSelect.value) {
            await loadPreset();
        } else {
            updateDerivedValues();
            generateNeck();
        }

        if (elements.presetSelect && elements.presetSelect.value) {
            elements.presetSelect.dataset.previousValue = elements.presetSelect.value;
        }

        state.parametersModified = false;
        updateSaveIndicator();

        elements.genBtn.disabled = false;
    } catch (error) {
        ui.setStatus('error', '❌ Initialization failed');
        ui.showErrors([`Failed to initialize: ${error.message}`], 'critical');
        console.error('Initialization error:', error);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    analytics.startEngagementTracking();

    // CRITICAL: Set up Clear Cache FIRST so it always works, even if everything else fails
    try {
        const mmCache = document.getElementById('mm-cache');
        if (mmCache) mmCache.addEventListener('click', () => { closeMenu(); clearCacheAndReload(); });
        console.log('[Init] Menu setup complete');
    } catch (e) {
        console.error('[Init] Menu setup failed:', e);
    }

    initElements();

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = document.getElementById('gen-btn-shortcut');
    if (shortcut) shortcut.textContent = isMac ? '⌘ + Enter' : 'Ctrl + Enter';

    // Core controls
    if (elements.genBtn) elements.genBtn.addEventListener('click', generateNeck);
    if (elements.presetSelect) elements.presetSelect.addEventListener('change', loadPreset);
    if (elements.saveParamsBtn) elements.saveParamsBtn.addEventListener('click', saveParameters);
    if (elements.loadParamsBtn) elements.loadParamsBtn.addEventListener('click', () => elements.loadParamsInput.click());
    if (elements.loadParamsInput) elements.loadParamsInput.addEventListener('change', handleLoadParameters);

    // Zoom controls
    if (elements.zoomInBtn) elements.zoomInBtn.addEventListener('click', zoomIn);
    if (elements.zoomOutBtn) elements.zoomOutBtn.addEventListener('click', zoomOut);
    if (elements.zoomResetBtn) elements.zoomResetBtn.addEventListener('click', zoomReset);

    // View tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Toolbar buttons
    const controlsPanel = document.getElementById('controls-panel');
    const mainContainer = document.querySelector('.main-container');

    const toolbarLoad = document.getElementById('toolbar-load');
    if (toolbarLoad) toolbarLoad.addEventListener('click', showLoadProfileModal);

    const toolbarSave = document.getElementById('toolbar-save');
    if (toolbarSave) toolbarSave.addEventListener('click', handleCloudSave);

    const toolbarImport = document.getElementById('toolbar-import');
    if (toolbarImport) toolbarImport.addEventListener('click', () => elements.loadParamsInput.click());

    const toolbarExport = document.getElementById('toolbar-export');
    if (toolbarExport) toolbarExport.addEventListener('click', saveParameters);

    if (elements.dlSvg) elements.dlSvg.addEventListener('click', downloadSVG);
    if (elements.dlPdf) elements.dlPdf.addEventListener('click', () => downloadPDF(collectParameters, sanitizeFilename));

    const toolbarShare = document.getElementById('toolbar-share');
    if (toolbarShare) toolbarShare.addEventListener('click', handleShare);

    const toolbarMenuBtn = document.getElementById('toolbar-menu');
    if (toolbarMenuBtn) toolbarMenuBtn.addEventListener('click', openMenu);

    const toolbarAuth = document.getElementById('toolbar-auth');
    if (toolbarAuth) toolbarAuth.addEventListener('click', () => {
        if (isAuthenticated()) {
            signOut().catch(e => showErrorModal('Sign Out Failed', e.message));
        } else {
            showLoginModal();
        }
    });

    // Theme toggle
    function toggleTheme() {
        const html = document.documentElement;
        const isDark = html.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        try { localStorage.setItem('overstand-theme', newTheme); } catch(e) {}

        const icon = isDark ? '🌙' : '☀️';
        const toolbarThemeIcon = document.querySelector('#toolbar-theme .icon');
        if (toolbarThemeIcon) toolbarThemeIcon.textContent = icon;
        const mmThemeIcon = document.querySelector('#mm-theme .icon');
        if (mmThemeIcon) mmThemeIcon.textContent = icon;
    }

    const toolbarTheme = document.getElementById('toolbar-theme');
    if (toolbarTheme) toolbarTheme.addEventListener('click', toggleTheme);

    // Params collapse/expand (desktop)
    const paramsCollapseBtn = document.getElementById('params-collapse-btn');
    const expandParamsBtn = document.getElementById('expand-params-btn');

    function collapseParams() {
        if (mainContainer) mainContainer.classList.add('params-collapsed');
        if (paramsCollapseBtn) paramsCollapseBtn.textContent = '▶';
    }

    function expandParams() {
        if (mainContainer) mainContainer.classList.remove('params-collapsed');
        if (paramsCollapseBtn) paramsCollapseBtn.textContent = '◀';
    }

    if (paramsCollapseBtn) {
        paramsCollapseBtn.addEventListener('click', () => {
            if (mainContainer && mainContainer.classList.contains('params-collapsed')) {
                expandParams();
            } else {
                collapseParams();
            }
        });
    }

    if (expandParamsBtn) {
        expandParamsBtn.addEventListener('click', expandParams);
    }

    // Mobile params drawer
    const paramsDrawerOverlay = document.getElementById('params-drawer-overlay');

    function openMobileParams() {
        if (controlsPanel) controlsPanel.classList.add('mobile-open');
        if (paramsDrawerOverlay) paramsDrawerOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileParams() {
        if (controlsPanel) controlsPanel.classList.remove('mobile-open');
        if (paramsDrawerOverlay) paramsDrawerOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (paramsDrawerOverlay) {
        paramsDrawerOverlay.addEventListener('click', closeMobileParams);
    }

    // Hamburger + menu overlay
    const toolbarHamburger = document.getElementById('toolbar-hamburger');
    const appMenuOverlay = document.getElementById('app-menu-overlay');

    if (toolbarHamburger) toolbarHamburger.addEventListener('click', openMenu);

    if (appMenuOverlay) {
        appMenuOverlay.addEventListener('click', (e) => {
            if (e.target === appMenuOverlay) closeMenu();
        });
    }

    // Menu item handlers
    const mmLoad = document.getElementById('mm-load');
    const mmSave = document.getElementById('mm-save');
    const mmImport = document.getElementById('mm-import');
    const mmExport = document.getElementById('mm-export');
    const mmDlSvg = document.getElementById('mm-dl-svg');
    const mmDlPdf = document.getElementById('mm-dl-pdf');
    const mmShare = document.getElementById('mm-share');
    const mmParams = document.getElementById('mm-params');
    const mmTheme = document.getElementById('mm-theme');
    const mmShortcuts = document.getElementById('mm-shortcuts');
    const mmAbout = document.getElementById('mm-about');
    const mmAuth = document.getElementById('mm-auth');

    if (mmLoad) mmLoad.addEventListener('click', () => { closeMenu(); showLoadProfileModal(); });
    if (mmSave) mmSave.addEventListener('click', () => { closeMenu(); handleCloudSave(); });
    if (mmImport) mmImport.addEventListener('click', () => { closeMenu(); elements.loadParamsInput.click(); });
    if (mmExport) mmExport.addEventListener('click', () => { closeMenu(); saveParameters(); });
    if (mmDlSvg) mmDlSvg.addEventListener('click', () => { closeMenu(); downloadSVG(); });
    if (mmDlPdf) mmDlPdf.addEventListener('click', () => { closeMenu(); downloadPDF(collectParameters, sanitizeFilename); });
    if (mmShare) mmShare.addEventListener('click', () => { closeMenu(); handleShare(); });
    if (mmParams) mmParams.addEventListener('click', () => { closeMenu(); openMobileParams(); });
    if (mmTheme) mmTheme.addEventListener('click', () => { closeMenu(); toggleTheme(); });
    if (mmShortcuts) mmShortcuts.addEventListener('click', () => { closeMenu(); showKeyboardShortcuts(); });
    if (mmAbout) mmAbout.addEventListener('click', () => { closeMenu(); showAbout(); });
    if (mmAuth) mmAuth.addEventListener('click', () => {
        closeMenu();
        if (isAuthenticated()) {
            signOut().catch(e => showErrorModal('Sign Out Failed', e.message));
        } else {
            showLoginModal();
        }
    });

    // Zoom keyboard shortcuts (+, -, 0)
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                zoomReset();
            }
        }
    });

    // Share banner
    const shareDismissBtn = document.getElementById('share-dismiss-btn');
    const shareSaveBtn = document.getElementById('share-save-btn');

    if (shareDismissBtn) shareDismissBtn.addEventListener('click', () => {
        const banner = document.getElementById('share-banner');
        if (banner) banner.style.display = 'none';
        state.sharedPreset = null;
    });
    if (shareSaveBtn) shareSaveBtn.addEventListener('click', handleShareSave);

    // Load Profile modal events
    const loadProfileCloseBtn = document.getElementById('load-profile-close-btn');
    const loadProfileCloseFooter = document.getElementById('load-profile-close-footer');
    const loadProfileOverlay = document.getElementById('load-profile-overlay');

    if (loadProfileCloseBtn) loadProfileCloseBtn.addEventListener('click', closeLoadProfileModal);
    if (loadProfileCloseFooter) loadProfileCloseFooter.addEventListener('click', closeLoadProfileModal);
    if (loadProfileOverlay) loadProfileOverlay.addEventListener('click', (e) => {
        if (e.target === loadProfileOverlay) closeLoadProfileModal();
    });

    // Profile tab switching
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', () => switchProfileTab(tab.dataset.tab));
    });

    // Share modal events
    const shareProfileCloseBtn = document.getElementById('share-profile-close-btn');
    const shareProfileCloseFooter = document.getElementById('share-profile-close-footer');
    const shareProfileOverlay = document.getElementById('share-profile-overlay');
    const shareCopyBtn = document.getElementById('share-copy-btn');
    const shareViaEmailBtn = document.getElementById('share-via-email');
    const shareViaWhatsAppBtn = document.getElementById('share-via-whatsapp');
    const shareViaFacebookBtn = document.getElementById('share-via-facebook');

    if (shareProfileCloseBtn) shareProfileCloseBtn.addEventListener('click', closeShareModal);
    if (shareProfileCloseFooter) shareProfileCloseFooter.addEventListener('click', closeShareModal);
    if (shareProfileOverlay) shareProfileOverlay.addEventListener('click', (e) => {
        if (e.target === shareProfileOverlay) closeShareModal();
    });
    if (shareCopyBtn) shareCopyBtn.addEventListener('click', handleShareCopy);
    if (shareViaEmailBtn) shareViaEmailBtn.addEventListener('click', shareViaEmail);
    if (shareViaWhatsAppBtn) shareViaWhatsAppBtn.addEventListener('click', shareViaWhatsApp);
    if (shareViaFacebookBtn) shareViaFacebookBtn.addEventListener('click', shareViaFacebook);

    // Auth
    onAuthStateChange(updateAuthUI);
    initAuth();

    // Modal close
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Description changes mark parameters modified
    const profileDescription = document.getElementById('profile-description');
    if (profileDescription) profileDescription.addEventListener('input', markParametersModified);

    // Keyboard shortcuts
    setKeyboardActions({
        generateNeck,
        handleCloudSave,
        saveParameters,
        showLoadProfileModal,
        closeShareModal,
        closeLoadProfileModal,
        closeMenu
    });
    initKeyboardShortcuts();

    registerServiceWorker();
    initInstallPrompt();
    loadVersionInfo();
    initializePython();
});
