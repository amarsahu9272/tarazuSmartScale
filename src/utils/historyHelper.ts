import { HistoryItem } from '../types';

/**
 * Robust helper to extract currency amounts from any history transaction record.
 */
export const parseAmountFromHistoryItem = (item: HistoryItem, preferredCurrency: string = '₹'): number => {
  if (item.type === 'tarazu') {
    if (item.mode === 'weight_to_amount' && item.resultAmount !== undefined) {
      return Number(item.resultAmount) || 0;
    }
    if (item.mode === 'amount_to_weight' && item.inputAmount !== undefined) {
      return Number(item.inputAmount) || 0;
    }
  }

  if (item.type === 'business') {
    if (item.tool === 'gst' && item.outputs && item.outputs.total) {
      return Number(item.outputs.total) || 0;
    }
    if (item.tool === 'emi') {
      if (item.outputs && item.outputs.payable) {
        return Number(item.outputs.payable) || 0;
      }
    }
  }

  // Fallback string parser for other items
  const label = item.label || '';
  
  // Look for last numbers after "=" or right arrow formats
  const regexes = [
    /[=\s→➔]\s*(?:₹|\$|€|£|¥|৳|Rp|AED|đ|USD|INR)?\s*([0-9.,]+)\s*$/,
    /(?:₹|\$|€|£|¥|৳|Rp|AED|đ)\s*([0-9.,]+)\s*$/,
  ];

  for (const regex of regexes) {
    const match = label.match(regex);
    if (match) {
      const cleanVal = match[1].replace(/,/g, '');
      const parsed = parseFloat(cleanVal);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
};

export interface DailyRevenue {
  date: string; // MM/DD
  formattedDate: string; // Human Readable
  rawDate: string; // YYYY-MM-DD
  revenue: number;
}

/**
 * Computes chronological daily revenue from history item logs.
 */
export const getDailyRevenueData = (history: HistoryItem[], preferredCurrency: string = '₹'): DailyRevenue[] => {
  const dailyMap: Record<string, { formattedDate: string; revenue: number }> = {};
  
  history.forEach((item) => {
    const amt = parseAmountFromHistoryItem(item, preferredCurrency);
    if (amt <= 0) return;

    const dateObj = new Date(item.timestamp);
    const yyyymmdd = dateObj.toISOString().split('T')[0]; // Year-Month-Day
    const labelDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' }); // e.g. Jun 13

    if (!dailyMap[yyyymmdd]) {
      dailyMap[yyyymmdd] = {
        formattedDate: labelDate,
        revenue: 0,
      };
    }
    dailyMap[yyyymmdd].revenue += amt;
  });

  // Convert map to sorted array
  const sortedDays = Object.keys(dailyMap).sort();
  
  return sortedDays.map((rawDate) => {
    const parts = rawDate.split('-');
    const mmd = `${parts[1]}/${parts[2]}`; // MM/DD for compact charts
    return {
      date: mmd,
      formattedDate: dailyMap[rawDate].formattedDate,
      rawDate,
      revenue: parseFloat(dailyMap[rawDate].revenue.toFixed(2)),
    };
  });
};
