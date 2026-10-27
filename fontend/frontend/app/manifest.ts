import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "정정식 업무모음",
    short_name: "정정식 업무모음",
    description: "축의금과 운행기록을 간편하게 조회하고 기록하는 업무 노트",
    lang: "ko",
    start_url: "/driving",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#1e293b",
    icons: [
      { src: "/icons/notebook-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/notebook-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/notebook-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
