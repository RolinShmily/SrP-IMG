"""Manifest stage: the cross-layer contract between build and runtime.

``assets/generated/counts.json`` is read by the web app (categories, counts,
per-slot aspect ratios) and by the Worker (slot counts and extensions). Its
schema lives in ``contracts/manifest.schema.json`` and is enforced by the
small validator below, so drift fails the build instead of the browser.

The field set, field order, ``json.dump`` flags and the timestamp-reuse rule are
all part of the observable output and must not be "tidied".
"""
import datetime
import json
from pathlib import Path
import re
from typing import List, Union

from .config import DEFAULT_SCHEMA, Config
from .models import CategoryResult

COUNTS_FILENAME = 'counts.json'


class ManifestError(ValueError):
    """Raised when a generated manifest violates its JSON Schema contract."""


def _type_ok(value, expected: str) -> bool:
    if expected == 'object':
        return isinstance(value, dict)
    if expected == 'array':
        return isinstance(value, list)
    if expected == 'string':
        return isinstance(value, str)
    if expected == 'integer':
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == 'number':
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == 'boolean':
        return isinstance(value, bool)
    if expected == 'null':
        return value is None
    raise ManifestError(f"unsupported schema type: {expected!r}")


def _validate(value, schema: dict, path: str, errors: List[str]) -> None:
    """Validate ``value`` against the JSON Schema subset used by the contract."""
    declared = schema.get('type')
    if declared:
        allowed = declared if isinstance(declared, list) else [declared]
        if not any(_type_ok(value, expected) for expected in allowed):
            got = 'null' if value is None else type(value).__name__
            errors.append(f"{path}: expected {'/'.join(allowed)}, got {got}")
            return

    if 'enum' in schema and value not in schema['enum']:
        errors.append(f"{path}: {value!r} is not one of {schema['enum']!r}")

    if isinstance(value, str) and 'pattern' in schema:
        if re.search(schema['pattern'], value) is None:
            errors.append(f"{path}: {value!r} does not match {schema['pattern']!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if 'minimum' in schema and value < schema['minimum']:
            errors.append(f"{path}: {value!r} is below minimum {schema['minimum']!r}")
        if 'exclusiveMinimum' in schema and value <= schema['exclusiveMinimum']:
            errors.append(f"{path}: {value!r} is not above {schema['exclusiveMinimum']!r}")
        if 'maximum' in schema and value > schema['maximum']:
            errors.append(f"{path}: {value!r} is above maximum {schema['maximum']!r}")

    if isinstance(value, list):
        if 'minItems' in schema and len(value) < schema['minItems']:
            errors.append(f"{path}: needs at least {schema['minItems']} items")
        if 'maxItems' in schema and len(value) > schema['maxItems']:
            errors.append(f"{path}: allows at most {schema['maxItems']} items")
        item_schema = schema.get('items')
        if isinstance(item_schema, dict):
            for index, entry in enumerate(value):
                _validate(entry, item_schema, f"{path}[{index}]", errors)

    if isinstance(value, dict):
        for key in schema.get('required', []):
            if key not in value:
                errors.append(f"{path}: missing required property {key!r}")
        properties = schema.get('properties', {})
        for key, sub_schema in properties.items():
            if key in value:
                _validate(value[key], sub_schema, f"{path}.{key}", errors)
        additional = schema.get('additionalProperties', True)
        for key, entry in value.items():
            if key in properties:
                continue
            if additional is False:
                errors.append(f"{path}: unexpected property {key!r}")
            elif isinstance(additional, dict):
                _validate(entry, additional, f"{path}[{key!r}]", errors)


def validate_manifest(meta: dict, schema_path: Union[str, Path, None] = None) -> None:
    schema_path = Path(schema_path) if schema_path is not None else DEFAULT_SCHEMA
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema = json.load(f)
    errors: List[str] = []
    _validate(meta, schema, 'manifest', errors)
    if errors:
        raise ManifestError("invalid manifest: " + "; ".join(errors))


def build_manifest(config: Config, results: List[CategoryResult]) -> dict:
    counts = {r.name: r.slots for r in results}
    real_counts = {r.name: r.real_count for r in results}
    category_exts = {r.name: r.ext for r in results}
    category_aspects = {r.name: r.aspect for r in results}

    slot_ratios = {r.name: r.slot_ratios for r in results}

    categories_list = [
        {
            "key": r.name,
            "name_zh": r.name_zh,
            "name_en": r.name_en,
            "ext": r.ext,
            "count": r.real_count,
            "slots": r.slots,
            "aspect": r.aspect,
            "aspect_hint": r.aspect_hint,
        }
        for r in results
    ]

    path = config.output_dir / COUNTS_FILENAME
    timestamp = None
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            # Deliberately narrower than the manifest: a label/aspect-hint edit
            # alone must not rewrite generated_at.
            if (
                existing.get('counts') == counts and
                existing.get('real_counts') == real_counts and
                existing.get('category_exts') == category_exts and
                existing.get('slot_ratios') == slot_ratios and
                existing.get('hash_length') == config.hash_length and
                existing.get('output_ext') == config.default_ext
            ):
                timestamp = existing.get('generated_at')
        except Exception:
            pass

    if not timestamp:
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

    meta = {
        "categories": categories_list,
        "counts": counts,
        "real_counts": real_counts,
        "category_exts": category_exts,
        "category_aspects": category_aspects,
        "slot_ratios": slot_ratios,
        "hash_length": config.hash_length,
        "output_ext": config.default_ext,
        "generated_at": timestamp
    }
    return meta


def write_manifest(config: Config, meta: dict) -> Path:
    validate_manifest(meta, config.schema_path)
    config.output_dir.mkdir(parents=True, exist_ok=True)
    path = config.output_dir / COUNTS_FILENAME
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Wrote {path}")
    return path
