export interface CompetitorPriceRecord {
  id?: string;
  platform: string;
  competitorPrice: number | string;
  competitorUrl?: string;
  priceHistory?: any[];
}

export function calculateProductPricingStats(ourPrice: number, mrp: number, competitors: CompetitorPriceRecord[]) {
  // 1. Filter valid competitor prices (must be >= 10% of MRP)
  const minPriceLimit = mrp > 0 ? mrp * 0.1 : 0;
  const validCompetitors = competitors.filter(comp => {
    const val = Number(comp.competitorPrice);
    return !isNaN(val) && val >= minPriceLimit;
  });

  // 2. Extract price numbers
  const priceValues = validCompetitors.map(comp => Number(comp.competitorPrice));

  // 3. Compute Median Price
  const medianPrice = calculateMedian(priceValues);

  // 4. Compute Lowest Price (Outlier-free)
  const lowestPrice = priceValues.length > 0 ? Math.min(...priceValues) : Infinity;

  // 5. Compute variance relative to median
  const hasPrice = ourPrice && ourPrice > 0;
  const varianceAmount = hasPrice && medianPrice > 0 ? ourPrice - medianPrice : 0;
  const variancePercent = hasPrice && medianPrice > 0 ? (varianceAmount / medianPrice) * 100 : 0;

  // 6. Compute variance relative to lowest (pricing gap)
  const gapAmount = hasPrice && lowestPrice !== Infinity ? ourPrice - lowestPrice : 0;
  const gapPercent = hasPrice && lowestPrice !== Infinity ? (gapAmount / lowestPrice) * 100 : 0;

  // 7. Determine Flipkart Advice badge and color
  const isLowest = hasPrice && ourPrice <= lowestPrice;
  
  let badge = 'Unpriced';
  let color = 'text-slate-600 bg-slate-50 border-slate-200';
  let desc = 'No selling price is configured.';

  if (hasPrice) {
    if (isLowest) {
      badge = 'Competitive Edge';
      color = 'text-emerald-700 bg-emerald-50 border-emerald-100';
      desc = 'Flipkart listing price is highly competitive.';
    } else if (gapPercent <= 10) {
      badge = 'Review Recommended';
      color = 'text-amber-700 bg-amber-50 border-amber-100';
      desc = 'Price is slightly uncompetitive. Consider matching the market.';
    } else {
      badge = 'Urgent Price Correction';
      color = 'text-red-700 bg-red-50 border-red-100';
      desc = 'Overpriced by >10%. Algorithm discoverability will decrease.';
    }
  }

  return {
    validCompetitors,
    medianPrice,
    lowestPrice,
    varianceAmount,
    variancePercent,
    gapAmount,
    gapPercent,
    badge,
    color,
    desc,
    isLowest
  };
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[half];
  }
  return (sorted[half - 1] + sorted[half]) / 2.0;
}
