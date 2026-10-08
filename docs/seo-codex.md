# SEO skills for Codex

## Overview
The project-local Codex skills live in `.agents/skills/`. They are an independently written, lightweight adaptation of concepts from [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) (MIT). They do **not** vendor upstream Python tooling, Claude-specific commands, dependencies, agent definitions or extensions.

## Getting started
Open this repository in Codex at the branch containing the skills (or after merging into `work`). Ask: **"Audit our technical SEO using the repo-local seo skill; do not modify code."** Codex should read `AGENTS.md`, then `.agents/skills/seo/SKILL.md` and the relevant specialized skill.

Other examples:
- "Review metadata, canonical links, sitemap and favicon on the public site."
- "Create a French/English SEO content map for renovation visualizations."
- "Audit JSON-LD and propose schema improvements without changing production code."
- "Assess AI search discoverability without making unsupported GEO claims."

## Guardrails
This integration adds instructions only; it cannot automatically execute a live crawl or read private Search Console data. A real deployment URL, access and optional external tools are necessary for certain checks. No secrets are stored. A staging subdomain should be protected by authentication, not just robots.txt. Never run upstream `install.sh` or blindly execute fetched code.

## Source and license
Inspired by Claude SEO by Daniel Agrici: https://github.com/AgriciDaniel/claude-seo (MIT license). Text in this adaptation is independently authored. For the complete upstream functionality, follow its original Claude Code installation documentation; slash commands and bundled subagents are not provided here.
