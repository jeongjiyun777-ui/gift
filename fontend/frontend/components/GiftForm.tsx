"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

import { giftEndpoint } from "@/lib/gifts";
import type { Gift } from "@/lib/gifts";

export default function GiftForm({ direction }: { direction: "received" | "paid" }) {
  const label = direction === "paid" ? "지출금액" : "받은 금액";
  const listHref = direction === "paid" ? "/gifts/paid" : "/";
  const [name, setName] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [paidOn, setPaidOn] = useState<string>("");
  const [category, setCategory] = useState<string>("축의금");
  const [detail, setDetail] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [savedGift, setSavedGift] = useState<Gift | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    setSavedGift(null);
    const trimmedName = name.trim();
    const numericAmount = Number(amount);
    if (!trimmedName || !amount.trim() || !Number.isSafeInteger(numericAmount) || numericAmount < 0) {
      setError("이름과 0원 이상의 정수 금액을 입력해 주세요.");
      return;
    }
    if (direction === "paid" && !paidOn) {
      setError("지출 날짜를 선택해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}${giftEndpoint(direction)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName, amount: numericAmount, direction,
          ...(direction === "paid" ? {
            paid_on: paidOn,
            category: category.trim() || null,
            detail: detail.trim() || null,
            location: location.trim() || null,
          } : {}),
        }),
      });
      if (!response.ok) throw new Error("저장 실패");
      const gift: Gift = await response.json();
      setSavedGift(gift);
      setName("");
      setAmount("");
      setPaidOn("");
      setDetail("");
      setLocation("");
    } catch {
      setError("저장을 확인하지 못했습니다. 조회 화면에서 내역을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{label} 입력</h1>
        <p className="mt-2 text-sm text-slate-500">이름과 금액을 입력해 {label} 내역을 남겨 보세요.</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="gift-create-name" className="mb-2 block font-semibold">이름</label>
            <input
              id="gift-create-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="이름 입력"
              required
              disabled={saving}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="gift-create-amount" className="mb-2 block font-semibold">금액 (원)</label>
            <input
              id="gift-create-amount"
              type="number"
              inputMode="numeric"
              min="0"
              step="10000"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="예: 100000"
              required
              disabled={saving}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>
          {direction === "paid" && (
            <>
              <div>
                <label htmlFor="gift-paid-on" className="mb-2 block font-semibold">지출 날짜</label>
                <input id="gift-paid-on" type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required disabled={saving} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base disabled:opacity-60" />
              </div>
              <div>
                <label htmlFor="gift-category" className="mb-2 block font-semibold">종류</label>
                <select id="gift-category" value={category} onChange={(event) => setCategory(event.target.value)} disabled={saving} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base disabled:opacity-60">
                  <option value="축의금">축의금</option>
                  <option value="조의금">조의금</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div>
                <label htmlFor="gift-detail" className="mb-2 block font-semibold">세부사항</label>
                <input id="gift-detail" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="예: 자녀결혼, 부친상" disabled={saving} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base disabled:opacity-60" />
              </div>
              <div>
                <label htmlFor="gift-location" className="mb-2 block font-semibold">장소 (선택)</label>
                <input id="gift-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="없으면 비워 두세요" disabled={saving} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-base disabled:opacity-60" />
              </div>
            </>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {savedGift && (
            <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">
              {savedGift.name} 님의 {savedGift.amount.toLocaleString("ko-KR")}원을 저장했습니다.{" "}
              <Link href={listHref} className="font-semibold underline">조회 화면에서 확인하기</Link>
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Link href={listHref} className="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50">조회로 돌아가기</Link>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
              {saving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
