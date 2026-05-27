import React, { useState, useRef } from 'react';
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
  HelpCircle
} from 'lucide-react';
import { Language, HistoryItem, AppSettings } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';

interface HistoryModuleProps {
  lang: Language;
  settings: AppSettings;
  history: HistoryItem[];
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onImportHistory?: (items: HistoryItem[], isMerge: boolean) => void;
}

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

export default function HistoryModule({
  lang,
  settings,
  history,
  onDeleteItem,
  onClearAll,
  onImportHistory,
}: HistoryModuleProps) {
  const t = translate(lang);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'tarazu' | 'converter' | 'calculator' | 'business'>('all');

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

        <div className="flex flex-wrap gap-2 w-full sm:w-auto relative">
          {/* Always display import CSV option */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial relative">
            <button
              onClick={() => {
                playClickSound(settings.soundEnabled);
                setShowImportTray(!showImportTray);
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 border rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
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
              <div className="absolute right-0 top-full mt-2 w-[310px] sm:w-[350px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4.5 rounded-2xl shadow-xl z-50 text-slate-700 dark:text-slate-200 text-xs text-left animate-none">
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
