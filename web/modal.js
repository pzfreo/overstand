/**
 * Modal Dialog Module
 *
 * Provides a consistent modal dialog system for the application.
 * Replaces browser alert(), confirm(), and prompt() with styled modals.
 */

// Pending resolve callback for confirm/prompt modals.
// Called by closeModal() to resolve as "cancel" when user presses Escape or clicks outside.
let _pendingResolve = null;

/**
 * Show a modal dialog with the given title and content
 * @param {string} title - Modal title
 * @param {string} content - HTML content for the modal body
 */
export function showModal(title, content) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    modalTitle.textContent = title;
    modalContent.innerHTML = content;

    // Show modal with animation
    modalOverlay.classList.add('active');

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
}

/**
 * Close the currently open modal
 */
export function closeModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';

    // If a confirm/prompt modal is pending, resolve as cancel
    if (_pendingResolve) {
        const resolve = _pendingResolve;
        _pendingResolve = null;
        resolve(undefined);
    }
}

/**
 * Show a confirmation modal (replaces confirm())
 * @param {string} title - Modal title
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} true if confirmed, false if cancelled
 */
export function showConfirmModal(title, message) {
    return new Promise(resolve => {
        _pendingResolve = (val) => resolve(val === undefined ? false : val);

        const content = `
            <p class="modal-confirm-message">${escapeHtml(message)}</p>
            <div class="modal-actions">
                <button class="modal-btn modal-btn-cancel" id="modal-cancel">Cancel</button>
                <button class="modal-btn modal-btn-confirm" id="modal-confirm">OK</button>
            </div>`;
        showModal(title, content);

        document.getElementById('modal-confirm').onclick = () => {
            _pendingResolve = null;
            closeModal();
            resolve(true);
        };
        document.getElementById('modal-cancel').onclick = () => {
            _pendingResolve = null;
            closeModal();
            resolve(false);
        };
    });
}

/**
 * Show a prompt modal (replaces prompt())
 * @param {string} title - Modal title
 * @param {string} message - Prompt message
 * @param {string} [defaultValue=''] - Default input value
 * @returns {Promise<string|null>} Input value if confirmed, null if cancelled
 */
export function showPromptModal(title, message, defaultValue = '') {
    return new Promise(resolve => {
        _pendingResolve = (val) => resolve(val === undefined ? null : val);

        const content = `
            <p class="modal-prompt-message">${escapeHtml(message)}</p>
            <input type="text" class="modal-prompt-input" id="modal-prompt-input" value="${escapeHtml(defaultValue)}">
            <div class="modal-actions">
                <button class="modal-btn modal-btn-cancel" id="modal-cancel">Cancel</button>
                <button class="modal-btn modal-btn-confirm" id="modal-confirm">OK</button>
            </div>`;
        showModal(title, content);

        const input = document.getElementById('modal-prompt-input');
        input.focus();
        input.select();

        // Allow Enter key to submit
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                _pendingResolve = null;
                closeModal();
                resolve(input.value);
            }
        });

        document.getElementById('modal-confirm').onclick = () => {
            _pendingResolve = null;
            closeModal();
            resolve(input.value);
        };
        document.getElementById('modal-cancel').onclick = () => {
            _pendingResolve = null;
            closeModal();
            resolve(null);
        };
    });
}

/**
 * Show an error modal with consistent styling
 * @param {string} title - Error title
 * @param {string} message - Error message
 */
export function showErrorModal(title, message) {
    const content = `<p class="modal-error-message">${escapeHtml(message)}</p>`;
    showModal(title, content);
}

/**
 * Show an info modal with consistent styling
 * @param {string} title - Info title
 * @param {string} message - Info message
 */
export function showInfoModal(title, message) {
    const content = `<p class="modal-info-message">${escapeHtml(message)}</p>`;
    showModal(title, content);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
