'use client';

import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import {
  Search, ShoppingBag, ShieldAlert, Sparkles, Filter, CheckCircle2,
  AlertTriangle, ArrowUpRight, Shirt, Footprints, Briefcase, Watch,
  Package, Droplets, Smartphone, Laptop, Home, Dumbbell, Sparkle, RefreshCw,
  Trash2, X
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ======================================================
// CUSTOM HOOK: DEBOUNCE
// Saves massive backend costs by delaying search API calls
// ======================================================
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function ProductsPage() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [availability, setAvailability] = useState('ALL');
  const [quality, setQuality] = useState('ALL');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 500);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, availability, quality]);

  // Lock body scroll when delete confirmation modal is open
  useEffect(() => {
    if (deleteId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [deleteId]);

  // ======================================================
  // SWR DATA FETCH
  // ======================================================
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `/api/products?search=${encodeURIComponent(debouncedSearch)}&category=${category}&availability=${availability}&quality=${quality}&page=${page}&limit=10`,
    fetcher,
    {
      keepPreviousData: true, // Prevents UI flicker on filter change
      dedupingInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    const toastId = toast.loading('Deleting product...');
    try {
      const res = await fetch(`/api/products/${deleteId}`, {
        method: 'DELETE',
      });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error || 'Failed to delete product.');
      
      toast.success('Product deleted successfully!', { id: toastId });
      setDeleteId(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product.', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const products = data?.success ? data.products : [];
  const stats = data?.success ? data.stats : {
    totalCount: 0, lowQualityCount: 0, mediumQualityCount: 0, highQualityCount: 0,
  };

  // ======================================================
  // UTILS & HELPERS
  // ======================================================
  const getCategoryIcon = (catString: string) => {
    const cat = catString?.toLowerCase() || '';
    if (cat.includes('shirt') || cat.includes('apparel') || cat.includes('fashion')) return <Shirt className="w-5 h-5" />;
    if (cat.includes('shoe') || cat.includes('footwear')) return <Footprints className="w-5 h-5" />;
    if (cat.includes('bag') || cat.includes('luggage')) return <Briefcase className="w-5 h-5" />;
    if (cat.includes('watch') || cat.includes('accessories')) return <Watch className="w-5 h-5" />;
    if (cat.includes('beauty') || cat.includes('skincare')) return <Droplets className="w-5 h-5" />;
    if (cat.includes('mobile') || cat.includes('phone')) return <Smartphone className="w-5 h-5" />;
    if (cat.includes('laptop') || cat.includes('electronics')) return <Laptop className="w-5 h-5" />;
    if (cat.includes('fitness') || cat.includes('gym')) return <Dumbbell className="w-5 h-5" />;
    if (cat.includes('home') || cat.includes('kitchen')) return <Home className="w-5 h-5" />;
    return <Package className="w-5 h-5" />;
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getQualityLabel = (score: number) => {
    if (score >= 85) return 'Excellent';
    if (score >= 50) return 'Needs Attention';
    return 'Critical';
  };

  const dynamicCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p: any) => p.category && set.add(p.category));
    return Array.from(set);
  }, [products]);

  return (
    <>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in-up">
        <Toaster position="top-right" />

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkle className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            Inventory Catalog
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm md:text-base font-medium">
            AI-powered marketplace catalog intelligence dashboard.
          </p>
        </div>
        <Link
          href="/upload"
          className="w-full sm:w-auto flex justify-center items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
        >
          <Sparkles className="w-4 h-4" /> Ingest New SKU
        </Link>
      </div>

      {/* ====================================================== */}
      {/* SUMMARY CARDS (Responsive Grid) */}
      {/* ====================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Listings</span>
          <div className="text-3xl font-bold text-slate-800 mt-1">{stats.totalCount}</div>
        </div>
        <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider">Excellent</span>
          <div className="text-3xl font-bold text-emerald-700 mt-1">{stats.highQualityCount}</div>
        </div>
        <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-100 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-amber-600 font-bold uppercase tracking-wider">Needs Attention</span>
          <div className="text-3xl font-bold text-amber-700 mt-1">{stats.mediumQualityCount}</div>
        </div>
        <div className="p-5 rounded-2xl bg-red-50/50 border border-red-100 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-red-600 font-bold uppercase tracking-wider">Critical</span>
          <div className="text-3xl font-bold text-red-700 mt-1">{stats.lowQualityCount}</div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* FILTER PANEL */}
      {/* ====================================================== */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 md:p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* SEARCH */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-4" />
            <input
              type="text"
              placeholder="Search title, SKU, brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl pl-11 pr-10 py-3 text-slate-800 text-sm focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none font-medium transition-all"
            />
            {isValidating && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin absolute right-4" />}
          </div>

          {/* CATEGORY */}
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl px-4 py-1 transition-colors">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-transparent border-none text-slate-700 text-sm focus:outline-none py-2.5 font-medium cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {dynamicCategories.map((cat: string) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          {/* AVAILABILITY */}
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl px-4 py-1 transition-colors">
            <ShoppingBag className="w-4 h-4 text-slate-400" />
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full bg-transparent border-none text-slate-700 text-sm focus:outline-none py-2.5 font-medium cursor-pointer"
            >
              <option value="ALL">All Stock Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
              <option value="PRE_ORDER">Pre Order</option>
            </select>
          </div>

          {/* QUALITY */}
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-100 rounded-xl px-4 py-1 transition-colors">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="w-full bg-transparent border-none text-slate-700 text-sm focus:outline-none py-2.5 font-medium cursor-pointer"
            >
              <option value="ALL">All Health Scores</option>
              <option value="HIGH">Excellent</option>
              <option value="MEDIUM">Needs Attention</option>
              <option value="LOW">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* ====================================================== */}
      {/* TABLE (Mobile Responsive Scroll) */}
      {/* ====================================================== */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm relative overflow-hidden">

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {/* Scroll wrapper for mobile */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[28%]">Product Info</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[11%]">SKU ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[9%]">Selling Price</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[8%]">MRP</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[10%]">Stock</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center w-[14%]">Health</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-[20%]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">

              {error && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-red-500 font-medium">
                    Failed to load inventory. Please check your connection.
                  </td>
                </tr>
              )}

              {!isLoading && !error && products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-800 font-semibold text-base">No products found.</p>
                    <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search terms.</p>
                  </td>
                </tr>
              )}

              {products.map((prod: any) => {
                const score = Number(prod.qualityScore || 0);
                const unresolvedIssuesCount = prod?.issues?.filter((i: any) => !i.isResolved)?.length || 0;

                return (
                  <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors group border-b border-slate-100/60">

                    {/* PRODUCT COLUMN */}
                    <td className="px-6 py-5 align-middle">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl border border-slate-100 shadow-sm overflow-hidden flex-shrink-0 bg-slate-50 flex items-center justify-center">
                          {prod.imageUrl ? (
                            <img src={prod.imageUrl} alt={prod.productTitle || 'Product'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              {getCategoryIcon(prod.category)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col gap-1">
                          <Link 
                            href={`/products/${prod.skuId}`} 
                            className="font-semibold text-slate-900 hover:text-blue-600 block truncate text-sm transition-colors" 
                            title={prod.productTitle || 'Unnamed Product'}
                          >
                            {prod.productTitle || 'Unnamed Product'}
                          </Link>
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]" title={prod.brand || 'No Brand'}>{prod.brand || 'No Brand'}</span>
                            <span className="text-[11px] text-blue-600 font-medium truncate max-w-[150px]" title={prod.category || 'Uncategorized'}>{prod.category || 'Uncategorized'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SKU COLUMN */}
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-md whitespace-nowrap inline-block">
                        {prod.skuId}
                      </span>
                    </td>

                    {/* PRICE COLUMN */}
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      {prod.price ? (
                        <span className="font-bold text-slate-900 whitespace-nowrap">₹{Number(prod.price).toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-red-500 text-xs font-semibold bg-red-50 px-2 py-1 rounded-md whitespace-nowrap">Unpriced</span>
                      )}
                    </td>

                    {/* MRP COLUMN */}
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      {prod.mrp ? (
                        <span className="text-slate-500 font-medium line-through whitespace-nowrap">₹{Number(prod.mrp).toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-slate-300 whitespace-nowrap">-</span>
                      )}
                    </td>

                    {/* STOCK COLUMN */}
                    <td className="px-6 py-5 align-middle whitespace-nowrap">
                      <span
                        className={`inline-flex items-center whitespace-nowrap px-3 py-1 rounded-md text-[11px] font-bold border capitalize ${prod.availability === 'IN_STOCK'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : prod.availability === 'OUT_OF_STOCK'
                            ? 'bg-red-50 text-red-700 border-red-100'
                            : 'bg-amber-50 text-amber-700 border-amber-100'
                          }`}
                      >
                        {prod.availability?.replaceAll('_', ' ')}
                      </span>
                    </td>
                    
                    {/* QUALITY COLUMN */}
                    <td className="px-6 py-5 align-middle text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${getScoreColorClass(score)}`}>
                          {score < 50 ? <AlertTriangle className="w-3.5 h-3.5" /> : score < 85 ? <ShieldAlert className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {score}%
                        </span>
                        <div className="text-[10px] font-medium text-slate-500 whitespace-nowrap">
                          {getQualityLabel(score)} {unresolvedIssuesCount > 0 && <span className="text-red-500 ml-1">({unresolvedIssuesCount} issues)</span>}
                        </div>
                      </div>
                    </td>

                    {/* ACTIONS COLUMN */}
                    <td className="px-6 py-5 align-middle text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        <Link
                          href={`/products/${prod.skuId}`}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-slate-900 transition-all shadow-sm"
                        >
                          Audit Details
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteId(prod.skuId)}
                          className="inline-flex items-center justify-center p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-100 rounded-xl transition-all shadow-sm whitespace-nowrap"
                          title="Delete Listing"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {data?.success && data.totalPages > 1 && (
          <div className="flex justify-between items-center bg-white border-t border-slate-100 px-6 py-4 flex-wrap gap-4">
            <span className="text-xs font-semibold text-slate-500">
              Showing page {page} of {data.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              
              {Array.from({ length: data.totalPages }, (_, index) => {
                const pNum = index + 1;
                if (
                  pNum === 1 ||
                  pNum === data.totalPages ||
                  (pNum >= page - 1 && pNum <= page + 1)
                ) {
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        page === pNum
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                } else if (pNum === page - 2 || pNum === page + 2) {
                  return <span key={pNum} className="text-slate-400 text-xs px-1">...</span>;
                }
                return null;
              })}

              <button
                disabled={page === data.totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, data.totalPages))}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* ====================================================== */}
      {/* DELETION CONFIRMATION MODAL */}
      {/* ====================================================== */}
      {mounted && deleteId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/15 animate-fade-in">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all duration-300 scale-100 p-6 space-y-6">
            <div className="flex justify-between items-start">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-650 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <button 
                onClick={() => setDeleteId(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Confirm SKU Deletion</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Are you sure you want to delete product SKU <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">{deleteId}</span>? 
                This will permanently erase all catalog specs, historical competitor prices, title enhancements, and alert logs from the database. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteId(null)}
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