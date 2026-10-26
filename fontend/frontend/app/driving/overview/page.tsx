"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface DrivingOverview {
  year: number;
  month: number;
  driving_supply_amount: string;
  urea_total_amount: string;
  diesel_total_amount: string;
  repair_total_amount: string;
  expense_total_amount: string;
  balance_amount: string;
  urea_supply_amount: string;
  diesel_supply_amount: string;
  repair_supply_amount: string;
  urea_vat_amount: string;
  diesel_vat_amount: string;
  repair_vat_amount: string;
  expense_supply_amount: string;
  input_vat_amount: string;
  output_vat_amount: string;
  vat_balance_amount: string;
  driving_total_amount: string;
  income_tax_estimate: string;
  expense_tax_estimate: string;
}

function money(value: string) {
  const negative = value.startsWith("-");
  const [integer, fraction = ""] = value.replace(/^-/, "").split(".");
  const decimals = fraction.replace(/0+$/, "");
  return `${negative ? "-" : ""}${BigInt(integer).toLocaleString("ko-KR")}${decimals ? `.${decimals}` : ""}원`;
}

export default function DrivingOverviewPage() {
  const [period, setPeriod] = useState("");
  const [overview, setOverview] = useState<DrivingOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  function changePeriod(value: string) {
    requestRef.current?.abort();
    requestRef.current = null;
    setPeriod(value);
    setOverview(null);
    setLoading(false);
    setError("");
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    const [year, month] = period.split("-").map(Number);
    if (!/^\d{4}-\d{2}$/.test(period) || year < 1 || year > 9998 || month < 1 || month > 12) {
      setError("조회할 연도와 월을 선택해 주세요.");
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");
    setOverview(null);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      const response = await fetch(`${API_URL}/driving-overview?${params}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("조회 실패");
      const data: DrivingOverview = await response.json();
      if (!controller.signal.aborted) setOverview(data);
    } catch {
      if (!controller.signal.aborted) setError("조회하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">간편보기</h1>
      <p className="mt-2 text-sm text-slate-500">선택한 달의 수익금과 지출, 총액의 10%로 계산한 금액을 확인해 보세요.</p>
      <form onSubmit={handleSearch} className="mt-7 flex flex-wrap items-center justify-end gap-3" aria-busy={loading}>
        <label htmlFor="overview-period" className="font-semibold">날짜 선택</label>
        <input id="overview-period" type="month" required min="0001-01" max="9998-12" value={period} onChange={(event) => changePeriod(event.target.value)} className="max-w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        <button type="submit" disabled={!period || loading} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "조회 중..." : "그 달 조회하기"}</button>
      </form>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}
      {!overview && !error && <p role="status" className="mt-7 py-8 text-center text-slate-500">{loading ? "조회 중..." : "월을 선택한 뒤 그 달 조회하기를 눌러 주세요."}</p>}
      {overview && (
        <div aria-live="polite" className="mt-7 space-y-5">
          <p className="text-right text-base font-medium text-slate-600">{overview.year}년 {overview.month}월 · 전체 기록 합계</p>
          <section aria-label="수익금" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-right">
            <p className="text-lg font-bold text-slate-700">수익금</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-blue-700 sm:text-4xl">{money(overview.driving_total_amount)}</p>
            <p className="mt-3 text-sm text-slate-500">운행 합계금액 · 세금 포함</p>
          </section>
          <section aria-label="지출" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-right">
            <p className="text-lg font-bold text-slate-700">지출</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-red-700 sm:text-4xl">{money(overview.expense_total_amount)}</p>
            <div className="mt-5 space-y-3 border-t border-slate-200 pt-4">
              {([
                ["수리비", overview.repair_total_amount],
                ["요소수", overview.urea_total_amount],
                ["경유", overview.diesel_total_amount],
              ] as const).map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-3"><p className="text-base text-slate-600">{label}</p><p className="text-lg font-semibold tabular-nums">{money(value)}</p></div>)}
            </div>
            <p className="mt-3 text-sm text-slate-500">세금 포함 총액 · 수리비는 해당 월 수리 내역의 총액 기준</p>
          </section>
          <section aria-label="낼 세금" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-right">
            <p className="text-lg font-bold text-slate-700">낼 세금</p>
            <p className="mt-2 text-3xl font-bold tabular-nums sm:text-4xl">{money(overview.income_tax_estimate)}</p>
            <p className="mt-3 text-sm text-slate-500">사용자 지정 계산 · 운행 세금 포함 총액 × 10%</p>
          </section>
          <section aria-label="환급 세액" className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-right">
            <p className="text-lg font-bold text-slate-700">환급 세액</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-blue-700 sm:text-4xl">{money(overview.expense_tax_estimate)}</p>
            <p className="mt-3 text-sm text-slate-500">사용자 지정 계산 · 수리비·요소수·경유 총액 합계 × 10%</p>
          </section>
        </div>
      )}
    </section>
  );
}
