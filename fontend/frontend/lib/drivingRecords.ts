export interface DrivingRecord {
  id: number | string;
  operated_on: string;
  category: string | null;
  shipper_name: string;
  region_1: string | null;
  region_2: string | null;
  shipping_line: string | null;
  container_spec: string | null;
  container_no: string | null;
  charge_amount: number | string;
  tax_amount: number | string | null;
  memo: string | null;
  vehicle_number: string | null;
  recipient_name: string | null;
  created_at: string;
}

export const DRIVING_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function sumDrivingCharges(records: DrivingRecord[]): string {
  return records.reduce((sum, record) => {
    const amount = String(record.charge_amount).replaceAll(",", "").trim();
    return sum + BigInt(amount);
  }, BigInt(0)).toString();
}

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
