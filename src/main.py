"""CLI entry point for the Azure Local Network Switch Config Generator."""

from __future__ import annotations

import argparse
import logging
import shutil
import sys
from pathlib import Path

from .generator import generate_config
from .loader import get_real_path, load_input_json

logger = logging.getLogger(__name__)


# ── CLI helpers ───────────────────────────────────────────────────────────

def _configure_logging(debug: bool = False) -> None:
    """Set up root logger with a readable format."""
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(levelname)-7s %(message)s",
        force=True,
    )


def _safe_print(text: str) -> None:
    """Print with a fallback for consoles that cannot render Unicode."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode("ascii"))


def _configure_windows_console() -> None:
    """Enable UTF-8 output on Windows consoles."""
    if sys.platform != "win32":
        return
    try:
        import os
        os.system("chcp 65001 > nul 2>&1")
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


# ── convertor loading ─────────────────────────────────────────────────────

def load_convertor(convertor_name: str):
    """Load a convertor function from the static registry.

    Raises
    ------
    ValueError
        If *convertor_name* is not registered.
    """
    from .convertors import CONVERTORS

    if convertor_name in CONVERTORS:
        return CONVERTORS[convertor_name]

    available = ", ".join(CONVERTORS.keys())
    raise ValueError(
        f"Unknown convertor '{convertor_name}'.\nAvailable: {available}"
    )


# ── format detection ─────────────────────────────────────────────────────

def is_standard_format(data: dict) -> bool:
    """Return True when *data* looks like a per-switch standard JSON."""
    if not isinstance(data, dict):
        return False
    standard_keys = {"switch", "vlans", "interfaces"}
    lab_keys = {"Version", "Description", "InputData"}
    return bool(standard_keys & data.keys()) and not bool(lab_keys & data.keys())


# ── conversion pipeline ──────────────────────────────────────────────────

def convert_to_standard_format(
    input_file_path: Path,
    output_dir: str,
    convertor_module_path: str,
    *,
    debug: bool = False,
) -> list[Path]:
    """Run the lab→standard converter and return generated file paths."""
    _safe_print("Converting from lab format to standard format...")
    _safe_print(f"Using convertor: {convertor_module_path}")

    data = load_input_json(str(input_file_path))

    convert_function = load_convertor(convertor_module_path)

    # Pass debug flag if the converter supports it
    import inspect
    sig = inspect.signature(convert_function)
    if "debug" in sig.parameters:
        convert_function(data, output_dir, debug=debug)
    else:
        convert_function(data, output_dir)

    generated_files = list(Path(output_dir).glob("*.json"))
    if not generated_files:
        raise RuntimeError("No standard format files were generated during conversion")

    _safe_print(f"Generated {len(generated_files)} standard format file(s):")
    for f in generated_files:
        _safe_print(f"   - {f}")
    return generated_files


# ── main ──────────────────────────────────────────────────────────────────

def main() -> None:
    _configure_windows_console()

    parser = argparse.ArgumentParser(
        epilog="""\
Examples:
  %(prog)s --input_json input/standard_input.json --output_folder output/
  %(prog)s --input_json my_lab_input.json --output_folder configs/ --convertor lab
""",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input_json", required=True,
                        help="Path to input JSON file (lab or standard format)")
    parser.add_argument("--template_folder", default="input/jinja2_templates",
                        help="Folder containing Jinja2 templates (default: %(default)s)")
    parser.add_argument("--output_folder", default=None,
                        help="Directory to save generated configs (default: same as input file)")
    parser.add_argument("--convertor", default="convertors.convertors_lab_switch_json",
                        help="Convertor to use for lab format (default: %(default)s)")
    parser.add_argument("--debug", action="store_true",
                        help="Include debug data (vlan_map, ip_map) in converted JSON output")
    args = parser.parse_args()

    _configure_logging(debug=args.debug)

    # ── resolve paths ────────────────────────────────────────────────────
    input_json_path = Path(args.input_json).resolve()
    output_folder_path = (
        input_json_path.parent
        if args.output_folder is None
        else Path(args.output_folder).resolve()
    )
    template_folder_arg = Path(args.template_folder)
    template_folder = (
        get_real_path(template_folder_arg)
        if args.template_folder == parser.get_default("template_folder")
        else template_folder_arg.resolve()
    )

    _safe_print(f"Input JSON:     {input_json_path}")
    _safe_print(f"Template folder: {template_folder}")
    _safe_print(f"Output dir:     {output_folder_path}")
    if args.convertor != parser.get_default("convertor"):
        _safe_print(f"Custom convertor: {args.convertor}")
    if args.debug:
        _safe_print("Debug mode:     ON")

    # ── validate ─────────────────────────────────────────────────────────
    if not input_json_path.exists():
        logger.error("Input file not found: %s", input_json_path)
        sys.exit(1)
    if not template_folder.exists():
        logger.error("Template folder not found: %s", template_folder)
        sys.exit(1)
    output_folder_path.mkdir(parents=True, exist_ok=True)

    # ── step 1: format detection / conversion ────────────────────────────
    _safe_print("Checking input format...")
    data = load_input_json(str(input_json_path))

    standard_format_files: list[Path] = []
    conversion_used = False

    if is_standard_format(data):
        _safe_print("Input is already in standard format")
        standard_format_files = [input_json_path]
    else:
        _safe_print("Input is in lab format — conversion required")
        conversion_used = True
        try:
            temp_dir = output_folder_path / ".temp_conversion"
            temp_dir.mkdir(parents=True, exist_ok=True)
            standard_format_files = convert_to_standard_format(
                input_json_path, str(temp_dir), args.convertor, debug=args.debug,
            )
        except Exception as exc:
            _safe_print(f"Failed to convert to standard format: {exc}")
            _print_conversion_guidance(str(exc), args.convertor)
            sys.exit(1)

    # ── step 2: generate configs ─────────────────────────────────────────
    _safe_print(f"\nGenerating configs for {len(standard_format_files)} switch(es)...")

    total_success = 0
    total_failed = 0

    for std_file in standard_format_files:
        _safe_print(f"\nProcessing: {std_file.name}")
        try:
            switch_output_dir = output_folder_path / std_file.stem
            switch_output_dir.mkdir(parents=True, exist_ok=True)

            if conversion_used:
                std_copy = switch_output_dir / f"std_{std_file.name}"
                shutil.copy2(std_file, std_copy)
                _safe_print(f"Standard JSON saved: {std_copy.name}")

            generate_config(
                input_std_json=str(std_file),
                template_folder=str(template_folder),
                output_folder=str(switch_output_dir),
            )
            total_success += 1
            _safe_print(f"Generated configs for {std_file.name} in {switch_output_dir}")
        except Exception as exc:
            _safe_print(f"Failed to generate configs for {std_file.name}: {exc}")
            total_failed += 1

    # ── cleanup ──────────────────────────────────────────────────────────
    if conversion_used:
        temp_dir = output_folder_path / ".temp_conversion"
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)

    # ── summary ──────────────────────────────────────────────────────────
    _safe_print(f"\nSummary:")
    _safe_print(f"   Successfully processed: {total_success} switch(es)")
    if total_failed:
        _safe_print(f"   Failed: {total_failed} switch(es)")
    _safe_print(f"   Output directory: {output_folder_path}")

    if total_failed:
        sys.exit(1)
    _safe_print("All configs generated successfully!")


def _print_conversion_guidance(error_msg: str, convertor: str) -> None:
    """Print contextual troubleshooting hints after a conversion failure."""
    if "Required VLAN set(s) missing" in error_msg:
        _safe_print("\nAction Required:")
        _safe_print("   1. Open the input JSON.")
        _safe_print("   2. Under 'Supernets', add entries so these symbolic VLAN sets exist:")
        _safe_print("      - Infrastructure (M): GroupName starting 'Infrastructure'.")
        _safe_print("      - Tenant/Compute (C): GroupName starting 'Tenant', 'L3Forward', or 'HNVPA'.")
        _safe_print("      - (Optional) Storage (S): GroupName starting 'Storage'.")
        _safe_print("   3. Re-run the command.")
    else:
        _safe_print(f"\nConfirm the input JSON matches the lab schema for convertor '{convertor}'.")


if __name__ == "__main__":
    main()
