"""
Golden-file tests for the Jinja2 config generator.

Each test case lives in a folder under ``tests/test_cases/std_*``.
The folder contains:
  - A ``*_input.json`` file (standard format)
  - ``expected_<section>.cfg`` golden files for comparison

Generation runs at test-time into ``tmp_path`` for isolation —
no files are written into the source tree.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from conftest import TEST_CASES_ROOT, TEMPLATE_ROOT, find_text_differences
from src.generator import generate_config


# ── discover test cases (no side effects) ─────────────────────────────────

def _find_std_cases() -> list[tuple[str, Path]]:
    """Return (folder_name, input_json_path) for every std_* test case."""
    cases = []
    for folder in sorted(TEST_CASES_ROOT.iterdir()):
        if not folder.is_dir() or not folder.name.startswith("std_"):
            continue
        for input_file in folder.glob("*_input.json"):
            cases.append((folder.name, input_file))
    return cases


_STD_CASES = _find_std_cases()


# ── tests ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "folder_name, input_file",
    _STD_CASES,
    ids=[c[0] for c in _STD_CASES],
)
def test_generation_succeeds(folder_name, input_file, tmp_path):
    """Generator runs without error and produces at least one .cfg file."""
    generate_config(
        input_std_json=str(input_file),
        template_folder=str(TEMPLATE_ROOT),
        output_folder=str(tmp_path),
    )
    generated = list(tmp_path.glob("generated_*.cfg"))
    assert generated, f"No .cfg files generated for {folder_name}"


@pytest.mark.parametrize(
    "folder_name, input_file",
    _STD_CASES,
    ids=[c[0] for c in _STD_CASES],
)
def test_golden_file_comparison(folder_name, input_file, tmp_path):
    """Compare every expected_<section>.cfg against its generated output."""
    generate_config(
        input_std_json=str(input_file),
        template_folder=str(TEMPLATE_ROOT),
        output_folder=str(tmp_path),
    )

    case_dir = TEST_CASES_ROOT / folder_name
    expected_files = sorted(case_dir.glob("expected_*.cfg"))

    if not expected_files:
        pytest.skip(f"No expected golden files in {folder_name}")

    errors = []
    for exp_file in expected_files:
        section = exp_file.stem.replace("expected_", "")
        gen_file = tmp_path / f"generated_{section}.cfg"

        if not gen_file.exists():
            errors.append(f"Section '{section}': generated file missing")
            continue

        expected_text = exp_file.read_text("utf-8").strip()
        generated_text = gen_file.read_text("utf-8").strip()

        if expected_text != generated_text:
            diffs = find_text_differences(expected_text, generated_text)
            errors.append(
                f"Section '{section}' differs:\n"
                + "\n".join(f"    {d}" for d in diffs[:5])
            )

    assert not errors, (
        f"{folder_name} golden file mismatches:\n" + "\n".join(errors)
    )