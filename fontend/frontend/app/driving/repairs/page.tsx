"use client";

import { Fragment, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { REPAIR_API_URL } from "@/lib/repairRecords";

const INPUT_CLASS = "w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const CARD_COMPANIES = ["신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드", "하나카드", "우리카드", "NH농협카드", "BC카드"];

interface RepairForm {
  repaired_on: string;
  merchant_name: string;
  card_company: string;
  installment_months: string;
  total_amount: string;
}

export default function RepairsPage() {
  const router = useRouter();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<RepairForm>({
    repaired_on: "", merchant_name: "", card_company: "", installment_months: "", total_amount: "",
  });
  const [businessParts, setBusinessParts] = useState(["", "", ""]);
  const [cardChoice, setCardChoice] = useState("");

  function updateField(field: keyof RepairForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateBusinessPart(index: number, value: string, length: number) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, length);
    setBusinessParts((parts) => parts.map((part, partIndex) => partIndex === index ? digits : part));
  }

  const complete = Object.values(form).every((value) => value.trim() !== "" && value.trim() !== "-") &&
    /^\d{3}$/.test(businessParts[0]) && /^\d{2}$/.test(businessParts[1]) && /^\d{5}$/.test(businessParts[2]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    setError("");
    if (!complete || !event.currentTarget.reportValidity()) {
      setError("모든 항목을 입력해 주세요.");
      return;
    }
    const months = Number(form.installment_months);
    if (!Number.isInteger(months) || months < 0 || months > 12 ||
        !/^\d{1,12}(?:\.\d{1,2})?$/.test(form.total_amount.trim())) {
      setError("할부 개월과 총액의 입력 범위를 확인해 주세요.");
      return;
    }
    const payload = {
      repaired_at: form.repaired_on,
      merchant_name: form.merchant_name.trim(),
      business_number: businessParts.join("-"),
      card_company: form.card_company.trim(),
      installment_months: months,
      total_amount: form.total_amount.trim(),
    };
    savingRef.current = true;
    setSaving(true);
    let saved = false;
    try {
      const response = await fetch(`${REPAIR_API_URL}/repair-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(response.status === 422 ? "입력 형식과 금액 범위를 확인해 주세요." : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      await response.json();
      router.push("/driving/repairs/records");
      saved = true;
    } catch {
      setError("저장 결과를 확인하지 못했습니다. 중복 입력하지 않도록 수리 조회에서 확인해 주세요.");
    } finally {
      if (!saved) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <p className="text-2xl font-bold tracking-tight sm:text-3xl">수리 입력</p>
      <p className="mt-2 text-sm text-slate-500">영수증을 보고 수리 내역을 입력해 주세요.</p>
      <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={saving}>
        <fieldset disabled={saving} className="space-y-5 disabled:opacity-60">
          <legend className="sr-only">수리 입력 정보</legend>
        <div>
          <label htmlFor="repair-date" className="mb-2 block font-semibold">날짜</label>
          <input id="repair-date" type="date" required value={form.repaired_on} onChange={(event) => updateField("repaired_on", event.target.value)} className={`${INPUT_CLASS} max-w-[220px]`} />
        </div>
        <div>
          <label htmlFor="repair-merchant" className="mb-2 block font-semibold">상호명/대표자</label>
          <input id="repair-merchant" required value={form.merchant_name} onChange={(event) => updateField("merchant_name", event.target.value)} placeholder="상호명 또는 대표자 입력" className={INPUT_CLASS} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset className="min-w-0">
            <legend className="mb-2 font-semibold">사업자번호</legend>
            <div className="grid grid-cols-[minmax(0,3fr)_auto_minmax(0,2fr)_auto_minmax(0,5fr)] items-center gap-2">
              {[3, 2, 5].map((length, index) => (
                <Fragment key={index}>
                  {index > 0 && <span aria-hidden="true" className="text-slate-500">-</span>}
                  <input aria-label={`사업자번호 ${index + 1}번째 ${length}자리`} type="text" inputMode="numeric" required pattern={`[0-9]{${length}}`} minLength={length} maxLength={length} value={businessParts[index]} onChange={(event) => updateBusinessPart(index, event.target.value, length)} placeholder={"0".repeat(length)} className="min-w-0 w-full rounded-lg border border-slate-300 px-2 py-3 text-center text-base tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </Fragment>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="repair-card" className="mb-2 block font-semibold">카드사</label>
            <select id="repair-card" required value={cardChoice} onChange={(event) => {
              const value = event.target.value;
              setCardChoice(value);
              updateField("card_company", value === "custom" ? "" : value);
            }} className={INPUT_CLASS}>
              <option value="" disabled>카드사를 선택해 주세요</option>
              {CARD_COMPANIES.map((card) => <option key={card} value={card}>{card}</option>)}
              <option value="custom">직접 입력</option>
            </select>
            {cardChoice === "custom" && <input aria-label="카드사 직접 입력" required value={form.card_company} onChange={(event) => updateField("card_company", event.target.value)} placeholder="카드사 입력" className={`${INPUT_CLASS} mt-2`} />}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="repair-months" className="mb-2 block font-semibold">할부 개월</label>
            <select required id="repair-months" value={form.installment_months} onChange={(event) => updateField("installment_months", event.target.value)} className={INPUT_CLASS}>
              <option value="">개월 수를 선택해 주세요</option>
              <option value="0">일시불</option>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={String(month)}>{month}개월</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="repair-total" className="mb-2 block font-semibold">총액 (원)</label>
            <input id="repair-total" type="number" inputMode="decimal" required min="0" max="999999999999.99" step="0.01" value={form.total_amount} onChange={(event) => updateField("total_amount", event.target.value)} placeholder="총액 입력" className={INPUT_CLASS} />
          </div>
        </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving || !complete} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}
