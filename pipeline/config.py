"""Run configuration for one pipeline invocation.

Paths keep the original working-directory-relative defaults, because every
caller (npm scripts, CI, tests) runs the generator with the project root — or
a fixture tree — as the current directory. Only the catalog and schema are
anchored to the package location: they are project data, not run inputs.
"""
import argparse
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

DEFAULT_HASH_LENGTH = 2
DEFAULT_EXT = ".jpg"
SIZE_LIMIT_MB = 5.0
SOURCE_DIR = Path("assets") / "original"
OUTPUT_DIR = Path("assets") / "generated"
WORKER_TARGETS = Path("worker") / "targets.js"
ALLOWED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp')

# Resolved from this file, so the catalog and contract are found no matter what
# the caller's cwd is (the file outputs below stay cwd-relative on purpose).
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = REPO_ROOT / "assets" / "catalog.json"
DEFAULT_SCHEMA = REPO_ROOT / "contracts" / "manifest.schema.json"


@dataclass
class Config:
    hash_length: int = DEFAULT_HASH_LENGTH
    default_ext: str = DEFAULT_EXT
    no_copy: bool = False
    # Report-only guard: source bytes that do not match the slot suffix are
    # always reported; with this on they abort the run before anything is
    # written (see ``pipeline/formats.py``).
    strict_formats: bool = False
    source_dir: Path = SOURCE_DIR
    output_dir: Path = OUTPUT_DIR
    size_limit_mb: float = SIZE_LIMIT_MB
    allowed_extensions: tuple = field(default_factory=lambda: ALLOWED_EXTENSIONS)
    targets_path: Path = WORKER_TARGETS
    catalog_path: Path = DEFAULT_CATALOG
    schema_path: Path = DEFAULT_SCHEMA

    def __post_init__(self):
        if not self.default_ext.startswith('.'):
            self.default_ext = f".{self.default_ext}"

    @property
    def num_slots(self) -> int:
        return 16 ** self.hash_length

    @classmethod
    def from_args(cls, argv: Optional[List[str]] = None) -> "Config":
        parser = argparse.ArgumentParser(
            description="Generate hashed image sets and the Cloudflare Worker data module."
        )
        parser.add_argument(
            '--hash-length', '-l',
            type=int,
            default=DEFAULT_HASH_LENGTH,
            help=f"Hash length for hex slot filenames (default: {DEFAULT_HASH_LENGTH})"
        )
        parser.add_argument(
            '--ext', '-e',
            default=DEFAULT_EXT,
            help=f"Default image file extension (default: {DEFAULT_EXT})"
        )
        parser.add_argument(
            '--no-copy',
            action='store_true',
            help="Generate lightweight placeholder files instead of copying image binaries"
        )
        parser.add_argument(
            '--strict-formats',
            action='store_true',
            help=(
                "Abort with exit code 1 before writing any artifact when a source "
                "file's real format (JPEG/PNG/GIF/WebP header) does not match the "
                "slot suffix; without it the mismatch is only reported"
            )
        )
        args = parser.parse_args(argv)
        return cls(
            hash_length=args.hash_length,
            default_ext=args.ext,
            no_copy=args.no_copy,
            strict_formats=args.strict_formats,
        )
