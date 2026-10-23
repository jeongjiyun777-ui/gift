"use client";

import { useEffect, useRef, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [help, setHelp] = useState("");
  const installLock = useRef(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const updateDisplay = () => setInstalled(standalone.matches);
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
    if (!installPrompt) {
      setHelp("안드로이드 Chrome에서 오른쪽 위 ⋮ 메뉴 → ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.");
      return;
    }
    installLock.current = true;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (outcome === "dismissed") setHelp("나중에 Chrome 메뉴에서 다시 설치할 수 있습니다.");
    } catch {
      setInstallPrompt(null);
      setHelp("Chrome 오른쪽 위 ⋮ 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해 주세요.");
    } finally { installLock.current = false; setInstalling(false); }
  };

  if (installed) return null;
  return (
    <div className="relative">
      <button type="button" onClick={handleInstall} disabled={installing} aria-describedby={help ? "app-install-help" : undefined} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50">
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4" /></svg>
        {installing ? "설치 확인 중..." : "앱 설치"}
      </button>
      {help && <div id="app-install-help" role="status" className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-lg ring-1 ring-slate-200"><p>{help}</p><button type="button" onClick={() => setHelp("")} className="mt-3 rounded-lg bg-slate-100 px-3 py-2 font-semibold">닫기</button></div>}
    </div>
  );
}
