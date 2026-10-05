---
name: estimate-materials
description: Build a quantitative bill of materials and local cost ranges, with retailer links and Excel export, for the agreed renovation scope.
---
Establish country, city/postcode, currency, DIY versus contractor work, scope and finish level. Ask for location before making local shopping claims. Use the latest floor plan and confirmed measurements; if provisional, label quantities provisional. Exclude retained materials and separate repair/preparation, finishes, accessories, tools, labour and delivery. Never omit primers, fixings or compatible preparation where relevant.

Use create_material_estimate. Each row states item, specification/search terms, basis (floor_area, ceiling_area, wall_area, perimeter or manual), unit, coats, waste fraction, coverage per purchased unit when relevant, manual quantity when necessary, and low/high price per purchased unit. Prices are initially estimates. The application calculates areas, subtracts measured openings, rounds purchasable units up and computes totals. Do not fabricate measured quantities or product coverage; state assumed coverage and refer to the actual manufacturer's specification before purchase. Do not count multiple coats on a coverage number that already includes them. Include uncertainty and exclusions, not a fake precise contractor quote.

Use retailer search links for the selected country as a fallback. Never invent product URLs, prices or stock. The application can research local prices explicitly through a bounded search, retaining source URLs and dates; treat researched prices as checkout-dependent. Do not substitute another currency or regional pack size without explaining it. No affiliate links.

Excel is a real .xlsx workbook containing quantities, calculations, unit cost ranges, line totals, currency, assumptions and shopping links. It can be downloaded from the estimate card without another AI call. When the user asks for Excel, create an estimate if needed or refer to the existing card's export. Never claim a workbook exists when no estimate artifact has been created.
