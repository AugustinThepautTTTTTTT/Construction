# Persistent room CAD

One parameterized room model belongs to each chat. Photos seed approximate geometry; the owner can correct it directly or ask Luna to modify it. The saved room geometry is the authority for derived 2D plans and quantities. Images remain the reference for finishes and visual concepts.

A studio panel beside the conversation contains orbit/top views, selection, dimensions, move controls, display modes, export and revision history. Mobile opens it as a full-height sheet. Reopening a chat restores its latest model. Display controls do not alter geometry. User edits cost no AI tokens.

The model is bounded structured data (metres, XY floor, +Z up), with polygon outline, ceiling/wall dimensions, openings, named fixture primitives and finish swatches. Luna uses a validated update tool with a base revision, not arbitrary executable code. Each successful edit atomically appends a revision, including its origin. Stale edits receive the latest model and cannot overwrite another change. Undo/restore creates a new revision. The same model is supplied on every chat turn and its derived plan powers material quantities.

The upstream earthtojake/text-to-cad camera/render runtime is vendored under MIT and used by the viewer. Its cadgen/build123d model contract supplies the portable Python source export (STEP via pinned cadgen). The web studio renders parameterized solid geometry locally; it does not execute model-generated Python on the server. GLB/STL and editable JSON exports are generated directly, alongside editable JSON and a cadgen Python source for native CAD regeneration. Keep this distinction explicit.

Verification: polygon/opening/fixture validity; real wall holes; rotated bounds; ownership and concurrency; restoration and derived quantities; glTF/STL exports; safe Python/JSON source generation; renderer camera views; production build and deployed revision. Preserve payments, privacy and shared $5 Luna budget.
