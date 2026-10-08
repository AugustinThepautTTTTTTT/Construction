# Inspiration and execution journey

Dev iteration extends the existing design → materials → products → work-plan flow. The journey remains flexible: users may skip inspiration and return to earlier stages. No automatic downstream image or product generation is introduced.

## Fixed inspiration library

Eight fixed references cover bathroom, kitchen, living room and bedroom, with room/style filters, search, palettes and selection of up to three. Photographs are local static assets downloaded once from Unsplash; no image or web-search model runs when browsing or saving. Source image URLs are recorded in lib/inspiration-library.ts; https://unsplash.com/license documents the source's license. The catalogue and profiles are versioned code and can be expanded deliberately.

The semantic harness opens the library for suitable introductory renovation descriptions or explicit requests to revisit it. It does not force references onto direct generation, BOM, sourcing or technical-work requests. A confirmed selection or explicit skip is persisted as an owner-bound inspiration artifact; selection saves cost no AI credits. Ordinary chat messages and explicitly requested designs retain existing credit rules. The server derives palette/material/direction context from validated catalogue IDs and includes it both in the next design conversation and in the saved image-generation brief. Actual room geometry, retained elements, budget and latest explicit instructions remain authoritative.

## Execution assistant

The same agent receives the saved work plan with revision, progress, dependencies, drying times, checks and linked bill context. The next unfinished and explicitly referenced steps include full instructions; other steps receive concise summaries to keep context bounded. Questions alone have no mutation tools. Explicit reports of completion/reopening or requested saved instruction/check edits enable a tool updating the existing plan, never a replacement plan. Instruction edits retain professional requirements. A changed/reopened prerequisite clears dependent completion.

Owner/project checks and optimistic JSON comparison prevent cross-project edits and stale overwrites. Manual completion controls use the same revision-aware update helper. A recorded completion does not establish drying, curing, inspection or hazard remediation. Qualified-professional requirements remain in context; missing manufacturer values are not fabricated.

## Dev testing

Start a new conversation with a room renovation goal, select references or skip, then request a design using a real room photo. Existing BOM/product/work flows remain available. With a work plan, ask how to carry out a step, then report a step completed and ask about the next. Check that questions do not tick steps, completion does, reopening clears dependents, and revisiting inspiration remains possible.

/review/journey is Preview-only and returns 404 outside Preview. Its fixed library and synthetic work plan make no AI calls and cannot save to customer records. ARCHICOVA_JOURNEY_EVAL=1 runs eight multilingual semantic cases and a real strict work-plan tool call during a preview build, without customer writes or credit debits. Disable the flag after validation.
