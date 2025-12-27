// Global state (exposed to window for PDF module)
window.state = {
    pyodide: null,
    isGenerating: false,
    views: null,              // Stores all 3 SVG views + dimensions table
    currentView: 'side',      // Currently displayed view (default to side)
    svgCanvas: null,          // SVG.js canvas for zoom/pan
    initialViewBox: null,     // Initial viewBox for zoom reset
    parameterDefinitions: null,
    presets: null,
    derivedValues: null,      // Stores calculated derived values
    derivedMetadata: null     // Stores metadata for derived values
};

const state = window.state;  // Local reference

// Auto-generate timer
let generateTimeout = null;

const elements = {
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    genBtn: document.getElementById('gen-btn'),
    preview: document.getElementById('preview-container'),
    errorPanel: document.getElementById('error-panel'),
    errorList: document.getElementById('error-list'),
    parametersContainer: document.getElementById('parameters-container'),
    presetSelect: document.getElementById('preset'),
    viewTabs: document.getElementById('view-tabs'),
    zoomControls: document.getElementById('zoom-controls'),
    dlPdf: document.getElementById('dl-pdf')
};

function setStatus(type, message) {
    elements.status.className = `status-bar ${type}`;
    elements.statusText.textContent = message;
}

function showErrors(errors) {
    elements.errorList.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    elements.errorPanel.classList.add('show');
}

function hideErrors() {
    elements.errorPanel.classList.remove('show');
}

// Auto-generate with debounce
function debouncedGenerate() {
    clearTimeout(generateTimeout);
    generateTimeout = setTimeout(() => {
        // Only generate if no validation errors
        if (!elements.errorPanel.classList.contains('show')) {
            generateNeck();
        }
    }, 500);
}

async function loadPresetsFromDirectory() {
    const presets = {};

    // Try multiple locations for presets (GitHub Pages vs local development)
    const presetPaths = ['./presets/', '../presets/'];

    for (const basePath of presetPaths) {
        try {
            // Try to load preset manifest from this location
            const manifestResponse = await fetch(`${basePath}presets.json`);
            if (!manifestResponse.ok) {
                continue; // Try next location
            }

            const manifest = await manifestResponse.json();
            const presetFiles = manifest.presets || [];

            // Load each preset file
            for (const filename of presetFiles) {
                try {
                    const response = await fetch(`${basePath}${filename}`);
                    if (response.ok) {
                        const presetData = await response.json();
                        const presetId = filename.replace('.json', '');

                        if (presetData.parameters) {
                            const instrumentName = presetData.parameters.instrument_name || presetId;
                            presets[presetId] = {
                                name: instrumentName,
                                parameters: presetData.parameters
                            };
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to load preset ${filename}:`, error);
                }
            }

            // If we successfully loaded presets, don't try other paths
            if (Object.keys(presets).length > 0) {
                console.log(`Loaded ${Object.keys(presets).length} presets from ${basePath}`);
                break;
            }
        } catch (error) {
            console.warn(`Failed to load presets from ${basePath}:`, error);
            // Continue to next path
        }
    }

    if (Object.keys(presets).length === 0) {
        console.warn('No presets found in any location');
    }

    return presets;
}

async function initializePython() {
    try {
        setStatus('loading', 'Loading Python engine...');
        state.pyodide = await loadPyodide();

        setStatus('loading', 'Installing package manager...');
        await state.pyodide.loadPackage('micropip');

        setStatus('loading', 'Installing Python libraries...');
        await state.pyodide.runPythonAsync(`
            import micropip

            # Install packages from PyPI only (OCP.wasm index appears broken)
            print("Installing Python packages...")

            # Install base packages
            await micropip.install([
                "numpy",
                "svgpathtools"
            ])

            print("✅ Packages installed")
        `);

        setStatus('loading', 'Loading instrument neck modules...');

        // Load Python modules (in dependency order)
        const modules = [
            'buildprimitives.py',
            'dimension_helpers.py',
            'derived_value_metadata.py',
            'instrument_parameters.py',
            'instrument_geometry.py',
            'instrument_generator.py'
        ];

        for (const moduleName of modules) {
            // Add timestamp to prevent caching during development
            const timestamp = new Date().getTime();
            let response = await fetch(`./${moduleName}?t=${timestamp}`);
            if (!response.ok) {
                response = await fetch(`../src/${moduleName}?t=${timestamp}`);
            }
            if (!response.ok) {
                throw new Error(`Could not find ${moduleName}`);
            }

            const code = await response.text();
            state.pyodide.FS.writeFile(moduleName, code);
        }

        // Import modules
        await state.pyodide.runPythonAsync(`
            import buildprimitives
            import dimension_helpers
            import instrument_parameters
            import instrument_geometry
            import instrument_generator
            print("✅ Modules loaded")
        `);

        // Get parameter definitions
        setStatus('loading', 'Building interface...');
        const paramDefsJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import get_parameter_definitions
            get_parameter_definitions()
        `);

        state.parameterDefinitions = JSON.parse(paramDefsJson);

        // Get derived value metadata
        const derivedMetaJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import get_derived_value_metadata
            get_derived_value_metadata()
        `);

        const derivedMetaResult = JSON.parse(derivedMetaJson);
        if (derivedMetaResult.success) {
            state.derivedMetadata = derivedMetaResult.metadata;
        }

        // Load presets from JSON files in presets directory
        state.presets = await loadPresetsFromDirectory();

        // Generate UI
        generateUI();
        populatePresets();

        // Initial update of derived values
        updateDerivedValues();

        // Auto-generate with default parameters
        generateNeck();

        elements.genBtn.disabled = false;

    } catch (error) {
        setStatus('error', '❌ Initialization failed');
        showErrors([`Failed to initialize: ${error.message}`]);
        console.error('Initialization error:', error);
    }
}

function generateUI() {
    const container = elements.parametersContainer;
    // Collect parameters BEFORE clearing DOM
    const currentParams = collectParameters();  // Get current values
    const currentMode = currentParams.calculation_mode || 'BODY_STOP_DRIVEN';

    container.innerHTML = '';

    const categories = state.parameterDefinitions.categories;
    const parameters = state.parameterDefinitions.parameters;

    for (const category of categories) {
        const section = document.createElement('div');
        section.className = 'category-section';

        const title = document.createElement('div');
        title.className = 'category-title';
        title.textContent = category;
        section.appendChild(title);

        for (const [name, param] of Object.entries(parameters)) {
            if (param.category === category) {
                // Check if parameter should be visible
                const isVisible = checkParameterVisibility(param, currentParams);

                // Check if it's an output in current mode
                const isOutput = isParameterOutput(param, currentMode);

                // Create the control for ALL parameters (even if not visible)
                const control = createParameterControl(name, param, isOutput);

                // Hide it if it doesn't meet visibility conditions
                if (!isVisible) {
                    control.style.display = 'none';
                }

                section.appendChild(control);
            }
        }

        container.appendChild(section);
    }
}

function createParameterControl(name, param, isOutput = false) {
    const group = document.createElement('div');
    group.className = 'param-group';
    group.dataset.paramName = name;  // For conditional visibility updates

    // Add visual indicator for output parameters
    if (isOutput) {
        group.classList.add('param-output');
    }

    if (param.type === 'number') {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'param-label';

        const label = document.createElement('label');
        label.textContent = param.label;
        label.htmlFor = name;

        // Add output indicator to label
        if (isOutput) {
            const indicator = document.createElement('span');
            indicator.className = 'output-indicator';
            indicator.textContent = '(calculated)';
            indicator.title = 'This value is calculated based on other parameters';
            label.appendChild(indicator);
        }

        const unit = document.createElement('span');
        unit.className = 'param-unit';
        unit.textContent = param.unit;

        labelDiv.appendChild(label);
        labelDiv.appendChild(unit);
        group.appendChild(labelDiv);

        const input = document.createElement('input');
        input.type = 'number';
        input.id = name;
        input.name = name;
        input.value = param.default;
        input.min = param.min;
        input.max = param.max;
        input.step = param.step;

        // Make output parameters read-only
        if (isOutput) {
            input.readOnly = true;
            input.classList.add('readonly-output');
        } else {
            // Only add input listeners if it's an input parameter
            input.addEventListener('change', hideErrors);
            input.addEventListener('input', debounce(updateDerivedValues, 300));
            input.addEventListener('input', debouncedGenerate);
        }

        group.appendChild(input);

    } else if (param.type === 'enum') {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'param-label';

        const label = document.createElement('label');
        label.textContent = param.label;
        label.htmlFor = name;
        labelDiv.appendChild(label);
        group.appendChild(labelDiv);

        const select = document.createElement('select');
        select.id = name;
        select.name = name;

        for (const option of param.options) {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            if (option.value === param.default) {
                opt.selected = true;
            }
            select.appendChild(opt);
        }

        select.addEventListener('change', hideErrors);
        select.addEventListener('change', updateDerivedValues);
        select.addEventListener('change', debouncedGenerate);

        // Special handling for calculation_mode changes
        if (name === 'calculation_mode') {
            select.addEventListener('change', () => {
                updateParameterVisibility();
            });
        }

        group.appendChild(select);

    } else if (param.type === 'boolean') {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'checkbox-group';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = name;
        input.name = name;
        input.checked = param.default;
        input.addEventListener('change', hideErrors);
        input.addEventListener('change', updateDerivedValues);
        input.addEventListener('change', debouncedGenerate);

        const label = document.createElement('label');
        label.textContent = param.label;
        label.htmlFor = name;

        checkboxDiv.appendChild(input);
        checkboxDiv.appendChild(label);
        group.appendChild(checkboxDiv);

    } else if (param.type === 'string') {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'param-label';

        const label = document.createElement('label');
        label.textContent = param.label;
        label.htmlFor = name;
        labelDiv.appendChild(label);
        group.appendChild(labelDiv);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = name;
        input.name = name;
        input.value = param.default;
        input.maxLength = param.max_length || 100;
        input.addEventListener('change', hideErrors);
        input.addEventListener('input', debounce(updateDerivedValues, 300));
        input.addEventListener('input', debouncedGenerate);
        group.appendChild(input);
    }

    if (param.description) {
        const desc = document.createElement('div');
        desc.className = 'param-description';
        desc.textContent = param.description;
        group.appendChild(desc);
    }

    return group;
}

function populatePresets() {
    const select = elements.presetSelect;

    for (const [id, preset] of Object.entries(state.presets)) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = preset.name || id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        select.appendChild(option);
    }
}

function loadPreset() {
    const presetId = elements.presetSelect.value;
    if (!presetId) return;

    const preset = state.presets[presetId];
    if (!preset || !preset.parameters) return;

    // Apply preset parameter values
    for (const [name, value] of Object.entries(preset.parameters)) {
        const element = document.getElementById(name);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else {
                element.value = value;
            }
        }
    }

    hideErrors();
    updateParameterVisibility();
    updateDerivedValues();
    debouncedGenerate();
}

function collectParameters() {
    const params = {};

    for (const [name, param] of Object.entries(state.parameterDefinitions.parameters)) {
        const element = document.getElementById(name);
        if (!element) continue;

        if (param.type === 'number') {
            params[name] = parseFloat(element.value);
        } else if (param.type === 'boolean') {
            params[name] = element.checked;
        } else if (param.type === 'string') {
            params[name] = element.value;
        } else if (param.type === 'enum') {
            params[name] = element.value;
        }
    }

    return params;
}

function checkParameterVisibility(param, currentParams) {
    // If no visibility condition, always visible
    if (!param.visible_when) return true;

    // Check each condition
    for (const [condParam, condValue] of Object.entries(param.visible_when)) {
        let actualValue = currentParams[condParam];

        // If value not found in currentParams, use the parameter's default value
        if (actualValue === undefined && state.parameterDefinitions.parameters[condParam]) {
            actualValue = state.parameterDefinitions.parameters[condParam].default;
        }

        if (actualValue !== condValue) {
            return false;
        }
    }

    return true;
}

function isParameterOutput(param, currentMode) {
    // If no output specification, it's always an input
    if (!param.is_output) return false;

    // Check if this param is an output in the current mode
    return param.is_output[currentMode] === true;
}

function updateParameterVisibility() {
    const currentParams = collectParameters();
    const currentMode = currentParams.calculation_mode;

    for (const [name, param] of Object.entries(state.parameterDefinitions.parameters)) {
        const group = document.querySelector(`.param-group[data-param-name="${name}"]`);
        if (!group) continue;

        // Check visibility
        const isVisible = checkParameterVisibility(param, currentParams);
        group.style.display = isVisible ? '' : 'none';

        // Update read-only status for visible parameters
        if (isVisible) {
            const isOutput = isParameterOutput(param, currentMode);
            const input = document.getElementById(name);

            if (input) {
                if (isOutput) {
                    input.readOnly = true;
                    input.classList.add('readonly-output');
                    group.classList.add('param-output');
                } else {
                    input.readOnly = false;
                    input.classList.remove('readonly-output');
                    group.classList.remove('param-output');
                }

                // Update label text to show/hide "(calculated)" indicator
                const label = group.querySelector('label');
                if (label) {
                    const baseText = param.label;
                    if (isOutput) {
                        if (!label.textContent.includes('(calculated)')) {
                            label.textContent = `${baseText} (calculated)`;
                        }
                    } else {
                        label.textContent = baseText;
                    }
                }
            }
        }
    }
}

function generateDimensionsTableHTML(params, derivedValues) {
    const categories = state.parameterDefinitions.categories || [];
    const paramDefs = state.parameterDefinitions.parameters || {};

    let html = '<div class="dimensions-table-container">';
    html += '<table class="dimensions-table">';
    html += '<thead><tr><th>Parameter</th><th>Value</th></tr></thead>';
    html += '<tbody>';

    // Group parameters by category
    for (const category of categories) {
        // Skip Display Options category
        if (category === 'Display Options') continue;

        // Add category header
        html += `<tr><td colspan="2" class="category-header">${category}</td></tr>`;

        // Add parameters in this category
        for (const [name, param] of Object.entries(paramDefs)) {
            if (param.category !== category) continue;

            const value = params[name];
            let displayValue = value;

            // Format the value based on type
            if (param.type === 'number') {
                displayValue = `${value} <span class="param-unit">${param.unit}</span>`;
            } else if (param.type === 'boolean') {
                displayValue = value ? 'Yes' : 'No';
            } else if (param.type === 'enum') {
                // Find the label for this enum value
                const option = param.options.find(opt => opt.value === value);
                displayValue = option ? option.label : value;
            }

            html += `<tr>`;
            html += `<td class="param-name">${param.label}</td>`;
            html += `<td class="param-value">${displayValue}</td>`;
            html += `</tr>`;
        }
    }

    // Add derived/calculated values section with metadata-driven grouping
    if (derivedValues && Object.keys(derivedValues).length > 0) {
        const categories = new Map();

        for (const [label, value] of Object.entries(derivedValues)) {
            const meta = state.derivedMetadata && state.derivedMetadata[label];

            // Skip invisible values
            if (meta && !meta.visible) continue;

            const category = meta ? meta.category : 'Calculated Values';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category).push({ label, value, meta });
        }

        // Render each category with sorted values
        for (const [category, items] of categories) {
            html += `<tr><td colspan="2" class="category-header">${category}</td></tr>`;

            // Sort by order
            items.sort((a, b) => (a.meta?.order || 999) - (b.meta?.order || 999));

            for (const { label, value, meta } of items) {
                const displayName = meta ? meta.display_name : label;
                let formattedValue;

                if (meta) {
                    formattedValue = `${value.toFixed(meta.decimals)} <span class="param-unit">${meta.unit}</span>`;
                } else {
                    // Fallback to old formatting
                    formattedValue = `${value} <span class="param-unit">mm</span>`;
                }

                html += `<tr>`;
                html += `<td class="param-name">${displayName}</td>`;
                html += `<td class="param-value">${formattedValue}</td>`;
                html += `</tr>`;
            }
        }
    }

    html += '</tbody></table></div>';
    return html;
}

async function generateNeck() {
    if (state.isGenerating) return;

    hideErrors();
    state.isGenerating = true;
    elements.genBtn.disabled = true;

    setStatus('generating', '⚙️ Updating preview...');

    // Close mobile sidebar when generating (so user can see the preview)
    if (window.innerWidth <= 1024) {
        const controlsPanel = document.getElementById('controls-panel');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        if (controlsPanel) {
            controlsPanel.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    try {
        const params = collectParameters();
        // Add current URL for footer
        params._generator_url = window.location.href;
        const paramsJson = JSON.stringify(params);

        const resultJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import generate_violin_neck
            generate_violin_neck('${paramsJson.replace(/'/g, "\\'")}')
        `);

        const result = JSON.parse(resultJson);

        if (result.success) {
            // Store all views
            state.views = result.views;

            // Get derived values for dimensions table
            const derivedResultJson = await state.pyodide.runPythonAsync(`
                from instrument_generator import get_derived_values
                get_derived_values('${paramsJson.replace(/'/g, "\\'")}')
            `);
            const derivedResult = JSON.parse(derivedResultJson);
            state.derivedValues = derivedResult.success ? derivedResult.values : {};

            // Generate dimensions table view
            state.views.dimensions = generateDimensionsTableHTML(params, state.derivedValues);

            // Display current view
            displayCurrentView();

            // Enable download buttons
            elements.dlPdf.disabled = false;
            elements.preview.classList.add('has-content');

            setStatus('ready', '✅ Preview updated');
        } else {
            showErrors(result.errors);
            setStatus('error', '❌ Generation failed - see errors below');
        }

    } catch (error) {
        showErrors([`Unexpected error: ${error.message}`]);
        setStatus('error', '❌ Generation failed');
        console.error('Generation error:', error);
    } finally {
        state.isGenerating = false;
        elements.genBtn.disabled = false;
    }
}

function displayCurrentView() {
    if (!state.views || !state.views[state.currentView]) {
        console.error('No view available for:', state.currentView);
        return;
    }

    // Clear previous canvas
    if (state.svgCanvas) {
        state.svgCanvas.clear();
        state.svgCanvas.remove();
        state.svgCanvas = null;
    }

    // Clear container
    elements.preview.innerHTML = '';

    // Handle dimensions table view differently
    if (state.currentView === 'dimensions') {
        // Disable zoom controls for table view (keep them visible to prevent layout jump)
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
        });

        // Display the table HTML directly
        elements.preview.innerHTML = state.views[state.currentView];

        // Update tab highlighting
        document.querySelectorAll('.view-tab').forEach(tab => {
            if (tab.dataset.view === state.currentView) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        return;
    }

    // Enable zoom controls for SVG views
    document.querySelectorAll('.zoom-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });

    // Create SVG.js canvas (CSS handles sizing with width/height 100%)
    state.svgCanvas = SVG()
        .addTo('#preview-container');

    // Load the SVG content
    state.svgCanvas.svg(state.views[state.currentView]);

    // Get the bounding box of all content before enabling pan/zoom
    // We need to do this first to get accurate bbox
    const bbox = state.svgCanvas.bbox();

    // Get container dimensions
    const containerRect = elements.preview.getBoundingClientRect();

    // Calculate padding (5% of smallest dimension)
    const paddingPercent = 0.05;
    const minDim = Math.min(containerRect.width, containerRect.height);
    const padding = minDim * paddingPercent;

    // Set viewBox to fit content with padding
    const viewBoxConfig = {
        x: bbox.x - padding,
        y: bbox.y - padding,
        width: bbox.width + padding * 2,
        height: bbox.height + padding * 2
    };

    state.svgCanvas.viewbox(
        viewBoxConfig.x,
        viewBoxConfig.y,
        viewBoxConfig.width,
        viewBoxConfig.height
    );

    // Store the initial viewBox for reset
    state.initialViewBox = viewBoxConfig;

    // Enable pan/zoom after setting the viewBox
    state.svgCanvas.panZoom({
        zoomMin: 0.1,
        zoomMax: 20,
        zoomFactor: 0.3
    });

    // Update tab highlighting
    document.querySelectorAll('.view-tab').forEach(tab => {
        if (tab.dataset.view === state.currentView) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

function switchView(viewName) {
    if (!state.views) {
        console.error('No views generated yet');
        return;
    }

    state.currentView = viewName;
    displayCurrentView();
}

function zoomIn() {
    if (state.svgCanvas) {
        state.svgCanvas.zoom(state.svgCanvas.zoom() * 1.3);
    }
}

function zoomOut() {
    if (state.svgCanvas) {
        state.svgCanvas.zoom(state.svgCanvas.zoom() / 1.3);
    }
}

function zoomReset() {
    if (state.svgCanvas && state.initialViewBox) {
        // Reset to the initial fitted viewBox (this automatically fits to viewport)
        state.svgCanvas.viewbox(
            state.initialViewBox.x,
            state.initialViewBox.y,
            state.initialViewBox.width,
            state.initialViewBox.height
        );
    }
}

function sanitizeFilename(name) {
    // Remove or replace characters not allowed in filenames
    return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

function getInstrumentFilename() {
    const params = collectParameters();
    const instrumentName = params.instrument_name || 'instrument';
    return sanitizeFilename(instrumentName);
}

function downloadSVG() {
    if (!state.views || !state.views[state.currentView]) {
        alert('Please generate a template first.');
        return;
    }

    const viewNames = {
        'side': 'side-view',
        'top': 'top-view',
        'cross_section': 'cross-section'
    };

    const filename = getInstrumentFilename();
    const svgContent = state.views[state.currentView];
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${viewNames[state.currentView]}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}



function saveParameters() {
    const params = collectParameters();

    const saveData = {
        metadata: {
            version: '1.0',
            timestamp: new Date().toISOString(),
            description: 'Instrument Neck Parameters',
            generator: 'Instrument Neck Geometry Generator'
        },
        parameters: params
    };

    const jsonString = JSON.stringify(saveData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = getInstrumentFilename();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `${filename}_params_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadParameters(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const saveData = JSON.parse(e.target.result);

            // Validate structure
            if (!saveData.parameters) {
                alert('Invalid parameters file: missing parameters object');
                return;
            }

            // Apply loaded values
            const params = saveData.parameters;
            for (const [name, value] of Object.entries(params)) {
                const element = document.getElementById(name);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = value;
                    } else {
                        element.value = value;
                    }
                }
            }

            // Reset preset selector
            elements.presetSelect.value = '';

            hideErrors();
            updateParameterVisibility();
            setStatus('ready', '✅ Parameters loaded successfully');

        } catch (error) {
            alert(`Failed to load parameters: ${error.message}`);
        }
    };
    reader.readAsText(file);

    // Reset file input so the same file can be loaded again
    event.target.value = '';

    // Update derived values after loading
    updateDerivedValues();
}

async function updateDerivedValues() {
    if (!state.pyodide || state.isGenerating) return;

    try {
        const params = collectParameters();
        const paramsJson = JSON.stringify(params);
        const currentMode = params.calculation_mode || 'BODY_STOP_DRIVEN';

        const resultJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import get_derived_values
            get_derived_values('${paramsJson.replace(/'/g, "\\'")}')
        `);

        const result = JSON.parse(resultJson);
        const container = document.getElementById('calculated-fields');

        console.log("Derived Result:", result);
        if (result.success && Object.keys(result.values).length > 0) {
            container.style.display = 'grid';
            container.innerHTML = '';

            // Update read-only input fields with calculated values
            for (const [name, param] of Object.entries(state.parameterDefinitions.parameters)) {
                const isOutput = isParameterOutput(param, currentMode);
                if (isOutput && result.values[param.label]) {
                    const input = document.getElementById(name);
                    if (input) {
                        input.value = result.values[param.label];
                    }
                }
            }

            // Display remaining derived values in metric cards
            const metadata = result.metadata || {};

            for (const [label, value] of Object.entries(result.values)) {
                // Skip if this value is already shown in a parameter field
                const isShownInParam = Object.values(state.parameterDefinitions.parameters)
                    .some(p => p.label === label && isParameterOutput(p, currentMode));

                if (!isShownInParam) {
                    const meta = metadata[label];

                    // Skip if metadata says not visible
                    if (meta && !meta.visible) continue;

                    const div = document.createElement('div');
                    div.className = 'metric-card';

                    // Use pre-formatted value from backend if available
                    let formattedValue;
                    if (result.formatted && result.formatted[label]) {
                        formattedValue = result.formatted[label];
                    } else if (meta) {
                        // Format using metadata
                        formattedValue = `${value.toFixed(meta.decimals)} ${meta.unit}`.trim();
                    } else {
                        // FALLBACK: Old hard-coded formatting (for backward compatibility)
                        if (label === 'Neck Angle') {
                            formattedValue = `${value}°`;
                        } else if (label === 'String Length' || label === 'Nut Relative to Ribs') {
                            formattedValue = `${value} mm`;
                        } else {
                            formattedValue = value;
                        }
                    }

                    const displayName = meta ? meta.display_name : label;
                    const description = meta ? meta.description : '';

                    div.innerHTML = `
                        <span class="metric-label" title="${description}">${displayName}</span>
                        <span class="metric-value">${formattedValue}</span>
                    `;
                    container.appendChild(div);
                }
            }
        } else {
            container.style.display = 'none';
        }

    } catch (error) {
        console.error("Failed to update derived values:", error);
    }
}

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

// Keyboard shortcut handler
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!elements.genBtn.disabled && !state.isGenerating) {
            generateNeck();
        }
    }
});

// Detect OS and update shortcut display
(function updateShortcutDisplay() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutElement = document.getElementById('gen-btn-shortcut');
    if (shortcutElement) {
        shortcutElement.textContent = isMac ? '⌘ + Enter' : 'Ctrl + Enter';
    }
})();

// Window resize is handled automatically by CSS (width/height 100%)

// ==================== Mobile Menu Controls ====================
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileCloseBtn = document.getElementById('mobile-close-btn');
    const controlsPanel = document.getElementById('controls-panel');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // Verify elements exist before attaching listeners
    if (!mobileMenuBtn || !mobileCloseBtn || !controlsPanel || !sidebarOverlay) {
        console.warn('Mobile menu elements not found');
        return;
    }

    function openSidebar() {
        controlsPanel.classList.add('mobile-open');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeSidebar() {
        controlsPanel.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }

    // Toggle sidebar when hamburger is clicked
    mobileMenuBtn.addEventListener('click', function() {
        if (controlsPanel.classList.contains('mobile-open')) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    // Close sidebar when close button is clicked
    mobileCloseBtn.addEventListener('click', closeSidebar);

    // Close sidebar when overlay is clicked
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Close sidebar on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && controlsPanel.classList.contains('mobile-open')) {
            closeSidebar();
        }
    });
});

// Initialize on load
initializePython();

// ==================== PDF Export Module ====================

window.downloadPDF = async function () {
    console.log('Starting PDF download...');
    if (!window.state || !window.state.views || !window.state.views[window.state.currentView]) {
        alert('Please generate a template first.');
        return;
    }

    try {
        // Access jsPDF from global object (UMD build)
        if (!window.jspdf) {
            throw new Error('jsPDF library not loaded. Please reload the page.');
        }
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            throw new Error('jsPDF library not loaded correctly. Please reload the page.');
        }

        if (!window.svg2pdf) {
            throw new Error('svg2pdf library not loaded. Please reload the page.');
        }

        let svg2pdf = window.svg2pdf;
        // Check if it's inside an object (common in UMD)
        if (typeof svg2pdf !== 'function' && svg2pdf.svg2pdf) {
            svg2pdf = svg2pdf.svg2pdf;
        }

        if (!svg2pdf) {
            throw new Error('svg2pdf library not loaded correctly. Please reload the page.');
        }

        const currentView = window.state.currentView;
        const viewNames = {
            'top': 'top-view',
            'side': 'side-view',
            'cross_section': 'cross-section',
            'dimensions': 'dimensions'
        };

        // Get instrument name for filename
        const params = collectParameters();
        const instrumentName = params.instrument_name || 'instrument';
        const filename = sanitizeFilename(instrumentName);

        // Handle Dimensions Table PDF
        if (currentView === 'dimensions') {
            const doc = new jsPDF();

            // Add Title
            doc.setFontSize(16);
            doc.text(`${instrumentName} - Dimensions`, 14, 15);

            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);

            // Use autoTable to convert HTML table to PDF
            // We target the table element directly
            doc.autoTable({
                html: '.dimensions-table',
                startY: 25,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] },
                styles: { fontSize: 9 }
            });

            doc.save(`${filename}_dimensions.pdf`);
            return;
        }

        // Handle SVG Views
        const svgContent = window.state.views[currentView];
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        // Get dimensions from SVG
        let svgWidth, svgHeight;
        if (svgElement.viewBox && svgElement.viewBox.baseVal) {
            svgWidth = svgElement.viewBox.baseVal.width;
            svgHeight = svgElement.viewBox.baseVal.height;
        } else {
            svgWidth = parseFloat(svgElement.getAttribute('width')) || 210;
            svgHeight = parseFloat(svgElement.getAttribute('height')) || 297;
        }

        // ISO A sizes (width x height in mm)
        const isoSizes = [
            { name: 'a4', width: 210, height: 297 },
            { name: 'a3', width: 297, height: 420 },
            { name: 'a2', width: 420, height: 594 },
            { name: 'a1', width: 594, height: 841 },
            { name: 'a0', width: 841, height: 1189 }
        ];

        // Add margins (20mm on each side)
        const margin = 20;
        const requiredWidth = svgWidth + (margin * 2);
        const requiredHeight = svgHeight + (margin * 2);

        // Find the smallest ISO A size that fits the content
        let selectedFormat = null;
        let selectedOrientation = 'portrait';

        for (const size of isoSizes) {
            // Try portrait
            if (size.width >= requiredWidth && size.height >= requiredHeight) {
                selectedFormat = size;
                selectedOrientation = 'portrait';
                break;
            }
            // Try landscape
            if (size.height >= requiredWidth && size.width >= requiredHeight) {
                selectedFormat = size;
                selectedOrientation = 'landscape';
                break;
            }
        }

        // Fallback to A0 landscape if content is too large
        if (!selectedFormat) {
            selectedFormat = isoSizes[4]; // A0
            selectedOrientation = 'landscape';
            console.warn('Content too large for A0, using A0 landscape with scaling');
        }

        // Create PDF with selected size and orientation
        const doc = new jsPDF({
            orientation: selectedOrientation,
            unit: 'mm',
            format: selectedFormat.name
        });

        // Get page dimensions
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Center the SVG on the page with margins
        const x = (pageWidth - svgWidth) / 2;
        const y = (pageHeight - svgHeight) / 2;

        // Convert SVG to PDF at 1:1 scale (1mm SVG = 1mm PDF)
        // svg2pdf requires the element to be in the DOM for style computation
        document.body.appendChild(svgElement);
        // Hide it but ensure it is rendered
        svgElement.style.position = 'absolute';
        svgElement.style.left = '-9999px';
        svgElement.style.top = '-9999px';

        try {
            await svg2pdf(svgElement, doc, {
                x: x,
                y: y,
                width: svgWidth,
                height: svgHeight
            });
        } finally {
            // Always remove the temporary element
            document.body.removeChild(svgElement);
        }

        console.log(`PDF: ${selectedFormat.name.toUpperCase()} ${selectedOrientation}, SVG size: ${svgWidth}x${svgHeight}mm`);
        doc.save(`${filename}_${viewNames[currentView]}_${selectedFormat.name}.pdf`);

    } catch (error) {
        console.error('PDF error:', error);
        alert(`PDF generation failed: ${error.message}`);
    }
};
