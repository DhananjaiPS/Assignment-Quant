import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quantacus - Product Intelligence Dashboard",
  description: "Advanced listing auditor, competitor pricing analyzer, and seller title optimizer for marketplaces.",
};

import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-white text-[#0F172A]">
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 animate-fade-in-up">
            {children}
          </main>
          <Toaster position="top-right" reverseOrder={false} />
        <footer className="bg-white border-t border-slate-200 mt-auto">
          <div className="max-w-7xl mx-auto px-6 py-12 md:py-16 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-4">
              <div className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                Quantacus <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full border border-blue-100">PRO</span>
              </div>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-sm">
                Advanced listing auditor, outlier-free competitor pricing analyzer, and seller title optimizer engineered for next-generation marketplace merchants.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Platform</h4>
              <ul className="space-y-2 text-xs font-bold text-slate-500">
                <li><Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link></li>
                <li><Link href="/upload" className="hover:text-blue-600 transition-colors">Ingestion Hub</Link></li>
                <li><Link href="/jobs" className="hover:text-blue-600 transition-colors">Jobs Queue</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Intelligence</h4>
              <ul className="space-y-2 text-xs font-bold text-slate-500">
                <li><Link href="/products" className="hover:text-blue-600 transition-colors">Inventory Catalog</Link></li>
                <li><Link href="/alerts" className="hover:text-blue-600 transition-colors">Active Alerts</Link></li>
                <li><Link href="/webhooks" className="hover:text-blue-600 transition-colors">Webhooks API</Link></li>
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-6 py-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] text-slate-400 font-bold">
            <div>
              © 2026 Quantacus. Optimized for Flipkart Seller Listing Intelligence.
            </div>
            <div className="flex gap-4">
              <span>Secure Connection Active</span>
              <span>•</span>
              <span>Version 1.0.0</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
    </ClerkProvider>
  );
}
