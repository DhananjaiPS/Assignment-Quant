'use client';

import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DownloadCSVButton() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    const toastId = toast.loading('Generating Quality CSV Report...');
    try {
      const response = await fetch('/api/reports/quality-export');
      if (!response.ok) throw new Error('Failed to generate report.');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product_quality_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Report downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download report.', { id: toastId });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-extrabold text-sm bg-emerald-650 hover:bg-emerald-700 text-white shadow-xl transition-all whitespace-nowrap cursor-pointer disabled:opacity-75"
    >
      {downloading ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span>Download CSV Report</span>
    </button>
  );
}
