"""
File loading utilities for the Azure Local Network Switch Config Generator.

Provides path resolution (PyInstaller-aware), JSON loading, and Jinja2
template loading.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

logger = logging.getLogger(__name__)


def get_real_path(relative_path: Path) -> Path:
    """Resolve *relative_path* whether running as a script or inside a
    PyInstaller bundle.

    When frozen (``sys.frozen``), paths are relative to ``sys._MEIPASS``.
    Otherwise they are resolved against the current working directory.
    """
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / relative_path  # type: ignore[attr-defined]
    return relative_path.resolve()


def load_input_json(filepath: str | Path) -> dict:
    """Load and parse a JSON file.

    Raises
    ------
    FileNotFoundError
        If *filepath* does not exist.
    ValueError
        If the file cannot be decoded as JSON.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {path}")

    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse JSON ({path}): {exc}") from exc

    logger.debug("Loaded JSON from %s (keys: %s)", path, list(data.keys()) if isinstance(data, dict) else "N/A")
    return data


def load_template(template_dir: str | Path, template_file: str):
    """Load a single Jinja2 template from *template_dir*.

    The directory is resolved via :func:`get_real_path` so that templates
    bundled inside a PyInstaller executable are found correctly.
    """
    real_dir = get_real_path(Path(template_dir))
    env = Environment(loader=FileSystemLoader(str(real_dir)))
    return env.get_template(template_file)
