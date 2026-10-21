"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

type Gift = {
  id: number;
  name: string;
  amount: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const PAGE_SIZE = 10;

export default function Home() {
  const [searchName, setSearchName] = useState<string>("");
  const [appliedName, setAppliedName] = useState<string>("");
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const loadGifts = useCallback(async (name: string) => {
    setLoading(true);
    setError("");
    setCurrentPage(1);

    try {
      const query = name.trim()
        ? `?name=${encodeURIComponent(name.trim())}`
        : "";
      const response = await fetch(`${API_URL}/gifts${query}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`조회 요청에 실패했습니다. (${response.status})`);
      }

      const data: Gift[] = await response.json();
      setGifts(data);
      setAppliedName(name.trim());
    } catch {
      setGifts([]);
      setError("서버에 연결할 수 없습니다. FastAPI 서버가 실행 중인지 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGifts("");
  }, [loadGifts]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadGifts(searchName);
  }

  const totalPages = Math.max(1, Math.ceil(gifts.length / PAGE_SIZE));
  const visibleGifts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return gifts.slice(start, start + PAGE_SIZE);
  }, [gifts, currentPage]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">축의금 조회</h1>
        <p className="mt-2 text-sm text-slate-500">
          이름을 검색하면 해당하는 기록을 모두 보여줍니다.
        </p>

        <form onSubmit={handleSearch} className="mt-7 flex flex-wrap gap-2">
          <label htmlFor="gift-name" className="sr-only">
            이름 검색
          </label>
          <input
            id="gift-name"
            type="text"
            value={searchName}
            onChange={(event) => setSearchName(event.target.value)}
            placeholder="이름 입력"
            className="min-w-0 basis-full flex-1 rounded-lg sm:basis-0 border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="submit"
            disabled={loading}
            aria-label="이름 검색"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" strokeWidth="2" />
              <path d="m16 16 4 4" strokeLinecap="round" strokeWidth="2" />
            </svg>
            <span>검색</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setSearchName("");
              void loadGifts("");
            }}
            className="shrink-0 rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
          >
            전체 보기
          </button>
        </form>

        <div className="mt-6 flex min-h-6 items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            {appliedName ? `“${appliedName}” 검색 결과` : "전체 기록"}
          </p>
          {!loading && !error && <p>총 {gifts.length}건</p>}
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : loading ? (
          <p className="py-14 text-center text-slate-500">조회 중...</p>
        ) : gifts.length === 0 ? (
          <p className="py-14 text-center text-slate-500">검색 결과가 없습니다.</p>
        ) : (
          <>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm sm:text-base">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th scope="col" className="w-20 px-4 py-3 text-center font-medium">번호</th>
                    <th scope="col" className="px-4 py-3 font-medium">이름</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleGifts.map((gift) => (
                    <tr key={gift.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-center text-slate-500">{gift.id}</td>
                      <td className="px-4 py-3 font-medium">{gift.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {gift.amount.toLocaleString("ko-KR")}원
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav aria-label="결과 페이지" className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>
              <span aria-live="polite" className="text-sm text-slate-600">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </nav>
          </>
        )}
      </section>
    </main>
  );
}




