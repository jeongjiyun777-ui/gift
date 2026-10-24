export const UREA_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export interface UreaRecord {
  id: number;
  purchased_on: string;
  merchant_name: string;
  business_number: string | null;
  card_company: string | null;
  unit_price: string;
  liters: string;
  supply_amount: string;
  vat_amount: string;
  total_amount: string;
  created_at: string;
}


export type PurchaseKind = "urea" | "diesel";

export function purchaseEndpoint(kind: PurchaseKind) {
  return kind === "diesel" ? "/diesel-records" : "/urea-records";
}


export interface PurchaseTotals {
  liters: string;
  supply_amount: string;
  vat_amount: string;
  total_amount: string;
}

export interface PurchaseReport {
  records: UreaRecord[];
  totals: PurchaseTotals;
}
