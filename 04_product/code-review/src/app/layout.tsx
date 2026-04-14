import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "code-review — コードを小学生にもわかる言葉で",
  description:
    "コードを貼り付けるだけで、AIがコード説明本のように解説してくれるツール。小学生からエンジニアまで3段階の解説レベルに対応。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={jetbrainsMono.variable}>{children}</body>
    </html>
  );
}
