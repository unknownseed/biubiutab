#!/usr/bin/env bash
set -euo pipefail

# Render build script for the AI service dependencies.
#
# Why this exists:
# - madmom's build metadata step imports Cython, but pip may try to build madmom
#   before installing requirements listed in the same file.
# - madmom 0.16.x requires NumPy < 1.24.
# - madmom imports pkg_resources, which is removed in setuptools 82+.
#
# This script installs base deps first (incl. Cython/numpy/scipy/setuptools pins),
# then installs madmom in a second step (no deps, no build isolation).

python -m pip install -U pip setuptools wheel

python -m pip install -r requirements.txt

# Install madmom separately to avoid metadata-generation issues.
python -m pip install --no-build-isolation --no-deps -r requirements-madmom.txt

python -c "import madmom; import numpy as np; print('madmom', madmom.__version__, 'numpy', np.__version__)"

