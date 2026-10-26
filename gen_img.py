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
from itertools import cycle
import json
from pathlib import Path
import shutil
import struct
import sys
from typing import Dict, List, Optional, Tuple

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
        args = parser.parse_args(argv)
        return cls(
            hash_length=args.hash_length,
            default_ext=args.ext,
            no_copy=args.no_copy,
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

        desc_lookup = {}
        label_lookup = {}
        if results:
            for r in results:
                desc_lookup[r.name] = r.description
                label_lookup[r.name] = r.label

        target_entries = []
        for cat in sorted(counts.keys()):
            slots = counts[cat]
            cat_ext = category_exts.get(cat, ext)
            label = label_lookup.get(cat, LABEL_MAP.get(cat, cat))
            target_entries.append(
                f"    '{cat}': {{ dir: '{cat}', slots: {slots}, ext: '{cat_ext}', label: '{label}' }},"
            )
        targets_code = "\n".join(target_entries)

        core_logic = f"""
// ---------------------------------------------------------------------------
// Random image redirect endpoint.
//
// External contract (see README):
//   ?img=h        -> 302 to a random horizontal image
//   ?img=v        -> 302 to a random vertical image
//   ?img=a        -> 302 to a random avatar image
//   ?img=gif      -> 302 to a random gif image
//   ?img=ua       -> 302, orientation chosen from the User-Agent
//   anything else -> 404 Not Found
//
// Security & Access Control:
//   - Referer Hotlinking Protection: Whitelisted hostnames (*.srprolin.top,
//     *.srprolin.com, localhost, 127.0.0.1) or empty/missing Referer allowed;
//     disallowed Referer requests receive 403 Forbidden.
//   - Dynamic CORS: Whitelisted Origins receive Access-Control-Allow-Origin
//     and Vary: Origin headers; OPTIONS preflight returns 204.
//
// Images are served from /<dir>/<hex><ext>, one file per hash slot. The slot
// count is the whole hash space (16 ** hash length), and gen_img.py fills every
// slot at build time, so any randomly chosen slot is guaranteed to exist.
// ---------------------------------------------------------------------------

const HASH_LENGTH = {hl};
const IMAGE_EXT = '{ext}';

const TARGETS = {{
{targets_code}
}};

const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;

function isAllowedHost(hostname) {{
    if (!hostname) return false;
    const host = hostname.toLowerCase();
    return (
        host === 'srprolin.top' ||
        host.endsWith('.srprolin.top') ||
        host === 'srprolin.com' ||
        host.endsWith('.srprolin.com') ||
        host === 'localhost' ||
        host === '127.0.0.1'
    );
}}

function checkReferer(request) {{
    const referer = request.headers.get('Referer');
    if (!referer || referer.trim() === '') {{
        return true;
    }}
    try {{
        const url = new URL(referer);
        return isAllowedHost(url.hostname);
    }} catch {{
        return false;
    }}
}}

function getCorsHeaders(request) {{
    const origin = request.headers.get('Origin');
    if (!origin) {{
        return {{}};
    }}
    try {{
        const url = new URL(origin);
        if (isAllowedHost(url.hostname)) {{
            return {{
                'Access-Control-Allow-Origin': origin,
                'Vary': 'Origin',
            }};
        }}
    }} catch {{
        // Ignore invalid Origin URL
    }}
    return {{}};
}}

function handleOptions(request) {{
    const origin = request.headers.get('Origin');
    if (origin) {{
        try {{
            const url = new URL(origin);
            if (isAllowedHost(url.hostname)) {{
                return new Response(null, {{
                    status: 204,
                    headers: {{
                        'Access-Control-Allow-Origin': origin,
                        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
                        'Access-Control-Max-Age': '86400',
                        'Vary': 'Origin',
                    }},
                }});
            }}
        }} catch {{
            // Ignore invalid Origin URL
        }}
    }}
    return new Response(null, {{ status: 204 }});
}}

function randomImagePath(target) {{
    const slot = Math.floor(Math.random() * target.slots);
    const hex = slot.toString(16).padStart(HASH_LENGTH, '0');
    return '/' + target.dir + '/' + hex + (target.ext || IMAGE_EXT);
}}

function resolveTarget(request) {{
    const requested = new URL(request.url).searchParams.get('img');

    if (requested === 'ua') {{
        const ua = request.headers.get('User-Agent') || '';
        return (MOBILE_UA.test(ua) ? TARGETS.v : TARGETS.h) || null;
    }}

    return Object.prototype.hasOwnProperty.call(TARGETS, requested) ? TARGETS[requested] : null;
}}

function handleRequest(request) {{
    try {{
        if (request.method === 'OPTIONS') {{
            return handleOptions(request);
        }}

        if (!checkReferer(request)) {{
            return new Response('403 Forbidden: Hotlinking not allowed', {{
                status: 403,
                headers: {{ 'Content-Type': 'text/plain; charset=utf-8' }},
            }});
        }}

        const corsHeaders = getCorsHeaders(request);
        const target = resolveTarget(request);

        if (!target) {{
            return new Response('404 Not Found', {{
                status: 404,
                headers: {{ 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders }},
            }});
        }}

        if (target.slots < 1) {{
            return new Response('404 Not Found', {{
                status: 404,
                headers: {{ 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders }},
            }});
        }}

        return new Response(null, {{
            status: 302,
            headers: {{
                Location: randomImagePath(target),
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                ...corsHeaders,
            }},
        }});
    }} catch (err) {{
        console.error('pic handler failed:', err);
        return new Response('Internal Error', {{ status: 500, headers: getCorsHeaders(request) }});
    }}
}}
"""

        code_functions = f"""{core_logic}
export function onRequest(context) {{
    return handleRequest(context.request);
}}
"""

        code_index_worker = f"""{core_logic}
export default {{
    async fetch(request, env, ctx) {{
        const url = new URL(request.url);

        if (url.pathname === '/pic' || url.pathname === '/api/pic') {{
            return handleRequest(request);
        }}

        return env.ASSETS.fetch(request);
    }}
}};
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
