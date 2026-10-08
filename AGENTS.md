# Codex instructions — Construction

This repository is the Roomwise / Archicova application. Prefer the existing instructions in README.md and the project's architecture. SEO analysis is supported through the repo-local skills in `.agents/skills/`.

## SEO routing
- For requests involving SEO audits, search visibility, indexing, technical SEO, schema, content quality, international SEO or AI search, read `.agents/skills/seo/SKILL.md` first.
- Follow the leaf skills referenced there for the relevant task. These instructions are for **developer-facing Codex**, not the application's end-user assistant.
- Default to assessment and a proposed diff. Never edit application code, deploy, change DNS, disclose credentials or update analytics properties unless explicitly requested.
- For modifications, prefer a feature branch and a PR targeting `work`. Keep `prod` and production deployment untouched unless expressly authorized.
- Do not run downloaded scripts or install external dependencies without reviewing the code and securing explicit authorization.
