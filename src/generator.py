"""
Config generator — renders Jinja2 templates against a standard-format JSON.
"""

from __future__ import annotations

import logging
from pathlib import Path

from .loader import load_input_json, load_template

logger = logging.getLogger(__name__)


def generate_config(
    input_std_json: str | Path,
    template_folder: str | Path,
    output_folder: str | Path,
) -> None:
    """Render every ``.j2`` template in the vendor/firmware subfolder.

    Parameters
    ----------
    input_std_json:
        Path to a standard-format JSON file (one switch).
    template_folder:
        Root folder containing ``<make>/<firmware>/*.j2`` templates.
    output_folder:
        Directory where ``generated_<stem>.cfg`` files are written.

    Raises
    ------
    FileNotFoundError
        If the input JSON, template folder, or vendor subfolder is missing.
    ValueError
        If required switch metadata is absent or JSON cannot be parsed.
    RuntimeError
        If a template fails to render.
    """
    input_path = Path(input_std_json).resolve()
    template_root = Path(template_folder)
    output_path = Path(output_folder).resolve()

    if not input_path.exists():
        raise FileNotFoundError(f"Input JSON not found: {input_path}")

    data = load_input_json(input_path)

    # Extract vendor routing info
    try:
        make = data["switch"]["make"].lower()
        firmware = data["switch"]["firmware"].lower()
    except KeyError as exc:
        raise ValueError(f"Missing expected switch metadata key: {exc}") from exc

    template_dir = template_root / make / firmware
    logger.info("Looking for templates in: %s", template_dir)
    if not template_dir.exists():
        raise FileNotFoundError(f"Template path not found: {template_dir}")

    template_files = sorted(template_dir.glob("*.j2"))
    if not template_files:
        raise FileNotFoundError(f"No .j2 templates found in: {template_dir}")

    logger.info("Rendering %d template(s)", len(template_files))

    output_path.mkdir(parents=True, exist_ok=True)

    for tpl_path in template_files:
        template = load_template(str(template_dir), tpl_path.name)
        rendered = template.render(data)

        if not rendered.strip():
            logger.debug("Template %s produced empty output — skipped", tpl_path.name)
            continue

        out_file = output_path / f"generated_{tpl_path.stem}.cfg"
        out_file.write_text(rendered, encoding="utf-8")
        logger.info("[OK] %s -> %s", tpl_path.name, out_file.name)

    logger.info("Done generating for: %s", input_path.name)
