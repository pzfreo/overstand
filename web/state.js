// Global state management
export const state = {
    pyodide: null,
    isGenerating: false,
    views: null,              // Stores all 3 SVG views + dimensions table
    currentView: 'side',      // Currently displayed view (default to side)
    svgCanvas: null,          // SVG.js canvas for zoom/pan
    initialViewBox: null,     // Initial viewBox for zoom reset
    parameterDefinitions: null,
    presets: null,
    derivedValues: null,      // Stores calculated derived values
    derivedMetadata: null,    // Stores metadata for derived values
    derivedFormatted: null,   // Stores formatted derived values from backend
    parametersModified: false, // Tracks if parameters have been changed since load/save
    currentProfileName: null,  // Name of the currently loaded profile (for save indicator)

    // Auth & cloud state
    authUser: null,           // Current Supabase user object (or null)
    cloudPresets: [],         // Array of user's cloud presets
    sharedPreset: null        // Currently loaded shared preset (from ?share= URL)
};

// Elements will be populated after DOM is ready
export const elements = {};

// Initialize elements after DOM is ready
export function initElements() {
    elements.status = document.getElementById('status');
    elements.statusText = document.getElementById('status-text');
    elements.genBtn = document.getElementById('gen-btn');
    elements.preview = document.getElementById('preview-container');
    elements.errorPanel = document.getElementById('error-panel');
    elements.errorList = document.getElementById('error-list');
    elements.parametersContainer = document.getElementById('parameters-container');
    elements.presetSelect = document.getElementById('preset');
    elements.viewTabs = document.getElementById('view-tabs');
    elements.zoomControls = document.getElementById('zoom-controls');
    elements.dlSvg = document.getElementById('dl-svg');
    elements.dlPdf = document.getElementById('dl-pdf');
    elements.calculatedFields = document.getElementById('calculated-fields');
    elements.saveParamsBtn = document.getElementById('save-params-btn');
    elements.loadParamsBtn = document.getElementById('load-params-btn');
    elements.loadParamsInput = document.getElementById('load-params-input');
    elements.zoomInBtn = document.getElementById('zoom-in');
    elements.zoomOutBtn = document.getElementById('zoom-out');
    elements.zoomResetBtn = document.getElementById('zoom-reset');
}
