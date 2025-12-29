import { state, elements } from './state.js';
import * as ui from './ui.js';
import { downloadPDF } from './pdf_export.js';

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

// Global functions for HTML onclick attributes (transitioning to event listeners)
window.generateNeck = generateNeck;
window.loadPreset = loadPreset;
window.switchView = switchView;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.zoomReset = zoomReset;
window.downloadPDF = () => downloadPDF(collectParameters, sanitizeFilename);
window.saveParameters = saveParameters;
window.downloadSVG = downloadSVG;

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
            'buildprimitives.py', 'dimension_helpers.py', 'derived_value_metadata.py',
            'instrument_parameters.py', 'radius_template.py', 'instrument_geometry.py', 'instrument_generator.py'
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
            import buildprimitives, dimension_helpers, instrument_parameters, radius_template, instrument_geometry, instrument_generator
        `);

        // Pre-load the font file for radius template text cutouts
        ui.setStatus('loading', 'Loading fonts...');
        try {
            // Try web/fonts/ first (for local development), then fonts/ (for GitHub Pages)
            let fontResponse = await fetch('fonts/AllertaStencil-Regular.ttf');
            if (!fontResponse.ok) {
                fontResponse = await fetch('../fonts/AllertaStencil-Regular.ttf');
            }
            if (fontResponse.ok) {
                const fontData = await fontResponse.arrayBuffer();
                state.pyodide.FS.writeFile('/tmp/AllertaStencil-Regular.ttf', new Uint8Array(fontData));
            } else {
                console.warn('Could not load AllertaStencil font');
            }
        } catch (e) {
            console.warn('Could not pre-load font file:', e);
        }

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
        document.getElementById('controls-panel').classList.remove('mobile-open');
        document.getElementById('sidebar-overlay').classList.remove('active');
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

            // Get formatted derived values
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
            // Button states are now managed by displayCurrentView()
            elements.preview.classList.add('has-content');
            ui.setStatus('ready', '✅ Preview updated');
        } else {
            ui.showErrors(result.errors);
            ui.setStatus('error', '❌ Generation failed - see errors below');
        }
    } catch (error) {
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
                const meta = (result.metadata || {})[label];
                if (meta && !meta.visible) continue;

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

function downloadSVG() {
    if (!state.views || !state.views[state.currentView]) return;
    const viewNames = {
        'side': 'side-view',
        'top': 'top-view',
        'cross_section': 'cross-section',
        'radius_template': 'radius-template'
    };
    const blob = new Blob([state.views[state.currentView]], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getInstrumentFilename()}_${viewNames[state.currentView]}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function saveParameters() {
    const saveData = {
        metadata: { version: '1.0', timestamp: new Date().toISOString(), description: 'Instrument Neck Parameters', generator: 'Instrument Neck Geometry Generator' },
        parameters: collectParameters()
    };
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getInstrumentFilename()}_params_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Global exposure for the input in index.html
window.loadParameters = (event) => {
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
            ui.setStatus('ready', '✅ Parameters loaded successfully');
        } catch (err) { alert(`Failed to load: ${err.message}`); }
    };
    reader.readAsText(file);
    event.target.value = '';
};

document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!elements.genBtn.disabled && !state.isGenerating) generateNeck();
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = document.getElementById('gen-btn-shortcut');
    if (shortcut) shortcut.textContent = isMac ? '⌘ + Enter' : 'Ctrl + Enter';

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileCloseBtn = document.getElementById('mobile-close-btn');
    const controlsPanel = document.getElementById('controls-panel');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileMenuBtn && mobileCloseBtn && controlsPanel && sidebarOverlay) {
        const open = () => { controlsPanel.classList.add('mobile-open'); sidebarOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
        const close = () => { controlsPanel.classList.remove('mobile-open'); sidebarOverlay.classList.remove('active'); document.body.style.overflow = ''; };
        mobileMenuBtn.onclick = () => controlsPanel.classList.contains('mobile-open') ? close() : open();
        mobileCloseBtn.onclick = close;
        sidebarOverlay.onclick = close;
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && controlsPanel.classList.contains('mobile-open')) close(); });
    }
});

initializePython();
