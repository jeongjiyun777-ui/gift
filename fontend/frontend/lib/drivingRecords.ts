export interface DrivingRecord {
  id: number | string;
  operated_on: string;
  category: string | null;
  carrier_name: string;
  shipper_name: string | null;
  region_1: string | null;
  region_2: string | null;
  shipping_line: string | null;
  start_km: number | null;
  km: number | null;
  container_spec: string | null;
  container_no: string | null;
  charge_amount: number | string;
  tax_amount: number | string | null;
  calculated_tax_amount: string;
  total_amount: string;
  memo: string | null;
  vehicle_number: string | null;
  recipient_name: string | null;
  created_at: string;
}

export const DRIVING_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export async function fetchDrivingRecords(year: string, month: string, signal?: AbortSignal): Promise<DrivingRecord[]> {
  if (!/^\d{4}$/.test(year) || Number(year) < 1 || Number(year) > 9998 || !/^(0?[1-9]|1[0-2])$/.test(month)) {
    throw new Error("조회할 연도와 월을 선택해 주세요.");
  }
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (year && month) params.set("month", month);
  const response = await fetch(`${DRIVING_API_URL}/driving-records${params.size ? `?${params}` : ""}`, {
    cache: "no-store", signal,
  });
  if (!response.ok) throw new Error("운행기록 조회 실패");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("운행기록 응답 형식 오류");
  return data as DrivingRecord[];
}

export function isValidKm(value: string): boolean {
  return /^[1-9][0-9]{0,2}$/.test(value.trim());
}


export interface DrivingTotals {
  charge_amount: string;
  tax_amount: string;
  total_amount: string;
}

export async function fetchDrivingReport(year: string, month: string, signal?: AbortSignal): Promise<{ records: DrivingRecord[]; totals: DrivingTotals }> {
  if (!/^\d{4}$/.test(year) || Number(year) < 1 || Number(year) > 9998 || !/^(0?[1-9]|1[0-2])$/.test(month)) {
    throw new Error("조회할 연도와 월을 선택해 주세요.");
  }
  const params = new URLSearchParams({ year, month });
  const response = await fetch(`${DRIVING_API_URL}/driving-records/report?${params}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("운행기록 조회 실패");
  return response.json();
}
