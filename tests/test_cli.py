"""
Tests for the CLI (overstand-cli).
"""
import pytest
import subprocess
import sys
import json
from pathlib import Path
import importlib.util
import types

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))


def load_cli_module():
    """Load the CLI module from the script file without .py extension."""
    cli_script = Path(__file__).parent.parent / 'src' / 'overstand-cli'

    # Read the script content and execute it as a module
    spec = importlib.util.spec_from_loader(
        "cli",
        loader=None,
        origin=str(cli_script)
    )
    cli = types.ModuleType(spec.name)
    cli.__file__ = str(cli_script)

    # Add src to the module's path for imports
    sys.path.insert(0, str(cli_script.parent))

    with open(cli_script, 'r') as f:
        code = compile(f.read(), cli_script, 'exec')
        exec(code, cli.__dict__)

    return cli


cli = load_cli_module()


class TestLoadParameters:
    """Tests for load_parameters function."""

    def test_load_valid_json(self, simple_params_path):
        """Test loading a valid JSON file with simple parameters."""
        params = cli.load_parameters(str(simple_params_path))
        assert params['instrument_name'] == 'Simple Test'
        assert params['vsl'] == 325.0

    def test_load_json_with_metadata_wrapper(self, sample_preset_path):
        """Test loading JSON with metadata wrapper extracts parameters."""
        params = cli.load_parameters(str(sample_preset_path))
        assert params['instrument_name'] == 'Test Violin'
        assert 'metadata' not in params  # Should extract just parameters

    def test_load_file_not_found(self, tmp_path):
        """Test that missing file causes SystemExit."""
        nonexistent = tmp_path / "does_not_exist.json"
        with pytest.raises(SystemExit) as exc_info:
            cli.load_parameters(str(nonexistent))
        assert exc_info.value.code == 1

    def test_load_invalid_json(self, invalid_json_path):
        """Test that invalid JSON causes SystemExit."""
        with pytest.raises(SystemExit) as exc_info:
            cli.load_parameters(str(invalid_json_path))
        assert exc_info.value.code == 1


class TestGenerateView:
    """Tests for generate_view function."""

    def test_generate_side_view_returns_svg(self, default_violin_params):
        """Test that side view returns valid SVG."""
        result = cli.generate_view(default_violin_params, 'side')
        assert result.startswith('<svg')
        assert '</svg>' in result
        assert 'viewBox' in result

    def test_generate_dimensions_view_returns_html(self, default_violin_params):
        """Test that dimensions view returns valid HTML."""
        result = cli.generate_view(default_violin_params, 'dimensions')
        assert '<!DOCTYPE html>' in result
        assert '<table>' in result
        assert '</table>' in result

    def test_generate_top_view_placeholder(self, default_violin_params):
        """Test that top view returns placeholder SVG."""
        result = cli.generate_view(default_violin_params, 'top')
        assert '<svg>' in result
        assert 'not yet implemented' in result.lower()

    def test_generate_cross_section_view_placeholder(self, default_violin_params):
        """Test that cross_section view returns placeholder SVG."""
        result = cli.generate_view(default_violin_params, 'cross_section')
        assert '<svg>' in result
        assert 'not yet implemented' in result.lower()

    def test_generate_unknown_view_exits(self, default_violin_params):
        """Test that unknown view type causes SystemExit."""
        with pytest.raises(SystemExit) as exc_info:
            cli.generate_view(default_violin_params, 'unknown_view')
        assert exc_info.value.code == 1


class TestDimensionsView:
    """Detailed tests for the dimensions HTML view."""

    def test_dimensions_has_categories(self, default_violin_params):
        """Test that dimensions view has category headers."""
        result = cli.generate_view(default_violin_params, 'dimensions')
        assert 'General' in result
        assert 'Basic Dimensions' in result

    def test_dimensions_has_parameter_values(self, default_violin_params):
        """Test that dimensions view includes parameter values."""
        result = cli.generate_view(default_violin_params, 'dimensions')
        assert 'Vibrating String Length' in result
        assert '325' in result  # Default VSL

    def test_dimensions_has_derived_values(self, default_violin_params):
        """Test that dimensions view includes calculated values."""
        result = cli.generate_view(default_violin_params, 'dimensions')
        assert 'Calculated Values' in result

    def test_dimensions_includes_instrument_name(self, default_violin_params):
        """Test that dimensions view includes instrument name in title."""
        default_violin_params['instrument_name'] = 'My Test Violin'
        result = cli.generate_view(default_violin_params, 'dimensions')
        assert 'My Test Violin' in result


class TestSideView:
    """Tests for side view SVG generation."""

    def test_side_view_has_svg_elements(self, default_violin_params):
        """Test that side view SVG has expected elements."""
        result = cli.generate_view(default_violin_params, 'side')
        assert '<path' in result
        assert 'stroke' in result

    def test_side_view_for_viol(self, default_viol_params):
        """Test side view generation for viol parameters."""
        result = cli.generate_view(default_viol_params, 'side')
        assert result.startswith('<svg')
        assert '</svg>' in result

    def test_side_view_for_guitar(self, default_guitar_params):
        """Test side view generation for guitar parameters."""
        result = cli.generate_view(default_guitar_params, 'side')
        assert result.startswith('<svg')
        assert '</svg>' in result


class TestCLIIntegration:
    """Integration tests using subprocess to run the actual CLI."""

    def test_cli_side_view_to_stdout(self, sample_preset_path, cli_path):
        """Test CLI outputs SVG to stdout."""
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path), '--view', 'side'],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode == 0
        assert '<svg' in result.stdout
        assert '</svg>' in result.stdout

    def test_cli_side_view_to_file(self, sample_preset_path, cli_path, tmp_path):
        """Test CLI writes SVG to file."""
        output_file = tmp_path / 'output.svg'
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path),
             '--view', 'side', '--output', str(output_file)],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode == 0
        assert output_file.exists()
        content = output_file.read_text()
        assert '<svg' in content

    def test_cli_dimensions_view(self, sample_preset_path, cli_path, tmp_path):
        """Test CLI generates dimensions HTML."""
        output_file = tmp_path / 'dimensions.html'
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path),
             '--view', 'dimensions', '--output', str(output_file)],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode == 0
        assert output_file.exists()
        content = output_file.read_text()
        assert '<!DOCTYPE html>' in content

    def test_cli_all_creates_multiple_files(self, sample_preset_path, cli_path, tmp_path):
        """Test CLI --all creates SVG and HTML files (native formats)."""
        output_dir = tmp_path / 'output'
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path),
             '--all', '--output-dir', str(output_dir)],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )

        assert result.returncode == 0
        assert (output_dir / 'Test_Violin_side-view.svg').exists()
        assert (output_dir / 'Test_Violin_dimensions.html').exists()

    def test_cli_missing_view_or_all_errors(self, sample_preset_path, cli_path):
        """Test CLI errors when neither --view nor --all specified."""
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path)],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode != 0
        assert 'error' in result.stderr.lower()

    def test_cli_all_requires_output_dir(self, sample_preset_path, cli_path):
        """Test CLI --all requires --output-dir."""
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path), '--all'],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode != 0
        assert 'output-dir' in result.stderr.lower()

    def test_cli_cannot_use_both_all_and_view(self, sample_preset_path, cli_path, tmp_path):
        """Test CLI errors when both --all and --view specified."""
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path),
             '--all', '--output-dir', str(tmp_path), '--view', 'side'],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode != 0

    def test_cli_pdf_auto_filename(self, sample_preset_path, cli_path, tmp_path):
        """Test CLI --pdf auto-generates filename when --output not specified."""
        from conftest import has_cairo_deps
        if not has_cairo_deps():
            pytest.skip("Requires Cairo dependencies")

        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path), '--view', 'side', '--pdf'],
            capture_output=True,
            text=True,
            cwd=str(tmp_path)  # Run in temp dir so auto-generated file goes there
        )
        assert result.returncode == 0
        assert 'Generated:' in result.stdout
        assert 'Test_Violin_side-view.pdf' in result.stdout

    def test_cli_file_not_found(self, cli_path, tmp_path):
        """Test CLI handles missing input file."""
        nonexistent = tmp_path / 'nonexistent.json'
        result = subprocess.run(
            [sys.executable, str(cli_path), str(nonexistent), '--view', 'side'],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode != 0
        assert 'not found' in result.stderr.lower()


class TestPDFGeneration:
    """Tests for PDF generation (skip if Cairo not available)."""

    @pytest.fixture
    def requires_cairo(self):
        """Skip test if Cairo dependencies not available."""
        from conftest import has_cairo_deps
        if not has_cairo_deps():
            pytest.skip("Requires Cairo dependencies")

    def test_svg_to_pdf_creates_file(self, requires_cairo, default_violin_params, tmp_path):
        """Test svg_to_pdf creates a valid PDF file."""
        svg_content = cli.generate_view(default_violin_params, 'side')
        output_path = tmp_path / 'test.pdf'

        cli.svg_to_pdf(svg_content, str(output_path))

        assert output_path.exists()
        assert output_path.stat().st_size > 0
        # Check PDF magic bytes
        with open(output_path, 'rb') as f:
            header = f.read(4)
            assert header == b'%PDF'

    def test_cli_pdf_view(self, requires_cairo, sample_preset_path, cli_path, tmp_path):
        """Test CLI --pdf generates PDF file from side view."""
        output_file = tmp_path / 'output.pdf'
        result = subprocess.run(
            [sys.executable, str(cli_path), str(sample_preset_path),
             '--view', 'side', '--pdf', '--output', str(output_file)],
            capture_output=True,
            text=True,
            cwd=str(cli_path.parent)
        )
        assert result.returncode == 0
        assert output_file.exists()
