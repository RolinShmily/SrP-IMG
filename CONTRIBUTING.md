# Contributing

<p align="center">
  <b>English</b> • <a href="./CONTRIBUTING.zh.md">简体中文</a>
</p>

Thanks for taking the time to contribute. This is a small project — a static
Next.js gallery plus a Cloudflare Worker that redirects to random images — so the
process is deliberately lightweight.

## Ways to help

* **Bug reports** — open an [Issue](https://github.com/RolinShmily/SrP-IMG/issues) with your platform, browser, and the exact URL or command that failed.
* **Feature requests** — open an Issue describing the use case first, so we can agree on the approach before any code is written.
* **Pull requests** — small, focused fixes and improvements are very welcome.
* **Image copyright** — do **not** file these as a code issue; see the note in [README](./README.md#-license).

## Local setup

Requirements: **Node.js 22+** and **Python 3.8+**.

```bash
git clone https://github.com/RolinShmily/SrP-IMG.git
cd SrP-IMG
npm ci --ignore-scripts

# Generate virtual metadata without copying images (fast, recommended for development)
python gen_img.py --no-copy --hash-length 2

npm run dev          # http://localhost:3000
npm run build        # production static export into out/
npm run typecheck    # tsc --noEmit; the build itself ignores type errors
```

> `gen_img.py` also rewrites `functions/pic.js` and `index.js` to match the
> generated hash space. If you change the generator, commit those regenerated
> files together with it.

## Adding images or a new category

1. Create `oriImg/<category>/` and drop your images in (compress them below
   **2 MB**; anything above **5 MB** is skipped by the build).
2. `h` and `v` always output `.jpg`; other categories keep the extension of the
   first image in the folder.
3. Add the matching tab in `app/page.tsx` and an entry in the `typeToFolder`
   map in `components/image-gallery.tsx`.
4. Run the generator and commit `public/counts.json` plus the regenerated
   `functions/pic.js` / `index.js`.

Please only submit images you have the right to distribute — no scraped
material.

## Pull request guidelines

* Keep one PR to one concern; describe **what** changed and **why**.
* Do not commit secrets (`.env`, API tokens, Cloudflare credentials). The deploy
  workflow reads them from GitHub repository secrets — never hardcode them.
* Leave `package-lock.json` in sync with `package.json`, and flag any new
  dependency in the PR description before adding it.
* Update `README.md` **and** `README_zh.md` when user-facing behaviour changes.
* Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`), matching the existing history.

## Reporting security issues

Please do **not** open a public Issue for a vulnerability — follow
[SECURITY.md](./SECURITY.md) instead.

## Questions

Open an [Issue](https://github.com/RolinShmily/SrP-IMG/issues) or email
<rol1n@srprolin.top>.
