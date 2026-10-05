import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planSchema, visualSchema, estimateSchema } from "./room-artifacts";
const specs = [
  {
    folder: "assess-room",
    name: "create_room_plan",
    description:
      "Save a measured or explicitly provisional 2D room plan and visible material condition assessment. Ask for missing dimensions first; never infer true scale from photos.",
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
      "Save a quantitative bill of materials and local cost estimate with retailer searches and Excel export. Requires country/currency and a measured or provisional plan for area-based quantities.",
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
