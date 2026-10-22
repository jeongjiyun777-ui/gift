"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface DrivingRecord {
  id: number | string;
  operated_on: string;
  category: string | null;
  shipper_name: string;
  region_1: string | null;
  region_2: string | null;
  shipping_line: string | null;
  container_spec: string | null;
  container_no: string | null;
  charge_amount: number | string;
  tax_amount: number | string | null;
  memo: string | null;
  vehicle_number: string | null;
  recipient_name: string | null;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const PAGE_SIZE = 10;
const columns = ["번호", "일자", "구분", "화주", "지역", "지역", "라인", "규격", "CNTR", "청구가액", "세액", "비고"];

function displayText(value: string | null) {
  return value?.trim() || "—";
}

function formatAmount(value: number | string | null) {
  if (value === null || value === "") return "—";
  const amount = Number(typeof value === "string" ? value.replaceAll(",", "") : value);
  return Number.isFinite(amount) ? amount.toLocaleString("ko-KR") : "—";
}

export default function DrivingPage() {
  const [records, setRecords] = useState<DrivingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadDrivingRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    setCurrentPage(1);
    try {
      const response = await fetch(`${API_URL}/driving-records`, { cache: "no-store" });
      if (!response.ok) throw new Error("운행기록 조회 실패");
      const data: DrivingRecord[] = await response.json();
      if (!Array.isArray(data)) throw new Error("운행기록 응답 형식 오류");
      setRecords(data);
    } catch {
      setRecords([]);
      setError("운행기록을 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDrivingRecords();
  }, [loadDrivingRecords]);

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const visibleRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, currentPage]);

  return (
    <main className="flex-1 bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
      <section className="mx-auto w-full max-w-7xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">운행기록</h1>
            <p className="mt-2 text-sm text-slate-500">거래명세서 순서에 맞춰 운행 내역을 확인해 보세요.</p>
          </div>
          <button type="button" disabled={loading} onClick={() => void loadDrivingRecords()} className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
            {loading ? "조회 중..." : "새로고침"}
          </button>
        </div>
        <div className="mt-7 flex items-center justify-between gap-3 text-sm text-slate-500">
          <h2 className="font-semibold text-slate-700">거래명세서</h2>
          {!loading && !error && <p>총 {records.length}건</p>}
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1240px] border-collapse text-sm">
            <caption className="sr-only">운행기록 거래명세서. 금액 단위는 원입니다.</caption>
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                {columns.map((label, index) => (
                  <th key={`${label}-${index}`} scope="col" aria-label={index === 4 ? "첫 번째 지역" : index === 5 ? "두 번째 지역" : label} className={`whitespace-nowrap border-b border-r border-slate-200 px-4 py-3 font-semibold last:border-r-0 ${index === 9 || index === 10 ? "text-right" : "text-center"}`}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 [&_td]:border-r [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-3 [&_td:last-child]:border-r-0">
              {loading || error || records.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="h-40 text-center text-slate-500" aria-live="polite">
                    {loading ? "운행기록을 불러오는 중입니다..." : error ? "연결이 완료되면 이곳에 운행기록이 표시됩니다." : "등록된 운행기록이 없습니다."}
                  </td>
                </tr>
              ) : visibleRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="text-center tabular-nums text-slate-500">{record.id}</td>
                  <td className="whitespace-nowrap text-center">{record.operated_on}</td>
                  <td className="text-center">{displayText(record.category)}</td>
                  <td className="font-medium">{record.shipper_name}</td>
                  <td>{displayText(record.region_1)}</td>
                  <td>{displayText(record.region_2)}</td>
                  <td>{displayText(record.shipping_line)}</td>
                  <td className="text-center">{displayText(record.container_spec)}</td>
                  <td className="whitespace-nowrap font-mono">{displayText(record.container_no)}</td>
                  <td className="text-right tabular-nums">{formatAmount(record.charge_amount)}</td>
                  <td className="text-right tabular-nums">{formatAmount(record.tax_amount)}</td>
                  <td className="max-w-64 whitespace-pre-wrap break-words">{displayText(record.memo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-right text-xs text-slate-500">금액 단위: 원 · 표를 좌우로 밀어 모든 항목을 확인할 수 있습니다.</p>
        {!loading && !error && records.length > 0 && (
          <nav aria-label="운행기록 페이지" className="mt-5 flex items-center justify-center gap-4">
            <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">이전</button>
            <span aria-live="polite" className="text-sm text-slate-600">{currentPage} / {totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">다음</button>
          </nav>
        )}
      </section>
    </main>
  );
}
