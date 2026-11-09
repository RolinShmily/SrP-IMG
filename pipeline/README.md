# pipeline/ — build-time image pipeline

Ownership boundary (see the repository architecture notes):

| This package **owns** | This package must **not** touch |
| :--- | :--- |
| `assets/generated/<category>/<hex>.<ext>` (only direct child files) | `assets/static/` (`_headers`, `icon.svg`, `placeholder.svg`, `fonts/`) |
| `assets/generated/counts.json` | `assets/original/`, `assets/catalog.json`, `src/`, the HTML entries, `wrangler.jsonc` |
| `worker/targets.js`, `worker/slot_formats.js` (data only) | `worker/*.js` runtime policy logic |

Data flow: `assets/original/<category>/*` + `assets/catalog.json` → scan →
materialise → `contracts/manifest.schema.json`-validated
`assets/generated/counts.json` → the two generated data modules
(`worker/targets.js`, `worker/slot_formats.js`).

`assets/generated/` is a build artifact directory (git-ignored except for
`counts.json`); `vite.config.ts` copies it into `dist/` at build time, so the
generated files never live next to hand-written sources.

Run it as `python -m pipeline [--hash-length N] [--ext .jpg] [--no-copy] [--strict-formats]`.

## Suffix/byte drift

`ext_policy` fixes a category's slot *suffix*, not the encoding of the bytes
that land in it: a PNG or WebP source in `h`/`v`/`a` is copied byte-for-byte
into a `.jpg`/`.jpeg` slot. Renaming a slot would change its deployed URL, so
the pool keeps the suffix and the response header is corrected instead:

* `pipeline/formats.py` probes every valid source header (12 bytes, stdlib
  only) and assigns each slot one code: `j` = JPEG, `p` = PNG, `g` = GIF,
  `w` = WebP, `?` = unrecognised.
* `pipeline/worker_targets.py` emits those codes into `worker/slot_formats.js`
  (one string per category, one character per slot, slot order), together with
  `worker/targets.js`.
* `worker/index.js` resolves `/<category>/<hex>.<ext>` and rewrites
  `Content-Type` from that table, in the `PROTECT_ASSET_IMAGES=1` branch *and*
  the unprotected/assets branch. Unknown codes, out-of-range slots and
  non-hex names (`/h/missing.jpg`) are left untouched.
* Each run still prints one line per affected category, and
  `--strict-formats` aborts with exit code 1 before any artifact is written (the
  audit only scans; it never creates a directory). It is deliberately not wired
  into CI — the drift is expected, and the test gate is a **no-growth**
  baseline (see below).

This depends on `assets.run_worker_first = true` (see `wrangler.jsonc`): any
request that reaches the static assets without passing the Worker keeps the
suffix-derived header. The Pages adapter has no asset branch, so Pages
responses are not rewritten either.

The note about `ext_policy: "source"` still applies: it takes the *first* valid
source's suffix for the whole category, so it removes the drift only when that
category is suffix-homogeneous (`gif` is); on a mixed category it merely
narrows the drift, at the cost of new URLs for every slot plus a pool
regeneration. Making the file on disk honest as well would require transcoding
the sources or per-slot suffixes (i.e. new URLs) — out of scope here.

Behaviour is pinned by `tests/pipeline/` and by an external byte-level oracle:
every generated artifact must match the pre-refactor output exactly. Do not
"tidy" ordering, extensions, timestamps or JSON formatting without regenerating
and reviewing the image pool (see `TODO(P3)` in `catalog.py`).
`tests/pipeline/test_pipeline.py` also locks the real tree against a
**no-growth** baseline: `a` 56/114, `h` 43/138, `v` 7/67 source mismatches and
`a` 125, `h` 81, `v` 28, `gif` 0 slot mismatches. Counts may fall (then lower the
baseline); they must not rise. A category outside the baseline must have zero
mismatches, so adding a homogeneous category needs no test edit. `targets.js` is
checked by re-deriving it from `counts.json` instead of pinning a hash.
