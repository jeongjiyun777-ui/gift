"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const giftLinks = [
  { href: "/", label: "조회", icon: "gift" },
  { href: "/gifts/new", label: "입력", icon: "add" },
] as const;

function HeaderIcon({ icon }: { icon: "gift" | "add" | "car" }) {
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
      {icon === "car" ? (
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
  const isGiftPage = pathname === "/" || pathname.startsWith("/gifts/");

  return (
    <header className="relative z-20 border-b border-slate-700 bg-slate-800 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          정정식 업무목록
        </Link>
        <nav aria-label="주 메뉴" className="flex flex-wrap gap-2">
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
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isGiftPage ? "bg-white text-slate-900" : "text-slate-200 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <HeaderIcon icon="gift" />
              축의금
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {giftMenuOpen && (
              <div id="gift-navigation" className="absolute right-0 top-full w-40 pt-2">
                <div className="rounded-xl bg-white p-2 text-slate-900 shadow-lg ring-1 ring-slate-200">
                  {giftLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-label={`축의금 ${link.label}`}
                      aria-current={pathname === link.href ? "page" : undefined}
                      onClick={() => setGiftMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
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
          <Link
            href="/driving"
            aria-current={pathname === "/driving" ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              pathname === "/driving" ? "bg-white text-slate-900" : "text-slate-200 hover:bg-slate-700 hover:text-white"
            }`}
          >
            <HeaderIcon icon="car" />
            운행기록
          </Link>
        </nav>
      </div>
    </header>
  );
}
