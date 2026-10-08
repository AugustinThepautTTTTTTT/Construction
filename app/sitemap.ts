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
    { url: SITE.url + "/en/guides/", lastModified: updated, changeFrequency: "weekly", priority: 0.8 },
    { url: SITE.url + "/en/guides/small-bathroom-renovation-ideas/", lastModified: updated, changeFrequency: "monthly", priority: 0.75 },
    { url: SITE.url + "/en/guides/best-bathroom-flooring/", lastModified: updated, changeFrequency: "monthly", priority: 0.75 },
    { url: SITE.url + "/en/guides/bathroom-renovation-cost/", lastModified: updated, changeFrequency: "monthly", priority: 0.75 },
    { url: SITE.url + "/en/guides/bathroom-renovation-step-by-step/", lastModified: updated, changeFrequency: "monthly", priority: 0.75 },
    { url: SITE.url + "/en/guides/best-small-bathroom-vanities/", lastModified: updated, changeFrequency: "monthly", priority: 0.75 },
    { url: SITE.url + "/en/guides/walk-in-shower-vs-bathtub/", lastModified: updated, changeFrequency: "monthly", priority: 0.75 },
  ];
}
