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
  description: "매일 부모님 안부를 확인하고 자녀에게 리포트를 전달하는 케어 서비스",
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
        <footer style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '12px',
          color: '#888',
          borderTop: '1px solid #eee',
          marginTop: '40px'
        }}>
          <p>© 2026 에브리홈 | 사업자등록번호: 592-28-02229</p>
          <p style={{ marginTop: '4px' }}>곁에(gyeote) 서비스는 에브리홈이 운영합니다.</p>
        </footer>
      </body>
    </html>
  );
}