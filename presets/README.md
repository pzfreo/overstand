# Instrument Presets

This directory contains standard instrument preset definitions as JSON files.

## File Format

Each preset file uses the same format as the save/load functionality:

```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2026-01-02T00:00:00Z",
    "description": "Standard violin dimensions based on Stradivari models",
    "preset_id": "violin",
    "display_name": "Violin",
    "family": "VIOLIN",
    "icon": "🎻"
  },
  "parameters": {
    "instrument_family": "VIOLIN",
    "vsl": 325.0,
    "body_length": 355.0,
    "body_stop": 195.0,
    "overstand": 12.0,
    "bridge_height": 33.0,
    "arching_height": 15.0,
    "fingerboard_radius": 42.0,
    "fingerboard_width_at_nut": 24.0,
    "fingerboard_width_at_end": 30.0,
    ...
  }
}
```

## Managing Presets

### Method 1: Edit CSV and Export (Recommended)

The easiest way to manage all presets at once:

1. **Edit the master CSV** at the repo root:
   ```bash
   # Open in your spreadsheet editor
   open instrument_presets_full.csv
   ```

2. **Make your changes** (add rows, edit values, etc.)

3. **Export to JSON files**:
   ```bash
   python3 scripts/export_presets_to_json.py
   ```

   This will:
   - Create/update JSON files in `presets/`
   - Update `presets.json` manifest

4. **Test your changes** - reload the app and select the preset

### Method 2: Edit JSON Directly

For quick edits to a single preset:

1. **Edit the JSON file** directly (e.g., `violin.json`)

2. **Test** - reload the app and select the preset

3. **Optional**: Update the CSV to keep it in sync

### Method 3: Save from UI

The easiest way to create a new preset:

1. **Configure parameters** in the UI exactly how you want them

2. **Save parameters** using the save button - this creates a JSON file

3. **Move/rename** the file:
   ```bash
   mv ~/Downloads/my_instrument_params_*.json presets/my_new_preset.json
   ```

4. **Edit metadata** in the JSON file:
   - Update `preset_id`, `display_name`, `family`, `icon`, `description`

5. **Add to manifest** (optional - files auto-discovered):
   ```bash
   # Edit presets/presets.json and add filename to "presets" array
   ```

6. **Update CSV** for future management (optional):
   - Add a row to `instrument_presets_full.csv`

## Parameter Reference

### Basic Parameters
- `instrument_family`: "VIOLIN", "VIOL", or "GUITAR_MANDOLIN"
- `vsl`: Vibrating string length (mm)
- `body_length`: Total body length (mm)
- `body_stop`: Distance from neck/body join to bridge (mm) [VIOLIN/VIOL only]
- `overstand`: Bridge top above body edge (mm)
- `bridge_height`: Bridge height (mm)
- `arching_height`: Body arching height (mm)

### Advanced Geometry
- `neck_stop`: Nut to neck/body join (mm) [calculated for VIOLIN/VIOL]
- `fingerboard_length`: Total fingerboard length (mm)
- `rib_height`: Body rib height (mm)
- `belly_edge_thickness`: Top plate edge thickness (mm)
- `fingerboard_radius`: Fingerboard radius (mm)

### Fingerboard Details
- `fingerboard_width_at_nut`: Fingerboard width at nut (mm)
- `fingerboard_width_at_end`: Fingerboard width at end (mm)
- `fb_visible_height_at_nut`: Visible fingerboard height at nut (mm)
- `fb_visible_height_at_join`: Visible fingerboard height at neck join (mm)
- `string_height_nut`: String height above fingerboard at nut (mm)
- `string_height_eof`: String height at end of fingerboard (mm)
- `string_height_12th_fret`: String height at 12th fret (mm)

### Fret Configuration
- `no_frets`: Number of frets (for fretted instruments)
- `fret_join`: Fret number at neck/body join [GUITAR_MANDOLIN only]

### Display
- `instrument_name`: Custom instrument name
- `show_measurements`: Show measurements on diagram (true/false)

## Adding New Instrument Types

To add a new standard instrument:

1. **Add to CSV**: Add a new row in `instrument_presets_full.csv`
2. **Set all parameters**: Fill in appropriate values for the instrument type
3. **Set metadata**:
   - `preset_id`: lowercase_with_underscores
   - `display_name`: Display Name
   - `family`: VIOLIN, VIOL, or GUITAR_MANDOLIN
   - `icon`: Appropriate emoji (🎻, 🎸, etc.)
   - `description`: Brief description of the instrument

4. **Export**: Run `python3 scripts/export_presets_to_json.py`
5. **Test**: Reload app and verify the new preset appears and works

## Removing Presets

To remove a standard instrument:

1. **Delete the JSON file** from `presets/`
2. **Remove from manifest** (if using presets.json)
3. **Remove from CSV** (if keeping CSV in sync)

The preset will no longer appear in the dropdown.
