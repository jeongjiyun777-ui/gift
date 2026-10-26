export interface DrivingOverview {
  year: number;
  month: number;
  driving_total_amount: string | null;
  expense_total_amount: string;
  repair_total_amount: string;
  urea_total_amount: string;
  diesel_total_amount: string;
  income_tax_estimate: string | null;
  expense_tax_estimate: string | null;
}

export function parseDrivingOverview(value: unknown): DrivingOverview {
  if (typeof value !== "object" || value === null) throw new Error("서버 응답 형식이 올바르지 않습니다.");
  const data = value as Record<string, unknown>;
  if (!Number.isInteger(data.year) || !Number.isInteger(data.month)) throw new Error("조회 날짜를 확인하지 못했습니다.");
  function amount(key: string, optional = false): string | null {
    const raw = data[key];
    if (optional && (raw === null || raw === undefined)) return null;
    if ((typeof raw !== "string" && typeof raw !== "number") || !/^-?\d+(?:\.\d{1,2})?$/.test(String(raw))) {
      throw new Error("서버의 금액 응답 형식을 확인해 주세요.");
    }
    return String(raw);
  }
  return {
    year: data.year as number, month: data.month as number,
    driving_total_amount: amount("driving_total_amount", true),
    expense_total_amount: amount("expense_total_amount")!,
    repair_total_amount: amount("repair_total_amount")!,
    urea_total_amount: amount("urea_total_amount")!,
    diesel_total_amount: amount("diesel_total_amount")!,
    income_tax_estimate: amount("income_tax_estimate", true),
    expense_tax_estimate: amount("expense_tax_estimate", true),
  };
}

export function formatOverviewMoney(value: string | null): string {
  if (value === null) return "-";
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = value.replace(/^-/, "").split(".");
  const decimals = fraction.replace(/0+$/, "");
  return `${negative ? "-" : ""}${BigInt(integer).toLocaleString("ko-KR")}${decimals ? `.${decimals}` : ""}원`;
}
