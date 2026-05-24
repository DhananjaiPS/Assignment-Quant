'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import {
  Save, XCircle, AlertTriangle, CheckCircle2, RefreshCw,
  Sparkles, Image as ImageIcon, Tag, Activity, Globe, Info, Edit3
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Real-time Rule Engine (Deterministic Scoring)
const calculateLiveScore = (draft: any) => {
  let score = 100;
  const violations = [];

  if (!draft.productTitle) { score -= 40; violations.push({ rule: 'Missing Title', penalty: 40, fix: 'Add a clear product title.' }); }
  else if (draft.productTitle.length < 15) { score -= 15; violations.push({ rule: 'Very Short Title', penalty: 15, fix: 'Incorporate brand, category, and sizing.' }); }

  if (!draft.brand || draft.brand === 'Unknown') { score -= 10; violations.push({ rule: 'Missing Brand Name', penalty: 10, fix: 'Add brand or explicitly mark as Generic.' }); }

  if (!draft.price || Number(draft.price) <= 0) { score -= 30; violations.push({ rule: 'Invalid Price', penalty: 30, fix: 'Set a positive numeric value for selling price.' }); }

  if (Number(draft.mrp) > 0 && Number(draft.price) > Number(draft.mrp)) { score -= 30; violations.push({ rule: 'MRP Lower than Price', penalty: 30, fix: 'Correct the MRP or reduce selling price.' }); }

  if (!draft.imageUrl) { score -= 25; violations.push({ rule: 'Missing Image URL', penalty: 25, fix: 'Provide a valid image link.' }); }
  else if (!draft.imageUrl.startsWith('http') && !draft.imageUrl.startsWith('/')) { score -= 10; violations.push({ rule: 'Malformed Image URL', penalty: 10, fix: 'Provide a valid absolute link.' }); }

  if (!draft.description || draft.description.length < 50) { score -= 10; violations.push({ rule: 'Weak Description', penalty: 10, fix: 'Expand detailed specifications.' }); }

  if (!draft.color || !draft.size || !draft.material || !draft.gender) { score -= 15; violations.push({ rule: 'Missing Attributes', penalty: 15, fix: 'Provide color, size, material, and gender.' }); }

  if (draft.availability === 'OUT_OF_STOCK') { score -= 5; violations.push({ rule: 'Product Out of Stock', penalty: 5, fix: 'Update inventory levels.' }); }

  return { score: Math.max(0, score), violations };
};

export default function ProductEditPage({ params }: { params: Promise<{ skuId: string }> }) {
  const router = useRouter();
  const { skuId } = use(params);

  // 1. SWR CACHING (Production Grade)
  // dedupingInterval: 60000 ensures we don't refetch the same data within 60 seconds.
  const { data, isLoading } = useSWR(`/api/products/${skuId}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const [draft, setDraft] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [newCompetitor, setNewCompetitor] = useState({ platform: '', price: '', url: '' });

  // Initialize draft when data loads
  useEffect(() => {
    if (data?.success && data?.product && !draft) {
      const productData = { ...data.product };
      // Map competitorPrices to competitorPricing if not present
      if (productData.competitorPrices && !productData.competitorPricing) {
        productData.competitorPricing = productData.competitorPrices.map((cp: any) => ({
          platform: cp.platform,
          price: cp.competitorPrice,
          url: cp.competitorUrl,
          id: cp.id,
        }));
      }
      setDraft(productData);
    }
  }, [data]);

  // Real-time calculated score based on UI edits
  const { score: liveScore, violations } = useMemo(() => calculateLiveScore(draft || {}), [draft]);

  if (isLoading || !draft) {
    return <div className="flex items-center justify-center h-screen"><RefreshCw className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleInputChange = (field: string, value: string | number) => {
    setDraft((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const loadingToast = toast.loading('Saving catalog updates...');
    try {
      const res = await fetch(`/api/products/${skuId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, qualityScore: liveScore }),
      });
      const result = await res.json();

      if (!result.success) throw new Error(result.error);

      // Optimistic UI Update in SWR Cache
      mutate(`/api/products/${skuId}`, { success: true, product: result.product }, false);
      toast.success('Product updated successfully!', { id: loadingToast });
      
      // Delay navigation slightly so user sees the success toast
      setTimeout(() => {
        router.push(`/products/${skuId}`);
      }, 1000);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`, { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    if (window.confirm('⚠️ Are you sure you want to revert? All unsaved edits will be lost.')) {
      const productData = { ...data.product };
      if (productData.competitorPrices) {
        productData.competitorPricing = productData.competitorPrices.map((cp: any) => ({
          platform: cp.platform,
          price: cp.competitorPrice,
          url: cp.competitorUrl,
          id: cp.id,
        }));
      }
      setDraft(productData);
      toast.success('Reverted to original data.');
    }
  };

  const handleOptimizeTitle = async () => {
    setIsOptimizing(true);
    const toastId = toast.loading('Gemini AI is analyzing product data...');
    try {
      const res = await fetch(`/api/products/${skuId}/enhance-title`, {
        method: 'POST',
      });
      const aiData = await res.json();

      if (!aiData.success) throw new Error(aiData.error || 'AI Engine failed to generate title.');

      // Fetch the latest generated enhancement to prefill it or mutate
      mutate(`/api/products/${skuId}`);
      
      // Show instructions on details page to apply it
      toast.success('Title enhancement generated! You can apply it on the specs detail page.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!newCompetitor.platform || !newCompetitor.price) return toast.error('Platform and Price required');
    const competitorObj = { ...newCompetitor, id: Date.now() };
    setDraft((prev: any) => ({
      ...prev,
      competitorPricing: [...(prev.competitorPricing || []), competitorObj]
    }));
    setNewCompetitor({ platform: '', price: '', url: '' });
    toast.success('Competitor added to local draft.');
  };

  const handleRemoveCompetitor = (id: any) => {
    setDraft((prev: any) => ({
      ...prev,
      competitorPricing: (prev.competitorPricing || []).filter((c: any) => c.id !== id)
    }));
    toast.success('Competitor removed from local draft.');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up pb-20">
      <Toaster position="top-right" />

      {/* HEADER & SCORECARD */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Edit3 className="w-6 h-6 text-blue-600" /> Catalog Editor
          </h1>
          <p className="text-slate-500 font-semibold text-sm">SKU: <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{skuId}</span></p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Quality Score</div>
            <div className={`text-3xl font-black ${liveScore >= 100 ? 'text-emerald-600' : liveScore >= 70 ? 'text-amber-500' : 'text-red-650'}`}>
              {liveScore}%
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleRevert} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold rounded-lg transition-all text-sm">
              Discard Changes
            </button>
            <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 shadow-md font-bold rounded-lg transition-all text-sm disabled:opacity-50">
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save & Publish
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: EDIT FORM */}
        <div className="lg:col-span-2 space-y-6">

          {/* AI TITLE OPTIMIZER BLOCK */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-extrabold text-blue-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" /> Title Optimization Engine
                </h3>
                <p className="text-xs text-blue-700 font-medium">Triggers Gemini AI analysis of descriptions & attributes to draft SEO keywords.</p>
              </div>
              <button onClick={handleOptimizeTitle} disabled={isOptimizing} className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50">
                {isOptimizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate AI Title Proposal
              </button>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-100">
              <label className="text-[10px] uppercase font-bold text-slate-400">Current / Draft Title</label>
              <input
                type="text"
                value={draft.productTitle || ''}
                onChange={(e) => handleInputChange('productTitle', e.target.value)}
                className="w-full mt-1 text-sm font-bold text-slate-800 border-none focus:ring-0 p-0 outline-none"
              />
            </div>
          </div>

          {/* MASTER FORM */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500">Description</label>
              <textarea rows={4} value={draft.description || ''} onChange={(e) => handleInputChange('description', e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-semibold text-slate-700" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Brand</label>
              <input type="text" value={draft.brand || ''} onChange={(e) => handleInputChange('brand', e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 outline-none font-bold text-slate-700" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Category</label>
              <input type="text" value={draft.category || ''} onChange={(e) => handleInputChange('category', e.target.value)} className="w-full mt-1 border border-slate-200 rounded-lg p-3 text-sm focus:border-blue-500 outline-none font-bold text-slate-700" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">Selling Price (₹)</label>
              <input type="number" value={draft.price || ''} onChange={(e) => handleInputChange('price', Number(e.target.value))} className="w-full mt-1 border border-slate-200 rounded-lg p-3 text-sm font-mono focus:border-blue-500 outline-none font-bold text-slate-700" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">MRP (₹)</label>
              <input type="number" value={draft.mrp || ''} onChange={(e) => handleInputChange('mrp', Number(e.target.value))} className="w-full mt-1 border border-slate-200 rounded-lg p-3 text-sm font-mono focus:border-blue-500 outline-none font-bold text-slate-700" />
            </div>

            {/* Attributes */}
            <div className="col-span-2 grid grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {['color', 'size', 'material', 'gender'].map(attr => (
                <div key={attr}>
                  <label className="text-[10px] uppercase font-bold text-slate-400">{attr}</label>
                  <input type="text" value={draft[attr] || ''} onChange={(e) => handleInputChange(attr, e.target.value)} className="w-full mt-1 border border-slate-200 rounded-md p-2 text-xs focus:border-blue-500 outline-none font-bold text-slate-700" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PENALTIES, IMAGE, COMPETITORS */}
        <div className="space-y-6">

          {/* IMAGE EDITOR */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4"><ImageIcon className="w-4 h-4 text-slate-400" /> Media & Image URL</h3>
            <div className="aspect-square w-full bg-slate-100 rounded-xl mb-4 overflow-hidden border border-slate-200 flex items-center justify-center">
              {draft.imageUrl ? <img src={draft.imageUrl} alt="Preview" className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-slate-300" />}
            </div>
            <input type="text" placeholder="https://..." value={draft.imageUrl || ''} onChange={(e) => handleInputChange('imageUrl', e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:border-blue-500 outline-none text-slate-600 font-semibold" />
          </div>

          {/* DYNAMIC PENALTY CHECKLIST */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-red-500" /> Live Penalty Deductions</h3>
            {violations.length === 0 ? (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 animate-pulse" /> Perfect 100%! Ready for listing.
              </div>
            ) : (
              <div className="space-y-3">
                {violations.map((v: any, idx: number) => (
                  <div key={idx} className="bg-red-50/50 border border-red-100 p-3 rounded-lg flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-red-700">{v.rule}</div>
                      <div className="text-[10px] text-red-500 mt-0.5">{v.fix}</div>
                    </div>
                    <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-1 rounded">-{v.penalty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMPETITOR PRICING */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 mb-4"><Globe className="w-4 h-4 text-slate-400" /> Competitor Pricing</h3>

            {/* List existing */}
            <div className="space-y-2 mb-4">
              {draft.competitorPricing?.map((comp: any, idx: number) => (
                <div key={comp.id || idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                  <div>
                    <span className="font-bold text-slate-700">{comp.platform}</span>
                    {comp.url && (
                      <span className="block text-[9px] text-slate-400 truncate max-w-[150px]">{comp.url}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600 font-bold">₹{comp.price}</span>
                    <button type="button" onClick={() => handleRemoveCompetitor(comp.id)} className="text-red-500 hover:text-red-700 p-0.5 rounded transition-all">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {!draft.competitorPricing?.length && <p className="text-xs text-slate-400 italic">No competitors tracked.</p>}
            </div>

            {/* Add New */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={newCompetitor.platform} 
                  onChange={e => setNewCompetitor({ ...newCompetitor, platform: e.target.value })} 
                  className="border border-slate-200 rounded p-2 text-xs outline-none bg-white font-semibold text-slate-700"
                >
                  <option value="">Select Platform</option>
                  <option value="AMAZON">AMAZON</option>
                  <option value="MYNTRA">MYNTRA</option>
                  <option value="AJIO">AJIO</option>
                  <option value="NYKAA">NYKAA</option>
                  <option value="TATA_CLIQ">TATA_CLIQ</option>
                  <option value="MEESHO">MEESHO</option>
                </select>
                <input type="number" placeholder="Price (₹)" value={newCompetitor.price} onChange={e => setNewCompetitor({ ...newCompetitor, price: e.target.value })} className="border border-slate-200 rounded p-2 text-xs outline-none font-bold text-slate-700" />
              </div>
              <input type="text" placeholder="Url (Optional)" value={newCompetitor.url} onChange={e => setNewCompetitor({ ...newCompetitor, url: e.target.value })} className="w-full border border-slate-200 rounded p-2 text-xs outline-none font-semibold text-slate-600" />
              <button onClick={handleAddCompetitor} className="w-full bg-slate-800 text-white text-xs font-bold py-2 rounded hover:bg-slate-900 transition-colors">Add Competitor Node</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
