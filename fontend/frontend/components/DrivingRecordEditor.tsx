"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { DRIVING_API_URL, isValidKm, type DrivingRecord } from "../lib/drivingRecords";

type EditableField = Exclude<keyof DrivingRecord, "id" | "created_at" | "calculated_tax_amount" | "total_amount">;
const fields: { key: EditableField; label: string; type?: string }[] = [
  { key: "operated_on", label: "일자", type: "date" },
  { key: "category", label: "구분" },
  { key: "shipper_name", label: "화주" },
  { key: "region_1", label: "지역 (출발지)" },
  { key: "region_2", label: "지역 (도착지)" },
  { key: "km", label: "거리 (km)" },
  { key: "shipping_line", label: "라인" },
  { key: "container_spec", label: "규격" },
  { key: "container_no", label: "CNTR" },
  { key: "charge_amount", label: "공급가액 (원)", type: "number" },
  { key: "tax_amount", label: "세액 (원)", type: "number" },
  { key: "memo", label: "비고" },
  { key: "vehicle_number", label: "차량번호" },
  { key: "recipient_name", label: "수신인" },
];

function formValues(record: DrivingRecord) {
  return Object.fromEntries(fields.map(({ key }) => [key, String(record[key] ?? "")])) as Record<EditableField, string>;
}

export default function DrivingRecordEditor({ record, onClose, onSaved }: {
  record: DrivingRecord; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [values, setValues] = useState(() => formValues(record));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const original = formValues(record);
    const changes: Record<string, string | number | null> = {};
    for (const { key, type } of fields) {
      const value = values[key].trim();
      if (value === original[key].trim()) continue;
      if (key === "km") {
        if (!isValidKm(value)) { setError("운행거리는 1~9999km의 정수로 입력해 주세요."); return; }
        changes[key] = Number(value);
      } else if (type === "number" && value !== "") {
        const amount = Number(value);
        if (!Number.isSafeInteger(amount) || amount < 0) {
          setError("금액은 0 이상의 정수로 입력해 주세요.");
          return;
        }
        changes[key] = amount;
      } else {
        changes[key] = value || null;
      }
    }
    if (!Object.keys(changes).length) { setError("변경한 항목이 없습니다."); return; }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${DRIVING_API_URL}/driving-records/${record.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error("수정 실패");
    } catch {
      setError("수정을 확인하지 못했습니다. 조회 화면에서 확인한 뒤 다시 시도해 주세요.");
      setSaving(false);
      return;
    }
    await onSaved();
  };

  return (
    <form onSubmit={handleSave} aria-labelledby="driving-edit-title" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h2 id="driving-edit-title" className="text-lg font-bold">운행기록 수정 · 번호 {record.id}</h2>
      <p className="mt-1 text-sm text-slate-600">변경한 항목만 저장합니다. 번호와 등록 시각은 유지됩니다.</p>
      <fieldset disabled={saving} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 disabled:opacity-60">
        {fields.map(({ key, label, type }) => (
          <div key={key}>
            <label htmlFor={`edit-${key}`} className="mb-1 block text-sm font-semibold">{label}</label>
            <input id={`edit-${key}`} type={type ?? "text"} value={values[key]}
              required={["operated_on", "shipper_name", "charge_amount", "container_spec"].includes(key)}
              min={type === "number" ? "0" : undefined} step={type === "number" ? "1" : undefined}
              inputMode={key === "km" ? "numeric" : undefined} maxLength={key === "km" ? 4 : undefined}
              readOnly={key === "container_spec"} pattern={key === "km" ? "[1-9][0-9]{0,3}" : key === "container_no" ? "[A-Z]{4}[0-9]{7}" : undefined}
              onChange={(event) => setValues((previous) => ({ ...previous, [key]: key === "container_no" ? event.target.value.replace(/\s/g, "").toUpperCase() : event.target.value }))}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 read-only:bg-slate-100" />
          </div>
        ))}
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-5 py-2 disabled:opacity-50">취소</button>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? "저장 중..." : "수정 저장"}</button>
      </div>
    </form>
  );
}
