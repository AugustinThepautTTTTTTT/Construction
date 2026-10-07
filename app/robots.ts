import type { MetadataRoute } from "next";
import { SITE, searchRobots } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  if (!searchRobots().index) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/account", "/chat", "/purchase", "/api/"] }, sitemap: `${SITE.url}/sitemap.xml`, host: SITE.url };
}
