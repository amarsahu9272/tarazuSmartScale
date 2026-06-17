import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Share2, Copy, CheckCircle, Scale, Plus, Trash2, Volume2, Sparkles, Settings, Tag, Edit, ChevronUp, ChevronDown } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { isSpeechSupported, startSpeechListening } from '../utils/speech';
import { getStoredPresets, saveStoredPresets, PresetRate, getStoredCategories, saveStoredCategories, PresetCategory, getStoredHistory } from '../utils/storage';
import { useAutoSave } from '../hooks/useAutoSave';
import { useToast } from './Toast';
import NumericKeypad from './NumericKeypad';

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
  const { toast } = useToast();
  
  // Modes: 
  // 'amount_to_weight' (₹ -> KG)
  // 'weight_to_amount' (KG -> ₹)
  const [mode, setMode] = useState<'amount_to_weight' | 'weight_to_amount'>(() => {
    try {
      const saved = localStorage.getItem('tarazu_active_mode');
      return (saved === 'amount_to_weight' || saved === 'weight_to_amount') ? saved : 'amount_to_weight';
    } catch {
      return 'amount_to_weight';
    }
  });
  
  // States
  const [rate, setRate] = useState(() => {
    try {
      return localStorage.getItem('tarazu_active_rate') || '80';
    } catch {
      return '80';
    }
  }); // ₹ per KG
  const [amount, setAmount] = useState(() => {
    try {
      return localStorage.getItem('tarazu_active_amount') || '120';
    } catch {
      return '120';
    }
  }); // Target purchase money
  
  // For Weight -> Amount mode
  const [weightKg, setWeightKg] = useState(() => {
    try {
      return localStorage.getItem('tarazu_active_weightKg') || '1';
    } catch {
      return '1';
    }
  });
  const [weightG, setWeightG] = useState(() => {
    try {
      return localStorage.getItem('tarazu_active_weightG') || '500';
    } catch {
      return '500';
    }
  });

  // Input Focus State to direct numeric keypad inputs
  // 'rate' | 'amount' | 'kg' | 'g'
  const [activeInput, setActiveInput] = useState<'rate' | 'amount' | 'kg' | 'g'>(() => {
    try {
      const saved = localStorage.getItem('tarazu_active_input_field');
      return (saved === 'rate' || saved === 'amount' || saved === 'kg' || saved === 'g') ? saved : 'amount';
    } catch {
      return 'amount';
    }
  });

  // Auto-save Tarazu active inputs (slower in Battery Saver mode)
  useAutoSave(() => {
    try {
      localStorage.setItem('tarazu_active_mode', mode);
      localStorage.setItem('tarazu_active_rate', rate);
      localStorage.setItem('tarazu_active_amount', amount);
      localStorage.setItem('tarazu_active_weightKg', weightKg);
      localStorage.setItem('tarazu_active_weightG', weightG);
      localStorage.setItem('tarazu_active_input_field', activeInput);
    } catch (e) {
      console.warn('Failed to auto-save Tarazu active inputs:', e);
    }
  }, settings.batterySaver ? 25000 : 5000);

  // Load preset rates and categories
  const [presets, setPresets] = useState<PresetRate[]>([]);
  const [categories, setCategories] = useState<PresetCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetRate, setNewPresetRate] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState<string>('Vegetables');
  const [showAddPresetForm, setShowAddPresetForm] = useState(false);
  const [newPresetThreshold, setNewPresetThreshold] = useState('');
  const [newPresetStock, setNewPresetStock] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Customizable categories state managers
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [newCatEn, setNewCatEn] = useState('');
  const [newCatHi, setNewCatHi] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCatEn, setEditCatEn] = useState('');
  const [editCatHi, setEditCatHi] = useState('');

  // Voice Listening State
  const [isListening, setIsListening] = useState(false);
  const [voiceLog, setVoiceLog] = useState('');

  // Floating receipt flash state
  const [copied, setCopied] = useState(false);
  const recognitionRef = useRef<any>(null);

  // List of history items to compute preset usage frequency
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  // Load presets and categories on mount
  useEffect(() => {
    setPresets(getStoredPresets());
    const savedCats = getStoredCategories();
    setCategories(savedCats);
    if (savedCats.length > 0) {
      setNewPresetCategory(savedCats[0].id);
    }
    setHistoryItems(getStoredHistory());
  }, []);

  // Category management functions
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatEn.trim()) return;
    const cleanId = 'cat_' + Date.now().toString();
    const newCat: PresetCategory = {
      id: cleanId,
      en: newCatEn.trim(),
      hi: (newCatHi || newCatEn).trim(),
    };
    
    const updated = [...categories, newCat];
    setCategories(updated);
    saveStoredCategories(updated);
    setNewCatEn('');
    setNewCatHi('');
    playSuccessSound(settings.soundEnabled);
  };

  const startEditingCategory = (cat: PresetCategory) => {
    setEditingCategoryId(cat.id);
    setEditCatEn(cat.en);
    setEditCatHi(cat.hi);
    playClickSound(settings.soundEnabled);
  };

  const handleSaveCategory = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatEn.trim()) return;
    
    const updated = categories.map((cat) => {
      if (cat.id === id) {
        return {
          ...cat,
          en: editCatEn.trim(),
          hi: (editCatHi || editCatEn).trim(),
        };
      }
      return cat;
    });

    setCategories(updated);
    saveStoredCategories(updated);
    setEditingCategoryId(null);
    playSuccessSound(settings.soundEnabled);
  };

  const handleDeleteCategory = (id: string) => {
    playClickSound(settings.soundEnabled);
    if (window.confirm(lang === 'hi' ? 'क्या आप इस श्रेणी को हटाना चाहते हैं? इस श्रेणी के सामान "Others" में चले जाएंगे।' : 'Are you sure you want to delete this category? Presets will move to "Others".')) {
      const updatedCats = categories.filter((cat) => cat.id !== id);
      setCategories(updatedCats);
      saveStoredCategories(updatedCats);
      
      // Update existing presets to move to 'Others' or another available category
      const fallbackCat = updatedCats.length > 0 ? updatedCats[0].id : 'Others';
      const updatedPresets = presets.map((p) => {
        if (p.category === id) {
          return { ...p, category: fallbackCat };
        }
        return p;
      });
      setPresets(updatedPresets);
      saveStoredPresets(updatedPresets);
      
      // If deleted category was selected, switch selection
      if (selectedCategory === id) {
        setSelectedCategory('All');
      }
      playSuccessSound(settings.soundEnabled);
    }
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= categories.length) return;
    
    playClickSound(settings.soundEnabled);
    const updated = [...categories];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    
    setCategories(updated);
    saveStoredCategories(updated);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...categories];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setCategories(updated);
    saveStoredCategories(updated);
    setDraggedIndex(null);
    playClickSound(settings.soundEnabled);
  };

  // Count frequency of rate usages in historic items of type 'tarazu'
  const presetUsageCounts = React.useMemo(() => {
    const counts: Record<number, number> = {};
    historyItems.forEach((item) => {
      if (item.type === 'tarazu' && item.rate) {
        counts[item.rate] = (counts[item.rate] || 0) + 1;
      }
    });
    return counts;
  }, [historyItems]);

  // Filter presets based on selected category filter
  const filteredPresets = React.useMemo(() => {
    if (selectedCategory === '__frequent__') {
      return presets
        .filter((pr) => (presetUsageCounts[pr.rate] || 0) > 0)
        .sort((a, b) => (presetUsageCounts[b.rate] || 0) - (presetUsageCounts[a.rate] || 0));
    }
    if (selectedCategory === 'All') return presets;
    return presets.filter((pr) => (pr.category || 'Others') === selectedCategory);
  }, [presets, selectedCategory, presetUsageCounts]);

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
    setSelectedPresetId(preset.id);
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName || !newPresetRate) return;
    const rateVal = parseFloat(newPresetRate);
    if (isNaN(rateVal) || rateVal <= 0) return;

    const thresholdVal = parseFloat(newPresetThreshold);
    const stockVal = parseFloat(newPresetStock);

    const newPr: PresetRate = {
      id: Date.now().toString(),
      name: newPresetName,
      nameHi: newPresetName,
      rate: rateVal,
      category: newPresetCategory,
      minThreshold: isNaN(thresholdVal) ? undefined : thresholdVal,
      currentStock: isNaN(stockVal) ? undefined : stockVal,
    };

    const updated = [...presets, newPr];
    setPresets(updated);
    saveStoredPresets(updated);
    setNewPresetName('');
    setNewPresetRate('');
    setNewPresetThreshold('');
    setNewPresetStock('');
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
    if (valueStr) {
      const num = parseFloat(valueStr);
      if (isNaN(num)) {
        toast(
          lang === 'hi' ? 'त्रुटि: कृपया एक वैध संख्या दर्ज करें।' : 'Error: Please enter a valid number.',
          'error'
        );
        return;
      }
      if (num < 0) {
        toast(
          lang === 'hi' ? 'त्रुटि: ऋणात्मक मान की अनुमति नहीं है।' : 'Error: Negative values are not allowed.',
          'error'
        );
        return;
      }

      if (field === 'rate' && num > 999999) {
        toast(
          lang === 'hi' ? 'चेतावनी: दर्ज की गई दर बहुत अधिक है!' : 'Warning: Entered rate is extremely high!',
          'warning'
        );
      } else if (field === 'amount' && num > 99999999) {
        toast(
          lang === 'hi' ? 'चेतावनी: दर्ज की गई राशि बहुत अधिक है!' : 'Warning: Entered amount is extremely high!',
          'warning'
        );
      } else if (field === 'kg' && num > 99999) {
        toast(
          lang === 'hi' ? 'चेतावनी: वजन (KG) सामान्य सीमा से अधिक है!' : 'Warning: Weight (KG) is exceeding standard limit!',
          'warning'
        );
      } else if (field === 'g' && num >= 1000) {
        toast(
          lang === 'hi' ? 'ग्राम 999 से कम होना चाहिए (1000g = 1kg)।' : 'Grams should be less than 1000 (1000g = 1kg).',
          'warning'
        );
      }
    }

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

  const validateCurrentState = (showToast = true): boolean => {
    const r = parseFloat(rate) || 0;
    if (isNaN(r) || r <= 0) {
      if (showToast) {
        toast(
          lang === 'hi' ? 'त्रुटि: कृपया 0 से अधिक वैध बिक्री दर (Rate) दर्ज करें।' : 'Error: Please enter a valid selling rate greater than 0.',
          'error'
        );
      }
      return false;
    }
    if (r > 999999) {
      if (showToast) {
        toast(
          lang === 'hi' ? 'त्रुटि: दर्ज बिक्री दर बहुत अधिक है (अधिकतम 9,99,999)।' : 'Error: Entered selling rate is too high (max 999k).',
          'error'
        );
      }
      return false;
    }

    if (mode === 'amount_to_weight') {
      const amt = parseFloat(amount) || 0;
      if (isNaN(amt) || amt <= 0) {
        if (showToast) {
          toast(
            lang === 'hi' ? 'त्रुटि: कृपया 0 से अधिक वैध मूल्य (Amount) दर्ज करें।' : 'Error: Please enter a valid purchase amount greater than 0.',
            'error'
          );
        }
        return false;
      }
      if (amt > 99999999) {
        if (showToast) {
          toast(
            lang === 'hi' ? 'त्रुटि: दर्ज मूल्य बहुत अधिक है।' : 'Error: Entered purchase amount is too high.',
            'error'
          );
        }
        return false;
      }
    } else {
      const kgVal = parseFloat(weightKg) || 0;
      const gVal = parseFloat(weightG) || 0;
      if (isNaN(kgVal) || isNaN(gVal) || (kgVal <= 0 && gVal <= 0)) {
        if (showToast) {
          toast(
            lang === 'hi' ? 'त्रुटि: कृपया 0 से अधिक कुल वजन (Weight) दर्ज करें।' : 'Error: Please enter a combined weight greater than 0.',
            'error'
          );
        }
        return false;
      }
      if (kgVal > 99999) {
        if (showToast) {
          toast(
            lang === 'hi' ? 'त्रुटि: दर्ज वजन सीमा से अधिक है।' : 'Error: Entered weight exceeds maximum limit.',
            'error'
          );
        }
        return false;
      }
      if (gVal < 0 || gVal >= 1000) {
        if (showToast) {
          toast(
            lang === 'hi' ? 'त्रुटि: ग्राम (Gram) 0-999 के बीच होना चाहिए।' : 'Error: Grams must be between 0 and 999.',
            'error'
          );
        }
        return false;
      }
    }
    return true;
  };

  const handleSaveCalculation = (silent = false) => {
    if (!validateCurrentState(!silent)) return false;
    
    playSuccessSound(settings.soundEnabled);
    const r = parseFloat(rate) || 0;
    let savedSuccessfully = false;

    // Find if we have a matching or selected preset product
    const matchedPreset = presets.find(p => p.id === selectedPresetId || p.rate === r);
    const productName = matchedPreset ? (lang === 'hi' ? matchedPreset.nameHi : matchedPreset.name) : '';
    const prefix = productName ? `${productName} — ` : '';

    if (mode === 'amount_to_weight') {
      const amt = parseFloat(amount) || 0;
      const out = calculatedOutput as { kg: number, g: number, totalKg: number };
      if (r > 0 && amt > 0) {
        const itemData: HistoryItemInput = {
          type: 'tarazu',
          mode: 'amount_to_weight',
          rate: r,
          inputAmount: amt,
          resultKg: out.kg,
          resultG: out.g,
          label: `${prefix}${lang === 'hi' ? 'खरीद' : 'Buy'} ${settings.preferredCurrency || '₹'}${amt} @ ${settings.preferredCurrency || '₹'}${r}/KG → Weight: ${out.kg} KG ${out.g} G`,
        };
        onAddHistoryItem(itemData);
        
        // Deduct Stock
        if (matchedPreset && matchedPreset.currentStock !== undefined) {
          const weightInKg = out.totalKg || (out.kg + out.g / 1000);
          const nextStock = Math.max(0, matchedPreset.currentStock - weightInKg);
          const updatedPresets = presets.map((p) => {
            if (p.id === matchedPreset.id) {
              return { ...p, currentStock: Number(nextStock.toFixed(3)) };
            }
            return p;
          });
          setPresets(updatedPresets);
          saveStoredPresets(updatedPresets);
        }

        setHistoryItems((prev) => [
          {
            ...itemData,
            id: Date.now().toString(),
            timestamp: Date.now(),
          } as HistoryItem,
          ...prev,
        ]);
        savedSuccessfully = true;
      }
    } else {
      const kgVal = parseFloat(weightKg) || 0;
      const gVal = parseFloat(weightG) || 0;
      const out = calculatedOutput as { totalPrice: number };
      if (r > 0 && (kgVal > 0 || gVal > 0)) {
        const itemData: HistoryItemInput = {
          type: 'tarazu',
          mode: 'weight_to_amount',
          rate: r,
          inputKg: kgVal,
          inputG: gVal,
          resultAmount: Number(out.totalPrice.toFixed(settings.decimalPrecision)),
          label: `${prefix}${lang === 'hi' ? 'वजन' : 'Weigh'} ${kgVal} KG ${gVal} G @ ${settings.preferredCurrency || '₹'}${r}/KG → Price: ${settings.preferredCurrency || '₹'}${out.totalPrice.toFixed(settings.decimalPrecision)}`,
        };
        onAddHistoryItem(itemData);

        // Deduct Stock
        if (matchedPreset && matchedPreset.currentStock !== undefined) {
          const weightInKg = kgVal + (gVal / 1000);
          const nextStock = Math.max(0, matchedPreset.currentStock - weightInKg);
          const updatedPresets = presets.map((p) => {
            if (p.id === matchedPreset.id) {
              return { ...p, currentStock: Number(nextStock.toFixed(3)) };
            }
            return p;
          });
          setPresets(updatedPresets);
          saveStoredPresets(updatedPresets);
        }

        setHistoryItems((prev) => [
          {
            ...itemData,
            id: Date.now().toString(),
            timestamp: Date.now(),
          } as HistoryItem,
          ...prev,
        ]);
        savedSuccessfully = true;
      }
    }

    if (savedSuccessfully && !silent) {
      toast(
        lang === 'hi' ? 'सफलता: गणना खाता बही में सहेजी गई!' : 'Success: Calculation saved to ledger!',
        'success'
      );
    }
    return savedSuccessfully;
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
    text += ` Price Rate  : ${settings.preferredCurrency || '₹'}${rate}/KG\n`;
    
    if (mode === 'amount_to_weight') {
      const out = calculatedOutput as { kg: number, g: number };
      text += ` Paid Amount : ${settings.preferredCurrency || '₹'}${amount}\n`;
      text += `-----------------------------\n`;
      text += ` DELIVER WEIGHT: ${out.kg} KG ${out.g} GM\n`;
    } else {
      const out = calculatedOutput as { totalPrice: number };
      text += ` Weight      : ${weightKg} KG ${weightG} GM\n`;
      text += `-----------------------------\n`;
      text += ` TOTAL BILL  : ${settings.preferredCurrency || '₹'}${out.totalPrice.toFixed(prec)}\n`;
    }
    text += `-----------------------------\n`;
    text += `  ✨ Thank you for visiting! ✨\n`;
    text += `     Power of Tarazu Digital\n`;
    text += `-----------------------------\n`;
    return text;
  };

  const handleCopyToClipboard = () => {
    if (!validateCurrentState(true)) return;
    const text = getReceiptText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    playSuccessSound(settings.soundEnabled);
    toast(
      lang === 'hi' ? 'सफलता: रसीद क्लिपबोर्ड पर कॉपी हुई!' : 'Success: Receipt copied to clipboard!',
      'success'
    );
    setTimeout(() => setCopied(false), 2000);
    
    // Save to ledger automatically on copy
    handleSaveCalculation(true);
  };

  const handleShareReceipt = async () => {
    if (!validateCurrentState(true)) return;
    playClickSound(settings.soundEnabled);
    const receiptText = getReceiptText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${settings.shopName} Smart Invoice`,
          text: receiptText,
        });
        toast(
          lang === 'hi' ? 'सफलता: रसीद साझा की गई!' : 'Success: Receipt shared successfully!',
          'success'
        );
      } catch (e) {
        console.warn('Share cancelled', e);
      }
    } else {
      navigator.clipboard.writeText(receiptText);
      toast(
        lang === 'hi' ? 'सफलता: रसीद क्लिपबोर्ड पर कॉपी हुई!' : 'Success: Receipt copied to clipboard!',
        'success'
      );
    }
    
    // Save to scale ledger automatically on share
    handleSaveCalculation(true);
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
                    {settings.preferredCurrency || '₹'}{((calculatedOutput as { totalPrice: number }).totalPrice || 0).toFixed(settings.decimalPrecision)}
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-1 font-sans font-medium">
                    Rate: {settings.preferredCurrency || '₹'}{rate}/KG × WEIGHT: {(parseFloat(weightKg) || 0) + ((parseFloat(weightG) || 0) / 1000)} KG
                  </p>
                </div>
              )}
            </div>

            {/* Interactive Tab-to-Edit Display Areas on scale dashboard */}
            <div className="border-t border-emerald-900/30 mt-3 pt-2 grid grid-cols-3 gap-1.5 text-[11px] font-sans">
              
              {/* Box 1: Price rate */}
              <div
                onClick={() => {
                  handleFocus('rate');
                  const inputEl = document.getElementById('input-rate') as HTMLInputElement | null;
                  if (inputEl) inputEl.focus();
                }}
                className={`cursor-pointer p-1.5 rounded-lg border text-center transition-all duration-300 ${
                  activeInput === 'rate'
                    ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100 font-bold ring-2 ring-emerald-400/35 shadow-[0_0_15px_rgba(52,211,153,0.35)]'
                    : 'bg-slate-900/40 border-transparent text-emerald-600/85 hover:bg-slate-900/80 hover:border-emerald-900/40'
                }`}
              >
                <label htmlFor="input-rate" className="block text-[8px] uppercase tracking-wider text-emerald-700 font-bold cursor-pointer">
                  {lang === 'hi' ? `दर ${settings.preferredCurrency || '₹'}/KG` : `RATE ${settings.preferredCurrency || '₹'}/KG`}
                </label>
                <div className="mt-0.5 flex items-center justify-center font-mono text-xs">
                  <span className="mr-0.5 text-[10px] text-emerald-500 font-bold">{settings.preferredCurrency || '₹'}</span>
                  <input
                    id="input-rate"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    value={rate}
                    onChange={(e) => handleInputChange('rate', e.target.value)}
                    onFocus={() => handleFocus('rate')}
                    className="w-14 bg-transparent text-center border-none outline-none focus:outline-none focus:ring-0 font-mono text-xs text-emerald-200 font-bold focus:text-white"
                  />
                  {activeInput === 'rate' && <span className="animate-pulse text-emerald-400 font-bold">|</span>}
                </div>
              </div>

              {/* Box 2 & 3: Weight or Amount editors depending on Mode */}
              {mode === 'amount_to_weight' ? (
                <div
                  onClick={() => {
                    handleFocus('amount');
                    const inputEl = document.getElementById('input-amount') as HTMLInputElement | null;
                    if (inputEl) inputEl.focus();
                  }}
                  className={`cursor-pointer p-1.5 rounded-lg border text-center transition-all duration-300 col-span-2 ${
                    activeInput === 'amount'
                      ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100 font-bold ring-2 ring-emerald-400/35 shadow-[0_0_15px_rgba(52,211,153,0.35)]'
                      : 'bg-slate-900/40 border-transparent text-emerald-600/85 hover:bg-slate-900/80 hover:border-emerald-900/40'
                  }`}
                >
                  <label htmlFor="input-amount" className="block text-[8px] uppercase tracking-wider text-emerald-700 font-bold cursor-pointer">
                    {lang === 'hi' ? 'खरीद मूल्य बजट' : 'BUDGET AMOUNT'}
                  </label>
                  <div className="mt-0.5 flex items-center justify-center font-mono text-xs">
                    <span className="mr-0.5 text-[10px] text-emerald-500 font-bold">{settings.preferredCurrency || '₹'}</span>
                    <input
                      id="input-amount"
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      value={amount}
                      onChange={(e) => handleInputChange('amount', e.target.value)}
                      onFocus={() => handleFocus('amount')}
                      className="w-24 bg-transparent text-center border-none outline-none focus:outline-none focus:ring-0 font-mono text-xs text-emerald-250 font-bold focus:text-white"
                    />
                    {activeInput === 'amount' && <span className="animate-pulse text-emerald-400 font-bold">|</span>}
                  </div>
                </div>
              ) : (
                <>
                  {/* Kilogram Editor */}
                  <div
                    onClick={() => {
                      handleFocus('kg');
                      const inputEl = document.getElementById('input-kg') as HTMLInputElement | null;
                      if (inputEl) inputEl.focus();
                    }}
                    className={`cursor-pointer p-1.5 rounded-lg border text-center transition-all duration-300 ${
                      activeInput === 'kg'
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100 font-bold ring-2 ring-emerald-400/35 shadow-[0_0_15px_rgba(52,211,153,0.35)]'
                        : 'bg-slate-900/40 border-transparent text-emerald-600/85 hover:bg-slate-900/80 hover:border-emerald-900/40'
                    }`}
                  >
                    <label htmlFor="input-kg" className="block text-[8px] uppercase tracking-wider text-emerald-700 font-bold cursor-pointer">
                      {lang === 'hi' ? 'किलोग्राम (KG)' : 'WEIGHT KG'}
                    </label>
                    <div className="mt-0.5 flex items-center justify-center font-mono text-xs">
                      <input
                        id="input-kg"
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.]*"
                        value={weightKg}
                        onChange={(e) => handleInputChange('kg', e.target.value)}
                        onFocus={() => handleFocus('kg')}
                        className="w-12 bg-transparent text-center border-none outline-none focus:outline-none focus:ring-0 font-mono text-xs text-emerald-250 font-bold focus:text-white"
                      />
                      <span className="ml-0.5 text-[10px] text-emerald-500 font-medium">kg</span>
                      {activeInput === 'kg' && <span className="animate-pulse text-emerald-400 font-bold">|</span>}
                    </div>
                  </div>

                  {/* Gram Editor */}
                  <div
                    onClick={() => {
                      handleFocus('g');
                      const inputEl = document.getElementById('input-g') as HTMLInputElement | null;
                      if (inputEl) inputEl.focus();
                    }}
                    className={`cursor-pointer p-1.5 rounded-lg border text-center transition-all duration-300 ${
                      activeInput === 'g'
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-100 font-bold ring-2 ring-emerald-400/35 shadow-[0_0_15px_rgba(52,211,153,0.35)]'
                        : 'bg-slate-900/40 border-transparent text-emerald-600/85 hover:bg-slate-900/80 hover:border-emerald-900/40'
                    }`}
                  >
                    <label htmlFor="input-g" className="block text-[8px] uppercase tracking-wider text-emerald-700 font-bold cursor-pointer">
                      {lang === 'hi' ? 'ग्राम (GM)' : 'WEIGHT GM'}
                    </label>
                    <div className="mt-0.5 flex items-center justify-center font-mono text-xs">
                      <input
                        id="input-g"
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9.]*"
                        value={weightG}
                        onChange={(e) => handleInputChange('g', e.target.value)}
                        onFocus={() => handleFocus('g')}
                        className="w-12 bg-transparent text-center border-none outline-none focus:outline-none focus:ring-0 font-mono text-xs text-emerald-250 font-bold focus:text-white"
                      />
                      <span className="ml-0.5 text-[10px] text-emerald-500 font-medium">g</span>
                      {activeInput === 'g' && <span className="animate-pulse text-emerald-400 font-bold">|</span>}
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
              id="category-pill-all"
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
            <button
              type="button"
              id="category-pill-frequent"
              onClick={() => {
                playClickSound(settings.soundEnabled);
                setSelectedCategory('__frequent__');
              }}
              className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer flex-shrink-0 flex items-center gap-1 ${
                selectedCategory === '__frequent__'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-650 dark:text-slate-300 border-slate-205 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-550 dark:text-amber-400 shrink-0" />
              <span>
                {lang === 'hi' ? 'अक्सर इस्तेमाल' : 'Frequently Used'}{' '}
                ({presets.filter((pr) => (presetUsageCounts[pr.rate] || 0) > 0).length})
              </span>
            </button>
            {categories.map((cat) => {
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
            
            {/* Manage Categories Action Button */}
            <button
              type="button"
              id="btn-toggle-manage-categories"
              onClick={() => {
                playClickSound(settings.soundEnabled);
                setShowManageCategories(!showManageCategories);
                setShowAddPresetForm(false);
              }}
              className={`px-2 py-1 rounded-lg font-bold border transition-all cursor-pointer flex-shrink-0 flex items-center gap-1 text-[10px] ${
                showManageCategories
                  ? 'bg-amber-600 border-amber-600 text-white shadow-sm font-extrabold'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400 border-slate-200/50 dark:border-slate-800'
              }`}
              title={lang === 'hi' ? 'श्रेणियां संपादित करें' : 'Manage Categories'}
            >
              <Settings className="w-3 h-3" />
              <span>{lang === 'hi' ? 'प्रबंधित' : 'Manage'}</span>
            </button>
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
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[10px] font-bold text-emerald-600">{settings.preferredCurrency || '₹'}{pr.rate}</span>
                    
                    <span
                      onClick={(e) => handleDeletePreset(pr.id, e)}
                      className="opacity-60 group-hover:opacity-100 transition-opacity ml-1 text-rose-500 text-[10px]"
                    >
                      ✕
                    </span>
                  </button>
                ))}

                {selectedCategory === '__frequent__' && filteredPresets.length === 0 && (
                  <span className="flex items-center text-slate-400 dark:text-slate-500 text-[10px] font-black py-1 px-2 italic whitespace-nowrap gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{lang === 'hi' ? 'कोई गणना इतिहास नहीं' : 'No calculation history yet'}</span>
                  </span>
                )}
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

          {/* Category Management Dashboard */}
          {showManageCategories && (
            <div id="category-manager-panel" className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Tag className="w-4 h-4" />
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">{lang === 'hi' ? 'श्रेणी बहीखाता प्रबंधन' : 'Category Management'}</h3>
                </div>
                <button
                  type="button"
                  id="btn-close-category-manager"
                  className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 text-xs font-bold cursor-pointer transition-all"
                  onClick={() => {
                    playClickSound(settings.soundEnabled);
                    setShowManageCategories(false);
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Add New Category form */}
              <form onSubmit={handleAddCategory} className="space-y-1.5 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800">
                <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  {lang === 'hi' ? 'नई श्रेणी जोड़ें' : 'Create New Category'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      type="text"
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                      placeholder={lang === 'hi' ? 'नाम (English)' : 'Name (English) e.g. Snacks'}
                      value={newCatEn}
                      onChange={(e) => setNewCatEn(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                      placeholder={lang === 'hi' ? 'नाम (हिंदी) (वैकल्पिक)' : 'Name (Hindi) (Optional)'}
                      value={newCatHi}
                      onChange={(e) => setNewCatHi(e.target.value)}
                    />
                    <button
                      type="submit"
                      id="btn-add-category"
                      className="px-3 bg-amber-600 text-white rounded text-xs font-black transition-all flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>

              {/* Category Editable List */}
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  {lang === 'hi' ? 'मौजूदा श्रेणियां (क्रम बदलें / नाम बदलें / हटाएं)' : 'Existing Categories (Reorder / Rename / Delete)'}
                </p>
                
                <div className="space-y-1.5">
                  {categories.map((cat, index) => (
                    <div
                      key={cat.id}
                      draggable={editingCategoryId !== cat.id}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`flex items-center justify-between p-1.5 bg-white dark:bg-slate-950 rounded border gap-2 transition-all duration-150 ${
                        draggedIndex === index
                          ? 'opacity-40 border-dashed border-amber-400 bg-amber-50/20 dark:bg-amber-950/10'
                          : 'border-slate-150 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                      } ${editingCategoryId !== cat.id ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      {editingCategoryId === cat.id ? (
                        <form
                          onSubmit={(e) => handleSaveCategory(cat.id, e)}
                          className="flex-1 flex gap-1.5 items-center w-full"
                        >
                          <input
                            type="text"
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] px-2 py-0.5 rounded w-1/2 outline-none font-bold text-slate-800 dark:text-white"
                            value={editCatEn}
                            onChange={(e) => setEditCatEn(e.target.value)}
                            required
                          />
                          <input
                            type="text"
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] px-2 py-0.5 rounded w-1/2 outline-none font-bold text-slate-850 dark:text-white"
                            value={editCatHi}
                            onChange={(e) => setEditCatHi(e.target.value)}
                          />
                          <button
                            type="submit"
                            id={`btn-save-cat-${cat.id}`}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[10px] font-black cursor-pointer"
                          >
                            {lang === 'hi' ? 'बचाएं' : 'Save'}
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex-1 flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            <span>{lang === 'hi' ? cat.hi : cat.en}</span>
                            {cat.hi !== cat.en && (
                              <span className="text-[10px] text-slate-400 font-normal">({lang === 'hi' ? cat.en : cat.hi})</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {/* Move Up */}
                            <button
                              type="button"
                              id={`btn-moveup-cat-${cat.id}`}
                              disabled={index === 0}
                              onClick={() => handleMoveCategory(index, 'up')}
                              className={`p-1 rounded transition-all cursor-pointer ${
                                index === 0
                                  ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-30'
                                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-amber-600 dark:hover:text-amber-400'
                              }`}
                              title={lang === 'hi' ? 'ऊपर ले जाएं' : 'Move Up'}
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              id={`btn-movedown-cat-${cat.id}`}
                              disabled={index === categories.length - 1}
                              onClick={() => handleMoveCategory(index, 'down')}
                              className={`p-1 rounded transition-all cursor-pointer ${
                                index === categories.length - 1
                                  ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-30'
                                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-amber-600 dark:hover:text-amber-400'
                              }`}
                              title={lang === 'hi' ? 'नीचे ले जाएं' : 'Move Down'}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              id={`btn-edit-cat-${cat.id}`}
                              onClick={() => startEditingCategory(cat)}
                              className="text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-350 transition-all p-1 cursor-pointer"
                              title={lang === 'hi' ? 'नाम बदलें' : 'Rename Category'}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {/* Prevent deleting default safety category Vegetables / Others */}
                            {cat.id !== 'Others' && cat.id !== 'Vegetables' ? (
                              <button
                                type="button"
                                id={`btn-delete-cat-${cat.id}`}
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                                title={lang === 'hi' ? 'श्रेणी हटाएं' : 'Delete Category'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[9px] text-slate-300 dark:text-slate-700 px-1 font-semibold select-none">
                                {lang === 'hi' ? 'सुरक्षित' : 'System'}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mini popup form inline to add rates */}
          {showAddPresetForm && (
            <form onSubmit={handleAddPreset} className="bg-slate-50 dark:bg-slate-900/45 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
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
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">{lang === 'hi' ? 'न्यूनतम स्टॉक (KG)' : 'Min Threshold (KG)'}</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none"
                    placeholder="e.g. 5"
                    value={newPresetThreshold}
                    onChange={(e) => setNewPresetThreshold(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">{lang === 'hi' ? 'आरंभिक स्टॉक (KG)' : 'Initial Stock (KG)'}</label>
                  <input
                    type="number"
                    step="any"
                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none"
                    placeholder="e.g. 20"
                    value={newPresetStock}
                    onChange={(e) => setNewPresetStock(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">{lang === 'hi' ? 'श्रेणी (Category)' : 'Category'}</label>
                  <select
                    value={newPresetCategory}
                    onChange={(e) => setNewPresetCategory(e.target.value)}
                    className="w-full text-xs p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white outline-none cursor-pointer"
                  >
                    {categories.map((cat) => (
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
              {mode === 'amount_to_weight' ? `+${settings.preferredCurrency || '₹'} QUICK PAY:` : '+KG/GM WEIGH:'}
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
