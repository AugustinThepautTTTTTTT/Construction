import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planSchema, visualSchema, estimateSchema } from "./room-artifacts";
import { cadUpdateSchema } from "./cad/model";
const specs = [
  {folder:"edit-room-cad",name:"update_room_cad",description:"Create or revise the chat’s single editable 3D room CAD. Start from photos, retain stable object IDs and the current manual edits. Requires the current baseRevision (0 to create). All photo geometry remains provisional.",schema:cadUpdateSchema},
  {
    folder: "assess-room",
    name: "create_room_plan",
    description:
      "Save a measured or explicitly provisional 2D room plan and visible material condition assessment. Start from uploaded photos: infer approximate dimensions and visible openings, state evidence and uncertainty, then invite corrections.",
    schema: planSchema,
  },
  {
    folder: "improve-room-photo",
    name: "prepare_room_visual",
    description:
      "Prepare a before/after concept card using an uploaded photo. Generation requires the user's button click; this tool never generates images.",
    schema: visualSchema,
  },
  {
    folder: "estimate-materials",
    name: "create_material_estimate",
    description:
      "Save a quantitative bill of materials and local cost estimate with automatic real retailer product research and Excel export. Requires country/currency and a measured or provisional plan for area-based quantities.",
    schema: estimateSchema,
  },
];
export function skillInstructions() {
  return specs
    .map((s) =>
      readFileSync(
        join(process.cwd(), "ai-skills", s.folder, "SKILL.md"),
        "utf8",
      ),
    )
    .join("\n\n");
}
export function skillTools() {
  return specs.map((s) => {
    const { $schema, ...parameters } = s.schema.toJSONSchema({ io: "input" });
    return {
      type: "function" as const,
      name: s.name,
      description: s.description,
      parameters,
      strict: true,
    };
  });
}
