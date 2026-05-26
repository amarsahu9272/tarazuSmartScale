import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Share2, Copy, CheckCircle, Scale, Plus, Trash2, Volume2, Sparkles } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { isSpeechSupported, startSpeechListening } from '../utils/speech';
import { getStoredPresets, saveStoredPresets, PresetRate } from '../utils/storage';
import NumericKeypad from './NumericKeypad';

const PRESET_CATEGORIES = [
  { id: 'Vegetables', en: 'Vegetables', hi: 'सब्जियाँ' },
  { id: 'Grains', en: 'Grains', hi: 'अनाज' },
  { id: 'Dairy', en: 'Dairy', hi: 'डेयरी' },
  { id: 'Fruits', en: 'Fruits', hi: 'फल' },
  { id: 'Spices', en: 'Spices', hi: 'मसाले' },
  { id: 'Others', en: 'Others', hi: 'अन्य' }
];

interface TarazuModuleProps {
  lang: Language;
  settings: AppSettings;
  onAddHistoryItem: (item: HistoryItemInput) => void;
}

export default function TarazuModule({
  lang,
  settings,
  onAddHistoryItem,
}: TarazuModuleProps) {
  const t = translate(lang);
  
  // Modes: 
  // 'amount_to_weight' (₹ -> KG)
  // 'weight_to_amount' (KG -> ₹)
  const [mode, setMode] = useState<'amount_to_weight' | 'weight_to_amount'>('amount_to_weight');
  
  // States
  const [rate, setRate] = useState('80'); // ₹ per KG
  const [amount, setAmount] = useState('120'); // Target purchase money
  
  // For Weight -> Amount mode
  const [weightKg, setWeightKg] = useState('1');
  const [weightG, setWeightG] = useState('500');

  // Input Focus State to direct numeric keypad inputs
  // 'rate' | 'amount' | 'kg' | 'g'
  const [activeInput, setActiveInput] = useState<'rate' | 'amount' | 'kg' | 'g'>('amount');

  // Load preset rates
  const [presets, setPresets] = useState<PresetRate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetRate, setNewPresetRate] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState<string>('Vegetables');
  const [showAddPresetForm, setShowAddPresetForm] = useState(false);

  // Voice Listening State
  const [isListening, setIsListening] = useState(false);
  const [voiceLog, setVoiceLog] = useState('');

  // Floating receipt flash state
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Load presets on mount
  useEffect(() => {
    setPresets(getStoredPresets());
  }, []);

  // Filter presets based on selected category filter
  const filteredPresets = presets.filter((pr) => {
    if (selectedCategory === 'All') return true;
    return (pr.category || 'Others') === selectedCategory;
  });

  // Sync inputs based on active field and trigger automatic calculation
  const calculatedOutput = (() => {
    const r = parseFloat(rate) || 0;
    
    if (mode === 'amount_to_weight') {
      const amt = parseFloat(amount) || 0;
      if (r <= 0 || amt <= 0) return { kg: 0, g: 0, totalKg: 0 };
      
      const totalKg = amt / r;
      const kg = Math.floor(totalKg);
      // Round to nearest gram
      const g = Math.round((totalKg - kg) * 1000);
      return { kg, g, totalKg };
    } else {
      const kgVal = parseFloat(weightKg) || 0;
      const gVal = parseFloat(weightG) || 0;
      if (r <= 0 || (kgVal <= 0 && gVal <= 0)) return { totalPrice: 0 };
      
      const totalKg = kgVal + (gVal / 1000);
      const totalPrice = totalKg * r;
      return { totalPrice };
    }
  })();

  const handlePresetSelect = (preset: PresetRate) => {
    playClickSound(settings.soundEnabled);
    setRate(String(preset.rate));
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName || !newPresetRate) return;
    const rateVal = parseFloat(newPresetRate);
    if (isNaN(rateVal) || rateVal <= 0) return;

    const newPr: PresetRate = {
      id: Date.now().toString(),
      name: newPresetName,
      nameHi: newPresetName,
      rate: rateVal,
      category: newPresetCategory,
    };

    const updated = [...presets, newPr];
    setPresets(updated);
    saveStoredPresets(updated);
    setNewPresetName('');
    setNewPresetRate('');
    setShowAddPresetForm(false);
    playSuccessSound(settings.soundEnabled);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);
    saveStoredPresets(updated);
    playClickSound(settings.soundEnabled);
  };

  const handleInputChange = (field: 'rate' | 'amount' | 'kg' | 'g', valueStr: string) => {
    if (field === 'rate') setRate(valueStr);
    else if (field === 'amount') setAmount(valueStr);
    else if (field === 'kg') setWeightKg(valueStr);
    else if (field === 'g') setWeightG(valueStr);
  };

  // Sound play on manual focus
  const handleFocus = (field: 'rate' | 'amount' | 'kg' | 'g') => {
    playClickSound(settings.soundEnabled);
    setActiveInput(field);
  };

  // Quick preset shortcuts
  const selectQuickAmount = (val: number) => {
    playClickSound(settings.soundEnabled);
    setAmount(String(val));
    setActiveInput('amount');
  };

  const selectQuickWeight = (kg: number, g: number) => {
    playClickSound(settings.soundEnabled);
    setWeightKg(String(kg));
    setWeightG(String(g));
    setActiveInput('kg');
  };

  const handleSaveCalculation = () => {
    playSuccessSound(settings.soundEnabled);
    const r = parseFloat(rate) || 0;

    if (mode === 'amount_to_weight') {
      const amt = parseFloat(amount) || 0;
      const out = calculatedOutput as { kg: number, g: number, totalKg: number };
      if (r > 0 && amt > 0) {
        onAddHistoryItem({
          type: 'tarazu',
          mode: 'amount_to_weight',
          rate: r,
          inputAmount: amt,
          resultKg: out.kg,
          resultG: out.g,
          label: `${lang === 'hi' ? 'खरीद' : 'Buy'} ₹${amt} @ ₹${r}/KG → Weight: ${out.kg} KG ${out.g} G`,
        });
      }
    } else {
      const kgVal = parseFloat(weightKg) || 0;
      const gVal = parseFloat(weightG) || 0;
      const out = calculatedOutput as { totalPrice: number };
      if (r > 0 && (kgVal > 0 || gVal > 0)) {
        onAddHistoryItem({
          type: 'tarazu',
          mode: 'weight_to_amount',
          rate: r,
          inputKg: kgVal,
          inputG: gVal,
          resultAmount: Number(out.totalPrice.toFixed(settings.decimalPrecision)),
          label: `${lang === 'hi' ? 'वजन' : 'Weigh'} ${kgVal} KG ${gVal} G @ ₹${r}/KG → Price: ₹${out.totalPrice.toFixed(settings.decimalPrecision)}`,
        });
      }
    }
  };

  // Generate gorgeous digital billing receipt text
  const getReceiptText = () => {
    const prec = settings.decimalPrecision;
    const dateStr = new Date().toLocaleString();
    let text = `-----------------------------\n`;
    text += `   ${settings.shopName.toUpperCase()}\n`;
    if (settings.shopPhone) text += `   Contact: +91-${settings.shopPhone}\n`;
    if (settings.shopGst) text += `   GSTIN: ${settings.shopGst}\n`;
    text += `-----------------------------\n`;
    text += ` DATE: ${dateStr}\n`;
    text += ` ITEM CALCULATION (Tarazu)\n`;
    text += `-----------------------------\n`;
    text += ` Price Rate  : ₹${rate}/KG\n`;
    
    if (mode === 'amount_to_weight') {
      const out = calculatedOutput as { kg: number, g: number };
      text += ` Paid Amount : ₹${amount}\n`;
      text += `-----------------------------\n`;
      text += ` DELIVER WEIGHT: ${out.kg} KG ${out.g} GM\n`;
    } else {
      const out = calculatedOutput as { totalPrice: number };
      text += ` Weight      : ${weightKg} KG ${weightG} GM\n`;
      text += `-----------------------------\n`;
      text += ` TOTAL BILL  : ₹${out.totalPrice.toFixed(prec)}\n`;
    }
    text += `-----------------------------\n`;
    text += `  ✨ Thank you for visiting! ✨\n`;
    text += `     Power of Tarazu Digital\n`;
    text += `-----------------------------\n`;
    return text;
  };

  const handleCopyToClipboard = () => {
    const text = getReceiptText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    playSuccessSound(settings.soundEnabled);
    setTimeout(() => setCopied(false), 2000);
    
    // Save to ledger automatically on copy
    handleSaveCalculation();
  };

  const handleShareReceipt = async () => {
    playClickSound(settings.soundEnabled);
    const receiptText = getReceiptText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${settings.shopName} Smart Invoice`,
          text: receiptText,
        });
      } catch (e) {
        console.warn('Share cancelled', e);
      }
    } else {
      navigator.clipboard.writeText(receiptText);
      alert(lang === 'hi' ? 'रसीद क्लिपबोर्ड पर कॉपी हुई!' : 'Receipt copied to clipboard!');
    }
    
    // Save to scale ledger automatically on share
    handleSaveCalculation();
  };

  // Voice support
  const handleToggleVoice = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!isSpeechSupported()) {
      alert(t('voiceNotSupported'));
      return;
    }

    setIsListening(true);
    setVoiceLog(lang === 'hi' ? 'आवाज की प्रतीक्षा कर रहे हैं...' : 'Waiting for voice...');

    recognitionRef.current = startSpeechListening(
      lang,
      (result) => {
        setVoiceLog(result.transcript);
        if (result.numbers.length > 0) {
          playSuccessSound(settings.soundEnabled);
          if (mode === 'amount_to_weight') {
            if (result.numbers.length >= 2) {
              setRate(String(result.numbers[0]));
              setAmount(String(result.numbers[1]));
              setVoiceLog(`${t('rate')}: ${result.numbers[0]}, ${t('amount')}: ${result.numbers[1]}`);
            } else {
              // Set to currently active input
              handleInputChange(activeInput, String(result.numbers[0]));
              setVoiceLog(`${lang === 'hi' ? 'संख्या पहचानी गई' : 'Captured'}: ${result.numbers[0]}`);
            }
          } else {
            if (result.numbers.length >= 3) {
              setRate(String(result.numbers[0]));
              setWeightKg(String(result.numbers[1]));
              setWeightG(String(result.numbers[2]));
              setVoiceLog(`Rate: ${result.numbers[0]}, kg: ${result.numbers[1]}, g: ${result.numbers[2]}`);
            } else if (result.numbers.length >= 2) {
              setRate(String(result.numbers[0]));
              setWeightKg(String(result.numbers[1]));
            } else {
              handleInputChange(activeInput, String(result.numbers[0]));
            }
          }
        } else {
          setVoiceLog(lang === 'hi' ? 'कोई संख्या नहीं मिली।' : 'No digits detected.');
        }
      },
      (err) => {
        console.error('Voice input error', err);
        setVoiceLog(`Error: ${err}`);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
  };
  return (
    <div className="space-y-3 max-w-4xl mx-auto select-none">
      {/* Mode Switches */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
        <button
          onClick={() => {
            playClickSound(settings.soundEnabled);
            setMode('amount_to_weight');
            setActiveInput('amount');
          }}
          className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'amount_to_weight'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          {t('amountToWeight')}
        </button>
        <button
          onClick={() => {
            playClickSound(settings.soundEnabled);
            setMode('weight_to_amount');
            setActiveInput('kg');
          }}
          className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'weight_to_amount'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
          }`}
        >
          {t('weightToAmount')}
        </button>
      </div>

      {/* Main Grid: Responsive 2-column or tight unified mobile stack */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        
        {/* Left Column: LCD display indicator & Products presets */}
        <div className="space-y-3">
          
          {/* LCD/LED Industrial Indicator Screen with Clickable Interactive Inputs */}
          <div className="bg-slate-950 text-emerald-400 p-3.5 sm:p-4 rounded-xl border border-emerald-950 font-mono shadow-md relative overflow-hidden ring-2 ring-slate-900">
            <div className="absolute top-1.5 right-3 flex items-center gap-1.5 text-[9px] uppercase text-emerald-600 font-bold tracking-wider">
              {isListening ? (
                <span className="flex items-center gap-1 text-rose-500 bg-rose-950/20 px-1 py-0.5 rounded leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  {voiceLog ? voiceLog.substring(0, 16) : 'LISTENING'}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {lang === 'hi' ? 'लाइव कैलिब्रेटर' : 'Live Scale'}
                </span>
              )}
            </div>
            
            <p className="text-emerald-700 text-[9px] uppercase tracking-wider font-semibold font-sans">
              {mode === 'amount_to_weight' ? t('outputWeight') : t('outputAmount')}
            </p>

            <div className="mt-2.5 mb-1 flex flex-col justify-center items-center min-h-[64px] py-1">
              {mode === 'amount_to_weight' ? (
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-wider text-emerald-200">
                    {/* Scale calculation result */}
                    {(calculatedOutput as { kg: number }).kg} <span className="text-base text-emerald-500 font-bold">KG</span> {(calculatedOutput as { g: number }).g} <span className="text-base text-emerald-500 font-bold">GM</span>
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-1 font-sans font-medium">
                    Total: {((calculatedOutput as { totalKg: number }).totalKg || 0).toFixed(3)} KG
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-extrabold tracking-wider text-emerald-200">
                    ₹{((calculatedOutput as { totalPrice: number }).totalPrice || 0).toFixed(settings.decimalPrecision)}
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-1 font-sans font-medium">
                    Rate: ₹{rate}/KG × WEIGHT: {(parseFloat(weightKg) || 0) + ((parseFloat(weightG) || 0) / 1000)} KG
                  </p>
                </div>
              )}
            </div>

            {/* Interactive Tab-to-Edit Display Areas on scale dashboard */}
            <div className="border-t border-emerald-900/30 mt-3 pt-2 grid grid-cols-3 gap-1.5 text-[11px] font-sans">
              
              {/* Box 1: Price rate */}
              <div
                onClick={() => handleFocus('rate')}
                className={`cursor-pointer p-1 rounded-md border text-center transition-all ${
                  activeInput === 'rate'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-250 font-bold ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/40 border-transparent text-emerald-600/80 hover:bg-slate-900/60'
                }`}
              >
                <div className="text-[8px] uppercase tracking-wider text-emerald-700/80 font-bold">
                  {lang === 'hi' ? 'दर ₹/KG' : 'RATE ₹/KG'}
                </div>
                <div className="font-mono mt-0.5 truncate text-xs">
                  ₹{rate || '0'}{activeInput === 'rate' ? <span className="animate-pulse">|</span> : ''}
                </div>
              </div>

              {/* Box 2 & 3: Weight or Amount editors depending on Mode */}
              {mode === 'amount_to_weight' ? (
                <div
                  onClick={() => handleFocus('amount')}
                  className={`cursor-pointer p-1 rounded-md border text-center transition-all col-span-2 ${
                    activeInput === 'amount'
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-250 font-bold ring-1 ring-emerald-500/20'
                      : 'bg-slate-900/40 border-transparent text-emerald-600/80 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="text-[8px] uppercase tracking-wider text-emerald-700/80 font-bold">
                    {lang === 'hi' ? 'खरीद मूल्य बजट' : 'BUDGET AMOUNT'}
                  </div>
                  <div className="font-mono mt-0.5 truncate text-xs text-center">
                    ₹{amount || '0'}{activeInput === 'amount' ? <span className="animate-pulse">|</span> : ''}
                  </div>
                </div>
              ) : (
                <>
                  {/* Kilogram Editor */}
                  <div
                    onClick={() => handleFocus('kg')}
                    className={`cursor-pointer p-1 rounded-md border text-center transition-all ${
                      activeInput === 'kg'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-250 font-bold ring-1 ring-emerald-500/20'
                        : 'bg-slate-900/40 border-transparent text-emerald-600/80 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="text-[8px] uppercase tracking-wider text-emerald-700/80 font-bold">
                      {lang === 'hi' ? 'किलोग्राम (KG)' : 'WEIGHT KG'}
                    </div>
                    <div className="font-mono mt-0.5 truncate text-xs">
                      {weightKg || '0'}{activeInput === 'kg' ? <span className="animate-pulse">|</span> : ''} kg
                    </div>
                  </div>

                  {/* Gram Editor */}
                  <div
                    onClick={() => handleFocus('g')}
                    className={`cursor-pointer p-1 rounded-md border text-center transition-all ${
                      activeInput === 'g'
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-250 font-bold ring-1 ring-emerald-500/20'
                        : 'bg-slate-900/40 border-transparent text-emerald-600/80 hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="text-[8px] uppercase tracking-wider text-emerald-700/80 font-bold">
                      {lang === 'hi' ? 'ग्राम (GM)' : 'WEIGHT GM'}
                    </div>
                    <div className="font-mono mt-0.5 truncate text-xs">
                      {weightG || '0'}{activeInput === 'g' ? <span className="animate-pulse">|</span> : ''} g
                    </div>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Category Tabs Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none max-w-full text-[10px] sm:text-[11px]">
            <button
              type="button"
              onClick={() => {
                playClickSound(settings.soundEnabled);
                setSelectedCategory('All');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer flex-shrink-0 ${
                selectedCategory === 'All'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-650 dark:text-slate-300 border-slate-205 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              {lang === 'hi' ? `सभी (${presets.length})` : `All (${presets.length})`}
            </button>
            {PRESET_CATEGORIES.map((cat) => {
              const count = presets.filter(p => (p.category || 'Others') === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    playClickSound(settings.soundEnabled);
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer flex-shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-205 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  {lang === 'hi' ? cat.hi : cat.en} ({count})
                </button>
              );
            })}
          </div>

          {/* Preset Buttons & Voice inline Row */}
          <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-between gap-2 overflow-hidden">
            
            {/* Quick Rates Horizontal bar */}
            <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
              <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap hidden xs:inline">
                {lang === 'hi' ? 'फास्ट रेट:' : 'PRESETS:'}
              </span>
              
              <div className="flex overflow-x-auto gap-1.5 pb-0.5 scrollbar-none snap-x max-w-full">
                {/* Adding button inline */}
                <button
                  type="button"
                  onClick={() => {
                    playClickSound(settings.soundEnabled);
                    setShowAddPresetForm(!showAddPresetForm);
                  }}
                  className="flex-shrink-0 flex items-center justify-center p-1 rounded-lg bg-slate-50 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800 cursor-pointer"
                  title={t('addQuickRate')}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                {filteredPresets.map((pr) => (
                  <button
                    key={pr.id}
                    onClick={() => handlePresetSelect(pr)}
                    className={`
                      snap-start flex-shrink-0 flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer group
                      ${
                        parseFloat(rate) === pr.rate
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300 font-bold shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:border-emerald-300'
                      }
                    `}
                  >
                    <span>{lang === 'hi' ? pr.nameHi : pr.name}</span>
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[10px] font-bold text-emerald-600">₹{pr.rate}</span>
                    
                    <span
                      onClick={(e) => handleDeletePreset(pr.id, e)}
                      className="opacity-60 group-hover:opacity-100 transition-opacity ml-1 text-rose-500 text-[10px]"
                    >
                      ✕
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Command Button inline */}
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`
                flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold text-[11px] shadow-sm transition-all cursor-pointer
                ${
                  isListening
                    ? 'bg-rose-100 border-rose-300 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400 animate-pulse'
                    : 'bg-emerald-50 border-emerald-250 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                }
              `}
              title={isListening ? voiceLog : t('voiceInstructions')}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> : <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              <span className="hidden sm:inline">{isListening ? '...' : t('voiceInput')}</span>
            </button>
          </div>

          {/* Mini popup form inline to add rates */}
          {showAddPresetForm && (
            <form onSubmit={handleAddPreset} className="bg-slate-50 dark:bg-slate-900/45 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">{lang === 'hi' ? 'सामान का नाम' : 'Product name'}</label>
                  <input
                    type="text"
                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none"
                    placeholder="e.g. Rice"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">{t('pricePerKg')}</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none"
                    placeholder="e.g. 55"
                    value={newPresetRate}
                    onChange={(e) => setNewPresetRate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">{lang === 'hi' ? 'श्रेणी (Category)' : 'Category'}</label>
                  <select
                    value={newPresetCategory}
                    onChange={(e) => setNewPresetCategory(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none cursor-pointer"
                  >
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {lang === 'hi' ? cat.hi : cat.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddPresetForm(false)}
                  className="text-[10px] px-2 py-0.5 border border-slate-200 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
                <button
                  type="submit"
                  className="text-[10px] px-2.5 py-0.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  {t('save')}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Right Column: Keypad displays, quick adjustments shortcuts and action items */}
        <div className="space-y-3">
          
          {/* Quick Shortcuts Increments row */}
          <div className="flex gap-2 items-center justify-between overflow-x-auto whitespace-nowrap scrollbar-none py-0.5">
            <span className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex-shrink-0">
              {mode === 'amount_to_weight' ? '+₹ QUICK PAY:' : '+KG/GM WEIGH:'}
            </span>
            {mode === 'amount_to_weight' ? (
              <div className="flex gap-1">
                {[10, 20, 50, 100, 200, 500].map((quickVal) => (
                  <button
                    key={quickVal}
                    type="button"
                    onClick={() => selectQuickAmount(quickVal)}
                    className="px-2 py-0.5 text-[10px] font-bold font-mono rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-emerald-50 active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    +{quickVal}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-1 animate-none">
                {[
                  { label: '250g', kg: 0, g: 250 },
                  { label: '500g', kg: 0, g: 500 },
                  { label: '1 KG', kg: 1, g: 0 },
                  { label: '1.5 KG', kg: 1, g: 500 },
                  { label: '2 KG', kg: 2, g: 0 },
                ].map((shortcut) => (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => selectQuickWeight(shortcut.kg, shortcut.g)}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 hover:bg-emerald-50 active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Numeric Keypad Module */}
          <NumericKeypad
            value={
              activeInput === 'rate'
                ? rate
                : activeInput === 'amount'
                ? amount
                : activeInput === 'kg'
                ? weightKg
                : weightG
            }
            onChange={(newVal) => handleInputChange(activeInput, newVal)}
            onEnter={handleSaveCalculation}
            soundEnabled={settings.soundEnabled}
          />

          {/* Super cohesive sharing actions panel right under the keypad */}
          <div className="grid grid-cols-3 gap-2 select-none">
            
            {/* Copy Receipt Button */}
            <button
              onClick={handleCopyToClipboard}
              id="tarazu-btn-copy"
              className="flex items-center justify-center gap-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850/80 text-slate-700 dark:text-slate-300 rounded-lg font-bold uppercase tracking-wide border border-slate-200/50 dark:border-slate-800 shadow-sm active:scale-95 transition-all text-[10px] cursor-pointer"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-605" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? t('copied') : t('copyResult')}</span>
            </button>

            {/* Share Invoice Button */}
            <button
              onClick={handleShareReceipt}
              id="tarazu-btn-share"
              className="flex items-center justify-center gap-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850/80 text-slate-700 dark:text-slate-300 rounded-lg font-bold uppercase tracking-wide border border-slate-200/50 dark:border-slate-800 shadow-sm active:scale-95 transition-all text-[10px] cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('shareReceipt')}</span>
            </button>

            {/* Record To Ledger Primary Button */}
            <button
              onClick={handleSaveCalculation}
              className="py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white rounded-lg font-bold shadow-md shadow-emerald-600/10 active:scale-95 transition-all flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider cursor-pointer font-sans"
            >
              <Scale className="w-4 h-4" />
              <span>{lang === 'hi' ? 'सेव लेजर' : 'Record'}</span>
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}
