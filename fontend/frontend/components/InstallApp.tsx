"use client";

import { useEffect, useRef, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function manualInstallHelp() {
  return isAppleMobile()
    ? "iPhone·iPad에서는 Safari의 공유 버튼(위로 향한 화살표) → ‘홈 화면에 추가’ → ‘추가’를 눌러 주세요. ‘웹 앱으로 열기’가 보이면 켜 주세요."
    : "안드로이드 Chrome에서 오른쪽 위 ⋮ 메뉴 → ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.";
}

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [help, setHelp] = useState("");
  const installLock = useRef(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateDisplay = () => {
      setInstalled(standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
      setAppleMobile(isAppleMobile());
    };
    void Promise.resolve().then(updateDisplay);
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setHelp("");
    };
    const afterInstall = () => { setInstalled(true); setInstallPrompt(null); setHelp(""); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", afterInstall);
    standalone.addEventListener("change", updateDisplay);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        setHelp("앱 설치 준비를 마치지 못했습니다. 인터넷 연결을 확인하고 다시 열어 주세요.");
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", afterInstall);
      standalone.removeEventListener("change", updateDisplay);
    };
  }, []);

  const handleInstall = async () => {
    if (installLock.current) return;
    if (isAppleMobile() || !installPrompt) {
      setHelp(manualInstallHelp());
      return;
    }
    installLock.current = true;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (outcome === "dismissed") setHelp(manualInstallHelp());
    } catch {
      setInstallPrompt(null);
      setHelp(manualInstallHelp());
    } finally { installLock.current = false; setInstalling(false); }
  };

  if (installed) return null;
  return (
    <div className="relative">
      <button type="button" onClick={handleInstall} disabled={installing} aria-describedby={help ? "app-install-help" : undefined} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50">
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" /></svg>
        {installing ? "설치 확인 중..." : appleMobile ? "설치 안내" : "앱 설치"}
      </button>
      {help && <div id="app-install-help" role="status" className="fixed inset-x-4 top-24 z-30 mt-2 rounded-xl bg-white p-4 text-base leading-relaxed text-slate-700 shadow-lg ring-1 ring-slate-200 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-80"><p>{help}</p><button type="button" onClick={() => setHelp("")} className="mt-3 rounded-lg bg-slate-100 px-4 py-2 font-semibold">닫기</button></div>}
    </div>
  );
}
