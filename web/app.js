import { state, elements, initElements } from './state.js';
import * as ui from './ui.js';
import { downloadPDF } from './pdf_export.js';
import { registerServiceWorker, initInstallPrompt } from './pwa_manager.js';
import { showModal, closeModal, showErrorModal } from './modal.js';
import { DEBOUNCE_GENERATE, ZOOM_CONFIG } from './constants.js';
import { markdownToHtml } from './markdown-parser.js';
import * as analytics from './analytics.js';
import { initAuth, signInWithProvider, signOut, isAuthenticated, getCurrentUser, onAuthStateChange } from './auth.js';
import { saveToCloud, loadUserPresets, deleteCloudPreset, createShareLink, loadSharedPreset, copyToClipboard, cloudPresetExists } from './cloud_presets.js';

// Helper: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced generation
const debouncedGenerate = debounce(() => {
    generateNeck();
}, DEBOUNCE_GENERATE);

function markParametersModified() {
    state.parametersModified = true;
}

// Handle parameter changes - update derived values immediately, debounce generation
function handleParameterChange() {
    markParametersModified();
    updateDerivedValues();
    debouncedGenerate();
}

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

        // Load UI metadata bundle (sections, presets, parameters, derived values)
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

        // Check for ?share= URL parameter (shared preset link)
        const loadedShared = await handleShareURL();

        // Load the first preset's parameters (unless a shared preset was loaded)
        if (loadedShared) {
            // Shared preset already applied parameters
        } else if (elements.presetSelect && elements.presetSelect.value) {
            await loadPreset();
        } else {
            // No presets available, just use defaults
            updateDerivedValues();
            generateNeck();
        }

        // Initialize previousValue for preset selector
        if (elements.presetSelect && elements.presetSelect.value) {
            elements.presetSelect.dataset.previousValue = elements.presetSelect.value;
        }

        // Parameters start unmodified (we just loaded a preset)
        state.parametersModified = false;

        elements.genBtn.disabled = false;
    } catch (error) {
        ui.setStatus('error', '❌ Initialization failed');
        ui.showErrors([`Failed to initialize: ${error.message}`], 'critical');
        console.error('Initialization error:', error);
    }
}

async function loadPreset() {
    const presetId = elements.presetSelect.value;
    if (!presetId) return;

    // Warn user if they have unsaved changes
    if (state.parametersModified) {
        const presetName = state.uiMetadata?.presets?.[presetId]?.display_name || presetId;
        const message = `You have unsaved changes. Loading "${presetName}" will overwrite your current parameter values.\n\nDo you want to continue?`;

        if (!confirm(message)) {
            // User cancelled - revert the dropdown selection
            // Find the current instrument_family to restore dropdown
            const currentFamily = document.getElementById('instrument_family')?.value;
            if (currentFamily && elements.presetSelect) {
                // Don't trigger another change event
                const previousValue = elements.presetSelect.dataset.previousValue || '';
                elements.presetSelect.value = previousValue;
            }
            return;
        }
    }

    let parameters = null;

    // Try to load from JSON file in presets/ directory
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

    // Fallback to legacy file-based presets if JSON not found
    if (!parameters && state.presets && state.presets[presetId]) {
        parameters = state.presets[presetId].parameters;
    }

    // Fallback to ui_metadata basic_params (for backward compatibility)
    if (!parameters && state.uiMetadata && state.uiMetadata.presets && state.uiMetadata.presets[presetId]) {
        parameters = state.uiMetadata.presets[presetId].basic_params;
    }

    if (!parameters) {
        console.error(`Could not load preset: ${presetId}`);
        return;
    }

    // Apply preset parameters
    for (const [name, value] of Object.entries(parameters)) {
        const element = document.getElementById(name);
        if (element) {
            if (element.type === 'checkbox') element.checked = value;
            else element.value = value;
        }
    }

    // Reset modified flag - we just loaded a preset
    state.parametersModified = false;

    // Store current preset selection for cancellation
    if (elements.presetSelect) {
        elements.presetSelect.dataset.previousValue = presetId;
    }

    ui.hideErrors();
    ui.updateParameterVisibility(collectParameters());
    updateDerivedValues();
    debouncedGenerate();

    // Track preset selection
    analytics.trackPresetSelected(presetId, parameters.instrument_family || 'unknown');
}

function collectParameters() {
    const params = {};
    if (!state.parameterDefinitions) return params;
    for (const [name, param] of Object.entries(state.parameterDefinitions.parameters)) {
        const element = document.getElementById(name);
        if (!element) continue;
        if (param.type === 'number') {
            const val = parseFloat(element.value);
            params[name] = !isNaN(val) ? val : param.default;
        } else if (param.type === 'boolean') params[name] = element.checked;
        else params[name] = element.value;
    }
    return params;
}

function classifyErrors(errors) {
    if (!errors || errors.length === 0) return 'transient';

    const errorText = errors.join(' ').toLowerCase();

    // Validation errors are transient
    if (errorText.includes('validation') ||
        errorText.includes('must be') ||
        errorText.includes('invalid value')) {
        return 'transient';
    }

    // Geometry/calculation failures are persistent
    if (errorText.includes('geometry') ||
        errorText.includes('calculation') ||
        errorText.includes('failed')) {
        return 'persistent';
    }

    return 'transient';
}

async function generateNeck() {
    if (state.isGenerating) return;
    ui.hideErrors();
    state.isGenerating = true;
    elements.genBtn.disabled = true;
    ui.setStatus('generating', '⚙️ Updating preview...');

    // Mobile panel auto-close removed - panel now only closes when user taps edit icon
    // This allows users to batch-edit multiple parameters without the panel closing after each change

    try {
        const params = collectParameters();
        params._generator_url = window.location.href;
        const paramsJson = JSON.stringify(params);

        const resultJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import generate_violin_neck
            generate_violin_neck('${paramsJson.replace(/'/g, "\\'")}')
        `);
        const result = JSON.parse(resultJson);

        if (result.success) {
            state.views = result.views;
            state.fretPositions = result.fret_positions || null;
            state.derivedValues = result.derived_values || {};
            state.derivedFormatted = result.derived_formatted || {};
            state.derivedMetadata = result.derived_metadata || state.derivedMetadata;

            state.views.dimensions = ui.generateDimensionsTableHTML(params, state.derivedValues, state.derivedFormatted);
            state.views.fret_positions = state.fretPositions;
            ui.displayCurrentView();
            ui.updateTabStates(params);
            elements.preview.classList.add('has-content');
            ui.setStatus('ready', '✅ Preview updated');

            // Track successful generation
            analytics.trackTemplateGenerated(params.instrument_family || 'unknown');
        } else {
            const errorType = classifyErrors(result.errors);
            ui.showErrors(result.errors, errorType);
            ui.setStatus('error', '❌ Generation failed - see errors below');
            analytics.trackError('generation', result.errors?.[0] || 'Unknown error');
        }
    } catch (error) {
        console.error('[Generate] Exception:', error);
        console.error('[Generate] Error stack:', error.stack);
        ui.showErrors([`Unexpected error: ${error.message}`], 'persistent');
        ui.setStatus('error', '❌ Generation failed');
        analytics.trackError('generation_exception', error.message);
    } finally {
        state.isGenerating = false;
        elements.genBtn.disabled = false;
    }
}

async function updateDerivedValues() {
    if (!state.pyodide || state.isGenerating) return;
    try {
        const params = collectParameters();
        const paramsJson = JSON.stringify(params);
        const currentMode = params.instrument_family || 'VIOLIN';

        const resultJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import get_derived_values
            get_derived_values('${paramsJson.replace(/'/g, "\\'")}')
        `);
        const result = JSON.parse(resultJson);
        const container = elements.calculatedFields;

        if (result.success && Object.keys(result.values).length > 0) {
            // Update core metrics panel (always visible, prominent display)
            updateCoreMetricsPanel(result.values, result.metadata, params);

            // Update output sections if using component-based UI
            if (state.uiSections && state.uiSections.output) {
                for (const section of state.uiSections.output) {
                    section.updateValues(result.values);
                }
                container.style.display = 'none'; // Hide old metrics display
            } else {
                // Legacy output display
                container.style.display = 'grid';
                container.innerHTML = '';

                for (const [name, param] of Object.entries(state.parameterDefinitions.parameters)) {
                    if (ui.isParameterOutput(param, currentMode)) {
                        const input = document.getElementById(name);
                        // Use 'name' (snake_case key) instead of param.label (display name)
                        if (input && result.values[name] != null) {
                            input.value = !isNaN(result.values[name]) ? result.values[name] : '';
                        }
                    }
                }

                for (const [label, value] of Object.entries(result.values)) {
                    // Note: All keys now use snake_case from parameter registry
                    // Visibility is controlled by metadata.visible flag, not key format
                    const meta = (result.metadata || {})[label];
                    if (!meta || !meta.visible) continue;

                    const div = document.createElement('div');
                    div.className = 'metric-card';
                    let formattedValue = (value == null || isNaN(value)) ? '—' : (result.formatted && result.formatted[label]) || (meta ? `${value.toFixed(meta.decimals)} ${meta.unit}`.trim() : value);

                    div.innerHTML = `<span class="metric-label" title="${meta ? meta.description : ''}">${meta ? meta.display_name : label}</span><span class="metric-value">${formattedValue}</span>`;
                    container.appendChild(div);
                }
            }
        } else container.style.display = 'none';
    } catch (e) { console.error("Failed to update derived values:", e); }
}

function updateCoreMetricsPanel(values, metadata, params) {
    const panel = document.getElementById('core-metrics-grid');
    if (!panel) return;

    // Get key measurements config from metadata, or use fallback
    const keyMeasurementsConfig = state.uiMetadata?.key_measurements || [
        { key: 'neck_angle', primary: true },
        { key: 'neck_stop', key_conditional: { 'GUITAR_MANDOLIN': 'body_stop' } },
        { key: 'nut_relative_to_ribs' },
        { key: 'string_break_angle' }
    ];

    // Build metrics list, resolving conditional keys based on instrument family
    const instrumentFamily = params?.instrument_family || 'VIOLIN';
    const coreMetrics = keyMeasurementsConfig.map(metric => {
        let key = metric.key;
        // Check if there's a conditional override for this instrument family
        if (metric.key_conditional && metric.key_conditional[instrumentFamily]) {
            key = metric.key_conditional[instrumentFamily];
        }
        return { key, primary: metric.primary || false };
    });

    panel.innerHTML = '';

    for (const metric of coreMetrics) {
        const value = values[metric.key];
        const meta = metadata ? metadata[metric.key] : null;

        if (value === undefined || value === null) continue;

        const item = document.createElement('div');
        item.className = metric.primary ? 'core-metric-item primary' : 'core-metric-item';

        const label = document.createElement('span');
        label.className = 'core-metric-label';
        label.textContent = meta ? meta.display_name : metric.key;
        if (meta && meta.description) {
            item.title = meta.description;
        }

        const valueSpan = document.createElement('span');
        valueSpan.className = 'core-metric-value';

        const formattedValue = meta ? value.toFixed(meta.decimals) : value.toFixed(1);
        valueSpan.textContent = formattedValue;

        if (meta && meta.unit) {
            const unit = document.createElement('span');
            unit.className = 'core-metric-unit';
            unit.textContent = meta.unit;
            valueSpan.appendChild(unit);
        }

        item.appendChild(label);
        item.appendChild(valueSpan);
        panel.appendChild(item);
    }
}

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

function sanitizeFilename(name) { return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_'); }
function getInstrumentFilename() { return sanitizeFilename(collectParameters().instrument_name || 'instrument'); }

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadSVG() {
    if (!state.views || !state.views[state.currentView]) return;
    const viewNames = { 'side': 'side-view', 'top': 'top-view', 'cross_section': 'cross-section', 'radius_template': 'radius-template' };
    const filename = `${getInstrumentFilename()}_${viewNames[state.currentView]}.svg`;
    downloadFile(state.views[state.currentView], filename, 'image/svg+xml');
    analytics.trackSVGDownloaded(state.currentView);
}

function saveParameters() {
    const saveData = {
        metadata: { version: '1.0', timestamp: new Date().toISOString(), description: 'Overstand Parameters' },
        parameters: collectParameters()
    };
    const filename = `${getInstrumentFilename()}_params_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
    downloadFile(JSON.stringify(saveData, null, 2), filename, 'application/json');

    // Reset modified flag - we just saved
    state.parametersModified = false;

    analytics.trackParametersSaved();
}

function handleLoadParameters(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const saveData = JSON.parse(e.target.result);
            if (!saveData.parameters) return;
            for (const [name, value] of Object.entries(saveData.parameters)) {
                const el = document.getElementById(name);
                if (el) {
                    if (el.type === 'checkbox') el.checked = value;
                    else el.value = value;
                }
            }
            elements.presetSelect.value = '';

            // Reset modified flag - we just loaded a file
            state.parametersModified = false;

            ui.hideErrors();
            ui.updateParameterVisibility(collectParameters());
            updateDerivedValues();
            debouncedGenerate();
            ui.setStatus('ready', '✅ Parameters loaded');

            analytics.trackParametersLoaded();
        } catch (err) {
            showErrorModal('Load Failed', err.message);
            analytics.trackError('load_parameters', err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Menu system functions
function openMenu() {
    const menuPanel = document.getElementById('menu-panel');
    const menuOverlay = document.getElementById('menu-overlay');
    menuPanel.classList.add('open');
    menuOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMenu() {
    const menuPanel = document.getElementById('menu-panel');
    const menuOverlay = document.getElementById('menu-overlay');
    menuPanel.classList.remove('open');
    menuOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Modal Dialog Functions - imported from modal.js

function showKeyboardShortcuts() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? '⌘' : 'Ctrl';

    const content = `
        <div class="shortcuts-section">
            <h3>File Operations</h3>
            <ul class="shortcut-list">
                <li class="shortcut-item">
                    <span class="shortcut-description">Generate Template</span>
                    <div class="shortcut-keys">
                        <span class="key">${mod}</span>
                        <span class="key-separator">+</span>
                        <span class="key">Enter</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Save Profile / Export JSON</span>
                    <div class="shortcut-keys">
                        <span class="key">${mod}</span>
                        <span class="key-separator">+</span>
                        <span class="key">S</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Load Profile / Import JSON</span>
                    <div class="shortcut-keys">
                        <span class="key">${mod}</span>
                        <span class="key-separator">+</span>
                        <span class="key">O</span>
                    </div>
                </li>
            </ul>
        </div>

        <div class="shortcuts-section">
            <h3>Zoom Controls</h3>
            <ul class="shortcut-list">
                <li class="shortcut-item">
                    <span class="shortcut-description">Zoom In</span>
                    <div class="shortcut-keys">
                        <span class="key">+</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Zoom Out</span>
                    <div class="shortcut-keys">
                        <span class="key">-</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Reset Zoom</span>
                    <div class="shortcut-keys">
                        <span class="key">0</span>
                    </div>
                </li>
            </ul>
        </div>

        <div class="shortcuts-section">
            <h3>Navigation</h3>
            <ul class="shortcut-list">
                <li class="shortcut-item">
                    <span class="shortcut-description">Close Menu/Dialogs</span>
                    <div class="shortcut-keys">
                        <span class="key">Esc</span>
                    </div>
                </li>
            </ul>
        </div>
    `;

    showModal('Keyboard Shortcuts', content);
    closeMenu();
}

async function showAbout() {
    analytics.trackAboutViewed();
    try {
        // Fetch about.md
        const response = await fetch('about.md');
        if (!response.ok) {
            throw new Error('Failed to load about.md');
        }
        const markdown = await response.text();

        // Convert markdown to HTML
        const content = markdownToHtml(markdown);

        // Extract title from first h1 (if exists)
        const titleMatch = content.match(/<h1 class="about-title">(.*?)<\/h1>/);
        const title = titleMatch ? titleMatch[1] : 'About';

        showModal(title, content);
        closeMenu();
    } catch (error) {
        console.error('Error loading about:', error);
        // Fallback content
        showModal('About', '<p class="about-text">Unable to load about information.</p>');
        closeMenu();
    }
}

async function clearCacheAndReload() {
    closeMenu();

    const confirmed = confirm(
        'This will clear all cached data and reload the app.\n\n' +
        'Use this if you\'re experiencing issues with outdated code or data.\n\n' +
        'Continue?'
    );

    if (!confirmed) return;

    try {
        // Show status
        ui.setStatus('loading', 'Clearing cache...');

        // 1. Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('[ClearCache] Deleted caches:', cacheNames);
        }

        // 2. Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('[ClearCache] Unregistered service workers:', registrations.length);
        }

        // 3. Clear localStorage (optional - preserves user preferences)
        // localStorage.clear();

        // 4. Force hard reload with cache-busting query param
        // This works better than reload(true) which is deprecated
        ui.setStatus('loading', 'Reloading...');
        const baseUrl = window.location.href.split('?')[0].split('#')[0];
        window.location.href = baseUrl + '?cache_bust=' + Date.now();

    } catch (error) {
        console.error('[ClearCache] Error:', error);
        alert('Failed to clear cache: ' + error.message + '\n\nTry manually clearing your browser cache.');
    }
}

// ============================================================================
// Auth & Cloud Presets
// ============================================================================

function updateAuthUI(user) {
    state.authUser = user;
    const signedOut = document.getElementById('menu-signed-out');
    const signedIn = document.getElementById('menu-signed-in');
    const shareSaveBtn = document.getElementById('share-save-btn');
    const menuSaveCloud = document.getElementById('menu-save-cloud');
    const menuLoadProfile = document.getElementById('menu-load-profile');
    const menuShare = document.getElementById('menu-share');

    if (user) {
        // Logged in
        if (signedOut) signedOut.style.display = 'none';
        if (signedIn) signedIn.style.display = 'block';
        if (shareSaveBtn) shareSaveBtn.style.display = 'inline-block';

        // Enable cloud menu items
        for (const el of [menuSaveCloud, menuLoadProfile, menuShare]) {
            if (el) {
                el.classList.remove('menu-item-disabled');
                el.title = '';
            }
        }

        // Update user info
        const avatar = document.getElementById('menu-user-avatar');
        const email = document.getElementById('menu-user-email');
        if (avatar) {
            avatar.src = user.user_metadata?.avatar_url || '';
            avatar.style.display = user.user_metadata?.avatar_url ? 'block' : 'none';
        }
        if (email) email.textContent = user.email || 'Signed in';

        // Show signed-in email in status bar
        const authStatus = document.getElementById('auth-status');
        if (authStatus) authStatus.textContent = user.email;

        // Load cloud presets
        refreshCloudPresets();
    } else {
        // Logged out
        if (signedOut) signedOut.style.display = 'block';
        if (signedIn) signedIn.style.display = 'none';
        if (shareSaveBtn) shareSaveBtn.style.display = 'none';

        // Grey out cloud menu items
        for (const el of [menuSaveCloud, menuLoadProfile, menuShare]) {
            if (el) {
                el.classList.add('menu-item-disabled');
                el.title = 'Sign in to use cloud profiles';
            }
        }

        // Show sign-in link in status bar (click handled by delegation on #auth-status)
        const authStatus = document.getElementById('auth-status');
        if (authStatus) {
            authStatus.innerHTML = '<a href="#" class="auth-login-link">Sign in</a>';
        }

        state.cloudPresets = [];
    }
}

function showLoginModal() {
    const content = `
        <div class="login-modal-content">
            <p>Sign in to save instrument profiles to the cloud and share your designs.</p>
            <button class="login-btn" id="login-google">
                <span class="login-btn-icon">G</span>
                Sign in with Google
            </button>
        </div>
    `;
    showModal('Sign In', content);

    document.getElementById('login-google')?.addEventListener('click', async () => {
        closeModal();
        try { await signInWithProvider('google'); } catch (e) { showErrorModal('Sign In Failed', e.message); }
    });
}

async function refreshCloudPresets() {
    try {
        state.cloudPresets = await loadUserPresets();
    } catch (e) {
        console.error('[Cloud] Failed to load presets:', e);
        state.cloudPresets = [];
    }
}

// ============================================================================
// Load Profile Modal
// ============================================================================

function showLoadProfileModal() {
    const overlay = document.getElementById('load-profile-overlay');
    if (!overlay) return;

    // Populate standard presets tab
    populateStandardProfilesTab();
    // Populate my profiles tab
    populateMyProfilesTab();

    // Reset to standard tab
    switchProfileTab('standard');

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLoadProfileModal() {
    const overlay = document.getElementById('load-profile-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function switchProfileTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Show/hide tab content
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
        row.innerHTML = `
            <span class="profile-row-name">${escapeHtml(preset.preset_name)}</span>
            <div class="profile-row-actions">
                <button class="profile-action-btn load-btn">Load</button>
                <button class="profile-action-btn share-btn">Share</button>
                <button class="profile-action-btn delete-btn">Del</button>
            </div>
        `;
        row.querySelector('.load-btn').addEventListener('click', () => {
            loadCloudPreset(preset);
        });
        row.querySelector('.share-btn').addEventListener('click', () => {
            handleShareFromProfile(preset);
        });
        row.querySelector('.delete-btn').addEventListener('click', async () => {
            if (!confirm(`Delete profile "${preset.preset_name}"?`)) return;
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
    // Set the hidden select and use existing loadPreset logic
    if (elements.presetSelect) elements.presetSelect.value = presetId;
    closeLoadProfileModal();
    await loadPreset();
}

function loadCloudPreset(preset) {
    if (!preset || !preset.parameters) return;

    // Apply parameters
    for (const [name, value] of Object.entries(preset.parameters)) {
        const el = document.getElementById(name);
        if (el) {
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        }
    }

    // Clear the standard preset selector
    if (elements.presetSelect) elements.presetSelect.value = '';
    state.parametersModified = false;

    ui.hideErrors();
    ui.updateParameterVisibility(collectParameters());
    updateDerivedValues();
    debouncedGenerate();
    ui.setStatus('ready', `☁️ Loaded "${preset.preset_name}"`);

    closeLoadProfileModal();
}

// ============================================================================
// Share Profile Modal
// ============================================================================

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
        window.matchMedia('(pointer: coarse)').matches;
}

async function handleShareFromProfile(preset) {
    if (!preset || !preset.parameters) return;

    try {
        ui.setStatus('loading', 'Creating share link...');
        const url = await createShareLink(preset.preset_name, preset.parameters);

        // Use Web Share API only on actual mobile devices (not Mac desktop)
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

        // Desktop or fallback: show share modal
        showShareModal(preset.preset_name, url);
        ui.setStatus('ready', 'Share link created');
    } catch (e) {
        console.error('[Share] Failed:', e);
        showErrorModal('Share Failed', e.message);
        ui.setStatus('error', 'Share link creation failed');
    }
}

function showShareModal(profileName, shareUrl) {
    const overlay = document.getElementById('share-profile-overlay');
    if (!overlay) return;

    document.getElementById('share-profile-name').textContent = `"${profileName}"`;
    document.getElementById('share-url-input').value = shareUrl;

    // Reset copy button
    const copyBtn = document.getElementById('share-copy-btn');
    copyBtn.textContent = '📋';
    copyBtn.classList.remove('copied');

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeShareModal() {
    const overlay = document.getElementById('share-profile-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

async function handleShareCopy() {
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

function shareViaEmail() {
    const url = document.getElementById('share-url-input')?.value;
    if (!url) return;
    const name = document.getElementById('share-profile-name')?.textContent || 'an instrument profile';
    const subject = encodeURIComponent(`Check out my Overstand instrument profile`);
    const body = encodeURIComponent(`I created ${name} on Overstand. Take a look:\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
}

function shareViaWhatsApp() {
    const url = document.getElementById('share-url-input')?.value;
    if (!url) return;
    const name = document.getElementById('share-profile-name')?.textContent || 'an instrument profile';
    const text = encodeURIComponent(`Check out my Overstand instrument profile ${name}: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

function shareViaFacebook() {
    const url = document.getElementById('share-url-input')?.value;
    if (!url) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleCloudSave() {
    if (!isAuthenticated()) { showLoginModal(); return; }

    const params = collectParameters();
    const defaultName = params.instrument_name || 'My Preset';

    const presetName = prompt('Profile name:', defaultName);
    if (!presetName) return;

    try {
        // Check if name exists and confirm overwrite
        const exists = await cloudPresetExists(presetName);
        if (exists) {
            if (!confirm(`A profile named "${presetName}" already exists. Overwrite it?`)) return;
        }

        await saveToCloud(presetName, '', params);
        await refreshCloudPresets();
        ui.setStatus('ready', `☁️ Saved "${presetName}" to cloud`);
        state.parametersModified = false;
    } catch (e) {
        console.error('[Cloud] Save failed:', e);
        showErrorModal('Save Failed', e.message);
    }
}

async function handleShare() {
    if (!isAuthenticated()) { showLoginModal(); return; }

    const params = collectParameters();
    const presetName = params.instrument_name || 'Shared Preset';

    try {
        ui.setStatus('loading', 'Creating share link...');
        const url = await createShareLink(presetName, params);

        // Use Web Share API only on actual mobile devices
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

        // Desktop or fallback: show share modal
        showShareModal(presetName, url);
        ui.setStatus('ready', 'Share link created');
    } catch (e) {
        console.error('[Share] Failed:', e);
        showErrorModal('Share Failed', e.message);
        ui.setStatus('error', 'Share link creation failed');
    }
}

async function handleShareURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('share');
    if (!shareToken) return false;

    try {
        const shared = await loadSharedPreset(shareToken);
        if (!shared || !shared.parameters) {
            console.warn('[Share] Shared preset not found:', shareToken);
            // Clean up URL
            window.history.replaceState({}, document.title,
                window.location.origin + window.location.pathname);
            return false;
        }

        state.sharedPreset = shared;

        // Apply parameters
        for (const [name, value] of Object.entries(shared.parameters)) {
            const el = document.getElementById(name);
            if (el) {
                if (el.type === 'checkbox') el.checked = value;
                else el.value = value;
            }
        }

        // Show share banner
        const banner = document.getElementById('share-banner');
        const bannerText = document.getElementById('share-banner-text');
        if (banner && bannerText) {
            bannerText.textContent = `Viewing shared preset: "${shared.preset_name}"`;
            banner.style.display = 'flex';
        }

        // Clear standard preset selector
        if (elements.presetSelect) elements.presetSelect.value = '';
        state.parametersModified = false;

        // Clean up URL
        window.history.replaceState({}, document.title,
            window.location.origin + window.location.pathname);

        ui.hideErrors();
        ui.updateParameterVisibility(collectParameters());
        updateDerivedValues();
        debouncedGenerate();

        return true;
    } catch (e) {
        console.error('[Share] Failed to load shared preset:', e);
        return false;
    }
}

async function handleShareSave() {
    if (!isAuthenticated() || !state.sharedPreset) return;

    const presetName = prompt('Save profile as:', state.sharedPreset.preset_name);
    if (!presetName) return;

    try {
        await saveToCloud(presetName, '', state.sharedPreset.parameters);
        await refreshCloudPresets();
        ui.setStatus('ready', `☁️ Saved "${presetName}" to cloud`);

        // Dismiss banner
        const banner = document.getElementById('share-banner');
        if (banner) banner.style.display = 'none';
        state.sharedPreset = null;
    } catch (e) {
        showErrorModal('Save Failed', e.message);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Start engagement time tracking
    analytics.startEngagementTracking();

    // CRITICAL: Set up Clear Cache FIRST so it always works, even if everything else fails
    try {
        const menuBtn = document.getElementById('menu-btn');
        const menuCloseBtn = document.getElementById('menu-close-btn');
        const menuOverlay = document.getElementById('menu-overlay');
        const menuClearCache = document.getElementById('menu-clear-cache');

        // Basic menu open/close (mobile menu toggle handled later with full logic)
        if (menuBtn) menuBtn.addEventListener('click', openMenu);
        if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
        if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

        // Clear cache - MUST work even if app is broken
        if (menuClearCache) menuClearCache.addEventListener('click', clearCacheAndReload);

        console.log('[Init] Menu setup complete');
    } catch (e) {
        console.error('[Init] Menu setup failed:', e);
    }

    // Initialize DOM element references
    initElements();

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = document.getElementById('gen-btn-shortcut');
    if (shortcut) shortcut.textContent = isMac ? '⌘ + Enter' : 'Ctrl + Enter';

    // Hook up event listeners
    if (elements.genBtn) elements.genBtn.addEventListener('click', generateNeck);
    if (elements.presetSelect) elements.presetSelect.addEventListener('change', loadPreset);
    if (elements.saveParamsBtn) elements.saveParamsBtn.addEventListener('click', saveParameters);
    if (elements.loadParamsBtn) elements.loadParamsBtn.addEventListener('click', () => elements.loadParamsInput.click());
    if (elements.loadParamsInput) elements.loadParamsInput.addEventListener('change', handleLoadParameters);
    if (elements.dlSvg) elements.dlSvg.addEventListener('click', downloadSVG);
    if (elements.dlPdf) elements.dlPdf.addEventListener('click', () => downloadPDF(collectParameters, sanitizeFilename));

    // Zoom controls
    if (elements.zoomInBtn) elements.zoomInBtn.addEventListener('click', zoomIn);
    if (elements.zoomOutBtn) elements.zoomOutBtn.addEventListener('click', zoomOut);
    if (elements.zoomResetBtn) elements.zoomResetBtn.addEventListener('click', zoomReset);

    // View tabs
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Universal icon bar - works on desktop and mobile
    const mobileIconBar = document.getElementById('mobile-icon-bar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const mobileParamsToggle = document.getElementById('mobile-params-toggle');
    const menuPanel = document.getElementById('menu-panel');
    const controlsPanel = document.getElementById('controls-panel');
    const mainContainer = document.querySelector('.main-container');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileIconBar && mobileMenuToggle && mobileParamsToggle) {
        const isMobile = () => window.innerWidth <= 1024;

        // Toggle menu panel (same on desktop and mobile)
        mobileMenuToggle.addEventListener('click', () => {
            const isOpen = menuPanel.classList.contains('open');

            // Close parameters panel if open
            controlsPanel.classList.remove('mobile-open', 'collapsed');
            if (mainContainer) mainContainer.classList.remove('params-collapsed');
            mobileParamsToggle.classList.remove('active');

            if (!isOpen) {
                menuPanel.classList.add('open');
                sidebarOverlay.classList.add('active');
                mobileMenuToggle.classList.add('active');
                document.body.style.overflow = 'hidden';
            } else {
                menuPanel.classList.remove('open');
                sidebarOverlay.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
                document.body.style.overflow = '';
            }
        });

        // Toggle parameters panel (different behavior for desktop vs mobile)
        mobileParamsToggle.addEventListener('click', () => {
            // Close menu panel if open
            menuPanel.classList.remove('open');
            mobileMenuToggle.classList.remove('active');

            if (isMobile()) {
                // Mobile: slide-out panel
                const isOpen = controlsPanel.classList.contains('mobile-open');

                if (!isOpen) {
                    controlsPanel.classList.add('mobile-open');
                    sidebarOverlay.classList.add('active');
                    mobileParamsToggle.classList.add('active');
                    document.body.style.overflow = 'hidden';
                } else {
                    controlsPanel.classList.remove('mobile-open');
                    sidebarOverlay.classList.remove('active');
                    mobileParamsToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }
            } else {
                // Desktop: collapse/expand panel
                const isCollapsed = controlsPanel.classList.contains('collapsed');

                if (!isCollapsed) {
                    controlsPanel.classList.add('collapsed');
                    if (mainContainer) mainContainer.classList.add('params-collapsed');
                    mobileParamsToggle.classList.remove('active');
                } else {
                    controlsPanel.classList.remove('collapsed');
                    if (mainContainer) mainContainer.classList.remove('params-collapsed');
                    mobileParamsToggle.classList.add('active');
                }
            }
        });

        // Close panels on overlay click
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => {
                menuPanel.classList.remove('open');
                controlsPanel.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
                mobileParamsToggle.classList.remove('active');
                document.body.style.overflow = '';
            });
        }

        // Keyboard shortcuts for panel closing and zoom
        document.addEventListener('keydown', (e) => {
            // Escape key closes panels
            if (e.key === 'Escape') {
                if (menuPanel.classList.contains('open') || controlsPanel.classList.contains('mobile-open')) {
                    e.preventDefault();
                    menuPanel.classList.remove('open');
                    controlsPanel.classList.remove('mobile-open');
                    sidebarOverlay.classList.remove('active');
                    mobileMenuToggle.classList.remove('active');
                    mobileParamsToggle.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }

            // Zoom keyboard shortcuts (+, -, 0)
            // Don't trigger if user is typing in an input field
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

        // Set initial state on page load
        if (!isMobile()) {
            // Desktop: parameters panel visible by default
            mobileParamsToggle.classList.add('active');
        }
    }

    // Menu items (menu open/close and clear cache already set up above)
    const menuLoadProfile = document.getElementById('menu-load-profile');
    const menuSaveCloud = document.getElementById('menu-save-cloud');
    const menuExportParams = document.getElementById('menu-export-params');
    const menuImportParams = document.getElementById('menu-import-params');
    const menuKeyboardShortcuts = document.getElementById('menu-keyboard-shortcuts');
    const menuAbout = document.getElementById('menu-about');

    if (menuLoadProfile) menuLoadProfile.addEventListener('click', () => {
        if (menuLoadProfile.classList.contains('menu-item-disabled')) return;
        closeMenu();
        showLoadProfileModal();
    });
    if (menuSaveCloud) menuSaveCloud.addEventListener('click', () => {
        if (menuSaveCloud.classList.contains('menu-item-disabled')) return;
        closeMenu();
        handleCloudSave();
    });
    const menuShareBtn = document.getElementById('menu-share');
    if (menuShareBtn) menuShareBtn.addEventListener('click', () => {
        if (menuShareBtn.classList.contains('menu-item-disabled')) return;
        closeMenu();
        handleShare();
    });
    if (menuExportParams) menuExportParams.addEventListener('click', () => { closeMenu(); saveParameters(); });
    if (menuImportParams) menuImportParams.addEventListener('click', () => { closeMenu(); elements.loadParamsInput.click(); });
    if (menuKeyboardShortcuts) menuKeyboardShortcuts.addEventListener('click', showKeyboardShortcuts);
    if (menuAbout) menuAbout.addEventListener('click', showAbout);

    // Auth event listeners
    const menuSignIn = document.getElementById('menu-sign-in');
    const menuSignOut = document.getElementById('menu-sign-out');
    const shareDismissBtn = document.getElementById('share-dismiss-btn');
    const shareSaveBtn = document.getElementById('share-save-btn');

    if (menuSignIn) menuSignIn.addEventListener('click', () => { closeMenu(); showLoginModal(); });
    if (menuSignOut) menuSignOut.addEventListener('click', async () => {
        closeMenu();
        try { await signOut(); } catch (e) { showErrorModal('Sign Out Failed', e.message); }
    });
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

    // Initialize auth (non-blocking — cloud features activate when ready)
    // Use event delegation on parent — the link gets replaced by updateAuthUI
    document.getElementById('auth-status')?.addEventListener('click', (e) => {
        const link = e.target.closest('.auth-login-link');
        if (link) {
            e.preventDefault();
            showLoginModal();
        }
    });
    onAuthStateChange(updateAuthUI);
    initAuth();

    // Modal dialog
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        // Close modal when clicking the overlay background (not the dialog itself)
        if (e.target === modalOverlay) closeModal();
    });

    registerServiceWorker();
    initInstallPrompt();
    loadVersionInfo();
    initializePython();
});

document.addEventListener('keydown', (e) => {
    // Generate template: ⌘/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!elements.genBtn.disabled && !state.isGenerating) generateNeck();
    }

    // Save: ⌘/Ctrl + S — cloud save if logged in, JSON export if not
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isAuthenticated()) {
            handleCloudSave();
        } else {
            saveParameters();
        }
    }

    // Load Profile: ⌘/Ctrl + O — open Load Profile modal if signed in, else file import
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        if (isAuthenticated()) {
            showLoadProfileModal();
        } else {
            elements.loadParamsInput.click();
        }
    }

    // Close dialogs: Escape
    if (e.key === 'Escape') {
        // Check share modal first
        const shareOverlay = document.getElementById('share-profile-overlay');
        if (shareOverlay && shareOverlay.classList.contains('active')) {
            e.preventDefault();
            closeShareModal();
            return;
        }

        // Check load profile modal
        const loadOverlay = document.getElementById('load-profile-overlay');
        if (loadOverlay && loadOverlay.classList.contains('active')) {
            e.preventDefault();
            closeLoadProfileModal();
            return;
        }

        // Check generic modal
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay && modalOverlay.classList.contains('active')) {
            e.preventDefault();
            closeModal();
            return;
        }

        // Then check if menu is open
        const menuPanel = document.getElementById('menu-panel');
        if (menuPanel && menuPanel.classList.contains('open')) {
            e.preventDefault();
            closeMenu();
        }
    }
});
