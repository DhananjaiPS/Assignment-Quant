'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  BellRing,
  ShieldAlert,
  BadgeAlert,
  CheckCircle2,
  TrendingDown,
  Clock,
  Check,
  Eye,
  Mail,
  Send,
  ExternalLink,
  Settings,
  Sparkles,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  Edit2
} from 'lucide-react';
import AlertRulesModal from '@/components/AlertRulesModal';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AlertsHubPage() {
  const { data, mutate, isLoading } = useSWR('/api/alerts', fetcher, { refreshInterval: 4000 });
  const { data: configData, mutate: mutateConfig } = useSWR('/api/alerts/config', fetcher);

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Rules State
  const { data: rulesData, mutate: mutateRules } = useSWR('/api/alerts/rules', fetcher);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const rules = rulesData?.success ? rulesData.rules : [];

  // Email Notification States
  const [inputEmail, setInputEmail] = useState('');
  const [hasSynced, setHasSynced] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; previewUrl?: string | null } | null>(null);

  // Sync loaded config to input field
  useEffect(() => {
    if (configData?.recipientEmail && !hasSynced) {
      setInputEmail(configData.recipientEmail);
      setHasSynced(true);
    }
  }, [configData, hasSynced]);

  const recipientEmail = configData?.recipientEmail || '';
  const hasSmtp = !!configData?.hasSmtpConfigured;
  const smtpHost = configData?.smtpHost || 'Ethereal Mail (Sandbox)';


  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail || !inputEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch('/api/alerts/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: inputEmail }),
      });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);
      await mutateConfig();
      alert('Success! Notification email connected successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to connect email.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/alerts/test-email', { method: 'POST' });
      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);

      // Delay slightly to allow filesystem sync
      setTimeout(async () => {
        const updatedConfig = await mutateConfig();
        if (updatedConfig?.lastPreview?.previewUrl) {
          setTestResult({
            success: true,
            message: 'Test alert successfully routed to Ethereal sandbox!',
            previewUrl: updatedConfig.lastPreview.previewUrl,
          });
        } else {
          setTestResult({
            success: true,
            message: `Test alert successfully sent to ${updatedConfig?.recipientEmail || 'your email'}!`,
          });
        }
      }, 1000);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to dispatch test email.',
      });
    } finally {
      setSendingTest(false);
    }
  };


  const alerts = data?.success ? data.alerts.filter((alert: any) => !alert.isRead) : [];

  // Filter alerts by severity
  const filteredAlerts = alerts.filter((alert: any) => {
    if (severityFilter === 'ALL') return true;
    return alert.severity === severityFilter;
  });

  // Handle Mark as Read or Dismiss Alert
  const handleAlertAction = async (alertId: string, action: 'read' | 'dismiss') => {
    setActionLoadingId(alertId);
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action }),
      });

      const resData = await res.json();
      if (!resData.success) throw new Error(resData.error);

      // Update local SWR state
      mutate();
    } catch (err: any) {
      alert(err.message || 'Failed to update alert state.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'PRICE_GAP_EXCEEDED':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      case 'COMPETITOR_PRICE_DROP':
        return <TrendingDown className="w-5 h-5 text-amber-400" />;
      case 'LISTING_VALIDATION_ERROR':
        return <ShieldAlert className="w-5 h-5 text-red-500" />;
      default:
        return <BadgeAlert className="w-5 h-5 text-blue-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            Alert & Notification Center
          </h1>
          <p className="text-slate-500 mt-1 font-semibold">
            Resolve critical listing audit failures, SKU warnings, and marketplace pricing shifts.
          </p>
        </div>

        {/* Severity Filters */}
        <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs shadow-inner">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-lg font-extrabold transition-all cursor-pointer ${severityFilter === sev
                  ? 'bg-white text-blue-600 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Connected Email Alerts Channel Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600 animate-pulse" />
              Connected Email Alerts Channel
            </h2>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Configure where high & medium severity marketplace warnings (Flipkart pricing drops, audit failures) are sent.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${hasSmtp
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                : 'bg-amber-50 text-amber-700 border border-amber-150'
              }`}>
              <span className={`w-2 h-2 rounded-full ${hasSmtp ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{hasSmtp ? 'SMTP Connected' : 'Ethereal Sandbox Enabled'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Info Side */}
          <div className="space-y-4 text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-slate-850">
              <Settings className="w-4 h-4 text-slate-500" />
              <span className="font-extrabold">Mail Server Telemetry</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span>Outbound Server:</span>
                <span className="font-mono text-slate-800 font-bold">{smtpHost}</span>
              </div>
              <div className="flex justify-between">
                <span>Secure SSL/TLS:</span>
                <span className="text-slate-800 font-bold">{hasSmtp ? 'Active (Port 587)' : 'Simulated (Local Port 587)'}</span>
              </div>
              <div className="flex justify-between">
                <span>Recipient Target:</span>
                <span className="text-blue-600 font-extrabold underline">{recipientEmail || 'None connected'}</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500 leading-relaxed font-semibold">
              {hasSmtp ? (
                <span>✓ Severe Flipkart pricing discrepancies and list validation conflicts will trigger email notifications automatically.</span>
              ) : (
                <span>⚠️ Local developer sandbox active. Real emails will not deliver. Clicking <b>Send Test Alert Email</b> logs a live web preview URL below.</span>
              )}
            </div>
          </div>

          {/* Form & Actions Side */}
          <div className="space-y-4">
            <form onSubmit={handleSaveEmail} className="space-y-3">
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Seller Notification Email
              </label>

              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  placeholder="seller-admin@yourdomain.com"
                  required
                  className="block w-full pl-10 pr-4 py-3 border border-slate-250 rounded-xl bg-white text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={savingEmail}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-extrabold text-xs tracking-wide uppercase py-3 px-4 rounded-xl transition-all shadow-md cursor-pointer hover:translate-y-[-1px] active:translate-y-[0px]"
              >
                {savingEmail ? 'Connecting Channel...' : 'Save & Connect Email'}
              </button>
            </form>

            <button
              onClick={handleSendTestEmail}
              disabled={sendingTest || !recipientEmail}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-350 disabled:border-slate-100 border border-slate-250 text-slate-700 font-extrabold text-xs tracking-wide uppercase py-3 px-4 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {sendingTest ? 'Dispatching Telemetry...' : 'Send Test Alert Email'}
            </button>
          </div>
        </div>

        {/* Test Result Previews & Live Sandboxes */}
        {testResult && (
          <div className={`p-4 rounded-2xl border transition-all ${testResult.success
              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50/50 border-rose-200 text-rose-800'
            }`}>
            <div className="flex items-start gap-3">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <p className="text-xs font-bold leading-normal">{testResult.message}</p>

                {testResult.previewUrl && (
                  <div className="pt-1.5">
                    <a
                      href={testResult.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-[11px] font-extrabold shadow-sm transition-all hover:shadow"
                    >
                      <span>Open Ethereal Mail Sandbox Preview</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <p className="text-[10px] text-emerald-600/80 mt-1 font-semibold">
                      Inspect exactly how the premium brand-aligned HTML alert dispatches and renders.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alert Rules Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
              Dynamic Alert Rules
            </h2>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Configure customizable thresholds and constraints for the validation and repricing engine.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingRule(null);
              setIsRulesModalOpen(true);
            }}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs tracking-wide uppercase py-2 px-4 rounded-xl transition-all border border-indigo-200 cursor-pointer shadow-sm"
          >
            <Settings className="w-4 h-4" />
            Configure Rules
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center">
            <p className="text-sm font-semibold text-slate-500">No custom alert rules configured yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule: any) => (
              <div key={rule.id} className={`p-4 rounded-xl border flex justify-between items-center transition-all ${rule.isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                    {rule.name}
                    {!rule.isActive && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase">Inactive</span>}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Type: <span className="text-slate-700">{rule.alertType}</span> 
                    {rule.threshold !== null && <span className="ml-2">| Threshold: <span className="text-indigo-600 font-bold">{rule.threshold}</span></span>}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingRule(rule);
                    setIsRulesModalOpen(true);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-indigo-600 cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        editingRule={editingRule}
        onSave={() => mutateRules()}
      />

      {isLoading ? (
        <div className="text-center py-24 text-slate-500 text-sm">Synchronizing alerts feed...</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl text-center space-y-3 bg-white border border-slate-200">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-pulse" />
          <h3 className="text-lg font-extrabold text-slate-800">All Alarms Cleared</h3>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-sm mx-auto">
            You currently have zero active pricing drops or validation violations to resolve. Your catalog score stands in excellent standing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert: any) => {
            const formattedDate = new Date(alert.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={alert.id}
                className={`glass-panel p-6 rounded-2xl bg-white border-slate-200/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all shadow-sm hover:border-blue-200/70 hover:shadow ${alert.isRead ? 'opacity-60 bg-slate-50/50' : 'relative overflow-hidden'
                  }`}
              >
                {/* Visual Glow indicators for unread alerts */}
                {!alert.isRead && (
                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${alert.severity === 'HIGH' ? 'bg-red-500' : alert.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                )}

                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl border ${alert.severity === 'HIGH'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : alert.severity === 'MEDIUM'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    }`}>
                    {getAlertIcon(alert.alertType)}
                  </div>

                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded ${alert.severity === 'HIGH'
                          ? 'bg-red-500/20 text-red-400'
                          : alert.severity === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                        {alert.severity} Priority
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formattedDate}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-sm md:text-base mt-1">{alert.title}</h3>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed mt-0.5">{alert.message}</p>

                    {alert.productId && alert.product && (
                      <Link
                        href={`/products/${alert.product.skuId}`}
                        className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-600 hover:text-blue-750 pt-1.5"
                      >
                        Inspect SKU: {alert.product.skuId}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Direct Action Dismiss/Read Buttons */}
                <div className="flex items-center gap-3 w-full md:w-auto justify-end font-bold">
                  {!alert.isRead && (
                    <button
                      onClick={() => handleAlertAction(alert.id, 'read')}
                      disabled={actionLoadingId === alert.id}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      Read
                    </button>
                  )}

                  <button
                    onClick={() => handleAlertAction(alert.id, 'dismiss')}
                    disabled={actionLoadingId === alert.id}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-600 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Dismiss
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
