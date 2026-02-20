import { state, elements } from './state.js';
import * as ui from './ui.js';
import * as analytics from './analytics.js';
import { DEBOUNCE_GENERATE } from './constants.js';
import { debounce, collectParameters } from './params.js';

export function classifyErrors(errors) {
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

export async function generateNeck() {
    if (state.isGenerating) return;
    ui.hideErrors();
    state.isGenerating = true;
    elements.genBtn.disabled = true;
    ui.setStatus('generating', '⚙️ Updating preview...');

    try {
        const params = collectParameters();
        params._generator_url = window.location.href;
        const paramsJson = JSON.stringify(params);

        state.pyodide.globals.set("_params_json", paramsJson);
        const resultJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import generate_violin_neck
            generate_violin_neck(_params_json)
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

export async function updateDerivedValues() {
    if (!state.pyodide || state.isGenerating) return;
    try {
        const params = collectParameters();
        const paramsJson = JSON.stringify(params);
        const currentMode = params.instrument_family || 'VIOLIN';

        state.pyodide.globals.set("_params_json", paramsJson);
        const resultJson = await state.pyodide.runPythonAsync(`
            from instrument_generator import get_derived_values
            get_derived_values(_params_json)
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
                        if (input && result.values[name] != null) {
                            input.value = !isNaN(result.values[name]) ? result.values[name] : '';
                        }
                    }
                }

                for (const [label, value] of Object.entries(result.values)) {
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

    const keyMeasurementsConfig = state.uiMetadata?.key_measurements || [
        { key: 'neck_angle', primary: true },
        { key: 'neck_stop', key_conditional: { 'GUITAR_MANDOLIN': 'body_stop' } },
        { key: 'nut_relative_to_ribs' },
        { key: 'string_break_angle' }
    ];

    const instrumentFamily = params?.instrument_family || 'VIOLIN';
    const coreMetrics = keyMeasurementsConfig.map(metric => {
        let key = metric.key;
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

        item.appendChild(valueSpan);
        item.appendChild(label);
        panel.appendChild(item);
    }
}

export const debouncedGenerate = debounce(() => {
    generateNeck();
}, DEBOUNCE_GENERATE);
