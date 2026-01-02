/**
 * Parameter Section Component
 *
 * Renders a collapsible section containing input parameters.
 * Integrates with the existing parameter control creation system.
 *
 * Usage:
 *   const section = new ParameterSection({
 *     sectionDef: sectionMetadata,      // From ui_metadata.py
 *     parameters: parameterDefinitions, // Parameter metadata
 *     callbacks: { onInputChange, ... }, // UI callbacks
 *     currentParams: { vsl: 325, ... }   // Current parameter values
 *   });
 *
 *   container.appendChild(section.getElement());
 */

import { Accordion } from './accordion.js';
import { createParameterControl, checkParameterVisibility, isParameterOutput } from '../ui.js';

export class ParameterSection {
    /**
     * Create a parameter section
     * @param {Object} config - Configuration object
     * @param {Object} config.sectionDef - Section definition from ui_metadata
     * @param {Object} config.parameters - Parameter metadata (INSTRUMENT_PARAMETERS)
     * @param {Object} config.callbacks - UI callback functions
     * @param {Object} config.currentParams - Current parameter values
     */
    constructor(config) {
        this.sectionDef = config.sectionDef;
        this.parameters = config.parameters;
        this.callbacks = config.callbacks;
        this.currentParams = config.currentParams;

        // Create accordion for this section
        this.accordion = new Accordion({
            id: this.sectionDef.id,
            title: this.sectionDef.title,
            icon: this.sectionDef.icon,
            expanded: this.sectionDef.default_expanded,
            onToggle: (isExpanded) => this.onToggle(isExpanded)
        });

        // Add description if present
        if (this.sectionDef.description) {
            const description = document.createElement('div');
            description.className = 'section-description';
            description.textContent = this.sectionDef.description;
            this.accordion.appendChild(description);
        }

        // Create parameter controls and add to accordion
        this.renderParameters();
    }

    /**
     * Render all parameters for this section
     */
    renderParameters() {
        const currentMode = this.currentParams.instrument_family || 'VIOLIN';

        // Iterate through parameter names in the order specified by section
        for (const paramName of this.sectionDef.parameter_names) {
            const param = this.parameters[paramName];
            if (!param) {
                console.warn(`Parameter '${paramName}' not found in metadata`);
                continue;
            }

            // Check visibility
            const isVisible = checkParameterVisibility(param, this.currentParams);

            // Check if it's an output in this mode
            const isOutput = isParameterOutput(param, currentMode);

            // Create the control using existing system
            const control = createParameterControl(paramName, param, isOutput, this.callbacks);

            // Set initial visibility
            if (!isVisible) {
                control.style.display = 'none';
            }

            // Add to accordion content
            this.accordion.appendChild(control);
        }
    }

    /**
     * Update parameter visibility based on current values
     * @param {Object} currentParams - Updated parameter values
     */
    updateVisibility(currentParams) {
        this.currentParams = currentParams;
        const currentMode = currentParams.instrument_family || 'VIOLIN';

        // Update visibility for each parameter in this section
        for (const paramName of this.sectionDef.parameter_names) {
            const param = this.parameters[paramName];
            if (!param) continue;

            const group = this.accordion.getContentElement()
                .querySelector(`.param-group[data-param-name="${paramName}"]`);

            if (!group) continue;

            // Check visibility
            const isVisible = checkParameterVisibility(param, currentParams);
            group.style.display = isVisible ? '' : 'none';

            // Update output status if visible
            if (isVisible) {
                const isOutput = isParameterOutput(param, currentMode);
                const input = document.getElementById(paramName);
                if (input) {
                    input.readOnly = isOutput;
                    input.classList.toggle('readonly-output', isOutput);
                    group.classList.toggle('param-output', isOutput);
                }
            }
        }
    }

    /**
     * Called when accordion is toggled
     * @param {boolean} isExpanded - New expanded state
     */
    onToggle(isExpanded) {
        // Optional: Add custom behavior when section is expanded/collapsed
        // e.g., analytics, lazy loading of complex controls, etc.
    }

    /**
     * Get the root DOM element
     * @returns {HTMLElement} The section container
     */
    getElement() {
        return this.accordion.getElement();
    }

    /**
     * Get the accordion instance
     * @returns {Accordion} The accordion
     */
    getAccordion() {
        return this.accordion;
    }

    /**
     * Check if this section is currently expanded
     * @returns {boolean} True if expanded
     */
    isExpanded() {
        return this.accordion.isExpanded();
    }

    /**
     * Set expanded state
     * @param {boolean} expanded - True to expand, false to collapse
     */
    setExpanded(expanded) {
        this.accordion.setExpanded(expanded);
    }
}
