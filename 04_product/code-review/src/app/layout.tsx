import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "code-review — コードを小学生にもわかる言葉で",
  description:
    "コードを貼り付けるだけで、AIがコード説明本のように解説してくれるツール。小学生からエンジニアまで3段階の解説レベルに対応。",
  keywords: "コード解説,プログラミング,AI,教育,開発者支援",
  authors: [{ name: "code-review" }],
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* DNS Prefetch */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        {/* Preconnect */}
        <link rel="preconnect" href="https://api.anthropic.com" />
        {/* Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js').catch(console.error);
              }
            `
          }}
        />
      </head>
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        }>
          {children}
        </Suspense>
      </body>
    </html>
  );
}