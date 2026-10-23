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
