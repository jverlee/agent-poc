import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { people } from "@/lib/people";
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
        <div className="flex min-h-screen">
          <nav className="w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="p-6 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Workmate
            </div>
            <ul className="flex flex-col gap-1 px-3">
              {people.map((person) => (
                <li key={person.name}>
                  <a
                    href={`/?app=${person.appName}&machine=${person.machineId}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <img src={person.avatar} alt={person.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    <div className="flex flex-col">
                      <span>{person.name}</span>
                      <span className="text-xs font-normal text-zinc-500 dark:text-zinc-500">{person.role}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
