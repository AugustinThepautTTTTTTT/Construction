import type { Artifact } from "./room-artifacts";
export function isProductLookupBill(bill: Artifact) {
  return (
    bill.data.purpose === "product_lookup" ||
    (bill.data.items?.length <= 2 &&
      /pr[eé]s[eé]lection|comparaison|comparison|product (?:lookup|search)|s[eé]lection.{0,20}produits/i.test(
        bill.data.title || "",
      ))
  );
}
// Older search turns incorrectly saved a tiny new bill. Keep those artifacts for
// history, but keep the full/linked bill as the project shopping authority.
export function materialBills(artifacts: Artifact[]) {
  const bills = artifacts.filter((a) => a.kind === "estimate"),
    linked = artifacts.find(
      (a) =>
        a.kind === "construction" &&
        bills.some((b) => b.id === a.data.estimateId),
    ),
    preferred =
      bills.find((b) => !isProductLookupBill(b)) ||
      bills.find((b) => b.id === linked?.data.estimateId) ||
      bills[0];
  return preferred
    ? [preferred, ...bills.filter((b) => b.id !== preferred.id)]
    : [];
}
