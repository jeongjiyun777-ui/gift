"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "축의금 조회", icon: "gift" },
  { href: "/gifts/new", label: "축의금 입력", icon: "add" },
  { href: "/driving", label: "운행기록", icon: "car" },
] as const;

function HeaderIcon({ icon }: { icon: (typeof links)[number]["icon"] }) {
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

  return (
    <header className="border-b border-slate-700 bg-slate-800 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          정정식 업무목록
        </Link>
        <nav aria-label="주 메뉴" className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                pathname === link.href
                  ? "bg-white text-slate-900"
                  : "text-slate-200 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <HeaderIcon icon={link.icon} />
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
