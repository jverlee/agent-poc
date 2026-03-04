import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { SidebarNav } from "@/components/sidebar-nav";
import { StatusProvider } from "@/components/status-provider";
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
  title: "Workmate",
  description: "Interactive terminal for Fly.io machines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StatusProvider>
        <div className="flex min-h-screen">
          <nav className="w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="p-6 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Workmate
            </div>
            <Suspense>
              <SidebarNav />
            </Suspense>
          </nav>
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
        </StatusProvider>
      </body>
    </html>
  );
}
