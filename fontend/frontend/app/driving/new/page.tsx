"use client";

import DrivingTimeSelect from "@/components/DrivingTimeSelect";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isValidKm } from "../../../lib/drivingRecords";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const CONTAINER_SPEC = "40";
const carriers = ["삼성로지텍", "윤하운송"] as const;
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400";

export default function NewDrivingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [carrier, setCarrier] = useState<string>("");
  const [customCarrier, setCustomCarrier] = useState("");
  const [confirmedCarrier, setConfirmedCarrier] = useState("");
  const customCarrierRef = useRef<HTMLInputElement | null>(null);
  const carrierSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (carrier === "custom") customCarrierRef.current?.focus();
  }, [carrier]);
  const [shipperName, setShipperName] = useState("");
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [containerNo, setContainerNo] = useState<string>("");
  const [chargeAmount, setChargeAmount] = useState<string>("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [startKm, setStartKm] = useState("");
  const [km, setKm] = useState("");
  const carrierName = (carrier === "custom" ? "" : carrier === "custom-confirmed" ? confirmedCarrier : carrier).trim();

  const containerHasError = containerNo.length > 0 && !/^[A-Z]{4}[0-9]{7}$/.test(containerNo);

  const handleCarrierChange = (value: string) => {
    setCarrier(value);
    setCustomCarrier(value === "custom" ? confirmedCarrier : "");
    setOrigin("");
    setDestination("");
    setError("");
  };

  function confirmCustomCarrier() {
    const name = customCarrier.trim();
    if (!name || name === "-") {
      setError("운송사를 입력한 뒤 확인을 눌러 주세요.");
      customCarrierRef.current?.focus();
      return;
    }
    setConfirmedCarrier(name);
    setCarrier("custom-confirmed");
    setError("");
    carrierSelectRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (carrier === "custom") {
      setError("직접 입력한 운송사의 확인 버튼을 눌러 주세요.");
      customCarrierRef.current?.focus();
      return;
    }
    setError("");
    if (!isValidKm(startKm) || !isValidKm(km)) {
      setError("각 구간의 운행거리는 1~999km의 정수로 입력해 주세요.");
      return;
    }
    for (const value of [departureTime, arrivalTime]) {
      if (value.replace(":", "") && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
        setError("출발시각과 도착시각의 시·분을 모두 선택해 주세요.");
        return;
      }
    }
    const amount = Number(chargeAmount);
    if (!carrierName || !origin.trim() || !destination.trim() || containerHasError || !chargeAmount.trim() || !Number.isSafeInteger(amount) || amount < 0) {
      setError("운송사를 선택하고 출발지·도착지, 컨테이너 번호와 공급가액을 확인해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/driving-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier_name: carrierName,
          shipper_name: shipperName.trim() || null,
          region_1: origin.trim(),
          region_2: destination.trim(),
          departure_time: departureTime.replace(":", "") ? departureTime : null,
          arrival_time: arrivalTime.replace(":", "") ? arrivalTime : null,
          start_km: Number(startKm),
          km: Number(km),
          container_spec: CONTAINER_SPEC,
          container_no: containerNo || null,
          charge_amount: amount,
        }),
      });
      if (!response.ok) throw new Error("운행기록 저장 실패");
      await response.json();
      router.push("/driving");
    } catch {
      setError("저장을 확인하지 못했습니다. 조회 화면에서 내역을 확인한 뒤 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">운행기록 입력</h1>
        <p className="mt-2 text-sm text-slate-500">운송사를 선택한 뒤 출발지와 도착지를 직접 입력해 주세요.</p>
        <form onSubmit={handleSubmit} className="mt-7">
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          <div>
            <label htmlFor="driving-carrier" className="mb-2 block font-semibold">운송사</label>
            <select ref={carrierSelectRef} id="driving-carrier" required value={carrier} onChange={(event) => handleCarrierChange(event.target.value)} className={fieldClass}>
              <option value="">운송사 선택</option>
              {carriers.map((value) => <option key={value} value={value}>{value}</option>)}
              {confirmedCarrier && <option value="custom-confirmed">{confirmedCarrier}</option>}
              <option value="custom">직접 입력</option>
            </select>
            {carrier === "custom" && (
              <div className="mt-2 flex items-start gap-2">
                <input ref={customCarrierRef} aria-label="운송사 직접 입력" required value={customCarrier} onChange={(event) => setCustomCarrier(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      confirmCustomCarrier();
                    }
                  }}
                  placeholder="운송사를 직접 입력해 주세요" className={fieldClass} />
                <button type="button" onClick={confirmCustomCarrier} disabled={!customCarrier.trim() || customCarrier.trim() === "-"}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">확인</button>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="driving-shipper" className="mb-2 block font-semibold">화주</label>
            <input id="driving-shipper" value={shipperName} onChange={(event) => setShipperName(event.target.value)} placeholder="화주 입력 (선택)" className={fieldClass} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="driving-origin" className="mb-2 block font-semibold">출발지</label>
              <input id="driving-origin" required disabled={!carrierName} type="text" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder={carrierName ? "출발지를 입력해 주세요" : "운송사를 먼저 선택해 주세요"} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="driving-destination" className="mb-2 block font-semibold">도착지</label>
              <input id="driving-destination" required disabled={!carrierName} type="text" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={carrierName ? "도착지를 입력해 주세요" : "운송사를 먼저 선택해 주세요"} className={fieldClass} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <DrivingTimeSelect id="driving-departure" label="출발시각" value={departureTime} onChange={setDepartureTime} />
            <DrivingTimeSelect id="driving-arrival" label="도착시각" value={arrivalTime} onChange={setArrivalTime} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="driving-start-km" className="mb-2 block font-semibold">시작 지점 → 출발지 (km)</label>
              <input id="driving-start-km" type="text" inputMode="numeric" required pattern="[1-9][0-9]{0,2}" maxLength={3} value={startKm} onChange={(event) => setStartKm(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="예: 25" className={fieldClass} />
              <p className="mt-2 text-sm text-slate-500">시작 지점에서 출발지까지 · 1~999km</p>
            </div>
            <div>
              <label htmlFor="driving-km" className="mb-2 block font-semibold">출발지 → 도착지 (km)</label>
              <input id="driving-km" type="text" inputMode="numeric" required pattern="[1-9][0-9]{0,2}" maxLength={3} value={km} onChange={(event) => setKm(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))} placeholder="예: 125" className={fieldClass} />
              <p className="mt-2 text-sm text-slate-500">출발지에서 도착지까지 · 1~999km</p>
            </div>
          </div>
          {destination && (
            <p role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {carrierName || "운송사 입력 중"} · {origin} → {destination}
            </p>
          )}
          <div>
            <label htmlFor="driving-container" className="mb-2 block font-semibold">CNTR (컨테이너 번호)</label>
            <input
              id="driving-container"
              type="text"
              value={containerNo}
              onChange={(event) => setContainerNo(event.target.value.replace(/\s/g, "").toUpperCase())}
              placeholder="예: ABCD1234567"
              maxLength={11}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="driving-container-hint"
              aria-invalid={containerHasError}
              className={`${fieldClass} font-mono`}
            />
            <p id="driving-container-hint" className={`mt-2 text-sm ${containerHasError ? "text-red-600" : "text-slate-500"}`}>
              영문 4자리와 숫자 7자리로 입력해 주세요. 컨테이너 번호는 직접 확인해 입력합니다.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="driving-spec" className="mb-2 block font-semibold">규격</label>
              <input id="driving-spec" type="text" value={CONTAINER_SPEC} readOnly className={`${fieldClass} bg-slate-100 text-slate-500`} />
            </div>
            <div>
              <label htmlFor="driving-charge" className="mb-2 block font-semibold">공급가액 (원)</label>
              <input
                id="driving-charge"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={chargeAmount}
                onChange={(event) => setChargeAmount(event.target.value)}
                placeholder="예: 357300"
                className={fieldClass}
              />
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Link href="/driving" className="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50">조회로 돌아가기</Link>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving ? "저장 중..." : "저장하기"}</button>
          </div>
        </fieldset>
        </form>
      </section>
  );
}
