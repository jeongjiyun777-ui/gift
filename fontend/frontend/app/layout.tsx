import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "정정식 업무모음",
  description: "축의금과 운행기록을 관리하는 정정식 업무모음",
  applicationName: "정정식 업무모음",
  appleWebApp: { capable: true, title: "정정식 업무모음", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/notebook.svg", type: "image/svg+xml" }, { url: "/icons/notebook-192.png", type: "image/png" }],
    apple: [{ url: "/icons/notebook-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = { themeColor: "#1e293b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <Header />
        {children}
      </body>
    </html>
  );
}
