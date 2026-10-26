#!/usr/bin/env python3
"""gen_img.py - Image set generator and Cloudflare Worker / Pages Function builder.

Produces:
 - public/counts.json
 - functions/pic.js
 - index.js
 - (optionally) public/<category>/<hex>.<ext> files when --no-copy is not used
"""

import argparse
from dataclasses import dataclass, field
import datetime
import ipaddress
from itertools import cycle
import json
from pathlib import Path
import re
import shutil
import struct
import sys
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlsplit

# Defaults
DEFAULT_HASH_LENGTH = 2
DEFAULT_EXT = ".jpg"
SIZE_LIMIT_MB = 5.0
SOURCE_DIR = Path("oriImg")
OUTPUT_DIR = Path("public")
FUNCTIONS_DIR = Path("functions")

ALLOWED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp')

LABEL_MAP: Dict[str, str] = {
    'h': 'horizontal',
    'v': 'vertical',
    'a': 'avatar',
    'gif': 'gif',
}

DESC_MAP: Dict[str, str] = {
    'h': '横屏随机图片',
    'v': '竖屏随机图片',
    'a': '头像随机图片',
    'gif': 'GIF 随机动图',
}

LABEL_ZH_MAP: Dict[str, str] = {
    'h': '横屏壁纸',
    'v': '竖屏壁纸',
    'a': '头像素材',
    'gif': '动态动图',
}

LABEL_EN_MAP: Dict[str, str] = {
    'h': 'Landscape',
    'v': 'Portrait',
    'a': 'Avatar',
    'gif': 'GIF',
}

def get_image_size(file_path: Path) -> Tuple[Optional[int], Optional[int]]:
    """Pure-Python image dimension detection (no PIL dependency)."""
    try:
        with open(file_path, "rb") as f:
            head = f.read(32)
            if head.startswith(b"\x89PNG\r\n\x1a\n"):
                w, h = struct.unpack(">II", head[16:24])
                return w, h
            elif head[:6] in (b"GIF87a", b"GIF89a"):
                w, h = struct.unpack("<HH", head[6:10])
                return w, h
            elif head.startswith(b"RIFF") and head[8:12] == b"WEBP":
                if head[12:16] == b"VP8 ":
                    f.seek(26)
                    w, h = struct.unpack("<HH", f.read(4))
                    return w & 0x3FFF, h & 0x3FFF
                elif head[12:16] == b"VP8L":
                    f.seek(21)
                    b = f.read(4)
                    w = 1 + (((b[1] & 0x3F) << 8) | b[0])
                    h = 1 + (((b[3] & 0x0F) << 10) | (b[2] << 2) | ((b[1] & 0xC0) >> 6))
                    return w, h
                elif head[12:16] == b"VP8X":
                    f.seek(24)
                    w_bytes = f.read(3)
                    h_bytes = f.read(3)
                    w = 1 + struct.unpack("<I", w_bytes + b"\x00")[0]
                    h = 1 + struct.unpack("<I", h_bytes + b"\x00")[0]
                    return w, h
            elif head.startswith(b"\xff\xd8"):
                f.seek(2)
                while True:
                    marker_bytes = f.read(2)
                    if not marker_bytes or len(marker_bytes) < 2 or marker_bytes[0] != 0xFF:
                        break
                    marker = marker_bytes[1]
                    if marker in (0xC0, 0xC1, 0xC2, 0xC3):
                        f.read(3)
                        h, w = struct.unpack(">HH", f.read(4))
                        return w, h
                    elif marker in (0xD9, 0xDA):
                        break
                    else:
                        length_bytes = f.read(2)
                        if len(length_bytes) < 2:
                            break
                        length = struct.unpack(">H", length_bytes)[0]
                        f.seek(length - 2, 1)
    except Exception:
        pass
    return None, None

def detect_aspect_ratio(w: Optional[int], h: Optional[int], ext: str) -> Tuple[Optional[str], str]:
    if ext.lower() == '.gif' or not w or not h:
        return None, "动态格式"
    ratio = w / h
    if 0.92 <= ratio <= 1.08:
        return "1/1", "1:1"
    elif ratio >= 1.55:
        return "16/9", "16:9"
    elif ratio >= 1.15:
        return "4/3", "4:3"
    elif ratio <= 0.65:
        return "9/16", "9:16"
    elif ratio <= 0.88:
        return "3/4", "3:4"
    else:
        return f"{w}/{h}", f"{w}:{h}"

# 1x1 Minimal valid image bytes for lightning-fast dev placeholder generation
TINY_JPEG = bytes([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
    0x00, 0xBF, 0x80, 0xFF, 0xD9
])

TINY_GIF = bytes([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xEE, 0xEE, 0xEE, 0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B
])

TINY_PNG = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
])


def default_access_policy() -> dict:
    """Portable defaults when no access-policy.json exists in the working directory."""
    return {
        'version': 1,
        'referer': {
            'enabled': True,
            'allowMissing': True,
            'allowSameOrigin': True,
            'allowedHosts': [],
        },
        'cors': {'allowSameOrigin': True, 'allowedOrigins': []},
        'protectAssetImages': True,
    }


def validate_access_policy(policy: dict) -> dict:
    """Validate the complete v1 configuration; typos must fail the build closed."""
    def check_keys(value, keys, location):
        if not isinstance(value, dict) or set(value) != set(keys):
            raise ValueError(f'{location} must contain exactly: {", ".join(keys)}')

    def check_bool(value, location):
        if type(value) is not bool:
            raise ValueError(f'{location} must be a JSON boolean')

    def check_host(host):
        if not isinstance(host, str) or not host or host != host.strip():
            raise ValueError('hostnames must be nonempty strings without whitespace')
        try:
            ipaddress.ip_address(host)
            return
        except ValueError:
            if len(host) > 253 or not all(
                re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?', label)
                for label in host.split('.')
            ):
                raise ValueError(f'invalid hostname: {host!r}') from None

    check_keys(policy, ('version', 'referer', 'cors', 'protectAssetImages'), 'access policy')
    if type(policy['version']) is not int or policy['version'] != 1:
        raise ValueError('access policy version must be 1')
    ref = policy['referer']
    cors = policy['cors']
    check_keys(ref, ('enabled', 'allowMissing', 'allowSameOrigin', 'allowedHosts'), 'referer')
    check_keys(cors, ('allowSameOrigin', 'allowedOrigins'), 'cors')
    for name in ('enabled', 'allowMissing', 'allowSameOrigin'):
        check_bool(ref[name], f'referer.{name}')
    check_bool(cors['allowSameOrigin'], 'cors.allowSameOrigin')
    check_bool(policy['protectAssetImages'], 'protectAssetImages')
    if not isinstance(ref['allowedHosts'], list) or not isinstance(cors['allowedOrigins'], list):
        raise ValueError('allowedHosts and allowedOrigins must be arrays')
    hosts = []
    for pattern in ref['allowedHosts']:
        if not isinstance(pattern, str):
            raise ValueError('referer.allowedHosts entries must be strings')
        host = pattern[2:] if pattern.startswith('*.') else pattern
        check_host(host)
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if pattern.startswith('*.') and address is not None:
            raise ValueError('wildcard IP addresses are not supported')
        hosts.append(address.compressed if address is not None else pattern.lower())
    origins = []
    for origin in cors['allowedOrigins']:
        if (not isinstance(origin, str) or not origin or
                any(ord(char) <= 32 or ord(char) == 127 for char in origin) or '\\' in origin):
            raise ValueError('cors.allowedOrigins entries must be exact HTTP(S) origins')
        parsed = urlsplit(origin)
        if (parsed.scheme not in ('http', 'https') or not parsed.hostname or
                parsed.username is not None or parsed.password is not None or
                parsed.path or parsed.netloc.endswith(':') or '?' in origin or '#' in origin):
            raise ValueError(f'invalid CORS origin: {origin!r}; use scheme://host[:port]')
        check_host(parsed.hostname)
        port = parsed.port  # Raises ValueError for malformed or out-of-range ports.
        hostname = parsed.hostname.lower()
        if ':' in hostname:
            hostname = f'[{ipaddress.ip_address(hostname).compressed}]'
        default_port = 443 if parsed.scheme == 'https' else 80
        port_suffix = f':{port}' if port is not None and port != default_port else ''
        origins.append(f'{parsed.scheme}://{hostname}{port_suffix}')
    return {
        'version': 1,
        'referer': {**ref, 'allowedHosts': hosts},
        'cors': {**cors, 'allowedOrigins': origins},
        'protectAssetImages': policy['protectAssetImages'],
    }


def load_access_policy(path: Optional[Path] = None) -> dict:
    selected = path if path is not None else Path('access-policy.json')
    if path is None and not selected.exists():
        return default_access_policy()
    with selected.open('r', encoding='utf-8-sig') as source:
        return validate_access_policy(json.load(source))


@dataclass
class Config:
    hash_length: int = DEFAULT_HASH_LENGTH
    default_ext: str = DEFAULT_EXT
    no_copy: bool = False
    source_dir: Path = SOURCE_DIR
    output_dir: Path = OUTPUT_DIR
    functions_dir: Path = FUNCTIONS_DIR
    size_limit_mb: float = SIZE_LIMIT_MB
    allowed_extensions: tuple = field(default_factory=lambda: ALLOWED_EXTENSIONS)
    access_policy: dict = field(default_factory=default_access_policy)

    def __post_init__(self):
        if not self.default_ext.startswith('.'):
            self.default_ext = f".{self.default_ext}"

    @property
    def num_slots(self) -> int:
        return 16 ** self.hash_length

    @classmethod
    def from_args(cls, argv: Optional[List[str]] = None) -> "Config":
        parser = argparse.ArgumentParser(
            description="Generate hashed image sets and Cloudflare Worker / Pages redirect endpoints."
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
            '--access-policy',
            type=Path,
            help='Access policy JSON to embed in both backends (default: ./access-policy.json, or portable defaults if absent)'
        )
        args = parser.parse_args(argv)
        try:
            access_policy = load_access_policy(args.access_policy)
        except (OSError, ValueError) as exc:
            parser.error(f'cannot load access policy: {exc}')
        return cls(
            hash_length=args.hash_length,
            default_ext=args.ext,
            no_copy=args.no_copy,
            access_policy=access_policy,
        )


@dataclass
class CategoryResult:
    name: str
    slots: int
    real_count: int
    ext: str
    label: str
    description: str
    name_zh: str = ""
    name_en: str = ""
    aspect: Optional[str] = None
    aspect_hint: str = "自适应"


class ImageProcessor:
    def __init__(self, config: Config):
        self.config = config

    @staticmethod
    def ensure_dir(path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def clear_dir_files(path: Path) -> None:
        if not path.exists():
            return
        for item in path.iterdir():
            if item.is_file():
                try:
                    item.unlink()
                except Exception:
                    pass

    def filter_valid_images(self, category: str, images: List[Path]) -> List[Path]:
        """Apply single-file size limit circuit breaker."""
        valid: List[Path] = []
        ignored_count = 0
        for img in images:
            size_mb = img.stat().st_size / (1024 * 1024)
            if size_mb <= self.config.size_limit_mb:
                valid.append(img)
            else:
                ignored_count += 1

        if ignored_count > 0:
            print(f"  [{category}] 忽略了 {ignored_count} 个超过 {self.config.size_limit_mb}MB 的文件")
        return valid

    def resolve_category_extension(self, category: str, valid_images: List[Path]) -> str:
        if category in ('h', 'v'):
            return self.config.default_ext
        if category == 'gif':
            return '.gif'
        if category == 'a':
            return '.jpeg'
        if valid_images:
            return valid_images[0].suffix.lower()
        return self.config.default_ext

    def process_category(self, category: str, raw_images: List[Path]) -> CategoryResult:
        valid_images = self.filter_valid_images(category, raw_images)
        cat_ext = self.resolve_category_extension(category, valid_images)
        label = LABEL_MAP.get(category, category)
        desc = DESC_MAP.get(category, f'{category} 随机图片')

        out_dir = self.config.output_dir / category
        self.ensure_dir(out_dir)
        self.clear_dir_files(out_dir)

        if not valid_images:
            print(f"  [{category}] no valid source images (<={self.config.size_limit_mb}MB), skipping")
            return CategoryResult(
                name=category,
                slots=0,
                real_count=0,
                ext=cat_ext,
                label=label,
                description=desc,
                name_zh=LABEL_ZH_MAP.get(category, category.capitalize()),
                name_en=LABEL_EN_MAP.get(category, category.capitalize()),
                aspect=None,
                aspect_hint="暂无素材",
            )

        # Auto-detect aspect ratio from the first valid image
        width, height = get_image_size(valid_images[0])
        aspect, aspect_hint = detect_aspect_ratio(width, height, cat_ext)

        # Check for optional category meta.json
        cat_meta_file = self.config.source_dir / category / "meta.json"
        cat_meta = {}
        if cat_meta_file.exists():
            try:
                with open(cat_meta_file, 'r', encoding='utf-8') as f:
                    cat_meta = json.load(f)
            except Exception:
                pass

        name_zh = cat_meta.get('name_zh') or LABEL_ZH_MAP.get(category, category.capitalize())
        name_en = cat_meta.get('name_en') or LABEL_EN_MAP.get(category, category.capitalize())
        if 'aspect' in cat_meta:
            aspect = cat_meta['aspect']
        if 'aspect_hint' in cat_meta:
            aspect_hint = cat_meta['aspect_hint']

        num_slots = self.config.num_slots
        print(f"  [{category}] {len(valid_images)} valid source images -> generating {num_slots} files")

        src_cycle = cycle(valid_images)
        for i in range(num_slots):
            src = next(src_cycle)
            filename = f"{i:0{self.config.hash_length}x}{cat_ext}"
            dst = out_dir / filename
            if not self.config.no_copy:
                shutil.copy2(src, dst)
            else:
                try:
                    ext_lower = cat_ext.lower()
                    if ext_lower in ('.jpg', '.jpeg'):
                        dst.write_bytes(TINY_JPEG)
                    elif ext_lower == '.gif':
                        dst.write_bytes(TINY_GIF)
                    elif ext_lower == '.png':
                        dst.write_bytes(TINY_PNG)
                    else:
                        dst.write_bytes(TINY_JPEG)
                except Exception:
                    pass

        return CategoryResult(
            name=category,
            slots=num_slots,
            real_count=len(valid_images),
            ext=cat_ext,
            label=label,
            description=desc,
            name_zh=name_zh,
            name_en=name_en,
            aspect=aspect,
            aspect_hint=aspect_hint,
        )

    def process_all(self) -> List[CategoryResult]:
        if not self.config.source_dir.exists():
            print(f"Error: source dir {self.config.source_dir} not found.")
            return []

        subdirs = sorted([d for d in self.config.source_dir.iterdir() if d.is_dir()])
        if not subdirs:
            print(f"No subdirectories under {self.config.source_dir}.")
            return []

        results: List[CategoryResult] = []
        for sd in subdirs:
            imgs = sorted([
                f for f in sd.iterdir()
                if f.is_file() and f.suffix.lower() in self.config.allowed_extensions
            ])
            res = self.process_category(sd.name, imgs)
            results.append(res)
        return results


class MetadataManager:
    def __init__(self, config: Config):
        self.config = config

    def build_metadata(self, results: List[CategoryResult]) -> dict:
        counts = {r.name: r.slots for r in results}
        real_counts = {r.name: r.real_count for r in results}
        category_exts = {r.name: r.ext for r in results}
        category_aspects = {r.name: r.aspect for r in results}

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

        path = self.config.output_dir / 'counts.json'
        timestamp = None
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                if (
                    existing.get('counts') == counts and
                    existing.get('real_counts') == real_counts and
                    existing.get('category_exts') == category_exts and
                    existing.get('hash_length') == self.config.hash_length and
                    existing.get('output_ext') == self.config.default_ext
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
            "hash_length": self.config.hash_length,
            "output_ext": self.config.default_ext,
            "generated_at": timestamp
        }
        return meta

    def save_counts_json(self, meta: dict) -> Path:
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        path = self.config.output_dir / 'counts.json'
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        print(f"Wrote {path}")
        return path


class WorkerGenerator:
    def __init__(self, config: Config):
        self.config = config

    def generate_worker_code(
        self,
        meta: dict,
        results: Optional[List[CategoryResult]] = None
    ) -> Tuple[str, str]:
        counts = meta.get('counts', {})
        category_exts = meta.get('category_exts', {})
        hl = meta.get('hash_length', self.config.hash_length)
        ext = meta.get('output_ext', self.config.default_ext)

        label_lookup = {}
        if results:
            for r in results:
                label_lookup[r.name] = r.label

        # Serialize configuration and category data as JSON rather than executable input.
        targets = {
            cat: {
                'dir': cat,
                'slots': counts[cat],
                'ext': category_exts.get(cat, ext),
                'label': label_lookup.get(cat, LABEL_MAP.get(cat, cat)),
            }
            for cat in sorted(counts)
        }
        policy = validate_access_policy(self.config.access_policy)
        core_logic = f"""
// Generated by gen_img.py. Edit access-policy.json, then regenerate both backends.
// ACCESS_POLICY is embedded at build time, not loaded from the network or env.
// Referer: exact hosts match only themselves; *.example.com matches subdomains
// at a dot boundary (including nested ones), but never example.com itself.
// CORS: exact HTTP(S) origins, independent of Referer hosts. A supplied Origin
// must be allowed, even when Referer is absent or its validation is disabled.
// Same-origin permission uses the actual request URL; no deployment domain is hardcoded.
// OPTIONS checks Origin, not Referer: browsers may omit Referer on preflight.
// Missing Referer is controlled explicitly and is not authentication.
const ACCESS_POLICY = {json.dumps(policy, ensure_ascii=True, indent=2)};
const HASH_LENGTH = {hl};
const IMAGE_EXT = {json.dumps(ext)};
const TARGETS = JSON.parse({json.dumps(json.dumps(targets, ensure_ascii=True))});
""" + r"""
const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
const METHODS = ['GET', 'HEAD', 'OPTIONS'];

function parseHttpUrl(value) {
    if (!/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        return url;
    } catch {
        return null;
    }
}

function allowedOrigin(request) {
    const origin = request.headers.get('Origin');
    if (origin === null) return true;
    const parsed = parseHttpUrl(origin);
    if (!parsed || parsed.origin !== origin) return false;
    return (ACCESS_POLICY.cors.allowSameOrigin && origin === new URL(request.url).origin) ||
        ACCESS_POLICY.cors.allowedOrigins.includes(origin);
}

function allowedReferer(request) {
    const policy = ACCESS_POLICY.referer;
    if (!policy.enabled) return true;
    const referer = request.headers.get('Referer');
    if (referer === null || referer.trim() === '') return policy.allowMissing;
    const parsed = parseHttpUrl(referer);
    if (!parsed) return false;
    if (policy.allowSameOrigin && parsed.origin === new URL(request.url).origin) return true;
    // URL.hostname includes brackets for IPv6; configuration uses plain IP literals.
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return policy.allowedHosts.some(pattern => pattern.startsWith('*.')
        ? host.endsWith(pattern.slice(1)) && host !== pattern.slice(2)
        : host === pattern);
}

function responseHeaders(request, initial = {}) {
    const headers = new Headers(initial);
    const vary = new Set((headers.get('Vary') || '').split(',').map(s => s.trim()).filter(Boolean));
    for (const field of ['Origin', 'Referer']) vary.add(field);
    if (request.method === 'OPTIONS') {
        vary.add('Access-Control-Request-Method');
        vary.add('Access-Control-Request-Headers');
    }
    headers.set('Vary', [...vary].join(', '));
    // A protected asset must pass policy on every request, including after a CDN hit.
    headers.set('Cache-Control', 'private, no-store');
    for (const name of ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials',
        'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers', 'Access-Control-Max-Age']) {
        headers.delete(name);
    }
    const origin = request.headers.get('Origin');
    if (origin !== null && allowedOrigin(request)) headers.set('Access-Control-Allow-Origin', origin);
    return headers;
}

function errorResponse(request, status, message, initial = {}) {
    const headers = responseHeaders(request, initial);
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    return new Response(request.method === 'HEAD' ? null : message, { status, headers });
}

function checkAccess(request) {
    if (!allowedOrigin(request)) return errorResponse(request, 403, '403 Forbidden: Origin not allowed');
    if (!METHODS.includes(request.method)) {
        return errorResponse(request, 405, '405 Method Not Allowed', { Allow: METHODS.join(', ') });
    }
    if (request.method === 'OPTIONS') {
        const method = request.headers.get('Access-Control-Request-Method');
        if (method !== null && !['GET', 'HEAD'].includes(method)) {
            return errorResponse(request, 405, '405 Preflight Method Not Allowed', { Allow: METHODS.join(', ') });
        }
        const headers = responseHeaders(request);
        headers.set('Access-Control-Allow-Methods', METHODS.join(', '));
        const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
        if (requestedHeaders) {
            // Reflect only syntactically valid HTTP field names, never arbitrary input.
            if (!requestedHeaders.split(',').every(name => /^[!#$%&'*+.^_\x60|~0-9A-Za-z-]+$/.test(name.trim()))) {
                return errorResponse(request, 400, '400 Invalid Preflight Headers');
            }
            headers.set('Access-Control-Allow-Headers', requestedHeaders);
        }
        headers.set('Access-Control-Max-Age', '86400');
        return new Response(null, { status: 204, headers });
    }
    if (!allowedReferer(request)) return errorResponse(request, 403, '403 Forbidden: Referer not allowed');
    return null;
}

function randomImagePath(target) {
    const slot = Math.floor(Math.random() * target.slots);
    const hex = slot.toString(16).padStart(HASH_LENGTH, '0');
    return '/' + encodeURIComponent(target.dir) + '/' + hex + (target.ext || IMAGE_EXT);
}

function resolveTarget(request) {
    const requested = new URL(request.url).searchParams.get('img');
    if (requested === 'ua') {
        const ua = request.headers.get('User-Agent') || '';
        return (MOBILE_UA.test(ua) ? TARGETS.v : TARGETS.h) || null;
    }
    return Object.prototype.hasOwnProperty.call(TARGETS, requested) ? TARGETS[requested] : null;
}

function handleRequest(request) {
    try {
        const blocked = checkAccess(request);
        if (blocked) return blocked;
        const target = resolveTarget(request);
        if (!target || target.slots < 1) return errorResponse(request, 404, '404 Not Found');
        return new Response(null, {
            status: 302,
            headers: responseHeaders(request, { Location: randomImagePath(target) }),
        });
    } catch (err) {
        console.error('pic handler failed:', err);
        return errorResponse(request, 500, 'Internal Error');
    }
}
"""

        code_functions = core_logic + """
// Cloudflare Pages: this file protects /pic only. /api/pic requires a separate
// Pages route; static image protection requires Pages middleware or edge rules.
export function onRequest(context) {
    return handleRequest(context.request);
}
"""

        code_index_worker = core_logic + r"""
function isCategoryImage(pathname) {
    let parts;
    try {
        parts = decodeURIComponent(pathname).split('/');
    } catch {
        return false;
    }
    if (parts.length !== 3 || !Object.prototype.hasOwnProperty.call(TARGETS, parts[1])) return false;
    // Protect image files in generated categories, including encoded paths, but
    // do not gate HTML, counts.json, application scripts, icons or other metadata.
    return /\.(?:jpe?g|png|gif|webp)$/i.test(parts[2]);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/pic' || url.pathname === '/api/pic') return handleRequest(request);
        if (!ACCESS_POLICY.protectAssetImages || !isCategoryImage(url.pathname)) {
            return env.ASSETS.fetch(request);
        }
        // Requires assets.run_worker_first = true. Otherwise asset hits bypass
        // the Worker entirely; env.ASSETS.fetch safely delegates after the check.
        try {
            const blocked = checkAccess(request);
            if (blocked) return blocked;
            const asset = await env.ASSETS.fetch(request);
            return new Response(request.method === 'HEAD' ? null : asset.body, {
                status: asset.status,
                statusText: asset.statusText,
                headers: responseHeaders(request, asset.headers),
            });
        } catch (err) {
            console.error('protected image asset failed:', err);
            return errorResponse(request, 500, 'Internal Error');
        }
    }
};
"""
        return code_functions, code_index_worker

    def save_worker_files(
        self,
        code_functions: str,
        code_index_worker: str,
        out_name: str = 'pic.js'
    ) -> None:
        self.config.functions_dir.mkdir(parents=True, exist_ok=True)
        func_file = self.config.functions_dir / out_name
        with open(func_file, 'w', encoding='utf-8', newline='\n') as f:
            f.write(code_functions)

        index_file = Path('index.js')
        with open(index_file, 'w', encoding='utf-8', newline='\n') as f:
            f.write(code_index_worker)

        print(f"Generated: {func_file} (Pages Function)")
        print(f"Generated: {index_file} (Workers entry for Assets mode)")


def main(argv: Optional[List[str]] = None) -> None:
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    config = Config.from_args(argv)
    processor = ImageProcessor(config)
    results = processor.process_all()
    if not results:
        return

    meta_mgr = MetadataManager(config)
    meta = meta_mgr.build_metadata(results)
    meta_mgr.save_counts_json(meta)

    worker_gen = WorkerGenerator(config)
    code_functions, code_index_worker = worker_gen.generate_worker_code(meta, results)
    worker_gen.save_worker_files(code_functions, code_index_worker, 'pic.js')


if __name__ == '__main__':
    main()
