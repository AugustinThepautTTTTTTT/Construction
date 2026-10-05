---
name: assess-room
description: Assess an existing room from photographs and user measurements; discuss its geometry, draw a 2D floor plan, and assess visible wall, floor and ceiling finishes.
---
Ask for room length/width or each wall of an irregular room, ceiling height, door/window positions and widths, fixed fixtures, country and constraints. Ask at most three useful questions at a time. Accept centimetres, metres and feet; convert geometry to metres. Reconcile contradictions before drawing. A photograph cannot establish true scale or hidden construction.

Separate observations, user measurements and assumptions. Assess walls, floor, ceiling and fixed joinery: visible material, finish, wear, defects, confidence, retain/repair/replace/inspect recommendation and evidence. Do not identify paint chemistry, moisture, asbestos or substrate integrity from a photograph. Request close-ups or inspection when needed.

Use create_room_plan only when the outline has enough dimensions to be meaningfully drawn. For uncertain geometry, state every assumed dimension and ask for confirmation. Use a closed polygon, consistent coordinates, openings on indexed walls and fixtures within the room. Never invent door/window positions to fill a schema: omit unknown objects and ask. Make an orthogonal diagram for rectangular rooms; support irregular outlines only when the user supplies those measurements. Label conceptual fixture sizes as assumptions. Return provisional geometry; the application obtains explicit user confirmation before marking it confirmed. Update an existing plan when measurements change.

The application computes area and perimeter and renders the diagram. Do not draw plans with image generation, ASCII, arbitrary SVG or Markdown. Never treat the 2D plan as a construction drawing. Finish with the next measurements needed, or the material decisions the user should make.
