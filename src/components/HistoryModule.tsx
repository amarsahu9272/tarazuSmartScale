import React, { useState } from 'react';
import { History, Search, Trash2, Download, Filter, Calendar, RefreshCcw, FileText, CheckCircle } from 'lucide-react';
import { Language, HistoryItem, AppSettings } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';

interface HistoryModuleProps {
  lang: Language;
  settings: AppSettings;
  history: HistoryItem[];
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

export default function HistoryModule({
  lang,
  settings,
  history,
  onDeleteItem,
  onClearAll,
}: HistoryModuleProps) {
  const t = translate(lang);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'tarazu' | 'converter' | 'calculator' | 'business'>('all');

  // Filter & Search ledger
  const filteredHistory = history.filter((item) => {
    const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
    const matchesSearch =
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleExportCSV = () => {
    playSuccessSound(settings.soundEnabled);
    if (history.length === 0) return;

    // Build CSV Content
    let csvContent = 'ID,Timestamp,Date,Category,Calculation Description\n';
    history.forEach((item, index) => {
      const dateStr = new Date(item.timestamp).toLocaleString().replace(/,/g, '');
      const desc = item.label.replace(/"/g, '""');
      csvContent += `"${index + 1}","${item.timestamp}","${dateStr}","${item.type.toUpperCase()}","${desc}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Tarazu_Ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Search and export actions header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
        
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-3 flex items-center pr-2 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder={t('search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium rounded-xl outline-none focus:border-emerald-500 text-slate-850 dark:text-white"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {history.length > 0 && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                {t('exportCsv')}
              </button>

              <button
                onClick={() => {
                  if (confirm(lang === 'hi' ? 'क्या आप बहीखाता की सभी प्रविष्टियों को हटाना चाहते हैं?' : 'Are you sure you want to flush all records?')) {
                    playClickSound(settings.soundEnabled);
                    onClearAll();
                  }
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {t('clearAll')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Categorized Filter Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl overflow-x-auto gap-1 border">
        {[
          { id: 'all', label: t('filterAll') },
          { id: 'tarazu', label: t('filterWeighs') },
          { id: 'converter', label: t('filterConversions') },
          { id: 'calculator', label: t('filterCalc') },
          { id: 'business', label: t('filterBiz') },
        ].map((filt) => (
          <button
            key={filt.id}
            onClick={() => {
              playClickSound(settings.soundEnabled);
              setActiveFilter(filt.id as any);
            }}
            className={`
              px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer
              ${
                activeFilter === filt.id
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }
            `}
          >
            {filt.label}
          </button>
        ))}
      </div>

      {/* Ledger Body items */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm">
        
        {filteredHistory.length === 0 ? (
          <div className="text-center py-16 text-slate-400 flex flex-col items-center justify-center gap-4">
            <History className="w-16 h-16 stroke-1 text-slate-250 dark:text-slate-700 animate-none" />
            <p className="font-semibold text-sm">{t('noHistory')}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-4">
            {filteredHistory.map((item, index) => {
              const dateObj = new Date(item.timestamp);
              const formattedDate = dateObj.toLocaleDateString();
              const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-4 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="text-xl bg-slate-50 dark:bg-slate-900 border p-2.5 rounded-xl block shadow-sm">
                      {item.type === 'tarazu' ? '⚖️' : item.type === 'converter' ? '🔄' : item.type === 'calculator' ? '🧮' : '📊'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-bold font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase">
                          {item.type}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tracking-wide flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formattedDate} {formattedTime}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 text-sm sm:text-base leading-relaxed break-words">
                        {item.label}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      onDeleteItem(item.id);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors shrink-0 cursor-pointer"
                    title={t('delete')}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
