import { z } from "zod";
const text = z.string().max(600);
const point = z
  .object({ x: z.number().min(0).max(50), y: z.number().min(0).max(50) })
  .strict();
export const planSchema = z
  .object({
    title: z.string().max(120),
    outline: z.array(point).min(3).max(12),
    ceilingHeight: z.number().min(1).max(10).nullable(),
    openings: z
      .array(
        z
          .object({
            kind: z.enum(["door", "window"]),
            wall: z.number().int().min(0).max(11),
            offset: z.number().min(0).max(50),
            width: z.number().positive().max(10),
            height: z.number().positive().max(5).nullable(),
          })
          .strict(),
      )
      .max(12),
    fixtures: z
      .array(
        z
          .object({
            label: z.string().max(80),
            x: z.number().min(0).max(50),
            y: z.number().min(0).max(50),
            width: z.number().positive().max(15),
            depth: z.number().positive().max(15),
          })
          .strict(),
      )
      .max(12),
    surfaces: z
      .array(
        z
          .object({
            surface: z.string().max(80),
            material: text,
            condition: z.enum(["good", "worn", "damaged", "unknown"]),
            evidence: text,
            recommendation: text,
            confidence: z.enum(["low", "medium", "high"]),
          })
          .strict(),
      )
      .max(8),
    assumptions: z.array(text).max(12),
    questions: z.array(text).max(3),
  })
  .strict();
export const visualSchema = z
  .object({
    title: z.string().max(120),
    sourcePhotoId: z.string().uuid(),
    brief: z.string().min(10).max(2000),
    retain: z.array(z.string().max(180)).max(12),
    changes: z.array(z.string().max(180)).min(1).max(12),
  })
  .strict();
export const estimateSchema = z
  .object({
    title: z.string().max(120),
    country: z.string().regex(/^[A-Z]{2}$/),
    city: z.string().max(100),
    currency: z.string().regex(/^[A-Z]{3}$/),
    items: z
      .array(
        z
          .object({
            item: z.string().max(100),
            specification: z.string().max(250),
            basis: z.enum([
              "floor_area",
              "ceiling_area",
              "wall_area",
              "perimeter",
              "manual",
            ]),
            manualQuantity: z.number().positive().max(100000).nullable(),
            unit: z.string().max(30),
            coveragePerUnit: z.number().positive().max(1000).nullable(),
            coats: z.number().int().min(1).max(4),
            waste: z.number().min(0).max(0.3),
            priceLow: z.number().min(0).max(100000),
            priceHigh: z.number().min(0).max(100000),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    assumptions: z.array(text).max(12),
    exclusions: z.array(text).max(12),
  })
  .strict();
export type RoomPlan = z.infer<typeof planSchema> & { confirmed?: boolean };
export type Estimate = z.infer<typeof estimateSchema>;
export type Visual = z.infer<typeof visualSchema>;
export type PriceSource = {
  purchaseUnit?: string;
  quantityPerPack?: number | null;
  coveragePerUnit?: number | null;
  evidence?: string;
  index: number;
  price: number;
  url: string;
  title: string;
  checkedAt: string;
  note: string;
};
export type Artifact = {
  id: string;
  kind: "plan" | "estimate" | "visual";
  data: any;
  status: "ready" | "queued" | "running" | "failed";
  model?: string;
  hasImage?: boolean;
  created_at: string;
};
export function roomMetrics(plan: RoomPlan) {
  const p = plan.outline;
  const signed =
    p.reduce((n, a, i) => {
      const b = p[(i + 1) % p.length];
      return n + a.x * b.y - b.x * a.y;
    }, 0) / 2;
  const perimeter = p.reduce((n, a, i) => {
    const b = p[(i + 1) % p.length];
    return n + Math.hypot(b.x - a.x, b.y - a.y);
  }, 0);
  const openingArea = plan.openings.reduce(
    (n, o) => n + o.width * (o.height || 0),
    0,
  );
  return {
    area: Math.abs(signed),
    perimeter,
    wallArea:
      plan.ceilingHeight === null
        ? null
        : Math.max(0, perimeter * plan.ceilingHeight - openingArea),
  };
}
export function validatePlan(plan: RoomPlan) {
  const p = plan.outline,
    metrics = roomMetrics(plan);
  if (metrics.area < 0.5 || metrics.area > 1500)
    throw new Error("The floor outline has an invalid area.");
  const cross = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
  ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.1)
      throw new Error("Duplicate or very short wall.");
    for (let j = i + 1; j < p.length; j++) {
      if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
      const c = p[j],
        d = p[(j + 1) % p.length];
      if (
        Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
          Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
        Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y)) <=
          Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) &&
        cross(a, b, c) * cross(a, b, d) <= 0 &&
        cross(c, d, a) * cross(c, d, b) <= 0
      )
        throw new Error("The floor outline intersects itself.");
    }
  }
  for (const o of plan.openings) {
    if (o.wall >= p.length)
      throw new Error("An opening refers to a missing wall.");
    const a = p[o.wall],
      b = p[(o.wall + 1) % p.length];
    if (o.offset + o.width > Math.hypot(b.x - a.x, b.y - a.y) + 0.01)
      throw new Error("An opening is outside its wall.");
  }
  const inside = (x: number, y: number) => {
    let hit = false;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const a = p[i],
        b = p[j];
      if (
        Math.abs(cross(a, b, { x, y })) < 0.0001 &&
        x >= Math.min(a.x, b.x) &&
        x <= Math.max(a.x, b.x) &&
        y >= Math.min(a.y, b.y) &&
        y <= Math.max(a.y, b.y)
      )
        return true;
      if (
        a.y > y !== b.y > y &&
        x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
      )
        hit = !hit;
    }
    return hit;
  };
  for (const f of plan.fixtures)
    if (
      ![
        [f.x, f.y],
        [f.x + f.width, f.y],
        [f.x, f.y + f.depth],
        [f.x + f.width, f.y + f.depth],
        [f.x + f.width / 2, f.y + f.depth / 2],
      ].every(([x, y]) => inside(x, y))
    )
      throw new Error("A fixture is outside the room.");
  return metrics;
}
const retailers: Record<string, string[]> = {
  FR: ["leroymerlin.fr", "castorama.fr", "ikea.com/fr", "manomano.fr", "bricodepot.fr"],
  GB: ["diy.com", "wickes.co.uk", "ikea.com/gb"],
  CH: ["hornbach.ch", "jumbo.ch", "ikea.com/ch"],
  DE: ["hornbach.de", "bauhaus.info", "ikea.com/de"],
  US: ["homedepot.com", "lowes.com", "ikea.com/us"],
  ES: ["leroymerlin.es", "ikea.com/es"],
  IT: ["leroymerlin.it", "ikea.com/it"],
  BE: ["brico.be", "ikea.com/be"],
  CA: ["homedepot.ca", "ikea.com/ca"],
};
export function retailerDomains(country: string) {
  return (retailers[country] || []).map((s) => s.split("/")[0]);
}
export function shoppingLinks(country: string, city: string, item: string) {
  const domains = retailers[country] || [];
  return domains.length
    ? domains.map((domain) => ({
        label: domain,
        url: `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${item} ${city}`)}`,
      }))
    : [
        {
          label: "Local shopping search",
          url: `https://www.google.com/search?q=${encodeURIComponent(`${item} ${city} ${country}`)}`,
        },
      ];
}
export function calculateEstimate(estimate: Estimate, plan: RoomPlan | null) {
  const metrics = plan ? roomMetrics(plan) : null;
  const items = estimate.items.map((item, index) => {
    if (item.priceHigh < item.priceLow)
      throw new Error("A price range is reversed.");
    let base: number | null = item.manualQuantity;
    if (item.basis === "floor_area" || item.basis === "ceiling_area")
      base = metrics?.area ?? null;
    if (item.basis === "wall_area") base = metrics?.wallArea ?? null;
    if (item.basis === "perimeter") base = metrics?.perimeter ?? null;
    if (base === null)
      throw new Error(`Measurements are missing for ${item.item}.`);
    const required = base * item.coats * (1 + item.waste);
    const quantity =
      item.coveragePerUnit !== null
        ? Math.ceil(required / item.coveragePerUnit)
        : Math.ceil(required * 100) / 100;
    return {
      ...item,
      index,
      base,
      required,
      quantity,
      low: Math.round(quantity * item.priceLow * 100) / 100,
      high: Math.round(quantity * item.priceHigh * 100) / 100,
      links: shoppingLinks(
        estimate.country,
        estimate.city,
        item.item + " " + item.specification,
      ),
    };
  });
  return {
    items,
    low: Math.round(items.reduce((n, i) => n + i.low, 0) * 100) / 100,
    high: Math.round(items.reduce((n, i) => n + i.high, 0) * 100) / 100,
    provisional: !plan?.confirmed,
  };
}
