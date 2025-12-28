import { state } from './state.js';

export async function downloadPDF(collectParameters, sanitizeFilename) {
    console.log('Starting PDF download...');
    if (!state || !state.views || !state.views[state.currentView]) {
        alert('Please generate a template first.');
        return;
    }

    try {
        if (!window.jspdf) throw new Error('jsPDF library not loaded. Please reload the page.');
        const { jsPDF } = window.jspdf;
        if (!jsPDF) throw new Error('jsPDF library not loaded correctly. Please reload the page.');
        if (!window.svg2pdf) throw new Error('svg2pdf library not loaded. Please reload the page.');

        let svg2pdf = window.svg2pdf;
        if (typeof svg2pdf !== 'function' && svg2pdf.svg2pdf) svg2pdf = svg2pdf.svg2pdf;
        if (!svg2pdf) throw new Error('svg2pdf library not loaded correctly. Please reload the page.');

        const currentView = state.currentView;
        const viewNames = {
            'top': 'top-view',
            'side': 'side-view',
            'cross_section': 'cross-section',
            'dimensions': 'dimensions',
            'fret_positions': 'fret-positions'
        };

        const params = collectParameters();
        const instrumentName = params.instrument_name || 'instrument';
        const filename = sanitizeFilename(instrumentName);

        if (currentView === 'dimensions') {
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text(`${instrumentName} - Dimensions`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
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

        if (currentView === 'fret_positions') {
            const fretData = state.views.fret_positions;
            if (!fretData || !fretData.available) {
                alert('Fret positions not available for this instrument family.');
                return;
            }
            const doc = new jsPDF();
            doc.setFontSize(16);
            doc.text(`${instrumentName} - Fret Positions`, 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
            doc.text(`Vibrating String Length: ${fretData.vsl} mm`, 14, 27);
            doc.text(`Number of Frets: ${fretData.no_frets}`, 14, 32);
            doc.autoTable({
                html: '.fret-table',
                startY: 37,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] },
                styles: { fontSize: 9 }
            });
            doc.save(`${filename}_fret-positions.pdf`);
            return;
        }

        const svgContent = state.views[currentView];
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;

        let svgWidth, svgHeight;
        if (svgElement.viewBox && svgElement.viewBox.baseVal) {
            svgWidth = svgElement.viewBox.baseVal.width;
            svgHeight = svgElement.viewBox.baseVal.height;
        } else {
            svgWidth = parseFloat(svgElement.getAttribute('width')) || 210;
            svgHeight = parseFloat(svgElement.getAttribute('height')) || 297;
        }

        const isoSizes = [
            { name: 'a4', width: 210, height: 297 },
            { name: 'a3', width: 297, height: 420 },
            { name: 'a2', width: 420, height: 594 },
            { name: 'a1', width: 594, height: 841 },
            { name: 'a0', width: 841, height: 1189 }
        ];

        const margin = 20;
        const requiredWidth = svgWidth + (margin * 2);
        const requiredHeight = svgHeight + (margin * 2);

        let selectedFormat = null;
        let selectedOrientation = 'portrait';

        for (const size of isoSizes) {
            if (size.width >= requiredWidth && size.height >= requiredHeight) {
                selectedFormat = size; selectedOrientation = 'portrait'; break;
            }
            if (size.height >= requiredWidth && size.width >= requiredHeight) {
                selectedFormat = size; selectedOrientation = 'landscape'; break;
            }
        }

        if (!selectedFormat) {
            selectedFormat = isoSizes[4]; selectedOrientation = 'landscape';
        }

        const doc = new jsPDF({
            orientation: selectedOrientation,
            unit: 'mm',
            format: selectedFormat.name
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const x = (pageWidth - svgWidth) / 2;
        const y = (pageHeight - svgHeight) / 2;

        document.body.appendChild(svgElement);
        svgElement.style.position = 'absolute';
        svgElement.style.left = '-9999px';
        svgElement.style.top = '-9999px';

        try {
            await svg2pdf(svgElement, doc, { x: x, y: y, width: svgWidth, height: svgHeight });
        } finally {
            document.body.removeChild(svgElement);
        }

        console.log(`PDF: ${selectedFormat.name.toUpperCase()} ${selectedOrientation}, SVG size: ${svgWidth}x${svgHeight}mm`);
        doc.save(`${filename}_${viewNames[currentView]}_${selectedFormat.name}.pdf`);

    } catch (error) {
        console.error('PDF error:', error);
        alert(`PDF generation failed: ${error.message}`);
    }
}
