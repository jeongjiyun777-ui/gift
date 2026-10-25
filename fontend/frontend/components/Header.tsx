"use client";

import Link from "next/link";
import Image from "next/image";
import InstallApp from "./InstallApp";
import { usePathname } from "next/navigation";
import { useState } from "react";

const giftLinks = [
  { href: "/", label: "받은 금액 조회", icon: "gift" },
  { href: "/gifts/paid", label: "지출금액 조회", icon: "gift" },
  { href: "/gifts/new", label: "받은 금액 입력", icon: "add" },
  { href: "/gifts/paid/new", label: "지출금액 입력", icon: "add" },
] as const;

const drivingLinks = [
  { href: "/driving", label: "운행 조회", icon: "car" },
  { href: "/driving/urea/records", label: "요소수 조회", icon: "drop" },
  { href: "/driving/diesel/records", label: "경유 조회", icon: "fuel" },
  { href: "/driving/repairs/records", label: "수리 조회", icon: "tool" },
  { href: "/driving/new", label: "운행 입력", icon: "car" },
  { href: "/driving/urea", label: "요소수 입력", icon: "drop" },
  { href: "/driving/diesel", label: "경유 입력", icon: "fuel" },
  { href: "/driving/repairs", label: "수리 입력", icon: "tool" },
] as const;

function HeaderIcon({ icon }: { icon: "gift" | "add" | "car" | "drop" | "fuel" | "tool" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === "tool" ? (
        <path d="M14.7 6.3a5.5 5.5 0 0 0-7 7L3 18a2.1 2.1 0 0 0 3 3l4.7-4.7a5.5 5.5 0 0 0 7-7l-3.4 3.4-3-3 3.4-3.4Z" />
      ) : icon === "fuel" ? (
        <>
          <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M2 21h14M4 11h10M7 6h4v2H7z" />
          <path d="M14 12h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-4-4M19 5v4h3" />
        </>
      ) : icon === "drop" ? (
        <>
          <path d="M12 3s-6 6.5-6 11a6 6 0 0 0 12 0c0-4.5-6-11-6-11Z" />
          <path d="M9 14a3 3 0 0 0 3 3" />
        </>
      ) : icon === "car" ? (
        <>
          <path d="m5 10 1.7-5.1A1.3 1.3 0 0 1 8 4h8a1.3 1.3 0 0 1 1.3.9L19 10" />
          <path d="M5 10h14a2 2 0 0 1 2 2v5H3v-5a2 2 0 0 1 2-2Z" />
          <path d="M5 17v3m14-3v3M7 13h1m8 0h1M3 9H2m20 0h-1" />
        </>
      ) : (
        <>
          <path d="M3 7h18v12H3zM3 7l9 7 9-7" />
          <path d="M8 3h8" />
          {icon === "add" && <path d="M18 2v4m-2-2h4" />}
        </>
      )}
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [giftMenuOpen, setGiftMenuOpen] = useState(false);
  const [drivingMenuOpen, setDrivingMenuOpen] = useState(false);
  const isDrivingPage = pathname === "/driving" || pathname.startsWith("/driving/");
  const isGiftPage = pathname === "/" || pathname.startsWith("/gifts/");

  return (
    <header className="relative z-20 border-b border-slate-700 bg-slate-800 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Image src="/icons/notebook.svg" alt="" width={36} height={36} className="rounded-lg" />
          정정식 업무모음
        </Link>
        <nav aria-label="주 메뉴" className="ml-auto flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
          <InstallApp />
          <div
            className="relative"
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setGiftMenuOpen(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setGiftMenuOpen(false);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setGiftMenuOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setGiftMenuOpen(false);
            }}
          >
            <button
              type="button"
              aria-expanded={giftMenuOpen}
              aria-controls="gift-navigation"
              onClick={() => setGiftMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setGiftMenuOpen(true);
                }
              }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                isGiftPage ? "bg-white text-slate-900" : "text-slate-200 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <HeaderIcon icon="gift" />
              축의금/조의금
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {giftMenuOpen && (
              <div id="gift-navigation" className="absolute right-0 top-full w-52 pt-2">
                <div className="rounded-xl bg-white p-2 text-slate-900 shadow-lg ring-1 ring-slate-200">
                  {giftLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-label={`축의금/조의금 ${link.label}`}
                      aria-current={pathname === link.href ? "page" : undefined}
                      onClick={() => setGiftMenuOpen(false)}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                        pathname === link.href ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <HeaderIcon icon={link.icon} />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div
            className="relative"
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse") setDrivingMenuOpen(true);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") setDrivingMenuOpen(false);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDrivingMenuOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setDrivingMenuOpen(false);
            }}
          >
            <button
              type="button"
              aria-expanded={drivingMenuOpen}
              aria-controls="driving-navigation"
              onClick={() => setDrivingMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setDrivingMenuOpen(true);
                }
              }}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                isDrivingPage ? "bg-white text-slate-900" : "text-slate-200 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <HeaderIcon icon="car" />
              운행
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {drivingMenuOpen && (
              <div id="driving-navigation" className="absolute right-0 top-full w-40 pt-2">
                <div className="rounded-xl bg-white p-2 text-slate-900 shadow-lg ring-1 ring-slate-200">
                  {drivingLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-label={link.label}
                      aria-current={pathname === link.href ? "page" : undefined}
                      onClick={() => setDrivingMenuOpen(false)}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition ${
                        pathname === link.href ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <HeaderIcon icon={link.icon} />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
