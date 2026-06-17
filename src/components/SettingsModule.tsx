import React, { useState, useRef } from 'react';
import { Settings, Save, Smartphone, Map, Volume2, Star, RefreshCcw, Landmark, Sparkles, CheckCircle, Download, Upload, AlertTriangle, Trash2, FileText } from 'lucide-react';
import { Language, AppSettings, HistoryItem } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { saveStoredPresets, saveStoredCategories } from '../utils/storage';

interface SettingsModuleProps {
  lang: Language;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetAllData: () => void;
  onRestoreAllData: (settings: AppSettings, history: HistoryItem[]) => void;
}

export default function SettingsModule({
  lang,
  settings,
  onUpdateSettings,
  onResetAllData,
  onRestoreAllData,
}: SettingsModuleProps) {
  const t = translate(lang);

  // Buffer States
  const [shopName, setShopName] = useState(settings.shopName);
  const [shopPhone, setShopPhone] = useState(settings.shopPhone);
  const [shopGst, setShopGst] = useState(settings.shopGst);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [decimalPrecision, setDecimalPrecision] = useState<number>(settings.decimalPrecision);
  const [darkMode, setDarkMode] = useState(settings.darkMode);
  const [preferredCurrency, setPreferredCurrency] = useState(settings.preferredCurrency || '₹');
  const [batterySaver, setBatterySaver] = useState(settings.batterySaver || false);
  const [shopLogo, setShopLogo] = useState(settings.shopLogo || '');

  React.useEffect(() => {
    setShopName(settings.shopName);
    setShopPhone(settings.shopPhone);
    setShopGst(settings.shopGst);
    setSoundEnabled(settings.soundEnabled);
    setDecimalPrecision(settings.decimalPrecision);
    setDarkMode(settings.darkMode);
    setPreferredCurrency(settings.preferredCurrency || '₹');
    setBatterySaver(settings.batterySaver || false);
    setShopLogo(settings.shopLogo || '');
  }, [settings]);

  const [savingFlashing, setSavingFlashing] = useState(false);

  // Backup & Restore states
  const [dragActive, setDragActive] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<any>(null);
  const [backupFileName, setBackupFileName] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      preferredCurrency,
      batterySaver,
      shopLogo,
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

  const handleToggleBatterySaver = (checked: boolean) => {
    playClickSound(soundEnabled);
    setBatterySaver(checked);
    onUpdateSettings({
      ...settings,
      batterySaver: checked,
    });
  };

  const handleLanguageChange = (newLang: Language) => {
    playSuccessSound(soundEnabled);
    onUpdateSettings({
      ...settings,
      language: newLang,
    });
  };

  const handleDownloadBackup = () => {
    playClickSound(soundEnabled);
    try {
      const backupData = {
        tarazu_settings: localStorage.getItem('tarazu_settings') ? JSON.parse(localStorage.getItem('tarazu_settings')!) : null,
        tarazu_history: localStorage.getItem('tarazu_history') ? JSON.parse(localStorage.getItem('tarazu_history')!) : null,
        tarazu_preset_rates: localStorage.getItem('tarazu_preset_rates') ? JSON.parse(localStorage.getItem('tarazu_preset_rates')!) : null,
        tarazu_preset_categories: localStorage.getItem('tarazu_preset_categories') ? JSON.parse(localStorage.getItem('tarazu_preset_categories')!) : null,
        exportedAt: new Date().toISOString(),
        appId: 'tarazu-smart-scale'
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `tarazu_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export backup', e);
      alert(lang === 'hi' ? 'बैकअप डाउनलोड करने में विफल!' : 'Failed to download backup!');
    }
  };

  const parseBackupContent = (content: string, fileName: string) => {
    try {
      const data = JSON.parse(content);
      // Validate structure
      if (!data || typeof data !== 'object') {
        throw new Error(lang === 'hi' ? 'अमान्य फ़ाइल प्रारूप। JSON फ़ाइल होनी चाहिए।' : 'Invalid file format. Must be a JSON file.');
      }

      const hasSettings = data.tarazu_settings && typeof data.tarazu_settings === 'object';
      const hasHistory = Array.isArray(data.tarazu_history);
      const isAppIdMatched = data.appId === 'tarazu-smart-scale';

      if (!hasSettings && !hasHistory && !isAppIdMatched) {
        throw new Error(lang === 'hi' ? 'यह एक सही टारज़ू बैकअप फ़ाइल नहीं है।' : 'This file does not contain valid Tarazu backup data.');
      }

      setParsedBackup(data);
      setBackupFileName(fileName);
      setRestoreError('');
      setImportSuccess(true);
      playSuccessSound(soundEnabled);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      setRestoreError(e.message || (lang === 'hi' ? 'फ़ाइल को पढ़ने या पार्स करने में त्रुटि।' : 'Error reading or parsing the file.'));
      setParsedBackup(null);
      setBackupFileName('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setRestoreError(lang === 'hi' ? 'केवल JSON बैकअप फाइलें स्वीकृत हैं।' : 'Only JSON backup files are accepted.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          parseBackupContent(event.target.result, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          parseBackupContent(event.target.result, file.name);
        }
      };
      reader.readAsText(file);
    }
  };

  const executeRestore = () => {
    if (!parsedBackup) return;
    playClickSound(soundEnabled);

    const warnMsg = lang === 'hi'
      ? 'क्या आप निश्चित रूप से बैकअप को रीस्टोर करना चाहते हैं? यह आपके सभी वर्तमान डेटा को मिटा देगा।'
      : 'Are you sure you want to restore the backup? This will overwrite all your current data.';
    
    if (!confirm(warnMsg)) return;

    try {
      // 1. Settings
      let restoredSettings = settings;
      if (parsedBackup.tarazu_settings) {
        restoredSettings = parsedBackup.tarazu_settings;
        localStorage.setItem('tarazu_settings', JSON.stringify(restoredSettings));
        
        // Try setting theme
        if (restoredSettings.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        if (restoredSettings.batterySaver) {
          document.documentElement.classList.add('battery-saver');
        } else {
          document.documentElement.classList.remove('battery-saver');
        }
      }

      // 2. History
      let restoredHistory: HistoryItem[] = [];
      if (Array.isArray(parsedBackup.tarazu_history)) {
        restoredHistory = parsedBackup.tarazu_history;
        localStorage.setItem('tarazu_history', JSON.stringify(restoredHistory));
      }

      // 3. Preset rates
      if (Array.isArray(parsedBackup.tarazu_preset_rates)) {
        saveStoredPresets(parsedBackup.tarazu_preset_rates);
      }

      // 4. Preset categories
      if (Array.isArray(parsedBackup.tarazu_preset_categories)) {
        saveStoredCategories(parsedBackup.tarazu_preset_categories);
      }

      // Success
      alert(lang === 'hi' ? 'पूरा बैकअप सफलतापूर्वक रीस्टोर किया गया!' : 'Entire backup restored successfully!');
      
      // Update app state
      onRestoreAllData(restoredSettings, restoredHistory);

      // Reset local component state
      setParsedBackup(null);
      setBackupFileName('');
      setRestoreError('');
    } catch (err) {
      console.error(err);
      alert(lang === 'hi' ? 'रीस्टोर प्रक्रिया में विफलता!' : 'Failed during restore process!');
    }
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

        {/* Brand Logo Picker */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/50">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
            {lang === 'hi' ? 'दुकान ब्रांड लोगो (Shop Logo)' : 'Shop Brand Logo'}
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left side: Upload or presets selection */}
            <div className="space-y-3">
              {/* Presets List */}
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                {lang === 'hi' ? 'तैयार लोगो चुनें:' : 'Select Preset Emblem:'}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { value: '🏬', label: lang === 'hi' ? 'दुकान' : 'Store' },
                  { value: '⚖️', label: lang === 'hi' ? 'तराजू' : 'Scale' },
                  { value: '🛒', label: lang === 'hi' ? 'कार्ट' : 'Cart' },
                  { value: '🛍️', label: lang === 'hi' ? 'थैला' : 'Bag' },
                  { value: '📦', label: lang === 'hi' ? 'पार्सल' : 'Box' },
                  { value: '🌾', label: lang === 'hi' ? 'राशन' : 'Grocery' },
                  { value: '🏷️', label: lang === 'hi' ? 'टैग' : 'Tag' },
                  { value: '⭐', label: lang === 'hi' ? 'स्टार' : 'Star' },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      playClickSound(soundEnabled);
                      setShopLogo(p.value);
                    }}
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer ${
                      shopLogo === p.value
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850'
                    }`}
                  >
                    <span className="text-lg">{p.value}</span>
                    <span className="text-[9px] font-semibold truncate max-w-full">{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Upload field */}
              <div className="pt-2">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                  {lang === 'hi' ? 'या अपना कस्टम लोगो इमेज अपलोड करें:' : 'Or Upload Custom Logo Image:'}
                </div>
                
                <div className="flex items-center gap-3">
                  <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 transform -rotate-180" />
                    <span>{lang === 'hi' ? 'लोगो अपलोड करें' : 'Upload Image'}</span>
                    <input
                      type="file"
                      id="upload-shop-logo"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            if (typeof reader.result === 'string') {
                              setShopLogo(reader.result);
                              playSuccessSound(soundEnabled);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  
                  {shopLogo && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound(soundEnabled);
                        setShopLogo('');
                      }}
                      className="text-xs text-rose-600 dark:text-rose-450 font-bold hover:underline cursor-pointer"
                    >
                      {lang === 'hi' ? 'लोगो हटाएं' : 'Remove Logo'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Preview Card */}
            <div className="border border-dashed border-slate-350 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-900/10 min-h-[140px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
                {lang === 'hi' ? 'लोगो ब्रांड प्रीव्यू' : 'Logo Preview'}
              </div>
              
              {shopLogo ? (
                shopLogo.startsWith('data:image/') || shopLogo.startsWith('http') ? (
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden border bg-white shadow-sm flex items-center justify-center p-2">
                    <img
                      src={shopLogo}
                      alt="Shop Logo"
                      className="max-w-full max-h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 border text-4xl shadow-sm flex items-center justify-center select-none">
                    {shopLogo}
                  </div>
                )
              ) : (
                <div className="text-center text-slate-350 dark:text-slate-650 flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-slate-350 dark:border-slate-800 flex items-center justify-center text-lg text-slate-450">
                    ❓
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wide">
                    {lang === 'hi' ? 'कोई लोगो चयनित नहीं है' : 'No Logo Selected'}
                  </span>
                </div>
              )}
            </div>
          </div>
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

        {/* Battery Saver toggle */}
        <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-slate-850">
          <div className="max-w-[70%] text-left">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t('batterySaverMode')}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{t('batterySaverDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={batterySaver}
              onChange={(e) => handleToggleBatterySaver(e.target.checked)}
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
            className="p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="1">1 Place (.0)</option>
            <option value="2">2 Places (.00)</option>
            <option value="3">3 Places (.000)</option>
            <option value="4">4 Places (.0000)</option>
          </select>
        </div>

        {/* Preferred Currency Selector */}
        <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-slate-850">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {lang === 'hi' ? 'पसंदीदा मुद्रा' : 'Preferred Currency'}
            </p>
            <p className="text-xs text-slate-400">
              {lang === 'hi' ? 'सभी मूल्य स्क्रीन और रसीद पर प्रदर्शित होने वाला प्रतीक' : 'Symbol displayed on all price screens and receipts'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={['₹', '$', '€', '£', '¥', '৳', 'Rp', 'AED', 'đ'].includes(preferredCurrency) ? preferredCurrency : 'other'}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'other') {
                  setPreferredCurrency('');
                  onUpdateSettings({ ...settings, preferredCurrency: '' });
                } else {
                  setPreferredCurrency(val);
                  onUpdateSettings({ ...settings, preferredCurrency: val });
                }
                playClickSound(soundEnabled);
              }}
              className="p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="₹">Rupee (₹)</option>
              <option value="$">Dollar ($)</option>
              <option value="€">Euro (€)</option>
              <option value="£">Pound (£)</option>
              <option value="¥">Yen/Yuan (¥)</option>
              <option value="৳">Taka (৳)</option>
              <option value="Rp">Rupiah (Rp)</option>
              <option value="AED">Dirham (AED)</option>
              <option value="đ">Dong (đ)</option>
              <option value="other">Custom...</option>
            </select>
            {(!['₹', '$', '€', '£', '¥', '৳', 'Rp', 'AED', 'đ'].includes(preferredCurrency) || preferredCurrency === '') && (
              <input
                type="text"
                maxLength={5}
                className="w-14 p-1.5 text-center bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 font-black text-xs rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 outline-none focus:ring-1 focus:ring-emerald-500/50"
                value={preferredCurrency}
                placeholder="Sym"
                title="Enter custom currency symbol"
                onChange={(e) => {
                  const val = e.target.value;
                  setPreferredCurrency(val);
                  onUpdateSettings({ ...settings, preferredCurrency: val });
                }}
              />
            )}
          </div>
        </div>

        {/* Full App Backup & Restore Hub */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
              <RefreshCcw className="w-4 h-4 text-emerald-600 animate-none" />
              {lang === 'hi' ? 'बैकअप और रीस्टोर हब' : 'Backup & Restore Hub'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'hi' 
                ? 'डेटा सुरक्षा के लिए अपने बहीखाता इतिहास और सेटिंग्स को सुरक्षित रखें और पुनर्स्थापित करें।'
                : 'Securely safeguard and dynamic-recover your entire ledger history, presets, and active settings.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Section */}
            <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-1">
                  {lang === 'hi' ? 'डेटा एक्सपोर्ट' : 'Export Data'}
                </span>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
                  {lang === 'hi'
                    ? 'अपनी सभी सेटिंग्स, ट्रांजैक्शन बहीखाता सूची, कस्टम रेट प्रीसेट और श्रेणियों को एक `.json` बैकअप फाइल में डाउनलोड करें।'
                    : 'Download your dynamic settings, full transaction logs, products rate presets, and category definitions as a `.json` backup.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border border-emerald-250 dark:border-emerald-850 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'hi' ? 'बैकअप डाउनलोड करें' : 'Download Backup'}</span>
              </button>
            </div>

            {/* Import / Restore Section */}
            <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800 p-4 rounded-2xl flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-505 uppercase tracking-widest block mb-1">
                  {lang === 'hi' ? 'डेटा रीस्टोर' : 'Restore Data'}
                </span>
                
                {/* Drag and Drop Zone / File Input Area */}
                {!parsedBackup ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      dragActive
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500 hover:bg-slate-100/30 dark:hover:bg-slate-950/20'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept=".json,application/json"
                      className="hidden"
                    />
                    <Upload className="mx-auto w-6 h-6 text-slate-400 dark:text-slate-500 mb-1.5" />
                    
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {lang === 'hi' ? 'फ़ाइल चुनें या यहाँ रीस्टोर करें' : 'Choose file or drag here to restore'}
                    </p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5 font-mono">
                      tarazu_backup_xxxx.json
                    </p>
                    {restoreError && (
                      <p className="text-[10px] font-bold text-rose-500 mt-1.5 bg-rose-50 dark:bg-rose-950/30 px-2 py-1 rounded-md border border-rose-100 dark:border-rose-900/40">
                        ⚠️ {restoreError}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Verified loaded backup preview card */
                  <div className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-bold truncate max-w-[190px]" title={backupFileName}>
                        {backupFileName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-slate-50 dark:bg-slate-950/40 p-2 rounded-lg border border-slate-150 dark:border-slate-800 font-bold text-slate-650 dark:text-slate-400">
                      <div>
                        {lang === 'hi' ? 'दुकान का नाम:' : 'Shop Name:'}
                        <span className="text-slate-850 dark:text-slate-200 block truncate">
                          {parsedBackup.tarazu_settings?.shopName || 'Mera Kirana'}
                        </span>
                      </div>
                      <div>
                        {lang === 'hi' ? 'ट्रांजैक्शन इतिहास:' : 'Total Ledger:'}
                        <span className="text-emerald-600 dark:text-emerald-400 block font-mono">
                          {Array.isArray(parsedBackup.tarazu_history) ? `${parsedBackup.tarazu_history.length} items` : '0 items'}
                        </span>
                      </div>
                      <div>
                        {lang === 'hi' ? 'कस्टम भाव दर:' : 'Custom Presets:'}
                        <span className="text-indigo-600 dark:text-indigo-400 block font-mono">
                          {Array.isArray(parsedBackup.tarazu_preset_rates) ? `${parsedBackup.tarazu_preset_rates.length} rates` : '0 rates'}
                        </span>
                      </div>
                      <div>
                        {lang === 'hi' ? 'बैकअप तिथि:' : 'Exported At:'}
                        <span className="text-slate-700 dark:text-slate-400 block truncate font-mono">
                          {parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound(soundEnabled);
                          setParsedBackup(null);
                          setBackupFileName('');
                          setRestoreError('');
                        }}
                        className="flex-1 py-1 px-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-850 transition-colors"
                      >
                        {lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={executeRestore}
                        className="flex-1 py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
                      >
                        {lang === 'hi' ? 'पुष्टि करें' : 'Restore'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* App Download Link */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {lang === 'hi' ? 'मोबाइल ऐप डाउनलोड' : 'Mobile App Download'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {lang === 'hi' 
                ? 'बेहतर उपयोग और आसान पहुंच के लिए टारज़ू एंड्रॉइड (Android) एप डाउनलोड करें।' 
                : 'Download the Tarazu Android app for easy, dedicated access on your mobile device.'}
            </p>
          </div>
          <a
            href="https://drive.google.com/file/d/17mXLaAYtEn3-H5Aco3vbTiW1p_kHSK8m/view"
            target="_blank"
            rel="noopener noreferrer"
            id="btn-download-app"
            onClick={() => playClickSound(soundEnabled)}
            className="py-2.5 px-4 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 border border-amber-250 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto flex items-center gap-1.5 justify-center"
          >
            <Smartphone className="w-4 h-4" />
            {lang === 'hi' ? 'ऐप डाउनलोड करें' : 'Download App'}
          </a>
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
