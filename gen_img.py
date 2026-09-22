#!/usr/bin/env python3
"""gen_img.py - reconstructed, minimal and clean

Produces:
 - dist/counts.json
 - dist/index.html
 - functions/pic.js
 - (optionally) dist/<category>/<hex>.<ext> files when --no-copy is not used
"""

import argparse
import json
import shutil
from pathlib import Path
from itertools import cycle
import datetime


# Defaults
DEFAULT_HASH_LENGTH = 3
DEFAULT_EXT = ".jpg"
SOURCE_DIR = Path("oriImg")
OUTPUT_DIR = Path("public")
FUNCTIONS_DIR = Path("functions")
SIZE_LIMIT_MB = 5.0


def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


def clear_dir_files(p: Path):
    if not p.exists():
        return
    for it in p.iterdir():
        if it.is_file():
            try:
                it.unlink()
            except Exception:
                pass


def process_category(category: str, src_files: list, hash_length: int, out_ext: str, do_copy: bool):

    valid_files = [
        f for f in src_files
        if f.stat().st_size / (1024 * 1024) <= SIZE_LIMIT_MB
    ]

    ignored_count = len(src_files) - len(valid_files)
    if ignored_count > 0:
        print(f"  [{category}] 忽略了 {ignored_count} 个超过 {SIZE_LIMIT_MB}MB 的文件")

    num_files = 16 ** hash_length
    out_dir = OUTPUT_DIR / category
    ensure_dir(out_dir)
    clear_dir_files(out_dir)

    if not valid_files:
        print(f"  [{category}] no valid source images (<=5MB), skipping")
        return 0, 0, out_ext

    print(f"  [{category}] {len(valid_files)} valid source images -> generating {num_files} files")
    src_cycle = cycle(valid_files)
    for i in range(num_files):
        src = next(src_cycle)
        name = f"{i:0{hash_length}x}{out_ext}"
        dst = out_dir / name
        if do_copy:
            shutil.copy2(src, dst)
        else:
            try:
                dst.write_text(f"placeholder for {src.name}\n")
            except Exception:
                pass
    return num_files, len(valid_files), out_ext


def build_counts_json(counts: dict, real_counts: dict, category_exts: dict, hash_length: int, out_ext: str):
    meta = {
        "counts": counts,
        "real_counts": real_counts,
        "category_exts": category_exts,
        "hash_length": hash_length,
        "output_ext": out_ext,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    }
    ensure_dir(OUTPUT_DIR)
    path = OUTPUT_DIR / 'counts.json'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Wrote {path}")
    return meta


def generate_cf_worker(meta: dict, out_name: str = 'pic.js'):
    """Emit the server-side entry points (Pages Function + Workers entry) that
    perform the random-image 302 redirects.
    """
    counts = meta.get('counts', {})
    h_count = counts.get('h', 0)
    v_count = counts.get('v', 0)
    hl = meta.get('hash_length', DEFAULT_HASH_LENGTH)
    ext = meta.get('output_ext', DEFAULT_EXT)

    core_logic = f"""
// ---------------------------------------------------------------------------
// Random image redirect endpoint.
//
// External contract (see README):
//   ?img=h        -> 302 to a random horizontal image
//   ?img=v        -> 302 to a random vertical image
//   ?img=ua       -> 302, orientation chosen from the User-Agent
//   anything else -> 200 plus a plain-text usage notice
//
// Images are served from /<dir>/<hex><ext>, one file per hash slot. The slot
// count is the whole hash space (16 ** hash length), and gen_img.py fills every
// slot at build time, so any randomly chosen slot is guaranteed to exist.
// ---------------------------------------------------------------------------

const HASH_LENGTH = {hl};
const IMAGE_EXT = '{ext}';

const TARGETS = {{
    h: {{ dir: 'h', slots: {h_count}, label: 'horizontal' }},
    v: {{ dir: 'v', slots: {v_count}, label: 'vertical' }},
}};

const MOBILE_UA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;

const CORS_HEADERS = {{ 'Access-Control-Allow-Origin': '*' }};

const USAGE_TEXT = [
    '🖼️ 随机图片展示器',
    '',
    '使用方法:',
    '• ?img=h - 获取横屏随机图片',
    '• ?img=v - 获取竖屏随机图片',
    '• ?img=ua - 根据设备类型自动选择图片',
    '',
].join('\\n');

function randomImagePath(target) {{
    const slot = Math.floor(Math.random() * target.slots);
    const hex = slot.toString(16).padStart(HASH_LENGTH, '0');
    return '/' + target.dir + '/' + hex + IMAGE_EXT;
}}

function resolveTarget(request) {{
    const requested = new URL(request.url).searchParams.get('img');

    if (requested === 'ua') {{
        const ua = request.headers.get('User-Agent') || '';
        return MOBILE_UA.test(ua) ? TARGETS.v : TARGETS.h;
    }}

    return Object.prototype.hasOwnProperty.call(TARGETS, requested) ? TARGETS[requested] : null;
}}

function handleRequest(request) {{
    try {{
        const target = resolveTarget(request);

        if (!target) {{
            return new Response(USAGE_TEXT, {{
                status: 200,
                headers: {{ 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS }},
            }});
        }}

        if (target.slots < 1) {{
            return new Response('No ' + target.label + ' images', {{ status: 404, headers: CORS_HEADERS }});
        }}

        return new Response(null, {{
            status: 302,
            headers: {{
                Location: randomImagePath(target),
                'Cache-Control': 'no-cache',
                ...CORS_HEADERS,
            }},
        }});
    }} catch (err) {{
        console.error('pic handler failed:', err);
        return new Response('Internal Error', {{ status: 500, headers: CORS_HEADERS }});
    }}
}}
"""

    code_functions = f"""
{core_logic}

export function onRequest(context) {{
    return handleRequest(context.request);
}}
"""

    code_index_worker = f"""
{core_logic}
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

    ensure_dir(FUNCTIONS_DIR)
    with open(FUNCTIONS_DIR / out_name, 'w', encoding='utf-8') as f:
        f.write(code_functions)
    with open('index.js', 'w', encoding='utf-8') as f:
        f.write(code_index_worker)
    print(f"Generated: {FUNCTIONS_DIR / out_name} (Pages Function)")
    print(f"Generated: index.js (Workers entry for Assets mode)")


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--hash-length','-l',type=int,default=DEFAULT_HASH_LENGTH)
    p.add_argument('--ext','-e',default=DEFAULT_EXT)
    p.add_argument('--no-copy',action='store_true')
    args = p.parse_args(argv)

    hl = args.hash_length
    ext = args.ext if args.ext.startswith('.') else '.'+args.ext
    do_copy = not args.no_copy

    if not SOURCE_DIR.exists():
        print(f"Error: source dir {SOURCE_DIR} not found.")
        return

    subdirs = [d for d in SOURCE_DIR.iterdir() if d.is_dir()]
    if not subdirs:
        print(f"No subdirectories under {SOURCE_DIR}.")
        return

    counts = {}
    real_counts = {}
    category_exts = {}

    exts = {'.jpg','.jpeg','.png','.gif','.webp'}
    for sd in sorted(subdirs):
        imgs = sorted([f for f in sd.iterdir() if f.is_file() and f.suffix.lower() in exts])

        valid_imgs = [
            f for f in imgs
            if f.stat().st_size / (1024 * 1024) <= SIZE_LIMIT_MB
        ]

        if not valid_imgs:
            counts[sd.name]=0
            real_counts[sd.name]=0
            category_exts[sd.name]=ext
            continue

        if sd.name in ['h', 'v']:
            current_category_ext = ext
        elif sd.name in ['gif']:
            current_category_ext = '.gif'
        elif sd.name in ['a']:
            current_category_ext = '.jpeg'
        else:
            current_category_ext = valid_imgs[0].suffix.lower()

        num, real_num, used_ext = process_category(sd.name, imgs, hl, current_category_ext, do_copy)

        counts[sd.name] = num
        real_counts[sd.name] = real_num
        category_exts[sd.name] = used_ext

    meta = build_counts_json(counts, real_counts, category_exts, hl, ext)

    generate_cf_worker(meta, 'pic.js')

if __name__ == '__main__':
    main()