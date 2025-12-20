"""
Main Generator Orchestrator

This file coordinates between parameters, validation, and geometry generation.
You rarely need to modify this - it's the "glue" code.
"""

from typing import Dict, Any, List, Tuple
import json


def generate_violin_neck(params_json: str) -> str:
    """
    Main entry point called from JavaScript.

    Args:
        params_json: JSON string of parameter values

    Returns:
        JSON string containing:
        {
            "success": bool,
            "views": {
                "side": str,
                "top": str,
                "cross_section": str
            } | null,
            "errors": List[str]
        }
    """
    try:
        # Parse parameters
        params = json.loads(params_json)

        # Import here to ensure modules are loaded
        from instrument_parameters import validate_parameters
        from instrument_geometry import generate_multi_view_svg

        # Validate parameters
        is_valid, errors = validate_parameters(params)

        if not is_valid:
            return json.dumps({
                "success": False,
                "views": None,
                "errors": errors
            })

        # Generate geometry (all 3 views)
        try:
            views = generate_multi_view_svg(params)

            return json.dumps({
                "success": True,
                "views": views,
                "errors": []
            })

        except Exception as e:
            return json.dumps({
                "success": False,
                "views": None,
                "errors": [f"Geometry generation failed: {str(e)}"]
            })

    except json.JSONDecodeError as e:
        return json.dumps({
            "success": False,
            "views": None,
            "errors": [f"Invalid parameter JSON: {str(e)}"]
        })
    except Exception as e:
        return json.dumps({
            "success": False,
            "views": None,
            "errors": [f"Unexpected error: {str(e)}"]
        })


def get_parameter_definitions() -> str:
    """
    Get parameter definitions for UI generation.
    
    Returns:
        JSON string of parameter definitions
    """
    try:
        from instrument_parameters import get_parameters_as_json
        return get_parameters_as_json()
    except Exception as e:
        return json.dumps({
            "error": f"Failed to load parameters: {str(e)}"
        })


def get_presets() -> str:
    """
    Get available parameter presets.
    
    Returns:
        JSON string of presets
    """
    try:
        from instrument_parameters import PRESETS
        return json.dumps(PRESETS)
    except Exception as e:
        return json.dumps({
            "error": f"Failed to load presets: {str(e)}"
        })


if __name__ == '__main__':
    # Test the generator
    from instrument_parameters import get_default_values
    import json
    
    print("Testing violin neck generator...")
    print("=" * 50)
    
    # Get defaults
    defaults = get_default_values()
    params_json = json.dumps(defaults)
    
    print("\n1. Testing parameter definitions...")
    param_defs = get_parameter_definitions()
    print(f"✓ Loaded {len(json.loads(param_defs)['parameters'])} parameters")
    
    print("\n2. Testing generation...")
    result = generate_violin_neck(params_json)
    result_data = json.loads(result)

    if result_data['success']:
        print(f"✓ Generation successful!")
        views = result_data['views']
        print(f"  Side view: {len(views['side'])} bytes")
        print(f"  Top view: {len(views['top'])} bytes")
        print(f"  Cross-section: {len(views['cross_section'])} bytes")
    else:
        print(f"✗ Generation failed:")
        for error in result_data['errors']:
            print(f"  - {error}")
    
    print("\n3. Testing presets...")
    presets = get_presets()
    preset_data = json.loads(presets)
    print(f"✓ Loaded {len(preset_data)} presets")
    
    print("\n" + "=" * 50)
    print("All tests complete!")
