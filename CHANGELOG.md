# Changelog

<p align="center">
  <b>English</b> • <a href="./CHANGELOG.zh.md">简体中文</a>
</p>

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.1.0] - 2026-09-22

First tagged release. `main` is deployable at all times, so this also describes
everything that shipped before the tag.

### Added

* **Gallery web app** — Next.js static export with category tabs (`h`, `v`, `a`, `gif`),
  a waterfall layout, light/dark theme switching and a Fancybox lightbox with zoom,
  rotate, fullscreen and download.
* **Random image API** — `/pic?img=h|v|ua` returns a `302` to a randomly chosen image
  slot, with `ua` picking the orientation from the `User-Agent`. Includes permissive
  CORS and a plain-text usage notice for unknown `img` values.
* **Build engine** (`gen_img.py`) — expands `oriImg/` into `16^hash_length` hash slots
  per category, forces `.jpg` for `h`/`v`, preserves the source extension for custom
  categories, skips files above 5MB, and exports `public/counts.json` plus the
  regenerated Worker entry points.
* **Cloudflare deployment** — `wrangler.jsonc` for Workers Assets mode, a Pages Function
  variant, and a GitHub Actions workflow that builds and deploys `main`.
* **Documentation** — bilingual README, plus a documented Cloudflare Transform Rules
  recipe for the no-JavaScript "transparent mode" endpoint.
* **Community health files** — `CONTRIBUTING`, `CODE_OF_CONDUCT` (Contributor Covenant
  2.1), `SECURITY`, this changelog, issue forms, a pull request template and a CI
  workflow.
* **Continuous integration** (`.github/workflows/ci.yml`) — lints, generates the hash
  pool, verifies the committed Worker entry points match the generator, builds the
  static export and typechecks, on every pull request.
* **Linting** — ESLint flat config (`eslint.config.mjs`) built on
  `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.
* **Project metadata** — `license`, `author`, `repository`, `bugs`, `homepage`, `keywords`
  and `engines` in `package.json`, plus a `typecheck` script.

### Changed

* **Preview image** — `preview.png` re-encoded to `preview.webp` with ffmpeg/libwebp at
  quality 88 (full 2323×1372 resolution kept): 3.4 MB → 384 KB, a 89% reduction.
* Added `.editorconfig` and `.gitattributes`: text files are LF-normalized, and generated
  artifacts (`index.js`, `functions/pic.js`, `public/counts.json`) are collapsed in diffs.
* `.gitignore` now ignores the whole generated `public/` pool except `counts.json` and the
  static assets, so new categories are covered automatically.

### Fixed

* Synced `functions/pic.js` and `index.js` with the `gen_img.py` output — the committed
  copies had lost a blank line and their trailing newline, which the new CI check now
  catches.
* Removed a dead reset-on-`type` effect in the gallery: `app/page.tsx` already renders the
  component with `key={galleryType}`, so switching category remounts it with fresh state.
* Replaced the `setState`-in-effect hydration gates in the gallery and the theme toggle
  with `useSyncExternalStore`, avoiding a cascading render on every mount.
* Typed the Fancybox plugin options (`Thumbs`, `Toolbar`) instead of casting to `any`.

### Security

* The 5MB per-file build limit prevents oversized assets from exhausting CI disk space
  during hash expansion. See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

[Unreleased]: https://github.com/RolinShmily/SrP-IMG/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RolinShmily/SrP-IMG/releases/tag/v0.1.0
