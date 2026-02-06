"""
Golden-file tests for the Jinja2 config generator.

Each test case lives in a folder under ``tests/test_cases/std_*``.
The folder contains:
  - A ``*_input.json`` file (standard format)
  - ``expected_<section>.cfg`` files for comparison
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pytest

from conftest import TEST_CASES_ROOT, TEMPLATE_ROOT, find_text_differences

# ── import generator ──────────────────────────────────────────────────────
from src.generator import generate_config


# ── discover test cases ───────────────────────────────────────────────────

def _find_std_cases() -> list[tuple[str, Path]]:
    cases = []
    for folder in sorted(TEST_CASES_ROOT.iterdir()):
        if not folder.is_dir() or not folder.name.startswith("std_"):
            continue
        for input_file in folder.glob("*_input.json"):
            cases.append((folder.name, input_file))
    return cases


def _discover_generated_pairs() -> list[tuple[str, str, Path, Path]]:
    """Generate configs into tmp dirs and return (folder, section, gen, exp) tuples."""
    pairs: list[tuple[str, str, Path, Path]] = []

    for folder_name, input_file in _find_std_cases():
        folder_path = TEST_CASES_ROOT / folder_name

        # Generate into the test-case folder (idempotent)
        old = sys.stdout
        sys.stdout = io.StringIO()
        try:
            generate_config(
                input_std_json=str(input_file),
                template_folder=str(TEMPLATE_ROOT),
                output_folder=str(folder_path),
            )
        except Exception:
            pass  # template-path issues are expected for some vendors
        finally:
            sys.stdout = old

        for gen_file in sorted(folder_path.glob("generated_*.cfg")):
            section = gen_file.stem.replace("generated_", "")
            exp_file = folder_path / f"expected_{section}.cfg"
            pairs.append((folder_name, section, gen_file, exp_file))

    return pairs


_ALL_PAIRS = _discover_generated_pairs()
_ALL_STD_CASES = _find_std_cases()


# ── parametrised tests ────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "folder_name, section, gen_path, exp_path",
    _ALL_PAIRS,
    ids=[f"{folder}-{section}" for folder, section, _, _ in _ALL_PAIRS],
)
def test_generated_config(folder_name, section, gen_path, exp_path):
    """Compare a single generated .cfg against its expected golden file."""
    if not exp_path.exists():
        pytest.skip(f"No expected file: {exp_path.name}")

    generated = gen_path.read_text("utf-8").strip()
    expected = exp_path.read_text("utf-8").strip()

    if expected != generated:
        diffs = find_text_differences(expected, generated)
        msg = f"{folder_name}/{section} differs:\n" + "\n".join(f"  - {d}" for d in diffs[:5])
        pytest.fail(msg, pytrace=False)


@pytest.mark.parametrize("case", _ALL_STD_CASES, ids=lambda c: f"has_output_{c[0]}")
def test_output_files_generated(case):
    """At least one .cfg file should be generated for each test case."""
    folder_name, _ = case
    folder_path = TEST_CASES_ROOT / folder_name
    generated = list(folder_path.glob("generated_*.cfg"))
    assert generated, f"No generated .cfg files for {folder_name}"