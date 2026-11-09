"""The category registry: the single place that decides labels and formats.

Before this module existed the same four categories were described by four maps
plus a hard-coded if/elif chain in the generator, and again by four maps in the
web app. ``assets/catalog.json`` is now the only source of truth for the build
side; the generated manifest carries the result to the web side.

``ext_policy`` per category:
  "default"  -> use ``Config.default_ext`` (the ``--ext`` flag)
  "source"   -> use the first valid source file's suffix, else ``default_ext``
  ".suffix"  -> use that literal suffix

TODO(P3): ``h``/``v`` still resolve to ``default_ext`` and ``a`` is pinned to
``.jpeg`` regardless of the real bytes, so a PNG/WebP source is copied into a
``.jpg``/``.jpeg`` name. That mismatch is preserved here on purpose: the suffix
is part of the deployed URL, so following the bytes would move every affected
slot. ``pipeline/formats.py`` now reports the drift on every run and
``--strict-formats`` turns it into a build failure; switching a category to
``ext_policy: "source"`` remains a data/pool regeneration decision.
"""
from dataclasses import dataclass
import json
from pathlib import Path
from typing import Dict, Union


@dataclass(frozen=True)
class CategorySpec:
    key: str
    label: str
    name_zh: str
    name_en: str
    description: str
    ext_policy: str


def unknown_spec(key: str) -> CategorySpec:
    """Category discovered in ``assets/original/`` but absent from the catalog.

    Keeps the pre-catalog behaviour: label is the raw key, display names are
    ``str.capitalize()``ed, the description is templated, and the extension
    follows the sources.
    """
    return CategorySpec(
        key=key,
        label=key,
        name_zh=key.capitalize(),
        name_en=key.capitalize(),
        description=f"{key} 随机图片",
        ext_policy="source",
    )


class Catalog:
    """Immutable view over ``assets/catalog.json``."""

    def __init__(self, specs: Dict[str, CategorySpec]):
        self._specs = dict(specs)

    def __contains__(self, key: str) -> bool:
        return key in self._specs

    def get(self, key: str) -> CategorySpec:
        return self._specs.get(key) or unknown_spec(key)

    def keys(self):
        return self._specs.keys()

    def __len__(self) -> int:
        return len(self._specs)


def parse_catalog(data: dict) -> Catalog:
    raw = data.get("categories")
    if not isinstance(raw, dict):
        raise ValueError("catalog must contain an object at 'categories'")
    specs: Dict[str, CategorySpec] = {}
    for key, entry in raw.items():
        if not isinstance(entry, dict):
            raise ValueError(f"catalog entry {key!r} must be an object")
        specs[key] = CategorySpec(
            key=key,
            label=str(entry["label"]),
            name_zh=str(entry["name_zh"]),
            name_en=str(entry["name_en"]),
            description=str(entry["description"]),
            ext_policy=str(entry["ext_policy"]),
        )
    return Catalog(specs)


def load_catalog(path: Union[str, Path]) -> Catalog:
    with open(path, "r", encoding="utf-8") as f:
        return parse_catalog(json.load(f))
