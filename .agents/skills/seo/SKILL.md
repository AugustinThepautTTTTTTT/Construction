---
name: seo
description: SEO audit and planning orchestrator for Roomwise / Archicova. Use when a user asks about SEO, indexing, sitemaps, schema, search snippets, page speed, content quality, localization, AI search visibility, keyword plans or SEO regressions.
---

# SEO for Codex — Roomwise / Archicova

This is a **Codex-native adaptation**, not the Claude Code plugin runtime or its 19 agents. Upstream inspiration: https://github.com/AgriciDaniel/claude-seo (MIT). Do not invoke `/seo`, `CLAUDE_PLUGIN_ROOT`, Claude-specific subagents, or bundled upstream scripts as though they are installed.

## Routing
1. Identify the request: audit, technical, content, schema, GEO/AI-search, localization, or strategy.
2. Read the relevant local instruction:
   - `../seo-technical/SKILL.md` for crawlability, indexation, sitemap, canonical, metadata, Core Web Vitals and release regression checks.
   - `../seo-content/SKILL.md` for keywords, landing-page intent, content quality and conversion.
   - `../seo-schema/SKILL.md` for JSON-LD and rich-result eligibility.
   - `../seo-geo/SKILL.md` for evidence-led AI search discoverability.
3. For comprehensive audits, combine all four, explicitly check multilingual/hreflang and security of development subdomains.
4. Collect **evidence** from source code and optionally the public deployed site, respecting robots rules. Prefer direct file/line evidence and documented Google sources. Never invent Google Search Console impressions, rankings, indexing status, SEO scores, or Core Web Vitals field data.
5. Report issues as Critical / High / Medium / Low, each with affected route, observation, likely effect, recommendation, effort, and verification method. Separate facts, assumptions, and tasks requiring credentials.
6. If editing is explicitly authorized, make the smallest scoped change, run relevant checks, then describe the diff. Do not silently change application files as part of an audit.

## Architecture-aware discovery
- Inspect `app/` and route metadata rather than presuming a specific framework implementation.
- Check `robots.txt`, sitemap endpoints, `metadata`, `generateMetadata`, canonical URL generation, redirects, structured data, OG images and favicons.
- Assess the publicly accessible product's brand and canonical domain from actual configuration; do not assume Roomwise and Archicova are equivalent in production.
- If development/staging domains exist, ensure they are access-controlled; `noindex` alone is not a security control.
- Treat localized French and English pages separately; avoid duplicated titles or automatic hreflang guesses.

## Audit output
Start with a short executive summary. Provide an evidence table, prioritized plan (quick wins vs structural work), and a validation checklist. Suggest Google Search Console / PageSpeed / Rich Results Test checks where live data is required. SEO changes must not weaken privacy, auth, or user safety.

## Usage examples
- "Audit the SEO of this repository without changing code."
- "Check indexing, sitemap, robots, favicon, and canonical tags for Archicova."
- "Create an SEO implementation plan for renovation visualization in French and English."
- "Review our SaaS schema and propose a minimal JSON-LD patch."
