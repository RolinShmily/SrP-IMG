# Contributing

Thanks for taking the time to contribute. SrP-IMG is a lightweight Vite + React
gallery plus a Cloudflare Worker, so the workflow stays simple.

## Ways to help

* **Bug reports** — open an [Issue](https://github.com/RolinShmily/SrP-IMG/issues) with your environment and the exact URL or command that failed.
* **Feature requests** — open an Issue describing the use case first.
* **Pull requests** — small, focused changes are very welcome.
* **Image copyright** — open an Issue with the image path or URL and it will be removed once confirmed.

## Local setup

Requirements: **Node.js 22+** and **Python 3.8+**.

```bash
git clone https://github.com/RolinShmily/SrP-IMG.git
cd SrP-IMG
npm ci --ignore-scripts

# Generate hashed pool and metadata (use --no-copy only in scratch trees)
npm run gen

npm run dev          # http://localhost:5173
npm run lint         # eslint .
npm run build        # production multi-page Vite build into dist/
npm run typecheck    # tsc --noEmit (vite build does not typecheck)
npm test             # pipeline + access policy + Worker contract suites
```

> `python -m pipeline` rewrites `assets/generated/counts.json`, `worker/targets.js`,
> and `worker/slot_formats.js`. Whenever you change `pipeline/`, `worker/`, or
> `assets/original/`, commit the regenerated files together.

## Adding images or categories

1. Place images under `assets/original/<category>/` (compress below **2 MB**; files over **5 MB** are skipped).
2. Run `npm run gen` and commit `assets/generated/counts.json`, `worker/targets.js`, and `worker/slot_formats.js`.
3. Only submit images you have the right to distribute.

## Pull request guidelines

* Keep one PR to one concern and explain **what** changed and **why**.
* Never commit secrets (`.dev.vars`, API tokens, Cloudflare credentials).
* Keep `package-lock.json` in sync with `package.json`.
* Update `README.md` **and** `README.zh-CN.md` when user-facing behaviour changes.
* Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).

For details on architecture, testing, and CI, see [`docs/development.md`](docs/development.md).
For private security reports or questions, email <contact@srprolin.com>.
