"""
Golden-file tests for the lab→standard JSON converters.

Each test case lives in a folder under ``tests/test_cases/convert_*``.
The folder must contain:
  - A ``*_input.json`` file (lab format)
  - An ``expected_outputs/`` directory with the expected standard JSON files
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

from conftest import TEST_CASES_ROOT, load_json, find_json_differences

# ── import converter ──────────────────────────────────────────────────────
from src.convertors import convert_lab_switches
from src.loader import load_input_json


# ── discover test cases ───────────────────────────────────────────────────

def _find_convert_cases() -> list[tuple[str, Path]]:
    cases = []
    for folder in sorted(TEST_CASES_ROOT.iterdir()):
        if not folder.is_dir() or not folder.name.startswith("convert_"):
            continue
        for input_file in folder.glob("*_input.json"):
            cases.append((folder.name, input_file))
    return cases


_ALL_CASES = _find_convert_cases()


# ── parametrised tests ────────────────────────────────────────────────────

@pytest.mark.parametrize("case", _ALL_CASES, ids=lambda c: c[0])
def test_convert_golden(case, tmp_path):
    """Convert lab JSON → standard JSON and compare against expected output."""
    folder_name, input_file = case
    expected_dir = TEST_CASES_ROOT / folder_name / "expected_outputs"

    # Load & convert
    input_data = load_json(input_file)
    assert {"Version", "Description", "InputData"} & input_data.keys(), \
        f"Input does not look like lab format: {input_file}"

    # Suppress converter stdout
    old = sys.stdout
    sys.stdout = io.StringIO()
    try:
        convert_lab_switches(input_data, str(tmp_path))
    finally:
        sys.stdout = old

    generated_files = sorted(tmp_path.glob("*.json"))
    assert generated_files, f"No output files produced for {folder_name}"

    compared = 0
    for gen_file in generated_files:
        exp_file = expected_dir / gen_file.name
        if not exp_file.exists():
            continue  # extra files are OK — new switches added

        expected = json.loads(exp_file.read_text("utf-8"))
        actual = json.loads(gen_file.read_text("utf-8"))

        # Strip debug section from both sides (DC6)
        expected.pop("debug", None)
        actual.pop("debug", None)

        if expected != actual:
            diffs = find_json_differences(expected, actual)
            msg = f"{gen_file.name} differs:\n" + "\n".join(f"  - {d}" for d in diffs[:5])
            pytest.fail(msg, pytrace=False)

        compared += 1

    if compared == 0:
        pytest.skip(f"No expected output files found for {folder_name}")


@pytest.mark.parametrize("case", _ALL_CASES, ids=lambda c: f"input_format_{c[0]}")
def test_input_is_lab_format(case):
    """Verify that each test input is valid lab-format JSON."""
    _, input_file = case
    data = load_json(input_file)
    missing = {"Version", "Description", "InputData"} - data.keys()
    assert not missing, f"Missing lab-format keys: {missing}"
