import type { MetadataRoute } from "next";
import { SITE, searchRobots } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!searchRobots().index) return [];
  const updated = new Date("2026-10-08T00:00:00.000Z");
  return [
    { url: SITE.url, changeFrequency: "monthly", priority: 1 },
    { url: SITE.url + "/en/bathroom-renovation/", lastModified: updated, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE.url + "/en/ai-bathroom-design/", lastModified: updated, changeFrequency: "monthly", priority: 0.9 },
    { url: SITE.url + "/en/bathroom-inspiration/", lastModified: updated, changeFrequency: "monthly", priority: 0.85 },
  ];
}
