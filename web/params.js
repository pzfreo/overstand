import { state, elements } from './state.js';
import * as ui from './ui.js';
import { showConfirmModal } from './modal.js';

// Callbacks injected by app.js to avoid circular imports with generation.js
let _updateDerivedValues = null;
let _debouncedGenerate = null;

export function setGenerationCallbacks({ updateDerivedValues, debouncedGenerate }) {
    _updateDerivedValues = updateDerivedValues;
    _debouncedGenerate = debouncedGenerate;
}

// Helper: Debounce
export function debounce(func, wait) {
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

// Apply a set of parameters to the form elements
export function applyParametersToForm(parameters) {
    for (const [name, value] of Object.entries(parameters)) {
        const el = document.getElementById(name);
        if (el) {
            if (el.type === 'checkbox') el.checked = value;
            else el.value = value;
        }
    }
}

// Common sequence after loading parameters from any source
export function refreshAfterParameterLoad() {
    ui.hideErrors();
    ui.updateParameterVisibility(collectParameters());
    if (_updateDerivedValues) _updateDerivedValues();
    if (_debouncedGenerate) _debouncedGenerate();
}

// Close an overlay and restore body scroll
export function closeOverlay(overlayId) {
    const overlay = document.getElementById(overlayId);
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

export function markParametersModified() {
    state.parametersModified = true;
    updateSaveIndicator();
}

export function updateSaveIndicator() {
    const el = document.getElementById('save-indicator');
    if (!el) return;
    if (!state.currentProfileName) {
        el.textContent = '';
        el.className = 'save-indicator';
        return;
    }
    if (state.parametersModified) {
        el.textContent = `— ${state.currentProfileName} (unsaved)`;
        el.className = 'save-indicator unsaved';
    } else {
        el.textContent = `— ${state.currentProfileName}`;
        el.className = 'save-indicator';
    }
}

export async function confirmDiscardChanges(actionDescription) {
    if (!state.parametersModified) return true;
    return showConfirmModal('Unsaved Changes',
        `You have unsaved changes. ${actionDescription}\n\nDo you want to continue?`);
}

// Handle parameter changes - update derived values immediately, debounce generation
export function handleParameterChange() {
    markParametersModified();
    if (_updateDerivedValues) _updateDerivedValues();
    if (_debouncedGenerate) _debouncedGenerate();
}

export function collectParameters() {
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
