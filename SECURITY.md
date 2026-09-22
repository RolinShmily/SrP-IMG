# Security Policy

<p align="center">
  <b>English</b> • <a href="./SECURITY.zh.md">简体中文</a>
</p>

## Supported versions

This project has no tagged releases — only the `main` branch is maintained, and
that is what the deploy workflow ships. Fixes are applied there; please test
against the latest `main` before reporting.

## Reporting a vulnerability

**Do not open a public Issue for a security problem.** Report it privately by
email:

**<rol1n@srprolin.top>**

Include, as far as you can:

* a description of the issue and the impact you believe it has;
* the affected file(s) or endpoint, with the exact URL / request / payload;
* reproduction steps or a minimal proof of concept;
* your environment (browser, Node version, deployment type);
* whether you would like public credit, and under what name.

## What to expect

This is a volunteer-run personal project, so timelines are best effort:

| Stage | Target |
| :-- | :-- |
| Acknowledgement of your report | within 3 days |
| Initial assessment (accepted / not applicable) | within 7 days |
| Fix deployed for accepted reports | typically within 30 days |

Please give us a reasonable window — **90 days, or until a fix is deployed**,
whichever comes first — before publishing details. We will tell you when the fix
is live and credit you if you asked for it.

## In scope

* The redirect endpoints (`/pic`, `/api/pic`) and their handling of user input.
* The static gallery frontend (`app/`, `components/`).
* The build pipeline (`gen_img.py`) and the deploy workflow in `.github/workflows/`.
* Exposed secrets or credentials in the repository or its history.
* Dependency vulnerabilities that are actually reachable in this codebase.

## Out of scope

* **Image copyright / licensing complaints** — these are not security issues; see the License section of the [README](./README.md#-license).
* **Abuse of the public API** (hotlinking, high request volume). The endpoint is public, unauthenticated and serves non-sensitive images by design.
* **Missing hardening on the operator's own domain** — HSTS, WAF rules, rate limiting and similar are configured at the Cloudflare account level, not in this repository.
* Vulnerabilities in Cloudflare's platform, Next.js, or other upstream dependencies themselves — report those upstream.
* Findings that require a compromised device, a malicious browser extension, or physical access.
* Automated scanner output with no demonstrated impact.

## Guidelines

* Only test against your **own** deployment, or a read-only check of a public instance. Do not run destructive tests, denial-of-service traffic, or attempts to access other users' data.
* Never include live credentials or personal data of third parties in a report.
* Thank you — responsible reports are genuinely appreciated.
