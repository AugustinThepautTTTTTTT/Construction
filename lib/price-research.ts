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
            sourceEvidence: z.string().min(1).max(300),
            coveragePerUnit: z.number().positive().nullable(),
            coverageEvidence: z.string().max(300).nullable(),
            quantityPerPack: z.number().positive().max(10000).nullable().optional(),
            packEvidence: z.string().max(300).nullable().optional(),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();
export function priceResearchJsonSchema() {
  const { $schema, ...schema } = priceResearchSchema.toJSONSchema({ io: "input" });
  // OpenAI supports UUIDs but not URI format; validate URL syntax locally instead.
  const strictSchema = JSON.parse(JSON.stringify(schema, (key, value) => key === "format" && value === "uri" ? undefined : value));
  strictSchema.properties.products.items.required = Object.keys(strictSchema.properties.products.items.properties);
  return strictSchema;
}
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
function containsAmount(text: string, amount: number) {
  return (text.match(/\d+(?:[.,]\d+)?/g) || []).some(value => Number(value.replace(",", ".")) === amount);
}
export function normalizedUnit(unit: string) {
  const value = unit.trim().toLowerCase().replace(/²/g, "2");
  const aliases: Record<string,string> = { litre:"l",liter:"l",litres:"l",liters:"l",bouteille:"bottle",bottles:"bottle",pieces:"piece",pièce:"piece",pot:"pot",pots:"pot",paquet:"pack",packs:"pack",bag:"bag",sac:"bag",kg:"kg",kilogram:"kg",kilogramme:"kg",m2:"m2" };
  return aliases[value] || value;
}
function packContainsUnit(evidence: string, unit: string) {
  const patterns: Record<string, RegExp> = {l:/\b(?:l|litres?|liters?)\b/i,kg:/\b(?:kg|kilogram(?:me)?s?)\b/i,m2:/(?:m²|m2|square metres?|square meters?)/i,m:/\b(?:m|metres?|meters?)\b/i,piece:/\b(?:pieces?|pièces?|units?)\b/i,pack:/\b(?:packs?|paquets?)\b/i,bottle:/\b(?:bottles?|bouteilles?)\b/i};
  return patterns[normalizedUnit(unit)]?.test(evidence) || false;
}
export function vettedPrices(
  raw: unknown,
  estimate: Estimate,
  urls: Set<string>,
  findings: string,
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
      (normalizedUnit(product.unit) !== normalizedUnit(item.unit) && (!product.quantityPerPack || !["pot","pack","bag","bottle","piece","roll","box"].includes(normalizedUnit(product.unit)) || !product.packEvidence || !findings.includes(product.packEvidence) || !packContainsUnit(product.packEvidence,item.unit) || !containsAmount(product.packEvidence,product.quantityPerPack))) ||
      !findings.includes(product.sourceEvidence) ||
      !containsAmount(product.sourceEvidence, product.price) ||
      (product.coveragePerUnit !== null && (!product.coverageEvidence || !findings.includes(product.coverageEvidence) || !containsAmount(product.coverageEvidence, product.coveragePerUnit))) ||
      /(?:search|recherche|category|categories)(?:[/?-]|$)/i.test(url.pathname) ||
      url.pathname === "/" ||
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
        coveragePerUnit: product.coveragePerUnit,
        purchaseUnit: product.unit,
        quantityPerPack: normalizedUnit(product.unit) === normalizedUnit(item.unit) ? 1 : product.quantityPerPack,
        evidence: product.sourceEvidence,
        price: product.price,
        url: product.url,
        title: product.title,
        checkedAt: new Date().toISOString(),
        note:
          product.note + (product.coveragePerUnit === null && item.coveragePerUnit !== null ? " Coverage uses the provisional estimate assumption." : "") + " Confirm pack coverage, delivery and checkout price.",
      },
    ];
  });
}

export function applyProductPacks(estimate: Estimate, sources: PriceSource[]): Estimate {
  return {...estimate,items:estimate.items.map((item,index)=>{
    const source=sources.find(s=>s.index===index);
    if(!source)return item;
    const factor=source.quantityPerPack || 1;
    // Quantities use the purchased pack. Published coverage takes precedence;
    // otherwise retain the provisional coverage assumption, scaled by pack size.
    const coverage=source.coveragePerUnit ?? (item.coveragePerUnit===null ? (factor !== 1 && item.basis === "manual" ? 1 : null) : item.coveragePerUnit*factor);
    return {...item,unit:source.purchaseUnit || item.unit,priceLow:source.price,priceHigh:source.price,
      manualQuantity:item.basis==="manual"&&item.coveragePerUnit===null&&item.manualQuantity!==null?item.manualQuantity/factor:item.manualQuantity,
      coveragePerUnit:coverage};
  })};
}
