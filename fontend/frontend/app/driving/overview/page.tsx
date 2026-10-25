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
      <p className="mt-2 text-sm text-slate-500">운행 공급가액에서 요소수·경유·수리 공급가액을 뺀 금액을 확인해 보세요.</p>
      <form onSubmit={handleSearch} className="mt-7 flex flex-wrap items-center justify-end gap-3" aria-busy={loading}>
        <label htmlFor="overview-period" className="font-semibold">날짜 선택</label>
        <input id="overview-period" type="month" required min="0001-01" max="9998-12" value={period} onChange={(event) => changePeriod(event.target.value)} className="max-w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        <button type="submit" disabled={!period || loading} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "조회 중..." : "그 달 조회하기"}</button>
      </form>
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-red-700">{error}</p>}
      {!overview && !error && <p role="status" className="mt-7 py-8 text-center text-slate-500">{loading ? "조회 중..." : "월을 선택한 뒤 그 달 조회하기를 눌러 주세요."}</p>}
      {overview && (
        <section aria-label="월별 수입 지출 합계" aria-live="polite" className="mt-7 rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-right">
          <p className="text-base font-medium text-slate-600">{overview.year}년 {overview.month}월 · 전체 기록 합계</p>
          <dl className="mt-5 space-y-5">
            <div><dt className="text-base font-semibold text-slate-700">운행 공급가액 합계</dt><dd className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{money(overview.driving_supply_amount)}</dd></div>
            {([
              ["요소수 공급가액", overview.urea_supply_amount],
              ["경유 공급가액", overview.diesel_supply_amount],
              ["수리 공급가액", overview.repair_supply_amount],
            ] as const).map(([label, value]) => <div key={label}><dt className="text-base font-medium text-slate-600">{label}</dt><dd className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{money(value)}</dd></div>)}
            <div className="border-t border-slate-200 pt-5"><dt className="text-base font-semibold text-slate-700">지출 공급가액 합계</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-red-700 sm:text-3xl">{money(overview.expense_supply_amount)}</dd></div>
            <div className="border-t border-slate-200 pt-5"><dt className="text-lg font-bold text-slate-700">공급가액 기준 남은 금액</dt><dd className={`mt-2 text-3xl font-bold tabular-nums sm:text-4xl ${overview.balance_amount.startsWith("-") ? "text-red-700" : "text-blue-700"}`}>{money(overview.balance_amount)}</dd></div>
          </dl>
          <p className="mt-5 text-sm text-slate-500">각 기록의 날짜 기준입니다. 수리비는 할부 개월과 관계없이 해당 월 수리 내역의 공급가액을 차감합니다.</p>
        </section>
      )}
      {overview && (
        <section aria-label="월별 세액 계산" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-5 text-right">
          <p className="text-lg font-bold text-slate-700">{overview.year}년 {overview.month}월 · 세액 계산</p>
          <div className="mt-5 space-y-5">
            {([
              ["요소수 세액", overview.urea_vat_amount],
              ["경유 세액", overview.diesel_vat_amount],
              ["수리 세액", overview.repair_vat_amount],
            ] as const).map(([label, value]) => <div key={label}><p className="text-base text-slate-600">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{money(value)}</p></div>)}
            <div className="border-t border-slate-200 pt-5"><p className="text-base font-semibold text-slate-700">지출 세액 합계 (매입세액)</p><p className="mt-1 text-2xl font-bold tabular-nums text-blue-700 sm:text-3xl">{money(overview.input_vat_amount)}</p></div>
            <div><p className="text-base font-semibold text-slate-700">운행 세액 (매출세액 · 공급가액의 10%)</p><p className="mt-1 text-2xl font-bold tabular-nums sm:text-3xl">{money(overview.output_vat_amount)}</p></div>
            <div className="border-t border-slate-200 pt-5"><p className="text-lg font-bold text-slate-700">이번 달 납부 예상 세액 (매출세액 − 매입세액)</p><p className="mt-2 text-3xl font-bold tabular-nums text-blue-700 sm:text-4xl">{money(overview.vat_balance_amount)}</p></div>
          </div>
          <p className="mt-5 text-sm text-slate-500">등록된 내역을 기준으로 계산한 예상 금액입니다. 음수는 매입세액이 매출세액보다 큰 경우입니다.</p>
        </section>
      )}
    </section>
  );
}
