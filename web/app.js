import { state, elements, initElements } from './state.js';
import * as ui from './ui.js';
import { downloadPDF } from './pdf_export.js';
import { registerServiceWorker, initInstallPrompt } from './pwa_manager.js';
import { showModal, closeModal, showErrorModal } from './modal.js';
import { DEBOUNCE_GENERATE, ZOOM_CONFIG } from './constants.js';

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

// Debounced generation - skips if errors are showing
const debouncedGenerate = debounce(() => {
    if (!elements.errorPanel.classList.contains('show')) {
        generateNeck();
    }
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

        // Load the first preset's parameters (the one selected by default in dropdown)
        if (elements.presetSelect && elements.presetSelect.value) {
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
        ui.showErrors([`Failed to initialize: ${error.message}`]);
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
        } else {
            ui.showErrors(result.errors);
            ui.setStatus('error', '❌ Generation failed - see errors below');
        }
    } catch (error) {
        console.error('Generation error:', error);
        ui.showErrors([`Unexpected error: ${error.message}`]);
        ui.setStatus('error', '❌ Generation failed');
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

    // Determine if we're in Fret Join mode (Guitar/Mandolin family)
    const isFretJoinMode = params && params.instrument_family === 'GUITAR_MANDOLIN';

    // Define core metrics to display (in order, with primary flag for neck angle)
    // In Fret Join mode, show "Body Stop" instead of "Neck Stop"
    // Note: Keys use snake_case to match backend parameter registry
    const coreMetrics = [
        { key: 'neck_angle', primary: true },
        { key: isFretJoinMode ? 'body_stop' : 'neck_stop' },
        { key: 'nut_relative_to_ribs' }
    ];

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
}

function saveParameters() {
    const saveData = {
        metadata: { version: '1.0', timestamp: new Date().toISOString(), description: 'Instrument Neck Parameters' },
        parameters: collectParameters()
    };
    const filename = `${getInstrumentFilename()}_params_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
    downloadFile(JSON.stringify(saveData, null, 2), filename, 'application/json');

    // Reset modified flag - we just saved
    state.parametersModified = false;
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
            ui.setStatus('ready', '✅ Parameters loaded');
        } catch (err) { showErrorModal('Load Failed', err.message); }
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
                    <span class="shortcut-description">Save Parameters</span>
                    <div class="shortcut-keys">
                        <span class="key">${mod}</span>
                        <span class="key-separator">+</span>
                        <span class="key">S</span>
                    </div>
                </li>
                <li class="shortcut-item">
                    <span class="shortcut-description">Load Parameters</span>
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

// Simple markdown to HTML converter for about.md
function markdownToHtml(markdown) {
    let html = markdown;

    // Unescape characters
    html = html.replace(/\\!/g, '!');
    html = html.replace(/\\\*/g, '*');

    // Convert headers
    html = html.replace(/^# \*\*(.*?)\*\*/gm, '<h1 class="about-title">$1</h1>');
    html = html.replace(/^# (.*?)$/gm, '<h1 class="about-title">$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h3 class="about-subtitle">$1</h3>');

    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert links with emoji/icon
    html = html.replace(/\[(🌐|💻|📧)\s*(.*?)\]\((.*?)\)/g, '<a href="$3" target="_blank" class="about-link">$1 $2</a>');

    // Convert email links
    html = html.replace(/\[(.*?)\]\(mailto:(.*?)\)/g, '<a href="mailto:$2" class="about-email">$1</a>');

    // Convert regular links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Split into lines for processing
    const lines = html.split('\n');
    const output = [];
    let inList = false;
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (!line) {
            // Empty line - close any open paragraph or list
            if (currentParagraph.length > 0) {
                output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
                currentParagraph = [];
            }
            if (inList) {
                output.push('</ul>');
                inList = false;
            }
            continue;
        }

        // Check if it's a header or link line (already processed)
        if (line.startsWith('<h1') || line.startsWith('<h3') || line.startsWith('<a href') || line.match(/^Version:/)) {
            // Close any open paragraph
            if (currentParagraph.length > 0) {
                output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
                currentParagraph = [];
            }
            if (inList) {
                output.push('</ul>');
                inList = false;
            }

            // Handle version line specially
            if (line.match(/^Version:/)) {
                output.push('<div class="about-version-container">' + line.replace(/Version:\s*(.+)/, '<span class="about-version">Version $1</span>') + '</div>');
            } else {
                output.push(line);
            }
            continue;
        }

        // Check if it's a list item
        if (line.startsWith('•') || line.startsWith('-')) {
            // Close any open paragraph
            if (currentParagraph.length > 0) {
                output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
                currentParagraph = [];
            }

            if (!inList) {
                output.push('<ul class="about-list">');
                inList = true;
            }
            const itemText = line.replace(/^[•\-]\s*/, '');
            output.push('<li>' + itemText + '</li>');
            continue;
        }

        // Regular text line - add to current paragraph
        if (inList) {
            output.push('</ul>');
            inList = false;
        }
        currentParagraph.push(line);
    }

    // Close any remaining open paragraph or list
    if (currentParagraph.length > 0) {
        output.push('<p class="about-text">' + currentParagraph.join(' ') + '</p>');
    }
    if (inList) {
        output.push('</ul>');
    }

    return '<div class="about-content">' + output.join('\n') + '</div>';
}

async function showAbout() {
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM element references first
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

    // Menu system
    const menuBtn = document.getElementById('menu-btn');
    const menuCloseBtn = document.getElementById('menu-close-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuSaveParams = document.getElementById('menu-save-params');
    const menuLoadParams = document.getElementById('menu-load-params');
    const menuKeyboardShortcuts = document.getElementById('menu-keyboard-shortcuts');
    const menuAbout = document.getElementById('menu-about');

    if (menuBtn) menuBtn.addEventListener('click', openMenu);
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
    if (menuSaveParams) menuSaveParams.addEventListener('click', () => { closeMenu(); saveParameters(); });
    if (menuLoadParams) menuLoadParams.addEventListener('click', () => { closeMenu(); elements.loadParamsInput.click(); });
    if (menuKeyboardShortcuts) menuKeyboardShortcuts.addEventListener('click', showKeyboardShortcuts);
    if (menuAbout) menuAbout.addEventListener('click', showAbout);

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

    // Save parameters: ⌘/Ctrl + S
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveParameters();
    }

    // Load parameters: ⌘/Ctrl + O
    if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        elements.loadParamsInput.click();
    }

    // Close dialogs: Escape
    if (e.key === 'Escape') {
        // Check if modal is open first (priority over menu)
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
