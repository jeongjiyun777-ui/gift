"use client";

import { Fragment, useRef, useState } from "react";
import type { FormEvent } from "react";
import { REPAIR_API_URL, type RepairRecord, repairDate } from "@/lib/repairRecords";

const inputClass = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base";
const fields = [
  { key: "repaired_at", label: "날짜", type: "date" },
  { key: "merchant_name", label: "상호명/대표자", type: "text" },
  { key: "card_company", label: "카드사", type: "text" },
  { key: "installment_months", label: "할부 개월 (일시불 0)", type: "number" },
  { key: "total_amount", label: "총액 (원)", type: "number" },
] as const;

export default function RepairRecordEditor({ record, onClose, onSaved }: {
  record: RepairRecord; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const label = "수리";
  const [values, setValues] = useState(() => ({
    repaired_at: repairDate(record.repaired_at), merchant_name: record.merchant_name,
    card_company: record.card_company ?? "", installment_months: record.installment_months === null ? "" : String(record.installment_months), total_amount: record.total_amount,
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
    const changes: Record<string, string | number | null> = {};
    for (const { key } of fields) {
      const value = values[key].trim();
      const original = key === "repaired_at" ? repairDate(record.repaired_at) : String(record[key] ?? "").trim();
      if (value === original) continue;
      if ((key === "repaired_at" || key === "merchant_name" || key === "total_amount") && !value) {
        setError("날짜, 상호명, 총액은 비울 수 없습니다."); return;
      }
      if (key === "installment_months") {
        if (value && (!/^\d+$/.test(value) || Number(value) > 2147483647)) {
          setError("할부 개월은 0 이상의 정수로 입력해 주세요."); return;
        }
        changes[key] = value ? Number(value) : null;
      } else {
        changes[key] = value || null;
      }
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
      const response = await fetch(`${REPAIR_API_URL}/repair-records/${record.id}`, {
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
    <form onSubmit={handleSave} aria-labelledby="repair-edit-title" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h2 id="repair-edit-title" className="text-lg font-bold">{label} 수정</h2>
      <fieldset disabled={saving} className="mt-4 grid gap-4 sm:grid-cols-2 disabled:opacity-60">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label htmlFor={`repair-edit-${key}`} className="mb-1 block text-sm font-semibold">{label}</label>
            <input id={`repair-edit-${key}`} type={type} value={values[key]}
              required={key !== "card_company" && key !== "installment_months"} min={type === "number" ? "0" : undefined}
              step={key === "installment_months" ? "1" : type === "number" ? "0.01" : undefined}
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
