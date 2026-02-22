import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ErrorBoundary from "@/components/ErrorBoundary";
import Starfield from "@/components/Starfield";
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
  title: "What If...? Heritage — Alternate History Simulator",
  description:
    "Explore alternate realities. Input a what-if scenario and watch branching timelines unfold, powered by K2 Think V2.",
  metadataBase: new URL("https://what-if-heritage.vercel.app"),
  openGraph: {
    title: "What If...? Heritage",
    description:
      "Interactive alternate history simulator. Explore branching timelines of consequences.",
    type: "website",
    siteName: "What If...? Heritage",
  },
  twitter: {
    card: "summary_large_image",
    title: "What If...? Heritage",
    description: "Interactive alternate history simulator powered by K2 Think V2.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-violet-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Starfield />
        <div id="main-content">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
