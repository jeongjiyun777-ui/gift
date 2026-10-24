"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface UreaRecord {
  id: number;
  purchased_on: string;
  merchant_name: string;
  business_number: string | null;
  card_company: string | null;
  unit_price: string;
  liters: string;
  supply_amount: string;
  vat_amount: string;
  total_amount: string;
  created_at: string;
}

function formatNumber(value: string, digits: number) {
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

export default function UreaRecordsPage() {
  const [period, setPeriod] = useState("");
  const [appliedPeriod, setAppliedPeriod] = useState("");
  const [records, setRecords] = useState<UreaRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const exportRef = useRef<AbortController | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    exportRef.current?.abort();
  }, []);

  function handlePeriodChange(value: string) {
    requestRef.current?.abort();
    requestRef.current = null;
    setDownloadError("");
    setPeriod(value);
    setAppliedPeriod("");
    setRecords([]);
    setError("");
    setLoading(false);
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
    setAppliedPeriod("");
    setRecords([]);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      const response = await fetch(`${API_URL}/urea-records?${params}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("조회 실패");
      const data: UreaRecord[] = await response.json();
      if (controller.signal.aborted) return;
      setRecords(data);
      setAppliedPeriod(period);
    } catch {
      if (!controller.signal.aborted) setError("조회하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function handleExcelDownload() {
    if (exportRef.current || loading) return;
    const params = new URLSearchParams();
    if (period) {
      const [year, month] = period.split("-").map(Number);
      if (!/^\d{4}-\d{2}$/.test(period) || year < 1 || year > 9998 || month < 1 || month > 12) {
        setDownloadError("올바른 연도와 월을 선택해 주세요.");
        return;
      }
      params.set("year", String(year));
      params.set("month", String(month));
    }
    const controller = new AbortController();
    exportRef.current = controller;
    setDownloading(true);
    setDownloadError("");
    try {
      const query = params.size ? `?${params}` : "";
      const response = await fetch(`${API_URL}/urea-records/export${query}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("조회 실패");
      const exportRecords: UreaRecord[] = await response.json();
      if (controller.signal.aborted) return;
      const { createUreaWorkbook } = await import("@/lib/ureaExcel");
      const buffer = await createUreaWorkbook(exportRecords);
      if (controller.signal.aborted) return;
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `요소수_${period || "전체기간"}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (!controller.signal.aborted) setDownloadError("엑셀 파일을 만들지 못했습니다. 다시 시도해 주세요.");
    } finally {
      if (exportRef.current === controller && !controller.signal.aborted) {
        exportRef.current = null;
        setDownloading(false);
      }
    }
  }

  const emptyMessage = loading ? "조회 중..." : error ? error
    : !appliedPeriod ? "날짜를 선택한 뒤 그 달 조회하기를 눌러 주세요."
    : "선택한 달의 요소수 구매 기록이 없습니다.";

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">요소수 조회</h1>
      <p className="mt-2 text-sm text-slate-500">조회할 연도와 월을 선택해 구매 내역을 확인해 보세요.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={loading || downloading} onClick={handleExcelDownload} className="inline-flex items-center gap-2 rounded-lg bg-[#107C41] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5C30] disabled:cursor-not-allowed disabled:opacity-50">
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 3h6v18h-6M14 7h6M14 12h6M14 17h6M17 3v18" />
            <path d="m3 5 11-2v18L3 19V5ZM6 9l5 6M11 9l-5 6" />
          </svg>
          {downloading ? "파일 만드는 중..." : period ? "그 달 엑셀로 저장하기" : "전체 엑셀로 저장하기"}
        </button>
      </div>
      <p className="mt-3 text-right text-sm text-slate-500">엑셀 저장 기간: {period ? `${period.replace("-", "년 ")}월` : "전체 기간"}</p>
      {downloadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{downloadError}</p>}
      <form onSubmit={handleSearch} className="mt-7" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label htmlFor="urea-period" className="font-semibold">날짜 선택</label>
          <input id="urea-period" type="month" disabled={downloading} required min="0001-01" max="9998-12" value={period}
            onChange={(event) => handlePeriodChange(event.target.value)}
            className="max-w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div className="mt-5 w-full min-w-0 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1350px] text-center text-sm sm:text-base [&_th]:whitespace-nowrap [&_th]:px-6 [&_th]:py-3 [&_td]:whitespace-nowrap [&_td]:px-6 [&_td]:py-4 [&_td]:align-middle">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {["날짜", "상호명/대표자", "사업자번호", "카드사", "단가 (원)", "리터 (L)", "공급가액 (원)", "부가세 (원)", "총액 (원)"].map((heading) => (
                  <th key={heading} scope="col" className="font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.length > 0 ? records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td>{record.purchased_on}</td>
                  <td className="font-medium">{record.merchant_name}</td>
                  <td>{record.business_number?.trim() || "-"}</td>
                  <td>{record.card_company?.trim() || "-"}</td>
                  <td className="tabular-nums">{formatNumber(record.unit_price, 2)}</td>
                  <td className="tabular-nums">{formatNumber(record.liters, 3)}</td>
                  <td className="tabular-nums">{formatNumber(record.supply_amount, 2)}</td>
                  <td className="tabular-nums">{formatNumber(record.vat_amount, 2)}</td>
                  <td className="tabular-nums">{formatNumber(record.total_amount, 2)}</td>
                </tr>
              )) : (
                <tr><td colSpan={9}><p role={error ? "alert" : "status"} className={`py-8 ${error ? "text-red-700" : "text-slate-500"}`}>{emptyMessage}</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-slate-500">
            {appliedPeriod ? `${appliedPeriod.replace("-", "년 ")}월 · 총 ${records.length}건` : "월을 선택해 주세요."}
          </p>
          <button type="submit" disabled={!period || loading || downloading} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "조회 중..." : "그 달 조회하기"}
          </button>
        </div>
      </form>
    </section>
  );
}
