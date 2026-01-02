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
OUTPUT_DIR = Path("dist")
FUNCTIONS_DIR = Path("functions")


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
    num_files = 16 ** hash_length
    out_dir = OUTPUT_DIR / category
    ensure_dir(out_dir)
    clear_dir_files(out_dir)

    if not src_files:
        print(f"  [{category}] no source images, skipping")
        return 0

    print(f"  [{category}] {len(src_files)} source images -> generating {num_files} files to {out_dir}")
    src_cycle = cycle(src_files)
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
    return num_files


def build_counts_json(counts: dict, hash_length: int, out_ext: str, domain: str = ""):
    meta = {
        "counts": counts,
        "hash_length": hash_length,
        "output_ext": out_ext,
        "domain": domain,
        "generated_at": datetime.datetime.utcnow().isoformat() + 'Z'
    }
    ensure_dir(OUTPUT_DIR)
    path = OUTPUT_DIR / 'counts.json'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Wrote {path}")
    return meta


def generate_cf_redirect(meta: dict, out_name: str = 'pic.client.js'):
    counts = meta.get('counts', {})
    hl = meta.get('hash_length', DEFAULT_HASH_LENGTH)
    ext = meta.get('output_ext', DEFAULT_EXT)

    js = []
    js.append('/* Auto-generated pic.client.js */')
    js.append(f'const COUNTS = {json.dumps(counts)};')
    js.append(f'const HASH_LENGTH = {hl};')
    js.append(f"const OUTPUT_EXT = '{ext}';")
    js.append('function padHex(n,len){return n.toString(16).padStart(len,"0");}')
    js.append('function hexName(idx){return padHex(idx,HASH_LENGTH)+OUTPUT_EXT;}')
    js.append('function isMobile(ua){if(!ua) return false; ua=ua.toLowerCase();return /android|iphone|ipad|ipod|mobile|iemobile|opera mini/.test(ua);}')
    js.append('function rnd(count){return Math.floor(Math.random()*count);}')
    js.append('''
try{
  var sp=new URLSearchParams(window.location.search);
  var img=sp.get('img');
  if(img==='h'||img==='v'){ var c=COUNTS[img]||0; if(c) window.location.href='/' + img + '/' + hexName(rnd(c)); }
  else if(img==='ua'){ var ua=navigator.userAgent||''; if(isMobile(ua)){ var c=COUNTS['v']||0; if(c) window.location.href='/v/'+hexName(rnd(c)); } else { var c=COUNTS['h']||0; if(c) window.location.href='/h/'+hexName(rnd(c)); } }
}catch(e){}
''')

    # write into repository root functions/ so Pages (or wrangler) can pick it up
    functions_dir = FUNCTIONS_DIR
    ensure_dir(functions_dir)
    path = functions_dir / out_name
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(js))
    print(f"Wrote {path}")


def generate_index_html(meta: dict):
    counts = meta.get('counts', {})
    hl = meta.get('hash_length', DEFAULT_HASH_LENGTH)
    ext = meta.get('output_ext', DEFAULT_EXT)

    parts = ['<!doctype html>','<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">','<title>Gallery</title>','<style>body{font-family:sans-serif;padding:20px;background:#f0f2f5}.grid{display:flex;flex-wrap:wrap;gap:10px}.grid-item{width:23%;background:#fff;border-radius:4px;overflow:hidden;min-height:150px}img{width:100%;display:block}</style>','</head><body>','<h1>Gallery</h1>','<div class="grid">']

    for t,c in counts.items():
        if c==0: continue
        for i in range(min(c,64)):
            name = f"{i:0{hl}x}{ext}"
            url = f"./{t}/{name}"
            parts.append(f'<div class="grid-item" data-type="{t}"><img src="{url}" alt="{t}-{i}" loading="lazy"></div>')

    parts.append('</div>')
    parts.append('<script>function filterAll(){document.querySelectorAll(\'.grid-item\').forEach(e=>e.style.display=\'block\');}</script>')
    parts.append('</body></html>')

    ensure_dir(OUTPUT_DIR)
    path = OUTPUT_DIR / 'index.html'
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(parts))
    print(f"Wrote {path}")


def generate_cf_worker(meta: dict, out_name: str = 'pic.js'):
    """Generate a server-side Cloudflare Pages Function / Worker that performs UA-based 302 redirects.
    The function exports onRequest(context) to be compatible with EdgeOne/Pages function style used in this repo.
    """
    counts = meta.get('counts', {})
    h_count = counts.get('h', 0)
    v_count = counts.get('v', 0)
    hl = meta.get('hash_length', DEFAULT_HASH_LENGTH)
    ext = meta.get('output_ext', DEFAULT_EXT)

    # Build worker code (ES module style with exported onRequest)
    code = f"""
// Auto-generated Cloudflare Pages Function (server-side)
export function onRequest(context) {{
    return handleRequest(context.request);
}}

function isMobileDevice(ua) {{
    if(!ua) return false;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua.toLowerCase());
}}

function hexName(idx) {{
    return idx.toString(16).padStart({hl}, '0') + '{ext}';
}}

async function handleRequest(request) {{
    try {{
        const url = new URL(request.url);
        const img = url.searchParams.get('img');

        const maxH = {h_count};
        const maxV = {v_count};

        if(img === 'h') {{
            if(!maxH) return new Response('No horizontal images', {{status:404}});
            const idx = Math.floor(Math.random()*maxH);
            const location = '/h/' + hexName(idx);
            return new Response(null, {{status:302, headers: {{ 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }}}});
        }} else if(img === 'v') {{
            if(!maxV) return new Response('No vertical images', {{status:404}});
            const idx = Math.floor(Math.random()*maxV);
            const location = '/v/' + hexName(idx);
            return new Response(null, {{status:302, headers: {{ 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }}}});
        }} else if(img === 'ua') {{
            const ua = request.headers.get('User-Agent') || '';
            if(isMobileDevice(ua)) {{
                if(!maxV) return new Response('No vertical images', {{status:404}});
                const idx = Math.floor(Math.random()*maxV);
                const location = '/v/' + hexName(idx);
                return new Response(null, {{status:302, headers: {{ 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }}}});
            }} else {{
                if(!maxH) return new Response('No horizontal images', {{status:404}});
                const idx = Math.floor(Math.random()*maxH);
                const location = '/h/' + hexName(idx);
                return new Response(null, {{status:302, headers: {{ 'Location': location, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }}}});
            }}
        }}

        // Help text when no img param
        const help = `🖼️ 随机图片展示器\n\n使用方法:\n• ?img=h - 获取横屏随机图片\n• ?img=v - 获取竖屏随机图片\n• ?img=ua - 根据设备类型自动选择图片\n`;
        return new Response(help, {{status:200, headers: {{ 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }}}});

    }} catch(err) {{
        return new Response('Internal Error: ' + (err && err.message), {{status:500}});
    }}
}}
"""

    # write server-side function into repository root `functions/` for Pages/Wrangler
    functions_dir = FUNCTIONS_DIR
    ensure_dir(functions_dir)
    path = functions_dir / out_name
    with open(path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f"Wrote {path} (server-side CF Pages Function)")


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--hash-length','-l',type=int,default=DEFAULT_HASH_LENGTH)
    p.add_argument('--ext','-e',default=DEFAULT_EXT)
    p.add_argument('--no-copy',action='store_true')
    p.add_argument('--domain',default='')
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
    exts = {'.jpg','.jpeg','.png','.gif','.webp'}
    for sd in sorted(subdirs):
        imgs = sorted([f for f in sd.iterdir() if f.is_file() and f.suffix.lower() in exts])
        if not imgs:
            counts[sd.name]=0
            continue
        num = process_category(sd.name, imgs, hl, ext, do_copy)
        counts[sd.name]=num

    meta = build_counts_json(counts, hl, ext, args.domain)
    # generate server-side CF Pages function for UA-based redirects
    generate_cf_worker(meta, 'pic.js')
    # do NOT generate client-side helper or gallery page per user request
    # generate_cf_redirect(meta, 'pic.client.js')
    # generate_index_html(meta)

if __name__ == '__main__':
    main()