---
name: seo-technical
description: Diagnose crawlability, indexing, metadata, sitemaps, canonical URLs, mobile performance, favicon, international SEO and SEO regressions.
---

# Technical SEO review

## Procedure
1. Inventory indexable routes and public vs private/dev surfaces from repository routing and deployed host config. Check HTTP response status, redirects, `X-Robots-Tag`, robots meta, access control, and robots.txt. Never conflate disallow with noindex or access protection.
2. Check sitemap: absolute URLs, correct host/protocol, reachable pages, freshness, accidental private routes, alternates/hreflang if used.
3. Validate canonical URLs per indexable route, title and description uniqueness, headings, internal links, pagination and 404 behavior.
4. Inspect icons: favicon served with 200, correct `rel=icon` references, formats/sizes, non-blocked assets, brand consistency. Google favicon updates are not instantaneous.
5. Evaluate responsive image dimensions, alt text, lazy/eager loading, cache strategy and render-blocking work. Distinguish lab Lighthouse results from real-user CrUX metrics. Thresholds: LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 at 75th percentile.
6. For multilingual pages, validate language-specific canonical tags, reciprocal hreflang URLs, and x-default only where appropriate.
7. Document concerns affecting JavaScript-rendered content and discovery, but do not presume JS rendering is broken.
8. Check for staging/dev exposure. Authentication or network protection is required for truly private sites; robots directives are not a privacy boundary.

## Evidence / verification
Capture route + file/line or public URL + observed response. Suggest Search Console URL Inspection for actual indexing and PageSpeed Insights for performance. Never claim an unobserved result. No mutation unless requested.
