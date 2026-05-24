'use client';

import { useState } from 'react';
import { Webhook, Terminal, Check, Copy, MessageSquare, Bell } from 'lucide-react';

export default function WebhooksConsolePage() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const payloads = [
    {
      title: '🚨 HIGH Severity - Competitor Price Gap Exceeded',
      channel: 'Slack Webhook Payload',
      method: 'POST /services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
      description: 'Triggered when our Flipkart listing price is > 10% higher than the lowest competitor platform.',
      json: `{
  "username": "Quantacus Price Alert Bot",
  "icon_emoji": ":money_with_wings:",
  "attachments": [
    {
      "fallback": "[HIGH SEVERITY ALERT] Flipkart Price Gap Exceeded for SKU SHOE001.",
      "color": "#EF4444",
      "pretext": "⚠️ *Critical Competitor Pricing Gap Exceeded*",
      "author_name": "Flipkart Pricing Monitor Engine",
      "title": "Nike Zoom Pegasus Running Shoes (SKU: SHOE001)",
      "title_link": "https://quantacus-intelligence.vercel.app/products/SHOE001",
      "text": "Our selling price is highly uncompetitive compared to major e-commerce nodes.",
      "fields": [
        {
          "title": "Flipkart Price",
          "value": "INR 3,999.00",
          "short": true
        },
        {
          "title": "Lowest Competitor",
          "value": "INR 3,499.00 (Amazon)",
          "short": true
        },
        {
          "title": "Price Difference Gap",
          "value": "+14.3% (+INR 500.00)",
          "short": false
        },
        {
          "title": "Action Recommendation",
          "value": "Urgent! Price gap is high. Matching lowest competitor Amazon price to INR 3,499.00 is highly recommended to recover search discoverability.",
          "short": false
        }
      ],
      "footer": "Quantacus Alerts Engine v1.0",
      "ts": 1779600000
    }
  ]
}`
    },
    {
      title: '❌ HIGH Severity - Listing Audit Validation Failed',
      channel: 'Telegram Webhook Payload',
      method: 'POST /bot<token>/sendMessage',
      description: 'Triggered when a published SKU scores below 50% on our listing Quality Score audit.',
      json: `{
  "chat_id": "-100123456789",
  "parse_mode": "HTML",
  "text": "🔴 <b>CRITICAL LISTING AUDIT REJECTION</b>\\n\\n<b>Product:</b> Puma Bag (SKU: <code>BAG001</code>)\\n<b>Audit Quality Score:</b> 10% (CRITICAL FAIL)\\n\\nOur validation engine has registered <b>3 severe listing audit failures</b>:\\n\\n1. ❌ <b>Missing Image URL</b> (HIGH severity)\\n   <i>Suggested Fix:</i> Add at least one product visual or accessible thumbnail link.\\n\\n2. ❌ <b>MRP Violation Conflict</b> (HIGH severity)\\n   <i>Suggested Fix:</i> Max Retail Price (INR 1299.00) is lower than Flipkart Selling Price (INR 1799.00). Update MRP or reduce price.\\n\\n3. ⚠️ <b>Weak Listing Description</b> (LOW severity)\\n   <i>Suggested Fix:</i> Description is only 8 characters. Expand past 50 characters to highlight features.\\n\\n👉 <a href=\\"https://quantacus-intelligence.vercel.app/products/BAG001\\">Open Listing Audit Panel to Resolve Specifications</a>"
}`
    },
    {
      title: '📉 MEDIUM Severity - Sudden Competitor Price Slashed',
      channel: 'Custom webhook JSON Payload',
      method: 'POST /api/webhooks/pricing',
      description: 'Triggered when a platform competitor slashes their price by > 15% during price checks.',
      json: `{
  "event": "competitor.price_slashed",
  "timestamp": "2026-05-23T18:40:00.000Z",
  "severity": "MEDIUM",
  "productId": "clxxxxxxx0000xxxx",
  "skuId": "DRESS001",
  "productTitle": "Zara Crimson Red Midi Summer Dress",
  "details": {
    "platform": "MYNTRA",
    "competitorUrl": "https://myntra.com/dresses/zara/883921",
    "oldPrice": 2399.00,
    "newPrice": 1899.00,
    "dropPercent": 20.8
  },
  "context": {
    "ourFlipkartPrice": 2499.00,
    "pricingGapAmount": 600.00,
    "pricingGapPercent": 31.6
  }
}`
    }
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            Simulated Webhook Logger
          </h1>
          <p className="text-slate-500 mt-1 font-semibold">
            Review outward JSON payload integrations triggered by high-severity alerts.
          </p>
        </div>
        <Webhook className="w-8 h-8 text-blue-600 animate-pulse" />
      </div>

      {/* Description Panel */}
      <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl space-y-3 leading-relaxed text-slate-700">
        <span className="text-xs font-extrabold text-blue-600 flex items-center gap-1.5 uppercase tracking-wide">
          <Terminal className="w-4 h-4" /> System Integration Architecture
        </span>
        <p className="text-xs font-semibold leading-relaxed">
          When high-severity alarms (like an uncompetitive **Price Gap Exceeded** or **Listing Audit Failed**) are processed by the database tier, the application constructs structured JSON payload structures. In production, these are routed immediately to configured Slack webhooks, Telegram bot endpoints, or downstream microservices. Below are the telemetry blueprints generated by our engines.
        </p>
      </div>

      {/* Webhook Payloads List */}
      <div className="space-y-8">
        {payloads.map((payload, index) => (
          <div key={index} className="glass-panel p-6 rounded-2xl space-y-4 bg-white border border-slate-200 shadow-sm">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-extrabold text-slate-850 text-base flex items-center gap-2">
                  {payload.title}
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-semibold">{payload.description}</p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-slate-600 font-mono font-bold shadow-sm">
                  {payload.channel}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] text-slate-450 font-bold uppercase tracking-wider font-mono">
                <span>{payload.method}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(payload.json, index)}
                  className="hover:text-blue-600 flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-all font-extrabold cursor-pointer"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy JSON
                    </>
                  )}
                </button>
              </div>
              
              {/* Syntax Highlighted JSON Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 overflow-x-auto leading-relaxed shadow-inner">
                <pre>{payload.json}</pre>
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
