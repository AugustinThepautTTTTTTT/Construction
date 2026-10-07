import { readFileSync } from "node:fs";
import { join } from "node:path";
import { visualSchema, estimateSchema } from "./room-artifacts";
import { cadUpdateSchema } from "./cad/model";
import { productLookupSchema } from "./material-research";
import { constructionSchema } from "./construction-plan";
const specs = [
  {folder:"find-product",name:"search_material_product",description:"Advanced opt-in search: compare up to two actual retailer products for ONE requested bill row. Use only when the user explicitly asks to find/compare a specific product. Never run as part of a default BOM or construction plan. Requires saved bill ID and exact row index.",schema:productLookupSchema},
  {folder:"edit-room-cad",name:"update_room_cad",description:"Create or revise the chat’s single editable 3D room CAD. Start from photos, retain stable object IDs and the current manual edits. Requires the current baseRevision (0 to create). All photo geometry remains provisional.",schema:cadUpdateSchema},
  {folder:"construction-plan",name:"create_construction_plan",description:"Save a sequenced construction / refurbishment works plan linked to an existing bill of materials. Include practical steps, preparation, tools, material row indexes, dependencies, drying times and completion checks. This is a work checklist, never a floor plan.",schema:constructionSchema},
  {
    folder: "improve-room-photo",
    name: "prepare_room_visual",
    description:
      "Prepare a before/after concept card using an uploaded photo. The app automatically dispatches one bounded image edit after this tool saves the requested design. Do not claim it is finished until ready.",
    schema: visualSchema,
  },
  {
    folder: "estimate-materials",
    name: "create_material_estimate",
    description:
      "Save a quantitative bill of materials and local cost estimate with estimated allowances and Excel export. No web search by default. Include ALL supplies, preparation, individual tools, fixings, protection and finishing materials. Requires country/currency. Use existing CAD or explicit provisional manual quantities; never generate a 2D plan.",
    schema: estimateSchema,
  },
];
export function skillInstructions() {
  return readFileSync(join(process.cwd(), "ai-skills", "assess-room", "SKILL.md"), "utf8") + "\n\n" + specs
    .map((s) =>
      readFileSync(
        join(process.cwd(), "ai-skills", s.folder, "SKILL.md"),
        "utf8",
      ),
    )
    .join("\n\n");
}
export function skillTools(options?:{layout:boolean;products?:boolean}) {
  return specs.filter(s=>(options?.layout!==false||s.name!=="update_room_cad")&&(options?.products!==false||s.name!=="search_material_product")).map((s) => {
    const { $schema, ...parameters } = s.schema.toJSONSchema({ io: "input" });
    if(s.name==="create_material_estimate"){
      parameters.required=Object.keys(parameters.properties!);
      const items=(parameters.properties as any).items.items;
      items.required=Object.keys(items.properties);
    }
    return {
      type: "function" as const,
      name: s.name,
      description: s.description,
      parameters,
      strict: true,
    };
  });
}
