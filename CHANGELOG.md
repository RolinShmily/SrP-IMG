# Changelog

<p align="center">
  <b>English</b> • <a href="./CHANGELOG.zh.md">简体中文</a>
</p>

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **No tagged release yet.** The version in `package.json` is `0.1.0` and `main` is
> always deployable, but nothing has been tagged. Everything below is therefore
> unreleased; entries will be moved under a version heading at the first tag.

## [Unreleased]

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
* **Community health files** — `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, this
  changelog, issue forms, a pull request template and a CI workflow.
* **Project metadata** — `license`, `author`, `repository`, `bugs`, `homepage`, `keywords`
  and `engines` in `package.json`.

### Changed

* Added `.editorconfig` and `.gitattributes` so text files stay LF-normalized and
  generated artifacts (`index.js`, `functions/pic.js`, `public/counts.json`) are
  collapsed in diffs.

### Security

* The 5MB per-file build limit prevents oversized assets from exhausting CI disk
  space during hash expansion. See [SECURITY.md](SECURITY.md) for how to report
  vulnerabilities.

[Unreleased]: https://github.com/RolinShmily/SrP-IMG/commits/main
