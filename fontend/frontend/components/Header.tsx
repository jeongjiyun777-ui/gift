"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "축의금 조회" },
  { href: "/gifts/new", label: "축의금 입력" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-700 bg-slate-800 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          축의금 기록
        </Link>
        <nav aria-label="주 메뉴" className="flex gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                pathname === link.href
                  ? "bg-white text-slate-900"
                  : "text-slate-200 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
