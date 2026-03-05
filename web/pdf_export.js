import { state } from './state.js';
import { showInfoModal, showErrorModal } from './modal.js';
import { trackPDFExported, trackError } from './analytics.js';
import { VIEW_FILENAME_PARTS } from './constants.js';
import { checkParameterVisibility, isParameterOutput } from './ui.js';
import {
    svgToPdf,
    dimensionsTableToPdf,
    fretPositionsToPdf,
    parseFretRowsFromHtml,
    downloadPdfBlob,
} from '/dist/pdf_generator.js';

/**
 * Build TableSection[] from web state for the dimensions PDF.
 * Mirrors the logic in ui.generateDimensionsTableHTML but outputs
 * structured data instead of HTML.
 */
function buildDimensionsSections(params) {
    const categories = state.parameterDefinitions.categories || [];
    const paramDefs = state.parameterDefinitions.parameters || {};
    const sections = [];

    // Input parameters by category
    for (const category of categories) {
        if (category === 'Display Options') continue;

        const rows = [];
        for (const [name, param] of Object.entries(paramDefs)) {
            if (param.category !== category) continue;
            if (!checkParameterVisibility(param, params)) continue;
            if (isParameterOutput(param, params.instrument_family)) continue;

            const value = params[name];
            if (value == null) continue;

            let displayValue;
            if (param.type === 'number') {
                if (isNaN(value)) {
                    displayValue = '—';
                } else {
                    let decimals = 1;
                    if (param.step !== undefined) {
                        const stepStr = param.step.toString();
                        const decimalIndex = stepStr.indexOf('.');
                        decimals = decimalIndex !== -1 ? stepStr.length - decimalIndex - 1 : 0;
                    }
                    displayValue = `${value.toFixed(decimals)} ${param.unit}`;
                }
            } else if (param.type === 'boolean') {
                displayValue = value ? 'Yes' : 'No';
            } else if (param.type === 'enum') {
                const option = param.options.find(opt => opt.value === value);
                displayValue = option ? option.label : value;
            } else {
                displayValue = String(value);
            }

            rows.push({ label: param.label, value: displayValue });
        }

        if (rows.length > 0) {
            sections.push({ category, rows });
        }
    }

    // Derived values
    if (state.derivedValues && Object.keys(state.derivedValues).length > 0) {
        const grouped = new Map();

        for (const [label, value] of Object.entries(state.derivedValues)) {
            const meta = state.derivedMetadata && state.derivedMetadata[label];
            if (!meta || !meta.visible) continue;

            const cat = meta.category || 'Calculated Values';
            if (!grouped.has(cat)) grouped.set(cat, []);
            grouped.get(cat).push({ label, value, meta });
        }

        for (const [cat, items] of grouped) {
            items.sort((a, b) => (a.meta?.order || 999) - (b.meta?.order || 999));

            const rows = [];
            for (const { label, value, meta } of items) {
                const displayName = meta.display_name || label;
                let formattedValue;
                if (value == null || isNaN(value)) {
                    formattedValue = '—';
                } else if (state.derivedFormatted && state.derivedFormatted[label]) {
                    formattedValue = state.derivedFormatted[label];
                } else if (meta) {
                    formattedValue = `${value.toFixed(meta.decimals)} ${meta.unit}`;
                } else {
                    formattedValue = `${value} mm`;
                }
                rows.push({ label: displayName, value: formattedValue });
            }

            sections.push({ category: cat, rows });
        }
    }

    return sections;
}

export async function downloadPDF(collectParameters, sanitizeFilename) {
    if (!state || !state.views || !state.views[state.currentView]) {
        showInfoModal('No Template', 'Please generate a template first.');
        return;
    }

    try {
        const currentView = state.currentView;
        const params = collectParameters();
        const instrumentName = params.instrument_name || 'instrument';
        const filename = sanitizeFilename(instrumentName);

        if (currentView === 'dimensions') {
            const sections = buildDimensionsSections(params);
            const bytes = await dimensionsTableToPdf(instrumentName, sections);
            downloadPdfBlob(bytes, `${filename}_dimensions.pdf`);
            trackPDFExported(params.instrument_family || 'unknown');
            return;
        }

        if (currentView === 'fret_positions') {
            const fretData = state.fretPositions;
            if (!fretData || !fretData.available) {
                showInfoModal('Not Available', 'Fret positions are not available for this instrument family.');
                return;
            }
            const fretRows = fretData.html ? parseFretRowsFromHtml(fretData.html) : null;
            const bytes = await fretPositionsToPdf(
                instrumentName,
                fretData.vsl || null,
                fretData.no_frets || null,
                fretRows,
            );
            downloadPdfBlob(bytes, `${filename}_fret-positions.pdf`);
            trackPDFExported(params.instrument_family || 'unknown');
            return;
        }

        // SVG views (side, top, cross_section, radius_template)
        const svgContent = state.views[currentView];
        const result = await svgToPdf(svgContent);
        const viewPart = VIEW_FILENAME_PARTS[currentView] || currentView;
        downloadPdfBlob(
            result.bytes,
            `${filename}_${viewPart}_${result.paperSize.toLowerCase()}.pdf`,
        );
        trackPDFExported(params.instrument_family || 'unknown');

    } catch (error) {
        console.error('PDF error:', error);
        showErrorModal('PDF Generation Failed', error.message);
        trackError('pdf_export', error.message);
    }
}
