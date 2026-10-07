import type { MetadataRoute } from "next";
import { SITE, searchRobots } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  return searchRobots().index ? [{ url: SITE.url, changeFrequency: "monthly", priority: 1 }] : [];
}
