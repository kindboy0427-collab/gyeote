import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "곁에 - 부모님 안부 케어 서비스",
  description: "매일 아침 카카오톡으로 부모님 안부를 확인하고 응답이 없으면 자녀에게 즉시 알려드려요. 월 4,900원으로 부모님 곁에 있어드리세요.",
  keywords: ["부모님 안부", "노인 케어", "효도 서비스", "카카오톡 안부", "부모님 건강 확인", "독거노인", "곁에"],
  authors: [{ name: "에브리홈" }],
  creator: "에브리홈",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://gyeote-eight.vercel.app",
    siteName: "곁에",
    title: "곁에 - 부모님 안부 케어 서비스",
    description: "매일 아침 카카오톡으로 부모님 안부를 확인하고 응답이 없으면 자녀에게 즉시 알려드려요. 월 4,900원으로 부모님 곁에 있어드리세요.",
  },
  twitter: {
    card: "summary_large_image",
    title: "곁에 - 부모님 안부 케어 서비스",
    description: "매일 아침 카카오톡으로 부모님 안부를 확인하고 응답이 없으면 자녀에게 즉시 알려드려요.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}