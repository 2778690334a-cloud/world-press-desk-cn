import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : "http://localhost:3000";
  const title = "世界版面室｜全球权威媒体头版雷达";
  const description =
    "每日汇集全球权威媒体的头版头条、报道重心、原文与网页存档入口。";

  return {
    title,
    description,
    applicationName: "世界版面室",
    keywords: [
      "全球报纸",
      "头版头条",
      "媒体观察",
      "新闻聚合",
      "Wayback Machine",
    ],
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1732,
          height: 909,
          alt: "世界版面室——今天，世界把什么放在了头版？",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
