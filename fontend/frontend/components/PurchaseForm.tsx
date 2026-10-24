"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";

import { prepareReceiptImage, type UreaReceiptResult } from "@/lib/ureaReceipt";

import { purchaseEndpoint, type PurchaseKind } from "@/lib/ureaRecords";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const CARD_COMPANIES = ["신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드", "하나카드", "우리카드", "NH농협카드", "BC카드"];
const INPUT_CLASS = "w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60";

interface UreaForm {
  purchased_on: string;
  merchant_name: string;
  business_number: string;
  card_company: string;
  unit_price: string;
  liters: string;
}

interface UreaRecord extends UreaForm {
  total_amount: string;
  id: number;
  created_at: string;
}

const EMPTY_FORM: Omit<UreaForm, "business_number"> = {
  purchased_on: "", merchant_name: "", card_company: "",
  unit_price: "", liters: "",
};

export default function PurchaseForm({ kind }: { kind: PurchaseKind }) {
  const router = useRouter();
  const listHref = kind === "diesel" ? "/driving/diesel/records" : "/driving/urea/records";
  const label = kind === "diesel" ? "경유" : "요소수";
  const endpoint = purchaseEndpoint(kind);
  const [form, setForm] = useState<Omit<UreaForm, "business_number">>({ ...EMPTY_FORM });
  const [businessParts, setBusinessParts] = useState<string[]>(["", "", ""]);
  const [cardChoice, setCardChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedRecord, setSavedRecord] = useState<UreaRecord | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [ocrMessage, setOcrMessage] = useState("");
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const ocrRequestRef = useRef<AbortController | null>(null);
  const savingRef = useRef(false);

  useEffect(() => () => ocrRequestRef.current?.abort(), []);

  async function handleReceiptPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || savingRef.current || ocrRequestRef.current) return;
    if ((Object.values(form).some((value) => value.trim()) || businessParts.some(Boolean)) &&
        !window.confirm("사진을 인식하면 현재 입력 내용을 영수증 내용으로 바꿉니다. 계속하시겠습니까?")) return;
    const controller = new AbortController();
    ocrRequestRef.current = controller;
    setRecognizing(true);
    setError("");
    setOcrMessage("");
    setSavedRecord(null);
    try {
      const payload = await prepareReceiptImage(file);
      if (controller.signal.aborted) return;
      const response = await fetch(`${API_URL}${endpoint}/ocr`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      if (!response.ok) {
        const problem: { detail?: unknown } = await response.json().catch(() => ({}));
        throw new Error(typeof problem.detail === "string" ? problem.detail : "사진을 인식하지 못했습니다. 다시 촬영해 주세요.");
      }
      const result: UreaReceiptResult = await response.json();
      if (controller.signal.aborted) return;
      const fields = result.fields;
      setForm({
        purchased_on: fields.purchased_on ?? "", merchant_name: fields.merchant_name ?? "",
        card_company: fields.card_company ?? "", unit_price: fields.unit_price ?? "", liters: fields.liters ?? "",
      });
      const digits = (fields.business_number ?? "").replace(/[^0-9]/g, "");
      setBusinessParts([digits.slice(0,3), digits.slice(3,5), digits.slice(5,10)]);
      const normalized = (fields.card_company ?? "").replace(/\s/g, "");
      const matchedCard = CARD_COMPANIES.find((card) => card === normalized ||
        card.replace("카드", "") === normalized || card === `${normalized}카드`);
      if (matchedCard) {
        setCardChoice(matchedCard);
        setForm((previous) => ({ ...previous, card_company: matchedCard }));
      } else {
        setCardChoice(fields.card_company ? "custom" : "");
      }
      setOcrMessage(result.warnings.join(" "));
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "사진을 인식하지 못했습니다.");
    } finally {
      if (ocrRequestRef.current === controller && !controller.signal.aborted) {
        ocrRequestRef.current = null;
        setRecognizing(false);
      }
    }
  }

  function updateField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setSavedRecord(null);
  }

  function updateBusinessPart(index: number, value: string, length: number) {
    const digits = value.replace(/[^0-9]/g, "").slice(0, length);
    setBusinessParts((parts) => parts.map((part, partIndex) => partIndex === index ? digits : part));
    setSavedRecord(null);
  }

  const validBusinessNumber = /^[0-9]{3}$/.test(businessParts[0]) &&
    /^[0-9]{2}$/.test(businessParts[1]) && /^[0-9]{5}$/.test(businessParts[2]);
  const complete = validBusinessNumber && Object.values(form).every((value) => value.trim() !== "" && value.trim() !== "-");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || ocrRequestRef.current) return;
    setError("");
    setSavedRecord(null);
    if (!complete || !event.currentTarget.reportValidity()) {
      setError("모든 항목을 입력하고 카드사를 선택해 주세요.");
      return;
    }
    const payload: UreaForm = {
      purchased_on: form.purchased_on.trim(),
      merchant_name: form.merchant_name.trim(),
      business_number: businessParts.join("-"),
      card_company: form.card_company.trim(),
      unit_price: form.unit_price.trim(),
      liters: form.liters.trim(),
    };
    if (!/^\d{3}-\d{2}-\d{5}$/.test(payload.business_number)) {
      setError("사업자번호는 숫자 10자리 또는 000-00-00000 형식으로 입력해 주세요.");
      return;
    }
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(payload.unit_price) ||
        !/^\d{1,9}(?:\.\d{1,3})?$/.test(payload.liters) || Number(payload.liters) <= 0) {
      setError("단가는 소수 둘째 자리, 수량은 소수 셋째 자리까지 입력해 주세요. 수량은 0보다 커야 합니다.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    let saved = false;
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        if (response.status === 422) {
          setError("입력 형식과 단가 × 수량의 금액 범위를 확인해 주세요.");
          return;
        }
        throw new Error("저장 실패");
      }
      const record: UreaRecord = await response.json();
      setSavedRecord(record);
      setForm({ ...EMPTY_FORM });
      setCardChoice("");
      setBusinessParts(["", "", ""]);
      router.push(listHref);
      saved = true;
    } catch {
      setError("저장 결과를 확인하지 못했습니다. 중복 입력하지 않도록 기존 기록을 확인한 뒤 다시 시도해 주세요.");
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
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{label} 입력</h1>
        <button type="button" disabled={saving || recognizing} onClick={() => receiptInputRef.current?.click()}
          aria-label="카메라로 영수증 인식" title="영수증 촬영 또는 사진 선택"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50">
          <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
            <circle cx="12" cy="13" r="4" /><path d="M18 10h.01" />
          </svg>
          <span className="hidden sm:inline">{recognizing ? "인식 중..." : "영수증 촬영"}</span>
        </button>
        <input ref={receiptInputRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptPhoto} disabled={saving || recognizing} className="hidden" />
      </div>
      <p className="mt-2 text-sm text-slate-500">영수증을 보고 모든 항목을 입력해 주세요.</p>
      {recognizing && <p role="status" className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">영수증을 읽고 있습니다. 잠시 기다려 주세요.</p>}
      {ocrMessage && <p role="status" className="mt-3 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">{ocrMessage}</p>}
      <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={saving || recognizing}>
        <fieldset disabled={saving || recognizing} className="space-y-5">
          <legend className="sr-only">{label} 구매 정보</legend>
          <div>
            <label htmlFor="urea-date" className="mb-2 block font-semibold">날짜</label>
            <input id="urea-date" type="date" required value={form.purchased_on} onChange={(event) => updateField("purchased_on", event.target.value)} className={`${INPUT_CLASS} max-w-[220px]`} />
          </div>
          <div>
            <label htmlFor="urea-merchant" className="mb-2 block font-semibold">상호명/대표자</label>
            <input id="urea-merchant" required value={form.merchant_name} onChange={(event) => updateField("merchant_name", event.target.value)} placeholder="상호명 또는 대표자 입력" className={INPUT_CLASS} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset className="min-w-0">
              <legend className="mb-2 font-semibold">사업자번호</legend>
              <div className="grid grid-cols-[minmax(0,3fr)_auto_minmax(0,2fr)_auto_minmax(0,5fr)] items-center gap-2">
                {[3, 2, 5].map((length, index) => (
                  <Fragment key={index}>
                    {index > 0 && <span aria-hidden="true" className="text-slate-500">-</span>}
                    <input
                      aria-label={`사업자번호 ${index + 1}번째 ${length}자리`}
                      type="text" inputMode="numeric" required
                      pattern={`[0-9]{${length}}`} minLength={length} maxLength={length}
                      value={businessParts[index]}
                      onChange={(event) => updateBusinessPart(index, event.target.value, length)}
                      placeholder={"0".repeat(length)}
                      className="min-w-0 w-full rounded-lg border border-slate-300 px-2 py-3 text-center text-base tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    />
                  </Fragment>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="urea-card" className="mb-2 block font-semibold">카드사</label>
              <select id="urea-card" required value={cardChoice} onChange={(event) => {
                const value = event.target.value;
                setCardChoice(value);
                updateField("card_company", value === "custom" ? "" : value);
              }} className={INPUT_CLASS}>
                <option value="" disabled>카드사를 선택해 주세요</option>
                {CARD_COMPANIES.map((card) => <option key={card} value={card}>{card}</option>)}
                <option value="custom">직접 입력</option>
              </select>
              {cardChoice === "custom" && (
                <input aria-label="카드사 직접 입력" required value={form.card_company} onChange={(event) => updateField("card_company", event.target.value)} placeholder="카드사 입력" className={`${INPUT_CLASS} mt-2`} />
              )}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="urea-unit" className="mb-2 block font-semibold">단가 (원/리터)</label>
              <input id="urea-unit" type="number" inputMode="decimal" required min="0" max="9999999999.99" step="0.01" value={form.unit_price} onChange={(event) => updateField("unit_price", event.target.value)} placeholder="예: 1500" className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="urea-liters" className="mb-2 block font-semibold">수량 (L)</label>
              <input id="urea-liters" type="number" inputMode="decimal" required min="0.001" max="999999999.999" step="0.001" value={form.liters} onChange={(event) => updateField("liters", event.target.value)} placeholder="예: 10" className={INPUT_CLASS} />
            </div>
          </div>
          <p className="text-sm text-slate-500">총액은 단가 × 수량로 자동 계산하여 저장합니다.</p>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving || recognizing || !complete} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {savedRecord && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{savedRecord.merchant_name}의 {label} 구매 기록을 저장했습니다. 총액 {Number(savedRecord.total_amount).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원 (번호 {savedRecord.id})</p>}
      </form>
    </section>
  );
}
