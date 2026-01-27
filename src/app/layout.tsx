import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import ollaIcon from "./olla-icon.jpeg";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Olla Crew",
  description: "클라이밍 소모임 출석/멤버 관리",
  icons: {
    icon: ollaIcon.src,
  },
  openGraph: {
    title: "Olla Crew",
    description: "클라이밍 소모임 출석/멤버 관리",
    images: [ollaIcon.src],
  },
  twitter: {
    card: "summary_large_image",
    title: "Olla Crew",
    description: "클라이밍 소모임 출석/멤버 관리",
    images: [ollaIcon.src],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="bottom-center" offset={{ bottom: 96 }} />
      </body>
    </html>
  );
}
