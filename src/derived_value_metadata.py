"""
Metadata definitions for derived/calculated values.

This module defines what derived values should be displayed in the UI,
how they should be formatted, and how they're organized.

NOTE: This file now generates metadata from parameter_registry.py
to eliminate duplication and ensure consistency.
"""

from dataclasses import dataclass
from typing import Dict
from enum import Enum

# Import from unified parameter registry
from parameter_registry import PARAMETER_REGISTRY, ParameterRole


class DerivedValueCategory(Enum):
    """Categories for grouping derived values"""
    GEOMETRY = "Geometry"
    INTERNAL = "Internal"


@dataclass
class DerivedValueMetadata:
    """Metadata for a single derived value"""
    key: str                           # Internal key (e.g., 'Neck Angle')
    display_name: str                  # Human-readable name
    unit: str                          # Unit string (e.g., '°', 'mm', 'rad')
    decimals: int                      # Number of decimal places for display
    visible: bool                      # Whether to show in UI by default
    category: DerivedValueCategory     # Grouping category
    description: str                   # Tooltip/help text
    order: int = 0                     # Display order within category

    def format_value(self, value: float) -> str:
        """Format a numeric value according to this metadata"""
        return f"{value:.{self.decimals}f}"

    def format_with_unit(self, value: float) -> str:
        """Format value with unit"""
        formatted = self.format_value(value)
        if self.unit:
            return f"{formatted} {self.unit}"
        return formatted

    def to_dict(self) -> dict:
        """Convert to JSON-serializable dict"""
        return {
            'key': self.key,
            'display_name': self.display_name,
            'unit': self.unit,
            'decimals': self.decimals,
            'visible': self.visible,
            'category': self.category.value,
            'description': self.description,
            'order': self.order
        }


# ============================================
# DERIVED VALUE METADATA - GENERATED FROM REGISTRY
# ============================================

def _generate_derived_value_metadata():
    """
    Generate DERIVED_VALUE_METADATA from the unified parameter registry.

    This creates backward-compatible DerivedValueMetadata objects from
    the registry's output configurations, using snake_case keys.
    """
    metadata = {}

    for key, unified in PARAMETER_REGISTRY.items():
        # Skip input-only parameters (those without output config)
        if unified.output_config is None:
            continue

        # Get output metadata dict from unified parameter
        output_meta = unified.to_output_metadata()

        # Map category string to enum
        category = (DerivedValueCategory.GEOMETRY
                   if output_meta['category'] == 'Geometry'
                   else DerivedValueCategory.INTERNAL)

        # Create DerivedValueMetadata object using snake_case key
        metadata[key] = DerivedValueMetadata(
            key=key,  # Now using snake_case
            display_name=output_meta['display_name'],
            unit=output_meta['unit'],
            decimals=output_meta['decimals'],
            visible=output_meta['visible'],
            category=category,
            description=output_meta['description'],
            order=output_meta['order']
        )

    return metadata


# Generate DERIVED_VALUE_METADATA from registry
DERIVED_VALUE_METADATA: Dict[str, DerivedValueMetadata] = _generate_derived_value_metadata()


def get_all_metadata_as_dict() -> dict:
    """Get all metadata as a JSON-serializable dictionary"""
    return {k: v.to_dict() for k, v in DERIVED_VALUE_METADATA.items()}
