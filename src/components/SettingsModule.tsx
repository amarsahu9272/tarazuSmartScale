import React, { useState } from 'react';
import { Settings, Save, Smartphone, Map, Volume2, Star, RefreshCcw, Landmark, Sparkles, CheckCircle } from 'lucide-react';
import { Language, AppSettings } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';

interface SettingsModuleProps {
  lang: Language;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetAllData: () => void;
}

export default function SettingsModule({
  lang,
  settings,
  onUpdateSettings,
  onResetAllData,
}: SettingsModuleProps) {
  const t = translate(lang);

  // Buffer States
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopPhone, setShopPhone] = useState(settings.shopPhone);
  const [shopGst, setShopGst] = useState(settings.shopGst);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [decimalPrecision, setDecimalPrecision] = useState<number>(settings.decimalPrecision);
  const [darkMode, setDarkMode] = useState(settings.darkMode);

  const [savingFlashing, setSavingFlashing] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    playSuccessSound(soundEnabled);
    setSavingFlashing(true);

    onUpdateSettings({
      language: lang,
      darkMode,
      soundEnabled,
      decimalPrecision,
      shopName,
      shopPhone,
      shopGst,
    });

    setTimeout(() => setSavingFlashing(false), 2000);
  };

  const handleToggleDarkMode = (checked: boolean) => {
    playClickSound(soundEnabled);
    setDarkMode(checked);
    onUpdateSettings({
      ...settings,
      darkMode: checked,
    });
  };

  const handleToggleSound = (checked: boolean) => {
    playClickSound(checked);
    setSoundEnabled(checked);
    onUpdateSettings({
      ...settings,
      soundEnabled: checked,
    });
  };

  const handleLanguageChange = (newLang: Language) => {
    playSuccessSound(soundEnabled);
    onUpdateSettings({
      ...settings,
      language: newLang,
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Dynamic Header Builder Form */}
      <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            {t('shopReceiptHeader')}
          </h3>
          {savingFlashing && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {t('saved')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
              {t('shopNameLabel')}
            </label>
            <input
              type="text"
              className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:border-emerald-500 font-semibold"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
              {t('shopPhoneLabel')}
            </label>
            <input
              type="tel"
              className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:border-emerald-500 font-mono"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
            {t('shopGstLabel')}
          </label>
          <input
            type="text"
            className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:border-emerald-500 font-mono"
            placeholder="e.g. 10AAAAA1111A1Z1"
            value={shopGst}
            onChange={(e) => setShopGst(e.target.value.toUpperCase())}
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-wider text-xs shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" /> {t('saveProfile')}
        </button>

      </form>

      {/* Global Application Tuning controls */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b pb-3">
          {t('businessSettings')}
        </h3>

        {/* Translation toggles */}
        <div className="flex justify-between items-center py-2">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Bilingual Translation Setup</p>
            <p className="text-xs text-slate-400">Choose between English and हिन्दी labels</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${lang === 'en' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500'}`}
            >
              English
            </button>
            <button
              onClick={() => handleLanguageChange('hi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${lang === 'hi' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500'}`}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Dark Mode toggle */}
        <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-slate-850">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('darkModeLabel')}</p>
            <p className="text-xs text-slate-400">Dim visual contrast for safety after evening hours</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={darkMode}
              onChange={(e) => handleToggleDarkMode(e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-950/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Sound toggle */}
        <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-slate-850">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('soundControl')}</p>
            <p className="text-xs text-slate-400">Generate high-fidelity tactile click beeps during typing</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={soundEnabled}
              onChange={(e) => handleToggleSound(e.target.checked)}
            />
            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-950/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {/* Decimal Selector */}
        <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-slate-850">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('decimalPrecisionLabel')}</p>
            <p className="text-xs text-slate-400">Set floating-point decimals to display</p>
          </div>
          <select
            value={decimalPrecision}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setDecimalPrecision(val);
              playClickSound(soundEnabled);
              onUpdateSettings({ ...settings, decimalPrecision: val });
            }}
            className="p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl"
          >
            <option value="1">1 Place (.0)</option>
            <option value="2">2 Places (.00)</option>
            <option value="3">3 Places (.000)</option>
            <option value="4">4 Places (.0000)</option>
          </select>
        </div>

        {/* Severe full Reset action */}
        <div className="pt-4 border-t border-rose-100 dark:border-rose-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Storage Flush Controls</p>
            <p className="text-xs text-slate-400 mt-0.5">This destroys all local transaction lists and custom rate presets permanently.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm('CRITICAL: This deletes all transaction logs and custom presets and resets the application. Continue?')) {
                onResetAllData();
              }
            }}
            className="py-2.5 px-4 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto"
          >
            Flush App Data
          </button>
        </div>

      </div>

    </div>
  );
}
