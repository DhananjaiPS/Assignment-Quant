import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { LayoutDashboard, ShoppingBag, ShieldAlert, BadgeAlert, Sparkles, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { BellRing } from 'lucide-react';

export const revalidate = 0; // Disable server-side caching so data is fresh on each load

export default async function DashboardPage() {
  // Query DB Metrics directly
  const totalProducts = await prisma.product.count();

  const avgQualityScoreAgg = await prisma.product.aggregate({
    _avg: { qualityScore: true },
  });
  const avgQualityScore = avgQualityScoreAgg._avg.qualityScore
    ? Math.round(Number(avgQualityScoreAgg._avg.qualityScore))
    : 0;

  const totalIssues = await prisma.productIssue.count({
    where: { isResolved: false },
  });

  const activeAlerts = await prisma.alert.findMany({
    where: { isActive: true, isDismissed: false },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const activeAlertsCount = await prisma.alert.count({
    where: { isActive: true, isDismissed: false },
  });

  // Quality Breakdown
  const highQualityCount = await prisma.product.count({
    where: { qualityScore: { gte: 85 } },
  });
  const medQualityCount = await prisma.product.count({
    where: { qualityScore: { gte: 50, lt: 85 } },
  });
  const lowQualityCount = await prisma.product.count({
    where: { qualityScore: { lt: 50 } },
  });

  // Fetch Weakest Listings
  const weakListings = await prisma.product.findMany({
    where: { qualityScore: { lt: 70 } },
    orderBy: { qualityScore: 'asc' },
    take: 3,
  });

  // Fetch Competitor Pricing Gaps
  const competitorPricing = await prisma.competitorPrice.findMany({
    include: {
      product: true,
    },
  });

  // Identify listings with large price gaps (our price > competitor price)
  const uncompetitiveListings: any[] = [];
  const processedProducts = new Set();

  competitorPricing.forEach((comp) => {
    const product = comp.product;
    if (!product || processedProducts.has(product.id) || !product.price) return;

    const ourPrice = Number(product.price);
    const compPrice = Number(comp.competitorPrice);

    if (ourPrice > compPrice) {
      const gapPercent = ((ourPrice - compPrice) / compPrice) * 100;
      if (gapPercent > 10) {
        uncompetitiveListings.push({
          skuId: product.skuId,
          title: product.productTitle,
          ourPrice,
          compPrice,
          platform: comp.platform,
          gapPercent: Math.round(gapPercent),
        });
        processedProducts.add(product.id);
      }
    }
  });

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 p-6 rounded-2xl border border-blue-500/20 shadow-2xl">
        <div className="relative rounded-3xl overflow-hidden bg-cover bg-center flex items-center px-0 md:px-4">
          {/* Content */}
          <div className="relative z-10 max-w-3xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2 flex-wrap">
              <span className="text-white">Seller</span> Intelligence <span className="text-white">Dashboard</span>
            </h1>
 
            <p className="text-blue-100 mt-2 sm:mt-3 font-medium text-xs sm:text-sm md:text-base leading-relaxed">
              Audit catalog listings, align competitor pricing signals, and optimize search discoverability.
            </p>
          </div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Link
            href="/upload"
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white text-blue-600 shadow-md hover:bg-slate-50 hover:shadow-lg transition-all active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            Ingest New Product
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total SKUs */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between bg-white">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Catalog SKUs</span>
            <h3 className="text-4xl font-extrabold text-slate-800 mt-1">{totalProducts}</h3>
            <span className="text-blue-600 text-xs font-semibold flex items-center gap-0.5 mt-2">
              <TrendingUp className="w-3.5 h-3.5" /> Direct Sync Active
            </span>
          </div>
          <div className="bg-blue-500/10 p-3 rounded-lg text-blue-600 border border-blue-500/20">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Average Quality */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between bg-white">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Avg Quality Score</span>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-4xl font-extrabold text-slate-800">{avgQualityScore}%</h3>
            </div>
            <span className={`text-xs font-bold flex items-center gap-0.5 mt-2 ${avgQualityScore >= 80 ? 'text-emerald-600' : avgQualityScore >= 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
              {avgQualityScore >= 80 ? 'Excellent Standing' : avgQualityScore >= 50 ? 'Needs Attention' : 'Critical Warning'}
            </span>
          </div>
          {/* Custom gauge meter ring */}
          <div className="relative flex items-center justify-center">
            <svg className="w-16 h-16">
              <circle className="text-slate-100" strokeWidth="6" stroke="currentColor" fill="transparent" r="26" cx="32" cy="32" />
              <circle
                className={avgQualityScore >= 80 ? 'text-emerald-500' : avgQualityScore >= 50 ? 'text-amber-500' : 'text-red-500'}
                strokeWidth="6"
                strokeDasharray="163.3"
                strokeDashoffset={163.3 - (163.3 * avgQualityScore) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="26"
                cx="32"
                cy="32"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
              />
            </svg>
            <span className="absolute text-[10px] font-extrabold text-slate-700">{avgQualityScore}%</span>
          </div>
        </div>

        {/* Card 3: Listing Issues */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between bg-white">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Audit Listing Issues</span>
            <h3 className="text-4xl font-extrabold text-slate-800 mt-1">{totalIssues}</h3>
            <span className="text-amber-600 text-xs font-semibold flex items-center gap-0.5 mt-2">
              <ShieldAlert className="w-3.5 h-3.5" /> Action Suggested
            </span>
          </div>
          <div className="bg-amber-500/10 p-3 rounded-lg text-amber-600 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Active Pricing Alerts */}
        <div className="glass-panel p-6 rounded-xl flex items-center justify-between bg-white">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Critical Alerts</span>
            <h3 className="text-4xl font-extrabold text-slate-800 mt-1">{activeAlertsCount}</h3>
            <span className={`${activeAlertsCount > 0 ? 'text-red-650 font-bold' : 'text-emerald-600'} text-xs font-semibold flex items-center gap-0.5 mt-2`}>
              {activeAlertsCount > 0 ? (
                <>
                  <TrendingDown className="w-3.5 h-3.5" /> Gaps Exceeded
                </>
              ) : (
                <>
                  <TrendingUp className="w-3.5 h-3.5" /> Pricing Competitive
                </>
              )}
            </span>
          </div>
          <div className={`p-3 rounded-lg border ${activeAlertsCount > 0
            ? 'bg-red-500/10 text-red-600 border-red-500/20 animate-pulse'
            : 'bg-emerald-500/10 text-emerald-650 border-emerald-500/20'
            }`}>
            <BadgeAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Breakdown Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Column 1 & 2: Audit Standings and Pricing Gaps */}
        <div className="lg:col-span-2 space-y-8">

          {/* Section: Weakest Listings */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 bg-white">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" /> Catalog Quality Weak Spots
              </h2>
              <Link href="/products" className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1">
                View Catalog <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {weakListings.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm font-medium">
                🎉 Excellent work! All listings satisfy standard quality score thresholds above 70%.
              </div>
            ) : (
              <div className="space-y-3">
                {weakListings.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {prod.imageUrl ? (
                        <img src={prod.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs font-bold">
                          NO IMG
                        </div>
                      )}
                      <div>
                        <Link href={`/products/${prod.skuId}`} className="font-bold text-slate-850 hover:text-blue-600 text-sm md:text-base">
                          {prod.productTitle || 'Unnamed SKU'}
                        </Link>
                        <div className="flex gap-2 text-xs text-slate-400 mt-1 font-semibold">
                          <span>SKU: {prod.skuId}</span>
                          <span>•</span>
                          <span>Brand: {prod.brand || 'Unspecified'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-semibold">Quality Score</div>
                      <div className={`font-extrabold text-lg mt-0.5 ${Number(prod.qualityScore) < 50 ? 'text-red-500' : 'text-amber-500'
                        }`}>
                        {Number(prod.qualityScore)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Pricing Gaps */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 bg-white">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" /> Uncompetitive Marketplace Pricing Gaps
              </h2>
              <span className="text-xs text-slate-450 font-medium">Our vs lowest competitor</span>
            </div>

            {uncompetitiveListings.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm font-medium">
                💸 Great job! All product prices are fully competitive across Amazon, Myntra, and other platform nodes.
              </div>
            ) : (
              <div className="space-y-3">
                {uncompetitiveListings.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 lg:grid-cols-12 items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all gap-4"
                  >
                    <div className="lg:col-span-5 min-w-0">
                      <Link href={`/products/${item.skuId}`} className="font-bold text-slate-850 hover:text-blue-600 text-sm block truncate" title={item.title}>
                        {item.title}
                      </Link>
                      <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                        <span className="font-mono text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">SKU: {item.skuId}</span>
                        <span className="text-slate-300 select-none">•</span>
                        <span className="text-red-650 font-bold bg-red-50 border border-red-100/50 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">priced {item.gapPercent}% higher than {item.platform}</span>
                      </div>
                    </div>

                    <div className="lg:col-span-7 flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 sm:gap-6 w-full min-w-0">
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="text-left lg:text-right whitespace-nowrap min-w-[70px]">
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Our Price</div>
                          <div className="font-extrabold text-slate-850 text-sm mt-0.5">₹{Number(item.ourPrice).toLocaleString('en-IN')}</div>
                        </div>
                        <div className="text-left lg:text-right whitespace-nowrap min-w-[90px]">
                          <div className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Lowest ({item.platform})</div>
                          <div className="font-extrabold text-emerald-600 text-sm mt-0.5">₹{Number(item.compPrice).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                      <Link
                        href={`/products/${item.skuId}`}
                        className="w-full sm:w-auto text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex-shrink-0 active:scale-98"
                      >
                        Adjust Price
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: In-App Alerts History & Ingestion Center */}
        <div className="space-y-8">

          {/* Section: Alert Inbox */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 bg-white">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-red-500" /> Active Alert Inbox
              </h2>
              <Link href="/alerts" className="text-xs text-blue-600 hover:text-blue-700 font-bold">
                View All
              </Link>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm font-medium">
                📬 No active system alerts! Your listings are currently optimized.
              </div>
            ) : (
              <div className="space-y-3">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${alert.severity === 'HIGH'
                      ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/20'
                      : alert.severity === 'MEDIUM'
                        ? 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/20'
                        : 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/20'
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${alert.severity === 'HIGH'
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : alert.severity === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                        }`}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="font-extrabold text-slate-800 text-xs mt-1">{alert.title}</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 font-medium">{alert.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Category Distribution Summary */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 bg-white">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">
              Quality Score Indexing
            </h2>
            <div className="space-y-4 py-2">
              <div>
                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                  <span>High Quality (🔥 85-100%)</span>
                  <span>{highQualityCount} ({totalProducts > 0 ? Math.round((highQualityCount / totalProducts) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5 border border-slate-200/60">
                  <div
                    className="bg-emerald-500 h-full rounded-full"
                    style={{ width: `${totalProducts > 0 ? (highQualityCount / totalProducts) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                  <span>Medium Quality (⚠️ 50-84%)</span>
                  <span>{medQualityCount} ({totalProducts > 0 ? Math.round((medQualityCount / totalProducts) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5 border border-slate-200/60">
                  <div
                    className="bg-amber-500 h-full rounded-full"
                    style={{ width: `${totalProducts > 0 ? (medQualityCount / totalProducts) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 font-semibold">
                  <span>Low Quality (❌ 0-49%)</span>
                  <span>{lowQualityCount} ({totalProducts > 0 ? Math.round((lowQualityCount / totalProducts) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5 border border-slate-200/60">
                  <div
                    className="bg-red-500 h-full rounded-full"
                    style={{ width: `${totalProducts > 0 ? (lowQualityCount / totalProducts) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
