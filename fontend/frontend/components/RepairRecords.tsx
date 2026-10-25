"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import RepairRecordEditor from "@/components/RepairRecordEditor";
import { REPAIR_API_URL as API_URL, type RepairRecord, repairDate } from "@/lib/repairRecords";

function formatNumber(value: string, digits: number) {
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits });
}

export default function RepairRecords() {
  const label = "수리";
  const endpoint = "/repair-records";
  const [period, setPeriod] = useState("");
  const [appliedPeriod, setAppliedPeriod] = useState("");
  const [records, setRecords] = useState<RepairRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<RepairRecord | null>(null);
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [mutationMessage, setMutationMessage] = useState("");
  const mutationRef = useRef(false);
  const busy = loading || mutating || Boolean(editing);

  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
  }, []);

  function handlePeriodChange(value: string) {
    requestRef.current?.abort();
    requestRef.current = null;
    setSelectedIds([]);
    setMutationError("");
    setMutationMessage("");
    setPeriod(value);
    setAppliedPeriod("");
    setRecords([]);
    setError("");
    setLoading(false);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || busy) return;
    setSelectedIds([]);
    setMutationError("");
    setMutationMessage("");
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
      const response = await fetch(`${API_URL}${endpoint}?${params}`, {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("조회 실패");
      const data: RepairRecord[] = await response.json();
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

  async function reloadCurrentMonth() {
    const [year, month] = appliedPeriod.split("-");
    const params = new URLSearchParams({ year, month });
    const response = await fetch(`${API_URL}${endpoint}?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error("재조회 실패");
    const data: RepairRecord[] = await response.json();
    setRecords(data);
    setSelectedIds([]);
  }

  function handleEdit() {
    if (busy || selectedIds.length !== 1) return;
    const record = records.find((row) => row.id === selectedIds[0]);
    if (!record) return;
    setMutationError("");
    setMutationMessage("");
    setEditing(record);
  }

  async function handleSaved() {
    setMutating(true);
    setEditing(null);
    setMutationMessage("수정했습니다.");
    try {
      await reloadCurrentMonth();
    } catch {
      setRecords([]);
      setSelectedIds([]);
      setMutationError("수정은 완료됐지만 재조회하지 못했습니다. 그 달 조회하기를 눌러 주세요.");
    } finally {
      setMutating(false);
    }
  }

  async function handleDelete() {
    if (busy || mutationRef.current || selectedIds.length === 0) return;
    const selected = records.filter((row) => selectedIds.includes(row.id));
    if (!selected.length) return;
    const details = selected.map((row) => `${repairDate(row.repaired_at)} · ${row.merchant_name} · ${formatNumber(row.total_amount,2)}원`).join("\n");
    if (!window.confirm(`선택한 ${selected.length}건을 정말 삭제하시겠습니까?\n\n${details}\n\n삭제한 기록은 되돌릴 수 없습니다.`)) return;
    mutationRef.current = true;
    setMutating(true);
    setMutationError("");
    setMutationMessage("");
    let deleted = false;
    try {
      const response = await fetch(`${API_URL}${endpoint}/delete`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected.map((row) => row.id) }),
      });
      if (response.status === 409) { setMutationError("선택한 기록이 변경됐습니다. 다시 조회해 주세요."); return; }
      if (!response.ok) throw new Error("삭제 실패");
      deleted = true;
      setMutationMessage(`${selected.length}건을 삭제했습니다.`);
      await reloadCurrentMonth();
    } catch {
      if (deleted) { setRecords([]); setSelectedIds([]); }
      setMutationError(deleted ? "삭제는 완료됐지만 재조회하지 못했습니다. 그 달 조회하기를 눌러 주세요."
        : "삭제 결과를 확인하지 못했습니다. 다시 조회해 기록을 확인해 주세요.");
    } finally {
      mutationRef.current = false;
      setMutating(false);
    }
  }

  const emptyMessage = loading ? "조회 중..." : error ? error
    : !appliedPeriod ? "날짜를 선택한 뒤 그 달 조회하기를 눌러 주세요."
    : `선택한 달의 ${label} 기록이 없습니다.`;

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-3xl flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{label} 조회</h1>
      <p className="mt-2 text-sm text-slate-500">조회할 연도와 월을 선택해 수리 내역을 확인해 보세요.</p>
      {mutationError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{mutationError}</p>}
      {mutationMessage && <p role="status" className="mt-3 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{mutationMessage}</p>}
      {editing && <RepairRecordEditor key={editing.id} record={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      <form onSubmit={handleSearch} className="mt-7" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label htmlFor="repair-period" className="font-semibold">날짜 선택</label>
          <input id="repair-period" type="month" disabled={mutating || Boolean(editing)} required min="0001-01" max="9998-12" value={period}
            onChange={(event) => handlePeriodChange(event.target.value)}
            className="max-w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </div>
        {records.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm text-slate-500" aria-live="polite">{selectedIds.length}건 선택</span>
            <button type="button" disabled={busy || selectedIds.length !== 1} onClick={handleEdit} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">수정하기</button>
            <button type="button" disabled={busy || selectedIds.length === 0} onClick={handleDelete} className="rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">{mutating ? "처리 중..." : "삭제하기"}</button>
          </div>
        )}
        <div className="mt-5 w-full min-w-0 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1100px] border-collapse text-center text-sm [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-r [&_th]:border-slate-200 [&_th]:px-4 [&_th]:py-3 [&_th:last-child]:border-r-0 [&_td]:whitespace-nowrap [&_td]:border-r [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td:last-child]:border-r-0">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th scope="col"><input type="checkbox" aria-label="조회한 달 전체 선택" disabled={busy} checked={records.length > 0 && records.every((row) => selectedIds.includes(row.id))} onChange={(event) => setSelectedIds(event.target.checked ? records.map((row) => row.id) : [])} className="h-4 w-4 accent-blue-600" /></th>
                {["날짜", "상호명/대표자", "사업자번호", "카드사", "개월", "총액 (원)"].map((heading) => (
                  <th key={heading} scope="col" className="font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {records.length > 0 ? records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td><input type="checkbox" aria-label={`${repairDate(record.repaired_at)} ${record.merchant_name} 선택`} disabled={busy} checked={selectedIds.includes(record.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids,record.id] : ids.filter((id) => id !== record.id))} className="h-4 w-4 accent-blue-600" /></td>
                  <td>{repairDate(record.repaired_at)}</td>
                  <td className="font-medium">{record.merchant_name}</td>
                  <td>{record.business_number?.trim() || "-"}</td>
                  <td>{record.card_company?.trim() || "-"}</td>
                  <td>{record.installment_months === null ? "-" : record.installment_months === 0 ? "일시불" : `${record.installment_months}개월`}</td>
                  <td className="tabular-nums">{formatNumber(record.total_amount, 2)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7}><p role={error ? "alert" : "status"} className={`py-8 ${error ? "text-red-700" : "text-slate-500"}`}>{emptyMessage}</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-slate-500">
            {appliedPeriod ? `${appliedPeriod.replace("-", "년 ")}월 · 총 ${records.length}건` : "월을 선택해 주세요."}
          </p>
          <button type="submit" disabled={!period || busy} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? "조회 중..." : "그 달 조회하기"}
          </button>
        </div>
      </form>
    </section>
  );
}
