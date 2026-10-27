"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import DrivingRecordEditor from "../../components/DrivingRecordEditor";
import { DRIVING_API_URL as API_URL, fetchDrivingRecords, fetchDrivingReport, type DrivingRecord, type DrivingTotals } from "../../lib/drivingRecords";
const PAGE_SIZE = 10;
const columns = ["일자", "구분", "운송사", "화주", "지역", "지역", "시작 → 출발지 (km)", "출발지 → 도착지 (km)", "라인", "규격", "CNTR", "공급가액", "세액", "합계금액", "비고"];

function displayText(value: string | null) {
  return value?.trim() || "—";
}

function formatAmount(value: number | string | null) {
  if (value === null || value === "") return "—";
  const raw = String(value).replaceAll(",", "").trim();
  if (/^-?\d+$/.test(raw)) return BigInt(raw).toLocaleString("ko-KR");
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount.toLocaleString("ko-KR") : "—";
}

export default function DrivingPage() {
  const [records, setRecords] = useState<DrivingRecord[]>([]);
  const [totals, setTotals] = useState<DrivingTotals>({ charge_amount: "0", tax_amount: "0", total_amount: "0" });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const period = year && month ? `${year}-${month}` : "";
  const [appliedPeriod, setAppliedPeriod] = useState("");
  const activeRequest = useRef<AbortController | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<DrivingRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const appliedQuery = useRef({ year: "", month: "" });
  const busy = loading || deleting || downloading || Boolean(editing);

  const loadDrivingRecords = useCallback(async (selectedYear: string, selectedMonth: string) => {
    if (!selectedYear || !selectedMonth) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const { signal } = controller;
    setLoading(true);
    setHasSearched(true);
    setError("");
    setCurrentPage(1);
    setDownloadError("");
    setSelectedIds([]);
    setEditing(null);
    try {
      const report = await fetchDrivingReport(selectedYear, selectedMonth, signal);
      if (signal?.aborted) return;
      setRecords(report.records);
      setTotals(report.totals);
      appliedQuery.current = { year: selectedYear, month: selectedMonth };
      setAppliedPeriod(`${selectedYear}년 ${Number(selectedMonth)}월`);
    } catch {
      if (signal?.aborted) return;
      setRecords([]);
      setTotals({ charge_amount: "0", tax_amount: "0", total_amount: "0" });
      setError("운행기록을 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function handlePeriodSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy && year && month) void loadDrivingRecords(year, month);
  }

  const handlePeriodChange = (value: string) => {
    const [selectedYear = "", selectedMonth = ""] = value.split("-");
    setYear(selectedYear);
    setMonth(selectedMonth);
    setRecords([]);
    setTotals({ charge_amount: "0", tax_amount: "0", total_amount: "0" });
    setHasSearched(false);
    setAppliedPeriod("");
    setCurrentPage(1);
    setSelectedIds([]);
    setError("");
    setActionError("");
    setNotice("");
    setDownloadError("");
  };

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const visibleRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, currentPage]);

  function toggleSelection(id: string) {
    setEditing(null);
    setSelectedIds((previous) => previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]);
  }

  async function reloadAppliedPeriod() {
    await loadDrivingRecords(appliedQuery.current.year, appliedQuery.current.month);
  }

  const handleEdit = () => {
    if (busy || selectedIds.length !== 1) return;
    const record = records.find((item) => String(item.id) === selectedIds[0]);
    if (!record) {
      setActionError("선택한 기록을 찾을 수 없습니다. 다시 조회해 주세요.");
      return;
    }
    setActionError("");
    setNotice("");
    setEditing(record);
  };

  const handleEditClose = () => setEditing(null);

  const handleEditSaved = async () => {
    setNotice("수정했습니다.");
    await reloadAppliedPeriod();
  };

  const handleDelete = async () => {
    if (busy || !selectedIds.length) return;
    if (!window.confirm(`선택한 운행기록 ${selectedIds.length}건을 정말 삭제하시겠습니까?`)) return;
    const ids = selectedIds.map(Number);
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      setActionError("기록 번호를 확인할 수 없습니다. 다시 조회해 주세요.");
      return;
    }
    setDeleting(true);
    setActionError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/driving-records/delete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("삭제 실패");
      setNotice(`${ids.length}건을 삭제했습니다.`);
      await reloadAppliedPeriod();
    } catch {
      setActionError("삭제를 확인하지 못했습니다. 다시 조회한 뒤 내역을 확인해 주세요.");
    } finally { setDeleting(false); }
  };

  const handleExcelDownload = async () => {
    if (busy || !year || !month) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const exportRecords = await fetchDrivingRecords(year, month);
      if (!exportRecords.length) {
        setDownloadError("선택한 기간에 저장할 운행기록이 없습니다.");
        return;
      }
      const { createDrivingWorkbook } = await import("../../lib/drivingExcel");
      const buffer = await createDrivingWorkbook(exportRecords);
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      link.href = url;
      link.download = `운행기록_${period}_${today}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError("엑셀 파일을 만들지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setDownloading(false);
    }
  };

  return (
      <section className="mx-auto w-full max-w-7xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">운행기록</h1>
            <p className="mt-2 text-sm text-slate-500">운행 내역을 확인해 보세요.</p>
          </div>
          <button type="button" disabled={busy || !year || !month} onClick={handleExcelDownload} className="inline-flex items-center gap-2 rounded-lg bg-[#107C41] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0B5C30] disabled:cursor-not-allowed disabled:opacity-50">
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3h6v18h-6M14 7h6M14 12h6M14 17h6M17 3v18" />
              <path d="m3 5 11-2v18L3 19V5ZM6 9l5 6M11 9l-5 6" />
            </svg>
            {downloading ? "파일 만드는 중..." : "엑셀로 저장하기"}
          </button>
        </div>
        <p className="mt-4 text-right text-lg font-semibold text-slate-700 sm:text-xl">엑셀 저장 기간: {year && month ? `${year}년 ${Number(month)}월` : "월을 선택해 주세요"}</p>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 text-slate-500">
          <h2 className="font-semibold text-slate-700">운행기록</h2>
          {hasSearched && !loading && !error && <p className="text-lg font-semibold text-slate-700 sm:text-xl">{appliedPeriod} · 총 <span className="text-blue-700">{records.length.toLocaleString("ko-KR")}건</span></p>}
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {downloadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{downloadError}</p>}
        {actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-green-700">{notice}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <span className="self-center text-sm text-slate-500">{selectedIds.length}건 선택 · 전체 선택은 조회 기간 전체, 수정은 1건씩 가능합니다.</span>
          <button type="button" disabled={busy || selectedIds.length !== 1} onClick={handleEdit} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">수정하기</button>
          <button type="button" disabled={busy || !selectedIds.length} onClick={handleDelete} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40">{deleting ? "삭제 중..." : "삭제하기"}</button>
        </div>
        {editing && <DrivingRecordEditor key={String(editing.id)} record={editing} onClose={handleEditClose} onSaved={handleEditSaved} />}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1420px] border-collapse text-sm">
            <caption className="sr-only">운행기록 거래명세서. 금액 단위는 원입니다.</caption>
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th scope="col" className="border-b border-r border-slate-200 px-4 py-3 text-center">
                  <input type="checkbox" aria-label="조회 결과 전체 선택" disabled={busy || !records.length} checked={records.length > 0 && selectedIds.length === records.length} onChange={(event) => setSelectedIds(event.target.checked ? records.map((record) => String(record.id)) : [])} />
                </th>
                {columns.map((label, index) => (
                  <th key={`${label}-${index}`} scope="col" aria-label={index === 3 ? "첫 번째 지역" : index === 4 ? "두 번째 지역" : label} className="whitespace-nowrap border-b border-r border-slate-200 px-4 py-3 text-center font-semibold last:border-r-0">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 [&_td]:border-r [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-3 [&_td]:text-center [&_td:last-child]:border-r-0">
              {loading || error || records.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="h-40 text-center text-slate-500" aria-live="polite">
                    {loading ? "운행기록을 불러오는 중입니다..." : error ? "기간을 선택하고 다시 조회해 주세요." : !hasSearched ? "월을 선택해 주세요. 선택한 뒤 조회하기를 누르면 운행기록이 표시됩니다." : "조회한 기간에 등록된 운행기록이 없습니다."}
                  </td>
                </tr>
              ) : visibleRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="text-center"><input type="checkbox" aria-label={`${record.id}번 운행기록 선택`} disabled={busy} checked={selectedIds.includes(String(record.id))} onChange={() => toggleSelection(String(record.id))} /></td>
                  <td className="whitespace-nowrap text-center">{record.operated_on}</td>
                  <td className="text-center">{displayText(record.category)}</td>
                  <td className="font-medium">{record.carrier_name?.trim() || "-"}</td>
                  <td>{record.shipper_name?.trim() || "-"}</td>
                  <td>{displayText(record.region_1)}</td>
                  <td>{displayText(record.region_2)}</td>
                  <td className="text-center tabular-nums">{record.start_km == null ? "-" : record.start_km.toLocaleString("ko-KR")}</td>
                  <td className="text-center tabular-nums">{record.km == null ? "-" : record.km.toLocaleString("ko-KR")}</td>
                  <td>{displayText(record.shipping_line)}</td>
                  <td className="text-center">{displayText(record.container_spec)}</td>
                  <td className="whitespace-nowrap font-mono">{displayText(record.container_no)}</td>
                  <td className="text-center tabular-nums">{formatAmount(record.charge_amount)}</td>
                  <td className="text-center tabular-nums">{formatAmount(record.calculated_tax_amount)}</td>
                  <td className="text-center tabular-nums">{formatAmount(record.total_amount)}</td>
                  <td className="max-w-64 whitespace-pre-wrap break-words">{displayText(record.memo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasSearched && !loading && !error && (
          <div aria-live="polite" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-right">
            <p className="text-base font-medium text-slate-600">{appliedPeriod} · 조회한 전체 기록 합계</p>
            <dl className="mt-4 space-y-4">
              <div><dt className="text-base font-medium text-slate-600">공급가액 합계</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{formatAmount(totals.charge_amount)}원</dd></div>
              <div><dt className="text-base font-medium text-slate-600">세액 합계 (10%)</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{formatAmount(totals.tax_amount)}원</dd></div>
              <div className="border-t border-slate-200 pt-4"><dt className="text-base font-semibold text-slate-700">합계금액 (부가세 포함)</dt><dd className="mt-1 text-2xl font-bold tabular-nums text-blue-700 sm:text-3xl">{formatAmount(totals.total_amount)}원</dd></div>
            </dl>
          </div>
        )}
        <p className="mt-2 text-right text-xs text-slate-500">금액 단위: 원 · 표를 좌우로 밀어 모든 항목을 확인할 수 있습니다.</p>
        <form onSubmit={handlePeriodSearch} className="mt-6 flex flex-wrap items-end justify-center gap-3 rounded-xl bg-slate-50 px-4 py-5">
          <div>
            <label htmlFor="driving-period" className="mb-2 block text-sm font-semibold text-slate-700">조회 월</label>
            <input id="driving-period" type="month" required min="0001-01" max="9998-12" value={period} disabled={busy} onChange={(event) => handlePeriodChange(event.target.value)} aria-describedby="driving-period-hint" className="min-w-48 rounded-lg border border-slate-300 bg-white px-4 py-3 disabled:opacity-50" />
          </div>
          <button type="submit" disabled={busy || !year || !month} className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50">{loading ? "조회 중..." : "조회하기"}</button>
          <p id="driving-period-hint" className="w-full text-center text-sm text-slate-500">조회할 월을 먼저 선택해 주세요. 선택한 월의 기록만 조회하고 엑셀로 저장합니다.</p>
        </form>
        {!loading && !error && records.length > 0 && (
          <nav aria-label="운행기록 페이지" className="mt-5 flex items-center justify-center gap-4">
            <button type="button" disabled={busy || currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">이전</button>
            <span aria-live="polite" className="text-sm text-slate-600">{currentPage} / {totalPages}</span>
            <button type="button" disabled={busy || currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">다음</button>
          </nav>
        )}
      </section>
  );
}
