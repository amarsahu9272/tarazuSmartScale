import React, { useState, useEffect } from 'react';
import { Scale, RefreshCw, Calculator, TrendingUp, History, Settings, Plus, Search, CheckCircle, Share2, Copy, AlertTriangle, Package, Edit3, Save, Check } from 'lucide-react';
import { Language, HistoryItem, AppSettings } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { getDailyRevenueData, getWeeklyRevenueData } from '../utils/historyHelper';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getStoredPresets, saveStoredPresets, PresetRate } from '../utils/storage';

interface DashboardProps {
  lang: Language;
  settings: AppSettings;
  history: HistoryItem[];
  onNavigate: (section: string) => void;
  onDeleteHistoryItem: (id: string) => void;
  onClearHistory: () => void;
}

export default function Dashboard({
  lang,
  settings,
  history,
  onNavigate,
  onDeleteHistoryItem,
  onClearHistory,
}: DashboardProps) {
  const t = translate(lang);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState('');
  const [trendPeriod, setTrendPeriod] = useState<'daily' | 'weekly'>('daily');

  // Stock alert properties
  const [presets, setPresets] = useState<PresetRate[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editStockVal, setEditStockVal] = useState('');
  const [editThresholdVal, setEditThresholdVal] = useState('');

  // Reload presets on mount or history changes (weighing reduces stock)
  useEffect(() => {
    setPresets(getStoredPresets());
  }, [history]);

  const handleUpdateStockAndThreshold = (id: string) => {
    const stock = parseFloat(editStockVal);
    const threshold = parseFloat(editThresholdVal);

    const updatedPresets = presets.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          currentStock: editStockVal.trim() === '' ? undefined : (isNaN(stock) ? undefined : stock),
          minThreshold: editThresholdVal.trim() === '' ? undefined : (isNaN(threshold) ? undefined : threshold),
        };
      }
      return p;
    });

    setPresets(updatedPresets);
    saveStoredPresets(updatedPresets);
    setEditingPresetId(null);
    playSuccessSound(settings.soundEnabled);
  };


  // Clock updater
  useEffect(() => {
    const isBatterySaver = !!settings.batterySaver;
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: isBatterySaver ? undefined : '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const intervalTime = isBatterySaver ? 30000 : 1000;
    const interval = setInterval(updateTime, intervalTime);
    return () => clearInterval(interval);
  }, [lang, settings.batterySaver]);

  // Calc quick stats
  const totalWeighs = history.filter((h) => h.type === 'tarazu').length;
  const totalConversions = history.filter((h) => h.type === 'converter').length;
  const totalBiz = history.filter((h) => h.type === 'business').length;

  // 1. Manual inventory low stock alerts
  const lowStockItems = presets.filter(
    (p) => p.currentStock !== undefined && p.minThreshold !== undefined && p.currentStock < p.minThreshold
  );

  // 2. Weighed transaction history weight warnings
  const historyWeightWarnings = React.useMemo(() => {
    const warnings: Array<{
      id: string;
      itemName: string;
      weighedWeight: number;
      threshold: number;
      timestamp: number;
      label: string;
    }> = [];

    history.forEach((item) => {
      if (item.type !== 'tarazu') return;
      
      // Determine weighed weight
      let weight = 0;
      if (item.mode === 'amount_to_weight') {
        weight = (item.resultKg || 0) + (item.resultG || 0) / 1000;
      } else {
        weight = (item.inputKg || 0) + (item.inputG || 0) / 1000;
      }

      if (weight <= 0) return;

      // Try to find matching preset
      const matched = presets.find((p) => {
        // match by rate
        if (p.rate === item.rate) return true;
        // fallback: match by name
        const lowerLabel = item.label.toLowerCase();
        if (p.name && lowerLabel.includes(p.name.toLowerCase())) return true;
        if (p.nameHi && lowerLabel.includes(p.nameHi.toLowerCase())) return true;
        return false;
      });

      if (matched && matched.minThreshold !== undefined && weight < matched.minThreshold) {
        warnings.push({
          id: item.id,
          itemName: lang === 'hi' ? matched.nameHi : matched.name,
          weighedWeight: weight,
          threshold: matched.minThreshold,
          timestamp: item.timestamp,
          label: item.label,
        });
      }
    });

    return warnings;
  }, [history, presets, lang]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    playSuccessSound(settings.soundEnabled);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (title: string, text: string) => {
    playClickSound(settings.soundEnabled);
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch (e) {
        console.warn('Share cancelled or failed', e);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(`${title}\n${text}`);
      alert(lang === 'hi' ? 'क्लिपबोर्ड पर कॉपी किया गया!' : 'Copied to clipboard!');
    }
  };

  const getDayText = () => {
    const d = new Date();
    return d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner card */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
        {/* Abstract background blobs */}
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-emerald-500/20 blur-2xl"></div>
        <div className="absolute -left-10 -bottom-10 w-60 h-60 rounded-full bg-teal-500/10 blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <span className="bg-emerald-500/30 text-emerald-100 text-xs font-semibold uppercase px-3 py-1 rounded-full border border-emerald-400/20">
              {settings.shopName || 'Smart Weighing Scale'}
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Tarazu</h1>
            <p className="text-emerald-100 font-medium text-sm sm:text-base max-w-md">
              {t('tagline')}
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex flex-col items-end justify-center min-w-[200px]">
            <p className="font-mono text-xl sm:text-2xl font-bold tracking-wider">{timeStr}</p>
            <p className="text-xs text-emerald-200 mt-1 uppercase font-semibold tracking-wider">
              {getDayText()}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Stats indicators */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('totalCalculations')}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{totalWeighs}</p>
          </div>
          <div className="absolute bottom-0 right-0 h-1 bg-emerald-500 w-0 group-hover:w-full transition-all duration-300"></div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('conversionsDone')}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{totalConversions}</p>
          </div>
          <div className="absolute bottom-0 right-0 h-1 bg-emerald-500 w-0 group-hover:w-full transition-all duration-300"></div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group">
          <div className="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('bizCalculations')}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{totalBiz}</p>
          </div>
          <div className="absolute bottom-0 right-0 h-1 bg-emerald-500 w-0 group-hover:w-full transition-all duration-300"></div>
        </div>
      </div>

      {/* Daily/Weekly sales trend charts */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 select-none gap-4">
          <div className="space-y-1 text-left">
            <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">📊</span>
              <span>
                {trendPeriod === 'daily'
                  ? (lang === 'hi' ? 'दैनिक बिक्री एवं राजस्व बही' : 'Daily Sales Trend')
                  : (lang === 'hi' ? 'साप्ताहिक बिक्री एवं राजस्व बही' : 'Weekly Sales Trend')}
              </span>
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {trendPeriod === 'daily'
                ? (lang === 'hi' ? 'बहीखाता प्रविष्टियों से स्वचालित दैनिक गणना' : 'Daily transactional income aggregated chronologically')
                : (lang === 'hi' ? 'बहीखाता प्रविष्टियों से संकलित साप्ताहिक गणना' : 'Weekly transactional income grouped chronologically')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {/* Filter Toggle Buttons */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  playClickSound(settings.soundEnabled);
                  setTrendPeriod('daily');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  trendPeriod === 'daily'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'hi' ? 'दैनिक' : 'Daily'}
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound(settings.soundEnabled);
                  setTrendPeriod('weekly');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  trendPeriod === 'weekly'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {lang === 'hi' ? 'साप्ताहिक' : 'Weekly'}
              </button>
            </div>

            {(() => {
              const currentData = trendPeriod === 'daily'
                ? getDailyRevenueData(history, settings.preferredCurrency)
                : getWeeklyRevenueData(history, settings.preferredCurrency);
              if (currentData.length === 0) return null;
              const totalAmount = currentData.reduce((sum, item) => sum + item.revenue, 0);
              return (
                <div className="bg-emerald-500/10 text-emerald-850 dark:text-emerald-300 px-3 py-1.5 rounded-2xl font-black text-xs font-mono">
                  {lang === 'hi' ? 'कुल संचित:' : 'Aggregated Total:'} {settings.preferredCurrency}{' '}
                  {totalAmount.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              );
            })()}
          </div>
        </div>

        {(() => {
          const dailyData = getDailyRevenueData(history, settings.preferredCurrency);
          const weeklyData = getWeeklyRevenueData(history, settings.preferredCurrency);
          const currentData = trendPeriod === 'daily' ? dailyData : weeklyData;

          if (currentData.length === 0) {
            return (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                <div className="h-12 w-12 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-400 border text-xl border-dashed">📉</div>
                <p className="text-xs font-bold text-slate-505 dark:text-slate-405 max-w-sm leading-relaxed">
                  {lang === 'hi'
                    ? 'अभी तक कोई राजस्व प्रविष्टि नहीं पाई गई। गणना या व्यवसाय बहीखाता चालू करने पर बिक्री राजस्व स्वचालित रूप से यहाँ प्रदर्शित होगा।'
                    : 'No transactional income parsed from calculations yet. Run selling calculations under Scale or Business tools to generate revenue.'}
                </p>
              </div>
            );
          }

          if (trendPeriod === 'daily') {
            return (
              <div className="h-64 sm:h-72 w-full mt-2 font-mono text-xs select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings.darkMode ? '#334155' : '#e2e8f0'} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      stroke={settings.darkMode ? '#94a3b8' : '#475569'}
                      fontSize={10}
                      fontWeight={600}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      stroke={settings.darkMode ? '#94a3b8' : '#475569'}
                      fontSize={10}
                      fontWeight={600}
                      tickFormatter={(val) => `${settings.preferredCurrency}${val}`}
                    />
                    <Tooltip
                      cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-950 text-white dark:bg-white dark:text-slate-900 p-3 rounded-xl border border-transparent shadow-xl font-sans text-xs text-left">
                              <p className="font-extrabold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider mb-1">
                                {data.formattedDate}
                              </p>
                              <p className="font-black text-sm flex items-center gap-1">
                                <span className="text-emerald-400 dark:text-emerald-600">●</span>
                                <span>
                                  {settings.preferredCurrency}{' '}
                                  {Number(payload[0].value).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          } else {
            return (
              <div className="h-64 sm:h-72 w-full mt-2 font-mono text-xs select-none">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings.darkMode ? '#334155' : '#e2e8f0'} />
                    <XAxis
                      dataKey="week"
                      tickLine={false}
                      axisLine={false}
                      stroke={settings.darkMode ? '#94a3b8' : '#475569'}
                      fontSize={9}
                      fontWeight={600}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      stroke={settings.darkMode ? '#94a3b8' : '#475569'}
                      fontSize={10}
                      fontWeight={600}
                      tickFormatter={(val) => `${settings.preferredCurrency}${val}`}
                    />
                    <Tooltip
                      cursor={{ fill: settings.darkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-950 text-white dark:bg-white dark:text-slate-900 p-3 rounded-xl border border-transparent shadow-xl font-sans text-xs text-left">
                              <p className="font-extrabold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider mb-1">
                                {data.formattedWeek}
                              </p>
                              <p className="font-black text-sm flex items-center gap-1">
                                <span className="text-emerald-450 dark:text-emerald-600">■</span>
                                <span>
                                  {settings.preferredCurrency}{' '}
                                  {Number(payload[0].value).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          }
        })()}
      </div>

      {/* Grid of Action buttons */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('quickUtilityCards')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <button
            onClick={() => {
              playClickSound(settings.soundEnabled);
              onNavigate('tarazu');
            }}
            id="dash-btn-tarazu"
            className="flex flex-col items-center justify-center py-6 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group"
          >
            <span className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-full text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-3">
              <Scale className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center">{t('tarazu')}</span>
          </button>

          <button
            onClick={() => {
              playClickSound(settings.soundEnabled);
              onNavigate('converter');
            }}
            id="dash-btn-converter"
            className="flex flex-col items-center justify-center py-6 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group"
          >
            <span className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-full text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-3">
              <RefreshCw className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center">{t('converter')}</span>
          </button>

          <button
            onClick={() => {
              playClickSound(settings.soundEnabled);
              onNavigate('calculator');
            }}
            id="dash-btn-calc"
            className="flex flex-col items-center justify-center py-6 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group"
          >
            <span className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-full text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-3">
              <Calculator className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center">{t('calculator')}</span>
          </button>

          <button
            onClick={() => {
              playClickSound(settings.soundEnabled);
              onNavigate('business');
            }}
            id="dash-btn-biz"
            className="flex flex-col items-center justify-center py-6 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group"
          >
            <span className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-full text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform mb-3">
              <TrendingUp className="w-6 h-6" />
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 text-center">{t('businessTools')}</span>
          </button>
        </div>
      </div>

      {/* Shortcuts grid for specific state conversions or tools */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
          {lang === 'hi' ? 'विशेष टूल्स शॉर्टकट' : 'Specialized Tool Shortcuts'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('business')}
            className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 hover:border-emerald-400 border border-slate-200 dark:border-slate-700/50 rounded-2xl transition-all text-left group cursor-pointer"
          >
            <span className="text-xl">💰</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t('calculateProfit')}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{lang === 'hi' ? 'खरीद और बिक्री दर का सही आकलन' : 'Accurately audit selling price margins'}</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('converter')}
            className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 hover:border-emerald-400 border border-slate-200 dark:border-slate-700/50 rounded-2xl transition-all text-left group cursor-pointer"
          >
            <span className="text-xl">🌾</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t('convertLand')}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{lang === 'hi' ? 'बिहार, झारखंड, यूपी व बंगाल जमीन मापन' : 'Bigha, Katha, Dhur & Decimal values'}</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('business')}
            className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 hover:border-emerald-400 border border-slate-200 dark:border-slate-700/50 rounded-2xl transition-all text-left group cursor-pointer"
          >
            <span className="text-xl">🧾</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t('splitGST')}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{lang === 'hi' ? 'केंद्रीय CGST & राजकीय SGST का अलगाव' : 'Split state GST rates securely'}</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('business')}
            className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 hover:border-emerald-400 border border-slate-200 dark:border-slate-700/50 rounded-2xl transition-all text-left group cursor-pointer"
          >
            <span className="text-xl">💳</span>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t('loanEMI')}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{lang === 'hi' ? 'ब्याज और मासिक किस्त का आसान लेखा' : 'Principal amortization and monthly charts'}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Stock Alert & Inventory Thresholds Center */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-105/10 dark:border-slate-700/50 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {lang === 'hi' ? 'स्टॉक अलर्ट और इन्वेंट्री सीमा' : 'Stock Alerts & Inventory Thresholds'}
            </h2>
          </div>
          <span className="text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 font-bold px-2 py-1 rounded-lg text-slate-500 dark:text-slate-400">
            {lang === 'hi' ? `${presets.length} उत्पाद` : `${presets.length} Products`}
          </span>
        </div>

        {/* Dynamic Alerts Banner */}
        {(lowStockItems.length > 0 || historyWeightWarnings.length > 0) && (
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <div
                key={`low-stock-${item.id}`}
                className="flex items-center gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/60 text-amber-900 dark:text-amber-300 rounded-2xl text-xs font-semibold animate-pulse"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1">
                  <span className="font-bold">{lang === 'hi' ? item.nameHi : item.name}</span>{' '}
                  {lang === 'hi'
                    ? 'का स्टॉक सीमा से कम है!'
                    : 'is running low on stock!'}{' '}
                  {lang === 'hi' ? 'वर्तमान स्टॉक:' : 'Current Stock:'}{' '}
                  <span className="font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                    {item.currentStock} KG
                  </span>{' '}
                  ({lang === 'hi' ? 'न्यूनतम सीमा:' : 'Min Threshold:'}{' '}
                  <span className="font-mono">{item.minThreshold} KG</span>)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound(settings.soundEnabled);
                    setEditingPresetId(item.id);
                    setEditStockVal(String(item.currentStock || ''));
                    setEditThresholdVal(String(item.minThreshold || ''));
                  }}
                  className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-400/10 dark:hover:bg-amber-400/20 border border-amber-400/30 font-bold rounded-lg cursor-pointer transition-colors text-[10px]"
                >
                  {lang === 'hi' ? 'स्टॉक जोड़ें' : 'Refill Stock'}
                </button>
              </div>
            ))}

            {historyWeightWarnings.slice(0, 2).map((warn) => (
              <div
                key={`history-warn-${warn.id}`}
                className="flex items-center gap-2.5 p-3 bg-rose-50 dark:bg-rose-950/15 border border-rose-250 dark:border-rose-900/40 text-rose-900 dark:text-rose-300 rounded-2xl text-xs font-medium"
              >
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <div className="flex-1 text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-[9px] bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-200/50 dark:border-rose-900/40 mr-1.5 font-mono">
                    {lang === 'hi' ? 'तौल चेतावनी' : 'WEIGH WARNING'}
                  </span>
                  {lang === 'hi' ? 'हालिया लेनदेन ' : 'Recent calculation '}{' '}
                  <span className="font-semibold italic">"{warn.label.substring(0, 30)}..."</span>{' '}
                  {lang === 'hi' ? 'की तौली मात्रा' : 'weighed quantity'}{' '}
                  <span className="font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                    ({warn.weighedWeight} KG)
                  </span>{' '}
                  {lang === 'hi' ? 'न्यूनतम स्टॉक सीमा' : 'is below minimum safety limit'}{' '}
                  <span className="font-mono font-bold">({warn.threshold} KG)</span>!
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inventory Item Matrix / Table */}
        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider border-b border-slate-105/10 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">{lang === 'hi' ? 'उत्पाद विवरण' : 'Product Details'}</th>
                <th className="px-4 py-3">{lang === 'hi' ? 'वर्तमान स्टॉक' : 'Current Stock'}</th>
                <th className="px-4 py-3">{lang === 'hi' ? 'अलर्ट सीमा' : 'Alert Threshold'}</th>
                <th className="px-4 py-3 text-center">{lang === 'hi' ? 'स्थिति' : 'Status'}</th>
                <th className="px-4 py-3 text-right">{lang === 'hi' ? 'कार्य' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold">
              {presets.map((pr) => {
                const isEditing = editingPresetId === pr.id;
                const isLow = pr.currentStock !== undefined && pr.minThreshold !== undefined && pr.currentStock < pr.minThreshold;

                return (
                  <tr
                    key={pr.id}
                    className={`transition-colors ${
                      isEditing
                        ? 'bg-slate-50/70 dark:bg-slate-900/35'
                        : isLow
                        ? 'bg-amber-50/10 hover:bg-amber-50/20 dark:bg-amber-950/5 dark:hover:bg-amber-950/10'
                        : 'hover:bg-slate-50/40 dark:hover:bg-slate-900/20'
                    }`}
                  >
                    {/* Name & Category column */}
                    <td className="px-4 py-3.5">
                      <p className="text-slate-800 dark:text-slate-100 font-bold">
                        {lang === 'hi' ? pr.nameHi : pr.name}
                      </p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase mt-0.5">
                        {pr.category || 'Others'} — {settings.preferredCurrency}{pr.rate}/KG
                      </p>
                    </td>

                    {/* Current Stock level */}
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            value={editStockVal}
                            placeholder="KG"
                            onChange={(e) => setEditStockVal(e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 font-mono w-20 text-xs text-slate-850 dark:text-white"
                          />
                          <span className="text-[10px] text-slate-400">KG</span>
                        </div>
                      ) : pr.currentStock !== undefined ? (
                        <span className={`font-mono text-sm font-bold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                          {pr.currentStock.toFixed(2)} KG
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium italic">
                          {lang === 'hi' ? 'ट्रेस नहीं' : 'Not Tracked'}
                        </span>
                      )}
                    </td>

                    {/* Min Alert Threshold */}
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            value={editThresholdVal}
                            placeholder="KG"
                            onChange={(e) => setEditThresholdVal(e.target.value)}
                            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 font-mono w-20 text-xs text-slate-850 dark:text-white"
                          />
                          <span className="text-[10px] text-slate-400">KG</span>
                        </div>
                      ) : pr.minThreshold !== undefined ? (
                        <span className="font-mono text-slate-600 dark:text-slate-300">
                          {pr.minThreshold.toFixed(2)} KG
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium italic">
                          {lang === 'hi' ? 'कटौती नहीं' : 'Not Set'}
                        </span>
                      )}
                    </td>

                    {/* Status indicator badge */}
                    <td className="px-4 py-3.5 text-center">
                      {pr.currentStock === undefined || pr.minThreshold === undefined ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-900/50 text-slate-400">
                          -
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 animate-pulse">
                          {lang === 'hi' ? 'कम स्टॉक' : 'Low Stock'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                          {lang === 'hi' ? 'सुरक्षित' : 'Healthy'}
                        </span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="px-4 py-3.5 text-right">
                      {isEditing ? (
                        <div className="flex gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound(settings.soundEnabled);
                              setEditingPresetId(null);
                            }}
                            className="p-1 px-2 border border-slate-200 dark:border-slate-705 bg-white dark:bg-slate-900 rounded-lg text-slate-500 dark:text-slate-400 cursor-pointer text-[10px]"
                          >
                            ✕
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStockAndThreshold(pr.id)}
                            className="p-1 px-2 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 flex items-center gap-1 text-[10px]"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{lang === 'hi' ? 'बचाएं' : 'Save'}</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound(settings.soundEnabled);
                            setEditingPresetId(pr.id);
                            setEditStockVal(pr.currentStock !== undefined ? String(pr.currentStock) : '');
                            setEditThresholdVal(pr.minThreshold !== undefined ? String(pr.minThreshold) : '');
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/55 dark:bg-slate-900/40 dark:border-slate-800 dark:hover:bg-slate-850 rounded-lg text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{lang === 'hi' ? 'बदलें' : 'Edit'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simplified Recent history list */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('recentWeighings')}</h2>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => {
                playClickSound(settings.soundEnabled);
                onNavigate('history');
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {lang === 'hi' ? 'बहीखाता देखें' : 'View Ledger'}
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center gap-3">
            <Scale className="w-12 h-12 stroke-1 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium">{t('noRecentWeighings')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 3).map((item) => {
              const dateObj = new Date(item.timestamp);
              const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl gap-3 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700 p-2.5 rounded-xl block mt-0.5">
                      {item.type === 'tarazu' ? '⚖️' : item.type === 'converter' ? '🔄' : item.type === 'calculator' ? '🧮' : '📈'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded uppercase">
                          {item.type}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium">
                          {formattedTime}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 text-sm sm:text-base">
                        {item.label}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => copyToClipboard(item.label, item.id)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
                      title={t('copy')}
                    >
                      {copiedId === item.id ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <WithReceiptCopyIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleShare(item.type.toUpperCase() + ' - Tarazu', item.label)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer"
                      title={t('share')}
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        onDeleteHistoryItem(item.id);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WithReceiptCopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
