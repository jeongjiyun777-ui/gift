"use client";

import { Fragment, useState } from "react";

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

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <p className="text-2xl font-bold tracking-tight sm:text-3xl">수리 입력</p>
      <p className="mt-2 text-sm text-slate-500">영수증을 보고 수리 내역을 입력해 주세요.</p>
      <form onSubmit={(event) => event.preventDefault()} className="mt-7 space-y-5">
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
            <select id="repair-months" value={form.installment_months} onChange={(event) => updateField("installment_months", event.target.value)} className={INPUT_CLASS}>
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
      </form>
    </section>
  );
}
