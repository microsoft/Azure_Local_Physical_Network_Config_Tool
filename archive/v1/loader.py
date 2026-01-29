import json
import os
from pathlib import Path
import sys
from jinja2 import Environment, FileSystemLoader

def get_real_path(relative_path: Path) -> Path:
    """
    Resolve the actual path whether running as script or bundled by PyInstaller.
    """
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS) / relative_path
    return relative_path.resolve()

def load_input_json(filepath, verbose=False):
    """
    Load and parse a JSON file safely.
    """
    if not os.path.exists(filepath):
        print(f"[ERROR] File not found: {filepath}")
        return None

    try:
        with open(filepath, "r", encoding="utf-8") as file:
            data = json.load(file)
            if verbose:
                print(f"[✓] Loaded JSON from: {filepath}")
                if isinstance(data, dict):
                    print(f"     Top-level keys: {list(data.keys())}")
            return data
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse JSON ({filepath}): {e}")
        return None
    except Exception as e:
        print(f"[ERROR] Unexpected error while loading {filepath}: {e}")
        return None

def pretty_print_json(data, output_path):
    """
    Pretty-print JSON data to a file.
    """
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[✓] Pretty-printed JSON saved to: {output_path}")
    except Exception as e:
        print(f"[ERROR] Failed to write pretty JSON: {e}")

def load_template(template_dir, template_file):
    """
    Load a Jinja2 template from a folder (safe for PyInstaller).
    """
    real_template_dir = get_real_path(Path(template_dir))
    env = Environment(loader=FileSystemLoader(str(real_template_dir)))
    return env.get_template(template_file)
