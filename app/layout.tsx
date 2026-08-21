import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Skillflow — 从一句任务到可运行能力",
  description: "Raycast 式 AI Skill 商店与工作流体验 Demo。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Skillflow — 一句任务，找到最适配的 Skill",
    description: "发现单个 Skill，或让 AI 把工作拆成可运行的能力路径。",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 767, alt: "Skillflow 能力路径预览" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skillflow — 一句任务，找到最适配的 Skill",
    description: "发现单个 Skill，或让 AI 把工作拆成可运行的能力路径。",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
