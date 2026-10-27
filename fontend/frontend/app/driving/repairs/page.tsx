"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { prepareReceiptImage } from "@/lib/ureaReceipt";
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
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const [receiptName, setReceiptName] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState("");
  const ocrRequestRef = useRef<AbortController | null>(null);
  useEffect(() => () => ocrRequestRef.current?.abort(), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<RepairForm>({
    repaired_on: "", merchant_name: "", card_company: "", installment_months: "", total_amount: "",
  });
  const [businessParts, setBusinessParts] = useState(["", "", ""]);
  const [cardChoice, setCardChoice] = useState("");

  async function handleReceiptPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || savingRef.current || ocrRequestRef.current) return;
    if ((Object.values(form).some((value) => value.trim()) || businessParts.some(Boolean)) &&
        !window.confirm("사진을 인식하면 현재 입력 내용을 바꿉니다. 계속하시겠습니까?")) return;
    const controller = new AbortController();
    ocrRequestRef.current = controller;
    setRecognizing(true);
    setReceiptError("");
    setReceiptMessage("");
    setError("");
    try {
      const payload = await prepareReceiptImage(file);
      if (controller.signal.aborted) return;
      const response = await fetch(`${REPAIR_API_URL}/repair-records/ocr`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      if (!response.ok) {
        const problem: { detail?: unknown } = await response.json().catch(() => ({}));
        throw new Error(typeof problem.detail === "string" ? problem.detail : "영수증을 인식하지 못했습니다. 다시 촬영해 주세요.");
      }
      const result: { fields: { repaired_on: string | null; merchant_name: string | null; business_number: string | null; card_company: string | null; installment_months: number | null; total_amount: string | null }; warnings: string[] } = await response.json();
      if (controller.signal.aborted) return;
      const fields = result.fields;
      const normalized = (fields.card_company ?? "").replace(/\s/g, "");
      const card = CARD_COMPANIES.find((name) => name === normalized || name.replace("카드", "") === normalized || name === `${normalized}카드`);
      setCardChoice(card ?? (fields.card_company ? "custom" : ""));
      setForm({
        repaired_on: fields.repaired_on ?? "", merchant_name: fields.merchant_name ?? "",
        card_company: card ?? fields.card_company ?? "",
        installment_months: fields.installment_months === null ? "" : String(fields.installment_months),
        total_amount: fields.total_amount ?? "",
      });
      const digits = (fields.business_number ?? "").replace(/[^0-9]/g, "");
      setBusinessParts([digits.slice(0, 3), digits.slice(3, 5), digits.slice(5, 10)]);
      setReceiptName(file.name);
      setReceiptMessage(result.warnings.join(" "));
    } catch (cause) {
      if (!controller.signal.aborted) setReceiptError(cause instanceof Error ? cause.message : "사진을 인식하지 못했습니다.");
    } finally {
      if (ocrRequestRef.current === controller && !controller.signal.aborted) {
        ocrRequestRef.current = null;
        setRecognizing(false);
      }
    }
  }

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
    if (savingRef.current || ocrRequestRef.current) return;
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
      <div className="flex items-start justify-between gap-4">
        <p className="text-2xl font-bold tracking-tight sm:text-3xl">수리 입력</p>
        <button type="button" disabled={saving || recognizing} onClick={() => receiptInputRef.current?.click()}
          aria-label="수리 영수증 촬영 또는 사진 선택" title="영수증 촬영 또는 사진 선택"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50">
          <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
            <circle cx="12" cy="13" r="4" /><path d="M18 10h.01" />
          </svg>
          <span className="hidden sm:inline">{recognizing ? "인식 중..." : "영수증 촬영"}</span>
        </button>
        <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptPhoto} disabled={saving || recognizing} className="hidden" />
      </div>
      <p className="mt-2 text-sm text-slate-500">영수증을 보고 수리 내역을 입력해 주세요.</p>
      {recognizing && <p role="status" className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">수리 영수증을 읽고 있습니다. 잠시 기다려 주세요.</p>}
      {receiptName && <p role="status" className="mt-3 break-all rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">선택한 사진: {receiptName} · {receiptMessage}</p>}
      {receiptError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{receiptError}</p>}
      <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={saving || recognizing}>
        <fieldset disabled={saving || recognizing} className="space-y-5 disabled:opacity-60">
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
            <button type="submit" disabled={saving || recognizing || !complete} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      </form>
    </section>
  );
}
