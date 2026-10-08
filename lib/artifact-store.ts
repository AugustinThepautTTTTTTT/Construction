import {newProductSchema,shoppingEstimate} from './product-shopping';
import {assertMarketMatches} from "./market-context";
import {openInspirationSchema,inspirationProfile} from "./inspiration-library";
import {workUpdateSchema,updateWorkPlan} from "./work-assistant";
import {requirePaid} from "./credits";
import { cadUpdateSchema, cadPlan } from "./cad/model";
import { getCad, saveCad } from "./cad/store";
import {
  searchMaterialProduct,
  productLookupSchema,
  ProductSearchError,
} from "./material-research";
import { randomUUID } from "node:crypto";
import type { Queryable } from "./repository";
import {
  visualSchema,
  estimateSchema,
  calculateEstimate,
  type RoomPlan,
} from "./room-artifacts";
import { constructionSchema, validateConstruction } from "./construction-plan";
export async function runRoomTool(
  db: Queryable,
  owner: string,
  projectId: string,
  name: string,
  args: unknown,
  options?: { market?:{city:string;country:string|null;currency:string|null}|null; inspiration?:boolean;executionUpdate?:boolean; productSearch?: boolean; visuals?: boolean; revisionSourceId?: string; materials?: boolean; construction?: boolean; layout?: boolean },
) {
  if(name==='open_inspiration_library'&&options?.inspiration===false)throw new Error('Inspiration was not requested.');
  if(name==='update_work_plan'&&options?.executionUpdate!==true)throw new Error('Work-plan update was not requested.');
  if(['search_material_product','search_new_product'].includes(name)&&options?.productSearch===false) throw new ProductSearchError('Product research was not requested, or this turn already saved a comparison.');
  if(name==='prepare_room_visual'&&options?.visuals===false)
    throw new Error('This request is for materials or work instructions. Save those requested deliverables; do not create an image.');
  if ((name === 'create_material_estimate' && options?.materials === false) || (name === 'create_construction_plan' && options?.construction === false) || (name === 'update_room_cad' && options?.layout === false)) throw new Error('This deliverable was not requested for the current turn.');
  const owned = await db.query(
    "SELECT id FROM roomwise.projects WHERE id=$1 AND user_id=$2",
    [projectId, owner],
  );
  if (!owned.rows.length) throw new Error("Room not found.");
  if (["update_work_plan","search_new_product","search_material_product","update_room_cad","create_material_estimate","create_construction_plan"].includes(name)) await requirePaid(db, owner);
  if(name==='open_inspiration_library'){
    const {room}=openInspirationSchema.parse(args);
    const found=await db.query("SELECT id FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='inspiration' ORDER BY created_at DESC LIMIT 1",[projectId,owner]);
    const id=found.rows[0]?.id||randomUUID();
    if(found.rows.length)await db.query("UPDATE roomwise.artifacts SET data=jsonb_set(data,'{room}',$1::jsonb) WHERE id=$2 AND user_id=$3",[JSON.stringify(room),id,owner]);
    else await db.query("INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data,model) VALUES($1,$2,$3,'inspiration',$4::jsonb,'fixed-library')",[id,owner,projectId,JSON.stringify({room,selectedIds:[],confirmed:false})]);
    return {id,kind:'inspiration',summary:'Fixed inspiration library opened in chat. Invite the client to choose up to three references or skip. No images generated and no design credits spent. Do not select for them or generate a design in this turn.'};
  }
  if(name==='update_work_plan'){
    const update=workUpdateSchema.parse(args);
    const data=await updateWorkPlan(db,owner,projectId,update.planId,update,update.expectedRevision);
    return {id:update.planId,kind:'construction',workRevision:data.workRevision,completedSteps:data.completedSteps,summary:'Existing work plan updated and saved. Explain the recorded changes briefly and answer their technical question using the current steps. This is not a new plan.'};
  }
  if(name==='search_new_product'){
    const input=newProductSchema.parse(args),market=options?.market;
    if(!input.estimateId){
      const existing=await db.query("SELECT id FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='estimate' AND data->>'shoppingDraft' IS DISTINCT FROM 'true' ORDER BY created_at DESC LIMIT 1",[projectId,owner]);
      input.estimateId=existing.rows[0]?.id||null;
    }
    if(!market?.country||!market.currency)throw new ProductSearchError('Confirm your shopping city and country first.');
    if(input.estimateId){
      const bill=await db.query("SELECT data FROM roomwise.artifacts WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='estimate'",[input.estimateId,projectId,owner]);
      if(!bill.rows.length||bill.rows[0].data.shoppingDraft)throw new ProductSearchError('Choose the existing complete bill in this room.');
      assertMarketMatches(bill.rows[0].data,market);
    }
    const id=randomUUID(),data=shoppingEstimate(input,{city:market.city,country:market.country,currency:market.currency});
    await db.query("INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data,model) VALUES($1,$2,$3,'estimate',$4::jsonb,'product-search')",[id,owner,projectId,JSON.stringify(data)]);
    const comparison=await searchMaterialProduct(db,owner,id,data,0,input.preferences);
    return {id,kind:'estimate',productIndex:0,products:comparison.products,summary:'Shopping comparison saved separately. The existing bill is unchanged. Offer Add to BOM to add the chosen product; provisional quantities need confirmation. Never describe this as a new complete bill.'};
  }
  if (name === "search_material_product") {
    const lookup = productLookupSchema.parse(args);
    const bill = await db.query(
      "SELECT id,data FROM roomwise.artifacts WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='estimate'",
      [lookup.estimateId, projectId, owner],
    );
    if (!bill.rows.length)
      throw new Error("Choose a material bill from this room.");
    if(options && 'market' in options)assertMarketMatches(bill.rows[0].data,options.market??null);
    const comparison = await searchMaterialProduct(
      db,
      owner,
      lookup.estimateId,
      bill.rows[0].data,
      lookup.index,
      lookup.preferences,
      lookup.location || undefined,
    );
    return {
      id: lookup.estimateId,
      kind: "estimate",
      productIndex: lookup.index,
      products: comparison.products,
      summary:
        "Product comparison saved for the requested item. The user can compare packs, quantities, prices and links, then choose a product in Materials. Do not claim an entire basket was researched.",
    };
  }
  if (name === "update_room_cad") {
    const { model, baseRevision, changeSummary } = cadUpdateSchema.parse(args);
    const current = await getCad(db, owner, projectId);
    const cad = await saveCad(
      db,
      owner,
      projectId,
      baseRevision,
      {
        ...model,
        ...(current?.model.appearance
          ? { appearance: current.model.appearance }
          : {}),
        confirmed: false,
      },
      "ai",
      changeSummary,
    );
    return {
      id: projectId,
      kind: "cad",
      revision: cad.revision,
      summary: changeSummary,
    };
  }
  if (name === "create_material_estimate" && options?.productSearch) {
    const existing = await db.query(
      "SELECT id FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='estimate' LIMIT 1",
      [projectId, owner],
    );
    if (existing.rows.length)
      throw new ProductSearchError(
        "Use the existing bill for this product search; a comparison cannot replace or shorten it.",
      );
  }
  let kind: string, data: Record<string, unknown>;
  if (name === "create_construction_plan") {
    const plan = constructionSchema.parse(args);
    const bill = await db.query(
      "SELECT id,kind,data FROM roomwise.artifacts WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='estimate'",
      [plan.estimateId, projectId, owner],
    );
    if (!bill.rows.length || bill.rows[0].data.shoppingDraft)
      throw new Error(
        "Create the complete bill of materials before the construction plan.",
      );
    validateConstruction(plan, {
      id: bill.rows[0].id,
      kind: bill.rows[0].kind,
      data: bill.rows[0].data,
    });
    kind = "construction";
    data = plan;
  } else if (name === "prepare_room_visual") {
    const visual = visualSchema.parse(args);
    const photo = await db.query(
      "SELECT id FROM roomwise.photos WHERE id=$1 AND project_id=$2 AND user_id=$3",
      [visual.sourcePhotoId, projectId, owner],
    );
    if (!photo.rows.length)
      throw new Error("Choose an original photo uploaded to this room.");
    kind = "visual";
    let revisionSourceId: string | undefined;
    if (options?.revisionSourceId) {
      const source = await db.query("SELECT id FROM roomwise.artifacts WHERE id=$1 AND project_id=$2 AND user_id=$3 AND kind='visual' AND image IS NOT NULL AND data->>'sourcePhotoId'=$4",[options.revisionSourceId,projectId,owner,visual.sourcePhotoId]);
      if (!source.rows.length) throw new Error("The previous concept is unavailable for this room photo. Do not start over.");
      revisionSourceId = source.rows[0].id;
    }
    const references=await db.query("SELECT data FROM roomwise.artifacts WHERE project_id=$1 AND user_id=$2 AND kind='inspiration' AND data->>'confirmed'='true' ORDER BY created_at DESC LIMIT 1",[projectId,owner]);
    const profile=references.rows[0]?.data?.selectedIds?.length?inspirationProfile(references.rows[0].data.selectedIds):undefined;
    data = {...visual,...(profile?{inspirationProfile:profile}:{}), ...(options?.visuals === true ? {visualAuthorized:true} : {}), ...(revisionSourceId ? {revisionSourceId} : {})};
  } else if (name === "create_material_estimate") {
    const estimate = estimateSchema.parse(args);
    if(options && 'market' in options)assertMarketMatches(estimate,options.market??null);

    const cad = await getCad(db, owner, projectId);
    const plan = cad ? cadPlan(cad.model) : (null as RoomPlan | null);
    const calculations = calculateEstimate(estimate, plan);
    kind = "estimate";
    data = {
      ...estimate,
      plan,
      planId: null,
      cadRevision: cad?.revision || null,
      calculations,
      priceSources: [],
    };
  } else throw new Error("Unknown room skill.");
  const id = randomUUID();
  await db.query(
    "INSERT INTO roomwise.artifacts(id,user_id,project_id,kind,data,model) VALUES($1,$2,$3,$4,$5::jsonb,'gpt-6-luna')",
    [id, owner, projectId, kind, JSON.stringify(data)],
  );
  if (kind === "visual")
    await db.query(
      "UPDATE roomwise.artifacts SET status='queued' WHERE id=$1 AND user_id=$2",
      [id, owner],
    );
  return {
    id,
    products: [],
    kind,
    summary:
      kind === "construction"
        ? "Construction checklist saved, linked to the bill rows. The app shows the ordered steps, materials, tools and supplier links directly in chat and in the project Construction plan folder. Provide only a short polished introduction."
        : kind === "estimate"
          ? "Bill saved with quantities, estimated allowances and Excel export. No internet search has run. Product search is an optional advanced capability for ONE item explicitly requested by the user."
          : "Before/after design saved and queued. The application automatically starts one image edit for signed-in accounts with credits and shows it directly in chat and also saves it in the project visual folder. Do not say it is finished yet.",
  };
}
