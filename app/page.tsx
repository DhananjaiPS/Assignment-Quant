'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  X,
  FileVideo,
  Sparkles,
  TrendingUp,
  BellRing,
  Webhook,
  Activity,
  ShieldCheck,
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [showSteps, setShowSteps] = useState(false);

  const features = [
    {
      title: 'Video-to-Draft AI Extractor',
      desc: 'Upload product showcase videos to automatically extract attributes, brands, sizes, colors, and materials using Google Cloud Vision frame-level intelligence.',
      icon: FileVideo,
      color: 'text-blue-600 bg-blue-50 border-blue-100',
    },
    {
      title: 'Outlier-Free Pricing Engine',
      desc: 'Automatically checks competitor prices across Amazon, Myntra, Ajio, Meesho, and Tata Cliq, filtering out outlier prices (<10% of MRP) to calculate stable median price gaps.',
      icon: TrendingUp,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    {
      title: 'Gemini SEO Title Optimizer',
      desc: 'Use Gemini AI Title Intelligence to generate keyword-position-optimized, search-ready titles based on extracted listing attributes.',
      icon: Sparkles,
      color: 'text-purple-600 bg-purple-50 border-purple-100',
    },
    {
      title: 'Active Alert Inbox',
      desc: 'Get notified immediately of severe catalog warnings, validation errors, and critical competitor price drop variances.',
      icon: BellRing,
      color: 'text-rose-600 bg-rose-50 border-rose-100',
    },
    {
      title: 'Webhook Subscriptions',
      desc: 'Integrate external client nodes by subscribing to live event triggers for catalog changes and pricing syncs.',
      icon: Webhook,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      title: 'Real-Time Jobs Queue',
      desc: 'Track asynchronous workers, frame extraction, and imports with live logs.',
      icon: Activity,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
    },
  ];

  return (
    <div className="space-y-12 pb-16 animate-fade-in-up">

      {/* HERO */}
      <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200/80 shadow-md bg-white">
        <img
          src="/hero10.png"
          alt="Landing Hero"
          className="w-full h-auto block pointer-events-none"
        />

        <div className="absolute left-[4.36%] top-[78%] w-[42%] flex gap-2 z-30">
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center bg-blue-600 text-white font-extrabold rounded-xl text-xs sm:text-sm py-2 shadow-md"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>

      {/* FEATURES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feat, i) => {
          const Icon = feat.icon;
          return (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition"
            >
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${feat.color}`}
              >
                <Icon className="w-6 h-6" />
              </div>

              <h3 className="font-bold text-slate-800">{feat.title}</h3>
              <p className="text-xs text-slate-500 mt-2">{feat.desc}</p>
            </div>
          );
        })}
      </div>

      {/* TRUST SECTION (UPDATED WITH IMAGES) */}
      <div className="bg-slate-50 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">

        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Platform Security & Accuracy Guard
          </h3>
          <p className="text-xs text-slate-500">
            Integrated with major e-commerce platforms for reliable market insights.
          </p>
        </div>

        {/* BRAND LOGOS ONLY (NO BOX, BIGGER CLEAN LOOK) */}
        <div className="flex gap-10 flex-wrap justify-center items-center">

          <img
            src="/amzon.png"
            alt="Amazon"
            className="w-24 h-18 object-contain hover:scale-110 transition-transform"
          />

          <img
            src="/myntra.png"
            alt="Myntra"
            className="w-14 h-14 object-contain hover:scale-110 transition-transform"
          />

          <img
            src="/ajio.png"
            alt="Ajio"
            className="w-24 h-18 object-contain hover:scale-110 transition-transform"
          />

          <img
            src="/nykaa.png"
            alt="Nykaa"
            className="w-24 h-18 object-contain hover:scale-110 transition-transform"
          />

        </div>
      </div>

    </div>
  );
}