# SrP-IMG — Full-Featured Random Image API & Gallery

<p align="center">
  <b>English</b> • <a href="./README_zh.md">简体中文</a>
</p>

An unlimited-traffic, zero-cost, multi-category random image solution designed for deployment on **Cloudflare Pages / Workers**. Built with Python pre-build generation, it transforms static file storage into high-performance dynamic random image APIs alongside a modern waterfall image gallery web app.

### ✨ Core Highlights

* **Zero-Cost Architecture**: Fully serverless and hosted on Cloudflare Pages/Workers — no traditional servers or databases required.
* **Smart Multi-Category Support**: Out-of-the-box support for `h` (landscape/horizontal), `v` (portrait/vertical), and custom categories (e.g., `gif`, `a` for avatars, `wallpaper`).
* **Dynamic Suffix Resolution**: `h` and `v` categories enforce `.jpg` for universal API compatibility; custom categories automatically detect and preserve original file extensions (e.g., `.gif`, `.png`).
* **Automated Gallery Adaptation**: The Next.js frontend automatically loads `counts.json` to adapt categories, item counts, and image extensions without manual UI code changes.
* **Dual Access Modes**: Supports serverless JS redirection (API Mode) and edge Transform Rules rewrite (Transparent Mode).

---

### 📁 Directory Structure

```text
├── oriImg/                 # [Core] Raw source images (organized by category folders)
│   ├── h/                  # Landscape images (enforced .jpg)
│   ├── v/                  # Portrait images (enforced .jpg)
│   ├── a/                  # Avatar images
│   └── gif/                # Custom category (preserves .gif format)
├── public/                 # Static assets & build outputs
│   ├── counts.json         # Auto-generated global index & metadata
│   └── h/, v/, a/, gif/    # Mapped hex-named image collections
├── functions/              # Cloudflare Pages Functions
│   └── pic.js              # Server-side redirect API endpoint (Pages)
├── app/                    # Next.js App Router
│   ├── page.tsx            # Main gallery page
│   └── layout.tsx          # Root layout & global configuration
├── components/             # React UI components
│   └── image-gallery.tsx   # Core waterfall gallery component (mapping logic)
├── gen_img.py              # Build engine: hash expansion, suffix detection & metadata export
├── index.js                # Cloudflare Workers entrypoint
├── wrangler.jsonc          # Cloudflare Workers configuration
├── README.md               # English documentation
└── README_zh.md            # Chinese documentation
```

---

### 🖥️ Preview

![preview](preview.png)

---

### 🚀 Deployment Guide

#### 1. Material Preparation

Create category folders inside `oriImg/` in the project root:

* **API Categories**: Create `h` and `v` directories and place landscape/portrait images inside (these are output as `.jpg` for broad API compatibility).
* **Custom Categories**: Create folders such as `gif`, `anime`, or `a`. The script automatically takes the extension of the first image in each folder as the output format.

#### 2. Local Testing

To preview the gallery locally:

```bash
# Use --no-copy to quickly generate virtual metadata for testing
python gen_img.py --no-copy --hash-length 2
npm run dev
```

#### 3. Cloudflare Pages / Workers Production Build

Configure Cloudflare Pages as follows:

* **Framework Preset**: `Next.js`
* **Build Command**:

```bash
python3 gen_img.py --hash-length 2 && npm run build
```

* **Build Output Directory**: `out`
* **Environment**: Python 3.8+

If deploying to **Cloudflare Workers**, configure `wrangler.jsonc`:

```jsonc
{
  "name": "srp-img-worker",
  "main": "index.js",
  "compatibility_date": "2026-01-05",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./out",
    "binding": "ASSETS"
  }
}
```

*Note: Replace `name` with your Worker name, and set `compatibility_date` to your deployment date.*
Deploy command: `npx wrangler deploy`

---

### 💡 Usage & Integration

Live Demo: `https://eo-img.srprolin.top` (Supports Methods A & B).

#### Method A: Serverless API (JS Redirection)

Powered by `functions/pic.js` (Pages) or `index.js` (Workers). Ideal for Markdown files and external websites:

| Endpoint        | Target / Behavior             | Description                                         |
| :-------------- | :---------------------------- | :-------------------------------------------------- |
| `/pic?img=h`  | 302 Redirect to`/h/xxx.jpg` | Random landscape image                              |
| `/pic?img=v`  | 302 Redirect to`/v/xxx.jpg` | Random portrait image                               |
| `/pic?img=ua` | Smart UA-based redirection    | Returns vertical for mobile, horizontal for desktop |

#### Method B: Visual Web Gallery

Visit your deployed root domain (e.g., `https://your-domain.pages.dev`):

* **Responsive Filtering**: Top navigation switches between `h`, `v`, `gif`, and custom categories.
* **Waterfall Masonry**: High-performance loading powered by Next.js.
* **Immersive Preview**: Integrated Fancybox with zoom, rotate, fullscreen, and download capabilities.

#### Method C: Edge URL Rewrite (Transparent Mode)

Configure **Transform Rules** in the Cloudflare Dashboard (*Replace `<your-domain>` with your actual domain*):

**Rule 1: Landscape / Portrait (`h` & `v`)**

1. **Match Expression**:

```text
(http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/h") and not ends_with(http.request.uri.path, ".jpg")) or (http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/v") and not ends_with(http.request.uri.path, ".jpg"))
```

2. **Rewrite Path (Dynamic)**:

```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 2), ".jpg")
```

**Rule 2: Avatar Category (`a`)**

1. **Match Expression**:

```text
(http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/a") and not ends_with(http.request.uri.path, ".jpeg"))
```

2. **Rewrite Path (Dynamic)**:

```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 2), ".jpeg")
```

**Rule 3: GIF Category (`gif`)**

1. **Match Expression**:

```text
(http.host eq "<your-domain>" and starts_with(http.request.uri.path, "/gif") and not ends_with(http.request.uri.path, ".gif"))
```

2. **Rewrite Path (Dynamic)**:

```text
concat(http.request.uri.path, "/", substring(uuidv4(cf.random_seed), 0, 2), ".gif")
```

> **Note**: If `--hash-length` is set to `3` in your build command, update the substring length in `cf.random_seed` from `2` to `3`.
> Example access URL: `https://your-domain.pages.dev/h`

---

### ⚙️ Technical Details

#### Build Engine: `gen_img.py`

When executed, the script performs:

1. **Hash Expansion**: Uses `--hash-length` to define the random pool size. For length `3`, each category generates $16^3 = 4096$ paths.
2. **Extension Strategy**:
   * Inspects each subdirectory under `oriImg`.
   * If named `h` or `v`, enforces the CLI extension (defaults to `.jpg`).
   * Otherwise, auto-detects the extension from the first image in that directory.
3. **Metadata Export**: Generates `counts.json` containing total image counts (`counts`) and extension mappings (`category_exts`).

---

### 📦 Storage & Capacity Management

Because Cloudflare Pages and other CI platforms enforce limits on file counts and total artifact sizes, this project includes an **automatic size circuit-breaker**:

#### 1. File Size Threshold

* **5MB Limit**: `gen_img.py` scans each source file during the build phase.
* **Policy**: Any single file exceeding **5MB** is skipped entirely. It will not be copied or included in the hash iteration.
* **Purpose**: Prevents oversized GIFs or raw photos from exhausting disk space during exponential expansion ($16^3 = 4096\times$).

#### 2. Capacity Formula

Estimate total disk consumption using the formula:

$$
S_{total} = \sum_{c=1}^{n} (16^L \times \bar{S}_c)
$$

* $S_{total}$: Total disk space consumed after build.
* $L$: Specified `hash-length` (default: 3).
* $\bar{S}_c$: Average size of valid images ($\le 5\text{MB}$) in category $c$.
* $n$: Total number of category folders.

> *Example*: If category `h` contains 10 images averaging 500KB each, with `hash-length 3`:
> Space $= 16^3 \times 500\text{KB} = 4096 \times 0.5\text{MB} \approx 2\text{GB}$.

#### 3. Best Practices

* **Image Compression**: We recommend compressing images and GIFs below 2MB before placing them in `oriImg` (e.g. using [Caesium Image Compressor](https://saerasoft.com/caesium/)).
* **Adjust Hash Length**: For large image libraries, set `--hash-length` to `2` (generates 256 images per category) to ensure build success.
* **Build Logs**: Cloudflare build logs will display warnings: `[category] Ignored X files exceeding 5.0MB`.

---

### 🎨 Gallery Mapping Table

The gallery component decouples data via the `typeToFolder` mapping table. To add a new category:

1. Create a new folder under `oriImg/`.
2. Add a corresponding tab/button in `app/page.tsx`.
   The frontend will dynamically read the extension and count from `counts.json`.

---

### 📜 License

This project's **source code** is licensed under the **MIT License** — see [LICENSE](LICENSE). The license does **not** extend to the image assets; see [NOTICE](NOTICE) and the section below.

---

### 🖼️ Image Sources & Copyright

**The MIT license in this repository covers source code only** (`.ts` / `.tsx` / `.js` / `.py` and configuration files). It does **not** cover `oriImg/` or any image asset in the build output.

* Images under `oriImg/` were collected from the internet. Copyright belongs to **their respective authors**, and they are included solely for personal study, functional demonstration and technical validation.
* This repository claims no rights over these images and holds no explicit permission from their authors.
* Because the repository owner holds no rights in these images, the MIT license here **does not — and cannot — grant anyone** the right to reuse them. For any commercial use or public redistribution, clear the rights with the original author yourself.
* If you own the rights to an image and would rather it were not here, please open an [Issue](https://github.com/RolinShmily/SrP-IMG/issues) and it will be removed as soon as the claim is confirmed.

> **Note to deployers**: replace `oriImg/` with your own images, or with a source whose terms you have verified — such as Unsplash, Pexels or Pixabay — and comply with that source's license.

---

### 💡 Acknowledgements & Inspirations

This project was designed with reference to the following projects. Only their public
interface design and general approach were consulted — none of their source code was
copied, and the implementation here is independently written:

1. **[EdgeOne_Function_PicAPI](https://github.com/afoim/EdgeOne_Function_PicAPI)** by [@afoim](https://github.com/afoim) — Design reference for the EdgeOne / Cloudflare Functions serverless random-image redirection API. Licensed under **AGPL-3.0**; this project does not include its code.
2. **[cf-rule-random-url](https://github.com/afoim/cf-rule-random-url)** by [@afoim](https://github.com/afoim)
   Inspiration for Cloudflare Transform Rules URL rewriting logic and hex hash generation approach.
