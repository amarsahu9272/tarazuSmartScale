import { HistoryItem } from '../types';

/**
 * Robust helper to extract currency amounts from any history transaction record.
 */
export const parseAmountFromHistoryItem = (item: HistoryItem, preferredCurrency: string = '₹'): number => {
  if (item.type === 'draft_invoice') {
    const subtotal = item.basket.reduce((tot, i) => tot + i.amount, 0);
    const disc = item.discountType === 'percent' 
      ? subtotal * (item.discountValue / 100) 
      : item.discountValue;
    const subAfterDisc = Math.max(0, subtotal - disc);
    const tax = item.isTaxEnabled ? (subAfterDisc * item.gstPercentage) / 100 : 0;
    return subAfterDisc + tax;
  }

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

export interface WeeklyRevenue {
  week: string; // e.g., "Jun 14-Jun 20"
  formattedWeek: string; // e.g., "Week of Jun 14, 2026"
  rawWeekStart: string; // YYYY-MM-DD
  revenue: number;
}

/**
 * Computes chronological weekly revenue from history item logs.
 */
export const getWeeklyRevenueData = (history: HistoryItem[], preferredCurrency: string = '₹'): WeeklyRevenue[] => {
  const weeklyMap: Record<string, { formattedWeek: string; revenue: number; label: string }> = {};

  history.forEach((item) => {
    const amt = parseAmountFromHistoryItem(item, preferredCurrency);
    if (amt <= 0) return;

    const dateObj = new Date(item.timestamp);
    
    // Find the Sunday of the week containing dateObj
    const day = dateObj.getDay();
    const diff = dateObj.getDate() - day; // 0 for Sunday
    const startOfWeek = new Date(dateObj);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const yyyymmdd = startOfWeek.toISOString().split('T')[0];
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startLabel = startOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const endLabel = endOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const label = `${startLabel}-${endLabel}`; // e.g. "Jun 14-Jun 20"
    const formattedWeek = `Week of ${startOfWeek.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;

    if (!weeklyMap[yyyymmdd]) {
      weeklyMap[yyyymmdd] = {
        label,
        formattedWeek,
        revenue: 0,
      };
    }
    weeklyMap[yyyymmdd].revenue += amt;
  });

  const sortedWeeks = Object.keys(weeklyMap).sort();

  return sortedWeeks.map((rawWeekStart) => {
    return {
      week: weeklyMap[rawWeekStart].label,
      formattedWeek: weeklyMap[rawWeekStart].formattedWeek,
      rawWeekStart,
      revenue: parseFloat(weeklyMap[rawWeekStart].revenue.toFixed(2)),
    };
  });
};

