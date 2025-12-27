"""
Metadata definitions for derived/calculated values.

This module defines what derived values should be displayed in the UI,
how they should be formatted, and how they're organized.
"""

from dataclasses import dataclass
from typing import Dict
from enum import Enum


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
# DERIVED VALUE METADATA REGISTRY
# ============================================

DERIVED_VALUE_METADATA: Dict[str, DerivedValueMetadata] = {
    # User-facing geometry values (visible=True)
    'Neck Angle': DerivedValueMetadata(
        key='Neck Angle',
        display_name='Neck Angle',
        unit='°',
        decimals=1,
        visible=True,
        category=DerivedValueCategory.GEOMETRY,
        description='Angle of the neck relative to the body (measured from horizontal)',
        order=1
    ),

    'String Length': DerivedValueMetadata(
        key='String Length',
        display_name='String Length',
        unit='mm',
        decimals=1,
        visible=True,
        category=DerivedValueCategory.GEOMETRY,
        description='Playing length from nut to bridge',
        order=2
    ),

    'Neck Stop': DerivedValueMetadata(
        key='Neck Stop',
        display_name='Neck Stop',
        unit='mm',
        decimals=1,
        visible=True,
        category=DerivedValueCategory.GEOMETRY,
        description='Horizontal distance from body join to nut',
        order=3
    ),

    'Body Stop': DerivedValueMetadata(
        key='Body Stop',
        display_name='Body Stop',
        unit='mm',
        decimals=1,
        visible=True,
        category=DerivedValueCategory.GEOMETRY,
        description='Horizontal distance from body join to bridge',
        order=4
    ),

    'Nut Relative to Ribs': DerivedValueMetadata(
        key='Nut Relative to Ribs',
        display_name='Nut Relative to Ribs',
        unit='mm',
        decimals=1,
        visible=True,
        category=DerivedValueCategory.GEOMETRY,
        description='Vertical distance from rib plane to top of nut',
        order=5
    ),

    # Internal calculation values (visible=False)
    'Neck Angle (rad)': DerivedValueMetadata(
        key='Neck Angle (rad)',
        display_name='Neck Angle (rad)',
        unit='rad',
        decimals=4,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Neck angle in radians (for internal calculations)',
        order=100
    ),

    'Neck End X': DerivedValueMetadata(
        key='Neck End X',
        display_name='Neck End X',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='X coordinate of neck end point (for geometry)',
        order=101
    ),

    'Neck End Y': DerivedValueMetadata(
        key='Neck End Y',
        display_name='Neck End Y',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Y coordinate of neck end point (for geometry)',
        order=102
    ),

    'Nut Draw Radius': DerivedValueMetadata(
        key='Nut Draw Radius',
        display_name='Nut Draw Radius',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Radius of nut quarter-circle (for drawing)',
        order=103
    ),

    'Neck Line Angle': DerivedValueMetadata(
        key='Neck Line Angle',
        display_name='Neck Line Angle',
        unit='rad',
        decimals=4,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Angle of neck center line (for geometry)',
        order=104
    ),

    'Nut Top X': DerivedValueMetadata(
        key='Nut Top X',
        display_name='Nut Top X',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='X coordinate of nut top where string contacts',
        order=105
    ),

    'Nut Top Y': DerivedValueMetadata(
        key='Nut Top Y',
        display_name='Nut Top Y',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Y coordinate of nut top where string contacts',
        order=106
    ),

    'Bridge Top X': DerivedValueMetadata(
        key='Bridge Top X',
        display_name='Bridge Top X',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='X coordinate of bridge top (for geometry)',
        order=107
    ),

    'Bridge Top Y': DerivedValueMetadata(
        key='Bridge Top Y',
        display_name='Bridge Top Y',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Y coordinate of bridge top (for geometry)',
        order=108
    ),

    'Fingerboard Direction Angle': DerivedValueMetadata(
        key='Fingerboard Direction Angle',
        display_name='Fingerboard Direction Angle',
        unit='rad',
        decimals=4,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Direction angle of fingerboard surface (for geometry)',
        order=109
    ),

    'Fingerboard Bottom End X': DerivedValueMetadata(
        key='Fingerboard Bottom End X',
        display_name='Fingerboard Bottom End X',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='X coordinate of fingerboard end (for drawing)',
        order=110
    ),

    'Fingerboard Bottom End Y': DerivedValueMetadata(
        key='Fingerboard Bottom End Y',
        display_name='Fingerboard Bottom End Y',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Y coordinate of fingerboard end (for drawing)',
        order=111
    ),

    'Fingerboard Thickness at End': DerivedValueMetadata(
        key='Fingerboard Thickness at End',
        display_name='Fingerboard Thickness at End',
        unit='mm',
        decimals=2,
        visible=False,
        category=DerivedValueCategory.INTERNAL,
        description='Fingerboard thickness at the extended end (for drawing)',
        order=112
    ),
}


def get_all_metadata_as_dict() -> dict:
    """Get all metadata as a JSON-serializable dictionary"""
    return {k: v.to_dict() for k, v in DERIVED_VALUE_METADATA.items()}
