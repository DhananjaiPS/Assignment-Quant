'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UploadCloud,
  FileVideo,
  Sparkles,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle,
  Globe,
  Loader2
} from 'lucide-react';

export default function IngestionPage() {
  const router = useRouter();

  // Video Ingestion States
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [enhanceTitle, setEnhanceTitle] = useState(true);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState('');

  // Interactive Loading Messages
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const loadingMessages = [
    "Uploading secure video file...",
    "Allocating GPU resources...",
    "Preparing frame extraction pipeline...",
    "Waking up AI models...",
    "Almost there, routing to live review..."
  ];

  // Cycle through loading messages when videoLoading is true
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (videoLoading) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2500); // Change text every 2.5 seconds
    } else {
      setLoadingTextIndex(0);
    }
    return () => clearInterval(interval);
  }, [videoLoading]);

  // CSV Fallback States
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvSuccess, setCsvSuccess] = useState<any | null>(null);
  const [csvError, setCsvError] = useState('');

  // Competitor CSV States
  const [compCsvFile, setCompCsvFile] = useState<File | null>(null);
  const [compCsvLoading, setCompCsvLoading] = useState(false);
  const [compCsvSuccess, setCompCsvSuccess] = useState<any | null>(null);
  const [compCsvError, setCompCsvError] = useState('');

  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);

  // Automatically parse competitor CSV client-side and cross-reference with DB
  useEffect(() => {
    if (!compCsvFile) {
      setCsvPreviewRows([]);
      setSelectedSkuIds([]);
      return;
    }

    const loadPreview = async () => {
      setPreviewLoading(true);
      setCompCsvError('');
      try {
        const reader = new FileReader();
        const csvText = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsText(compCsvFile);
        });

        const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
        if (lines.length <= 1) {
          throw new Error('CSV file is empty or missing data rows.');
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
        const csvSplitRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        const parsedRows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(csvSplitRegex).map((v) => v.trim().replace(/^["']|["']$/g, ''));
          if (values.length >= headers.length) {
            const row: Record<string, string> = {};
            headers.forEach((header, idx) => {
              row[header] = values[idx] || '';
            });
            parsedRows.push(row);
          }
        }

        const res = await fetch('/api/products');
        const dbData = await res.json();
        if (!dbData.success) {
          throw new Error(dbData.error || 'Failed to fetch existing products.');
        }

        const productsList = dbData.products || [];
        setDbProducts(productsList);

        const matched = parsedRows.map((row) => {
          const matchedProduct = productsList.find((p: any) => p.skuId.toLowerCase() === row.sku_id?.toLowerCase());
          return {
            ...row,
            matchedProduct,
          };
        });

        setCsvPreviewRows(matched);

        const matchedSkus = Array.from(new Set(
          matched.filter((r) => r.matchedProduct).map((r) => r.matchedProduct.skuId)
        )) as string[];
        setSelectedSkuIds(matchedSkus);

      } catch (err: any) {
        setCompCsvError(err.message || 'Error parsing CSV file preview.');
        setCsvPreviewRows([]);
        setSelectedSkuIds([]);
      } finally {
        setPreviewLoading(false);
      }
    };

    loadPreview();
  }, [compCsvFile]);

  // Handle Video Upload Submit
  const handleVideoSubmit = async (e: React.FormEvent, presetName?: string) => {
    e.preventDefault();
    setVideoLoading(true);
    setVideoError('');

    try {
      const formData = new FormData();

      if (presetName) {
        formData.append('isPreset', 'true');
        formData.append('presetName', presetName);
      } else if (videoFile) {
        formData.append('file', videoFile);
      } else {
        throw new Error('Please select a video file or click one of the preset clips.');
      }

      formData.append('enhanceTitle', String(enhanceTitle));

      const res = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to initialize video processing job.');
      }

      // Automatically redirect to the draft review screen
      router.push(`/review/${data.jobId}`);
    } catch (err: any) {
      setVideoError(err.message || 'An error occurred during video upload.');
      setVideoLoading(false);
    }
  };

  // Handle CSV Fallback Ingestion Submit
  const handleCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) {
      setCsvError('Please select a valid CSV catalog file first.');
      return;
    }

    setCsvLoading(true);
    setCsvError('');
    setCsvSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const res = await fetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to import product CSV feed.');
      }

      setCsvSuccess(data);
    } catch (err: any) {
      setCsvError(err.message || 'Failed to parse and write CSV rows.');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      "sku_id,product_title,brand,category,price,mrp,availability,description,image_url,product_url,color,size,material,gender\n" +
      "SHOE-CSV-01,Nike Red Sports Sneakers,Nike,Footwear,4499,5499,in_stock,Breathable mesh runner designed for marathons.,https://images.unsplash.com/photo-1542291026-7eec264c27ff,https://flipkart.com/nike-red,Red,UK 10,Mesh upper,Men\n" +
      "BAG-CSV-02,Puma Commuter Classic Pack,Puma,Bags,2199,2999,in_stock,Compact daily laptop travel pack.,https://images.unsplash.com/photo-1553062407-98eeb64c6a62,https://flipkart.com/puma-bag,Black,20L,Polyester,Unisex\n" +
      "SKU-CONFLCT-03,Broken Product,Generic,Apparel,3999,2999,out_of_stock,No image.,,https://flipkart.com/generic-broken,Blue,L,,Women\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_product_feed.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Competitor CSV Ingestion Submit
  const handleCompCsvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compCsvFile) {
      setCompCsvError('Please select a valid competitor CSV file first.');
      return;
    }

    setCompCsvLoading(true);
    setCompCsvError('');
    setCompCsvSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', compCsvFile);
      formData.append('selectedSkuIds', JSON.stringify(selectedSkuIds));

      const res = await fetch('/api/competitor-prices/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to import competitor prices.');
      }

      setCompCsvSuccess(data);
    } catch (err: any) {
      setCompCsvError(err.message || 'Failed to parse and write competitor price rows.');
    } finally {
      setCompCsvLoading(false);
    }
  };

  const handleDownloadCompTemplate = () => {
    const csvContent =
      "sku_id,product_name,platform,competitor_url,competitor_price,currency,last_checked_at\n" +
      "SHOE-CSV-01,Nike Red Sneakers,Amazon,https://amazon.in/nike-red,3999,INR,2026-05-24\n" +
      "SHOE-CSV-01,Nike Sports Shoes,Myntra,https://myntra.com/nike-red,4199,INR,2026-05-24\n" +
      "BAG-CSV-02,Puma Classic Backpack,Amazon,https://amazon.in/puma-bag,1999,INR,2026-05-24\n";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_competitor_prices.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
          Ingestion Hub
        </h1>
        <p className="text-slate-500 mt-1 font-semibold">
          Upload product videos for AI extraction or import product catalog feed CSVs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

        {/* Left Column: Primary Video Ingestion */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col bg-white shadow-sm border border-slate-200 space-y-6 h-fit relative md:sticky md:top-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileVideo className="w-5 h-5 text-blue-600" /> Video-to-Draft AI Extractor
          </h2>

          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
            Please upload a clear product video. For the most accurate AI extraction, we recommend videos that include visible text overlays or spoken descriptions about the product.
          </p>

          <form onSubmit={(e) => handleVideoSubmit(e)} className="space-y-6">

            {/* Dynamic Interactive Upload UI */}
            {videoLoading ? (
              <div className="flex flex-col items-center justify-center border-2 border-slate-200 rounded-xl p-8 bg-blue-50/50 transition-all text-center h-40">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <span className="text-sm font-bold text-slate-800 transition-opacity duration-300">
                  {loadingMessages[loadingTextIndex]}
                </span>
                <div className="w-full bg-blue-200 rounded-full h-1.5 mt-4 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '60%' }}></div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-350 hover:border-blue-500 rounded-xl p-6 bg-slate-50/50 cursor-pointer transition-all h-40 group">
                <input
                  type="file"
                  accept="video/mp4,video/quicktime"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="video-uploader"
                />
                <label htmlFor="video-uploader" className="flex flex-col items-center justify-center cursor-pointer text-center w-full h-full">
                  <UploadCloud className={`w-10 h-10 text-slate-400 mb-2 transition-colors ${videoFile ? 'text-blue-500' : 'group-hover:text-blue-500'}`} />
                  <span className="text-sm font-bold text-slate-700">
                    {videoFile ? videoFile.name : 'Select Product Video'}
                  </span>
                  <span className="text-xs text-slate-455 mt-1 font-semibold">MP4 or MOV, max 50MB</span>
                </label>
              </div>
            )}

            {/* Title optimizer toggle */}
            <div className="flex items-center justify-between bg-slate-50/60 p-3 rounded-lg border border-slate-150">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                <div>
                  <div className="text-xs font-extrabold text-slate-700">Enhance product title?</div>
                  <div className="text-[10px] text-slate-455 font-semibold">Generates SEO-rich target keywords.</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enhanceTitle}
                onChange={(e) => setEnhanceTitle(e.target.checked)}
                disabled={videoLoading}
                className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
              />
            </div>

            {videoError && <p className="text-red-600 text-xs font-bold bg-red-50 p-2 rounded">{videoError}</p>}

            <button
              onClick={(e) => handleVideoSubmit(e)}
              disabled={videoLoading || (!videoFile && !videoLoading)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all"
            >
              {videoLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </>
              ) : (
                <>Launch Video Ingest Processor <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Catalog Feed & Competitor Pricing Imports */}
        <div className="space-y-8">

          {/* Panel 2: Fallback CSV Ingestion */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col bg-white shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" /> Fallback Feed CSV Import
            </h2>

            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              If video extraction is incomplete or your item features pre-composed catalogs, upload Flipkart product feed CSVs directly.
            </p>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-3 py-2.5 rounded-lg transition-all w-full justify-center cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Download Product CSV Template
            </button>

            <form onSubmit={handleCsvSubmit} className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-350 hover:border-blue-500 rounded-xl p-6 bg-slate-50/50 cursor-pointer transition-all group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="csv-uploader"
                />
                <label htmlFor="csv-uploader" className="flex flex-col items-center justify-center cursor-pointer text-center w-full">
                  <UploadCloud className={`w-10 h-10 text-slate-400 mb-2 transition-colors ${csvFile ? 'text-blue-500' : 'group-hover:text-blue-500'}`} />
                  <span className="text-sm font-bold text-slate-700">
                    {csvFile ? csvFile.name : 'Select Feed CSV File'}
                  </span>
                  <span className="text-xs text-slate-450 mt-1 font-semibold">UTF-8 CSV files only</span>
                </label>
              </div>

              {csvError && <p className="text-red-600 text-xs font-bold">{csvError}</p>}

              <button
                type="submit"
                disabled={csvLoading || !csvFile}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {csvLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : 'Import Catalog Feed'}
              </button>
            </form>

            {csvSuccess && (
              <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl space-y-2 animate-fade-in-up">
                <span className="text-xs text-emerald-700 flex items-center gap-1.5 font-extrabold">
                  <CheckCircle className="w-4 h-4" /> Import Complete!
                </span>
                <p className="text-[11px] text-slate-600 font-semibold">
                  Successfully imported <strong className="text-emerald-700">{csvSuccess.successCount}</strong> product SKUs.
                  {csvSuccess.failCount > 0 && ` Failed: ${csvSuccess.failCount} rows.`}
                </p>
                {csvSuccess.failCount > 0 && csvSuccess.errors && csvSuccess.errors.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    <span className="text-[10px] text-red-700 font-bold uppercase tracking-wider block mb-1">Row-by-Row Error Log:</span>
                    <ul className="max-h-32 overflow-y-auto space-y-1 text-[10px] text-red-600 font-mono bg-white/50 p-2 rounded border border-red-100">
                      {csvSuccess.errors.map((err: string, idx: number) => (
                        <li key={idx} className="break-all">• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Panel 3: Competitor Price CSV Import */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col bg-white shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Globe className="w-5 h-5 text-blue-600" /> Competitor Price CSV Import
            </h2>

            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Upload competitor listing prices CSV to import comparison price nodes across platforms.
            </p>

            <button
              type="button"
              onClick={handleDownloadCompTemplate}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 px-3 py-2.5 rounded-lg transition-all w-full justify-center cursor-pointer shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Download Competitor CSV Template
            </button>

            <form onSubmit={handleCompCsvSubmit} className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-350 hover:border-blue-500 rounded-xl p-6 bg-slate-50/50 cursor-pointer transition-all group">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCompCsvFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="comp-csv-uploader"
                />
                <label htmlFor="comp-csv-uploader" className="flex flex-col items-center justify-center cursor-pointer text-center w-full">
                  <UploadCloud className={`w-10 h-10 text-slate-400 mb-2 transition-colors ${compCsvFile ? 'text-blue-500' : 'group-hover:text-blue-500'}`} />
                  <span className="text-sm font-bold text-slate-700">
                    {compCsvFile ? compCsvFile.name : 'Select Competitor CSV File'}
                  </span>
                  <span className="text-xs text-slate-455 mt-1 font-semibold">UTF-8 CSV files only</span>
                </label>
              </div>

              {compCsvError && <p className="text-red-600 text-xs font-bold">{compCsvError}</p>}

              {/* CSV PREVIEW CHECKLIST */}
              {previewLoading && (
                <div className="flex items-center justify-center py-4 gap-2 text-slate-500 font-semibold text-xs bg-slate-50 rounded-xl border border-slate-100">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Matching CSV SKU IDs with Database...
                </div>
              )}

              {!previewLoading && csvPreviewRows.length > 0 && (
                <div className="space-y-4 bg-slate-50 border border-slate-200 p-4 rounded-xl max-h-72 overflow-y-auto">
                  <div className="border-b border-slate-200 pb-2">
                    <h4 className="text-xs font-bold text-slate-700">Competitor Price Mapping Matcher</h4>
                    <p className="text-[10px] text-slate-455 font-semibold mt-0.5">
                      Select which existing products to link competitor prices for.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {/* Matching Products */}
                    {csvPreviewRows.filter(r => r.matchedProduct).length > 0 ? (
                      csvPreviewRows
                        .filter((row, idx, self) => 
                          self.findIndex(r => r.matchedProduct?.skuId === row.matchedProduct?.skuId) === idx
                        )
                        .map((row) => {
                          const prod = row.matchedProduct;
                          const isChecked = selectedSkuIds.includes(prod.skuId);
                          const platformRows = csvPreviewRows.filter(r => r.matchedProduct?.skuId === prod.skuId);

                          return (
                            <div key={prod.skuId} className="flex items-center justify-between bg-white border border-slate-150 p-2.5 rounded-lg shadow-sm">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSkuIds([...selectedSkuIds, prod.skuId]);
                                    } else {
                                      setSelectedSkuIds(selectedSkuIds.filter(id => id !== prod.skuId));
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded cursor-pointer"
                                />
                                <div className="w-8 h-8 rounded bg-slate-50 border border-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  {prod.imageUrl ? (
                                    <img src={prod.imageUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] text-slate-400 font-bold">N/A</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="block text-xs font-bold text-slate-800 truncate max-w-[120px]" title={prod.productTitle}>
                                    {prod.productTitle}
                                  </span>
                                  <span className="block text-[9px] font-mono font-bold text-slate-500">
                                    SKU: {prod.skuId}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-[9px] bg-blue-50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded font-bold uppercase whitespace-nowrap">
                                  {platformRows.length} Price{platformRows.length > 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      <div className="text-center py-4 bg-white border border-dashed border-red-200 rounded-lg text-xs text-red-500 font-semibold px-2">
                        ⚠️ No matching product SKUs found in the database.
                      </div>
                    )}

                    {/* Non-matching Products */}
                    {csvPreviewRows.filter(r => !r.matchedProduct).length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[10px] text-slate-455 font-bold uppercase tracking-wider block mb-1">
                          Unmatched in CSV (No SKU match in DB):
                        </span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {csvPreviewRows.filter(r => !r.matchedProduct).map((row, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10px] text-red-500 bg-red-50/50 p-1.5 rounded border border-red-100/50">
                              <span className="font-mono font-bold truncate max-w-[100px]">SKU: {row.sku_id}</span>
                              <span className="truncate max-w-[140px]">{row.product_name || 'Unnamed Competitor'}</span>
                              <span className="font-bold flex-shrink-0">{row.platform}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={compCsvLoading || !compCsvFile || selectedSkuIds.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {compCsvLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</> : 'Import Competitor Prices'}
              </button>
            </form>

            {compCsvSuccess && (
              <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-xl space-y-2 animate-fade-in-up">
                <span className="text-xs text-emerald-700 flex items-center gap-1.5 font-extrabold">
                  <CheckCircle className="w-4 h-4" /> Import Complete!
                </span>
                <p className="text-[11px] text-slate-600 font-semibold">
                  Successfully imported/updated <strong className="text-emerald-700">{compCsvSuccess.successCount}</strong> pricing records.
                  {compCsvSuccess.failCount > 0 && ` Failed: ${compCsvSuccess.failCount} rows.`}
                </p>
                {compCsvSuccess.alertsCreatedCount > 0 && (
                  <p className="text-[10px] text-red-650 font-bold">
                    ⚠️ Raised {compCsvSuccess.alertsCreatedCount} new pricing alerts!
                  </p>
                )}
                {compCsvSuccess.failCount > 0 && compCsvSuccess.errors && compCsvSuccess.errors.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-emerald-200">
                    <span className="text-[10px] text-red-700 font-bold uppercase tracking-wider block mb-1">Row-by-Row Error Log:</span>
                    <ul className="max-h-32 overflow-y-auto space-y-1 text-[10px] text-red-600 font-mono bg-white/50 p-2 rounded border border-red-100">
                      {compCsvSuccess.errors.map((err: string, idx: number) => (
                        <li key={idx} className="break-all">• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}