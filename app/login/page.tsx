'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-[420px]">

        {/* Branding */}
        <div className="mb-10 text-center">
          <h1 className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-5xl font-black text-transparent">
            Quantacus
          </h1>
          <p className="mt-3 text-slate-500">
            Welcome back. Please sign in to continue.
          </p>
        </div>

        {/* Clerk Container - Minimalist Style */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]">
          <SignIn
            routing="hash"
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: '!bg-transparent !shadow-none !border-0',
                formFieldInput:
                  '!h-12 !rounded-xl !border-slate-200 !bg-slate-50 !text-slate-800 focus:!border-blue-500 focus:!ring-4 focus:!ring-blue-500/10 transition-all',
                formButtonPrimary:
                  '!h-12 !rounded-xl !bg-slate-900 hover:!bg-slate-800 !text-white !font-medium !shadow-none transition-all',
                socialButtonsBlockButton:
                  '!h-12 !rounded-xl !border-slate-200 !bg-white hover:!bg-slate-50 transition-all',
                socialButtonsBlockButtonText: '!text-slate-700 !font-medium',
                dividerLine: '!bg-slate-200',
                dividerText: '!text-slate-400',
                formFieldLabel: '!text-slate-600 !font-medium',
                footerActionText: '!text-slate-500',
                footerActionLink: '!text-blue-600 hover:!text-blue-700',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
              },
            }}
          />
        </div>

        {/* Recruiter Bypass Callout */}
        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>👉 Recruiter Demo Access (Skip Login)</span>
          </Link>
          <p className="mt-2.5 text-xs text-slate-400 font-semibold">
            Bypass login and explore the dashboard immediately.
          </p>
        </div>
      </div>
    </div>
  );
}