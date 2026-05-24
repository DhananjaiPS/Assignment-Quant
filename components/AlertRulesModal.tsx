'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

export default function AlertRulesModal({ isOpen, onClose, onSave, editingRule }: any) {
  const [name, setName] = useState('');
  const [alertType, setAlertType] = useState('PRICE_GAP_EXCEEDED');
  const [threshold, setThreshold] = useState<number | string>('');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setAlertType(editingRule.alertType);
      setThreshold(editingRule.threshold || '');
      setIsActive(editingRule.isActive);
    } else {
      setName('');
      setAlertType('PRICE_GAP_EXCEEDED');
      setThreshold('');
      setIsActive(true);
    }
  }, [editingRule, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRule?.id,
          name,
          alertType,
          threshold: threshold === '' ? null : Number(threshold),
          isActive
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      onSave(data.rule);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save alert rule');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-slate-800">
            {editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rule Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 10% Price Drop Alert"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Alert Type</label>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PRICE_GAP_EXCEEDED">Price Gap Exceeded</option>
              <option value="COMPETITOR_PRICE_DROP">Competitor Price Drop</option>
              <option value="CRITICAL_METRIC_FAIL">Critical Metric Fail</option>
              <option value="LISTING_VALIDATION_ERROR">Listing Validation Error</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Threshold Value (Optional)</label>
            <input
              type="number"
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 10 (for 10%)"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-bold text-slate-700 cursor-pointer">
              Rule is Active
            </label>
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
