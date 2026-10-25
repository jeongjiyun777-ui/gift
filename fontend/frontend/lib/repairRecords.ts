export const REPAIR_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
export interface RepairRecord {
  id: number;
  repaired_at: string;
  merchant_name: string;
  business_number: string | null;
  card_company: string | null;
  installment_months: number | null;
  total_amount: string;
  created_at: string;
  supply_amount: string;
  vat_amount: string;
  monthly_amount: string | null;
  last_installment_amount: string | null;
}
export function repairDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export interface RepairTotals {
  supply_amount: string;
  vat_amount: string;
  total_amount: string;
  monthly_amount: string;
}
export interface RepairReport {
  records: RepairRecord[];
  totals: RepairTotals;
}
