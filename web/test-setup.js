/**
 * Jest test setup file
 * Sets up the DOM environment and mocks for testing
 */

// Mock DOM elements that tests might need
beforeEach(() => {
  // Create a basic modal structure
  document.body.innerHTML = `
    <div id="modal-overlay">
      <div id="modal">
        <h2 id="modal-title"></h2>
        <div id="modal-content"></div>
        <button id="modal-close">Close</button>
      </div>
    </div>
    <div id="status">
      <span id="status-text"></span>
    </div>
    <button id="gen-btn">Generate</button>
    <div id="preview-container"></div>
    <div id="error-panel">
      <ul id="error-list"></ul>
    </div>
    <div id="parameters-container"></div>
    <select id="preset"></select>
    <div id="view-tabs"></div>
    <div id="zoom-controls"></div>
    <button id="dl-svg">Download SVG</button>
    <button id="dl-pdf">Download PDF</button>
    <div id="calculated-fields"></div>
    <button id="save-params-btn">Save</button>
    <button id="load-params-btn">Load</button>
    <input id="load-params-input" type="file" />
    <button id="zoom-in">+</button>
    <button id="zoom-out">-</button>
    <button id="zoom-reset">Reset</button>
  `;
});

// Clean up after each test
afterEach(() => {
  document.body.innerHTML = '';
});
