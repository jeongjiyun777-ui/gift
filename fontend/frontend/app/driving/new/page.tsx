"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const CONTAINER_SPEC = "40";
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400";

export default function NewDrivingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [shipper, setShipper] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [containerNo, setContainerNo] = useState<string>("");
  const [chargeAmount, setChargeAmount] = useState<string>("");
  const shipperName = shipper.trim();

  const containerHasError = containerNo.length > 0 && !/^[A-Z]{4}[0-9]{7}$/.test(containerNo);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    const amount = Number(chargeAmount);
    if (!shipperName || !origin.trim() || !destination.trim() || containerHasError || !chargeAmount.trim() || !Number.isSafeInteger(amount) || amount < 0) {
      setError("화주·출발지·도착지를 입력하고, 컨테이너 번호와 청구가액을 확인해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/driving-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipper_name: shipperName,
          region_1: origin.trim(),
          region_2: destination.trim(),
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
        <p className="mt-2 text-sm text-slate-500">화주·출발지·도착지를 직접 입력해 운행 내역을 등록해 주세요.</p>
        <form onSubmit={handleSubmit} className="mt-7">
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          <div>
            <label htmlFor="driving-shipper" className="mb-2 block font-semibold">화주</label>
            <input id="driving-shipper" required type="text" value={shipper} onChange={(event) => setShipper(event.target.value)} placeholder="화주명을 입력해 주세요" className={fieldClass} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="driving-origin" className="mb-2 block font-semibold">출발지</label>
              <input id="driving-origin" required type="text" value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="출발지를 입력해 주세요" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="driving-destination" className="mb-2 block font-semibold">도착지</label>
              <input id="driving-destination" required type="text" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="도착지를 입력해 주세요" className={fieldClass} />
            </div>
          </div>
          {destination && (
            <p role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {shipperName || "화주 입력 중"} · {origin} → {destination}
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
              <label htmlFor="driving-charge" className="mb-2 block font-semibold">청구가액 (원)</label>
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
