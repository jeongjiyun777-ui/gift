"use client";

import Link from "next/link";
import { useState } from "react";

interface DrivingRoute {
  shipper: string;
  origin: string;
  destination: string;
}

// 9월 명세서에서 확인한 주요 구간. DB 운행기록과는 별도의 화면 선택지입니다.
const routeOptions: DrivingRoute[] = [
  { shipper: "삼성로지텍", origin: "한진신항", destination: "화성A" },
  { shipper: "삼성로지텍", origin: "한진신항", destination: "화성B" },
  { shipper: "삼성로지텍", origin: "선광신항", destination: "화성A" },
  { shipper: "삼성로지텍", origin: "평택항", destination: "화성A" },
  { shipper: "삼성로지텍", origin: "평택항", destination: "화성B" },
  { shipper: "윤하운송", origin: "만도", destination: "평택포승" },
  { shipper: "윤하운송", origin: "케이랜드", destination: "안성미양" },
  { shipper: "윤하운송", origin: "글로비스", destination: "아산인주" },
  { shipper: "윤하운송", origin: "원방디아이", destination: "파주교하" },
  { shipper: "윤하운송", origin: "인천반납", destination: "인천반납" },
  { shipper: "윤하운송", origin: "대웅산업", destination: "시흥거북섬" },
  { shipper: "윤하운송", origin: "대웅산업", destination: "시흥정왕2" },
  { shipper: "윤하운송", origin: "대영포장", destination: "화성장안" },
  { shipper: "윤하운송", origin: "에코텍알엠", destination: "화성장안" },
  { shipper: "윤하운송", origin: "코다코", destination: "안성미양" },
  { shipper: "윤하운송", origin: "세방유통", destination: "용인모현" },
  { shipper: "윤하운송", origin: "신일화학", destination: "안산초지" },
  { shipper: "윤하운송", origin: "대진", destination: "안산초지" },
  { shipper: "윤하운송", origin: "로레알", destination: "안성일죽" },
  { shipper: "윤하운송", origin: "케이티비전", destination: "파주파주" },
  { shipper: "윤하운송", origin: "세원상사", destination: "철원김화" },
  { shipper: "윤하운송", origin: "다코넷", destination: "평택포승" },
  { shipper: "윤하운송", origin: "메인로드", destination: "인천오류왕" },
  { shipper: "윤하운송", origin: "탑코리아", destination: "인천연안" },
  { shipper: "윤하운송", origin: "포지션", destination: "포지션" },
];

const shippers = [...new Set(routeOptions.map((route) => route.shipper))];
const CONTAINER_SPEC = "40";
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400";

export default function NewDrivingPage() {
  const [shipper, setShipper] = useState<string>("");
  const [origin, setOrigin] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [containerNo, setContainerNo] = useState<string>("");
  const [chargeAmount, setChargeAmount] = useState<string>("");

  const origins = [...new Set(routeOptions.filter((route) => route.shipper === shipper).map((route) => route.origin))];
  const destinations = [...new Set(routeOptions.filter((route) => route.shipper === shipper && route.origin === origin).map((route) => route.destination))];
  const containerHasError = containerNo.length > 0 && !/^[A-Z]{4}[0-9]{7}$/.test(containerNo);

  function handleShipperChange(value: string) {
    setShipper(value);
    setOrigin("");
    setDestination("");
  }

  function handleOriginChange(value: string) {
    setOrigin(value);
    setDestination("");
  }

  return (
    <main className="flex-1 bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">운행기록 입력</h1>
        <p className="mt-2 text-sm text-slate-500">화주를 선택한 뒤 출발지와 도착지를 차례로 선택해 주세요.</p>
        <div className="mt-7 space-y-5">
          <div>
            <label htmlFor="driving-shipper" className="mb-2 block font-semibold">화주</label>
            <select id="driving-shipper" value={shipper} onChange={(event) => handleShipperChange(event.target.value)} className={fieldClass}>
              <option value="">화주 선택</option>
              {shippers.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="driving-origin" className="mb-2 block font-semibold">출발지</label>
              <select id="driving-origin" value={origin} disabled={!shipper} onChange={(event) => handleOriginChange(event.target.value)} className={fieldClass}>
                <option value="">{shipper ? "출발지 선택" : "화주를 먼저 선택해 주세요"}</option>
                {origins.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="driving-destination" className="mb-2 block font-semibold">도착지</label>
              <select id="driving-destination" value={destination} disabled={!origin} onChange={(event) => setDestination(event.target.value)} className={fieldClass}>
                <option value="">{origin ? "도착지 선택" : "출발지를 먼저 선택해 주세요"}</option>
                {destinations.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-500">9월 명세서에서 확인한 주요 구간을 기준으로 한 선택지입니다.</p>
          {destination && (
            <p role="status" className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {shipper} · {origin} → {destination}
            </p>
          )}
          <div>
            <label htmlFor="driving-container" className="mb-2 block font-semibold">CNTR (컨테이너 번호)</label>
            <input
              id="driving-container"
              type="text"
              value={containerNo}
              onChange={(event) => setContainerNo(event.target.value.replace(/\s/g, "").toUpperCase())}
              placeholder="예: ABCD1234567"
              maxLength={11}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="driving-container-hint"
              aria-invalid={containerHasError}
              className={`${fieldClass} font-mono`}
            />
            <p id="driving-container-hint" className={`mt-2 text-sm ${containerHasError ? "text-red-600" : "text-slate-500"}`}>
              영문 4자리와 숫자 7자리로 입력해 주세요. 컨테이너 번호는 직접 확인해 입력합니다.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="driving-spec" className="mb-2 block font-semibold">규격</label>
              <input id="driving-spec" type="text" value={CONTAINER_SPEC} readOnly className={`${fieldClass} bg-slate-100 text-slate-500`} />
            </div>
            <div>
              <label htmlFor="driving-charge" className="mb-2 block font-semibold">청구가액 (원)</label>
              <input
                id="driving-charge"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={chargeAmount}
                onChange={(event) => setChargeAmount(event.target.value)}
                placeholder="예: 357300"
                className={fieldClass}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Link href="/driving" className="rounded-lg border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50">조회로 돌아가기</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
