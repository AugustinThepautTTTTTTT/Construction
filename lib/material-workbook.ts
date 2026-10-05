import ExcelJS from "exceljs";
import {
  calculateEstimate,
  type Estimate,
  type RoomPlan,
  type PriceSource,
} from "./room-artifacts";
export async function materialWorkbook(
  data: Estimate & { plan?: RoomPlan; priceSources?: PriceSource[] },
) {
  const calculated = calculateEstimate(data, data.plan || null),
    workbook = new ExcelJS.Workbook();
  workbook.creator = "Roomwise";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Bill of materials", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  sheet.addRow([data.title]);
  sheet.addRow([
    `${data.city}, ${data.country} · ${data.currency} · ${calculated.provisional ? "Provisional measurements" : "User-confirmed measurements"}`,
  ]);
  sheet.addRow([
    "Planning estimate. Check pack coverage, prices, delivery and professional quotes before buying.",
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
  for (const item of calculated.items) {
    const source = data.priceSources?.find((s) => s.index === item.index);
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
      item.priceLow,
      item.priceHigh,
      {
        formula: `H${sheet.rowCount + 1}*J${sheet.rowCount + 1}`,
        result: item.low,
      },
      {
        formula: `H${sheet.rowCount + 1}*K${sheet.rowCount + 1}`,
        result: item.high,
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
    { formula: `SUM(L5:L${end})`, result: calculated.low },
    { formula: `SUM(M5:M${end})`, result: calculated.high },
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
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
