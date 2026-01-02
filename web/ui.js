import { state, elements } from './state.js';
import { ParameterSection } from './components/parameter-section.js';
import { OutputSection } from './components/output-section.js';

export function setStatus(type, message) {
    elements.status.className = `status-bar ${type}`;
    elements.statusText.textContent = message;
}

export function showErrors(errors) {
    elements.errorList.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    elements.errorPanel.classList.add('show');
}

export function hideErrors() {
    elements.errorPanel.classList.remove('show');
}

export function checkParameterVisibility(param, currentParams) {
    if (!param.visible_when) return true;
    for (const [condParam, condValue] of Object.entries(param.visible_when)) {
        let actualValue = currentParams[condParam];
        if (actualValue === undefined && state.parameterDefinitions.parameters[condParam]) {
            actualValue = state.parameterDefinitions.parameters[condParam].default;
        }
        // Handle array values in visible_when (e.g., ['VIOL', 'GUITAR_MANDOLIN'])
        if (Array.isArray(condValue)) {
            if (!condValue.includes(actualValue)) return false;
        } else {
            if (actualValue !== condValue) return false;
        }
    }
    return true;
}

export function isParameterOutput(param, currentMode) {
    if (!param.is_output) return false;
    return param.is_output[currentMode] === true;
}

export function generateUI(callbacks) {
    const container = elements.parametersContainer;
    const currentParams = callbacks.collectParameters();

    container.innerHTML = '';

    // Use new component-based UI if metadata is available
    if (state.uiMetadata && state.uiMetadata.sections) {
        generateComponentBasedUI(callbacks, currentParams);
    } else {
        // Fallback to old category-based UI
        generateLegacyUI(callbacks, currentParams);
    }
}

/**
 * Generate UI using new component-based architecture
 */
function generateComponentBasedUI(callbacks, currentParams) {
    const container = elements.parametersContainer;
    const sections = state.uiMetadata.sections;
    const parameters = state.uiMetadata.parameters;
    const derivedValues = state.uiMetadata.derived_values;

    // Store section components for later updates
    state.uiSections = {
        input: [],
        output: []
    };

    // Get all sections and sort by order
    const sortedSections = Object.values(sections).sort((a, b) => a.order - b.order);

    // Separate input and output sections
    const inputSections = sortedSections.filter(s =>
        s.type === 'input_basic' || s.type === 'input_advanced'
    );
    const outputSections = sortedSections.filter(s =>
        s.type === 'output_core' || s.type === 'output_detailed'
    );

    // Create input sections
    for (const sectionDef of inputSections) {
        const section = new ParameterSection({
            sectionDef: sectionDef,
            parameters: parameters,
            callbacks: callbacks,
            currentParams: currentParams
        });

        container.appendChild(section.getElement());
        state.uiSections.input.push(section);
    }

    // Create output sections
    // Note: Output values will be populated by updateDerivedValues()
    for (const sectionDef of outputSections) {
        const section = new OutputSection({
            sectionDef: sectionDef,
            derivedValues: derivedValues,
            calculatedValues: state.derivedValues || {}
        });

        container.appendChild(section.getElement());
        state.uiSections.output.push(section);
    }
}

/**
 * Generate UI using legacy category-based architecture (fallback)
 */
function generateLegacyUI(callbacks, currentParams) {
    const container = elements.parametersContainer;
    const currentMode = currentParams.instrument_family || 'VIOLIN';
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
                const isVisible = checkParameterVisibility(param, currentParams);
                const isOutput = isParameterOutput(param, currentMode);
                const control = createParameterControl(name, param, isOutput, callbacks);

                if (!isVisible) control.style.display = 'none';
                section.appendChild(control);
            }
        }
        container.appendChild(section);
    }
}

function createLabelDiv(name, param, isOutput) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'param-label';
    const label = document.createElement('label');
    label.textContent = param.label;
    label.htmlFor = name;

    if (isOutput) {
        const indicator = document.createElement('span');
        indicator.className = 'output-indicator';
        indicator.textContent = ' (calculated)';
        label.appendChild(indicator);
    }

    labelDiv.appendChild(label);
    return labelDiv;
}

function createNumberControl(name, param, isOutput, callbacks) {
    const group = document.createElement('div');
    group.className = 'param-group';
    group.dataset.paramName = name;
    if (isOutput) group.classList.add('param-output');

    const labelDiv = createLabelDiv(name, param, isOutput);

    const unit = document.createElement('span');
    unit.className = 'param-unit';
    unit.textContent = param.unit;
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

    if (isOutput) {
        input.readOnly = true;
        input.classList.add('readonly-output');
    } else {
        input.addEventListener('change', hideErrors);
        input.addEventListener('input', callbacks.onInputChange);
    }
    group.appendChild(input);

    return group;
}

function createEnumControl(name, param, callbacks) {
    const group = document.createElement('div');
    group.className = 'param-group';
    group.dataset.paramName = name;

    const labelDiv = createLabelDiv(name, param, false);
    group.appendChild(labelDiv);

    const select = document.createElement('select');
    select.id = name;
    select.name = name;

    for (const option of param.options) {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        if (option.value === param.default) opt.selected = true;
        select.appendChild(opt);
    }

    select.addEventListener('change', hideErrors);
    select.addEventListener('change', callbacks.onEnumChange);
    if (name === 'instrument_family') {
        select.addEventListener('change', () => updateParameterVisibility(callbacks.collectParameters()));
    }
    group.appendChild(select);

    return group;
}

function createBooleanControl(name, param, callbacks) {
    const group = document.createElement('div');
    group.className = 'param-group';
    group.dataset.paramName = name;

    const checkboxDiv = document.createElement('div');
    checkboxDiv.className = 'checkbox-group';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = name;
    input.name = name;
    input.checked = param.default;
    input.addEventListener('change', hideErrors);
    input.addEventListener('change', callbacks.onEnumChange);

    const label = document.createElement('label');
    label.textContent = param.label;
    label.htmlFor = name;

    checkboxDiv.appendChild(input);
    checkboxDiv.appendChild(label);
    group.appendChild(checkboxDiv);

    return group;
}

function createStringControl(name, param, callbacks) {
    const group = document.createElement('div');
    group.className = 'param-group';
    group.dataset.paramName = name;

    const labelDiv = createLabelDiv(name, param, false);
    group.appendChild(labelDiv);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = name;
    input.name = name;
    input.value = param.default;
    input.maxLength = param.max_length || 100;
    input.addEventListener('change', hideErrors);
    input.addEventListener('input', callbacks.onInputChange);
    group.appendChild(input);

    return group;
}

export function createParameterControl(name, param, isOutput, callbacks) {
    // Delegate to type-specific control creation functions
    let group;

    if (param.type === 'number') {
        group = createNumberControl(name, param, isOutput, callbacks);
    } else if (param.type === 'enum') {
        group = createEnumControl(name, param, callbacks);
    } else if (param.type === 'boolean') {
        group = createBooleanControl(name, param, callbacks);
    } else if (param.type === 'string') {
        group = createStringControl(name, param, callbacks);
    } else {
        // Fallback for unknown types
        group = document.createElement('div');
        group.className = 'param-group';
        group.dataset.paramName = name;
    }

    // Add description if present (common to all types)
    if (param.description) {
        const desc = document.createElement('div');
        desc.className = 'param-description';
        desc.textContent = param.description;
        group.appendChild(desc);
    }

    return group;
}

export function updateParameterVisibility(currentParams) {
    // Use component-based update if available
    if (state.uiSections && state.uiSections.input) {
        for (const section of state.uiSections.input) {
            section.updateVisibility(currentParams);
        }
    } else {
        // Fallback to legacy update
        updateParameterVisibilityLegacy(currentParams);
    }

    // Update tab states based on instrument family
    updateTabStates(currentParams);
}

/**
 * Legacy parameter visibility update (fallback)
 */
function updateParameterVisibilityLegacy(currentParams) {
    const currentMode = currentParams.instrument_family;

    for (const [name, param] of Object.entries(state.parameterDefinitions.parameters)) {
        const group = document.querySelector(`.param-group[data-param-name="${name}"]`);
        if (!group) continue;

        const isVisible = checkParameterVisibility(param, currentParams);
        group.style.display = isVisible ? '' : 'none';

        if (isVisible) {
            const isOutput = isParameterOutput(param, currentMode);
            const input = document.getElementById(name);
            if (input) {
                input.readOnly = isOutput;
                input.classList.toggle('readonly-output', isOutput);
                group.classList.toggle('param-output', isOutput);

                const label = group.querySelector('label');
                if (label) {
                    const baseText = param.label;
                    label.textContent = isOutput ? `${baseText} (calculated)` : baseText;
                }
            }
        }
    }
}

export function populatePresets() {
    const select = elements.presetSelect;
    select.innerHTML = ''; // Clear existing options

    // Use instrument presets from ui_metadata if available
    if (state.uiMetadata && state.uiMetadata.presets) {
        const presets = state.uiMetadata.presets;

        // Sort presets by family, then by display name
        const sortedPresets = Object.entries(presets).sort((a, b) => {
            const [, presetA] = a;
            const [, presetB] = b;

            // Custom/Other always goes last
            if (presetA.id === 'custom') return 1;
            if (presetB.id === 'custom') return -1;

            // Sort by family, then by display name
            if (presetA.family !== presetB.family) {
                return presetA.family.localeCompare(presetB.family);
            }
            return presetA.display_name.localeCompare(presetB.display_name);
        });

        for (const [id, preset] of sortedPresets) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = preset.display_name;
            option.title = preset.description;
            select.appendChild(option);
        }
    } else {
        // Fallback to legacy file-based presets
        select.innerHTML = '<option value="">-- Custom --</option>';
        for (const [id, preset] of Object.entries(state.presets)) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = preset.name || id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            select.appendChild(option);
        }
    }
}

function setZoomButtonsState(enabled) {
    document.querySelectorAll('.zoom-btn').forEach(btn => {
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '0.3';
    });
}

export function displayCurrentView() {
    if (!state.views || !state.views[state.currentView]) return;

    if (state.svgCanvas) {
        state.svgCanvas.clear();
        state.svgCanvas.remove();
        state.svgCanvas = null;
    }

    elements.preview.innerHTML = '';

    if (state.currentView === 'dimensions') {
        setZoomButtonsState(false);
        elements.preview.innerHTML = state.views[state.currentView];
    } else if (state.currentView === 'fret_positions') {
        // Disable zoom controls for fret positions view
        setZoomButtonsState(false);

        const fretData = state.views.fret_positions;
        if (fretData && fretData.available) {
            elements.preview.innerHTML = fretData.html;
        } else {
            elements.preview.innerHTML = '<p class="info-message">Fret positions not available for this instrument family</p>';
        }
    } else {
        setZoomButtonsState(true);

        state.svgCanvas = SVG().addTo('#preview-container');
        state.svgCanvas.svg(state.views[state.currentView]);

        const bbox = state.svgCanvas.bbox();
        const containerRect = elements.preview.getBoundingClientRect();
        const padding = Math.min(containerRect.width, containerRect.height) * 0.05;

        const viewBoxConfig = {
            x: bbox.x - padding,
            y: bbox.y - padding,
            width: bbox.width + padding * 2,
            height: bbox.height + padding * 2
        };

        state.svgCanvas.viewbox(viewBoxConfig.x, viewBoxConfig.y, viewBoxConfig.width, viewBoxConfig.height);
        state.initialViewBox = viewBoxConfig;
        state.svgCanvas.panZoom({ zoomMin: 0.1, zoomMax: 20, zoomFactor: 0.3 });
    }

    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === state.currentView);
    });

    // Manage download button visibility based on view
    const svgBtn = document.getElementById('dl-svg');
    const pdfBtn = document.getElementById('dl-pdf');

    if (state.currentView === 'dimensions' || state.currentView === 'fret_positions') {
        // For table views, disable SVG but enable PDF
        if (svgBtn) {
            svgBtn.style.display = 'block';
            svgBtn.disabled = true;
            svgBtn.style.opacity = '0.3';
        }
        if (pdfBtn) {
            pdfBtn.style.display = 'block';
            pdfBtn.disabled = false;
            pdfBtn.style.opacity = '1';
        }
    } else {
        // For all SVG views (including radius_template), show both buttons enabled
        if (svgBtn) {
            svgBtn.style.display = 'block';
            svgBtn.disabled = false;
            svgBtn.style.opacity = '1';
        }
        if (pdfBtn) {
            pdfBtn.style.display = 'block';
            pdfBtn.disabled = false;
            pdfBtn.style.opacity = '1';
        }
    }
}

export function updateTabStates(params) {
    const instrumentFamily = params.instrument_family || 'VIOLIN';
    const fretTab = document.querySelector('.view-tab[data-view="fret_positions"]');

    if (!fretTab) return;

    // Enable for VIOL and GUITAR_MANDOLIN, disable for VIOLIN
    if (instrumentFamily === 'VIOL' || instrumentFamily === 'GUITAR_MANDOLIN') {
        fretTab.disabled = false;
        fretTab.style.opacity = '1';
        fretTab.style.cursor = 'pointer';
    } else {
        fretTab.disabled = true;
        fretTab.style.opacity = '0.3';
        fretTab.style.cursor = 'not-allowed';

        // If currently viewing fret positions, switch to side view
        if (state.currentView === 'fret_positions') {
            window.switchView('side');
        }
    }
}

export function generateDimensionsTableHTML(params, derivedValues, derivedFormatted = {}) {
    const categories = state.parameterDefinitions.categories || [];
    const paramDefs = state.parameterDefinitions.parameters || {};

    let html = '<div class="dimensions-table-container"><table class="dimensions-table">';
    html += '<thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>';

    for (const category of categories) {
        if (category === 'Display Options') continue;

        // Collect visible parameters for this category
        const visibleParams = [];
        for (const [name, param] of Object.entries(paramDefs)) {
            if (param.category !== category) continue;
            // Check if parameter should be visible for current instrument family
            if (!checkParameterVisibility(param, params)) continue;
            visibleParams.push([name, param]);
        }

        // Only show category header if there are visible parameters
        if (visibleParams.length === 0) continue;

        html += `<tr><td colspan="2" class="category-header">${category}</td></tr>`;
        for (const [name, param] of visibleParams) {
            const value = params[name];
            let displayValue = value;
            if (param.type === 'number') {
                if (value == null || isNaN(value)) {
                    displayValue = '<span class="param-unit">—</span>';
                } else {
                    let decimals = 1;
                    if (param.step !== undefined) {
                        const stepStr = param.step.toString();
                        const decimalIndex = stepStr.indexOf('.');
                        decimals = decimalIndex !== -1 ? stepStr.length - decimalIndex - 1 : 0;
                    }
                    displayValue = `${value.toFixed(decimals)} <span class="param-unit">${param.unit}</span>`;
                }
            } else if (param.type === 'boolean') {
                displayValue = value ? 'Yes' : 'No';
            } else if (param.type === 'enum') {
                const option = param.options.find(opt => opt.value === value);
                displayValue = option ? option.label : value;
            }
            html += `<tr><td class="param-name">${param.label}</td><td class="param-value">${displayValue}</td></tr>`;
        }
    }

    if (derivedValues && Object.keys(derivedValues).length > 0) {
        const dCategories = new Map();
        for (const [label, value] of Object.entries(derivedValues)) {
            // Skip internal variables (those with underscores)
            if (label.includes('_')) continue;

            const meta = state.derivedMetadata && state.derivedMetadata[label];
            // Skip if no metadata or if metadata says not visible
            if (!meta || !meta.visible) continue;

            const category = meta ? meta.category : 'Calculated Values';
            if (!dCategories.has(category)) dCategories.set(category, []);
            dCategories.get(category).push({ label, value, meta });
        }
        for (const [category, items] of dCategories) {
            html += `<tr><td colspan="2" class="category-header">${category}</td></tr>`;
            items.sort((a, b) => (a.meta?.order || 999) - (b.meta?.order || 999));
            for (const { label, value, meta } of items) {
                const displayName = meta ? meta.display_name : label;
                let formattedValue;
                if (value == null || isNaN(value)) {
                    formattedValue = '<span class="param-unit">—</span>';
                } else if (derivedFormatted[label]) {
                    const parts = derivedFormatted[label].split(' ');
                    formattedValue = `${parts[0]} <span class="param-unit">${parts.slice(1).join(' ')}</span>`;
                } else if (meta) {
                    formattedValue = `${value.toFixed(meta.decimals)} <span class="param-unit">${meta.unit}</span>`;
                } else {
                    formattedValue = `${value} <span class="param-unit">mm</span>`;
                }
                html += `<tr><td class="param-name">${displayName}</td><td class="param-value">${formattedValue}</td></tr>`;
            }
        }
    }
    return html + '</tbody></table></div>';
}
