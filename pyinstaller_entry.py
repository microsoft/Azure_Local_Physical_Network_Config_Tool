"""PyInstaller entry point.

Bootstraps the src package so relative imports work in frozen builds.
This file is the --entry-point for PyInstaller instead of src/main.py.
"""
import sys
import os

if getattr(sys, "frozen", False):
    base = sys._MEIPASS          # PyInstaller temp extraction folder
else:
    base = os.path.dirname(os.path.abspath(__file__))

if base not in sys.path:
    sys.path.insert(0, base)

from src.main import main  # noqa: E402

if __name__ == "__main__":
    main()
