# Changelog

<p align="center">
  <b>English</b> • <a href="./CHANGELOG.zh.md">简体中文</a>
</p>

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [0.2.1] - 2026-10-27

### Changed

* **Gallery reserves its geometry** — `counts.json` now ships a width/height ratio per
  generated slot, so every tile is sized before its bitmap arrives. The masonry no longer
  reflows while scrolling (the flicker), and a skeleton fills each reserved box until the
  image decodes. Ratios come from the real source dimensions; `object-contain` keeps the
  zero-crop guarantee.
* **README preview gallery** — Screenshots are now captured from the live deployment
  (`img.srprolin.com`) at 1200px wide: the home page shows by default and the gallery,
  API reference, and mobile views sit behind a `<details>` block. Total size dropped from
  393 KB (`preview.webp`) to 236 KB for four images.

## [0.2.0] - 2026-10-27

### Added

* **Runtime access policy** — Referer and CORS allowlists are read from Worker / Pages environment variables (`REFERER_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and documented toggles), so generated `index.js` / `functions/pic.js` carry no hostnames and the repository publishes no allowlist. Lists are comma- or whitespace-separated; wildcards, case folding, and deduplication are handled in one place. Invalid configuration fails closed with HTTP 500. Denials are answered exactly like a missing image and misconfigurations are never described to the caller, so responses cannot be used to map the rules. Added `.dev.vars.example` for local `wrangler dev`; the README now keeps only a short deployment note instead of restating the full rule set.
* **Dynamic converging floating capsule header** — Ported from `SrP-BloG`, featuring smooth 8% desktop convergence past 20px of scroll, downwards retract past 350px with instant upward recovery, and an accessible mobile menu drawer.
* **Modernized SVG brand icon** — Redesigned high-resolution vector icon with a dark forest green squircle base, mint photo frames, depth geometry, and accent glows.
* **Route enter transitions & loading indicators** — Route transition wrapper (`app/template.tsx`) with non-intrusive opacity reveal, and navbar active/pending feedback via `useLinkStatus`.
* **Complete i18n coverage** — Full English and Chinese coverage across all pages, dynamic category names, metadata descriptions, document titles, and screen reader announcements.
* **Automated test suite** — Added `tests/backend-contract.test.mjs` (Worker/Pages security & HTTP contracts), `tests/static-export.test.mjs` (segment path normalizer), and `tests/test_access_policy.py` (policy schema validation).

### Changed

* **Zero-crop live preview** — Refactored live demo preview container with responsive aspect preservation (`object-contain`), dotted backdrop, error retry, and rapid category switch race protection.
* **Synchronized gallery URL state** — Gallery category selection is now single-sourced from URL search parameters, preserving browser back/forward navigation and preventing state divergence.
* **Typography & rasterization polish** — Fixed font variable circular inheritance, added system CJK font fallbacks, enabled `optimizeLegibility` / `font-synthesis: none`, and eliminated hover subpixel jitter.
* **Windows static export normalization** — Added post-build script (`scripts/normalize-static-export.mjs`) to bridge Next.js 16 segment prefetch filenames on Windows.
* **`/settings` reduced to the API reference** — The navigation entry is now just `API`, and the page documents only how to call the endpoints: 302 cards plus the direct paths. The Cloudflare Transform Rules generator and its explanatory copy were removed from the site; the recipe stays in the README for whoever needs it.

### Fixed

* Fixed theme toggle when system preference is set to dark mode.
* Handled clipboard copy permission denials and legacy copy failures gracefully with visible feedback.
* Corrected Fancybox PageUp/PageDown keyboard navigation and unbind cleanup.

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

[Unreleased]: https://github.com/RolinShmily/SrP-IMG/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/RolinShmily/SrP-IMG/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/RolinShmily/SrP-IMG/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/RolinShmily/SrP-IMG/releases/tag/v0.1.0
