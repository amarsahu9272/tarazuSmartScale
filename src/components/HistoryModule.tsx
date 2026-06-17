import React, { useState, useRef, useEffect } from 'react';
import {
  History,
  Search,
  Trash2,
  Download,
  Filter,
  Calendar,
  RefreshCcw,
  FileText,
  CheckCircle,
  Upload,
  AlertCircle,
  X,
  FileSpreadsheet,
  HelpCircle,
  Printer,
  Check,
  Square,
  CheckSquare,
  Pencil,
  FileDown
} from 'lucide-react';
import { Language, HistoryItem, AppSettings } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { parseAmountFromHistoryItem } from '../utils/historyHelper';
import { triggerPrint } from '../utils/print';
import { generateInvoicePDF } from '../utils/pdfGenerator';

// Robust, lightweight CSV Parser with semantic type category & timestamp detection
const handleCSVFileParse = (text: string) => {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Parse header columns
  const headerLine = lines[0];
  const headers: string[] = [];
  let currentHeader = '';
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(currentHeader.trim().toLowerCase());
      currentHeader = '';
    } else {
      currentHeader += char;
    }
  }
  headers.push(currentHeader.trim().toLowerCase());

  const parsedItems: any[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line) continue;

    const values: string[] = [];
    let currentVal = '';
    let insideQuotes = false;

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());

    // Build row object
    const rowObj: Record<string, string> = {};
    headers.forEach((header, colIndex) => {
      let val = values[colIndex] || '';
      // Strip outer double quotes if present
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      rowObj[header] = val;
    });

    // Detect fields
    // 1. Label/Description
    let label = '';
    const labelKeys = ['calculation description', 'description', 'label', 'text', 'summary', 'details', 'calculation'];
    for (const key of labelKeys) {
      if (rowObj[key]) {
        label = rowObj[key];
        break;
      }
    }
    // Fallback if label is empty: find any text column that isn't ID/timestamp/type
    if (!label) {
      const remainingCols = Object.keys(rowObj).filter(k => !['id', 'timestamp', 'date', 'category', 'type'].includes(k));
      if (remainingCols.length > 0) {
        label = rowObj[remainingCols[0]];
      } else {
        label = Object.values(rowObj).join(' - ');
      }
    }

    if (!label || label.trim() === '') continue;

    // 2. Type/Category
    let type: 'tarazu' | 'converter' | 'calculator' | 'business' = 'tarazu';
    let rawType = '';
    const typeKeys = ['category', 'type', 'module', 'section', 'class'];
    for (const key of typeKeys) {
      if (rowObj[key]) {
        rawType = rowObj[key].toLowerCase();
        break;
      }
    }
    if (rawType.includes('tarazu') || rawType.includes('weigh') || rawType.includes('scale')) {
      type = 'tarazu';
    } else if (rawType.includes('converter') || rawType.includes('convert') || rawType.includes('conversion')) {
      type = 'converter';
    } else if (rawType.includes('calculator') || rawType.includes('calc') || rawType.includes('math')) {
      type = 'calculator';
    } else if (rawType.includes('business') || rawType.includes('biz') || rawType.includes('gst') || rawType.includes('profit')) {
      type = 'business';
    } else {
      // Guess from label keywords
      const lowerLabel = label.toLowerCase();
      if (lowerLabel.includes('kg') || lowerLabel.includes('gm') || lowerLabel.includes('rate') || lowerLabel.includes('weight')) {
        type = 'tarazu';
      } else if (lowerLabel.includes('convert') || lowerLabel.includes('unit') || lowerLabel.includes('⇒') || lowerLabel.includes('to')) {
        type = 'converter';
      } else if (lowerLabel.includes('gst') || lowerLabel.includes('profit') || lowerLabel.includes('emi') || lowerLabel.includes('interest')) {
        type = 'business';
      } else if (lowerLabel.includes('+') || lowerLabel.includes('-') || lowerLabel.includes('×') || lowerLabel.includes('÷') || lowerLabel.includes('/') || lowerLabel.includes('=')) {
        type = 'calculator';
      }
    }

    // 3. Timestamp/Date
    let timestamp = Date.now() - (lineIndex * 1000); // Decelerating default so unique order is preserved
    let rawTimestamp = rowObj['timestamp'] || rowObj['time'] || rowObj['unix'];
    let rawDate = rowObj['date'] || rowObj['day'] || rowObj['datetime'];

    if (rawTimestamp) {
      const parsedTs = parseInt(rawTimestamp, 10);
      if (!isNaN(parsedTs)) {
        timestamp = parsedTs;
      }
    } else if (rawDate) {
      const parsedDate = Date.parse(rawDate);
      if (!isNaN(parsedDate)) {
        timestamp = parsedDate;
      }
    }

    // 4. Record ID matching
    const rawId = rowObj['id'] || rowObj['uuid'] || rowObj['key'];
    const id = rawId || (Math.random().toString(36).substring(2, 9) + Date.now().toString());

    // Push structured items
    parsedItems.push({
      id,
      type,
      timestamp,
      label,
    });
  }

  return parsedItems;
};

interface HistoryModuleProps {
  lang: Language;
  settings: AppSettings;
  history: HistoryItem[];
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onImportHistory?: (items: HistoryItem[], isMerge: boolean) => void;
  onLoadInvoiceDraft?: (draft: HistoryItem) => void;
}

export default function HistoryModule({
  lang,
  settings,
  history,
  onDeleteItem,
  onClearAll,
  onImportHistory,
  onLoadInvoiceDraft,
}: HistoryModuleProps) {
  const t = translate(lang);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'tarazu' | 'converter' | 'calculator' | 'business' | 'draft_invoice'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Item Multiselection / Billing Receipt states
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);
  const [invoiceCopied, setInvoiceCopied] = useState(false);

  // Auto-generate a billing reference whenever we open the preview
  const handleOpenSelectedInvoice = (items: HistoryItem[]) => {
    if (items.length === 0) return;
    if (items.length === 1 && items[0].type === 'draft_invoice') {
      const draft = items[0];
      setCustomerName(draft.customerName || '');
      setCustomerPhone(draft.customerPhone || '');
      setInvoiceNo(draft.invoiceNo || '');
    } else {
      setCustomerName('');
      setCustomerPhone('');
      setInvoiceNo(`INV-${new Date().getFullYear().toString().slice(-2)}${(Date.now() % 1000000).toString().padStart(6, '0')}`);
    }
    setShowInvoicePreview(true);
    playClickSound(settings.soundEnabled);
  };

  const handleShareHistoryInvoice = async () => {
    if (selectedItems.length === 0) return;
    playClickSound(settings.soundEnabled);

    const totalAmt = selectedItems.reduce((acc, current) => acc + parseAmountFromHistoryItem(current, settings.preferredCurrency), 0);
    
    let summary = `🧾 ${settings.shopName || (lang === 'hi' ? 'स्मार्ट तराजू की दुकान' : 'Smart Weigh Store')}\n`;
    if (settings.shopPhone) summary += `📱 Phone: ${settings.shopPhone}\n`;
    if (settings.shopGst) summary += `GSTIN: ${settings.shopGst}\n`;
    summary += `---------------------\n`;
    summary += `${lang === 'hi' ? 'बिल संख्या:' : 'Bill No:'} ${invoiceNo}\n`;
    summary += `${lang === 'hi' ? 'तिथि:' : 'Date:'} ${new Date().toLocaleDateString()}\n`;
    summary += `${lang === 'hi' ? 'ग्राहक:' : 'Customer:'} ${customerName || (lang === 'hi' ? 'नकद ग्राहक' : 'Cash Customer')}\n`;
    if (customerPhone) summary += `${lang === 'hi' ? 'मोब:' : 'Mob:'} ${customerPhone}\n`;
    summary += `---------------------\n`;
    summary += `${lang === 'hi' ? 'सामान विवरण:' : 'Particulars:'}\n`;
    
    selectedItems.forEach((item, idx) => {
      const amount = parseAmountFromHistoryItem(item, settings.preferredCurrency);
      const name = item.type === 'tarazu' ? (lang === 'hi' ? 'तराजू मापन' : 'Weighment Scale') : item.type.toUpperCase();
      summary += `${idx + 1}. ${name} - ${item.label}\n   => ${settings.preferredCurrency} ${amount.toFixed(2)}\n`;
    });
    
    summary += `---------------------\n`;
    if (showTaxBreakdown) {
      const taxableVal = totalAmt / 1.18;
      const gstAmt = totalAmt - taxableVal;
      summary += `${lang === 'hi' ? 'कर योग्य मूल्य:' : 'Taxable Amt:'} ${settings.preferredCurrency} ${taxableVal.toFixed(2)}\n`;
      summary += `CGST (9%): ${settings.preferredCurrency} ${(gstAmt/2).toFixed(2)}\n`;
      summary += `SGST (9%): ${settings.preferredCurrency} ${(gstAmt/2).toFixed(2)}\n`;
    }
    summary += `*${lang === 'hi' ? 'कुल राशि (GRAND TOTAL):' : 'GRAND TOTAL:'} ${settings.preferredCurrency} ${totalAmt.toFixed(2)}*\n`;
    summary += `---------------------\n`;
    summary += `${lang === 'hi' ? 'तराजू एप्प डिजिटल रसीद' : 'Tarazu App Digital Receipt'}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: lang === 'hi' ? 'तराजू डिजिटल रसीद' : 'Tarazu Bill Receipt',
          text: summary,
        });
      } else {
        await navigator.clipboard.writeText(summary);
        setInvoiceCopied(true);
        setTimeout(() => setInvoiceCopied(false), 2000);
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(summary);
        setInvoiceCopied(true);
        setTimeout(() => setInvoiceCopied(false), 2000);
      } catch (clipErr) {
        console.error('Clipboard copy failed:', clipErr);
      }
    }
  };

  const selectedItems = history.filter(item => selectedItemIds.includes(item.id));

  // Helper inside click handlers
  const handleCheckboxToggle = (id: string) => {
    playClickSound(settings.soundEnabled);
    setSelectedItemIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = (filtered: HistoryItem[]) => {
    playClickSound(settings.soundEnabled);
    const filteredIds = filtered.map(f => f.id);
    const allFilteredAreSelected = filteredIds.every(id => selectedItemIds.includes(id));
    if (allFilteredAreSelected) {
      // Remove all filtered from selection
      setSelectedItemIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Add all filtered to selection
      setSelectedItemIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    }
  };

  // Uploader component states
  const [showImportTray, setShowImportTray] = useState(false);
  const [showHelpPopover, setShowHelpPopover] = useState(false);
  const [parsedItems, setParsedItems] = useState<any[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search ledger
  const filteredHistory = history.filter((item) => {
    const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
    const matchesSearch =
      item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesDate = true;
    if (startDate) {
      const startMs = new Date(`${startDate}T00:00:00`).getTime();
      matchesDate = matchesDate && item.timestamp >= startMs;
    }
    if (endDate) {
      const endMs = new Date(`${endDate}T23:59:59.999`).getTime();
      matchesDate = matchesDate && item.timestamp <= endMs;
    }
    return matchesFilter && matchesSearch && matchesDate;
  });

  const handleQuickPreset = (preset: 'today' | '7days' | '30days' | 'clear') => {
    playClickSound(settings.soundEnabled);
    if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    setEndDate(todayStr);

    if (preset === 'today') {
      setStartDate(todayStr);
    } else if (preset === '7days') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
    }
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processCSVFile(file);
  };

  const processCSVFile = (file: File) => {
    setErrorMessage(null);
    setParsedItems(null);

    // Verify CSV extension
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrorMessage(
        lang === 'hi' 
          ? 'कृपया केवल .CSV प्रारूप की फ़ाइल ही अपलोड करें।' 
          : 'Extension mismatch! Please select a valid CSV file (.csv).'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setErrorMessage(
          lang === 'hi'
            ? 'फ़ाइल का डेटा लोड करने में विफलता।'
            : 'Unreadable context! Failed to parse text stream from file.'
        );
        return;
      }

      try {
        const rows = handleCSVFileParse(text);
        if (rows.length === 0) {
          setErrorMessage(
            lang === 'hi'
              ? 'अमान्य प्रारूप! फ़ाइल में कोई संगत बहीखाता रिकॉर्ड नहीं मिले।'
              : 'Zero rows detected! No compatible weight/calculator history columns could be found.'
          );
        } else {
          setParsedItems(rows);
          playSuccessSound(settings.soundEnabled);
        }
      } catch (err) {
        setErrorMessage(
          lang === 'hi'
            ? 'फ़ाइल का विश्लेषण करने में कोई त्रुटि हुई।'
            : 'Formatting error! Failed to decipher the CSV structure.'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processCSVFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = (isMerge: boolean) => {
    if (!parsedItems || !onImportHistory) return;

    onImportHistory(parsedItems, isMerge);

    setSuccessBanner(
      isMerge
        ? (lang === 'hi' ? `${parsedItems.length} रिकॉर्ड्स वर्तमान बहीखाता में मिला दिये गए!` : `Successfully merged ${parsedItems.length} records!`)
        : (lang === 'hi' ? `बहीखाता ${parsedItems.length} रिकॉर्ड्स के साथ पुनर्स्थापित हुआ!` : `Overwrote entire ledger with ${parsedItems.length} records!`)
    );

    // reset parsing drawer
    setParsedItems(null);
    setShowImportTray(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // fade banner after 5.5s
    setTimeout(() => {
      setSuccessBanner(null);
    }, 5500);
  };

  return (
    <div className="space-y-6">

      {/* Success banner alert */}
      {successBanner && (
        <div className="bg-emerald-500 text-white font-extrabold text-[12px] sm:text-sm px-5 py-3 rounded-2xl flex items-center gap-3.5 shadow-md shadow-emerald-600/10 animate-pulse relative z-10">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p>{successBanner}</p>
        </div>
      )}

      {/* Search and export actions header panel */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        
        {/* Row 1: Search input and backup-tool actions */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center pr-2 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={lang === 'hi' ? 'बहीखाता प्रविष्टियां खोजें...' : 'Search ledger entries...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm font-medium rounded-xl outline-none focus:border-emerald-500 text-slate-850 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-rose-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 relative">
            {/* Always display import CSV option */}
            <div className="flex items-center gap-1.5 flex-1 md:flex-initial relative">
              <button
                onClick={() => {
                  playClickSound(settings.soundEnabled);
                  setShowImportTray(!showImportTray);
                }}
                className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  showImportTray
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-550/15'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Upload className="w-4 h-4" />
                {lang === 'hi' ? 'CSV आयात करें' : 'Import CSV'}
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickSound(settings.soundEnabled);
                  setShowHelpPopover(!showHelpPopover);
                }}
                className={`p-2.5 border rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  showHelpPopover
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                }`}
                title={lang === 'hi' ? 'अपेक्षित कॉलम्स सहायता' : 'Expected CSV Columns Help'}
              >
                <HelpCircle className="w-4.5 h-4.5" />
              </button>

              {/* Custom absolute popover explaining the headers */}
              {showHelpPopover && (
                <div className="absolute right-0 top-full mt-2 w-[310px] sm:w-[350px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4.5 rounded-2xl shadow-xl z-50 text-slate-705 dark:text-slate-200 text-xs text-left animate-none">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">
                    <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wide">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      {lang === 'hi' ? 'सहमत कॉलम हेडर' : 'Expected CSV Headers'}
                    </h5>
                    <button
                      onClick={() => setShowHelpPopover(false)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3.5 leading-relaxed">
                    {lang === 'hi'
                      ? 'सफलतापूर्वक आयात करने के लिए आपकी CSV पहली पंक्ति में नीचे दिए गए नामों का उपयोग कर सकती है:'
                      : 'To import successfully, ensure your CSV row #1 maps to these standard columns:'}
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                          Description / Label *
                        </span>
                        <span className="text-[9px] bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-450 px-1.5 py-0.25 rounded font-black uppercase">
                          {lang === 'hi' ? 'आवश्यक' : 'Required'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {lang === 'hi'
                          ? 'समर्थित नाम: calculation description, description, label, text, details'
                          : 'Maps to calculation description, description, label, text, details.'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[11px] font-black text-slate-700 dark:text-slate-300">
                          Category / Type
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 px-1.5 py-0.25 rounded font-semibold uppercase">
                          {lang === 'hi' ? 'वैकल्पिक' : 'Optional'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {lang === 'hi'
                          ? 'समर्थित: category, type, module. (डिफ़ॉल्ट: स्वतः जाँचा गया)'
                          : 'Maps to category, type, module (e.g. tarazu, calculator, business, converter).'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[11px] font-black text-slate-700 dark:text-slate-300">
                          Date / Timestamp
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 px-1.5 py-0.25 rounded font-semibold uppercase">
                          {lang === 'hi' ? 'वैकल्पिक' : 'Optional'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {lang === 'hi'
                          ? 'समर्थित: date, timestamp, time. (डिफ़ॉल्ट: वर्तमान समय)'
                          : 'Maps to date, timestamp, time (e.g. 2026-05-27 or Unix Timestamp).'}
                      </p>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[11px] font-black text-slate-700 dark:text-slate-300">
                          ID / Key
                        </span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 px-1.5 py-0.25 rounded font-semibold uppercase">
                          {lang === 'hi' ? 'वैकल्पिक' : 'Optional'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        {lang === 'hi'
                          ? 'समर्थित: id, uuid, key. (डिफ़ॉल्ट: ऑटो जेनरेटेड)'
                          : 'Maps to id, uuid, key (provides unique row identifier).'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 bg-slate-50 dark:bg-slate-900 p-2 rounded-xl text-[9px] font-mono leading-relaxed text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-750 border-dashed">
                    <div className="font-semibold text-[10px] mb-1 text-slate-500">
                      {lang === 'hi' ? 'उदाहरण स्वरूप (उदा. Excel या CSV):' : 'Example CSV Content:'}
                    </div>
                    <div className="overflow-x-auto whitespace-nowrap">
                      ID,Timestamp,Category,Calculation Description<br />
                      "1","1779951830000","tarazu","Tomato: 5 kg x ₹30 = ₹150"<br />
                      "2","1779951850000","calculator","100 + 400 = 500"
                    </div>
                  </div>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <>
                <button
                  onClick={handleExportCSV}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap"
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
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('clearAll')}
                </button>
              </>
            )}
          </div>

        </div>

        {/* Row 2: Date Pickers and Quick Presets */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          
          <div className="flex-1 grid grid-cols-2 gap-2">
            
            {/* Start Date */}
            <div className="relative">
              <span className="absolute inset-y-0 left-2.5 flex items-center pr-1 text-slate-400 pointer-events-none">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold rounded-lg outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-350 cursor-pointer"
                title={lang === 'hi' ? 'प्रारंभ तिथि' : 'Start Date'}
              />
            </div>

            {/* End Date */}
            <div className="relative">
              <span className="absolute inset-y-0 left-2.5 flex items-center pr-1 text-slate-400 pointer-events-none">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold rounded-lg outline-none focus:border-emerald-500 text-slate-700 dark:text-slate-350 cursor-pointer"
                title={lang === 'hi' ? 'अंतिम तिथि' : 'End Date'}
              />
            </div>

          </div>

          {/* Presets and clear helpers */}
          <div className="flex flex-wrap gap-1.5 items-center justify-start sm:justify-end">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 hidden md:inline">
              {lang === 'hi' ? 'त्वरित फ़िल्टर:' : 'Quick Filters:'}
            </span>
            
            {[
              { id: 'today', label: lang === 'hi' ? 'आज' : 'Today' },
              { id: '7days', label: lang === 'hi' ? '७ दिन' : '7 Days' },
              { id: '30days', label: lang === 'hi' ? '३० दिन' : '30 Days' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleQuickPreset(preset.id as any)}
                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800/80 text-[10px] font-bold text-slate-600 dark:text-slate-450 rounded-lg cursor-pointer transition-colors hover:text-emerald-500"
              >
                {preset.label}
              </button>
            ))}

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => handleQuickPreset('clear')}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-955 text-rose-600 dark:text-rose-450 border border-rose-200/30 text-[10px] font-black rounded-lg cursor-pointer transition-colors"
              >
                {lang === 'hi' ? 'साफ़ करें' : 'Clear Dates'}
              </button>
            )}
          </div>

        </div>

      </div>

      {/* COLLAPSIBLE UPLOAD TRAY & DRAGZONE */}
      {showImportTray && (
        <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700/80 p-5 rounded-2xl shadow-sm transition-all relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
              {lang === 'hi' ? 'CSV बहीखाता आयात उपकरण' : 'CSV Transaction History Importer'}
            </h4>
            <button
              onClick={() => {
                playClickSound(settings.soundEnabled);
                setShowImportTray(false);
                setParsedItems(null);
                setErrorMessage(null);
              }}
              className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!parsedItems ? (
            /* Upload file dropzone area */
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/20 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-full mb-3 text-emerald-600 dark:text-emerald-400">
                <Upload className="w-6 h-6 animate-none" />
              </div>
              <p className="font-extrabold text-xs text-slate-700 dark:text-slate-300">
                {lang === 'hi' 
                  ? 'क्लिक करें या .CSV फाइल को यहाँ खींचें' 
                  : 'Click to browse OR drop your .csv backup file here'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 max-w-sm">
                {lang === 'hi' 
                  ? 'समर्थित कॉलम: ID, Timestamp, Category, Calculation Description' 
                  : 'Supports app backups & custom spreadsheets containing Name/Description and Category!'}
              </p>
              {errorMessage && (
                <div className="mt-3.5 flex items-center gap-1.5 p-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            /* Parser preview area */
            <div className="space-y-4">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 p-4.5 rounded-xl space-y-1">
                <h5 className="text-[11px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">
                  {lang === 'hi' ? 'सटीक पार्सिंग विवरण' : 'CSV parsing details'}
                </h5>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-extrabold font-sans">
                  {lang === 'hi'
                    ? `तैयार है! बहीखाता फ़ाइल में ${parsedItems.length} रिकॉर्ड मिले।`
                    : `Success! Hand-parsed ${parsedItems.length} transactions from the CSV.`}
                </p>
              </div>

              {/* Multi item preview list */}
              <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-slate-705 p-2.5 rounded-xl bg-slate-50/30 dark:bg-slate-900/30 scrollbar-thin">
                {parsedItems.slice(0, 8).map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between py-1.5 px-3 border border-slate-100/50 dark:border-slate-800/40 bg-white dark:bg-slate-900/60 rounded-xl text-xs font-mono"
                  >
                    <div className="truncate pr-4 flex items-center gap-2">
                      <span className="text-[9px] font-mono bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 px-1 py-0.5 rounded select-none uppercase">
                        {item.type}
                      </span>
                      <span className="truncate font-semibold text-slate-700 dark:text-slate-350">{item.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {parsedItems.length > 8 && (
                  <div className="text-center text-[10px] text-slate-400 font-bold py-1">
                    {lang === 'hi' ? `...और ${parsedItems.length - 8} अन्य रिकॉर्ड्स` : `...and ${parsedItems.length - 8} more records`}
                  </div>
                )}
              </div>

              {/* Double action layout choice */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 select-none">
                <button
                  type="button"
                  onClick={() => handleConfirmImport(true)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer active:scale-95 shadow-md shadow-emerald-900/10"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'सचेत करें व बहीखाता में जोड़ें (Merge)' : 'Merge & Combine Rows'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmImport(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all outline-none border border-slate-200 dark:border-slate-600 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'hi' ? 'पूर्व मिटायें व नया रीसेट करें (Replace)' : 'Overwrite (Reset Current)'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categorized Filter Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl overflow-x-auto gap-1 border">
        {[
          { id: 'all', label: t('filterAll') },
          { id: 'tarazu', label: t('filterWeighs') },
          { id: 'converter', label: t('filterConversions') },
          { id: 'calculator', label: t('filterCalc') },
          { id: 'business', label: t('filterBiz') },
          { id: 'draft_invoice', label: lang === 'hi' ? 'इन्वॉइस ड्राफ्ट' : 'Invoice Drafts' },
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

      {/* Multiselection contextual action ribbon */}
      {filteredHistory.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSelectAllFiltered(filteredHistory)}
              className="flex items-center gap-2 font-bold text-slate-750 dark:text-slate-350 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer transition-colors"
            >
              {filteredHistory.every(item => selectedItemIds.includes(item.id)) ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Square className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0" />
              )}
              <span>{lang === 'hi' ? 'सभी फ़िल्टर चुनें' : 'Select All Filtered'}</span>
            </button>

            {selectedItemIds.length > 0 && (
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1 rounded-xl">
                {lang === 'hi' 
                  ? `${selectedItemIds.length} चयनित` 
                  : `${selectedItemIds.length} Selected`}
              </span>
            )}
          </div>

          {selectedItemIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenSelectedInvoice(selectedItems)}
                className="flex-grow sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-95 text-xs-heading"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'hi' ? 'चयनित बिल प्रिंट करें' : 'Print Invoice'}</span>
              </button>

              <button
                onClick={() => {
                  playClickSound(settings.soundEnabled);
                  setSelectedItemIds([]);
                }}
                className="p-2 bg-white hover:bg-slate-50 dark:bg-slate-805 dark:hover:bg-slate-750 text-slate-505 dark:text-slate-405 rounded-xl border border-slate-205 dark:border-slate-705 transition-all cursor-pointer"
                title={lang === 'hi' ? 'चयन रद्द करें' : 'Clear Selection'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ledger Body items */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm mr-0">
        
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
              const isSelected = selectedItemIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between py-4 first:pt-0 last:pb-0 gap-4 transition-all rounded-2xl px-2 -mx-2 ${
                    isSelected ? 'bg-emerald-500/5 dark:bg-emerald-500/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/10'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Checkbox button box */}
                    <button
                      onClick={() => handleCheckboxToggle(item.id)}
                      className="mt-2.5 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 dark:text-slate-750 shrink-0" />
                      )}
                    </button>

                    <span className="text-xl bg-slate-50 dark:bg-slate-900 border p-2.5 rounded-xl block shadow-sm shrink-0">
                      {item.type === 'draft_invoice' ? '📝' : item.type === 'tarazu' ? '⚖️' : item.type === 'converter' ? '🔄' : item.type === 'calculator' ? '🧮' : '📊'}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase ${
                          item.type === 'draft_invoice'
                            ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30'
                            : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}>
                          {item.type === 'draft_invoice' ? (lang === 'hi' ? 'इन्वॉइस ड्राफ्ट' : 'invoice draft') : item.type}
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

                  <div className="flex items-center gap-1 shrink-0 select-none">
                    {item.type === 'draft_invoice' && onLoadInvoiceDraft && (
                      <button
                        onClick={() => {
                          playClickSound(settings.soundEnabled);
                          onLoadInvoiceDraft(item);
                        }}
                        className="p-2 text-slate-450 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 rounded-xl transition-all cursor-pointer"
                        title={lang === 'hi' ? 'संपादित करें और पुन: लोड करें' : 'Edit & Resume Draft'}
                      >
                        <Pencil className="w-4 h-4 text-amber-500" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        // Open invoice just for this specific item
                        setSelectedItemIds([item.id]);
                        handleOpenSelectedInvoice([item]);
                      }}
                      className="p-2 text-slate-450 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 rounded-xl transition-all cursor-pointer"
                      title={lang === 'hi' ? 'रसीद प्रिंट' : 'Print Receipt'}
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        onDeleteItem(item.id);
                        // Also remove from selection if deleted
                        setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all shrink-0 cursor-pointer"
                      title={t('delete')}
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

      {/* PRINT INVOICE PREVIEW MODAL */}
      {showInvoicePreview && selectedItems.length > 0 && (
        <div className="fixed inset-0 bg-slate-905/75 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 relative border border-slate-100">
            
            {/* Modal Heading - Hidden during physical window.print() */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div className="flex items-center gap-2 text-slate-800">
                <Printer className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm uppercase tracking-wide">
                  {lang === 'hi' ? 'बिल प्रिंट पूर्वदर्शन' : 'Invoice Print Preview'}
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}
                  className={`px-3 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer ${
                    showTaxBreakdown
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {showTaxBreakdown
                    ? (lang === 'hi' ? 'GST विवरण छिपाएं' : 'Hide GST Split')
                    : (lang === 'hi' ? '18% GST विवरण जोड़ें' : 'Apply 18% GST Split')}
                </button>
                <button
                  onClick={() => setShowInvoicePreview(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* PRINT-ONLY AREA WITH ID */}
            <div id="invoice-print-area" className="bg-white text-black p-4 space-y-6 font-sans">
              
              {/* Invoice Header details */}
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 border-b-2 border-black pb-5 w-full text-left">
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
                      <p className="text-xs font-bold text-black flex items-center justify-center sm:justify-start gap-1">
                        <span>🧾 {lang === 'hi' ? 'जीएसटीआईएन (GSTIN):' : 'GSTIN:'}</span> {settings.shopGst}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-center sm:text-right space-y-1 self-stretch sm:self-start">
                  <div className="text-xs font-bold text-black">
                    <span className="uppercase">{lang === 'hi' ? 'बिल संख्या:' : 'Bill No:'}</span>
                    <span className="font-mono ml-1">{invoiceNo}</span>
                  </div>
                  <div className="text-xs text-black">
                    <span className="font-bold">{lang === 'hi' ? 'तिथि:' : 'Date:'}</span>
                    <span className="ml-1 font-mono">{new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}</span>
                  </div>
                  <div className="text-xs text-black font-semibold">
                    <span>{lang === 'hi' ? 'समय:' : 'Time:'}</span>
                    <span className="ml-1 font-mono">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              {/* Editable Billing Inputs - Hides values borders during window.print() */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border print:border-none print:p-0 print:bg-transparent">
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
                      <th className="py-2.5 px-3 text-right w-28 font-black">{lang === 'hi' ? 'राशि' : 'Amount'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const isSingleDraft = selectedItems.length === 1 && selectedItems[0].type === 'draft_invoice';
                      if (isSingleDraft) {
                        const draft = selectedItems[0] as any;
                        const basket = draft.basket || [];
                        return (
                          <>
                            {basket.map((item, idx) => {
                              const displayAmt = `${settings.preferredCurrency} ${item.amount.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              return (
                                <tr key={item.id || idx} className="border-b border-black/10 last:border-b-0">
                                  <td className="py-3 px-3 text-center font-mono font-bold">{idx + 1}</td>
                                  <td className="py-3 px-3 font-sans text-left">
                                    <div className="font-extrabold uppercase text-[11px] text-black">
                                      {item.name}
                                    </div>
                                    {item.note && <div className="text-[10px] text-slate-700 leading-relaxed font-semibold">{item.note}</div>}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono font-extrabold text-black">
                                    {displayAmt}
                                  </td>
                                </tr>
                              );
                            })}
                            {/* Render Discount / Tax inline if they were saved in the draft */}
                            {draft.discountValue > 0 && (
                              <tr className="border-b border-black/15 bg-rose-50/20">
                                <td className="py-2.5 px-3"></td>
                                <td className="py-2.5 px-3 text-rose-700 font-bold uppercase text-[10px] font-sans">
                                  {lang === 'hi' ? 'छूट / डिस्काउंट' : 'Discount'}{' '}
                                  ({draft.discountType === 'percent' ? `${draft.discountValue}%` : `${settings.preferredCurrency}${draft.discountValue}`})
                                </td>
                                <td className="py-2.5 px-3 text-right text-rose-700 font-mono font-extrabold">
                                  -{settings.preferredCurrency}{(() => {
                                    const subtotal = basket.reduce((t, i) => t + i.amount, 0);
                                    const amtOfDisc = draft.discountType === 'percent' ? subtotal * (draft.discountValue / 100) : draft.discountValue;
                                    return amtOfDisc.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                  })()}
                                </td>
                              </tr>
                            )}
                            {draft.isTaxEnabled && (
                              <tr className="border-b border-black/15 bg-amber-50/20">
                                <td className="py-2.5 px-3"></td>
                                <td className="py-2.5 px-3 text-amber-700 font-bold uppercase text-[10px] font-sans">
                                  {draft.taxName || 'GST'} ({draft.gstPercentage || 18}%)
                                </td>
                                <td className="py-2.5 px-3 text-right text-amber-700 font-mono font-extrabold">
                                  +{settings.preferredCurrency}{(() => {
                                    const subtotal = basket.reduce((t, i) => t + i.amount, 0);
                                    const disc = draft.discountType === 'percent' ? subtotal * (draft.discountValue / 100) : draft.discountValue;
                                    const subAfterDisc = Math.max(0, subtotal - disc);
                                    const taxAmt = (subAfterDisc * (draft.gstPercentage || 18)) / 100;
                                    return taxAmt.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                  })()}
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      }

                      // Otherwise, render normal list of general history items
                      return selectedItems.map((item, idx) => {
                        const amount = parseAmountFromHistoryItem(item, settings.preferredCurrency);
                        const displayAmt = amount > 0 
                          ? `${settings.preferredCurrency} ${amount.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                          : '—';

                        return (
                          <tr key={item.id} className="border-b border-black/10 last:border-b-0">
                            <td className="py-3 px-3 text-center font-mono font-bold">{idx + 1}</td>
                            <td className="py-3 px-3 font-sans text-left">
                              <div className="font-extrabold uppercase text-[11px] text-black">
                                {item.type === 'draft_invoice' ? (lang === 'hi' ? 'इन्वॉइस ड्राफ्ट' : 'Invoice Draft') : item.type === 'tarazu' ? (lang === 'hi' ? 'तराजू मापन' : 'Weighment Scale') : item.type.toUpperCase()}
                              </div>
                              <div className="text-[10px] text-slate-705 leading-relaxed font-semibold">{item.label}</div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-black">
                              {displayAmt}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Totals & Tax Amortization block */}
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-72 space-y-1.5">
                  
                  {showTaxBreakdown ? (() => {
                    const totalAmt = selectedItems.reduce((acc, current) => acc + parseAmountFromHistoryItem(current, settings.preferredCurrency), 0);
                    // GST 18% inclusive reverse calculation
                    const taxableVal = totalAmt / 1.18;
                    const cGst = (totalAmt - taxableVal) / 2;
                    const sGst = cGst;

                    return (
                      <div className="text-xs space-y-1 divide-y divide-black/5 font-semibold text-black">
                        <div className="flex justify-between py-1">
                          <span>{lang === 'hi' ? 'कर योग्य मूल्य (Taxable Amt):' : 'Taxable Amt:'}</span>
                          <span className="font-mono">{settings.preferredCurrency} {taxableVal.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>{lang === 'hi' ? 'CGST (9.0%):' : 'CGST (9.0%):'}</span>
                          <span className="font-mono">{settings.preferredCurrency} {cGst.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>{lang === 'hi' ? 'SGST (9.0%):' : 'SGST (9.0%):'}</span>
                          <span className="font-mono">{settings.preferredCurrency} {sGst.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-black text-sm font-black">
                          <span>{lang === 'hi' ? 'कुल राशि (GRAND TOTAL):' : 'GRAND TOTAL:'}</span>
                          <span className="font-mono">{settings.preferredCurrency} {totalAmt.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    );
                  })() : (() => {
                    const totalAmt = selectedItems.reduce((acc, current) => acc + parseAmountFromHistoryItem(current, settings.preferredCurrency), 0);

                    return (
                      <div className="text-xs space-y-1 font-semibold text-black">
                        <div className="flex justify-between py-2 border-t-2 border-black text-sm font-black">
                          <span>{lang === 'hi' ? 'कुल राशि (GRAND TOTAL):' : 'GRAND TOTAL:'}</span>
                          <span className="font-mono">{settings.preferredCurrency} {totalAmt.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    );
                  })()}

                </div>
              </div>

              {/* Legal and thank you block */}
              <div className="pt-8 flex flex-col sm:flex-row justify-between items-center text-center sm:text-left gap-6 border-t border-black/10 select-none">
                <div className="space-y-1 text-left">
                  <p className="text-[10px] font-black uppercase text-black">
                    {lang === 'hi' ? 'धन्यवाद! कृपया पुनः पधारें।' : 'Thank you! Visit again.'}
                  </p>
                  <p className="text-[9px] text-slate-500 font-bold">
                    {lang === 'hi' ? 'यह बिल तराजू (PWA) एप्प द्वारा जारी है।' : 'Generated electronically via Tarazu App.'}
                  </p>
                </div>
                
                <div className="w-44 text-center border-t border-black pt-2 self-stretch sm:self-auto">
                  <p className="text-[9px] font-black uppercase text-black">
                    {lang === 'hi' ? 'अधिकृत हस्ताक्षरी' : 'Authorized Signatory'}
                  </p>
                </div>
              </div>

            </div>

            {/* Print Confirmation Footer - Hidden during window.print() */}
            <div className="space-y-4 print:hidden select-none border-t pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => setShowInvoicePreview(false)}
                   className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-850 font-bold text-xs rounded-xl transition-all outline-none border border-slate-200 cursor-pointer active:scale-95 text-center uppercase tracking-wider cursor-pointer"
                >
                  {lang === 'hi' ? 'बंद करें' : 'Close Preview'}
                </button>

                <button
                  type="button"
                  onClick={handleShareHistoryInvoice}
                  className="py-3 bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all outline-none cursor-pointer active:scale-95 text-center uppercase tracking-wider cursor-pointer"
                >
                  <span>{invoiceCopied ? (lang === 'hi' ? 'कॉपी हो गया! ✓' : 'Copied! ✓') : (lang === 'hi' ? 'रसीद कॉपी करें' : 'Copy Text Receipt')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSuccessSound(settings.soundEnabled);
                    const isSingleDraft = selectedItems.length === 1 && selectedItems[0].type === 'draft_invoice';
                    if (isSingleDraft) {
                      const draft = selectedItems[0] as any;
                      const basket = draft.basket || [];
                      const subtotalVal = basket.reduce((t: any, i: any) => t + i.amount, 0);
                      const discAmt = draft.discountValue > 0 ? (draft.discountType === 'percent' ? subtotalVal * (draft.discountValue / 100) : draft.discountValue) : 0;
                      const subAfterDisc = Math.max(0, subtotalVal - discAmt);
                      const taxAmt = draft.isTaxEnabled ? (subAfterDisc * (draft.gstPercentage || 18)) / 100 : 0;
                      const grandTotalVal = draft.isTaxEnabled ? (subAfterDisc + taxAmt) : subAfterDisc;

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
                          month: 'short',
                          day: 'numeric'
                        }),
                        timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        items: basket.map((item: any) => ({
                          name: item.name,
                          note: item.note,
                          amount: item.amount,
                        })),
                        subtotal: subtotalVal,
                        discountLabel: lang === 'hi' ? `छूट (${draft.discountType === 'percent' ? `${draft.discountValue}%` : 'नियत'})` : `Discount (${draft.discountType === 'percent' ? `${draft.discountValue}%` : 'Flat'})`,
                        discountAmount: discAmt,
                        taxLabel: `${draft.taxName || 'GST'} (${draft.gstPercentage || 18}%)`,
                        taxAmount: taxAmt,
                        grandTotal: grandTotalVal,
                        preferredCurrency: settings.preferredCurrency,
                        lang: lang,
                      });
                    } else {
                      const itemsList = selectedItems.map((item: any) => {
                        const amount = parseAmountFromHistoryItem(item, settings.preferredCurrency);
                        const typeName = item.type === 'draft_invoice' ? (lang === 'hi' ? 'इन्वॉइस ड्राफ्ट' : 'Invoice Draft') : item.type === 'tarazu' ? (lang === 'hi' ? 'तराजू मापन' : 'Weighment Scale') : item.type.toUpperCase();
                        return {
                          name: typeName,
                          note: item.label,
                          amount: amount,
                        };
                      });
                      const totalAmt = selectedItems.reduce((acc, current) => acc + parseAmountFromHistoryItem(current, settings.preferredCurrency), 0);

                      if (showTaxBreakdown) {
                        const taxableVal = totalAmt / 1.18;
                        const taxVal = totalAmt - taxableVal;
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
                            month: 'short',
                            day: 'numeric'
                          }),
                          timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          items: itemsList,
                          subtotal: taxableVal,
                          taxLabel: lang === 'hi' ? 'जीएसटी (18% inclusive)' : 'GST (18% inclusive)',
                          taxAmount: taxVal,
                          grandTotal: totalAmt,
                          preferredCurrency: settings.preferredCurrency,
                          lang: lang,
                        });
                      } else {
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
                            month: 'short',
                            day: 'numeric'
                          }),
                          timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                          items: itemsList,
                          subtotal: totalAmt,
                          grandTotal: totalAmt,
                          preferredCurrency: settings.preferredCurrency,
                          lang: lang,
                        });
                      }
                    }
                  }}
                  className="py-3 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all outline-none cursor-pointer active:scale-95 shadow-lg shadow-purple-600/10 text-center uppercase tracking-wider cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'पीडीएफ डाउनलोड' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClickSound(settings.soundEnabled);
                    const success = triggerPrint();
                    if (!success) {
                      handleShareHistoryInvoice();
                    }
                  }}
                  className="py-3 bg-black hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition-all outline-none cursor-pointer active:scale-95 shadow-lg shadow-black/10 text-center uppercase tracking-wider cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'प्रिंट करें' : 'Print Now'}</span>
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
  );
}
