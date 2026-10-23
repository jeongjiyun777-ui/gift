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

export async function fetchDrivingRecords(year = "", month = "", signal?: AbortSignal): Promise<DrivingRecord[]> {
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
