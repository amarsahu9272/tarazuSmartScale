import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAutoSave } from '../hooks/useAutoSave';
import { Delete, Trash2, Copy, CheckCircle, Scale, Volume2, ShoppingCart, ListPlus, Receipt, Printer, Share2, X, ChevronDown, Plus, Pencil, Check, Mic, MicOff, FileDown } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { triggerPrint } from '../utils/print';
import { generateInvoicePDF } from '../utils/pdfGenerator';

interface CalculatorModuleProps {
  lang: Language;
  settings: AppSettings;
  onAddHistoryItem: (item: HistoryItemInput) => void;
  activeInvoiceDraft?: HistoryItem | null;
  onClearInvoiceDraft?: () => void;
}

const formatAsFraction = (val: number): string => {
  if (val === 0) return '0';
  const whole = Math.floor(Math.abs(val));
  const fract = Math.abs(val) - whole;
  
  if (fract < 0.001) {
    return (val < 0 ? '-' : '') + whole;
  }
  if (1 - fract < 0.001) {
    return (val < 0 ? '-' : '') + (whole + 1);
  }

  let bestD = 1;
  let bestN = 0;
  let minDiff = 1;
  
  for (let d = 2; d <= 64; d++) {
    const n = Math.round(fract * d);
    const diff = Math.abs(fract - n / d);
    if (diff < minDiff) {
      minDiff = diff;
      bestD = d;
      bestN = n;
    }
  }

  if (bestN === 0) {
    return (val < 0 ? '-' : '') + whole;
  }
  if (bestN === bestD) {
    return (val < 0 ? '-' : '') + (whole + 1);
  }

  const sign = val < 0 ? '-' : '';
  const wholeStr = whole > 0 ? `${whole} ` : '';
  
  if (bestN === 1 && bestD === 2) return `${sign}${wholeStr}½`;
  if (bestN === 1 && bestD === 4) return `${sign}${wholeStr}¼`;
  if (bestN === 3 && bestD === 4) return `${sign}${wholeStr}¾`;
  if (bestN === 1 && bestD === 3) return `${sign}${wholeStr}⅓`;
  if (bestN === 2 && bestD === 3) return `${sign}${wholeStr}⅔`;
  
  return `${sign}${wholeStr}${bestN}/${bestD}`;
};

const parseDictatedCalculation = (text: string, currentLang: Language) => {
  let cleaned = text.trim().toLowerCase();
  
  // Normalize Hindi digits to standard digits
  const devanagariDigits = ['०','१','२','३','४','५','६','७','८','९'];
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(new RegExp(devanagariDigits[i], 'g'), String(i));
  }

  // Replace common spoken arithmetic words with signs
  cleaned = cleaned.replace(/\bplus\b/g, '+');
  cleaned = cleaned.replace(/\bminus\b/g, '-');
  cleaned = cleaned.replace(/\b(times|multiplied by|multiply|into)\b/g, '×');
  cleaned = cleaned.replace(/\b(divided by|divide|by)\b/g, '÷');
  
  cleaned = cleaned.replace(/\b(जोड़|प्लस|धन)\b/g, '+');
  cleaned = cleaned.replace(/\b(घटाव|माइनस|ऋण)\b/g, '-');
  cleaned = cleaned.replace(/\b(गुणा|गुना|इंटू)\b/g, '×');
  cleaned = cleaned.replace(/\b(भाग|डिवाइड)\b/g, '÷');

  // 1. Math equations search: "X + Y", "X × Y", etc.
  const arithmeticRegex = /(\d+(?:\.\d+)?)\s*([\+\-×÷])\s*(\d+(?:\.\d+)?)/;
  const arithMatch = cleaned.match(arithmeticRegex);
  if (arithMatch) {
    const val1 = parseFloat(arithMatch[1]);
    const op = arithMatch[2];
    const val2 = parseFloat(arithMatch[3]);
    let result = 0;
    if (op === '+') result = val1 + val2;
    else if (op === '-') result = val1 - val2;
    else if (op === '×') result = val1 * val2;
    else if (op === '÷') result = val1 / (val2 || 1);
    
    return {
      success: true,
      itemName: '',
      quantity: val1,
      rate: val2,
      operation: op,
      result,
      expression: `${val1} ${op} ${val2}`
    };
  }

  // 2. Merchant calculations: "Name Quantity Unit Rate" or "Quantity Unit Name Rate" or "Quantity @ Rate"
  const allNumbers = cleaned.match(/\d+(?:\.\d+)?/g);
  if (allNumbers && allNumbers.length >= 2) {
    const num1 = parseFloat(allNumbers[0]);
    const num2 = parseFloat(allNumbers[1]);
    
    let quantity = num1;
    let rate = num2;
    
    const rateIndicators = /(?:at|@|per|for|of|के भाव से|रुपये|रुपए|रुपयों|की दर से)\s*(\d+(?:\.\d+)?)/;
    const rateMatch = cleaned.match(rateIndicators);
    if (rateMatch) {
      rate = parseFloat(rateMatch[1]);
      quantity = num1 === rate ? num2 : num1;
    }

    // Try finding the item name by removing quantity, rate, units, and stop words
    let itemNameCandidate = text;
    itemNameCandidate = itemNameCandidate.replace(new RegExp(`\\b${quantity}\\b`, 'g'), '');
    itemNameCandidate = itemNameCandidate.replace(new RegExp(`\\b${rate}\\b`, 'g'), '');
    
    const stopWords = [
      'kilos', 'kilo', 'kg', 'kilograms', 'lbs', 'pound', 'pounds', 'grams', 'gram', 'gm', 'items', 'packet', 'pieces', 'rupees', 'rupee', 'rs',
      'at', 'of', 'rate', 'for', 'per', 'a', 'piece', 'with', 'and', 'the', 'at rate', 'of rate',
      'किलो', 'किलोग्राम', 'किग्रा', 'ग्राम', 'पैकेट', 'पीस', 'नग', 'लीटर', 'रुपये', 'रूपए', 'के भाव से', 'रुपए', 'रुपयों', 'दर से', 'की दर', 'रु', 'का', 'की', 'के'
    ];
    stopWords.forEach(word => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      itemNameCandidate = itemNameCandidate.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '');
      itemNameCandidate = itemNameCandidate.replace(new RegExp(`\\s${escaped}\\s`, 'gi'), ' ');
      if (currentLang === 'hi') {
        itemNameCandidate = itemNameCandidate.replace(new RegExp(escaped, 'g'), '');
      }
    });

    let finalItemName = itemNameCandidate.replace(/[0-9\+\-\*\/×÷]/g, '').replace(/\s+/g, ' ').trim();
    if (finalItemName) {
      finalItemName = finalItemName.charAt(0).toUpperCase() + finalItemName.slice(1);
    }

    const calculatedResult = quantity * rate;
    return {
      success: true,
      itemName: finalItemName,
      quantity,
      rate,
      operation: '×',
      result: calculatedResult,
      expression: `${quantity} × ${rate}`
    };
  }

  return { success: false, itemName: '', quantity: 0, rate: 0, result: 0, expression: '' };
};

export default function CalculatorModule({
  lang,
  settings,
  onAddHistoryItem,
  activeInvoiceDraft,
  onClearInvoiceDraft,
}: CalculatorModuleProps) {
  const t = translate(lang);
  
  const [expression, setExpression] = useState(() => {
    try {
      return localStorage.getItem('tarazu_calc_expression') || '';
    } catch {
      return '';
    }
  });
  const [displayVal, setDisplayVal] = useState(() => {
    try {
      return localStorage.getItem('tarazu_calc_display_val') || '0';
    } catch {
      return '0';
    }
  });
  const [isDone, setIsDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Voice recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const startVoiceDictation = () => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceError(lang === 'hi' ? 'आपका ब्राउज़र वॉयस डिक्टेशन का समर्थन नहीं करता है' : 'Your browser does not support Voice Dictation');
      playClickSound(settings.soundEnabled);
      setTimeout(() => setVoiceError(null), 4000);
      return;
    }

    playClickSound(settings.soundEnabled);
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setVoiceStatus(lang === 'hi' ? 'विशेषज्ञ श्रवण... बोलिए (उदा. "१० आलू ५० रुपये")' : 'Listening... speak clear (e.g., "10 potatoes at 50")');
      setVoiceError(null);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event);
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        setVoiceError(lang === 'hi' ? 'माइक अनुमति अस्वीकृत। कृप्या अनुमति प्रदान करें या ऊपर नए टैब में खोलें।' : 'Microphone blocked. Please grant access or open in a new tab.');
      } else {
        setVoiceError(lang === 'hi' ? 'शब्दावली पहचानी नहीं जा सकी। कृपया पुनः प्रयास करें।' : 'Speech capture empty or error. Try again.');
      }
      setTimeout(() => setVoiceError(null), 4500);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setVoiceStatus(null);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      playSuccessSound(settings.soundEnabled);
      
      const parsed = parseDictatedCalculation(speechToText, lang);
      if (parsed.success) {
        if (parsed.itemName) {
          setNewItemName(parsed.itemName);
        }
        if (parsed.expression) {
          setExpression(parsed.expression);
        }
        const formattedRes = String(Number(parsed.result.toFixed(settings.decimalPrecision)));
        setDisplayVal(formattedRes);
        setIsDone(true);

        onAddHistoryItem({
          type: 'calculator',
          expression: parsed.itemName ? `${parsed.itemName} (${parsed.expression})` : parsed.expression,
          result: formattedRes,
          label: lang === 'hi'
            ? `आवाज़ डिक्टेशन: ${speechToText} (${parsed.expression} = ${formattedRes})`
            : `Voice Dictation: "${speechToText}" (${parsed.expression} = ${formattedRes})`,
        });
      } else {
        setNewItemName(speechToText);
        setVoiceError(lang === 'hi' ? `आंशिक रूप से पहचाना गया, सामान नाम: "${speechToText}"` : `Directly added to item name: "${speechToText}"`);
        setTimeout(() => setVoiceError(null), 4500);
      }
    };

    recognition.start();
  };

  // Basket builder state
  const [basket, setBasket] = useState<{ id: string; name: string; amount: number; note?: string }[]>(() => {
    try {
      const saved = localStorage.getItem('tarazu_calc_basket');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [checkedItemIds, setCheckedItemIds] = useState<string[]>([]);
  const [newItemName, setNewItemName] = useState(() => {
    try {
      return localStorage.getItem('tarazu_calc_new_item_name') || '';
    } catch {
      return '';
    }
  });
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [isFractionFormat, setIsFractionFormat] = useState(() => {
    try {
      return localStorage.getItem('tarazu_calc_is_fraction_format') === 'true';
    } catch {
      return false;
    }
  });
  const [isTaxEnabled, setIsTaxEnabled] = useState(() => {
    try {
      return localStorage.getItem('tarazu_calc_is_tax_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [taxTypes, setTaxTypes] = useState<{ id: string; name: string; rate: number }[]>(() => {
    try {
      const saved = localStorage.getItem('tarazu_calc_taxtypes');
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'GST', rate: 18 },
        { id: '2', name: 'Service Tax', rate: 15 },
        { id: '3', name: 'VAT', rate: 12.5 },
        { id: '4', name: 'Sales Tax', rate: 5 },
      ];
    } catch (e) {
      return [
        { id: '1', name: 'GST', rate: 18 },
        { id: '2', name: 'Service Tax', rate: 15 },
        { id: '3', name: 'VAT', rate: 12.5 },
        { id: '4', name: 'Sales Tax', rate: 5 },
      ];
    }
  });

  const [activeTaxTypeId, setActiveTaxTypeId] = useState<string>(() => {
    try {
      return localStorage.getItem('tarazu_calc_active_taxtype_id') || '1';
    } catch (e) {
      return '1';
    }
  });

  const [showTaxTypeDropdown, setShowTaxTypeDropdown] = useState(false);
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxRate, setNewTaxRate] = useState('');
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [editingTaxName, setEditingTaxName] = useState('');
  const [editingTaxRate, setEditingTaxRate] = useState('');

  const activeTaxType = taxTypes.find(t => t.id === activeTaxTypeId) || taxTypes[0] || { id: '1', name: 'GST', rate: 18 };
  const gstPercentage = activeTaxType.rate;
  const taxName = activeTaxType.name;

  const [discountType, setDiscountType] = useState<'percent' | 'flat'>(() => {
    try {
      const saved = localStorage.getItem('tarazu_calc_discount_type');
      return (saved === 'percent' || saved === 'flat') ? (saved as 'percent' | 'flat') : 'percent';
    } catch {
      return 'percent';
    }
  });
  const [discountValue, setDiscountValue] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tarazu_calc_discount_value');
      return saved ? parseFloat(saved) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [calcMemory, setCalcMemory] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tarazu_calc_memory');
      return saved ? parseFloat(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [calcTaxEnabled, setCalcTaxEnabled] = useState(() => {
    try {
      return localStorage.getItem('tarazu_calc_live_tax_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const [calcTaxRate, setCalcTaxRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tarazu_calc_live_tax_rate');
      return saved ? parseFloat(saved) : 18;
    } catch {
      return 18;
    }
  });

  const [calcUnit, setCalcUnit] = useState<'none' | 'kg' | 'lbs'>(() => {
    try {
      const saved = localStorage.getItem('tarazu_calc_unit');
      return (saved === 'kg' || saved === 'lbs') ? saved : 'none';
    } catch {
      return 'none';
    }
  });

  const [memoryFlash, setMemoryFlash] = useState<'add' | 'sub' | null>(null);
  const [memoryFlashKey, setMemoryFlashKey] = useState<number>(0);

  // Auto-save Calculator states to localStorage (throttled in Battery Saver mode)
  useAutoSave(() => {
    try {
      localStorage.setItem('tarazu_calc_basket', JSON.stringify(basket));
      localStorage.setItem('tarazu_calc_display_val', displayVal);
      localStorage.setItem('tarazu_calc_expression', expression);
      localStorage.setItem('tarazu_calc_new_item_name', newItemName);
      localStorage.setItem('tarazu_calc_is_tax_enabled', isTaxEnabled ? 'true' : 'false');
      localStorage.setItem('tarazu_calc_discount_type', discountType);
      localStorage.setItem('tarazu_calc_discount_value', discountValue.toString());
      localStorage.setItem('tarazu_calc_is_fraction_format', isFractionFormat ? 'true' : 'false');
      localStorage.setItem('tarazu_calc_memory', calcMemory.toString());
      localStorage.setItem('tarazu_calc_live_tax_enabled', calcTaxEnabled ? 'true' : 'false');
      localStorage.setItem('tarazu_calc_live_tax_rate', calcTaxRate.toString());
      localStorage.setItem('tarazu_calc_unit', calcUnit);
    } catch (e) {
      console.warn('Failed to auto-save Calculator states:', e);
    }
  }, settings.batterySaver ? 25000 : 5000);

  // Periodically auto-saves all current billing & input values to sessionStorage
  useAutoSave(() => {
    try {
      sessionStorage.setItem('tarazu_customer_name', customerName);
      sessionStorage.setItem('tarazu_customer_phone', customerPhone);
      sessionStorage.setItem('tarazu_invoice_no', invoiceNo);
      sessionStorage.setItem('tarazu_new_item_name', newItemName);
      sessionStorage.setItem('tarazu_discount_value', discountValue.toString());
      sessionStorage.setItem('tarazu_calc_tax_rate', calcTaxRate.toString());
      
      const savedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastAutoSaved(savedTime);
    } catch (err) {
      console.warn('SessionStorage auto-save failed:', err);
    }
  }, settings.batterySaver ? 15000 : 3000);

  useEffect(() => {
    try {
      localStorage.setItem('tarazu_calc_memory', calcMemory.toString());
    } catch (e) {}
  }, [calcMemory]);

  useEffect(() => {
    try {
      localStorage.setItem('tarazu_calc_live_tax_enabled', calcTaxEnabled ? 'true' : 'false');
    } catch (e) {}
  }, [calcTaxEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('tarazu_calc_live_tax_rate', calcTaxRate.toString());
    } catch (e) {}
  }, [calcTaxRate]);

  useEffect(() => {
    try {
      localStorage.setItem('tarazu_calc_unit', calcUnit);
    } catch (e) {}
  }, [calcUnit]);

  const [currency, setCurrency] = useState<string>(() => {
    try {
      return settings.preferredCurrency || localStorage.getItem('tarazu_calc_currency') || '₹';
    } catch (e) {
      return settings.preferredCurrency || '₹';
    }
  });

  useEffect(() => {
    if (settings.preferredCurrency) {
      setCurrency(settings.preferredCurrency);
    }
  }, [settings.preferredCurrency]);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const [longPressTimeout, setLongPressTimeout] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  // Input states loaded from sessionStorage to preserve values on page refreshes
  const [customerName, setCustomerName] = useState(() => {
    try {
      return sessionStorage.getItem('tarazu_customer_name') || '';
    } catch {
      return '';
    }
  });
  const [customerPhone, setCustomerPhone] = useState(() => {
    try {
      return sessionStorage.getItem('tarazu_customer_phone') || '';
    } catch {
      return '';
    }
  });
  const [invoiceNo, setInvoiceNo] = useState(() => {
    try {
      return sessionStorage.getItem('tarazu_invoice_no') || `TRZ-${Math.floor(100000 + Math.random() * 900000)}`;
    } catch {
      return `TRZ-${Math.floor(100000 + Math.random() * 900000)}`;
    }
  });
  const [lastAutoSaved, setLastAutoSaved] = useState<string | null>(null);

  useEffect(() => {
    if (activeInvoiceDraft && activeInvoiceDraft.type === 'draft_invoice') {
      try {
        setCustomerName(activeInvoiceDraft.customerName || '');
        setCustomerPhone(activeInvoiceDraft.customerPhone || '');
        setInvoiceNo(activeInvoiceDraft.invoiceNo || '');
        setBasket(activeInvoiceDraft.basket || []);
        setDiscountType(activeInvoiceDraft.discountType || 'percent');
        setDiscountValue(activeInvoiceDraft.discountValue || 0);
        setIsTaxEnabled(activeInvoiceDraft.isTaxEnabled || false);
        
        if (activeInvoiceDraft.isTaxEnabled) {
          const matchedGst = activeInvoiceDraft.gstPercentage || 18;
          const matchTax = taxTypes.find(t => Math.abs(t.rate - matchedGst) < 0.01);
          if (matchTax) {
            setActiveTaxTypeId(matchTax.id);
          } else {
            const newId = `custom-${Date.now()}`;
            setTaxTypes(prev => [...prev, {
              id: newId,
              name: activeInvoiceDraft.taxName || 'GST',
              rate: matchedGst
            }]);
            setActiveTaxTypeId(newId);
          }
        }
        
        playSuccessSound(settings.soundEnabled);
        if (onClearInvoiceDraft) {
          onClearInvoiceDraft();
        }
      } catch (err) {
        console.error('Error loading draft', err);
      }
    }
  }, [activeInvoiceDraft, taxTypes, settings.soundEnabled, onClearInvoiceDraft]);

  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return;
    if (longPressTimeout) clearTimeout(longPressTimeout);
    const timer = setTimeout(() => {
      playClickSound(settings.soundEnabled);
      setShowCurrencyMenu(true);
    }, 600);
    setLongPressTimeout(timer);
  };

  const cancelLongPress = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      setLongPressTimeout(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    try {
      localStorage.setItem('tarazu_calc_basket', JSON.stringify(basket));
    } catch (e) {
      // silently ignore quota issues
    }
  }, [basket]);

  useEffect(() => {
    try {
      localStorage.setItem('tarazu_calc_taxtypes', JSON.stringify(taxTypes));
    } catch (e) {}
  }, [taxTypes]);

  useEffect(() => {
    try {
      localStorage.setItem('tarazu_calc_active_taxtype_id', activeTaxTypeId);
    } catch (e) {}
  }, [activeTaxTypeId]);

  const addToBasket = () => {
    let val = parseFloat(displayVal);
    if (isNaN(val)) return;

    if (calcTaxEnabled) {
      val = val * (1 + calcTaxRate / 100);
    }

    const taxSuffix = calcTaxEnabled ? ` (+${calcTaxRate}% Tax)` : '';
    // Use current input name or default
    const itemLabel = (newItemName.trim() || (lang === 'hi' ? `सामान #${basket.length + 1}` : `Item #${basket.length + 1}`)) + taxSuffix;
    const newItem = {
      id: Date.now().toString(),
      name: itemLabel,
      amount: Number(val.toFixed(settings.decimalPrecision)),
      note: '',
    };

    setBasket([...basket, newItem]);
    setNewItemName('');
    playSuccessSound(settings.soundEnabled);
  };

  const quickSum = () => {
    let val = parseFloat(displayVal);
    if (isNaN(val)) return;

    if (calcTaxEnabled) {
      val = val * (1 + calcTaxRate / 100);
    }

    const taxSuffix = calcTaxEnabled ? ` (+${calcTaxRate}% Tax)` : '';
    const itemLabel = (lang === 'hi' ? `त्वरित योग #${basket.length + 1}` : `Quick Sum #${basket.length + 1}`) + taxSuffix;
    const newItem = {
      id: Date.now().toString(),
      name: itemLabel,
      amount: Number(val.toFixed(settings.decimalPrecision)),
      note: '',
    };

    setBasket([...basket, newItem]);
    playSuccessSound(settings.soundEnabled);
  };

  const removeBasketItem = (id: string) => {
    playClickSound(settings.soundEnabled);
    setBasket(basket.filter(item => item.id !== id));
    setCheckedItemIds(prev => prev.filter(checkedId => checkedId !== id));
  };

  const updateBasketItemNote = (id: string, note: string) => {
    setBasket(prev => prev.map(item => item.id === id ? { ...item, note } : item));
  };

  const clearAllBasketNotes = () => {
    playClickSound(settings.soundEnabled);
    setBasket(prev => prev.map(item => ({ ...item, note: '' })));
  };

  const clearBasket = () => {
    playClickSound(settings.soundEnabled);
    setBasket([]);
    setCheckedItemIds([]);
  };

  const deleteSelectedItems = () => {
    playClickSound(settings.soundEnabled);
    setBasket(basket.filter(item => !checkedItemIds.includes(item.id)));
    setCheckedItemIds([]);
  };

  const totalSum = basket.reduce((acc, curr) => acc + curr.amount, 0);
  const discountAmount = discountType === 'percent'
    ? (totalSum * discountValue) / 100
    : Math.min(discountValue, totalSum);
  const subtotalAfterDiscount = Math.max(0, totalSum - discountAmount);
  const taxAmount = isTaxEnabled ? (subtotalAfterDiscount * gstPercentage) / 100 : 0;
  const grandTotal = subtotalAfterDiscount + taxAmount;

  const finalizeBasketBill = () => {
    if (basket.length === 0) return;
    playSuccessSound(settings.soundEnabled);

    const activeTotal = isTaxEnabled ? grandTotal : subtotalAfterDiscount;
    const totalSumStr = String(Number(activeTotal.toFixed(settings.decimalPrecision)));
    setDisplayVal(totalSumStr);
    
    const countText = lang === 'hi' ? `${basket.length} सामान` : `${basket.length} items`;
    const gstText = isTaxEnabled ? ` + ${gstPercentage}% ${taxName}` : '';
    const discountText = discountValue > 0 ? ` (Discount: ${discountType === 'percent' ? `${discountValue}%` : `${currency}${discountValue}`})` : '';
    setExpression(lang === 'hi' ? `बिल योग (${countText}${discountText}${gstText})` : `Bill Total (${countText}${discountText}${gstText})`);
    setIsDone(true);

    // Save detailed ledger to history
    const itemsDetailList = basket.map(item => `${item.name}${item.note ? ` (${item.note})` : ''}: ${currency}${item.amount}`).join(' + ');
    const discountDetail = discountValue > 0 ? ` - Discount(${discountType === 'percent' ? `${discountValue}%` : `${currency}${discountValue}`}: -${currency}${discountAmount.toFixed(settings.decimalPrecision)})` : '';
    const gstDetail = isTaxEnabled ? ` + ${gstPercentage}% ${taxName} (${currency}${taxAmount.toFixed(settings.decimalPrecision)})` : '';

    onAddHistoryItem({
      type: 'calculator',
      expression: lang === 'hi' ? `बिल रसीद (${basket.length} आइटम)` : `Bill Invoice (${basket.length} items)`,
      result: totalSumStr,
      label: lang === 'hi' 
        ? `कुल बिल: [${itemsDetailList}]${discountDetail}${gstDetail} = ${currency}${totalSumStr}` 
        : `Bill Total: [${itemsDetailList}]${discountDetail}${gstDetail} = ${currency}${totalSumStr}`,
    });

    // Clear basket and discount
    setBasket([]);
    setCheckedItemIds([]);
    setDiscountValue(0);
  };

  const handleSaveDraftInvoiceToHistory = () => {
    if (basket.length === 0) return;
    playSuccessSound(settings.soundEnabled);

    onAddHistoryItem({
      type: 'draft_invoice',
      customerName,
      customerPhone,
      invoiceNo,
      basket,
      discountType,
      discountValue,
      isTaxEnabled,
      gstPercentage,
      taxName,
      label: lang === 'hi' 
        ? `ड्राफ्ट बिल ${invoiceNo}: ${customerName || 'नकद ग्राहक'} (${basket.length} सामान)` 
        : `Draft Bill ${invoiceNo}: ${customerName || 'Cash Customer'} (${basket.length} items)`
    });

    setDraftSaved(true);
    setTimeout(() => {
      setDraftSaved(false);
    }, 2000);
  };

  const copyBasketReceipt = () => {
    if (basket.length === 0) return;
    playSuccessSound(settings.soundEnabled);

    // Construct a beautiful plain text receipt
    let receipt = `=====================\n`;
    receipt += lang === 'hi' ? `   डिजिटल बिल रसीद\n` : `    BILL RECEIPT\n`;
    receipt += `=====================\n`;
    basket.forEach((item, index) => {
      const itemNoteStr = item.note ? ` (${item.note})` : '';
      receipt += `${index + 1}. ${(item.name + itemNoteStr).padEnd(14)}: ${currency}${item.amount.toFixed(settings.decimalPrecision)}\n`;
    });
    receipt += `---------------------\n`;
    receipt += `${lang === 'hi' ? 'उपकुल योग' : 'SUBTOTAL'.padEnd(14)}: ${currency}${totalSum.toFixed(settings.decimalPrecision)}\n`;
    if (discountValue > 0) {
      const discLbl = `${lang === 'hi' ? 'छूट' : 'DISCOUNT'} (${discountType === 'percent' ? `${discountValue}%` : currency})`;
      receipt += `${discLbl.padEnd(14)}: -${currency}${discountAmount.toFixed(settings.decimalPrecision)}\n`;
    }
    if (isTaxEnabled) {
      receipt += `${taxName.padEnd(14)} (${gstPercentage}%): ${currency}${taxAmount.toFixed(settings.decimalPrecision)}\n`;
    }
    receipt += `---------------------\n`;
    receipt += `${lang === 'hi' ? 'कुल योग' : 'GRAND TOTAL'.padEnd(14)}: ${currency}${(isTaxEnabled ? grandTotal : subtotalAfterDiscount).toFixed(settings.decimalPrecision)}\n`;
    receipt += `=====================\n`;
    receipt += `Powered by Tarazu Smart\n`;

    navigator.clipboard.writeText(receipt);
    setReceiptCopied(true);
    setTimeout(() => setReceiptCopied(false), 2000);
  };

  const getBillSummaryText = () => {
    let summary = `*${lang === 'hi' ? 'डिजिटल रसीद' : 'BILL RECEIPT'} (${lang === 'hi' ? 'तराज़ू स्मार्ट' : 'Tarazu Smart'})*\n`;
    summary += `---------------------\n`;
    basket.forEach((item, index) => {
      summary += `${index + 1}. ${item.name}${item.note ? ` (${item.note})` : ''}: ${currency}${item.amount.toFixed(settings.decimalPrecision)}\n`;
    });
    summary += `---------------------\n`;
    summary += `${lang === 'hi' ? 'उपकुल योग' : 'Subtotal'}: ${currency}${totalSum.toFixed(settings.decimalPrecision)}\n`;
    if (discountValue > 0) {
      summary += `${lang === 'hi' ? 'छूट' : 'Discount'} (${discountType === 'percent' ? `${discountValue}%` : `Flat ${currency}${discountValue}`}): -${currency}${discountAmount.toFixed(settings.decimalPrecision)}\n`;
    }
    if (isTaxEnabled) {
      summary += `${taxName} (${gstPercentage}%): ${currency}${taxAmount.toFixed(settings.decimalPrecision)}\n`;
      summary += `---------------------\n`;
      summary += `*${lang === 'hi' ? 'कुल देय राशि' : 'GRAND TOTAL'}: ${currency}${grandTotal.toFixed(settings.decimalPrecision)}*\n`;
    } else {
      summary += `---------------------\n`;
      summary += `*${lang === 'hi' ? 'कुल देय राशि' : 'GRAND TOTAL'}: ${currency}${(subtotalAfterDiscount).toFixed(settings.decimalPrecision)}*\n`;
    }
    summary += `---------------------\n`;
    summary += `${lang === 'hi' ? 'तराज़ू स्मार्ट ऐप द्वारा संचालित' : 'Powered by Tarazu Smart app'}`;
    return summary;
  };

  const handleShareReceipt = async () => {
    if (basket.length === 0) return;
    playClickSound(settings.soundEnabled);
    const text = getBillSummaryText();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: lang === 'hi' ? 'तराज़ू डिजिटल रसीद' : 'Tarazu Bill Receipt',
          text: text,
        });
      } catch (err) {
        console.warn('Share failed or cancelled:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setReceiptCopied(true);
        setTimeout(() => setReceiptCopied(false), 2000);
      } catch (err) {
        console.error('Clipboard fallback failed:', err);
      }
    }
  };

  // Keyboard integration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global Ctrl+S and Ctrl+P shortcuts (work even when fields are focused)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        finalizeBasketBill();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (basket.length > 0) {
          setShowPrintPreview(true);
        }
        return;
      }

      // Ignore standard keys if focus is inside input elements
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key;
      if (/[0-9]/.test(key)) {
        pressNum(key);
      } else if (key === '.') {
        pressDot();
      } else if (['+', '-', '*', '/'].includes(key)) {
        const opMap: Record<string, string> = { '*': '×', '/': '÷' };
        pressOp(opMap[key] || key);
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        pressEquals();
      } else if (key === 'Backspace') {
        pressBackspace();
      } else if (key === 'Escape' || key === 'c' || key === 'C') {
        pressClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayVal, expression, isDone, basket, settings.decimalPrecision, settings.soundEnabled, lang, isTaxEnabled, gstPercentage, discountType, discountValue, discountAmount, taxAmount, grandTotal, subtotalAfterDiscount]);

  // Handle calculator button triggers
  const pressNum = (num: string) => {
    playClickSound(settings.soundEnabled);
    if (isDone) {
      setDisplayVal(num);
      setIsDone(false);
    } else {
      if (displayVal === '0') {
        setDisplayVal(num);
      } else {
        setDisplayVal(displayVal + num);
      }
    }
  };

  const pressDot = () => {
    playClickSound(settings.soundEnabled);
    if (isDone) {
      setDisplayVal('0.');
      setIsDone(false);
    } else {
      if (!displayVal.includes('.')) {
        setDisplayVal(displayVal + '.');
      }
    }
  };

  const pressClear = () => {
    playClickSound(settings.soundEnabled);
    setDisplayVal('0');
    setExpression('');
    setIsDone(false);
  };

  const pressBackspace = () => {
    playClickSound(settings.soundEnabled);
    if (displayVal.length > 1) {
      setDisplayVal(displayVal.slice(0, -1));
    } else {
      setDisplayVal('0');
    }
  };

  const pressOp = (op: string) => {
    playClickSound(settings.soundEnabled);
    setExpression(`${displayVal} ${op}`);
    setDisplayVal('0');
    setIsDone(false);
  };

  const pressEquals = () => {
    if (!expression) return;
    
    // Evaluate simple maths expression safely without eval
    try {
      const parts = expression.split(' ');
      const val1 = parseFloat(parts[0]);
      const op = parts[1];
      const val2 = parseFloat(displayVal);

      if (isNaN(val1) || isNaN(val2)) return;

      let res = 0;
      switch (op) {
        case '+':
          res = val1 + val2;
          break;
        case '-':
          res = val1 - val2;
          break;
        case '×':
          res = val1 * val2;
          break;
        case '÷':
          if (val2 === 0) {
            setDisplayVal(lang === 'hi' ? 'त्रुटि (शून्य)' : 'Divide by Zero');
            setIsDone(true);
            return;
          }
          res = val1 / val2;
          break;
        default:
          return;
      }

      playSuccessSound(settings.soundEnabled);
      const resStr = String(Number(res.toFixed(settings.decimalPrecision)));
      const fullExpression = `${expression} ${displayVal} =`;
      
      setExpression(fullExpression);
      setDisplayVal(resStr);
      setIsDone(true);

      // Record to history
      onAddHistoryItem({
        type: 'calculator',
        expression: fullExpression,
        result: resStr,
        label: `${fullExpression} ${resStr}`,
      });

    } catch (e) {
      setDisplayVal('Error');
      setIsDone(true);
    }
  };

  // Helper business tools inside calculator
  const applyGstAdd = (rateVal: number) => {
    playSuccessSound(settings.soundEnabled);
    const val = parseFloat(displayVal) || 0;
    const gstAmt = val * (rateVal / 100);
    const total = val + gstAmt;
    const totalStr = String(Number(total.toFixed(settings.decimalPrecision)));
    
    setExpression(`${val} + ${rateVal}% GST =`);
    setDisplayVal(totalStr);
    setIsDone(true);

    onAddHistoryItem({
      type: 'calculator',
      expression: `${val} + ${rateVal}% GST`,
      result: totalStr,
      label: `${currency}${val} + ${rateVal}% Business GST = ${currency}${totalStr}`,
    });
  };

  const applyGstRemove = (rateVal: number) => {
    playSuccessSound(settings.soundEnabled);
    const val = parseFloat(displayVal) || 0;
    // Formula: Original = Total / (1 + rate/100)
    const baseVal = val / (1 + rateVal / 100);
    const baseStr = String(Number(baseVal.toFixed(settings.decimalPrecision)));

    setExpression(`${val} - ${rateVal}% GST Remove =`);
    setDisplayVal(baseStr);
    setIsDone(true);

    onAddHistoryItem({
      type: 'calculator',
      expression: `${val} - ${rateVal}% GST Remove`,
      result: baseStr,
      label: `${currency}${val} - ${rateVal}% GST Deducted = ${currency}${baseStr}`,
    });
  };

  const applyDiscount = (discVal: number) => {
    playSuccessSound(settings.soundEnabled);
    const val = parseFloat(displayVal) || 0;
    const saved = val * (discVal / 100);
    const subbed = val - saved;
    const finalStr = String(Number(subbed.toFixed(settings.decimalPrecision)));

    setExpression(`${val} - ${discVal}% Disc =`);
    setDisplayVal(finalStr);
    setIsDone(true);

    onAddHistoryItem({
      type: 'calculator',
      expression: `${val} - ${discVal}% Disc`,
      result: finalStr,
      label: `${currency}${val} - ${discVal}% Discount Coupon = ${currency}${finalStr}`,
    });
  };

  const pressMPlus = () => {
    playSuccessSound(settings.soundEnabled);
    const displayedVal = parseFloat(displayVal);
    if (!isNaN(displayedVal)) {
      const actualVal = calcTaxEnabled ? displayedVal * (1 + calcTaxRate / 100) : displayedVal;
      const newMemory = calcMemory + actualVal;
      setCalcMemory(newMemory);
      setExpression(lang === 'hi' 
        ? `मेमरी योग M+: +${actualVal.toFixed(settings.decimalPrecision)}` 
        : `Memory Add M+: +${actualVal.toFixed(settings.decimalPrecision)}`);
      setIsDone(true);
      setMemoryFlash('add');
      setMemoryFlashKey(prev => prev + 1);
    }
  };

  const pressMMinus = () => {
    playSuccessSound(settings.soundEnabled);
    const displayedVal = parseFloat(displayVal);
    if (!isNaN(displayedVal)) {
      const actualVal = calcTaxEnabled ? displayedVal * (1 + calcTaxRate / 100) : displayedVal;
      const newMemory = calcMemory - actualVal;
      setCalcMemory(newMemory);
      setExpression(lang === 'hi' 
        ? `मेमरी घटाव M-: -${actualVal.toFixed(settings.decimalPrecision)}` 
        : `Memory Sub M-: -${actualVal.toFixed(settings.decimalPrecision)}`);
      setIsDone(true);
      setMemoryFlash('sub');
      setMemoryFlashKey(prev => prev + 1);
    }
  };

  const pressMR = () => {
    playSuccessSound(settings.soundEnabled);
    const formatted = String(Number(calcMemory.toFixed(settings.decimalPrecision)));
    setDisplayVal(formatted);
    setExpression(lang === 'hi' ? `मेमरी रिकॉल (MR)` : `Memory Recall (MR)`);
    setIsDone(true);
  };

  const pressMC = () => {
    playSuccessSound(settings.soundEnabled);
    setCalcMemory(0);
    setExpression(lang === 'hi' ? `मेमरी साफ़ (MC)` : `Memory Clear (MC)`);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(displayVal);
    setCopied(true);
    playSuccessSound(settings.soundEnabled);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeFinalValue = calcTaxEnabled && !isNaN(parseFloat(displayVal))
    ? parseFloat(displayVal) * (1 + calcTaxRate / 100)
    : parseFloat(displayVal);

  const hasConversion = !isNaN(activeFinalValue) && calcUnit !== 'none';
  const convertedText = hasConversion
    ? (calcUnit === 'kg'
        ? `${(activeFinalValue * 2.20462).toFixed(3)} lbs`
        : `${(activeFinalValue / 2.20462).toFixed(3)} kg`)
    : '';

  return (
    <div className="max-w-md mx-auto space-y-6">
      
      {/* Calculator Core Outer Wrapper */}
      <div className="bg-slate-900 border border-slate-950 p-5 rounded-3xl shadow-xl space-y-5 relative overflow-hidden">
        
        {/* Subtle decorative grid background for physical calculator aesthetics */}
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none"></div>

        {/* Voice status/error alert overlays */}
        {voiceStatus && (
          <div className="bg-slate-950 border border-slate-800/85 p-3 rounded-2xl flex items-center gap-3 relative z-10 animate-pulse border-emerald-500/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-400 font-mono">{voiceStatus}</span>
          </div>
        )}
        
        {voiceError && (
          <div className="bg-rose-950/80 border border-rose-900 p-3 rounded-2xl flex items-center justify-between gap-2 relative z-10">
            <span className="text-[11px] font-bold text-rose-300">{voiceError}</span>
            <button 
              type="button" 
              onClick={() => setVoiceError(null)} 
              className="text-xs font-black text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* LED Screen */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-right select-all font-mono shadow-inner relative z-10 select-none">
          <div className="flex items-center justify-between gap-2 mb-2 select-none border-b border-slate-900/40 pb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-emerald-700/80 text-[10px] uppercase font-bold tracking-widest hidden xs:inline">
                Digital LED Monitor
              </span>
              <button
                type="button"
                onClick={() => {
                  playClickSound(settings.soundEnabled);
                  setCalcUnit(prev => prev === 'none' ? 'kg' : prev === 'kg' ? 'lbs' : 'none');
                }}
                className="px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-300 text-[9px] font-extrabold uppercase transition-all tracking-wider flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm hover:border-slate-755"
                title={lang === 'hi' ? 'थोक इकाई टॉगल करें (NONE ⇄ KG ⇄ LBS)' : 'Toggle Wholesale Units (NONE ⇄ KG ⇄ LBS)'}
              >
                <Scale className="w-2.5 h-2.5 text-indigo-400" />
                <span>{lang === 'hi' ? 'इकाई:' : 'Unit:'} {calcUnit.toUpperCase()}</span>
              </button>

              {/* Voice-to-text dictation trigger button */}
              <button
                type="button"
                onClick={startVoiceDictation}
                className={`px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase transition-all tracking-wider flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm ${
                  isRecording 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse' 
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 hover:border-slate-755 text-slate-300'
                }`}
                title={lang === 'hi' ? 'आवाज़ द्वारा डिक्टेट करें (hands-free)' : 'Voice-to-Text Dictate (hands-free)'}
              >
                {isRecording ? (
                  <MicOff className="w-2.5 h-2.5 text-rose-400" />
                ) : (
                  <Mic className="w-2.5 h-2.5 text-emerald-400" />
                )}
                <span>{isRecording ? (lang === 'hi' ? 'सुन रहा है...' : 'Listening...') : (lang === 'hi' ? 'आवाज़' : 'Voice')}</span>
              </button>
            </div>

            {calcMemory !== 0 && (
              <motion.div
                key={memoryFlashKey}
                initial={
                  memoryFlash === 'add'
                    ? { backgroundColor: 'rgba(52, 211, 153, 0.45)', scale: 1.15 }
                    : memoryFlash === 'sub'
                    ? { backgroundColor: 'rgba(239, 68, 68, 0.45)', scale: 1.15 }
                    : { backgroundColor: 'rgba(2, 44, 23, 0.6)', scale: 1 }
                }
                animate={{
                  backgroundColor: 'rgba(2, 44, 23, 0.6)',
                  scale: 1,
                }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                onAnimationComplete={() => {
                  setMemoryFlash(null);
                }}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] uppercase font-bold tracking-wider shadow-sm border transition-colors ${
                  memoryFlash === 'add'
                    ? 'text-emerald-300 border-emerald-400 bg-emerald-950/60'
                    : memoryFlash === 'sub'
                    ? 'text-rose-300 border-rose-500 bg-rose-950/60'
                    : 'text-emerald-400 border-emerald-900/40 bg-emerald-950/60'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    memoryFlash === 'add'
                      ? 'bg-emerald-300 animate-ping'
                      : memoryFlash === 'sub'
                      ? 'bg-rose-300 animate-ping'
                      : 'bg-emerald-400'
                  }`}
                ></span>
                <span>M = {currency}{Number(calcMemory.toFixed(settings.decimalPrecision))}</span>
              </motion.div>
            )}
          </div>

          <div className="h-6 text-slate-500 font-semibold text-xs truncate pt-1 tracking-wider">
            {expression}
          </div>
          {/* If live tax is enabled, show subtotal & tax details */}
          {calcTaxEnabled && !isNaN(parseFloat(displayVal)) ? (
            <div className="flex flex-col mt-1 pt-1.5 border-t border-slate-900/60 font-mono text-right">
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>{lang === 'hi' ? 'मूल्य:' : 'BASE:'}</span>
                <span>{currency}{parseFloat(displayVal).toFixed(settings.decimalPrecision)}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-amber-500/80 font-bold mb-0.5">
                <span>{lang === 'hi' ? `कर +${calcTaxRate}%:` : `TAX +${calcTaxRate}%:`}</span>
                <span>+{currency}{((parseFloat(displayVal) * calcTaxRate) / 100).toFixed(settings.decimalPrecision)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-black text-amber-400 border-t border-dashed border-slate-900 pt-1">
                <span className="text-[8px] uppercase tracking-wider text-amber-500 bg-amber-950/40 px-1.5 py-0.5 border border-amber-900/30 rounded font-sans leading-none">{lang === 'hi' ? 'टैक्स सहित' : 'Tax-incl'}</span>
                <span className="text-lg sm:text-xl text-amber-400">
                  {currency}{(parseFloat(displayVal) * (1 + calcTaxRate / 100)).toFixed(settings.decimalPrecision)}
                </span>
              </div>
              {hasConversion && (
                <div className="flex justify-between items-center text-xs font-bold text-indigo-400 border-t border-dotted border-slate-900/80 pt-1 mt-1 font-sans">
                  <span className="text-[8px] uppercase tracking-wider text-indigo-400 bg-indigo-950/30 px-1 py-0.5 border border-indigo-900/20 rounded-md">{lang === 'hi' ? 'थोक रूपांतरण' : 'Wholesale Conv'}</span>
                  <span className="font-mono text-indigo-300">
                    {convertedText}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono tracking-wide truncate mt-1">
                {displayVal}
                {calcUnit !== 'none' && <span className="text-sm font-black text-slate-500 ml-1.5 uppercase">{calcUnit}</span>}
              </div>
              {hasConversion && (
                <div className="flex justify-between items-center w-full text-xs font-bold text-indigo-400 border-t border-dashed border-slate-900/60 pt-1.5 mt-1 font-sans">
                  <span className="text-[8px] uppercase tracking-wider text-indigo-400 bg-indigo-950/30 px-1 py-0.5 border border-indigo-900/20 rounded-md">{lang === 'hi' ? 'थोक रूपांतरण' : 'Wholesale Conv'}</span>
                  <span className="font-mono text-indigo-300">
                    ≈ {convertedText}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Display Tax Control Group */}
        <div className="bg-slate-950/40 border border-slate-800 p-2.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10 select-none">
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={calcTaxEnabled}
                onChange={(e) => {
                  playClickSound(settings.soundEnabled);
                  setCalcTaxEnabled(e.target.checked);
                }}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-500 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500"></div>
              <span className="ml-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-350">
                {lang === 'hi' ? 'टैक्स लागू करें' : 'Apply Tax'}
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-[10px] uppercase font-bold text-slate-500">{lang === 'hi' ? 'दर %:' : 'Tax %:'}</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={calcTaxRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCalcTaxRate(isNaN(val) ? 0 : val);
                }}
                className="w-14 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono font-bold text-xs text-amber-400 py-1 outline-none focus:ring-1 focus:ring-amber-500/50"
              />
              <div className="flex gap-1">
                {[5, 12, 18].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      setCalcTaxRate(preset);
                    }}
                    className={`px-1.5 py-1 text-[9px] font-mono font-bold rounded-md border transition-all cursor-pointer ${
                      calcTaxRate === preset
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* GST & Discount Business Quick preset bar */}
        <div className="grid grid-cols-4 gap-2 relative z-10 select-none">
          <button
            type="button"
            onClick={() => applyGstAdd(18)}
            className="py-2.5 px-0.5 bg-emerald-950/40 border border-emerald-900 text-emerald-400 font-bold text-[10px] sm:text-xs rounded-xl hover:bg-emerald-900/30 transition-colors uppercase cursor-pointer"
          >
            +18% GST
          </button>
          <button
            type="button"
            onClick={() => applyGstRemove(18)}
            className="py-2.5 px-0.5 bg-emerald-950/40 border border-emerald-900 text-emerald-400 font-bold text-[10px] sm:text-xs rounded-xl hover:bg-emerald-900/30 transition-colors uppercase cursor-pointer"
          >
            -18% GST
          </button>
          <button
            type="button"
            onClick={() => applyDiscount(10)}
            className="py-2.5 px-0.5 bg-emerald-950/40 border border-emerald-900 text-emerald-400 font-bold text-[10px] sm:text-xs rounded-xl hover:bg-emerald-900/30 transition-colors uppercase cursor-pointer"
          >
            -10% DISC
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="py-2.5 px-0.5 bg-slate-800 border border-slate-700 text-slate-200 font-bold text-[10px] sm:text-xs rounded-xl hover:bg-slate-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>

        {/* ADD TO BASKET ACTION BAR */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2.5 flex flex-col gap-2 relative z-10 select-none">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 relative flex items-center pr-0">
              <input
                type="text"
                placeholder={lang === 'hi' ? '  सामान का नाम (उदा. आलू)' : '  Item name (e.g. Potato)'}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs py-1.5 pl-3 pr-9 rounded-xl text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-slate-650 font-bold text-center "
              />
              <button
                type="button"
                onClick={startVoiceDictation}
                className={`absolute right-2.5 p-1 rounded-md transition-all cursor-pointer ${
                  isRecording 
                    ? 'text-rose-450 bg-rose-500/10 animate-pulse' 
                    : 'text-slate-400 hover:text-emerald-450 hover:bg-slate-800'
                }`}
                title={lang === 'hi' ? 'आवाज़ से सामान नाम और हिसाब डिक्टेट करें' : 'Dictate item name and calculations hands-free'}
              >
                {isRecording ? (
                  <MicOff className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={addToBasket}
              className="bg-emerald-600 hover:bg-emerald-500 font-extrabold text-white text-[11px] px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 select-none active:scale-95 shadow-md shadow-slate-950 shrink-0"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? `जोड़ें: ${currency}${displayVal}` : `Add: ${currency}${displayVal}`}</span>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={quickSum}
              className="flex-1 bg-slate-800 hover:bg-slate-700/90 border border-slate-700 font-extrabold text-amber-400 text-[11px] py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-95 shadow-md shadow-slate-950"
              title={lang === 'hi' ? 'सामान जोड़े बिना तुरंत कुल योग में जोड़ें' : 'Add to running total without clearing current work'}
            >
              <Plus className="w-3.5 h-3.5 text-amber-500" />
              <span>{lang === 'hi' ? `त्वरित योग: +${currency}${displayVal}` : `Quick Sum: +${currency}${displayVal}`}</span>
            </button>
            {basket.length > 0 && (
              <button
                type="button"
                onClick={clearBasket}
                className="bg-rose-950/40 hover:bg-rose-900/30 border border-rose-900/40 font-extrabold text-rose-400 text-[11px] px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-95 shadow-md shadow-slate-950"
                title={lang === 'hi' ? 'टोकरी साफ़ करें' : 'Clear entire list'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-450" />
                <span>{lang === 'hi' ? 'सूची हटाएं' : 'Clear List'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Memory operations bar */}
        <div className="grid grid-cols-4 gap-2.5 relative z-10 select-none">
          <button
            type="button"
            onClick={pressMC}
            className="py-2 bg-slate-800/80 hover:bg-slate-755 border border-slate-800/80 text-amber-500 font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-sm uppercase flex items-center justify-center gap-1"
            title="Memory Clear (MC)"
          >
            MC
          </button>
          <button
            type="button"
            onClick={pressMR}
            className="py-2 bg-slate-800/80 hover:bg-slate-755 border border-slate-800/80 text-amber-500 font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-sm uppercase flex items-center justify-center gap-1"
            title="Memory Recall (MR)"
          >
            MR
          </button>
          <button
            type="button"
            onClick={pressMMinus}
            className="py-2 bg-slate-800/80 hover:bg-slate-755 border border-slate-800/80 text-emerald-400 font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-sm uppercase flex items-center justify-center gap-1"
            title="Memory Subtract (M-)"
          >
            M-
          </button>
          <button
            type="button"
            onClick={pressMPlus}
            className="py-2 bg-slate-800/80 hover:bg-slate-755 border border-slate-800/80 text-emerald-400 font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-sm uppercase flex items-center justify-center gap-1"
            title="Memory Add (M+)"
          >
            M+
          </button>
        </div>

        {/* Calculator layout grid of keys */}
        <div className="grid grid-cols-4 gap-3 relative z-10 select-none">
          
          {/* Row 1 */}
          <button
            onClick={pressClear}
            className="h-14 bg-rose-950/40 border border-rose-900/60 text-rose-400 hover:bg-rose-900/30 font-bold text-lg rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            C
          </button>
          <button
            onClick={() => applyDiscount(5)}
            className="h-14 bg-slate-800 border border-slate-700 text-slate-350 font-bold text-sm rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            -5%
          </button>
          <button
            onClick={() => applyDiscount(20)}
            className="h-14 bg-slate-800 border border-slate-700 text-slate-350 font-bold text-sm rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            -20%
          </button>
          <button
            onClick={() => pressOp('÷')}
            className="h-14 bg-emerald-600 border border-emerald-500 text-white font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            onClick={() => pressNum('7')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            7
          </button>
          <button
            onClick={() => pressNum('8')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            8
          </button>
          <button
            onClick={() => pressNum('9')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            9
          </button>
          <button
            onClick={() => pressOp('×')}
            className="h-14 bg-emerald-600 border border-emerald-500 text-white font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            onClick={() => pressNum('4')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            4
          </button>
          <button
            onClick={() => pressNum('5')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            5
          </button>
          <button
            onClick={() => pressNum('6')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            6
          </button>
          <button
            onClick={() => pressOp('-')}
            className="h-14 bg-emerald-600 border border-emerald-500 text-white font-bold text-2xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            -
          </button>

          {/* Row 4 */}
          <button
            onClick={() => pressNum('1')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            1
          </button>
          <button
            onClick={() => pressNum('2')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            2
          </button>
          <button
            onClick={() => pressNum('3')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            3
          </button>
          <button
            onClick={() => pressOp('+')}
            className="h-14 bg-emerald-600 border border-emerald-500 text-white font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            onClick={pressBackspace}
            className="h-14 bg-amber-950/40 border border-amber-900/60 text-amber-450 hover:bg-amber-900/30 rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            onClick={() => pressNum('0')}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            0
          </button>
          <button
            onClick={pressDot}
            className="h-14 bg-slate-800/60 border border-slate-800 text-slate-100 font-bold text-xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            .
          </button>
          <button
            onClick={pressEquals}
            className="h-14 bg-emerald-500 border border-emerald-400 text-slate-950 hover:bg-emerald-400 font-extrabold text-2xl rounded-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            =
          </button>
        </div>

      </div>

      {/* SHOPPING BILL BASKET SECTION */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 p-4.5 rounded-2xl shadow-sm space-y-3.5 transition-all relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                {lang === 'hi' ? 'सक्रिय बिल टोकरी' : 'Active Bill Basket'}
                {basket.length > 0 && (
                  <span className="bg-emerald-600 text-white text-[10px] font-black min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1.5">
                    {basket.length}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-400">
                {lang === 'hi' ? 'दुकान की रसीद के लिए सामान जोड़ें' : 'Draft items directly for custom invoice receipts'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {checkedItemIds.length > 0 && (
              <button
                type="button"
                id="btn-delete-selected"
                onClick={deleteSelectedItems}
                className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 border border-slate-205 dark:border-slate-700 bg-rose-50 dark:bg-rose-955/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 px-2.5 py-1 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                <span>{lang === 'hi' ? `चयनित हटाएं (${checkedItemIds.length})` : `Delete Selected (${checkedItemIds.length})`}</span>
              </button>
            )}
            {basket.length > 0 && basket.some(item => item.note) && (
              <button
                type="button"
                id="btn-clear-basket-notes"
                onClick={clearAllBasketNotes}
                className="text-[10px] font-extrabold text-indigo-650 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/80 dark:hover:bg-indigo-950/60 px-2.5 py-1 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <span>{lang === 'hi' ? 'नोट्स हटाएं' : 'Clear Notes'}</span>
              </button>
            )}
            {basket.length > 0 && (
              <button
                type="button"
                onClick={clearBasket}
                className="text-[10px] font-extrabold text-rose-600 dark:text-rose-455 hover:underline border border-rose-100 dark:border-rose-950/50 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/20 active:scale-95 transition-all cursor-pointer"
              >
                {lang === 'hi' ? 'टोकरी साफ करें' : t('clearAll')}
              </button>
            )}
          </div>
        </div>

        {basket.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 text-center border border-dashed border-slate-200 dark:border-slate-705">
            <span className="text-2xl text-slate-350 dark:text-slate-700 block">🛒</span>
            <span className="text-[11px] text-slate-405 dark:text-slate-400 font-medium block mt-1">
              {lang === 'hi'
                ? 'अभी बिल में कोई सामान नहीं है। ऊपर कोई भी गणना करें और सामान जोड़ने के लिए "+जोड़ें" बटन दबाएं।'
                : 'Your bill is empty. Calculate sums on the keypad and press the "+" button above to compile a single invoice.'}
            </span>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Scrollable list of products */}
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {basket.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 px-3 py-2 rounded-xl flex flex-col gap-1.5 transition-colors hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100/30 font-mono"
                >
                  {/* Top Row: Name, Checkbox, Subtotal, Delete */}
                  <div className="flex items-center justify-between w-full text-xs">
                    <div className="flex items-center gap-2.5 truncate pr-2 text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={checkedItemIds.includes(item.id)}
                        onChange={(e) => {
                          playClickSound(settings.soundEnabled);
                          if (e.target.checked) {
                            setCheckedItemIds([...checkedItemIds, item.id]);
                          } else {
                            setCheckedItemIds(checkedItemIds.filter(id => id !== item.id));
                          }
                        }}
                        className="w-3.5 h-3.5 text-emerald-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 rounded focus:ring-emerald-500 focus:ring-1 cursor-pointer accent-emerald-600"
                      />
                      <span className="text-[10px] font-bold text-slate-400">#{index+1}</span>
                      <span className="font-extrabold truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-black text-slate-900 dark:text-emerald-400">
                        {currency}{item.amount.toFixed(settings.decimalPrecision)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeBasketItem(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/35 rounded-lg transition-all dark:text-slate-500 cursor-pointer active:scale-90"
                        title={lang === 'hi' ? 'हटाएं' : 'Delete Item'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Note text input */}
                  <div className="flex items-center gap-1.5 pl-6 w-full">
                    <span className={`text-[9px] font-extrabold uppercase tracking-wide flex-shrink-0 select-none transition-colors duration-200 ${
                      item.note ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {lang === 'hi' ? 'विशेष नोट:' : 'Add Note:'}
                    </span>
                    <input
                      type="text"
                      className={`w-full border rounded px-2 py-0.5 text-[10px] outline-none transition-all duration-205 font-sans ${
                        item.note 
                          ? 'border-indigo-500 dark:border-indigo-600 bg-indigo-50/15 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300 font-bold focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500/20 shadow-sm' 
                          : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-650 focus:border-emerald-550 dark:focus:border-emerald-800 focus:ring-1 focus:ring-emerald-500/25'
                      }`}
                      placeholder={lang === 'hi' ? 'जैसे: ग्रेड क, पैकेट' : 'e.g. Grade A, sack, count etc.'}
                      value={item.note || ''}
                      onChange={(e) => updateBasketItemNote(item.id, e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Total breakdown footer */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-150 dark:border-slate-750/70 space-y-3">
              
              {/* Tax Toggle & GST percentage controls row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-150 dark:border-slate-800/50 text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isTaxEnabled}
                      onChange={(e) => {
                        playClickSound(settings.soundEnabled);
                        setIsTaxEnabled(e.target.checked);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                    <span className="ml-2 text-xs font-black uppercase tracking-wide">
                      {lang === 'hi' ? 'जीएसटी (GST)' : 'Apply GST / Tax'}
                    </span>
                  </label>
                </div>

                {isTaxEnabled && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 sm:mt-0 relative">
                    {/* Tax Sub-type Dropdown Selector */}
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        id="btn-tax-dropdown-toggle"
                        onClick={() => {
                          playClickSound(settings.soundEnabled);
                          setShowTaxTypeDropdown(!showTaxTypeDropdown);
                        }}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs font-black rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 cursor-pointer transition-all active:scale-95 touch-manipulation"
                      >
                        <span className="truncate max-w-[100px]">{taxName}</span>
                        <span className="font-mono bg-emerald-600 text-white px-1 py-0.2 rounded text-[9px]">{gstPercentage}%</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                      </button>

                      {showTaxTypeDropdown && (
                        <>
                          {/* Close backdrop click interceptor */}
                          <div 
                            className="fixed inset-0 z-40 bg-transparent" 
                            onClick={() => setShowTaxTypeDropdown(false)} 
                          />
                          {/* Expanded Dropdown Box */}
                          <div 
                            className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-xl flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 font-sans"
                          >
                            <div className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700 pb-1 px-1 flex justify-between">
                              <span>{lang === 'hi' ? 'कर प्रकार' : 'Tax Type'}</span>
                              <span>{lang === 'hi' ? 'दर %' : 'Rate %'}</span>
                            </div>

                            {/* List of sub-types */}
                            <div className="flex flex-col gap-0.5 max-h-[140px] overflow-y-auto pr-0.5">
                              {taxTypes.map((t) => {
                                const isEditing = editingTaxId === t.id;
                                return (
                                  <div 
                                    key={t.id}
                                    className={`flex items-center justify-between p-1 rounded-lg text-xs transition-all ${
                                      activeTaxTypeId === t.id 
                                        ? 'bg-slate-100 dark:bg-slate-705 font-extrabold text-slate-900 dark:text-white' 
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    {isEditing ? (
                                      <div className="flex items-center gap-1 w-full">
                                        <input
                                          type="text"
                                          value={editingTaxName}
                                          onChange={(e) => setEditingTaxName(e.target.value)}
                                          className="flex-1 min-w-0 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold outline-none"
                                          placeholder="Name"
                                        />
                                        <div className="relative w-12 flex items-center shadow-none">
                                          <input
                                            type="number"
                                            value={editingTaxRate}
                                            onChange={(e) => setEditingTaxRate(e.target.value)}
                                            className="w-full border border-slate-200 dark:border-slate-600 rounded pl-1 pr-3.5 py-0.5 text-right text-[10px] bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="0"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                          />
                                          <span className="absolute right-1 text-[8px] text-slate-400 font-bold">%</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const parsedRate = parseFloat(editingTaxRate);
                                            const sanitizedName = editingTaxName.trim();
                                            if (sanitizedName && !isNaN(parsedRate)) {
                                              playSuccessSound(settings.soundEnabled);
                                              setTaxTypes(prev => prev.map(item => item.id === t.id ? { ...item, name: sanitizedName, rate: Math.min(100, Math.max(0, parsedRate)) } : item));
                                              setEditingTaxId(null);
                                            }
                                          }}
                                          className="text-emerald-500 hover:text-emerald-605 rounded p-0.5 cursor-pointer"
                                          title={lang === 'hi' ? 'सहेजें' : 'Save'}
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            playClickSound(settings.soundEnabled);
                                            setEditingTaxId(null);
                                          }}
                                          className="text-slate-400 hover:text-slate-500 rounded p-0.5 cursor-pointer"
                                          title={lang === 'hi' ? 'रद्द करें' : 'Cancel'}
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        {/* Select Trigger */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            playClickSound(settings.soundEnabled);
                                            setActiveTaxTypeId(t.id);
                                            setShowTaxTypeDropdown(false);
                                          }}
                                          className="flex-1 text-left py-0.5 truncate pr-2 cursor-pointer flex justify-between items-center"
                                        >
                                          <span className="truncate">{t.name}</span>
                                          <span className="font-mono font-black">{t.rate}%</span>
                                        </button>

                                        {/* Edit Trigger */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            playClickSound(settings.soundEnabled);
                                            setEditingTaxId(t.id);
                                            setEditingTaxName(t.name);
                                            setEditingTaxRate(t.rate.toString());
                                          }}
                                          className="text-slate-400 hover:text-indigo-505 rounded p-0.5 transition-colors cursor-pointer ml-1"
                                          title={lang === 'hi' ? 'संपादित करें' : 'Edit'}
                                        >
                                          <Pencil className="w-3 px-0.5 h-3" />
                                        </button>

                                        {/* Delete custom types */}
                                        {taxTypes.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              playClickSound(settings.soundEnabled);
                                              const nextTypes = taxTypes.filter(item => item.id !== t.id);
                                              setTaxTypes(nextTypes);
                                              if (activeTaxTypeId === t.id) {
                                                setActiveTaxTypeId(nextTypes[0].id);
                                              }
                                            }}
                                            className="text-slate-400 hover:text-rose-500 rounded p-0.5 transition-colors cursor-pointer ml-1"
                                            title={lang === 'hi' ? 'हटाएं' : 'Delete'}
                                          >
                                            <X className="w-3 px-0.5 h-3" />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Form to add a new tax subtype */}
                            <div className="border-t border-slate-100 dark:border-slate-700 pt-2 flex flex-col gap-1.5">
                              <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 px-1">
                                {lang === 'hi' ? 'नया कर जोड़ें' : 'Create Tax Sub-type'}
                              </span>
                              <div className="flex gap-1 items-center">
                                <input
                                  type="text"
                                  placeholder={lang === 'hi' ? 'का नाम (उदा. CESS)' : 'Name (e.g. CESS)'}
                                  value={newTaxName}
                                  onChange={(e) => setNewTaxName(e.target.value)}
                                  className="flex-1 min-w-0 border border-slate-200 dark:border-slate-750 rounded px-1.5 py-1 text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-emerald-500 dark:focus:border-emerald-600 font-bold"
                                />
                                <div className="relative w-12 flex items-center shadow-none">
                                  <input
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={newTaxRate}
                                    onChange={(e) => setNewTaxRate(e.target.value)}
                                    className="w-full border border-slate-200 dark:border-slate-750 rounded pl-1 pr-3.5 py-1 text-right text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono outline-none focus:border-emerald-500 dark:focus:border-emerald-600 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <span className="absolute right-1 text-[9px] text-slate-400 dark:text-slate-500 font-bold">%</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const parsedRate = parseFloat(newTaxRate);
                                    const sanitizedName = newTaxName.trim();
                                    if (sanitizedName && !isNaN(parsedRate)) {
                                      playSuccessSound(settings.soundEnabled);
                                      const newId = Date.now().toString();
                                      const newTax = {
                                        id: newId,
                                        name: sanitizedName,
                                        rate: Math.min(100, Math.max(0, parsedRate)),
                                      };
                                      setTaxTypes([...taxTypes, newTax]);
                                      setActiveTaxTypeId(newId);
                                      setNewTaxName('');
                                      setNewTaxRate('');
                                      setShowTaxTypeDropdown(false);
                                    }
                                  }}
                                  className="p-1 px-[7px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[10px] h-7 flex items-center justify-center cursor-pointer transition-colors"
                                  title={lang === 'hi' ? 'सहेजें' : 'Save'}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Quick rate modifier */}
                    <div className="flex items-center bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 w-16">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={gstPercentage}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setTaxTypes(prev => prev.map(t => t.id === activeTaxTypeId ? { ...t, rate: val } : t));
                        }}
                        className="w-full text-right font-mono text-[10px] bg-transparent outline-none border-none p-0 text-slate-800 dark:text-slate-100 font-bold"
                        title={lang === 'hi' ? 'वर्तमान दर संपादन' : 'Quick edit rate'}
                      />
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold ml-0.5">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Global Discount input row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-150 dark:border-slate-800/50 text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wide">
                    {lang === 'hi' ? 'छूट लागू करें (Discount)' : 'Global Discount'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-1 sm:mt-0">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      id="btn-discount-type-percent"
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        setDiscountType('percent');
                        setDiscountValue(0);
                      }}
                      className={`text-[9px] font-black px-2 py-0.5 rounded transition-all cursor-pointer ${
                        discountType === 'percent'
                          ? 'bg-emerald-600 text-dark shadow-sm'
                          : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-300'
                      }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      id="btn-discount-type-flat"
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        setDiscountType('flat');
                        setDiscountValue(0);
                      }}
                      className={`text-[9px] font-black px-2 py-0.5 rounded transition-all cursor-pointer ${
                        discountType === 'flat'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-300'
                      }`}
                    >
                      {currency}
                    </button>
                  </div>
                  {/* Custom Discount input */}
                  <div className={`flex items-center bg-white dark:bg-slate-850 border rounded px-1.5 py-0.5 w-24 transition-all duration-200 ${
                    discountValue > 0 
                      ? 'border-rose-500 dark:border-rose-600 bg-rose-50/10 dark:bg-rose-950/10 shadow-sm shadow-rose-100 dark:shadow-none' 
                      : 'border-slate-200 dark:border-slate-700'
                  }`}>
                    {discountType === 'flat' && (
                      <span className={`text-[10px] font-extrabold mr-0.5 transition-colors duration-200 ${
                        discountValue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {currency}
                      </span>
                    )}
                    <input
                      type="number"
                      min="0"
                      max={discountType === 'percent' ? "100" : undefined}
                      id="input-global-discount-val"
                      value={discountValue || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value) || 0;
                        if (raw < 0) return;
                        if (discountType === 'percent') {
                          setDiscountValue(Math.min(100, raw));
                        } else {
                          setDiscountValue(Math.min(totalSum, raw));
                        }
                      }}
                      className={`w-full text-right font-mono text-[10px] bg-transparent outline-none border-none p-0 font-extrabold transition-colors duration-200 ${
                        discountValue > 0 
                          ? 'text-rose-600 dark:text-rose-400' 
                          : 'text-slate-800 dark:text-slate-150'
                      }`}
                    />
                    {discountType === 'percent' && (
                      <span className={`text-[10px] font-extrabold ml-0.5 transition-colors duration-200 ${
                        discountValue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        %
                      </span>
                    )}
                    {discountValue > 0 && (
                      <button
                        type="button"
                        id="btn-clear-discount"
                        onClick={() => {
                          playClickSound(settings.soundEnabled);
                          setDiscountValue(0);
                        }}
                        className="ml-1 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors cursor-pointer p-0.5 bg-rose-50 dark:bg-rose-950/30 rounded"
                        title={lang === 'hi' ? 'छूट हटाएं' : 'Clear Discount'}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tax & Discount Details breakdown if enabled */}
              {(isTaxEnabled || discountValue > 0) && (
                <div className="flex flex-col gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-150 dark:border-slate-800/50 pb-2 font-mono">
                  <div className="flex justify-between">
                    <span>{lang === 'hi' ? 'उपकुल योग:' : 'Subtotal:'}</span>
                    <span>{currency}{totalSum.toFixed(settings.decimalPrecision)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>
                        {lang === 'hi' ? 'छूट:' : 'Discount:'}{' '}
                        <span className="text-[9px] font-normal font-sans bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 px-1 py-0.5 rounded ml-1">
                          {discountType === 'percent' ? `-${discountValue}%` : `-${currency}${discountValue}`}
                        </span>
                      </span>
                      <span>-{currency}{discountAmount.toFixed(settings.decimalPrecision)}</span>
                    </div>
                  )}
                  {isTaxEnabled && (
                    <div className="flex justify-between text-amber-500">
                      <span>{taxName} ({gstPercentage}%):</span>
                      <span>+{currency}{taxAmount.toFixed(settings.decimalPrecision)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-col items-center justify-between text-slate-800 dark:text-slate-300 border-b border-slate-150 dark:border-slate-800/50 pb-2.5">
                <span className="text-xs font-black">
                  {isTaxEnabled 
                    ? (lang === 'hi' ? 'कुल देय राशि' : 'NET PAYABLE TOTAL') 
                    : (lang === 'hi' ? 'कुल बिल योग' : 'CUMULATIVE TOTAL')}
                </span>
                <div className="relative inline-block shrink-0">
                    <motion.span
                      id="basket-total-display"
                      key={`${isTaxEnabled}-${discountValue}-${grandTotal}-${currency}-${isFractionFormat}`}
                      initial={{ scale: 0.85, color: '#f59e0b' }}
                      animate={{ 
                         scale: [0.85, 1.22, 0.96, 1], 
                         color: isTaxEnabled
                           ? ['#f59e0b', '#f59e0b', '#eab308', '#d97706']
                           : (isFractionFormat ? ['#f59e0b', '#6366f1', '#4f46e5', '#6366f1'] : ['#f59e0b', '#f59e0b', '#10b981', '#10af7e'])
                      }}
                      transition={{ duration: 0.48, ease: "easeInOut" }}
                      className={`text-base font-black font-mono inline-flex items-center gap-1.5 origin-right ml-1 cursor-pointer select-none active:scale-95 transition-all px-2 py-1 rounded-xl border border-transparent shadow-none duration-200 hover:scale-103 ${
                        isTaxEnabled
                          ? 'text-amber-600 dark:text-amber-400 hover:!text-amber-800 dark:hover:!text-amber-300 hover:bg-amber-100/50 hover:border-amber-250 dark:hover:bg-amber-950/30 dark:hover:border-amber-800'
                          : isFractionFormat 
                            ? 'text-indigo-600 dark:text-indigo-400 hover:!text-indigo-800 dark:hover:!text-indigo-300 hover:bg-indigo-100/50 hover:border-indigo-250 dark:hover:bg-indigo-950/30 dark:hover:border-indigo-800' 
                            : 'text-emerald-600 dark:text-emerald-400 hover:!text-emerald-800 dark:hover:!text-emerald-300 hover:bg-emerald-100/50 hover:border-emerald-250 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800'
                      }`}
                      onMouseDown={startLongPress}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      onTouchStart={startLongPress}
                      onTouchEnd={cancelLongPress}
                      onContextMenu={handleContextMenu}
                      title={lang === 'hi' ? 'मुद्रा बदलने के लिए लंबे समय तक दबाएं' : 'Long press to change currency'}
                    >
                      <span>
                        {currency}{isFractionFormat ? formatAsFraction(isTaxEnabled ? grandTotal : subtotalAfterDiscount) : (isTaxEnabled ? grandTotal : subtotalAfterDiscount).toFixed(settings.decimalPrecision)}
                      </span>
                      {isFractionFormat ? (
                        <span 
                          id="fraction-indicator-state"
                          className="inline-flex items-center justify-center text-[9px] px-1 bg-indigo-100 dark:bg-indigo-950/65 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded font-black font-sans scale-90 origin-left"
                          title={lang === 'hi' ? 'भिन्न प्रारूप सक्रिय' : 'Fraction format active'}
                        >
                          ½
                        </span>
                      ) : (
                        <span 
                          id="decimal-indicator-state"
                          className="inline-flex items-center justify-center text-[9px] px-1 bg-emerald-100 dark:bg-emerald-950/65 border border-emerald-250 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-400 rounded font-black font-sans scale-90 origin-left"
                          title={lang === 'hi' ? 'दशमलव प्रारूप सक्रिय' : 'Decimal format active'}
                        >
                          .00
                        </span>
                      )}
                    </motion.span>

                    {showCurrencyMenu && (
                      <>
                        <div 
                          className="fixed inset-0 z-40 bg-transparent" 
                          onClick={() => setShowCurrencyMenu(false)} 
                        />
                        <div 
                          className="absolute right-0 bottom-full mb-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1.5 shadow-xl flex gap-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                        >
                          {['₹', '$', '£', '€'].map((sym) => (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => {
                                playClickSound(settings.soundEnabled);
                                setCurrency(sym);
                                localStorage.setItem('tarazu_calc_currency', sym);
                                setShowCurrencyMenu(false);
                              }}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs transition-colors cursor-pointer ${
                                currency === sym
                                  ? 'bg-emerald-500 text-white'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-300'
                              }`}
                            >
                              {sym}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      setIsFractionFormat(!isFractionFormat);
                    }}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all border cursor-pointer active:scale-95 ${
                      isFractionFormat
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                    title={lang === 'hi' ? 'दशमलव / भिन्न बदलें' : 'Toggle Decimal / Fraction'}
                  >
                    {isFractionFormat ? (lang === 'hi' ? 'दशमलव' : '1.25') : (lang === 'hi' ? 'भिन्न' : '½')}
                  </button>

                  <button
                    type="button"
                    disabled={basket.length === 0}
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      setShowPrintPreview(true);
                    }}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all border cursor-pointer active:scale-95 flex items-center gap-1 ${
                      basket.length === 0
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-150 text-slate-350 dark:bg-slate-900/20 dark:border-slate-800 dark:text-slate-600'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                    title={lang === 'hi' ? 'रसीद प्रिंट करें' : 'Print Receipt'}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'प्रिंट' : 'Print'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={basket.length === 0}
                    onClick={handleShareReceipt}
                    id="btn-share-receipt"
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all border cursor-pointer active:scale-95 flex items-center gap-1 ${
                      basket.length === 0
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-150 text-slate-350 dark:bg-slate-900/20 dark:border-slate-800 dark:text-slate-600'
                        : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 border-indigo-250 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400'
                    }`}
                    title={lang === 'hi' ? 'रसीद साझा करें' : 'Share Receipt'}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{lang === 'hi' ? 'साझा' : 'Share'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={basket.length === 0}
                    onClick={handleSaveDraftInvoiceToHistory}
                    className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all border cursor-pointer active:scale-95 flex items-center gap-1 ${
                      basket.length === 0
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-150 text-slate-350 dark:bg-slate-900/20 dark:border-slate-800 dark:text-slate-600'
                        : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border-emerald-250 dark:border-emerald-850 text-emerald-750 dark:text-emerald-400'
                    }`}
                    title={lang === 'hi' ? 'ड्राफ्ट सहेजें' : 'Save Draft'}
                  >
                    <span>{draftSaved ? (lang === 'hi' ? 'सहेजा गया! ✓' : 'Saved! ✓') : (lang === 'hi' ? 'ड्राफ्ट सहेजें' : 'Save Draft')}</span>
                  </button>

                  <span 
                    id="basket-item-count-badge"
                    className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide shadow-sm select-none"
                    title={lang === 'hi' ? `${basket.length} सामान टोकरी में` : `${basket.length} items in basket`}
                  >
                    <ShoppingCart className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>{basket.length}</span>
                  </span>

                  

                  {/* Print Preview/Invoice Dialog Box */}
                  {showPrintPreview && basket.length > 0 && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-4">
                      <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 relative border border-slate-100 animate-in fade-in zoom-in duration-200">
                        
                        {/* Modal Heading - Hidden during physical window.print() */}
                        <div className="flex items-center justify-between border-b pb-4 print:hidden">
                          <div className="flex items-center gap-2 text-slate-850">
                            <Printer className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-black text-sm uppercase tracking-wide">
                              {lang === 'hi' ? 'बिल प्रिंट पूर्वदर्शन' : 'Invoice Print Preview'}
                            </h3>
                          </div>
                          
                          <button
                            onClick={() => setShowPrintPreview(false)}
                            className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          >
                            <X className="w-5 h-5 text-slate-400" />
                          </button>
                        </div>

                        {/* PRINT-ONLY/PREVIEW AREA WITH PROVEN ID */}
                        <div id="invoice-print-area" className="bg-white text-black p-4 space-y-6 font-sans">
                          
                          {/* Invoice Header details */}
                          <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 border-b-2 border-black pb-5 text-left w-full">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 select-none text-center sm:text-left">
                              {/* Shop Brand Logo */}
                              {settings.shopLogo && (
                                settings.shopLogo.startsWith('data:image/') || settings.shopLogo.startsWith('http') ? (
                                  <div className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden border border-black/15 bg-white p-1 flex items-center justify-center shadow-sm">
                                    <img
                                      src={settings.shopLogo}
                                      alt="Shop Logo"
                                      className="max-w-full max-h-full object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-14 h-14 shrink-0 rounded-2xl bg-slate-100 border border-black/10 text-4xl flex items-center justify-center select-none shadow-sm">
                                    {settings.shopLogo}
                                  </div>
                                )
                              )}
                              
                              <div className="space-y-1">
                                {/* Shop Information */}
                                <h1 className="text-xl font-black uppercase tracking-tight text-black">
                                  {settings.shopName || (lang === 'hi' ? 'स्मार्ट तराजू की दुकान' : 'Smart Weigh Store')}
                                </h1>
                                {settings.shopPhone && (
                                  <p className="text-xs font-semibold text-black flex items-center justify-center sm:justify-start gap-1">
                                    <span>📱 {lang === 'hi' ? 'दूरभाष:' : 'Phone:'}</span> {settings.shopPhone}
                                  </p>
                                )}
                                {settings.shopGst && (
                                  <p className="text-xs font-bold text-black flex items-center justify-center sm:justify-start gap-1 text-left">
                                    <span>🧾 {lang === 'hi' ? 'जीएसटीआईएन (GSTIN):' : 'GSTIN:'}</span> {settings.shopGst}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-center sm:text-right space-y-1 self-stretch sm:self-auto">
                              <div className="text-xs font-bold text-black">
                                <span className="uppercase">{lang === 'hi' ? 'बिल संख्या:' : 'Bill No:'}</span>
                                <span className="font-mono ml-1">{invoiceNo}</span>
                              </div>
                              <div className="text-xs text-black">
                                <span className="font-bold">{lang === 'hi' ? 'तिथि:' : 'Date:'}</span>
                                <span className="ml-1 font-mono">{new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}</span>
                              </div>
                              <div className="text-xs text-black font-semibold">
                                <span>{lang === 'hi' ? 'समय:' : 'Time:'}</span>
                                <span className="ml-1 font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          </div>

                          {/* Editable Billing Inputs - Hides values/borders during window.print() */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border print:border-none print:p-0 print:bg-transparent text-left relative">
                            {lastAutoSaved && (
                              <div className="sm:col-span-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold select-none pb-1 border-b border-slate-200/50 print:hidden">
                                <span className="flex items-center gap-1.5 text-emerald-650 dark:text-emerald-400 font-extrabold uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                  <span>{lang === 'hi' ? 'ऑटो-सेव सुरक्षित' : 'Auto-Save Active'}</span>
                                </span>
                                <span className="font-mono">
                                  {lang === 'hi' ? `अंतिम सुरक्षित: ${lastAutoSaved}` : `Saved: ${lastAutoSaved}`}
                                </span>
                              </div>
                            )}
                            <div className="text-left">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 print:hidden select-none">
                                {lang === 'hi' ? 'ग्राहक का नाम' : 'Customer Name'}
                              </label>
                              <input
                                type="text"
                                placeholder={lang === 'hi' ? 'उदा. राजेश कुमार' : 'e.g. Rajesh Kumar'}
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full text-xs font-extrabold capitalize text-black bg-transparent border-b border-transparent focus:border-emerald-600 outline-none pb-0.5 print:hidden mt-1"
                              />
                              <div className="hidden print:block text-xs text-black font-semibold">
                                <span className="text-[11px] font-black">{lang === 'hi' ? 'ग्राहक:' : 'Customer:'}</span> {customerName || (lang === 'hi' ? 'नकद ग्राहक' : 'Cash Customer')}
                              </div>
                            </div>

                            <div className="text-left">
                              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 print:hidden select-none">
                                {lang === 'hi' ? 'मोबाइल नंबर (वैकल्पिक)' : 'Mobile Number (Optional)'}
                              </label>
                              <input
                                type="tel"
                                placeholder={lang === 'hi' ? 'उदा. +91 98765 43210' : 'e.g. +91 98765 43210'}
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                className="w-full text-xs font-mono font-bold text-black bg-transparent border-b border-transparent focus:border-emerald-600 outline-none pb-0.5 print:hidden mt-1"
                              />
                              {customerPhone && (
                                <div className="hidden print:block text-xs text-black font-semibold mt-1">
                                  <span className="text-[11px] font-black">{lang === 'hi' ? 'मोब:' : 'Mob:'}</span> {customerPhone}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Itemized Calculations table structured cleanly for thermal/A4 printing */}
                          <div className="border border-black overflow-hidden rounded-lg">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-black text-white uppercase text-[10px] tracking-wider border-b border-black">
                                  <th className="py-2.5 px-3 text-center w-12 font-black">#</th>
                                  <th className="py-2.5 px-3 font-black">{lang === 'hi' ? 'विवरण' : 'Particulars'}</th>
                                  <th className="py-2.5 px-3 text-right w-28 font-black">{lang === 'hi' ? 'विवरण मूल्य' : 'Amount'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {basket.map((item, idx) => (
                                  <tr key={item.id} className="border-b border-black">
                                    <td className="py-2.5 px-3 text-center font-mono font-bold text-[11px] text-black">
                                      {idx + 1}
                                    </td>
                                    <td className="py-2.5 px-3 text-left">
                                      <p className="font-extrabold text-black text-sm">{item.name}</p>
                                      {item.note && (
                                        <p className="text-[10px] font-bold text-gray-700 italic mt-0.5">
                                          {lang === 'hi' ? 'नोट: ' : 'Note: '}{item.note}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-black text-[13px] text-black">
                                      {currency}{item.amount.toFixed(settings.decimalPrecision)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Invoice Totals Breakdown */}
                          <div className="flex flex-col items-end space-y-1.5 pt-2">
                            <div className="w-full sm:w-80 space-y-1.5 text-xs text-black">
                              <div className="flex justify-between font-semibold">
                                <span>{lang === 'hi' ? 'उपकुल योग (सामान):' : 'Subtotal (Items):'}</span>
                                <span className="font-mono">{currency}{totalSum.toFixed(settings.decimalPrecision)}</span>
                              </div>

                              {discountValue > 0 && (
                                <div className="flex justify-between font-bold text-green-700">
                                  <span>{lang === 'hi' ? `छूट (${discountType === 'percent' ? `${discountValue}%` : 'नियत'}):` : `Discount (${discountType === 'percent' ? `${discountValue}%` : 'Flat'}):`}</span>
                                  <span className="font-mono">-{currency}{discountAmount.toFixed(settings.decimalPrecision)}</span>
                                </div>
                              )}

                              {isTaxEnabled && (
                                <div className="flex justify-between font-semibold">
                                  <span>{taxName} ({gstPercentage}%):</span>
                                  <span className="font-mono">+{currency}{taxAmount.toFixed(settings.decimalPrecision)}</span>
                                </div>
                              )}

                              <div className="flex justify-between border-t-2 border-black pt-2 text-sm font-black text-black">
                                <span>{lang === 'hi' ? 'कुल देय राशि:' : 'GRAND TOTAL:'}</span>
                                <span className="font-mono text-base">{currency}{(isTaxEnabled ? grandTotal : subtotalAfterDiscount).toFixed(settings.decimalPrecision)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Print Footer message */}
                          <div className="text-center pt-6 border-t-2 border-dashed border-gray-300 select-none">
                            <p className="text-xs font-bold text-black">
                              {lang === 'hi' ? 'खरीदारी और गणना के लिए धन्यवाद!' : 'Thank you for your business!'}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-mono">
                              {lang === 'hi' ? 'तराज़ू स्मार्ट ऐप द्वारा संचालित' : 'Powered by Tarazu Smart app'}
                            </p>
                          </div>

                        </div>

                        {/* Print Trigger, Copy Fallback & Cancel Action Buttons */}
                        <div className="space-y-4 print:hidden select-none">
                          <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowPrintPreview(false)}
                              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-705 text-xs rounded-2xl font-black transition-all cursor-pointer text-center"
                            >
                              {lang === 'hi' ? 'बंद करें' : 'Cancel & Close'}
                            </button>
                            <button
                              type="button"
                              onClick={handleShareReceipt}
                              className="flex-1 py-3 px-4 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-2xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                            >
                              <span>{receiptCopied ? (lang === 'hi' ? 'कॉपी हो गया! ✓' : 'Copied! ✓') : (lang === 'hi' ? 'रसीद कॉपी करें' : 'Copy Text Receipt')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveDraftInvoiceToHistory}
                              className="flex-1 py-3 px-4 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs rounded-2xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer text-center"
                            >
                              <span>{draftSaved ? (lang === 'hi' ? 'ड्राफ्ट सहेजा गया! ✓' : 'Draft Saved! ✓') : (lang === 'hi' ? 'ड्राफ्ट सहेजें' : 'Save Invoice Draft')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playSuccessSound(settings.soundEnabled);
                                generateInvoicePDF({
                                  shopName: settings.shopName || (lang === 'hi' ? 'स्मार्ट तराजू की दुकान' : 'Smart Weigh Store'),
                                  shopPhone: settings.shopPhone,
                                  shopGst: settings.shopGst,
                                  shopLogo: settings.shopLogo,
                                  invoiceNo: invoiceNo,
                                  customerName: customerName,
                                  customerPhone: customerPhone,
                                  dateStr: new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  }),
                                  timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                  items: basket.map(item => ({
                                    name: item.name,
                                    note: item.note,
                                    amount: item.amount,
                                  })),
                                  subtotal: totalSum,
                                  discountLabel: lang === 'hi' ? `छूट (${discountType === 'percent' ? `${discountValue}%` : 'नियत'})` : `Discount (${discountType === 'percent' ? `${discountValue}%` : 'Flat'})`,
                                  discountAmount: discountAmount,
                                  taxLabel: `${taxName} (${gstPercentage}%)`,
                                  taxAmount: taxAmount,
                                  grandTotal: isTaxEnabled ? grandTotal : subtotalAfterDiscount,
                                  preferredCurrency: currency,
                                  lang: lang,
                                });
                              }}
                              className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/10 cursor-pointer text-center"
                            >
                              <FileDown className="w-4 h-4" />
                              <span>{lang === 'hi' ? 'पीडीएफ डाउनलोड' : 'Download PDF'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playSuccessSound(settings.soundEnabled);
                                const success = triggerPrint();
                                if (!success) {
                                  // Fallback copy immediately if standard printer process fails or is blocked
                                  handleShareReceipt();
                                }
                              }}
                              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/10 cursor-pointer text-center"
                            >
                              <Printer className="w-4 h-4" />
                              <span>{lang === 'hi' ? 'रसीद अभी प्रिंट करें' : 'Print Invoice Now'}</span>
                            </button>
                          </div>
                          
                          <p className="text-[10px] text-center text-slate-400 font-bold leading-normal">
                            {lang === 'hi' 
                              ? '💡 सुझाव: यदि आईफ्रेम सैंडबॉक्स के कारण प्रिंटर संवाद न खुले, तो "रसीद कॉपी करें" का उपयोग करें या सबसे ऊपर "Open in New Tab" पर क्लिक करें।' 
                              : '💡 Pro-Tip: If printing doesn\'t open in the editor preview iframe, click "Open in New Tab" (top-right of screen) or use the "Copy Text Receipt" fallback.'}
                          </p>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
                
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 select-none pt-1">
                <button
                  type="button"
                  onClick={copyBasketReceipt}
                  className="py-2 bg-slate-105 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-700 text-slate-755 dark:text-slate-200 text-xs rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition-all outline-none border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-95"
                >
                  {receiptCopied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Receipt className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{receiptCopied ? (lang === 'hi' ? 'रसीद कॉपी हुई!' : 'Receipt Copied!') : (lang === 'hi' ? 'रसीद कॉपी' : 'Get Copy Invoice')}</span>
                </button>
                <button
                  type="button"
                  onClick={finalizeBasketBill}
                  className="py-2 bg-emerald-600 hover:bg-emerald-505 text-white text-xs rounded-xl font-black flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer shadow-emerald-900/10"
                >
                  <span>{lang === 'hi' ? 'पूर्ण करें व सहेजें' : 'Finalize & Record'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-xl">💡</span>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <p className="font-bold uppercase tracking-wider">{lang === 'hi' ? 'कीबोर्ड सपोर्ट सक्रिय है!' : 'Physical Keyboard Enabled!'}</p>
          <p className="mt-0.5">Use on-screen buttons or type numbers directly. <kbd className="bg-white dark:bg-slate-800 border px-1 rounded shadow-sm text-slate-705 dark:text-slate-200 font-mono text-[10px]">Back</kbd> deletes, <kbd className="bg-white dark:bg-slate-800 border px-1 rounded shadow-sm text-slate-705 dark:text-slate-200 font-mono text-[10px]">Enter</kbd> solves, <kbd className="bg-white dark:bg-slate-800 border px-1 rounded shadow-sm text-slate-705 dark:text-slate-200 font-mono text-[10px]">Esc</kbd> clears, <kbd className="bg-white dark:bg-slate-800 border px-1.5 py-0.5 rounded shadow-sm text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-extrabold font-mono">Ctrl + S</kbd> saves bills, and <kbd className="bg-white dark:bg-slate-800 border px-1.5 py-0.5 rounded shadow-sm text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-extrabold font-mono">Ctrl + P</kbd> prints.</p>
        </div>
      </div>

    </div>
  );
}
