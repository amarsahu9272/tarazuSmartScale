export type Language = 'en' | 'hi';

export interface AppSettings {
  language: Language;
  darkMode: boolean;
  soundEnabled: boolean;
  decimalPrecision: number;
  shopName: string;
  shopPhone: string;
  shopGst: string;
}

export type HistoryItem =
  | {
      id: string;
      type: 'tarazu';
      timestamp: number;
      mode: 'amount_to_weight' | 'weight_to_amount';
      rate: number;
      inputAmount?: number;
      inputKg?: number;
      inputG?: number;
      resultKg?: number;
      resultG?: number;
      resultAmount?: number;
      label: string;
    }
  | {
      id: string;
      type: 'converter';
      timestamp: number;
      category: string;
      inputValue: number;
      inputUnit: string;
      results: Array<{ unit: string; value: number }>;
      label: string;
    }
  | {
      id: string;
      type: 'calculator';
      timestamp: number;
      expression: string;
      result: string;
      label: string;
    }
  | {
      id: string;
      type: 'business';
      timestamp: number;
      tool: 'profit' | 'gst' | 'emi';
      inputs: Record<string, string | number>;
      outputs: Record<string, string | number>;
      label: string;
    };

export type HistoryItemInput =
  | {
      type: 'tarazu';
      mode: 'amount_to_weight' | 'weight_to_amount';
      rate: number;
      inputAmount?: number;
      inputKg?: number;
      inputG?: number;
      resultKg?: number;
      resultG?: number;
      resultAmount?: number;
      label: string;
    }
  | {
      type: 'converter';
      category: string;
      inputValue: number;
      inputUnit: string;
      results: Array<{ unit: string; value: number }>;
      label: string;
    }
  | {
      type: 'calculator';
      expression: string;
      result: string;
      label: string;
    }
  | {
      type: 'business';
      tool: 'profit' | 'gst' | 'emi';
      inputs: Record<string, string | number>;
      outputs: Record<string, string | number>;
      label: string;
    };

export interface ShareData {
  title: string;
  text: string;
}
