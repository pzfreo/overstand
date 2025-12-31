import { state, elements, initElements } from './state.js';
import * as ui from './ui.js';
import { downloadPDF } from './pdf_export.js';
import { registerServiceWorker, initInstallPrompt } from './pwa_manager.js';

// Auto-generate timer
let generateTimeout = null;

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

function hideErrors() {
    ui.hideErrors();
}

function debouncedGenerate() {
    clearTimeout(generateTimeout);
    generateTimeout = setTimeout(() => {
        if (!elements.errorPanel.classList.contains('show')) {
            generateNeck();
        }
    }, 500);
}

const UI_CALLBACKS = {
    collectParameters,
    onInputChange: debounce(() => {
        updateDerivedValues();
        debouncedGenerate();
    }, 300),
    onEnumChange: (e) => {
        updateDerivedValues();
        debouncedGenerate();
    },
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
            'constants.py', 'buildprimitives.py', 'dimension_helpers.py', 'derived_value_metadata.py',
            'instrument_parameters.py', 'radius_template.py', 'instrument_geometry.py', 'instrument_generator.py',
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
            import constants, buildprimitives, dimension_helpers, instrument_parameters, radius_template
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

        state.presets = await loadPresetsFromDirectory();

        ui.generateUI(UI_CALLBACKS);
        ui.populatePresets();
        updateDerivedValues();
        generateNeck();

        elements.genBtn.disabled = false;
    } catch (error) {
        ui.setStatus('error', '❌ Initialization failed');
        ui.showErrors([`Failed to initialize: ${error.message}`]);
        console.error('Initialization error:', error);
    }
}

function loadPreset() {
    const presetId = elements.presetSelect.value;
    if (!presetId) return;
    const preset = state.presets[presetId];
    if (!preset || !preset.parameters) return;

    for (const [name, value] of Object.entries(preset.parameters)) {
        const element = document.getElementById(name);
        if (element) {
            if (element.type === 'checkbox') element.checked = value;
            else element.value = value;
        }
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

    if (window.innerWidth <= 1024) {
        const panel = document.getElementById('controls-panel');
        if (panel) panel.classList.remove('mobile-open');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

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

            const derivedResultJson = await state.pyodide.runPythonAsync(`
                from instrument_generator import get_derived_values
                get_derived_values('${paramsJson.replace(/'/g, "\\'")}')
            `);
            const dResult = JSON.parse(derivedResultJson);
            state.derivedFormatted = dResult.success ? dResult.formatted : {};

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
            container.style.display = 'grid';
            container.innerHTML = '';

            for (const [name, param] of Object.entries(state.parameterDefinitions.parameters)) {
                if (ui.isParameterOutput(param, currentMode)) {
                    const input = document.getElementById(name);
                    if (input && result.values[param.label] != null) {
                        input.value = !isNaN(result.values[param.label]) ? result.values[param.label] : '';
                    }
                }
            }

            for (const [label, value] of Object.entries(result.values)) {
                if (label.includes('_')) continue;
                const meta = (result.metadata || {})[label];
                if (!meta || !meta.visible) continue;

                const div = document.createElement('div');
                div.className = 'metric-card';
                let formattedValue = (value == null || isNaN(value)) ? '—' : (result.formatted && result.formatted[label]) || (meta ? `${value.toFixed(meta.decimals)} ${meta.unit}`.trim() : value);

                div.innerHTML = `<span class="metric-label" title="${meta ? meta.description : ''}">${meta ? meta.display_name : label}</span><span class="metric-value">${formattedValue}</span>`;
                container.appendChild(div);
            }
        } else container.style.display = 'none';
    } catch (e) { console.error("Failed to update derived values:", e); }
}

function switchView(viewName) {
    if (!state.views) return;
    state.currentView = viewName;
    ui.displayCurrentView();
}

function zoomIn() { if (state.svgCanvas) state.svgCanvas.zoom(state.svgCanvas.zoom() * 1.3); }
function zoomOut() { if (state.svgCanvas) state.svgCanvas.zoom(state.svgCanvas.zoom() / 1.3); }
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
            ui.hideErrors();
            ui.updateParameterVisibility(collectParameters());
            updateDerivedValues();
            ui.setStatus('ready', '✅ Parameters loaded');
        } catch (err) { alert(`Failed to load: ${err.message}`); }
    };
    reader.readAsText(file);
    event.target.value = '';
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

    // Mobile menu
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileCloseBtn = document.getElementById('mobile-close-btn');
    const controlsPanel = document.getElementById('controls-panel');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileMenuBtn && mobileCloseBtn && controlsPanel && sidebarOverlay) {
        const open = () => { controlsPanel.classList.add('mobile-open'); sidebarOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
        const close = () => { controlsPanel.classList.remove('mobile-open'); sidebarOverlay.classList.remove('active'); document.body.style.overflow = ''; };
        mobileMenuBtn.addEventListener('click', () => controlsPanel.classList.contains('mobile-open') ? close() : open());
        mobileCloseBtn.addEventListener('click', close);
        sidebarOverlay.addEventListener('click', close);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && controlsPanel.classList.contains('mobile-open')) close(); });
    }

    registerServiceWorker();
    initInstallPrompt();
    loadVersionInfo();
    initializePython();
});

document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!elements.genBtn.disabled && !state.isGenerating) generateNeck();
    }
});
