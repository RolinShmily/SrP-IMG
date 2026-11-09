"""Image-set pipeline: scan ``assets/original/``, materialise hashed slots, emit data.

This package is the only producer of generated build inputs:

    assets/generated/<category>/<hex>.<ext>   (or 1x1 placeholders with --no-copy)
    assets/generated/counts.json
    worker/targets.js                         (category data only, no logic)
    worker/slot_formats.js                    (per-slot format codes, data only)

The runtime itself (``worker/``) is hand-written JavaScript; this package owns
no request-handling logic and imports nothing from the web app or the Worker.
"""

from .catalog import Catalog, CategorySpec, load_catalog
from .cli import main
from .config import Config
from .formats import FormatReport, detect_format, expected_format, format_code
from .image_size import detect_aspect_ratio, get_image_size
from .manifest import ManifestError, build_manifest, validate_manifest, write_manifest
from .models import CategoryInput, CategoryResult
from .placeholders import TINY_GIF, TINY_JPEG, TINY_PNG
from .pool import audit_source_formats, materialize_all, materialize_category
from .scan import scan_categories
from .worker_targets import (
    build_slot_formats,
    build_targets,
    render_slot_formats,
    render_targets,
    write_slot_formats,
    write_targets,
)

__all__ = [
    "Catalog",
    "CategoryInput",
    "CategoryResult",
    "CategorySpec",
    "Config",
    "FormatReport",
    "ManifestError",
    "TINY_GIF",
    "TINY_JPEG",
    "TINY_PNG",
    "audit_source_formats",
    "build_manifest",
    "build_slot_formats",
    "build_targets",
    "detect_aspect_ratio",
    "detect_format",
    "expected_format",
    "format_code",
    "get_image_size",
    "load_catalog",
    "main",
    "materialize_all",
    "materialize_category",
    "render_slot_formats",
    "render_targets",
    "scan_categories",
    "validate_manifest",
    "write_manifest",
    "write_slot_formats",
    "write_targets",
]
