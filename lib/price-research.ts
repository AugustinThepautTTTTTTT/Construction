import { z } from "zod";
import {
  retailerDomains,
  type Estimate,
  type PriceSource,
} from "./room-artifacts";
export const priceResearchSchema = z
  .object({
    products: z
      .array(
        z
          .object({
            index: z.number().int().min(0).max(15),
            price: z.number().positive().max(100000),
            url: z.string().url(),
            title: z.string().max(200),
            currency: z.string().regex(/^[A-Z]{3}$/),
            unit: z.string().max(30),
            note: z.string().max(500),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();
export function retrievedUrls(output: unknown) {
  const urls = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object")
      for (const [key, value] of Object.entries(node)) {
        if (key === "url" && typeof value === "string") urls.add(value);
        else walk(value);
      }
  };
  walk(output);
  return urls;
}
export function vettedPrices(
  raw: unknown,
  estimate: Estimate,
  urls: Set<string>,
): PriceSource[] {
  const parsed = priceResearchSchema.parse(raw),
    domains = retailerDomains(estimate.country);
  const seen = new Set<number>();
  return parsed.products.flatMap((product) => {
    const item = estimate.items[product.index];
    let url: URL;
    try {
      url = new URL(product.url);
    } catch {
      return [];
    }
    if (
      !item ||
      seen.has(product.index) ||
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !urls.has(product.url) ||
      product.currency !== estimate.currency ||
      product.unit !== item.unit ||
      (domains.length &&
        !domains.some(
          (domain) =>
            url.hostname === domain || url.hostname.endsWith("." + domain),
        ))
    )
      return [];
    seen.add(product.index);
    return [
      {
        index: product.index,
        price: product.price,
        url: product.url,
        title: product.title,
        checkedAt: new Date().toISOString(),
        note:
          product.note + " Confirm pack coverage, delivery and checkout price.",
      },
    ];
  });
}
