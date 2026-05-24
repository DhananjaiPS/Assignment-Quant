'use client';

import { useEffect, useState } from 'react';

export default function ApiDocsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Inject Swagger UI Stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css';
    document.head.appendChild(link);

    // 2. Inject Swagger UI Bundle Script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js';
    script.async = true;
    document.body.appendChild(script);

    // 3. Inject Swagger UI Standalone Preset Script
    const presetScript = document.createElement('script');
    presetScript.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js';
    presetScript.async = true;
    document.body.appendChild(presetScript);

    script.onload = () => {
      const checkAndInit = setInterval(() => {
        if ((window as any).SwaggerUIBundle) {
          clearInterval(checkAndInit);
          (window as any).SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
            presets: [
              (window as any).SwaggerUIBundle.presets.apis,
              (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: 'BaseLayout',
            deepLinking: true
          });
          setLoading(false);
        }
      }, 100);
    };

    return () => {
      // Safe cleanup on unmount
      if (document.head.contains(link)) document.head.removeChild(link);
      if (document.body.contains(script)) document.body.removeChild(script);
      if (document.body.contains(presetScript)) document.body.removeChild(presetScript);
    };
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 min-h-[80vh] relative animate-fade-in-up">
      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        .swagger-ui .topbar {
          display: none !important;
        }
        .swagger-ui .info {
          margin: 20px 0 !important;
        }
        .swagger-ui .info .title {
          font-family: 'Outfit', sans-serif !important;
          color: #0F172A !important;
          font-weight: 800 !important;
        }
        .swagger-ui .scheme-container {
          background: #F8FAFC !important;
          box-shadow: none !important;
          border: 1px solid #E2E8F0 !important;
          border-radius: 12px !important;
          padding: 15px !important;
        }
        .swagger-ui .opblock {
          border-radius: 12px !important;
          box-shadow: 0 1px 3px 0 rgba(0,0,0,0.05) !important;
        }
      `}} />

      {/* Premium Header */}
      <div className="border-b border-slate-100 pb-5 mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">API Reference Documentation</h1>
        <p className="text-slate-500 font-semibold mt-1">
          Explore and interact with the Quantacus Product Intelligence endpoint catalog.
        </p>
      </div>

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50 rounded-3xl">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-500 mt-4">Initializing Swagger Console...</span>
        </div>
      )}

      {/* Swagger UI Element */}
      <div id="swagger-ui" className="swagger-ui-container"></div>
    </div>
  );
}
