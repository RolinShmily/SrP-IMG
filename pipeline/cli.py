"""Command-line orchestration.

Order matters and is part of the contract: scan -> materialise (writes
``assets/generated/<category>/``) -> manifest (writes
``assets/generated/counts.json``) -> data module (writes
``worker/targets.js``). An empty scan result must not create any output at all.

``--strict-formats`` adds a report-only audit *before* materialisation, so a
suffix/byte mismatch can abort with exit code 1 while ``assets/generated/`` is
still untouched.
"""
import sys
from typing import List, Optional

from .config import Config
from .manifest import build_manifest, write_manifest
from .pool import audit_source_formats, materialize_all
from .worker_targets import write_targets


def main(argv: Optional[List[str]] = None) -> None:
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    config = Config.from_args(argv)

    # Zero-write gate: only scan + header probing happen here. A missing source
    # tree is left to materialize_all so the existing empty-run behaviour (and
    # its single diagnostic) is unchanged.
    if config.strict_formats and config.source_dir.exists():
        offenders = [r for r in audit_source_formats(config) if not r.ok]
        if offenders:
            for report in offenders:
                print(report.warning(copied=not config.no_copy))
            print(
                "--strict-formats: 源文件真实字节与槽位后缀不符，已中止，"
                "未写出任何产物。"
            )
            raise SystemExit(1)

    results = materialize_all(config)
    if not results:
        return

    meta = build_manifest(config, results)
    write_manifest(config, meta)

    write_targets(config, meta, results)
