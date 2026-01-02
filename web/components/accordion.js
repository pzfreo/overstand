/**
 * Reusable Accordion Component
 *
 * A collapsible section with header and content.
 * State persists across page loads using localStorage.
 *
 * Usage:
 *   const accordion = new Accordion({
 *     id: 'advanced-geometry',
 *     title: 'Advanced Geometry',
 *     icon: '📐',
 *     expanded: false,
 *     onToggle: (isExpanded) => console.log('Toggled!', isExpanded)
 *   });
 *
 *   accordion.appendChild(myContentElement);
 *   container.appendChild(accordion.getElement());
 */
export class Accordion {
    /**
     * Create an accordion section
     * @param {Object} config - Configuration object
     * @param {string} config.id - Unique identifier for this accordion
     * @param {string} config.title - Title text to display in header
     * @param {string} [config.icon=''] - Icon/emoji to show before title
     * @param {boolean} [config.expanded=true] - Initial expanded state
     * @param {Function} [config.onToggle] - Callback when toggle state changes
     */
    constructor(config) {
        this.id = config.id;
        this.title = config.title;
        this.icon = config.icon || '';
        this.onToggle = config.onToggle || (() => {});

        // Check localStorage for saved state, otherwise use config
        const savedState = localStorage.getItem(`section-${this.id}-expanded`);
        if (savedState !== null) {
            this.expanded = savedState === 'true';
        } else {
            this.expanded = config.expanded !== undefined ? config.expanded : true;
        }

        this.element = this.createDOM();
        this.headerElement = this.element.querySelector('.accordion-header');
        this.contentElement = this.element.querySelector('.accordion-content');
        this.chevronElement = this.element.querySelector('.accordion-chevron');
    }

    /**
     * Create the DOM structure for this accordion
     * @returns {HTMLElement} The accordion container element
     */
    createDOM() {
        const section = document.createElement('div');
        section.className = 'accordion-section';
        section.dataset.sectionId = this.id;

        // Header (clickable)
        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', this.expanded.toString());
        header.setAttribute('tabindex', '0');

        header.innerHTML = `
            <span class="accordion-icon">${this.icon}</span>
            <span class="accordion-title">${this.title}</span>
            <span class="accordion-chevron">${this.expanded ? '▼' : '▶'}</span>
        `;

        // Click to toggle
        header.addEventListener('click', () => this.toggle());

        // Keyboard support (Enter or Space)
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Content (collapsible)
        const content = document.createElement('div');
        content.className = 'accordion-content';
        content.style.display = this.expanded ? 'block' : 'none';
        content.setAttribute('role', 'region');

        section.appendChild(header);
        section.appendChild(content);

        return section;
    }

    /**
     * Toggle the expanded/collapsed state
     */
    toggle() {
        this.expanded = !this.expanded;
        this.updateDisplay();
        this.onToggle(this.expanded);

        // Save state to localStorage
        localStorage.setItem(`section-${this.id}-expanded`, this.expanded.toString());
    }

    /**
     * Set expanded state explicitly
     * @param {boolean} expanded - True to expand, false to collapse
     */
    setExpanded(expanded) {
        if (this.expanded !== expanded) {
            this.expanded = expanded;
            this.updateDisplay();
            this.onToggle(this.expanded);
            localStorage.setItem(`section-${this.id}-expanded`, this.expanded.toString());
        }
    }

    /**
     * Update the visual display to match current state
     */
    updateDisplay() {
        this.contentElement.style.display = this.expanded ? 'block' : 'none';
        this.chevronElement.textContent = this.expanded ? '▼' : '▶';
        this.headerElement.setAttribute('aria-expanded', this.expanded.toString());
    }

    /**
     * Append a child element to the accordion content
     * @param {HTMLElement} child - Element to append
     */
    appendChild(child) {
        this.contentElement.appendChild(child);
    }

    /**
     * Get the root DOM element
     * @returns {HTMLElement} The accordion container
     */
    getElement() {
        return this.element;
    }

    /**
     * Get the content container element
     * @returns {HTMLElement} The content container
     */
    getContentElement() {
        return this.contentElement;
    }

    /**
     * Check if accordion is currently expanded
     * @returns {boolean} True if expanded
     */
    isExpanded() {
        return this.expanded;
    }
}
