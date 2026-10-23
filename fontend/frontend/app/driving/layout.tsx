import type { ReactNode } from "react";

export default function DrivingLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
      {children}
    </main>
  );
}
