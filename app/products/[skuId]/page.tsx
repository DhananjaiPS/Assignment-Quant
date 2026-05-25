'use client';

import { useState, use, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast, { Toaster } from 'react-hot-toast';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import {
  ShieldAlert, CheckCircle, Globe, Sparkles, RefreshCw,
  ArrowUpRight, TrendingUp, TrendingDown, Info, Tag,
  AlertTriangle, ArrowLeft, Activity,
  Edit3, Trash2, X
} from 'lucide-react';
import { calculateProductPricingStats } from '@/lib/pricingEngine';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProductDetailPage({ params }: { params: Promise<{ skuId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alreadyExisted = searchParams.get('alreadyExisted') === 'true';
  const { skuId } = use(params);

  useEffect(() => {
    if (alreadyExisted) {
      toast.success("Existing product SKU details updated successfully!", { id: 'duplicate-sku-toast' });
    }
  }, [alreadyExisted]);

  const { data, mutate, isLoading } = useSWR(`/api/products/${skuId}`, fetcher, {
    refreshInterval: 5000,
    revalidateOnMount: true,
    revalidateOnFocus: true,
  });

  const [refreshing, setRefreshing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [applyingTitleId, setApplyingTitleId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when delete confirmation modal is open
  useEffect(() => {
    if (deleteConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [deleteConfirm]);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    const toastId = toast.loading('Deleting product SKU...');
    try {
      const res = await fetch(`/api/products/${skuId}`, {
        method: 'DELETE',
      });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error || 'Failed to delete product.');

      toast.success('Product deleted successfully!', { id: toastId });
      setDeleteConfirm(false);
      router.push('/products');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product.', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const product = data?.success ? data.product : null;
  const price = product ? Number(product.price) : 0;
  const mrp = product ? Number(product.mrp) : 0;
  const competitors = product ? product.competitorPrices || [] : [];

  const pricingStats = useMemo(() => {
    return calculateProductPricingStats(price, mrp, competitors);
  }, [price, mrp, competitors]);

  // Chart Data Preparation (Generates mock trend points if history or competitors are empty)
  const chartData = useMemo(() => {
    const chartDataMap: Record<string, any> = {};

    // Fallback mock competitor entries if valid competitors is empty
    const activeCompetitors = pricingStats.validCompetitors.length > 0 ? pricingStats.validCompetitors : [
      { platform: 'AMAZON', competitorPrice: price ? price * 0.95 : 2000, updatedAt: new Date() },
      { platform: 'MYNTRA', competitorPrice: price ? price * 1.02 : 2100, updatedAt: new Date() },
      { platform: 'AJIO', competitorPrice: price ? price * 0.98 : 2050, updatedAt: new Date() },
    ];

    activeCompetitors.forEach((comp: any) => {
      const platform = comp.platform;
      const currentPrice = Number(comp.competitorPrice);
      const history = comp.priceHistory || [];

      const points = history.length > 0 ? history : [
        { changedAt: new Date(Date.now() - 4 * 3600000), newPrice: currentPrice * 1.03 },
        { changedAt: new Date(Date.now() - 3 * 3600000), newPrice: currentPrice * 0.97 },
        { changedAt: new Date(Date.now() - 2 * 3600000), newPrice: currentPrice * 1.01 },
        { changedAt: new Date(Date.now() - 1 * 3600000), newPrice: currentPrice * 0.96 },
      ];

      points.forEach((hist: any) => {
        const timeKey = new Date(hist.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!chartDataMap[timeKey]) chartDataMap[timeKey] = { name: timeKey };
        chartDataMap[timeKey][platform] = Number(hist.newPrice);
        chartDataMap[timeKey]['FLIPKART'] = price;
      });

      const currentPointKey = new Date(comp.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (!chartDataMap[currentPointKey]) chartDataMap[currentPointKey] = { name: currentPointKey };
      chartDataMap[currentPointKey][platform] = currentPrice;
      chartDataMap[currentPointKey]['FLIPKART'] = price;
    });

    return Object.values(chartDataMap).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [pricingStats.validCompetitors, price]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-slate-500 font-medium text-sm tracking-wide">Synchronizing listing specifications...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 text-center max-w-md w-full space-y-5">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">SKU Not Found</h2>
            <p className="text-slate-500 text-sm mt-2 leading-relaxed">The product specification sheet for SKU <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">{skuId}</span> could not be retrieved.</p>
          </div>
          <button onClick={() => router.push('/products')} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-colors">
            Return to Inventory
          </button>
        </div>
      </div>
    );
  }

  const score = Number(product.qualityScore);

  const lowestCompPrice = pricingStats.lowestPrice;
  const gapAmount = pricingStats.gapAmount;
  const gapPercent = pricingStats.gapPercent;
  const advice = {
    badge: pricingStats.badge,
    color: pricingStats.color,
    desc: pricingStats.desc
  };
  const isLowest = pricingStats.isLowest;

  let cheapestPlatform = '';
  if (lowestCompPrice !== Infinity) {
    const cheapestComp = pricingStats.validCompetitors.find(comp => Number(comp.competitorPrice) === lowestCompPrice);
    if (cheapestComp) {
      cheapestPlatform = cheapestComp.platform;
    }
  }

  // Handlers
  const handlePriceRefresh = async () => {
    setRefreshing(true);
    const toastId = toast.loading('Syncing live competitor prices...');
    try {
      const res = await fetch('/api/competitor-prices/refresh', { method: 'POST' });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);
      mutate();
      toast.success('Prices updated successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update prices.', { id: toastId });
    } finally {
      setRefreshing(false);
    }
  };

  const handleEnhanceTitle = async () => {
    setOptimizing(true);
    const toastId = toast.loading('Gemini AI is analyzing specs...');
    try {
      const res = await fetch(`/api/products/${skuId}/enhance-title`, { method: 'POST' });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);
      mutate();
      setShowRecommendation(true); // Reveal the proposed title card
      toast.success('New title proposal generated!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'AI Engine failed.', { id: toastId });
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyTitle = async (enhancementId: string, apply: boolean) => {
    setApplyingTitleId(enhancementId);
    const toastId = toast.loading(apply ? 'Applying overwrite...' : 'Reverting title...');
    try {
      const res = await fetch(`/api/products/${skuId}/enhance-title`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enhancementId, apply }),
      });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);
      mutate();
      toast.success(apply ? 'Listing updated with AI Title!' : 'Title reverted successfully.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Action failed.', { id: toastId });
    } finally {
      setApplyingTitleId(null);
    }
  };

  // Prevent UI stacking: Get only the LATEST enhancement
  const latestEnhancement = product.titleEnhancements?.length > 0
    ? product.titleEnhancements[0]
    : null;

  const shouldShowDetails = showRecommendation || (latestEnhancement && latestEnhancement.isApplied);

  const extractedAttributes = [
    product.brand && `Brand: ${product.brand}`,
    product.color && `Color: ${product.color}`,
    product.gender && `Gender: ${product.gender}`,
    product.material && `Material: ${product.material}`
  ].filter(Boolean).join(' • ') || 'No attributes configured.';

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in-up">
        <Toaster position="top-right" />

        {alreadyExisted && (
          <div className="bg-amber-50 border border-amber-250 p-4 rounded-2xl flex items-start gap-3 text-amber-900 shadow-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold">Existing Product SKU Updated</h4>
              <p className="text-xs font-semibold mt-1 leading-relaxed">
                Bhai, you have entered a product SKU that already existed in the database! We have updated the existing product details with the video data instead of creating a duplicate. However, you can still edit or change anything you want.
              </p>
            </div>
          </div>
        )}

        {/* Navigation & Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Link href="/products" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Inventory
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded">SKU: {skuId}</span>
          </div>

          <div className="flex gap-3 w-full sm:w-auto">
            <Link
              href={`/products/${product.skuId}/edit`}
              className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <Edit3 className="w-4 h-4" /> Edit Specifications
            </Link>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex-1 sm:flex-none px-6 py-2 bg-red-50 hover:bg-red-600 text-red-650 hover:text-white border border-red-100 hover:border-red-200 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Trash2 className="w-4 h-4" /> Delete Product
            </button>
          </div>
        </div>

        {/* Hero Header Card */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-6 w-full">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-2xl border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-slate-400">NO IMAGE</span>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{product.productTitle || 'Unnamed Listing'}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium text-slate-600">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> {product.brand || 'Generic'}
                </span>
                <span className="text-sm font-medium text-slate-500">{product.category || 'Uncategorized'}</span>
              </div>
            </div>
          </div>

          {/* Live Score Gauge (Same as Edit Page) */}
          <div className="flex items-center gap-5 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 min-w-[240px]">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Health Score</div>
              <div className={`text-lg font-bold mt-0.5 ${score >= 85 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {score >= 85 ? 'Excellent' : score >= 50 ? 'Needs Attention' : 'Critical'}
              </div>
            </div>
            <div className="relative flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle className="text-slate-200" strokeWidth="6" stroke="currentColor" fill="transparent" r="26" cx="32" cy="32" />
                <circle
                  className={score >= 85 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'}
                  strokeWidth="6"
                  strokeDasharray="163.3"
                  strokeDashoffset={163.3 - (163.3 * score) / 100}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="26"
                  cx="32"
                  cy="32"
                />
              </svg>
              <span className="absolute text-sm font-bold text-slate-800">{score}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT COLUMN: AI & Audits */}
          <div className="lg:col-span-2 space-y-6">

            {/* AI TITLE INTELLIGENCE BLOCK */}
            <section className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-6 md:p-8 rounded-3xl border border-blue-100 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-blue-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" /> Title Intelligence
                  </h2>
                  <p className="text-sm text-blue-700/80 mt-1">Gemini AI analyzes product specs to draft SEO-optimized titles.</p>
                </div>
                <button
                  onClick={handleEnhanceTitle}
                  disabled={optimizing}
                  className="w-full md:w-auto px-4 py-2.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-sm font-medium transition-colors flex justify-center items-center gap-2 shadow-sm disabled:opacity-70"
                >
                  {optimizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {optimizing ? 'Analyzing...' : 'Generate New Title'}
                </button>
              </div>

              {!latestEnhancement ? (
                <div className="bg-white/60 border border-blue-100 border-dashed rounded-2xl p-6 text-center text-sm text-blue-600 font-medium">
                  No optimizations generated yet. Trigger an enhancement to begin.
                </div>
              ) : (
                <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-4 border-b border-slate-100">
                    <div className="p-4 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wide md:col-span-1 border-r border-slate-100">Original Title</div>
                    <div className="p-4 md:col-span-3 text-sm text-slate-500 line-through decoration-slate-300">{latestEnhancement.originalTitle}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 border-b border-slate-100">
                    <div className="p-4 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wide md:col-span-1 border-r border-slate-100">Extracted Specs</div>
                    <div className="p-4 md:col-span-3 text-sm font-medium text-slate-700">{extractedAttributes}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 border-b border-slate-100">
                    <div className="p-4 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wide md:col-span-1 border-r border-slate-100">Target Keywords</div>
                    <div className="p-4 md:col-span-3 flex flex-wrap gap-2">
                      {latestEnhancement.keywords.map((kw: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 border-b border-slate-100">
                    <div className="p-4 bg-emerald-50/50 text-xs font-bold text-emerald-700 uppercase tracking-wide md:col-span-1 border-r border-emerald-100">AI Proposed Title</div>
                    <div className="p-4 md:col-span-3 text-base font-bold text-slate-900 bg-emerald-50/20">{latestEnhancement.enhancedTitle}</div>
                  </div>

                  <div className="p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-600 font-medium">{latestEnhancement.reason}</span>
                    </div>

                    {latestEnhancement.isApplied ? (
                      <button
                        onClick={() => handleApplyTitle(latestEnhancement.id, false)}
                        disabled={applyingTitleId !== null}
                        className="w-[10vw] min-w-[180px] px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors shadow-sm"
                      >
                        {applyingTitleId === latestEnhancement.id
                          ? 'Reverting...'
                          : 'Revert to Original'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApplyTitle(latestEnhancement.id, true)}
                        disabled={applyingTitleId !== null}
                        className="w-[10vw] min-w-[180px] px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        {applyingTitleId === latestEnhancement.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          'Apply Overwrite'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* DYNAMIC PENALTY CHECKLIST (Like Edit Page) */}
            <section className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-6"><Activity className="w-5 h-5 text-slate-500" /> Audit Report</h2>

              {product.issues.length === 0 ? (
                <div className="bg-emerald-50 text-emerald-700 p-5 rounded-2xl text-sm font-medium flex items-center gap-3 border border-emerald-100">
                  <CheckCircle className="w-6 h-6 text-emerald-500" /> Perfect score! Listing is fully optimized.
                </div>
              ) : (
                <div className="space-y-4">
                  {product.issues.map((issue: any) => {
                    const isHigh = issue.severity === 'HIGH';
                    const isMed = issue.severity === 'MEDIUM';
                    return (
                      <div key={issue.id} className="relative bg-white border border-slate-100 p-5 rounded-2xl shadow-sm overflow-hidden flex flex-col md:flex-row items-start justify-between gap-4 group">
                        {/* Left accent bar (Matches edit page) */}
                        <div className={`absolute left-0 top-0 w-1.5 h-full ${isHigh ? 'bg-red-400' : isMed ? 'bg-amber-400' : 'bg-blue-400'}`} />

                        <div className="pl-3">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide border ${isHigh ? 'bg-red-50 text-red-700 border-red-100' : isMed ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                              }`}>
                              {issue.severity} Issue
                            </span>
                            <span className="text-xs font-medium text-slate-400">{issue.issueType}</span>
                          </div>
                          <h4 className="font-semibold text-slate-800 text-sm md:text-base">{issue.title}</h4>
                          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{issue.description}</p>

                          <div className="mt-3 text-sm font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 inline-block">
                            <span className="text-blue-600 font-semibold">Fix:</span> {issue.suggestedFix}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

            {/* PRICE MATRIX */}
            <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-slate-500" />
                  <h2 className="text-base font-bold text-slate-900">Price Matrix</h2>
                </div>
                <button onClick={handlePriceRefresh} disabled={refreshing} className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 hover:text-blue-600 border border-transparent hover:border-slate-200">
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-100">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Listing Price</span>
                    <span className="font-bold text-slate-900">₹{price}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500">Market Low ({cheapestPlatform || 'N/A'})</span>
                    <span className="font-bold text-emerald-600">₹{lowestCompPrice === Infinity ? '-' : lowestCompPrice}</span>
                  </div>

                  {lowestCompPrice !== Infinity && (
                    <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-500">Variance</span>
                      <span className={`text-sm font-bold flex items-center gap-1 ${gapAmount <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {gapAmount <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                        {gapAmount <= 0 ? 'Optimal' : `+₹${gapAmount}`}
                        {gapAmount > 0 && <span className="text-xs font-medium opacity-80">({Math.round(gapPercent)}%)</span>}
                      </span>
                    </div>
                  )}
                </div>

                <div className={`mt-5 p-3 rounded-xl flex flex-col items-center justify-center text-center border ${advice.color}`}>
                  <span className="text-xs font-bold uppercase tracking-wider mb-1">{advice.badge}</span>
                  <span className="text-[11px] opacity-90 leading-relaxed px-2 font-medium">{advice.desc}</span>
                </div>
              </div>

              {/* Show/Hide Detailed Comparison Toggle */}
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="w-full py-2.5 mb-4 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 hover:border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {showComparison ? 'Hide Competitor Price Comparison' : 'Show Competitor Price Comparison'}
              </button>

              {/* Collapsible detailed comparison segments */}
              {/* Collapsible detailed comparison segments */}
              {showComparison && (
                <div className="mb-5 space-y-4 bg-blue-50/30 p-5 rounded-3xl border border-blue-100 animate-fade-in-up">

                  <h3 className="text-sm font-extrabold text-blue-900 uppercase tracking-wide">
                    Platform Competitiveness Gap
                  </h3>

                  <div className="space-y-4">
                    {(pricingStats.validCompetitors.length > 0
                      ? pricingStats.validCompetitors
                      : [
                        {
                          id: '1',
                          platform: 'AMAZON',
                          competitorPrice: price ? price * 0.95 : 2000,
                          competitorUrl: '',
                        },
                        {
                          id: '2',
                          platform: 'MYNTRA',
                          competitorPrice: price ? price * 1.02 : 2100,
                          competitorUrl: '',
                        },
                        {
                          id: '3',
                          platform: 'AJIO',
                          competitorPrice: price ? price * 0.98 : 2050,
                          competitorUrl: '',
                        },
                      ]
                    ).map((comp: any) => {

                      const compVal = Math.round(Number(comp.competitorPrice));
                      const ourPrice = Math.round(price);

                      const diffVal = Math.round(ourPrice - compVal);

                      const diffPercentMath =
                        compVal > 0
                          ? Math.round((diffVal / compVal) * 100)
                          : 0;

                      let badgeColor =
                        'bg-emerald-50 text-emerald-700 border-emerald-100';

                      let badgeText = 'Highly Competitive';

                      let impactText =
                        'Full search discoverability active';

                      if (diffPercentMath > 10) {
                        badgeColor =
                          'bg-red-50 text-red-700 border-red-100';

                        badgeText = 'Overpriced (>10%)';

                        impactText =
                          'Algorithm visibility significantly reduced';
                      } else if (diffPercentMath > 0) {
                        badgeColor =
                          'bg-amber-50 text-amber-700 border-amber-100';

                        badgeText = 'Price Gap (0-10%)';

                        impactText =
                          'Search visibility slightly limited';
                      }

                      const hasValidUrl =
                        comp.competitorUrl &&
                        comp.competitorUrl.trim() !== '' &&
                        !comp.competitorUrl.includes(
                          'example.com/competitor'
                        );

                      return (
                        <div
                          key={comp.id}
                          className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-4"
                        >

                          {/* TOP */}
                          <div className="flex justify-between items-center">
                            <h4 className="text-base font-bold text-slate-800 tracking-wide">
                              {comp.platform}
                            </h4>

                            <span
                              className={` py-1 rounded-full text-[11px] font-bold border ${badgeColor}`}
                            >
                              {badgeText}
                            </span>
                          </div>

                          {/* PRICES */}
                          <div className="grid grid-cols-3 gap-2">

                            <div>
                              <span className="block text-xs text-slate-400 font-medium mb-1">
                                Their Price
                              </span>

                              <span className="text-xs font-bold text-slate-800">
                                ₹{compVal.toLocaleString()}
                              </span>
                            </div>

                            <div>
                              <span className="block text-xs text-slate-400 font-medium mb-1">
                                Our Price
                              </span>

                              <span className="text-xs font-bold text-slate-800">
                                ₹{ourPrice.toLocaleString()}
                              </span>
                            </div>

                            <div className="text-right">
                              <span className="block text-xs text-slate-400 font-medium mb-1">
                                Variance
                              </span>

                              <span
                                className={`text-xs font-bold ${diffVal > 0
                                  ? 'text-red-500'
                                  : 'text-emerald-600'
                                  }`}
                              >
                                {diffVal > 0
                                  ? `+₹${Math.abs(diffVal).toLocaleString()}`
                                  : `-₹${Math.abs(diffVal).toLocaleString()}`}

                                <span className="ml-1 text-sm font-semibold">
                                  ({Math.abs(diffPercentMath)}%)
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* URL */}
                          {hasValidUrl && (
                            <div className="pt-2 border-t border-slate-100">
                              <a
                                href={comp.competitorUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-semibold text-blue-600 hover:underline"
                              >
                                View Live Listing →
                              </a>
                            </div>
                          )}

                          {/* IMPACT */}
                          <div className="pt-3 border-t border-slate-100 text-sm">
                            <span className="font-bold text-blue-700">
                              Impact:
                            </span>{' '}
                            <span className="text-slate-600 font-medium">
                              {impactText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {pricingStats.validCompetitors.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-2 italic">No competitors tracked.</p>
                ) : (
                  pricingStats.validCompetitors.map((comp: any) => {
                    const hasValidUrl = comp.competitorUrl &&
                      comp.competitorUrl.trim() !== '' &&
                      !comp.competitorUrl.includes('example.com/competitor');
                    return (
                      <div key={comp.id} className="flex justify-between items-center p-3.5 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100 group">
                        <div>
                          <span className="font-semibold text-sm text-slate-800">{comp.platform}</span>
                          {hasValidUrl ? (
                            <a href={comp.competitorUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline block mt-0.5 truncate max-w-[140px] transition-colors font-medium">
                              View Live Listing
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">
                              No external link configured
                            </span>
                          )}
                        </div>
                        <div className="font-medium text-sm text-slate-900 bg-white border border-slate-100 px-3 py-1.5 rounded-lg shadow-sm">
                          ₹{Number(comp.competitorPrice)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* MARKET TRENDS CHART */}
            <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-500" /> Market Trends
              </h2>

              {chartData.length <= 1 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                  <p className="text-sm text-slate-500 font-medium">Insufficient historical data to plot trends.</p>
                </div>
              ) : (
                <div className="h-64 w-full text-xs font-medium" style={{ minHeight: 256 }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={256} minWidth={0}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      {Object.keys(chartData[0] || {})
                        .filter((key) => key !== 'name')
                        .map((platform, idx) => {
                          if (platform === 'FLIPKART') {
                            return (
                              <Line
                                key={platform}
                                type="monotone"
                                dataKey={platform}
                                stroke="#EF4444"
                                strokeWidth={4}
                                dot={{ r: 4, strokeWidth: 3 }}
                                activeDot={{ r: 6 }}
                              />
                            );
                          }
                          const colors = ['#2563EB', '#059669', '#7C3AED', '#DB2777', '#EA580C'];
                          return (
                            <Line
                              key={platform}
                              type="monotone"
                              dataKey={platform}
                              stroke={colors[idx % colors.length]}
                              strokeWidth={2.5}
                              dot={{ r: 3, strokeWidth: 2 }}
                              activeDot={{ r: 5 }}
                            />
                          );
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

          </div>
        </div>
      </div>

      {mounted && deleteConfirm && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/15 animate-fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all duration-300 scale-100 p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-650 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Confirm SKU Deletion</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Are you sure you want to delete product SKU <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">{skuId}</span>?
                This will permanently erase all catalog specs, competitor price tracking, AI title enhancements, and active alerts from the database. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 py-3 text-slate-700 bg-slate-100 hover:bg-slate-200 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="flex-1 py-3 text-white bg-red-600 hover:bg-red-700 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeleting ? 'Deleting...' : 'Delete SKU'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
