/**
 * Modal Dialog Module
 *
 * Provides a consistent modal dialog system for the application.
 * Replaces browser alert() dialogs with styled modals.
 */

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
