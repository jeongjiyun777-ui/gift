"use client";

import { useEffect, useState } from "react";
import { DRIVING_API_URL, type DrivingOdometerReadings } from "@/lib/drivingRecords";

export interface OdometerValues {
  start_odometer_km: string;
  pickup_odometer_km: string;
  arrival_odometer_km: string;
}
interface DistanceResult { start_km: number; km: number; total_distance_km: number }
export const EMPTY_ODOMETERS: OdometerValues = { start_odometer_km: "", pickup_odometer_km: "", arrival_odometer_km: "" };
export const isOdometer = (value: string) => /^\d{1,7}$/.test(value);

export default function DrivingOdometerInputs({ values, onChange }: { values: OdometerValues; onChange: (values: OdometerValues) => void }) {
  const [result, setResult] = useState<{ key: string; distances?: DistanceResult; error?: string } | null>(null);
  const start = values.start_odometer_km;
  const pickup = values.pickup_odometer_km;
  const arrival = values.arrival_odometer_km;
  const complete = [start, pickup, arrival].every(isOdometer);
  const ordered = complete && Number(start) <= Number(pickup) && Number(pickup) <= Number(arrival);
  const key = `${start}/${pickup}/${arrival}`;

  useEffect(() => {
    if (!ordered) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${DRIVING_API_URL}/driving-records/distance`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start_odometer_km: Number(start), pickup_odometer_km: Number(pickup), arrival_odometer_km: Number(arrival) } satisfies DrivingOdometerReadings), signal: controller.signal,
        });
        if (!response.ok) throw new Error("거리 계산에 실패했습니다. 서버 배포 상태를 확인해 주세요.");
        const distances: DistanceResult = await response.json();
        if (!controller.signal.aborted) setResult({ key, distances });
      } catch (cause) {
        if (!controller.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : "거리 계산에 실패했습니다." });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [start, pickup, arrival, ordered, key]);

  const shown = result?.key === key ? result : null;
  return (
    <section aria-label="누적 주행거리 입력" className="space-y-4">
      <div className="grid gap-5 sm:grid-cols-3">
        {([
          ["start_odometer_km", "시작 지점 누적 km"],
          ["pickup_odometer_km", "출발지 누적 km"],
          ["arrival_odometer_km", "도착지 누적 km"],
        ] as const).map(([field, label]) => (
          <div key={field}>
            <label htmlFor={`driving-${field}`} className="mb-2 block font-semibold">{label}</label>
            <input id={`driving-${field}`} inputMode="numeric" pattern="[0-9]{1,7}" maxLength={7} value={values[field]}
              onChange={(event) => onChange({ ...values, [field]: event.target.value.replace(/[^0-9]/g, "").slice(0, 7) })}
              placeholder="예: 664951" className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base" />
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">계기판 누적 km를 최대 7자리 정수로 입력해 주세요. 구간 거리는 서버에서 계산합니다.</p>
      {complete && !ordered && <p role="alert" className="text-sm text-red-700">시작 지점 ≤ 출발지 ≤ 도착지 순서로 입력해 주세요.</p>}
      {ordered && <div role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-base text-slate-700">
        {shown?.error ? <p className="text-red-700">{shown.error}</p> : shown?.distances ? <div className="flex flex-wrap gap-x-6 gap-y-2">
          <p>시작 → 출발지: <strong>{shown.distances.start_km.toLocaleString("ko-KR")}km</strong></p>
          <p>출발지 → 도착지: <strong>{shown.distances.km.toLocaleString("ko-KR")}km</strong></p>
          <p>총거리: <strong>{shown.distances.total_distance_km.toLocaleString("ko-KR")}km</strong></p>
        </div> : <p>거리 계산 중...</p>}
      </div>}
    </section>
  );
}
