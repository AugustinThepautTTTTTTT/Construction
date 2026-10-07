import ExcelJS from "exceljs";
import { materialPresentation } from "./material-presentation";
import type { Artifact } from "./room-artifacts";
import {
  calculateEstimate,
  type Estimate,
  type RoomPlan,
  type PriceSource,
} from "./room-artifacts";
export async function materialWorkbook(
  data: Estimate & { plan?: RoomPlan; priceSources?: PriceSource[];productComparisons?:Record<string,any>;shoppingChecked?:Record<string,boolean> },
) {
  const calculated = calculateEstimate(data, data.plan || null),
    workbook = new ExcelJS.Workbook();
  const presentation=materialPresentation({data:{...data,calculations:calculated}} as Artifact);
  workbook.creator = "Archicova";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Bill of materials", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  sheet.addRow([data.title]);
  sheet.addRow([
    `${data.city}, ${data.country} · ${data.currency} · ${calculated.provisional ? "Provisional measurements" : "User-confirmed measurements"}`,
  ]);
  sheet.addRow([
    "Sourced items use researched product prices; unverified items use allowances. Check pack coverage, current prices, delivery and professional quotes before buying.",
  ]);
  sheet.addRow([
    "Item",
    "Specification",
    "Basis",
    "Measured basis",
    "Coats",
    "Waste",
    "Coverage/unit",
    "Quantity to buy",
    "Unit",
    "Low unit price",
    "High unit price",
    "Low total",
    "High total",
    "Provider",
    "Researched product",
    "Researched price",
    "Checked",
    "Source note",
  ]);
  for (const item of presentation.rows) {
    const source = item.source;
    const unitLow=source?.price ?? item.priceLow,unitHigh=source?.price ?? item.priceHigh;
    sheet.addRow([
      item.item,
      item.specification,
      item.basis,
      item.base,
      item.coats,
      item.waste,
      item.coveragePerUnit ?? "",
      item.quantity,
      item.unit,
      unitLow,
      unitHigh,
      {
        formula: `H${sheet.rowCount + 1}*J${sheet.rowCount + 1}`,
        result: source ? item.subtotal : item.low,
      },
      {
        formula: `H${sheet.rowCount + 1}*K${sheet.rowCount + 1}`,
        result: source ? item.subtotal : item.high,
      },
      source ? new URL(source.url).hostname : "Unverified",
      source ? { text: source.title, hyperlink: source.url } : "",
      source?.price ?? "",
      source?.checkedAt || "",
      source?.note || "Price estimate; not a verified current product price.",
    ]);
  }
  const end = sheet.rowCount;
  sheet.addRow([
    "TOTAL",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    data.currency,
    null,
    null,
    { formula: `SUM(L5:L${end})`, result: presentation.low },
    { formula: `SUM(M5:M${end})`, result: presentation.high },
  ]);
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: end, column: 18 },
  };
  sheet.columns.forEach((column, i) => {
    column.width = [
      24, 42, 18, 18, 10, 10, 18, 18, 15, 18, 18, 18, 18, 30, 35, 20, 24, 45,
    ][i];
  });
  for (const row of [1, 4, sheet.rowCount]) {
    sheet.getRow(row).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(row).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF243D30" },
    };
  }
  for (let r = 5; r <= end; r++) {
    sheet.getCell(r, 6).numFmt = "0%";
    for (const c of [4, 7, 8, 10, 11, 12, 13, 16])
      sheet.getCell(r, c).numFmt = "#,##0.00";
    sheet.getRow(r).alignment = { vertical: "top", wrapText: true };
  }
  const assumptions = workbook.addWorksheet("Assumptions and scope");
  assumptions.columns = [{ width: 28 }, { width: 100 }];
  assumptions.addRow(["Currency", data.currency]);
  assumptions.addRow(["Location", `${data.city}, ${data.country}`]);
  assumptions.addRow([
    "Measurements",
    calculated.provisional
      ? "Provisional — confirm before ordering"
      : "Confirmed by user, not an on-site professional survey",
  ]);
  for (const a of data.assumptions) assumptions.addRow(["Assumption", a]);
  for (const e of data.exclusions) assumptions.addRow(["Excluded", e]);
  if (data.plan)
    for (const a of data.plan.assumptions)
      assumptions.addRow(["Geometry assumption", a]);
  assumptions.addRow([
    "Quantity method",
    "basis × coats × (1 + waste); divide by coverage per purchased unit and round up where supplied. Wall area subtracts openings only where their height is known.",
  ]);
  if(data.measurements){
    assumptions.addRow(["Surface measurements",JSON.stringify(data.measurements)]);
  }
  if(data.productComparisons){
    const comparison=workbook.addWorksheet("Product comparisons");
    comparison.columns=[{header:"Bill item",width:30},{header:"Product",width:50},{header:"Pack price",width:18},{header:"Purchase unit",width:18},{header:"Link",width:60},{header:"Checked",width:25},{header:"Suitability / limitations",width:70},{header:"Selected",width:15}];
    for(const [index,options] of Object.entries(data.productComparisons))for(const product of options.products||[])comparison.addRow([data.items[Number(index)]?.item,product.title,product.price,product.purchaseUnit,{text:product.url,hyperlink:product.url},product.checkedAt,product.note,data.priceSources?.some(source=>source.index===Number(index)&&source.url===product.url)?"Yes":""]);
  }
  const shopping=workbook.addWorksheet("Shopping checklist");shopping.columns=[{header:"Item",width:30},{header:"Quantity",width:15},{header:"Unit",width:15},{header:"Ready / owned",width:18},{header:"Product link",width:60}];
  for(const row of presentation.rows)shopping.addRow([row.item,row.quantity,row.unit,data.shoppingChecked?.[row.index]?"Yes":"",row.source?{text:row.source.title,hyperlink:row.source.url}:"Allowance"]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
