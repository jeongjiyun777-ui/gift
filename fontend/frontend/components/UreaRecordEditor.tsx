"use client";

import { Fragment, useRef, useState } from "react";
import type { FormEvent } from "react";
import { UREA_API_URL, type UreaRecord, purchaseEndpoint, type PurchaseKind } from "@/lib/ureaRecords";

const inputClass = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base";
const fields = [
  { key: "purchased_on", label: "날짜", type: "date" },
  { key: "merchant_name", label: "상호명/대표자", type: "text" },
  { key: "card_company", label: "카드사", type: "text" },
  { key: "unit_price", label: "단가 (원)", type: "number" },
  { key: "liters", label: "수량 (L)", type: "number" },
] as const;

export default function UreaRecordEditor({ record, kind = "urea", onClose, onSaved }: {
  kind?: PurchaseKind; record: UreaRecord; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const label = kind === "diesel" ? "경유" : "요소수";
  const [values, setValues] = useState(() => ({
    purchased_on: record.purchased_on, merchant_name: record.merchant_name,
    card_company: record.card_company ?? "", unit_price: record.unit_price, liters: record.liters,
  }));
  const [businessParts, setBusinessParts] = useState(() => {
    const digits = (record.business_number ?? "").replace(/[^0-9]/g, "");
    return [digits.slice(0,3), digits.slice(3,5), digits.slice(5,10)];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lockRef = useRef(false);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lockRef.current) return;
    setError("");
    const changes: Record<string, string | null> = {};
    for (const { key } of fields) {
      const value = values[key].trim();
      if (value === String(record[key] ?? "").trim()) continue;
      if (key === "unit_price" || key === "liters") {
        const valid = key === "liters" ? /^\d{1,9}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0
          : /^\d{1,10}(?:\.\d{1,2})?$/.test(value);
        if (!valid) { setError("단가는 0 이상, 수량은 0보다 큰 값으로 입력해 주세요."); return; }
      }
      if ((key === "purchased_on" || key === "merchant_name") && !value) {
        setError("날짜와 상호명은 비울 수 없습니다."); return;
      }
      changes[key] = value || null;
    }
    const business = businessParts.every((part) => !part) ? null : businessParts.join("-");
    if (business !== (record.business_number || null)) {
      if (business && !/^\d{3}-\d{2}-\d{5}$/.test(business)) {
        setError("사업자번호는 3자리·2자리·5자리로 입력해 주세요."); return;
      }
      changes.business_number = business;
    }
    if (!Object.keys(changes).length) { setError("변경한 항목이 없습니다."); return; }
    lockRef.current = true;
    setSaving(true);
    try {
      const response = await fetch(`${UREA_API_URL}${purchaseEndpoint(kind)}/${record.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
      });
      if (!response.ok) {
        setError(response.status === 404 ? "기록이 없습니다. 다시 조회해 주세요." : "입력 형식과 금액 범위를 확인해 주세요.");
        return;
      }
      await onSaved();
    } catch {
      setError("수정 결과를 확인하지 못했습니다. 조회 후 다시 확인해 주세요.");
    } finally {
      lockRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} aria-labelledby="urea-edit-title" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h2 id="urea-edit-title" className="text-lg font-bold">{label} 수정</h2>
      <p className="mt-1 text-sm text-slate-600">단가·수량를 변경하면 총액과 공급가액·부가세도 다시 계산됩니다.</p>
      <fieldset disabled={saving} className="mt-4 grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label htmlFor={`urea-edit-${key}`} className="mb-1 block text-sm font-semibold">{label}</label>
            <input id={`urea-edit-${key}`} type={type} value={values[key]}
              required={key !== "card_company"} min={key === "liters" ? "0.001" : type === "number" ? "0" : undefined}
              step={key === "liters" ? "0.001" : type === "number" ? "0.01" : undefined}
              onChange={(event) => setValues((previous) => ({ ...previous, [key]: event.target.value }))} className={inputClass} />
          </div>
        ))}
        <fieldset className="min-w-0">
          <legend className="mb-1 text-sm font-semibold">사업자번호</legend>
          <div className="grid grid-cols-[minmax(0,3fr)_auto_minmax(0,2fr)_auto_minmax(0,5fr)] items-center gap-2">
            {[3,2,5].map((length,index) => (
              <Fragment key={index}>
                {index > 0 && <span aria-hidden="true">-</span>}
                <input aria-label={`수정 사업자번호 ${index+1}번째 ${length}자리`} inputMode="numeric" maxLength={length} value={businessParts[index]}
                  onChange={(event) => { const value=event.target.value.replace(/[^0-9]/g, "").slice(0,length); setBusinessParts((parts) => parts.map((part,i) => i===index ? value : part)); }}
                  className="min-w-0 w-full rounded-lg border border-slate-300 bg-white px-2 py-3 text-center text-base" />
              </Fragment>
            ))}
          </div>
        </fieldset>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-5 py-2 disabled:opacity-50">취소</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "수정 저장"}</button>
      </div>
    </form>
  );
}
