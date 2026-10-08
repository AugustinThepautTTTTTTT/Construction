---
name: seo-schema
description: Audit or propose Schema.org JSON-LD markup for SaaS, organization, website, breadcrumbs and truthful structured data.
---

# Structured data

1. Inspect actual public-facing routes and existing JSON-LD before proposing new markup.
2. Start with accurate `Organization` and `WebSite`, then consider `SoftwareApplication` only if the page content substantiates its fields; `BreadcrumbList` if there are real navigable breadcrumbs.
3. Use schema.org vocabulary and Google Search Central documentation for current rich-result rules. Valid Schema.org properties do **not** guarantee a Google rich result.
4. Use the real canonical domain and public business name discovered in config. Never invent ratings, review counts, prices, founders, logos, app category, availability, or product offers.
5. Match markup exactly to visible information and applicable policy. Do not add fake reviews or misleading `AggregateRating`. Avoid promoting deprecated rich-result formats as SEO wins.
6. Validate JSON syntax, rendering and duplicate entities; check Google Rich Results Test when eligible. Mark field gaps needing confirmation.
7. Provide a minimum proposed JSON-LD snippet or patch plan; change code only when explicitly authorized.
