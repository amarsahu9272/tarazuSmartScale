import { AppSettings, HistoryItem } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'tarazu_settings',
  HISTORY: 'tarazu_history',
  PRESET_RATES: 'tarazu_preset_rates',
};

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  darkMode: false,
  soundEnabled: true,
  decimalPrecision: 2,
  shopName: 'Mera Kirana Store',
  shopPhone: '9876543210',
  shopGst: '',
};

const DEFAULT_PRESETS = [
  { id: '1', name: 'Aloo (Potato)', nameHi: 'आलू', rate: 25, category: 'Vegetables' },
  { id: '2', name: 'Pyaz (Onion)', nameHi: 'प्याज', rate: 40, category: 'Vegetables' },
  { id: '3', name: 'Tamatar (Tomato)', nameHi: 'टमाटर', rate: 50, category: 'Vegetables' },
  { id: '4', name: 'Chawal (Rice)', nameHi: 'चावल', rate: 60, category: 'Grains' },
  { id: '5', name: 'Aata (Flour)', nameHi: 'आटा', rate: 45, category: 'Grains' },
];

export function getStoredSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const val = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (val) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(val) };
    }
  } catch (e) {
    console.error('Failed to parse settings', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveStoredSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    
    // Set theme class on body
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function getStoredHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const val = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (val) return JSON.parse(val);
  } catch (e) {
    console.error('Failed to parse history', e);
  }
  return [];
}

export function saveStoredHistory(history: HistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

export interface PresetCategory {
  id: string;
  en: string;
  hi: string;
}

export interface PresetRate {
  id: string;
  name: string;
  nameHi: string;
  rate: number;
  category?: string;
}

const DEFAULT_CATEGORIES: PresetCategory[] = [
  { id: 'Vegetables', en: 'Vegetables', hi: 'सब्जियाँ' },
  { id: 'Grains', en: 'Grains', hi: 'अनाज' },
  { id: 'Dairy', en: 'Dairy', hi: 'डेयरी' },
  { id: 'Fruits', en: 'Fruits', hi: 'फल' },
  { id: 'Spices', en: 'Spices', hi: 'मसाले' },
  { id: 'Others', en: 'Others', hi: 'अन्य' }
];

export function getStoredCategories(): PresetCategory[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  try {
    const val = localStorage.getItem('tarazu_preset_categories');
    if (val) return JSON.parse(val);
  } catch (e) {
    console.error('Failed to parse categories', e);
  }
  return DEFAULT_CATEGORIES;
}

export function saveStoredCategories(categories: PresetCategory[]) {
  try {
    localStorage.setItem('tarazu_preset_categories', JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories', e);
  }
}

export function getStoredPresets(): PresetRate[] {
  if (typeof window === 'undefined') return DEFAULT_PRESETS;
  try {
    const val = localStorage.getItem(STORAGE_KEYS.PRESET_RATES);
    if (val) return JSON.parse(val);
  } catch (e) {
    console.error('Failed to parse presets', e);
  }
  return DEFAULT_PRESETS;
}

export function saveStoredPresets(presets: PresetRate[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.PRESET_RATES, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets', e);
  }
}
