/**
 * Output Section Component
 *
 * Renders a collapsible section containing derived/calculated values.
 * Displays read-only outputs from the calculation engine.
 *
 * Usage:
 *   const section = new OutputSection({
 *     sectionDef: sectionMetadata,          // From ui_metadata.py
 *     derivedValues: derivedValueMetadata,  // Metadata for formatting
 *     calculatedValues: { 'Neck Angle': 5.2, ... }  // Current calculated values
 *   });
 *
 *   container.appendChild(section.getElement());
 *   // Later, when values update:
 *   section.updateValues(newCalculatedValues);
 */

import { Accordion } from './accordion.js';

export class OutputSection {
    /**
     * Create an output section
     * @param {Object} config - Configuration object
     * @param {Object} config.sectionDef - Section definition from ui_metadata
     * @param {Object} config.derivedValues - Derived value metadata (DERIVED_VALUE_METADATA)
     * @param {Object} config.calculatedValues - Current calculated values
     */
    constructor(config) {
        this.sectionDef = config.sectionDef;
        this.derivedValues = config.derivedValues;
        this.calculatedValues = config.calculatedValues || {};

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

        // Create output value displays and add to accordion
        this.renderOutputs();
    }

    /**
     * Render all output values for this section
     */
    renderOutputs() {
        // Iterate through parameter names (which are derived value keys for output sections)
        for (const valueName of this.sectionDef.parameter_names) {
            const valueMeta = this.derivedValues[valueName];
            if (!valueMeta) {
                console.warn(`Derived value '${valueName}' not found in metadata`);
                continue;
            }

            // Create output display element
            const outputGroup = this.createOutputDisplay(valueName, valueMeta);
            this.accordion.appendChild(outputGroup);
        }
    }

    /**
     * Create a display element for a single output value
     * @param {string} valueName - Name/key of the derived value
     * @param {Object} valueMeta - Metadata for formatting
     * @returns {HTMLElement} The output display group
     */
    createOutputDisplay(valueName, valueMeta) {
        const group = document.createElement('div');
        group.className = 'output-group';
        group.dataset.valueName = valueName;

        // Label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'output-label';

        const label = document.createElement('label');
        label.textContent = valueMeta.display_name;
        labelDiv.appendChild(label);

        // Unit display (if present)
        if (valueMeta.unit) {
            const unit = document.createElement('span');
            unit.className = 'output-unit';
            unit.textContent = valueMeta.unit;
            labelDiv.appendChild(unit);
        }

        group.appendChild(labelDiv);

        // Value display
        const valueDiv = document.createElement('div');
        valueDiv.className = 'output-value';
        valueDiv.dataset.valueName = valueName;

        // Format and display current value
        const currentValue = this.calculatedValues[valueName];
        if (currentValue !== undefined && currentValue !== null) {
            valueDiv.textContent = this.formatValue(currentValue, valueMeta);
        } else {
            valueDiv.textContent = '—'; // Em dash for missing values
        }

        group.appendChild(valueDiv);

        // Description/tooltip (if present)
        if (valueMeta.description) {
            const desc = document.createElement('div');
            desc.className = 'output-description';
            desc.textContent = valueMeta.description;
            group.appendChild(desc);
        }

        return group;
    }

    /**
     * Format a value according to its metadata
     * @param {number} value - The numeric value to format
     * @param {Object} valueMeta - Metadata containing formatting info
     * @returns {string} Formatted value
     */
    formatValue(value, valueMeta) {
        if (value === null || value === undefined) {
            return '—';
        }

        // Format to specified decimal places
        const decimals = valueMeta.decimals || 2;
        return value.toFixed(decimals);
    }

    /**
     * Update displayed values
     * @param {Object} calculatedValues - New calculated values
     */
    updateValues(calculatedValues) {
        this.calculatedValues = calculatedValues;

        // Update each output value display
        for (const valueName of this.sectionDef.parameter_names) {
            const valueMeta = this.derivedValues[valueName];
            if (!valueMeta) continue;

            const valueDiv = this.accordion.getContentElement()
                .querySelector(`.output-value[data-value-name="${valueName}"]`);

            if (!valueDiv) continue;

            // Update the displayed value
            const currentValue = calculatedValues[valueName];
            if (currentValue !== undefined && currentValue !== null) {
                valueDiv.textContent = this.formatValue(currentValue, valueMeta);
            } else {
                valueDiv.textContent = '—';
            }
        }
    }

    /**
     * Called when accordion is toggled
     * @param {boolean} isExpanded - New expanded state
     */
    onToggle(isExpanded) {
        // Optional: Add custom behavior when section is expanded/collapsed
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
