import { state, elements } from './state.js';
import * as ui from './ui.js';
import * as analytics from './analytics.js';
import { showErrorModal } from './modal.js';
import { VIEW_FILENAME_PARTS } from './constants.js';
import { collectParameters, applyParametersToForm, refreshAfterParameterLoad, confirmDiscardChanges, updateSaveIndicator } from './params.js';

export function sanitizeFilename(name) { return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_'); }
export function getInstrumentFilename() { return sanitizeFilename(collectParameters().instrument_name || 'instrument'); }

export function downloadFile(content, filename, mimeType) {
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

export function downloadSVG() {
    if (!state.views || !state.views[state.currentView]) return;
    const filename = `${getInstrumentFilename()}_${VIEW_FILENAME_PARTS[state.currentView]}.svg`;
    downloadFile(state.views[state.currentView], filename, 'image/svg+xml');
    analytics.trackSVGDownloaded(state.currentView);
}

export function saveParameters() {
    const description = document.getElementById('profile-description')?.value || '';
    const saveData = {
        metadata: { version: '1.0', timestamp: new Date().toISOString(), description: description || 'Overstand Parameters' },
        parameters: collectParameters()
    };
    const filename = `${getInstrumentFilename()}_params_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
    downloadFile(JSON.stringify(saveData, null, 2), filename, 'application/json');

    state.parametersModified = false;
    updateSaveIndicator();

    analytics.trackParametersSaved();
}

export async function handleLoadParameters(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!await confirmDiscardChanges(`Importing "${file.name}" will overwrite your current parameter values.`)) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const saveData = JSON.parse(e.target.result);
            if (!saveData.parameters) return;
            applyParametersToForm(saveData.parameters);
            elements.presetSelect.value = '';

            const descEl = document.getElementById('profile-description');
            if (descEl) {
                const desc = saveData.metadata?.description || '';
                descEl.value = (desc === 'Overstand Parameters') ? '' : desc;
            }

            state.parametersModified = false;
            state.currentProfileName = file.name.replace(/\.json$/i, '');
            updateSaveIndicator();

            refreshAfterParameterLoad();
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
