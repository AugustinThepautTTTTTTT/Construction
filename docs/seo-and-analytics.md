# Archicova search and measurement

The production identity is https://archicova.com. Homepage metadata includes its canonical URL, descriptive title, social preview, icons, web manifest and Organization, WebSite and SoftwareApplication structured data. Public prices in structured data match the published Free, Basic and Pro plans. The sitemap lists the public homepage. Account, workspace, checkout and API paths are excluded from crawling; private pages also emit noindex. Preview deployments disallow crawling and emit noindex.

The logo assets are in public/brand. User-facing branding, assistant identity, transactional email copy and download names use Archicova. Existing database schema, cookies and browser storage names are retained for compatibility.

Vercel Web Analytics and Speed Insights are mounted once in the root layout. Enable both products in the construction project's Vercel dashboard; activation creates the collection endpoints on a subsequent deployment. Pageview and performance URLs remove all query parameters and fragments, and normalize project/artifact/photo path identifiers. Custom events include signup_started, plan_selected, account_created, login_completed, checkout_started, checkout_opened, checkout_error and subscription_confirmed. They contain only bounded plan, source and method fields. Payment confirmation is tracked only after server verification. No room text, photo content, credentials or account IDs are sent as custom properties.

Custom event availability and retention depend on the Vercel plan. These tools measure traffic, conversion events and browser performance; they do not provide session replay or every user action.

To connect Google Search Console, verify the domain using Google's supplied DNS record, then submit https://archicova.com/sitemap.xml. Search engines choose when to crawl and may take time to replace the previous title and icon. No Search Console verification token or DNS changes are invented by this release.
