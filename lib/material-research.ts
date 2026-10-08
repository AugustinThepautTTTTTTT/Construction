import {addShoppingSelection} from './product-shopping';
import { fetchProductImage } from "./product-images";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { debitCredits, refundCredits, requirePaid, CreditError } from "./credits";
import { z } from "zod";
import type { Queryable } from "./repository";
import { rateLimit } from "./database";
import { aiPolicy } from "./ai-budget";
import {
  estimateSchema,
  calculateEstimate,
  type PriceSource,
} from "./room-artifacts";
import {
  retrievedUrls,
  vettedPrices,
  applyProductPacks,
} from "./price-research";
import {
  productSearchRequest,
  runProductSearch, productExtractionRequest,
  reusableComparison, resolveSearchLocation, diverseProductOptions, type SearchLocation,
} from "./product-search";
export const productSearchLocationSchema=z.object({city:z.string().trim().min(1).max(100),postalCode:z.string().trim().max(20).default('')}).strict();
export const productLookupSchema = z
  .object({
    estimateId: z.string().uuid(),
    index: z.number().int().min(0).max(39),
    preferences: z.string().max(500),
    location: productSearchLocationSchema.nullable().optional(),
  })
  .strict();
export class ProductSearchError extends Error {}
export type ProductComparison = {
  index: number;
  preferences: string;
  checkedAt: string;
  products: PriceSource[];
  notice: string;
  location?: SearchLocation;
};
export async function searchMaterialProduct(
  db: Queryable,
  owner: string,
  id: string,
  data: any,
  index: number,
  preferences = "",
  requestedLocation?: {city:string;postalCode?:string},
): Promise<ProductComparison> {
  await requirePaid(db, owner);
  const operation = `search:${randomUUID()}`;
  const estimate = estimateSchema.parse(
    Object.fromEntries(
      Object.keys(estimateSchema.shape).map((key) => [
        key,
        key === "items" ? data.quantityItems || data.items : data[key],
      ]),
    ),
  );
  if (!estimate.items[index])
    throw new ProductSearchError("Choose one item from this bill.");
  const location=resolveSearchLocation(estimate,requestedLocation ? productSearchLocationSchema.parse(requestedLocation) : undefined);
  const cached = data.productComparisons?.[index];
  if (reusableComparison(cached, index, preferences, location)) return cached;
  const policy = aiPolicy();
  if (!policy)
    throw new ProductSearchError(
      "Product search is temporarily unavailable.",
    );
  const claim = await db.query(
    "UPDATE roomwise.artifacts SET data=data || $1::jsonb WHERE id=$2 AND user_id=$3 AND kind='estimate' AND (data->>'productSearchStatus' IS DISTINCT FROM 'running' OR COALESCE((data->>'productSearchStartedAt')::timestamptz,'epoch'::timestamptz)<now()-interval '3 minutes') RETURNING id",
    [
      JSON.stringify({
        productSearchStatus: "running",
        productSearchStartedAt: new Date().toISOString(),
        productSearchIndex: index,
      }),
      id,
      owner,
    ],
  );
  if (!claim.rows.length)
    throw new ProductSearchError(
      "A product comparison is already running. Please wait for it to finish.",
    );
  let phase = "limits";
  try {
    await debitCredits(db, owner, operation, 'search');
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 60000,
      maxRetries: 0,
    });
    const request = productSearchRequest(
      estimate,
      index,
      policy.model,
      preferences,
      location,
    );
    phase = "search";
    const researched = await runProductSearch(client, request);
    if (researched.status !== "completed")
      throw new Error("SEARCH_INTERRUPTED");
    const findings = researched.output_text,
      urls = retrievedUrls(researched.output);
    phase = "extraction";
    const response = await client.responses.create(productExtractionRequest(estimate,index,policy.model,preferences,location,findings,urls));
    if (response.status !== "completed")
      throw new Error("EXTRACTION_INTERRUPTED");
    const products = diverseProductOptions(vettedPrices(
      JSON.parse(response.output_text),
      estimate,
      urls,
      findings,
      undefined,
      { openRetailers: true, allowAlternatives: true },
    )
      .filter((p) => p.index === index)
      );
    await Promise.all(
      products.map(async (product) => {
        const image = product.imageUrl || await fetchProductImage(product.url);
        if (image) product.imageUrl = image;
      }),
    );
    if (!products.length) await refundCredits(db, owner, operation);
    const comparison: ProductComparison = {
      index,
      preferences,
      location,
      checkedAt: new Date().toISOString(),
      products,
      notice: products.length
        ? "Prices exclude unverified delivery costs. Confirm compatibility, stock and checkout totals before ordering."
        : "No suitable product with a verifiable price and pack size was found. Try a clearer specification; your allowance stays unchanged.",
    };
    await db.query(
      "UPDATE roomwise.artifacts SET data=jsonb_set(jsonb_set(COALESCE(data,'{}'::jsonb),'{productComparisons}',COALESCE(data->'productComparisons','{}'::jsonb) || $1::jsonb),'{productSearchStatus}','\"complete\"'::jsonb) || $2::jsonb WHERE id=$3 AND user_id=$4",
      [
        JSON.stringify({ [index]: comparison }),
        JSON.stringify({ lastProductSearchIndex: index }),
        id,
        owner,
      ],
    );
    return comparison;
  } catch (e) {
    await db.query(
      "UPDATE roomwise.artifacts SET data=jsonb_set(data,'{productSearchStatus}','\"failed\"'::jsonb) WHERE id=$1 AND user_id=$2",
      [id, owner],
    );
    await refundCredits(db, owner, operation).catch(() => {});
    if (e instanceof CreditError || e instanceof ProductSearchError) throw e;
    const failure = e as { status?: number; code?: string; param?: string };
    console.warn("Archicova product search failed", {
      phase,
      status: failure.status,
      code: failure.code,
      param: failure.param,
    });
    throw new ProductSearchError(
      "Product search could not finish. Your complete bill is unchanged. Please try this item again.",
    );
  }
}
// Each edit uses optimistic concurrency, retaining simultaneous searches/checklists.
export async function editMaterialBill(
  db: Queryable,
  owner: string,
  id: string,
  edit: (data: any) => any,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = await db.query(
      "SELECT data FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='estimate'",
      [id, owner],
    );
    if (!found.rows.length) throw new ProductSearchError("Bill not found.");
    const previous = found.rows[0].data,
      next = edit(previous);
    const saved = await db.query(
      "UPDATE roomwise.artifacts SET data=$1::jsonb WHERE id=$2 AND user_id=$3 AND data=$4::jsonb RETURNING id",
      [JSON.stringify(next), id, owner, JSON.stringify(previous)],
    );
    if (saved.rows.length) return next;
  }
  throw new ProductSearchError("Your bill changed. Refresh and try again.");
}
export async function selectMaterialProduct(
  db: Queryable,
  owner: string,
  id: string,
  index: number,
  url: string,
) {
  const found=await db.query("SELECT data,project_id FROM roomwise.artifacts WHERE id=$1 AND user_id=$2 AND kind='estimate'",[id,owner]);
  const draft=found.rows[0]?.data;
  if(draft?.shoppingDraft&&draft.targetEstimateId){
    const target=await db.query("SELECT id FROM roomwise.artifacts WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='estimate'",[draft.targetEstimateId,found.rows[0].project_id,owner]);
    const source=draft.productComparisons?.[index]?.products?.find((p:PriceSource)=>p.url===url&&p.index===index);
    if(!target.rows.length||!source||index!==0)throw new ProductSearchError('Choose a verified product for your existing room bill.');
    await editMaterialBill(db,owner,draft.targetEstimateId,data=>addShoppingSelection(data,draft,id,source));
    return editMaterialBill(db,owner,id,data=>({...data,priceSources:[source],addedToBill:true}));
  }
  return editMaterialBill(db, owner, id, (data) => {
    const source = data.productComparisons?.[index]?.products?.find(
      (p: PriceSource) => p.url === url && p.index === index,
    );
    if (!source)
      throw new ProductSearchError(
        "Choose a verified product from the saved comparison.",
      );
    const quantityItems = data.quantityItems || data.items;
    const estimate = estimateSchema.parse(
      Object.fromEntries(
        Object.keys(estimateSchema.shape).map((key) => [
          key,
          key === "items" ? quantityItems : data[key],
        ]),
      ),
    );
    const priceSources = [
      ...(data.priceSources || []).filter(
        (p: PriceSource) => p.index !== index,
      ),
      source,
    ];
    const { items } = applyProductPacks(estimate, priceSources);
    return {
      ...data,
      ...(data.shoppingDraft?{shoppingDraft:false}:{}),
      quantityItems,
      items,
      priceSources,
      calculations: calculateEstimate(
        { ...estimate, items },
        data.plan || null,
      ),
    };
  });
}
