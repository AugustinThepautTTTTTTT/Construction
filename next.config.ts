import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Public SEO URLs, internal links and sitemap consistently use a trailing slash.
  trailingSlash: true,
  outputFileTracingIncludes: { "/api/chat": ["./ai-skills/**/*.md"] },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default nextConfig;
