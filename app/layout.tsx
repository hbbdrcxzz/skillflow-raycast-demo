import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skillflow — 从一句任务到可运行能力",
  description: "面向中国职场用户的 AI Skill 商店与工作流工作台。",
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
      <body>{children}</body>
    </html>
  );
}
