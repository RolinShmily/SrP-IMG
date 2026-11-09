#!/usr/bin/env python3
"""Behavioural tests for the build-time image pipeline.

These pin the parts of the output that other layers depend on: the manifest
contract, slot naming, extension policy, timestamp reuse and the fact that an
empty scan writes nothing. Byte-level equivalence with the pre-refactor
generator is additionally checked by an external oracle; here we assert the
properties a reviewer can reason about.

Run directly:  python tests/pipeline/test_pipeline.py
"""

import json
import hashlib
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from pipeline.config import ALLOWED_EXTENSIONS, Config  # noqa: E402
from pipeline.formats import detect_format, expected_format  # noqa: E402
from pipeline.image_size import detect_aspect_ratio, get_image_size  # noqa: E402
from pipeline.manifest import ManifestError, validate_manifest  # noqa: E402
from pipeline.placeholders import TINY_GIF, TINY_JPEG  # noqa: E402


# ---------------------------------------------------------------------------
# synthetic sources: only the header bytes the pipeline reads
# ---------------------------------------------------------------------------
def png_header(width: int, height: int) -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", width, height) + b"\x08\x06\x00\x00\x00"
    return signature + ihdr + bytes(16)


def jpeg_header(width: int, height: int) -> bytes:
    return (
        b"\xff\xd8"
        + b"\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00"
        + b"\xff\xc0\x00\x11\x08"
        + struct.pack(">HH", height, width)
        + b"\x03\x01\x11\x00\x02\x11\x01\x03\x11\x01"
        + b"\xff\xd9"
    )


GIF_HEADER = bytes.fromhex("47494638396101000100")


def webp_header(width: int, height: int) -> bytes:
    """RIFF/WEBP with a VP8X chunk; VP8X stores each dimension as value-1."""
    payload = (
        b"WEBP"
        + b"VP8X"
        + bytes(8)
        + (width - 1).to_bytes(3, "little")
        + (height - 1).to_bytes(3, "little")
        + bytes(1)
    )
    return b"RIFF" + len(payload).to_bytes(4, "little") + payload


def write_tree(root: Path, files: dict) -> None:
    for relative, data in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def run_pipeline(cwd: Path, *args: str):
    env = dict(os.environ)
    env["PYTHONPATH"] = str(ROOT)
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, "-m", "pipeline", *args],
        cwd=str(cwd), env=env, capture_output=True, text=True, encoding="utf-8",
    )


def load_counts(cwd: Path) -> dict:
    return json.loads((cwd / "assets" / "generated" / "counts.json").read_text(encoding="utf-8"))


def load_slot_formats(cwd: Path) -> dict:
    """Parse ``worker/slot_formats.js`` the same way the Worker does at load time."""
    source = (cwd / "worker" / "slot_formats.js").read_text(encoding="utf-8")
    payload = source.split("export const SLOT_FORMATS = JSON.parse(", 1)[1].strip()
    for suffix in (";", ")"):
        if payload.endswith(suffix):
            payload = payload[:-1].rstrip()
    return json.loads(json.loads(payload))


class ImageSizeTests(unittest.TestCase):
    def test_reads_each_supported_header(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            cases = {
                "a.png": (png_header(800, 600), (800, 600)),
                "b.jpg": (jpeg_header(1920, 1080), (1920, 1080)),
                "c.gif": (GIF_HEADER, (1, 1)),
                "d.webp": (webp_header(3, 2), (3, 2)),
                "e.bin": (b"not an image at all", (None, None)),
            }
            for name, (data, expected) in cases.items():
                (directory / name).write_bytes(data)
                self.assertEqual(get_image_size(directory / name), expected, name)

    def test_aspect_buckets_use_closed_intervals(self):
        self.assertEqual(detect_aspect_ratio(100, 100, ".jpg"), ("1/1", "1:1"))
        self.assertEqual(detect_aspect_ratio(108, 100, ".jpg"), ("1/1", "1:1"))
        self.assertEqual(detect_aspect_ratio(155, 100, ".jpg"), ("16/9", "16:9"))
        self.assertEqual(detect_aspect_ratio(115, 100, ".jpg"), ("4/3", "4:3"))
        self.assertEqual(detect_aspect_ratio(65, 100, ".jpg"), ("9/16", "9:16"))
        self.assertEqual(detect_aspect_ratio(88, 100, ".jpg"), ("3/4", "3:4"))
        # Outside every bucket the raw ratio is kept, and the hint uses ':'.
        self.assertEqual(detect_aspect_ratio(110, 100, ".jpg"), ("110/100", "110:100"))
        # A gif extension wins over geometry, and unknown dimensions do too.
        self.assertEqual(detect_aspect_ratio(100, 100, ".gif"), (None, "动态格式"))
        self.assertEqual(detect_aspect_ratio(None, None, ".jpg"), (None, "动态格式"))


class FormatDetectionTests(unittest.TestCase):
    """Suffix/byte drift is detected from headers only, with no dependencies."""

    def test_detect_format_reads_each_magic_number(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            cases = {
                "a.jpg": (jpeg_header(4, 3), "jpeg"),
                "b.png": (png_header(4, 3), "png"),
                "c.gif": (GIF_HEADER, "gif"),
                "d.webp": (webp_header(4, 3), "webp"),
                "e.bin": (b"BM not an image at all", None),
                "f.empty": (b"", None),
            }
            for name, (data, expected) in cases.items():
                path = directory / name
                path.write_bytes(data)
                self.assertEqual(detect_format(path), expected, name)
            # Unreadable paths are "no evidence", never a mismatch.
            self.assertIsNone(detect_format(directory / "missing.png"))
            self.assertIsNone(detect_format(directory))

    def test_expected_format_ignores_unknown_suffixes(self):
        self.assertEqual(expected_format(".JPG"), "jpeg")
        self.assertEqual(expected_format(".jpeg"), "jpeg")
        self.assertEqual(expected_format(".png"), "png")
        self.assertEqual(expected_format(".gif"), "gif")
        self.assertEqual(expected_format(".webp"), "webp")
        self.assertIsNone(expected_format(".avif"))
        self.assertIsNone(expected_format(""))


class FormatGuardTests(unittest.TestCase):
    """The suffix/byte guard only reports by default, and aborts in strict mode."""

    def mixed_fixture(self, root: Path) -> None:
        # Sorted order is screenshot.png then wide.jpg, so slot 0 holds the PNG.
        write_tree(root, {
            "assets/original/h/screenshot.png": png_header(1600, 900),
            "assets/original/h/wide.jpg": jpeg_header(1600, 900),
        })

    def matching_fixture(self, root: Path) -> None:
        write_tree(root, {
            "assets/original/h/a.jpg": jpeg_header(1600, 900),
            "assets/original/h/b.jpeg": jpeg_header(1024, 768),
        })

    def test_mismatch_is_reported_but_slots_keep_their_extension(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            self.mixed_fixture(work)
            proc = run_pipeline(work, "--hash-length", "1")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("[h]", proc.stdout)
            self.assertIn("1/2", proc.stdout)
            self.assertIn(".jpg", proc.stdout)
            self.assertIn("png", proc.stdout)

            # Nothing about the pool moved: same names, same verbatim bytes.
            generated = work / "assets" / "generated" / "h"
            self.assertEqual(
                sorted(p.name for p in generated.iterdir()),
                [f"{i:x}.jpg" for i in range(16)],
            )
            self.assertEqual((generated / "0.jpg").read_bytes(), png_header(1600, 900))
            self.assertEqual((generated / "1.jpg").read_bytes(), jpeg_header(1600, 900))
            self.assertEqual(load_counts(work)["category_exts"]["h"], ".jpg")

    def test_strict_formats_aborts_before_writing_anything(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            self.mixed_fixture(work)
            proc = run_pipeline(work, "--hash-length", "1", "--strict-formats")
            self.assertEqual(proc.returncode, 1, proc.stderr)
            self.assertIn("[h]", proc.stdout)
            self.assertIn("1/2", proc.stdout)
            self.assertIn("--strict-formats", proc.stdout)
            # Zero writes: not even the slot directory, let alone the pool.
            self.assertFalse((work / "assets" / "generated").exists(),
                             "strict mode must not write any artifact")
            self.assertFalse((work / "worker").exists())

    def test_strict_formats_passes_when_every_source_matches(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            self.matching_fixture(work)
            proc = run_pipeline(work, "--hash-length", "1", "--strict-formats")
            self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
            self.assertNotIn("个有效源文件的真实字节", proc.stdout)
            counts = load_counts(work)
            self.assertEqual(counts["category_exts"], {"h": ".jpg"})
            self.assertEqual(counts["real_counts"], {"h": 2})
            self.assertEqual(len(list((work / "assets" / "generated" / "h").iterdir())), 16)

    def test_help_lists_the_strict_formats_flag(self):
        with tempfile.TemporaryDirectory() as temporary:
            proc = run_pipeline(Path(temporary), "--help")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertIn("--strict-formats", proc.stdout)


class SlotFormatsTests(unittest.TestCase):
    """`worker/slot_formats.js` mirrors the slot cycle, not just the sources."""

    def test_slot_formats_follow_the_slot_cycle(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            write_tree(work, {
                "assets/original/h/a.jpg": jpeg_header(1600, 900),
                "assets/original/h/b.png": png_header(1600, 900),
            })
            proc = run_pipeline(work, "--hash-length", "1")
            self.assertEqual(proc.returncode, 0, proc.stderr)

            module = work / "worker" / "slot_formats.js"
            self.assertTrue(module.exists(), "slot_formats.js must be emitted with targets.js")
            self.assertTrue((work / "worker" / "targets.js").exists())
            self.assertTrue(module.read_text(encoding="utf-8").startswith(
                "// Generated by `python -m pipeline`. Do not edit.\n"
            ))

            formats = load_slot_formats(work)
            self.assertEqual(sorted(formats), ["h"])
            self.assertEqual(len(formats["h"]), 16)
            # sorted() puts a.jpg first, so slot i is a JPEG for even i, a PNG for odd.
            self.assertEqual(
                formats["h"],
                "".join("j" if i % 2 == 0 else "p" for i in range(16)),
            )
            self.assertEqual(load_counts(work)["counts"], {"h": 16})

    def test_empty_category_has_an_empty_string(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            write_tree(work, {
                "assets/original/h/a.jpg": jpeg_header(1600, 900),
                "assets/original/empty/.keep.txt": b"",
            })
            self.assertEqual(run_pipeline(work, "--hash-length", "1").returncode, 0)
            formats = load_slot_formats(work)
            self.assertEqual(formats["empty"], "")
            self.assertEqual(len(formats["h"]), 16)


class PipelineRunTests(unittest.TestCase):
    def fixture(self, root: Path) -> None:
        write_tree(root, {
            "assets/original/h/landscape.png": png_header(1600, 900),
            "assets/original/h/second.png": png_header(1024, 768),
            # 5 MiB + 1 byte is rejected; exactly 5 MiB is accepted.
            "assets/original/v/portrait.png": png_header(900, 1600),
            "assets/original/v/huge.png": png_header(1, 1) + bytes(5 * 1024 * 1024),
            "assets/original/a/avatar.webp": webp_header(600, 600),
            "assets/original/gif/motion.gif": GIF_HEADER,
            "assets/original/custom/real.webp": webp_header(800, 800),
            "assets/original/custom/unknown.bmp": b"BM",
            "assets/original/custom/also-unknown.txt": b"ignored",
            "assets/original/empty/.keep.txt": b"",
        })

    def test_default_run_produces_the_expected_manifest_and_slots(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            self.fixture(work)
            proc = run_pipeline(work, "--hash-length", "1")
            self.assertEqual(proc.returncode, 0, proc.stderr)

            counts = load_counts(work)
            self.assertEqual(counts["counts"], {"a": 16, "custom": 16, "empty": 0, "gif": 16, "h": 16, "v": 16})
            self.assertEqual(counts["real_counts"], {"a": 1, "custom": 1, "empty": 0, "gif": 1, "h": 2, "v": 1})
            # Custom follows its source suffix; empty has none, so the default.
            self.assertEqual(counts["category_exts"], {
                "a": ".jpeg", "custom": ".webp", "empty": ".jpg", "gif": ".gif", "h": ".jpg", "v": ".jpg",
            })
            self.assertEqual(counts["category_aspects"]["h"], "16/9")
            self.assertEqual(counts["category_aspects"]["gif"], None)
            self.assertEqual(counts["slot_ratios"]["h"][:2], [1.7778, 1.3333])
            self.assertEqual(len(counts["slot_ratios"]["h"]), 16)
            self.assertEqual(len(counts["slot_ratios"]["empty"]), 0)
            self.assertRegex(counts["generated_at"], r"^\d{4}-\d{2}-\d{2}T.*Z$")

            labels = {entry["key"]: entry for entry in counts["categories"]}
            self.assertEqual(labels["h"]["name_zh"], "横屏壁纸")
            self.assertEqual(labels["empty"]["aspect_hint"], "暂无素材")
            # Unknown categories keep the historical capitalisation.
            self.assertEqual(labels["custom"]["name_en"], "Custom")

            self.assertEqual(sorted(p.name for p in (work / "assets" / "generated" / "h").iterdir()),
                             [f"{i:x}.jpg" for i in range(16)])
            # Slots are real copies when --no-copy is absent.
            self.assertEqual((work / "assets" / "generated" / "h" / "0.jpg").read_bytes(), png_header(1600, 900))
            targets = (work / "worker" / "targets.js").read_text(encoding="utf-8")
            self.assertIn("export const TARGETS = JSON.parse(", targets)
            self.assertIn('\\"h\\": {\\"dir\\": \\"h\\", \\"slots\\": 16', targets)
            self.assertFalse((work / "index.js").exists())
            self.assertFalse((work / "functions").exists())

    def test_no_copy_writes_placeholder_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            write_tree(work, {
                "assets/original/h/a.png": png_header(1600, 900),
                "assets/original/a/b.webp": webp_header(600, 600),
                "assets/original/gif/c.gif": GIF_HEADER,
            })
            proc = run_pipeline(work, "--hash-length", "1", "--no-copy")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertEqual((work / "assets" / "generated" / "h" / "0.jpg").read_bytes(), TINY_JPEG)
            self.assertEqual((work / "assets" / "generated" / "a" / "0.jpeg").read_bytes(), TINY_JPEG)
            self.assertEqual((work / "assets" / "generated" / "gif" / "0.gif").read_bytes(), TINY_GIF)

    def test_ext_flag_only_moves_the_default_categories(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            self.fixture(work)
            proc = run_pipeline(work, "--hash-length", "1", "--ext", "png")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            exts = load_counts(work)["category_exts"]
            self.assertEqual(exts["h"], ".png")
            self.assertEqual(exts["v"], ".png")
            self.assertEqual(exts["empty"], ".png")
            self.assertEqual(exts["a"], ".jpeg")
            self.assertEqual(exts["gif"], ".gif")
            self.assertEqual(exts["custom"], ".webp")

    def test_category_meta_overrides_names_and_aspect(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            write_tree(work, {
                "assets/original/h/a.png": png_header(1600, 900),
                "assets/original/h/meta.json": json.dumps({
                    "name_zh": "自定义横屏", "name_en": "Custom Wide",
                    "aspect": "2/1", "aspect_hint": "2:1",
                }).encode(),
            })
            proc = run_pipeline(work, "--hash-length", "1")
            self.assertEqual(proc.returncode, 0, proc.stderr)
            entry = load_counts(work)["categories"][0]
            self.assertEqual((entry["name_zh"], entry["name_en"]), ("自定义横屏", "Custom Wide"))
            self.assertEqual((entry["aspect"], entry["aspect_hint"]), ("2/1", "2:1"))

    def test_timestamp_is_reused_until_the_inputs_change(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            write_tree(work, {"assets/original/h/a.png": png_header(1600, 900)})
            self.assertEqual(run_pipeline(work, "--hash-length", "1").returncode, 0)
            first = load_counts(work)["generated_at"]
            self.assertEqual(run_pipeline(work, "--hash-length", "1").returncode, 0)
            self.assertEqual(load_counts(work)["generated_at"], first)

            write_tree(work, {"assets/original/h/b.png": png_header(1200, 900)})
            self.assertEqual(run_pipeline(work, "--hash-length", "1").returncode, 0)
            counts = load_counts(work)
            self.assertEqual(counts["real_counts"]["h"], 2)
            self.assertNotEqual(counts["generated_at"], first)

            # A changed --ext is also a changed input.
            second = counts["generated_at"]
            self.assertEqual(run_pipeline(work, "--hash-length", "1", "--ext", ".png").returncode, 0)
            self.assertNotEqual(load_counts(work)["generated_at"], second)

    def test_empty_source_writes_nothing(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            proc = run_pipeline(work)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            self.assertFalse((work / "assets" / "generated").exists(), "no source tree must not create output")
            self.assertFalse((work / "worker").exists())

        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            write_tree(work, {"assets/original/keep/.keep.txt": b""})
            proc = run_pipeline(work)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            counts = load_counts(work)
            self.assertEqual(counts["counts"], {"keep": 0})
            self.assertEqual(counts["category_exts"], {"keep": ".jpg"})

    def test_stale_slots_are_cleared_but_siblings_and_static_files_survive(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            self.fixture(work)
            write_tree(work, {
                "assets/generated/h/stale.jpg": b"stale",
                "assets/generated/h/sub/keep.txt": b"nested",
                "assets/static/_headers": b"/*\n  X-Test: 1\n",
                "assets/static/icon.svg": b"<svg/>",
                "functions/other.js": b"// keep",
                # Runtime sources are hand-written now: the pipeline must never
                # overwrite them, only the generated data module.
                "index.js": b"// hand-written entry, not generated",
                "functions/pic.js": b"// hand-written adapter, not generated",
                "worker/targets.js": b"// stale",
            })
            self.assertEqual(run_pipeline(work, "--hash-length", "1").returncode, 0)
            self.assertFalse((work / "assets" / "generated" / "h" / "stale.jpg").exists())
            self.assertTrue((work / "assets" / "generated" / "h" / "sub" / "keep.txt").exists())
            self.assertEqual((work / "assets" / "static" / "_headers").read_bytes(), b"/*\n  X-Test: 1\n")
            self.assertEqual((work / "assets" / "static" / "icon.svg").read_bytes(), b"<svg/>")
            self.assertEqual((work / "functions" / "other.js").read_bytes(), b"// keep")
            self.assertEqual((work / "index.js").read_bytes(), b"// hand-written entry, not generated")
            self.assertEqual((work / "functions" / "pic.js").read_bytes(), b"// hand-written adapter, not generated")
            self.assertNotEqual((work / "worker" / "targets.js").read_bytes(), b"// stale")

    def test_removed_flag_is_still_rejected_without_writing(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            self.fixture(work)
            proc = run_pipeline(work, "--access-policy", "policy.json")
            self.assertEqual(proc.returncode, 2)
            self.assertIn("unrecognized arguments", proc.stderr)
            self.assertFalse((work / "assets" / "generated").exists())


class SchemaTests(unittest.TestCase):
    def manifest(self) -> dict:
        return {
            "categories": [{
                "key": "h", "name_zh": "横屏壁纸", "name_en": "Landscape", "ext": ".jpg",
                "count": 2, "slots": 16, "aspect": "16/9", "aspect_hint": "16:9",
            }],
            "counts": {"h": 16},
            "real_counts": {"h": 2},
            "category_exts": {"h": ".jpg"},
            "category_aspects": {"h": "16/9"},
            "slot_ratios": {"h": [1.7778, 1.3333]},
            "hash_length": 1,
            "output_ext": ".jpg",
            "generated_at": "2026-01-01T00:00:00.000000Z",
        }

    def test_valid_manifest_passes(self):
        validate_manifest(self.manifest())

    def test_contract_rejections(self):
        def breaks(mutate) -> bool:
            meta = self.manifest()
            mutate(meta)
            try:
                validate_manifest(meta)
            except ManifestError:
                return True
            return False

        self.assertTrue(breaks(lambda m: m.pop("slot_ratios")))
        self.assertTrue(breaks(lambda m: m["counts"].__setitem__("h", -1)))
        self.assertTrue(breaks(lambda m: m["category_exts"].__setitem__("h", "jpg")))
        self.assertTrue(breaks(lambda m: m["categories"][0].pop("aspect_hint")))
        self.assertTrue(breaks(lambda m: m["categories"][0].__setitem__("extra", 1)))
        self.assertTrue(breaks(lambda m: m["slot_ratios"].__setitem__("h", ["wide"])))
        self.assertTrue(breaks(lambda m: m.__setitem__("generated_at", 42)))


class CatalogTests(unittest.TestCase):
    def test_catalog_matches_the_shipped_categories(self):
        from pipeline.catalog import load_catalog
        catalog = load_catalog(ROOT / "assets" / "catalog.json")
        self.assertEqual(sorted(catalog.keys()), ["a", "gif", "h", "v"])
        self.assertEqual(catalog.get("a").ext_policy, ".jpeg")
        self.assertEqual(catalog.get("gif").ext_policy, ".gif")
        self.assertEqual(catalog.get("h").name_zh, "横屏壁纸")
        unknown = catalog.get("custom")
        self.assertEqual((unknown.label, unknown.ext_policy), ("custom", "source"))

    def test_allowed_extensions_cover_every_catalog_format(self):
        self.assertIn(".jpeg", ALLOWED_EXTENSIONS)
        self.assertIn(".gif", ALLOWED_EXTENSIONS)


def assert_no_growth(test: unittest.TestCase, baseline: dict, actual: dict) -> None:
    """Mismatches may shrink, never grow; an unlisted category must be clean."""
    for category, count in sorted(actual.items()):
        allowed = baseline.get(category, 0)
        test.assertLessEqual(
            count,
            allowed,
            f"{category}: {count} mismatched, baseline allows {allowed}",
        )


class BaselineGateSemanticsTests(unittest.TestCase):
    """The gate must block regressions without blocking legitimate additions."""

    def test_growth_fails(self):
        with self.assertRaises(AssertionError):
            assert_no_growth(self, {"h": 43}, {"h": 44})

    def test_shrink_passes(self):
        assert_no_growth(self, {"h": 43}, {"h": 42})

    def test_new_homogeneous_category_passes(self):
        assert_no_growth(self, {"h": 43}, {"h": 43, "wallpaper": 0})

    def test_new_mixed_category_fails(self):
        with self.assertRaises(AssertionError):
            assert_no_growth(self, {"h": 43}, {"h": 43, "wallpaper": 2})


class GeneratedArtifactGateTests(unittest.TestCase):
    """Real-tree baseline: the anti-growth gate in CI.

    These numbers describe the shipped pool, not a fixture. Counts may fall
    (then lower the constant); they must not rise, because that would mean new
    suffix/byte drift shipped without a decision. A category that is not listed
    must be clean, so adding a homogeneous category needs no test edit.
    """

    SOURCE_MISMATCH_BASELINE = {"a": 56, "gif": 0, "h": 43, "v": 7}
    SLOT_MISMATCH_BASELINE = {"a": 125, "gif": 0, "h": 81, "v": 28}

    def test_source_mismatch_counts_do_not_grow(self):
        from pipeline.pool import audit_source_formats

        reports = audit_source_formats(Config(source_dir=ROOT / "assets" / "original"))
        assert_no_growth(
            self,
            self.SOURCE_MISMATCH_BASELINE,
            {report.category: report.mismatched for report in reports},
        )

    def test_targets_module_is_derived_from_the_manifest(self):
        from pipeline.worker_targets import render_targets

        metadata = json.loads(
            (ROOT / "assets" / "generated" / "counts.json").read_text(encoding="utf-8")
        )
        # CI already diffs the committed file against a fresh generation; this
        # proves the derivation itself, without pinning a hash that every pool
        # change would move.
        self.assertEqual(
            render_targets(Config(), metadata),
            (ROOT / "worker" / "targets.js").read_text(encoding="utf-8"),
        )

    def test_slot_formats_match_the_baseline_and_the_source_tree(self):
        from pipeline.pool import materialize_all
        from pipeline.worker_targets import render_slot_formats

        metadata = json.loads(
            (ROOT / "assets" / "generated" / "counts.json").read_text(encoding="utf-8")
        )
        formats = load_slot_formats(ROOT)
        self.assertEqual(sorted(formats), sorted(metadata["counts"]))
        for category, slots in metadata["counts"].items():
            self.assertEqual(len(formats[category]), slots, category)
        # 'p'/'w' in a '.jpg'/'.jpeg' category are exactly the slots whose bytes
        # disagree with the suffix. A no-growth baseline keeps the fix from
        # silently rotting while allowing the number to drop over time.
        assert_no_growth(
            self,
            self.SLOT_MISMATCH_BASELINE,
            {category: sum(1 for code in value if code in "pw")
             for category, value in formats.items()},
        )

        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            config = Config(
                hash_length=2,
                no_copy=True,
                source_dir=ROOT / "assets" / "original",
                output_dir=work / "assets" / "generated",
                targets_path=work / "worker" / "targets.js",
            )
            results = materialize_all(config)
            rebuilt = render_slot_formats(metadata, results)
        self.assertEqual(rebuilt, (ROOT / "worker" / "slot_formats.js").read_text(encoding="utf-8"))


class RealDataParityTests(unittest.TestCase):
    """Re-run against the repository's own sources without touching them."""

    @unittest.skipUnless((ROOT / "assets" / "generated" / "counts.json").exists(), "repository manifest missing")
    def test_repository_manifest_is_reproducible(self):
        from pipeline.manifest import build_manifest
        from pipeline.pool import materialize_all

        expected = json.loads((ROOT / "assets" / "generated" / "counts.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            config = Config(
                hash_length=2,
                no_copy=True,
                source_dir=ROOT / "assets" / "original",
                output_dir=work / "assets" / "generated",
                targets_path=work / "worker" / "targets.js",
            )
            actual = build_manifest(config, materialize_all(config))
            for key in ("categories", "counts", "real_counts", "category_exts",
                        "category_aspects", "slot_ratios", "hash_length", "output_ext"):
                self.assertEqual(actual[key], expected[key], key)
            for category in expected["counts"]:
                self.assertEqual(
                    sorted(p.name for p in (work / "assets" / "generated" / category).iterdir()),
                    sorted(p.name for p in (ROOT / "assets" / "generated" / category).iterdir()),
                    category,
                )


class WorkerTargetsTests(unittest.TestCase):
    """`worker/targets.js` is data only and is reproducible from the manifest."""

    def test_targets_module_is_reproducible_data(self):
        from pipeline.config import Config
        from pipeline.worker_targets import render_targets

        metadata = json.loads((ROOT / "assets" / "generated" / "counts.json").read_text(encoding="utf-8"))
        source = render_targets(Config(), metadata)
        self.assertTrue(source.startswith("// Generated by `python -m pipeline`. Do not edit.\n"))
        self.assertIn("export const TARGETS = JSON.parse(", source)
        self.assertNotIn("function ", source)
        self.assertEqual(
            source,
            (ROOT / "worker" / "targets.js").read_text(encoding="utf-8"),
        )


if __name__ == '__main__':
    unittest.main(verbosity=2)
