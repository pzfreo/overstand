"""
Overstand - View Generator

This module handles the generation of HTML-based views like fret position tables.
"""

from typing import Dict, Any
from geometry_engine import calculate_fret_positions
from parameter_registry import InstrumentFamily

def generate_fret_positions_view(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generate fret positions data for display."""
    vsl = params.get('vsl') or 0
    instrument_family = params.get('instrument_family') or InstrumentFamily.VIOLIN.name

    if params.get('no_frets') is not None:
        no_frets = params.get('no_frets')
    elif instrument_family == InstrumentFamily.VIOL.name:
        no_frets = 7
    elif instrument_family == InstrumentFamily.GUITAR_MANDOLIN.name:
        no_frets = 20
    else:
        no_frets = 0

    if no_frets == 0:
        return {'available': False, 'message': 'Fret positions not applicable for violin family'}

    fret_positions = calculate_fret_positions(vsl, no_frets)

    html = '<div class="fret-table-container">'
    html += '<table class="fret-table">'
    html += '<thead><tr><th>Fret</th><th>Distance from Nut (mm)</th><th>Distance from Previous Fret (mm)</th></tr></thead>'
    html += '<tbody>'

    prev_pos = 0
    for i, pos in enumerate(fret_positions):
        fret_num = i + 1
        from_nut = pos
        from_prev = pos - prev_pos
        html += f'<tr><td>{fret_num}</td><td>{from_nut:.1f}</td><td>{from_prev:.1f}</td></tr>'
        prev_pos = pos

    html += '</tbody></table></div>'

    return {
        'available': True,
        'html': html,
        'vsl': vsl,
        'no_frets': no_frets
    }
