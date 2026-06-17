import React, { useState } from 'react';
import { DollarSign, Percent, TrendingUp, Calculator, Calendar, Landmark, CheckCircle, FileCheck, Layers, Trash2, Plus, Minus, ArrowRight, Sparkles, Scale, Import, QrCode, Copy, Download, Check, ExternalLink, Share2, LineChart as ChartIcon, BarChart as BarIcon, Tag, AlertCircle } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';
import { getStoredPresets } from '../utils/storage';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';

interface BusinessToolsProps {
  lang: Language;
  settings: AppSettings;
  history?: HistoryItem[];
  onAddHistoryItem: (item: HistoryItemInput) => void;
}

export default function BusinessTools({
  lang,
  settings,
  history = [],
  onAddHistoryItem,
}: BusinessToolsProps) {
  const t = translate(lang);

  const getDraftInvoiceTotal = (draft: any) => {
    if (!draft || !draft.basket) return 0;
    const subtotal = draft.basket.reduce((sum: number, x: any) => sum + (x.amount || 0), 0);
    let currentTotal = subtotal;
    if (draft.discountValue > 0) {
      if (draft.discountType === 'percent') {
        currentTotal -= subtotal * (draft.discountValue / 100);
      } else {
        currentTotal -= draft.discountValue;
      }
    }
    if (draft.isTaxEnabled && draft.gstPercentage > 0) {
      currentTotal += currentTotal * (draft.gstPercentage / 100);
    }
    return Math.max(0, currentTotal);
  };

  // Tabs: 'profit_loss' | 'gst_splitter' | 'loan_emi' | 'bulk_batch' | 'payment_qr' | 'price_trends'
  const [activeTab, setActiveTab] = useState<'profit_loss' | 'gst_splitter' | 'loan_emi' | 'bulk_batch' | 'payment_qr' | 'price_trends'>('profit_loss');

  // Price Trend Analysis States
  const [trendPresets, setTrendPresets] = useState(() => {
    try {
      return getStoredPresets();
    } catch {
      return [
        { id: '1', name: 'Aloo (Potato)', nameHi: 'आलू', rate: 25, category: 'Vegetables' },
        { id: '2', name: 'Pyaz (Onion)', nameHi: 'प्याज', rate: 40, category: 'Vegetables' },
        { id: '3', name: 'Tamatar (Tomato)', nameHi: 'टमाटर', rate: 50, category: 'Vegetables' },
        { id: '4', name: 'Chawal (Rice)', nameHi: 'चावल', rate: 60, category: 'Grains' },
        { id: '5', name: 'Aata (Flour)', nameHi: 'आटा', rate: 45, category: 'Grains' },
      ];
    }
  });
  const [selectedPresetTrendId, setSelectedPresetTrendId] = useState('1');
  const [trendHistoryRange, setTrendHistoryRange] = useState(10);
  const [trendComparisonMode, setTrendComparisonMode] = useState<'timeline' | 'presets'>('timeline');
  const [simulatedRates, setSimulatedRates] = useState<Record<string, number>>({});

  // Payment QR Code States
  const [upiId, setUpiId] = useState(() => {
    try {
      return localStorage.getItem('tarazu_merchant_upi') || 'merchant@upi';
    } catch {
      return 'merchant@upi';
    }
  });
  const [recipientName, setRecipientName] = useState(() => {
    try {
      return localStorage.getItem('tarazu_merchant_name') || settings.shopName || 'Fast Tarazu Store';
    } catch {
      return settings.shopName || 'Fast Tarazu Store';
    }
  });
  const [qrAmount, setQrAmount] = useState('150.00');
  const [qrNote, setQrNote] = useState('Tarazu Invoice Payment');
  const [paymentCopied, setPaymentCopied] = useState(false);
  const [isLaserActive, setIsLaserActive] = useState(true);
  const [paymentSuccessSimulated, setPaymentSuccessSimulated] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Bulk Batch Calculator States
  const [batchList, setBatchList] = useState<{
    id: string;
    name: string;
    originalRate: number;
    originalWeight: number;
    originalTotal: number;
  }[]>([]);

  // Manual Item Inputs
  const [newItemName, setNewItemName] = useState('');
  const [newItemRate, setNewItemRate] = useState('40');
  const [newItemWeight, setNewItemWeight] = useState('2.5');

  // Modifier Parameters
  const [rateModType, setRateModType] = useState<'none' | 'percent_add' | 'percent_sub' | 'factor' | 'flat_add' | 'flat_sub'>('none');
  const [rateModValue, setRateModValue] = useState('10');
  const [weightModType, setWeightModType] = useState<'none' | 'percent_add' | 'percent_sub' | 'factor' | 'flat_add' | 'flat_sub'>('none');
  const [weightModValue, setWeightModValue] = useState('5');

  // Profit/Loss States
  const [buyingPrice, setBuyingPrice] = useState('800');
  const [sellingPrice, setSellingPrice] = useState('1100');

  // GST Splitter States
  const [gstAmount, setGstAmount] = useState('5000');
  const [gstRate, setGstRate] = useState<number>(18);
  const [gstDirection, setGstDirection] = useState<'add' | 'remove'>('add');

  // EMI States
  const [loanPrincipal, setLoanPrincipal] = useState('100000');
  const [loanRate, setLoanRate] = useState('10.5'); // Annual %
  const [loanDuration, setLoanDuration] = useState('12'); // In months
  const [durationType, setDurationType] = useState<'months' | 'years'>('months');

  // Profit calculation logic
  const profitAudit = (() => {
    const cp = parseFloat(buyingPrice) || 0;
    const sp = parseFloat(sellingPrice) || 0;
    if (cp <= 0 || sp <= 0) return { amount: 0, percent: 0, isProfit: true };

    const amount = sp - cp;
    const percent = (amount / cp) * 100;
    return {
      amount,
      percent,
      isProfit: amount >= 0,
    };
  })();

  // GST evaluation
  const gstAudit = (() => {
    const totalVal = parseFloat(gstAmount) || 0;
    if (totalVal <= 0) return { base: 0, gst: 0, cgst: 0, sgst: 0, total: 0 };

    let baseAmount = 0;
    let gstValue = 0;

    if (gstDirection === 'add') {
      gstValue = totalVal * (gstRate / 100);
      baseAmount = totalVal;
    } else {
      baseAmount = totalVal / (1 + gstRate / 100);
      gstValue = totalVal - baseAmount;
    }

    return {
      base: baseAmount,
      gst: gstValue,
      cgst: gstValue / 2,
      sgst: gstValue / 2,
      total: gstDirection === 'add' ? totalVal + gstValue : totalVal,
    };
  })();

  // EMI audit
  const emiAudit = (() => {
    const P = parseFloat(loanPrincipal) || 0;
    const annualR = parseFloat(loanRate) || 0;
    
    // convert duration to months
    const durVal = parseFloat(loanDuration) || 0;
    const N = durationType === 'years' ? durVal * 12 : durVal;

    if (P <= 0 || annualR <= 0 || N <= 0) {
      return { emi: 0, interest: 0, payable: 0 };
    }

    // Monthly interest factor
    const R = (annualR / 12) / 100;

    // Monthly EMI formula
    // EMI = [P * R * (1+R)^N] / [(1+R)^N - 1]
    const comp = Math.pow(1 + R, N);
    const emi = (P * R * comp) / (comp - 1);
    
    const payable = emi * N;
    const interest = payable - P;

    return {
      emi: isNaN(emi) ? 0 : emi,
      interest: isNaN(interest) ? 0 : interest,
      payable: isNaN(payable) ? 0 : payable,
      monthsCount: N,
    };
  })();

  // Batch calculations
  const modifiedBatch = batchList.map(item => {
    let modifiedRate = item.originalRate;
    let modifiedWeight = item.originalWeight;

    // Apply rate modification
    const rVal = parseFloat(rateModValue) || 0;
    if (rateModType === 'percent_add') {
      modifiedRate = item.originalRate * (1 + rVal / 100);
    } else if (rateModType === 'percent_sub') {
      modifiedRate = item.originalRate * (1 - rVal / 100);
    } else if (rateModType === 'factor') {
      modifiedRate = item.originalRate * rVal;
    } else if (rateModType === 'flat_add') {
      modifiedRate = item.originalRate + rVal;
    } else if (rateModType === 'flat_sub') {
      modifiedRate = item.originalRate - rVal;
    }

    // Apply weight modification
    const wVal = parseFloat(weightModValue) || 0;
    if (weightModType === 'percent_add') {
      modifiedWeight = item.originalWeight * (1 + wVal / 100);
    } else if (weightModType === 'percent_sub') {
      modifiedWeight = item.originalWeight * (1 - wVal / 100);
    } else if (weightModType === 'factor') {
      modifiedWeight = item.originalWeight * wVal;
    } else if (weightModType === 'flat_add') {
      modifiedWeight = item.originalWeight + wVal;
    } else if (weightModType === 'flat_sub') {
      modifiedWeight = Math.max(0, item.originalWeight - wVal);
    }

    // Rounding
    modifiedRate = Math.max(0, Number(modifiedRate.toFixed(settings.decimalPrecision)));
    modifiedWeight = Math.max(0, Number(modifiedWeight.toFixed(4)));
    const modifiedTotal = Number((modifiedRate * modifiedWeight).toFixed(settings.decimalPrecision));

    return {
      ...item,
      modifiedRate,
      modifiedWeight,
      modifiedTotal,
    };
  });

  const batchOriginalPriceTotal = batchList.reduce((acc, curr) => acc + curr.originalTotal, 0);
  const batchOriginalWeightTotal = batchList.reduce((acc, curr) => acc + curr.originalWeight, 0);
  const batchModifiedPriceTotal = modifiedBatch.reduce((acc, curr) => acc + curr.modifiedTotal, 0);
  const batchModifiedWeightTotal = modifiedBatch.reduce((acc, curr) => acc + curr.modifiedWeight, 0);

  const handleSaveToLedger = () => {
    playSuccessSound(settings.soundEnabled);

    if (activeTab === 'profit_loss') {
      const isProfit = profitAudit.isProfit;
      const amount = Math.abs(profitAudit.amount).toFixed(settings.decimalPrecision);
      const percent = Math.abs(profitAudit.percent).toFixed(2);
      onAddHistoryItem({
        type: 'business',
        tool: 'profit',
        inputs: { buyingPrice, sellingPrice },
        outputs: { profitAmount: profitAudit.amount, profitPercent: profitAudit.percent },
        label: `${isProfit ? 'Profit' : 'Loss'}: ₹${amount} (${percent}%) on CP: ₹${buyingPrice} / SP: ₹${sellingPrice}`,
      });
    } else if (activeTab === 'gst_splitter') {
      onAddHistoryItem({
        type: 'business',
        tool: 'gst',
        inputs: { gstAmount, gstRate, gstDirection },
        outputs: { baseAmount: gstAudit.base, cgst: gstAudit.cgst, sgst: gstAudit.sgst, totalBill: gstAudit.total },
        label: `${gstDirection === 'add' ? '+' : '-'}${gstRate}% GST Splitter on ₹${gstAmount} → CGST: ₹${gstAudit.cgst.toFixed(2)}, SGST: ₹${gstAudit.sgst.toFixed(2)}`,
      });
    } else if (activeTab === 'loan_emi') {
      const emiVal = emiAudit.emi.toFixed(settings.decimalPrecision);
      onAddHistoryItem({
        type: 'business',
        tool: 'emi',
        inputs: { loanPrincipal, loanRate, loanDuration },
        outputs: { monthlyEmi: emiAudit.emi, totalInterest: emiAudit.interest, totalPayable: emiAudit.payable },
        label: `Capital Loan: ₹${loanPrincipal} (${loanRate}% p.a.) → Monthly EMI: ₹${emiVal} x ${emiAudit.monthsCount} months`,
      });
    } else if (activeTab === 'bulk_batch') {
      const originalTotalStr = batchOriginalPriceTotal.toFixed(settings.decimalPrecision);
      const modifiedTotalStr = batchModifiedPriceTotal.toFixed(settings.decimalPrecision);
      const itemsCount = batchList.length;
      
      onAddHistoryItem({
        type: 'business',
        tool: 'profit',
        inputs: {
          itemsCount,
          rateModType,
          rateModValue,
          weightModType,
          weightModValue,
        },
        outputs: {
          originalTotal: batchOriginalPriceTotal,
          modifiedTotal: batchModifiedPriceTotal,
          diff: batchModifiedPriceTotal - batchOriginalPriceTotal,
        },
        label: lang === 'hi'
          ? `थोक बैच संशोधन (${itemsCount} सामान): ₹${originalTotalStr} ➔ ₹${modifiedTotalStr} (अंतर: ${batchModifiedPriceTotal >= batchOriginalPriceTotal ? '+' : ''}₹${(batchModifiedPriceTotal - batchOriginalPriceTotal).toFixed(settings.decimalPrecision)})`
          : `Bulk Batch Modification (${itemsCount} items): ₹${originalTotalStr} ➔ ₹${modifiedTotalStr} (Diff: ${batchModifiedPriceTotal >= batchOriginalPriceTotal ? '+' : ''}₹${(batchModifiedPriceTotal - batchOriginalPriceTotal).toFixed(settings.decimalPrecision)})`,
      });
    } else if (activeTab === 'payment_qr') {
      onAddHistoryItem({
        type: 'business',
        tool: 'profit',
        inputs: { upiId, recipientName, amount: qrAmount, qrNote },
        outputs: { transactionAmount: qrAmount },
        label: lang === 'hi'
          ? `डिजिटल भुगतान रसीद उत्पन्न (रू ${qrAmount}) - ${recipientName}`
          : `Digital Payment QR Logged (${settings.preferredCurrency || '₹'}${qrAmount}) for ${recipientName}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Header Grid tabs for selection */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { id: 'profit_loss', label: t('profitCalc'), icon: <TrendingUp className="w-5 h-5" /> },
          { id: 'gst_splitter', label: t('gstCalc'), icon: <Calculator className="w-5 h-5" /> },
          { id: 'loan_emi', label: t('emiCalc'), icon: <Landmark className="w-5 h-5" /> },
          { id: 'bulk_batch', label: lang === 'hi' ? 'थोक बैच (Bulk)' : 'Bulk Batch', icon: <Layers className="w-5 h-5" /> },
          { id: 'payment_qr', label: lang === 'hi' ? 'भुगतान क्यूआर (Pay QR)' : 'Payment QR', icon: <QrCode className="w-5 h-5" /> },
          { id: 'price_trends', label: lang === 'hi' ? 'मूल्य रुझान (Trends)' : 'Price Trends', icon: <ChartIcon className="w-5 h-5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              playClickSound(settings.soundEnabled);
              setActiveTab(tab.id as any);
            }}
            className={`
              p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2 cursor-pointer
              ${
                activeTab === tab.id
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/10'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 text-slate-750 dark:text-slate-350 hover:bg-emerald-50/20'
              }
            `}
          >
            {tab.icon}
            <span className="text-[10px] sm:text-xs font-bold leading-tight">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Primary content area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Inputs parameters */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b pb-2">
            Calculator Parameters
          </h3>

          {activeTab === 'profit_loss' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{t('buyingPrice')}</label>
                <div className="flex rounded-xl border overflow-hidden shadow-sm">
                  <span className="bg-slate-50 dark:bg-slate-900 border-r text-slate-500 font-bold px-3 py-2">₹</span>
                  <input
                    type="number"
                    value={buyingPrice}
                    onChange={(e) => setBuyingPrice(e.target.value)}
                    className="w-full px-3 py-2 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{t('sellingPrice')}</label>
                <div className="flex rounded-xl border overflow-hidden shadow-sm">
                  <span className="bg-slate-50 dark:bg-slate-900 border-r text-slate-500 font-bold px-3 py-2">₹</span>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 outline-none font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gst_splitter' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Calculation Mode</label>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border">
                  <button
                    onClick={() => { playClickSound(settings.soundEnabled); setGstDirection('add'); }}
                    className={`flex-1 text-xs py-2 rounded-lg font-extrabold ${gstDirection === 'add' ? 'bg-white dark:bg-slate-800 shadow text-emerald-600' : 'text-slate-500'}`}
                  >
                    Add GST (+)
                  </button>
                  <button
                    onClick={() => { playClickSound(settings.soundEnabled); setGstDirection('remove'); }}
                    className={`flex-1 text-xs py-2 rounded-lg font-extrabold ${gstDirection === 'remove' ? 'bg-white dark:bg-slate-800 shadow text-emerald-600' : 'text-slate-500'}`}
                  >
                    Remove GST (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Amount (₹)</label>
                <div className="flex rounded-xl border overflow-hidden shadow-sm">
                  <span className="bg-slate-50 border-r text-slate-500 font-bold px-3 py-2">₹</span>
                  <input
                    type="number"
                    value={gstAmount}
                    onChange={(e) => setGstAmount(e.target.value)}
                    className="w-full px-3 py-2 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{t('gstType')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 12, 18, 28].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => { playClickSound(settings.soundEnabled); setGstRate(rate); }}
                      className={`
                        py-2 text-xs font-extrabold rounded-xl border transition-all cursor-pointer
                        ${
                          gstRate === rate
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 text-slate-600 dark:text-slate-400 hover:border-emerald-200'
                        }
                      `}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'loan_emi' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{t('loanAmount')}</label>
                <div className="flex rounded-xl border overflow-hidden shadow-sm">
                  <span className="bg-slate-50 border-r text-slate-500 font-bold px-3 py-2">{settings.preferredCurrency || '₹'}</span>
                  <input
                    type="number"
                    value={loanPrincipal}
                    onChange={(e) => setLoanPrincipal(e.target.value)}
                    className="w-full px-3 py-2 outline-none font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{t('interestRate')} (%)</label>
                  <input
                    type="number"
                    step="any"
                    value={loanRate}
                    onChange={(e) => setLoanRate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">{t('duration')}</label>
                  <div className="flex border rounded-xl overflow-hidden shadow-sm">
                    <input
                      type="number"
                      value={loanDuration}
                      onChange={(e) => setLoanDuration(e.target.value)}
                      className="w-full p-2 bg-transparent outline-none font-mono font-bold text-sm text-center"
                    />
                    <select
                      value={durationType}
                      onChange={(e) => setDurationType(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-900 text-xs font-bold px-2 border-l"
                    >
                      <option value="months">Mo</option>
                      <option value="years">Yr</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bulk_batch' && (
            <div className="space-y-4">
              {/* Rate Modification Card */}
              <div className="p-3.5 bg-indigo-50/50 dark:bg-slate-900/60 border border-indigo-100/60 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
                  <span className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                    {lang === 'hi' ? 'मूल्य/दर संशोधन' : 'Rate Modifier'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">{lang === 'hi' ? 'संशोधन प्रकार' : 'Modification Type'}</label>
                  <select
                    value={rateModType}
                    onChange={(e) => {
                      playClickSound(settings.soundEnabled);
                      setRateModType(e.target.value as any);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-705 dark:text-slate-350 outline-none"
                  >
                    <option value="none">{lang === 'hi' ? 'कोई परिवर्तन नहीं' : 'None (Keep Original)'}</option>
                    <option value="percent_add">{lang === 'hi' ? 'प्रतिशत (%) जोड़ें (मार्कअप/कर)' : 'Add % (Markup/Tax)'}</option>
                    <option value="percent_sub">{lang === 'hi' ? 'प्रतिशत (%) घटाएं (छूट)' : 'Subtract % (Discount)'}</option>
                    <option value="factor">{lang === 'hi' ? 'कारक से गुणा करें (X)' : 'Multiply by Factor'}</option>
                    <option value="flat_add">{lang === 'hi' ? `फ्लैट दर जोड़ें (+${settings.preferredCurrency || '₹'})` : `Add Flat Rate (+${settings.preferredCurrency || '₹'})`}</option>
                    <option value="flat_sub">{lang === 'hi' ? `फ्लैट दर घटाएं (-${settings.preferredCurrency || '₹'})` : `Subtract Flat Rate (-${settings.preferredCurrency || '₹'})`}</option>
                  </select>
                </div>

                {rateModType !== 'none' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {rateModType.startsWith('percent') ? (lang === 'hi' ? 'प्रतिशत मूल्य (%)' : 'Percentage (%)') : (lang === 'hi' ? 'संशोधन दर/राशि' : 'Modifier Value')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={rateModValue}
                      onChange={(e) => setRateModValue(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-black text-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Weight Modification Card */}
              <div className="p-3.5 bg-emerald-50/50 dark:bg-slate-900/60 border border-emerald-100/60 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
                  <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-500" />
                    {lang === 'hi' ? 'वजन संसोधन' : 'Weight Modifier'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400">{lang === 'hi' ? 'संशोधन प्रकार' : 'Modification Type'}</label>
                  <select
                    value={weightModType}
                    onChange={(e) => {
                      playClickSound(settings.soundEnabled);
                      setWeightModType(e.target.value as any);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-705 dark:text-slate-350 outline-none"
                  >
                    <option value="none">{lang === 'hi' ? 'कोई परिवर्तन नहीं' : 'None (Keep Original)'}</option>
                    <option value="percent_add">{lang === 'hi' ? 'प्रतिशत (%) वजन जोड़ें' : 'Add % (Tare/Packaging)'}</option>
                    <option value="percent_sub">{lang === 'hi' ? 'प्रतिशत (%) वजन घटाएं' : 'Subtract % (Shrinkage)'}</option>
                    <option value="factor">{lang === 'hi' ? 'कारक से वजन गुणा करें' : 'Multiply Weight'}</option>
                    <option value="flat_add">{lang === 'hi' ? 'फ्लैट वजन जोड़ें (+KG)' : 'Add Flat Weight (+KG)'}</option>
                    <option value="flat_sub">{lang === 'hi' ? 'फ्लैट वजन घटाएं (-KG)' : 'Subtract Flat Weight (-KG)'}</option>
                  </select>
                </div>

                {weightModType !== 'none' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {weightModType.startsWith('percent') ? (lang === 'hi' ? 'प्रतिशत दर (%)' : 'Percentage (%)') : (lang === 'hi' ? 'वजन (KG)' : 'Modifier Weight (KG)')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={weightModValue}
                      onChange={(e) => setWeightModValue(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-black text-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Add Custom Item Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-850 rounded-2xl space-y-2.5">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                  {lang === 'hi' ? '+ नया आइटम जोड़ें (मैनुअल)' : '+ Add Manual Item to Batch'}
                </span>
                
                <div className="grid grid-cols-1 gap-2.5">
                  <input
                    type="text"
                    placeholder={lang === 'hi' ? 'वस्तु का नाम (उदा. प्याज़)' : 'Item name (e.g. Garlic)'}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'hi' ? `दर (${settings.preferredCurrency || '₹'}/KG)` : `Rate (${settings.preferredCurrency || '₹'}/KG)`}</span>
                      <input
                        type="number"
                        placeholder="Rate"
                        value={newItemRate}
                        onChange={(e) => setNewItemRate(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">{lang === 'hi' ? 'वजन (KG)' : 'Weight (KG)'}</span>
                      <input
                        type="number"
                        placeholder="Weight"
                        value={newItemWeight}
                        onChange={(e) => setNewItemWeight(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const rate = parseFloat(newItemRate) || 0;
                    const weight = parseFloat(newItemWeight) || 0;
                    const name = newItemName.trim() || (lang === 'hi' ? `आइटम #${batchList.length + 1}` : `Item #${batchList.length + 1}`);
                    
                    playClickSound(settings.soundEnabled);
                    setBatchList(prev => [
                      ...prev,
                      {
                        id: 'manual_' + Date.now() + Math.random().toString(36).substring(2, 5),
                        name,
                        originalRate: rate,
                        originalWeight: weight,
                        originalTotal: Number((rate * weight).toFixed(settings.decimalPrecision)),
                      }
                    ]);
                    setNewItemName('');
                  }}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 dark:bg-slate-700 dark:hover:bg-slate-650 text-white text-[11px] font-black rounded-lg uppercase tracking-wider transition-colors active:scale-95 cursor-pointer"
                >
                  {lang === 'hi' ? 'बैच में जोड़ें' : 'Add to Batch'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'payment_qr' && (
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 dark:text-slate-400">
                  {lang === 'hi' ? 'दुकान / प्राप्तकर्ता का नाम' : 'Store / Recipient Name'}
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRecipientName(val);
                    try {
                      localStorage.setItem('tarazu_merchant_name', val);
                    } catch {}
                  }}
                  className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:border-emerald-500 font-bold outline-none"
                  placeholder="e.g. My Smart Store"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 flex items-center justify-between dark:text-slate-400">
                  <span>{lang === 'hi' ? 'यूपीआई पता (UPI ID / Payee URL)' : 'Merchant UPI ID / Address'}</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase select-none">standard format</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3.5 text-xs text-slate-400 font-mono">⚡</span>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUpiId(val);
                      try {
                        localStorage.setItem('tarazu_merchant_upi', val);
                      } catch {}
                    }}
                    className="w-full text-sm p-3 pl-8 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:border-emerald-500 font-mono font-bold outline-none text-emerald-650 dark:text-emerald-400"
                    placeholder="e.g. shopname@okicici"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 dark:text-slate-400">
                  {lang === 'hi' ? 'राशि का त्वरित स्रोत चुनें' : 'Invoice Amount Source'}
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                  {/* Preset Option: Latest Draft Invoice */}
                  {(() => {
                    const latestDraft = (history || []).find(item => item.type === 'draft_invoice');
                    if (!latestDraft) return null;
                    const draftTotal = getDraftInvoiceTotal(latestDraft);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound(settings.soundEnabled);
                          setQrAmount(draftTotal.toFixed(settings.decimalPrecision));
                        }}
                        className="w-full text-left flex items-center justify-between p-2.5 rounded-xl border border-dashed border-emerald-550/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          📋 {lang === 'hi' ? 'मुख्य बिल राशि' : 'Active Invoice Basket'}
                        </span>
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {settings.preferredCurrency || '₹'}{draftTotal.toFixed(settings.decimalPrecision)}
                        </span>
                      </button>
                    );
                  })()}

                  {/* Preset Option: Profit/Loss Selling Price */}
                  {parseFloat(sellingPrice) > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        setQrAmount(parseFloat(sellingPrice).toFixed(settings.decimalPrecision));
                      }}
                      className="w-full text-left flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hover:border-emerald-550/30 transition-all cursor-pointer"
                    >
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        📈 {lang === 'hi' ? 'लाभ/हानि बिक्री मूल्य' : 'P&L Selling Price'}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                        {settings.preferredCurrency || '₹'}{parseFloat(sellingPrice).toFixed(settings.decimalPrecision)}
                      </span>
                    </button>
                  )}

                  {/* Preset Option: GST Splitter Total */}
                  {gstAudit.total > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        setQrAmount(gstAudit.total.toFixed(settings.decimalPrecision));
                      }}
                      className="w-full text-left flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hover:border-emerald-555/30 transition-all cursor-pointer"
                    >
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        ⚖️ {lang === 'hi' ? 'जीएसटी कुल बिल' : 'GST Total Bill'}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                        {settings.preferredCurrency || '₹'}{gstAudit.total.toFixed(settings.decimalPrecision)}
                      </span>
                    </button>
                  )}

                  {/* Preset Option: Loan EMI Payable */}
                  {emiAudit.emi > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        setQrAmount(emiAudit.emi.toFixed(settings.decimalPrecision));
                      }}
                      className="w-full text-left flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hover:border-emerald-555/30 transition-all cursor-pointer"
                    >
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        🏦 {lang === 'hi' ? 'ऋण मासिक EMI' : 'Loan EMI Payable'}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                        {settings.preferredCurrency || '₹'}{emiAudit.emi.toFixed(settings.decimalPrecision)}
                      </span>
                    </button>
                  )}

                  {/* Preset Option: Bulk Batch Modified Total */}
                  {batchModifiedPriceTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        setQrAmount(batchModifiedPriceTotal.toFixed(settings.decimalPrecision));
                      }}
                      className="w-full text-left flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 hover:border-emerald-555/30 transition-all cursor-pointer"
                    >
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        📦 {lang === 'hi' ? 'थोक बैच कुल राशि' : 'Bulk Batch Total'}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300">
                        {settings.preferredCurrency || '₹'}{batchModifiedPriceTotal.toFixed(settings.decimalPrecision)}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 dark:text-slate-400">
                  {lang === 'hi' ? 'भुगतान राशि (Amount)' : 'Payment Amount'}
                </label>
                <div className="flex rounded-xl border border-slate-250 dark:border-slate-800 overflow-hidden shadow-sm">
                  <span className="bg-slate-100 dark:bg-slate-900 border-r text-slate-500 font-bold px-3.5 py-2 select-none dark:text-slate-450">
                    {settings.preferredCurrency || '₹'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={qrAmount}
                    onChange={(e) => setQrAmount(e.target.value)}
                    className="w-full px-3 py-2 outline-none font-mono font-black text-slate-800 dark:text-white bg-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 dark:text-slate-400">
                  {lang === 'hi' ? 'भुगतान संदर्भ / लेबल (Note)' : 'Payment Note / Memo'}
                </label>
                <input
                  type="text"
                  value={qrNote}
                  onChange={(e) => setQrNote(e.target.value)}
                  className="w-full text-sm p-3 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:border-emerald-500 font-semibold outline-none"
                  placeholder="e.g. Invoice TRZ-8981"
                />
              </div>
            </div>
          )}

          {activeTab === 'price_trends' && (
            <div className="space-y-4 text-left animate-fadeIn">
              <div>
                <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 dark:text-slate-400">
                  {lang === 'hi' ? 'विश्लेषण प्रकार चुनें' : 'Analysis Display Mode'}
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => { playClickSound(settings.soundEnabled); setTrendComparisonMode('timeline'); }}
                    className={`flex-1 text-[10px] py-2 rounded-lg font-extrabold flex items-center justify-center gap-1 transition-all ${trendComparisonMode === 'timeline' ? 'bg-white dark:bg-slate-800 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <ChartIcon className="w-3.5 h-3.5" />
                    {lang === 'hi' ? 'समय रेखा प्रवृत्ति' : 'Timeline Trend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { playClickSound(settings.soundEnabled); setTrendComparisonMode('presets'); }}
                    className={`flex-1 text-[10px] py-2 rounded-lg font-extrabold flex items-center justify-center gap-1 transition-all ${trendComparisonMode === 'presets' ? 'bg-white dark:bg-slate-800 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <BarIcon className="w-3.5 h-3.5" />
                    {lang === 'hi' ? 'सभी उत्पादों (All)' : 'All Products Compare'}
                  </button>
                </div>
              </div>

              {trendComparisonMode === 'timeline' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 dark:text-slate-400">
                      {lang === 'hi' ? 'सामान का रेट सहेजें (Select Preset)' : 'Target Product Preset'}
                    </label>
                    <select
                      value={selectedPresetTrendId}
                      onChange={(e) => {
                        playClickSound(settings.soundEnabled);
                        setSelectedPresetTrendId(e.target.value);
                      }}
                      className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-white rounded-xl focus:border-emerald-500 font-bold outline-none cursor-pointer"
                    >
                      {trendPresets.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {lang === 'hi' ? pr.nameHi || pr.name : pr.name} — {settings.preferredCurrency || '₹'}{pr.rate}/KG
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-500 mb-1.5 dark:text-slate-400">
                      {lang === 'hi' ? 'इतिहास सीमा (History Pool)' : 'Historical Pool Range'}
                    </label>
                    <div className="flex gap-1.5">
                      {[5, 10, 20, 50].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => { playClickSound(settings.soundEnabled); setTrendHistoryRange(num); }}
                          className={`flex-1 text-[10px] font-mono py-1 rounded-lg border font-bold transition-all ${trendHistoryRange === num ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 border-indigo-200' : 'bg-transparent border-slate-200 text-slate-500 hover:border-slate-350'}`}
                        >
                          Last {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    const selPreset = trendPresets.find(p => p.id === selectedPresetTrendId);
                    if (!selPreset) return null;
                    const simRateVal = simulatedRates[selectedPresetTrendId] !== undefined ? simulatedRates[selectedPresetTrendId] : selPreset.rate;
                    
                    return (
                      <div className="p-3 bg-amber-500/5 border border-dashed border-amber-500/20 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center text-[10px5]">
                          <span className="font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            {lang === 'hi' ? 'भविष्य दर का सिमुलेशन' : 'Simulate Projected Price'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              playClickSound(settings.soundEnabled);
                              const updated = { ...simulatedRates };
                              delete updated[selectedPresetTrendId];
                              setSimulatedRates(updated);
                            }}
                            className="text-[9px] font-black text-slate-400 hover:text-rose-500 uppercase cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                          {lang === 'hi' 
                            ? 'यह देखने के लिए नई दर निर्धारित करें कि यह ऐतिहासिक औसत से कैसे तुलना करती है।' 
                            : 'Set a projection rate to instantly compare price shifts on the line chart.'}
                        </p>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={Math.max(1, Math.round(selPreset.rate * 0.4))}
                            max={Math.round(selPreset.rate * 1.8)}
                            value={simRateVal}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setSimulatedRates(prev => ({
                                ...prev,
                                [selectedPresetTrendId]: val
                              }));
                            }}
                            className="flex-1 accent-amber-500 cursor-pointer"
                          />
                          <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                            {settings.preferredCurrency || '₹'}{simRateVal.toFixed(0)}/KG
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {trendComparisonMode === 'presets' && (
                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl space-y-1">
                  <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    <Tag className="w-4 h-4" />
                    {lang === 'hi' ? 'उत्पाद मूल्य सूचकांक' : 'Product Prices Index'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                    {lang === 'hi' 
                      ? 'यह मोड आपके सभी मुख्य सहेजे गए सामानों के वर्तमान मूल्य की तुलना इतिहास के सभी लेनदेन औसत से करता है।' 
                      : 'This mode benchmarks the active base rate of all presets against their respective average sold prices across all transaction runs.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSaveToLedger}
            className="w-full mt-4 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs uppercase cursor-pointer"
          >
            <FileCheck className="w-4 h-4" /> Save To Merchant Records
          </button>
        </div>

        {/* Right Side: Outputs & comparison visualizer */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b pb-2">
            Calculation Summary Output
          </h3>

          {activeTab === 'profit_loss' && (() => {
            const audit = profitAudit;
            const absolutePct = Math.abs(audit.percent);
            const absoluteAmt = Math.abs(audit.amount);
            
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200/50 dark:border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Net Amount</p>
                    <p className={`text-2xl font-black font-mono tracking-wide mt-1 ${audit.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-605'}`}>
                      {settings.preferredCurrency || '₹'}{absoluteAmt.toLocaleString(undefined, { maximumFractionDigits: settings.decimalPrecision })}
                    </p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 mt-1 inline-block rounded ${audit.isProfit ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                      {audit.isProfit ? 'PROFIT' : 'LOSS'}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200/50 dark:border-slate-800 rounded-2xl">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Margin percentage</p>
                    <p className={`text-2xl font-black font-mono tracking-wide mt-1 ${audit.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      {absolutePct.toFixed(2)}%
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Normalized against Cost</p>
                  </div>
                </div>

                {/* Custom Profit visual gauge */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Financial Ratio visual bar</p>
                  <div className="h-6 w-full rounded-xl bg-slate-100 overflow-hidden flex font-mono text-[10px] font-bold text-white relative">
                    {(() => {
                      const cp = parseFloat(buyingPrice) || 0;
                      const sp = parseFloat(sellingPrice) || 0;
                      if (cp <= 0 || sp <= 0) {
                        return <div className="bg-slate-350 w-full flex items-center justify-center text-slate-600">INPUT MARGIN SPREAD</div>;
                      }
                      
                      const total = cp + absoluteAmt;
                      const cpWidth = (cp / total) * 100;
                      const spreadWidth = (absoluteAmt / total) * 100;

                      return (
                        <>
                          <div
                            style={{ width: `${cpWidth}%` }}
                            className="bg-slate-750 flex items-center justify-center truncate px-1 border-r border-slate-800"
                          >
                            CP ({cpWidth.toFixed(0)}%)
                          </div>
                          <div
                            style={{ width: `${spreadWidth}%` }}
                            className={`${audit.isProfit ? 'bg-emerald-500' : 'bg-rose-500'} flex items-center justify-center truncate px-1`}
                          >
                            {audit.isProfit ? 'PROFIT' : 'LOSS'} ({spreadWidth.toFixed(0)}%)
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'gst_splitter' && (() => {
            const audit = gstAudit;

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Base Cost</p>
                    <p className="font-mono text-base font-extrabold text-slate-800 dark:text-white mt-1">{settings.preferredCurrency || '₹'}{audit.base.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">CGST (Central)</p>
                    <p className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-450 mt-1">{settings.preferredCurrency || '₹'}{audit.cgst.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">SGST (State)</p>
                    <p className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-450 mt-1">{settings.preferredCurrency || '₹'}{audit.sgst.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-emerald-800">Total Bill</p>
                    <p className="font-mono text-base font-black text-emerald-900 mt-1">{settings.preferredCurrency || '₹'}{audit.total.toFixed(2)}</p>
                  </div>
                </div>

                {/* State Split visual summary */}
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-dashed rounded-2xl text-xs space-y-2">
                  <p className="font-bold uppercase text-slate-400 tracking-wider">Receipt split breakdown</p>
                  <div className="flex justify-between items-center py-1">
                    <span>Base Value before GST:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{settings.preferredCurrency || '₹'}{audit.base.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-200/50">
                    <span>Central Central SGST (split 50% of {gstRate}%):</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{settings.preferredCurrency || '₹'}{audit.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-200/50">
                    <span>State Central CGST (split 50% of {gstRate}%):</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{settings.preferredCurrency || '₹'}{audit.sgst.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'loan_emi' && (() => {
            const audit = emiAudit;
            if (audit.emi === 0) {
              return <p className="text-xs text-center text-slate-400 py-10">Enter valid loan details below parameters to fetch calculation amortizations.</p>;
            }

            return (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-emerald-800">Monthly EMI</p>
                    <p className="font-mono text-lg font-black text-emerald-900 mt-1">{settings.preferredCurrency || '₹'}{audit.emi.toFixed(0)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-450">Total Interest</p>
                    <p className="font-mono text-base font-bold text-rose-600 mt-1">{settings.preferredCurrency || '₹'}{audit.interest.toFixed(0)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-450">Total Payable</p>
                    <p className="font-mono text-base font-bold text-slate-800 dark:text-white mt-1">{settings.preferredCurrency || '₹'}{audit.payable.toFixed(0)}</p>
                  </div>
                </div>

                {/* SVG Comparative Chart for Principal vs Interest Portion */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payable split visual</p>
                  <div className="h-4 w-full rounded-full bg-slate-100 overflow-hidden flex font-mono text-[9px] text-white">
                    {(() => {
                      const principalPortion = parseFloat(loanPrincipal);
                      const interestPortion = audit.interest;
                      const tot = principalPortion + interestPortion;
                      const principalWidth = (principalPortion / tot) * 100;
                      const interestWidth = (interestPortion / tot) * 100;

                      return (
                        <>
                          <div style={{ width: `${principalWidth}%` }} className="bg-emerald-600 flex items-center justify-center truncate">
                            Principal ({principalWidth.toFixed(0)}%)
                          </div>
                          <div style={{ width: `${interestWidth}%` }} className="bg-rose-500 flex items-center justify-center truncate">
                            Interest ({interestWidth.toFixed(0)}%)
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'bulk_batch' && (() => {
            // Filter history to find importable tarazu items
            const importableTarazuItems = (history || []).filter(item => item.type === 'tarazu');

            return (
              <div className="space-y-6">
                {/* Header overview comparison */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-200/50 dark:border-slate-800 rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{lang === 'hi' ? 'कुल आइटम' : 'Total Items'}</span>
                    <span className="text-xl font-black font-mono text-slate-800 dark:text-white mt-1">
                      {batchList.length}
                    </span>
                  </div>

                  <div className="bg-indigo-50/25 dark:bg-indigo-950/20 p-3 border border-indigo-100/50 dark:border-indigo-900/20 rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-wider">{lang === 'hi' ? `मूल ➔ संशोधित ${settings.preferredCurrency || '₹'}` : `Original ➔ Modified ${settings.preferredCurrency || '₹'}`}</span>
                    <span className="text-base font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                      {settings.preferredCurrency || '₹'}{batchOriginalPriceTotal.toFixed(settings.decimalPrecision)} ➔ {settings.preferredCurrency || '₹'}{batchModifiedPriceTotal.toFixed(settings.decimalPrecision)}
                    </span>
                    <span className={`text-[9px] font-black mt-1.5 inline-block ${batchModifiedPriceTotal >= batchOriginalPriceTotal ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {batchModifiedPriceTotal >= batchOriginalPriceTotal ? '▲ +' : '▼ -'}{settings.preferredCurrency || '₹'}{Math.abs(batchModifiedPriceTotal - batchOriginalPriceTotal).toFixed(settings.decimalPrecision)} {lang === 'hi' ? 'अंतर' : 'Diff'}
                    </span>
                  </div>

                  <div className="bg-emerald-50/25 dark:bg-emerald-950/20 p-3 border border-emerald-100/50 dark:border-emerald-900/20 rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-black uppercase tracking-wider">{lang === 'hi' ? 'मूल ➔ संशोधित KG' : 'Original ➔ Modified KG'}</span>
                    <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                      {batchOriginalWeightTotal.toFixed(3)}kg ➔ {batchModifiedWeightTotal.toFixed(3)}kg
                    </span>
                    <span className={`text-[9px] font-black mt-1.5 inline-block ${batchModifiedWeightTotal >= batchOriginalWeightTotal ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {batchModifiedWeightTotal >= batchOriginalWeightTotal ? '▲ +' : '▼ -'}{Math.abs(batchModifiedWeightTotal - batchOriginalWeightTotal).toFixed(3)}kg {lang === 'hi' ? 'अंतर' : 'Diff'}
                    </span>
                  </div>
                </div>

                {/* Import section */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/35 border border-slate-200/50 dark:border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                      <Import className="w-3.5 h-3.5 text-indigo-500" />
                      {lang === 'hi' ? 'इतिहास से लोड करें' : 'Import from History'}
                    </p>
                    {importableTarazuItems.length > 0 && (
                      <button
                        onClick={() => {
                          playClickSound(settings.soundEnabled);
                          const imported = importableTarazuItems.map((item, index) => {
                            const isTarazu = item.type === 'tarazu';
                            const rate = isTarazu ? item.rate : 0;
                            const weight = isTarazu 
                              ? (item.mode === 'weight_to_amount' ? ((item.inputKg || 0) + (item.inputG || 0) / 1000) : ((item.resultKg || 0) + (item.resultG || 0) / 1000))
                              : 1;
                            const totalVal = isTarazu ? (item.resultAmount || item.inputAmount || 0) : 0;
                            return {
                              id: `history_${item.id}_${index}_${Math.random().toString(36).substring(2,5)}`,
                              name: isTarazu ? (lang === 'hi' ? `तपिश माप @ ${settings.preferredCurrency || '₹'}${rate}` : `Weighing Log @ ${settings.preferredCurrency || '₹'}${rate}`) : item.label,
                              originalRate: rate,
                              originalWeight: weight,
                              originalTotal: totalVal,
                            };
                          });
                          setBatchList(prev => [...prev, ...imported]);
                        }}
                        className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 px-2 py-1 rounded-lg hover:bg-emerald-100/60 active:scale-95 cursor-pointer"
                      >
                        {lang === 'hi' ? '+ सभी लोड करें' : '+ Load All'}
                      </button>
                    )}
                  </div>

                  {importableTarazuItems.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-medium">
                      {lang === 'hi'
                        ? 'इतिहास में कोई tarazu माप रिकॉर्ड नहीं मिला। पहले मापने का प्रयास करें!'
                        : 'No tarazu measurement logs found in History. Try weighing some merchant packages first!'}
                    </p>
                  ) : (
                    <div className="max-h-24 overflow-y-auto pr-1 space-y-1.5 divide-y divide-slate-150 dark:divide-slate-800/60">
                      {importableTarazuItems.map((item) => {
                        const isTarazu = item.type === 'tarazu';
                        const rate = isTarazu ? item.rate : 0;
                        const weight = isTarazu 
                          ? (item.mode === 'weight_to_amount' ? ((item.inputKg || 0) + (item.inputG || 0) / 1000) : ((item.resultKg || 0) + (item.resultG || 0) / 1000))
                          : 1;
                        const totalAmount = isTarazu ? (item.resultAmount || item.inputAmount || 0) : 0;

                        return (
                          <div key={item.id} className="flex justify-between items-center text-[10px] py-1.5 first:pt-0">
                            <div className="truncate max-w-[70%] font-semibold text-slate-600 dark:text-slate-350">
                              {item.label}
                            </div>
                            <button
                              onClick={() => {
                                playClickSound(settings.soundEnabled);
                                setBatchList(prev => [
                                  ...prev,
                                  {
                                    id: `history_single_${item.id}_${Math.random().toString(36).substring(2,5)}`,
                                    name: lang === 'hi' ? `माप @ ${settings.preferredCurrency || '₹'}${rate}` : `Weigh log @ ${settings.preferredCurrency || '₹'}${rate}`,
                                    originalRate: rate,
                                    originalWeight: weight,
                                    originalTotal: totalAmount,
                                  }
                                ]);
                              }}
                              className="px-1.5 py-0.5 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-100/40 text-indigo-600 dark:text-indigo-400 rounded-md font-bold hover:bg-indigo-100/95 active:scale-95 cursor-pointer text-[8px]"
                            >
                              + {lang === 'hi' ? 'आयात करें' : 'Import'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Batch list table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                      {lang === 'hi' ? 'सक्रिय बैच सूची' : 'Active Batch List'} ({batchList.length})
                    </p>
                    {batchList.length > 0 && (
                      <button
                        onClick={() => {
                          playClickSound(settings.soundEnabled);
                          setBatchList([]);
                        }}
                        className="text-[9px] font-black uppercase text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer bg-red-50 dark:bg-red-950/30 border border-red-200/20 px-2 py-0.5 rounded"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        {lang === 'hi' ? 'बैच साफ़ करें' : 'Clear Batch'}
                      </button>
                    )}
                  </div>

                  {batchList.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      <p className="text-xs text-slate-400 font-bold">
                        {lang === 'hi' ? 'आपकी बैच सूची खाली है।' : 'Your batch list is empty.'}
                      </p>
                      <p className="text-[10px] text-slate-400 px-6 mt-1">
                        {lang === 'hi'
                          ? 'इतिहास लॉग से आइटम आयात करें या बाएँ फलक से मैनुअल विवरण जोड़ें।'
                          : 'Import items from the History Log above, or add manual details from the left panel.'}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Table Header */}
                      <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-[9px] font-extrabold uppercase text-slate-450 tracking-wider">
                        <div className="col-span-4">{lang === 'hi' ? 'सामान का नाम' : 'Item Name'}</div>
                        <div className="col-span-3 text-right">Original</div>
                        <div className="col-span-4 text-right text-indigo-500 font-black">Modified (Live)</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* Display items */}
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-105 dark:divide-slate-800/80 pr-0.5">
                        {modifiedBatch.map((item) => (
                          <div key={item.id} className="grid grid-cols-12 items-center px-3 py-2.5 text-[11px] hover:bg-slate-50/55 dark:hover:bg-slate-900/10">
                            {/* Name */}
                            <div className="col-span-4 pr-1 font-bold truncate text-slate-700 dark:text-slate-300" title={item.name}>
                              {item.name}
                            </div>
                            
                            {/* Original */}
                            <div className="col-span-3 text-right text-slate-400 font-medium font-mono text-[10px] leading-snug">
                              <div>{settings.preferredCurrency || '₹'}{item.originalRate}/kg</div>
                              <div>{item.originalWeight.toFixed(3)}kg</div>
                              <div className="font-bold text-slate-450 mt-0.5">{settings.preferredCurrency || '₹'}{item.originalTotal.toFixed(settings.decimalPrecision)}</div>
                            </div>

                            {/* Modified */}
                            <div className="col-span-4 text-right font-semibold font-mono text-indigo-600 dark:text-indigo-400 leading-snug">
                              <div>
                                {settings.preferredCurrency || '₹'}{item.modifiedRate}/kg 
                                {item.modifiedRate !== item.originalRate && (
                                  <span className={`text-[8px] font-bold ml-1 ${item.modifiedRate > item.originalRate ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {item.modifiedRate > item.originalRate ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                              <div>
                                {item.modifiedWeight.toFixed(3)}kg
                                {item.modifiedWeight !== item.originalWeight && (
                                  <span className={`text-[8px] font-bold ml-1 ${item.modifiedWeight > item.originalWeight ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {item.modifiedWeight > item.originalWeight ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                              <div className="font-black text-indigo-705 dark:text-indigo-300 text-xs mt-0.5">
                                {settings.preferredCurrency || '₹'}{item.modifiedTotal.toFixed(settings.decimalPrecision)}
                              </div>
                            </div>

                            {/* Delete single item action */}
                            <div className="col-span-1 text-right">
                              <button
                                onClick={() => {
                                  playClickSound(settings.soundEnabled);
                                  setBatchList(prev => prev.filter(x => x.id !== item.id));
                                }}
                                className="p-1 hover:text-rose-500 text-slate-350 dark:text-slate-500 rounded-full hover:bg-rose-50 dark:hover:bg-rose-955 transition-colors cursor-pointer"
                                title={lang === 'hi' ? 'आइटम हटाएँ' : 'Delete item'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cumulative Total Row */}
                      <div className="grid grid-cols-12 bg-slate-100/60 dark:bg-slate-900/40 px-3 py-3 font-mono text-[11px] font-bold border-t border-slate-205 dark:border-slate-800">
                        <div className="col-span-4 uppercase text-slate-500 text-[10px] font-black tracking-wider">{lang === 'hi' ? 'कुल संचयी' : 'Total Cumulative'}</div>
                        <div className="col-span-3 text-right text-slate-400 leading-normal text-[10px]">
                          <div>{batchOriginalWeightTotal.toFixed(3)}kg</div>
                          <div className="text-slate-500 font-bold mt-0.5">{settings.preferredCurrency || '₹'}{batchOriginalPriceTotal.toFixed(settings.decimalPrecision)}</div>
                        </div>
                        <div className="col-span-4 text-right text-indigo-700 dark:text-indigo-400 leading-normal text-xs font-black">
                          <div>{batchModifiedWeightTotal.toFixed(3)}kg</div>
                          <div className="text-indigo-600 dark:text-indigo-300 font-black mt-0.5 text-sm">
                            {settings.preferredCurrency || '₹'}{batchModifiedPriceTotal.toFixed(settings.decimalPrecision)}
                          </div>
                        </div>
                        <div className="col-span-1"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'payment_qr' && (() => {
            const amt = parseFloat(qrAmount) || 0;
            
            const payUrl = (() => {
              const cleanUpi = upiId.trim();
              if (cleanUpi.startsWith('http://') || cleanUpi.startsWith('https://')) {
                return cleanUpi;
              }
              const name = recipientName.trim() || settings.shopName || 'Merchant';
              const id = cleanUpi || 'merchant@upi';
              return `upi://pay?pa=${id}&pn=${encodeURIComponent(name)}&am=${amt.toFixed(2)}&cu=INR&tn=${encodeURIComponent(qrNote)}`;
            })();

            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=${encodeURIComponent(payUrl)}`;

            return (
              <div className="space-y-6 text-center select-none animate-fadeIn">
                
                {paymentSuccessSimulated ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col items-center justify-center gap-2 text-center select-none">
                    <div className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white text-lg font-bold shadow animate-bounce">
                      ✓
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-emerald-850 dark:text-emerald-400">
                        {lang === 'hi' ? 'भुगतान सफलतापूर्वक प्राप्त हुआ!' : 'Payment Received Successfully!'}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                        {lang === 'hi' ? 'स्मार्ट तराजू ध्वनि बॉक्स: "प्राप्त हुए ' : 'Smart Scale Voice: "Received '}{settings.preferredCurrency || '₹'}{amt.toLocaleString()}{lang === 'hi' ? ' रुपये"' : '"'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        playClickSound(settings.soundEnabled);
                        setPaymentSuccessSimulated(false);
                      }}
                      className="mt-1 text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/30 px-2 py-0.5 rounded cursor-pointer"
                    >
                      {lang === 'hi' ? 'रीसेट करें' : 'Simulate Again'}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-505 dark:text-slate-400 font-bold">
                    <span className="flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-indigo-650 dark:text-indigo-400">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping inline-block" />
                      {lang === 'hi' ? 'क्यूआर स्कैनर रडार सक्रिय' : 'QR Scanner Stand Active'}
                    </span>
                    <button
                      onClick={() => {
                        playSuccessSound(settings.soundEnabled);
                        setPaymentSuccessSimulated(true);
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase rounded-lg text-[9px] tracking-wider transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                    >
                      🎰 {lang === 'hi' ? 'सफल भुगतान सिम्युलेट' : 'Simulate Paid'}
                    </button>
                  </div>
                )}

                {/* Vertical Pay Standee Component */}
                <div className="relative max-w-sm mx-auto bg-slate-900 text-white rounded-3xl p-5 shadow-2xl border-4 border-slate-950/40 select-none overflow-hidden">
                  
                  {/* Decorative Merchant Header Stand */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-indigo-500" />
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-b border-slate-800 pb-2 mb-4">
                    <span className="flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-emerald-500" />
                      TARAZU PAY
                    </span>
                    <span className="tracking-widest opacity-80 font-mono">BHIM / UPI READY</span>
                  </div>

                  {/* Recipient Store Title */}
                  <div className="text-center space-y-1 mb-4">
                    <h4 className="font-extrabold text-base tracking-tight text-white max-w-[250px] mx-auto truncate" title={recipientName}>
                      {recipientName}
                    </h4>
                    {upiId && (
                      <p className="text-[10px] text-slate-500 font-mono select-all truncate max-w-[250px] mx-auto">
                        {upiId}
                      </p>
                    )}
                  </div>

                  {/* QR Core Container Board */}
                  <div className="relative bg-white p-3 rounded-2xl inline-block shadow-lg mx-auto border border-slate-100">
                    
                    <img
                      src={qrImageUrl}
                      alt="UPI Payment QR Code"
                      referrerPolicy="no-referrer"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-lg relative z-0 select-none"
                    />

                    {/* Scanner animation scan line */}
                    {isLaserActive && !paymentSuccessSimulated && (
                      <div className="absolute left-3 right-3 top-3 h-0.5 bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-laserLine z-10" />
                    )}

                    {paymentSuccessSimulated && (
                      <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-900 font-sans p-6">
                        <div className="h-12 w-12 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-xl shadow-lg">
                          ✓
                        </div>
                        <p className="font-extrabold text-sm text-slate-800">{lang === 'hi' ? 'भुगतान सफल' : 'Payment Success'}</p>
                        <p className="text-[10px] font-bold font-mono text-slate-450">
                          {new Date().toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Amount Badge */}
                  <div className="mt-4 space-y-1">
                    <p className="text-[10px] text-slate-500 font-black tracking-wider uppercase">
                      {lang === 'hi' ? 'स्कैन कर राशि का भुगतान करें' : 'Scan and Pay Net Amount'}
                    </p>
                    <p className="font-sans text-2xl font-black text-emerald-450 tracking-tight flex items-center justify-center gap-1">
                      <span>{settings.preferredCurrency || '₹'}</span>
                      <span className="font-mono">{amt.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-US', { minimumFractionDigits: 2 })}</span>
                    </p>
                    {qrNote && (
                      <span className="inline-block bg-slate-800 border border-slate-700/50 text-[9px] text-slate-400 px-2.5 py-1 rounded-full font-bold">
                        📋 {qrNote}
                      </span>
                    )}
                  </div>

                  {/* Stand bottom feet */}
                  <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between items-center text-[8px] text-slate-500 font-semibold font-mono">
                    <span>SECURE TRANSACTION</span>
                    <span>FAST SMART SCALE</span>
                  </div>
                </div>

                {/* Laser scan toggler & manual configs */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      setIsLaserActive(!isLaserActive);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isLaserActive
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-transparent'
                    }`}
                  >
                    ⚡ {lang === 'hi' ? 'लेज़र लाइन' : 'Laser Line'} {isLaserActive ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      try {
                        navigator.clipboard.writeText(payUrl);
                        setCopiedText(true);
                        setTimeout(() => setCopiedText(false), 2000);
                      } catch {
                        alert(lang === 'hi' ? 'लिंक: ' + payUrl : 'Link: ' + payUrl);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-transparent hover:border-slate-300 dark:hover:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{lang === 'hi' ? 'कॉपी हो गया' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{lang === 'hi' ? 'लिंक कॉपी करें' : 'Copy Pay Link'}</span>
                      </>
                    )}
                  </button>

                  <a
                    href={qrImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => playClickSound(settings.soundEnabled)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-transparent hover:border-slate-300 dark:hover:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{lang === 'hi' ? 'क्यूआर खोलें' : 'Open QR Code'}</span>
                  </a>
                </div>

              </div>
            );
          })()}

          {activeTab === 'price_trends' && (() => {
            // Get all tarazu history items
            const tarazuLogs = history.filter((h) => h.type === 'tarazu');
            
            // Get selected preset
            const selPreset = trendPresets.find((p) => p.id === selectedPresetTrendId) || trendPresets[0];
            
            // For Timeline: Match logs that are within 50% window of selected preset rate
            const matchedLogs = tarazuLogs.filter((h) => {
              const diff = Math.abs(h.rate - selPreset.rate);
              return diff <= selPreset.rate * 0.5;
            });
            
            // Sort chronic
            const sortedLogs = [...matchedLogs].sort((a, b) => a.timestamp - b.timestamp);
            
            // Slice to user range
            const displayLogs = sortedLogs.slice(-trendHistoryRange);
            
            // If empty, generate base benchmark data so the chart renders elegantly
            const hasRealData = displayLogs.length >= 2;
            
            const chartData = hasRealData 
              ? displayLogs.map((h, i) => {
                  const dateStr = new Date(h.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return {
                    name: dateStr,
                    rate: h.rate,
                    label: h.label,
                  };
                })
              : [
                  // Beautiful chronological baseline for empty state
                  { name: lang === 'hi' ? '10 मिनट पहले' : '10 mins ago', rate: selPreset.rate * 0.94 },
                  { name: lang === 'hi' ? '5 मिनट पहले' : '5 mins ago', rate: selPreset.rate * 1.05 },
                  { name: lang === 'hi' ? '3 मिनट पहले' : '3 mins ago', rate: selPreset.rate * 0.98 },
                  { name: lang === 'hi' ? 'अभी' : 'Just now', rate: selPreset.rate },
                ];

            // Average historical rate
            const rawAvgRate = matchedLogs.length > 0 
              ? matchedLogs.reduce((sum, h) => sum + h.rate, 0) / matchedLogs.length 
              : selPreset.rate * 0.99; // baseline near-accurate estimation if empty
            
            const avgRate = Number(rawAvgRate.toFixed(settings.decimalPrecision));
            
            // Base/Current active rate
            const simRateVal = simulatedRates[selectedPresetTrendId] !== undefined ? simulatedRates[selectedPresetTrendId] : selPreset.rate;
            
            // Deviation from history avg
            const deviationPercent = avgRate > 0 ? (((simRateVal - avgRate) / avgRate) * 100) : 0;
            
            // Now calculate "All presets" comparison bar chart data
            const barChartData = trendPresets.map((pr) => {
              // Find matching history entries for this specific preset's starting base price
              const prLogs = tarazuLogs.filter((h) => Math.abs(h.rate - pr.rate) <= pr.rate * 0.5);
              const prAvgRate = prLogs.length > 0
                ? prLogs.reduce((sum, h) => sum + h.rate, 0) / prLogs.length
                : pr.rate * 0.98; // safe baseline fallback slightly off so it looks good visually
              
              const currentRate = simulatedRates[pr.id] !== undefined ? simulatedRates[pr.id] : pr.rate;
              
              return {
                name: lang === 'hi' ? pr.nameHi || pr.name : pr.name,
                [lang === 'hi' ? 'वर्तमान दर' : 'Current Rate']: currentRate,
                [lang === 'hi' ? 'इतिहास औसत' : 'History Avg']: Number(prAvgRate.toFixed(settings.decimalPrecision)),
              };
            });

            return (
              <div className="space-y-6 select-none animate-fadeIn">
                {/* Stats Summary Panel */}
                {trendComparisonMode === 'timeline' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 border border-slate-200/50 dark:border-slate-800 rounded-2xl">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider block">
                        {lang === 'hi' ? 'सक्रिय दर (Active Rate)' : 'Current Active Rate'}
                      </span>
                      <p className="text-xl font-black font-mono tracking-tight text-slate-800 dark:text-white mt-1 flex items-baseline gap-1">
                        <span className="text-sm font-sans font-bold text-slate-400">{settings.preferredCurrency || '₹'}</span>
                        {simRateVal.toFixed(settings.decimalPrecision)}
                        <span className="text-[9px] font-bold text-slate-400">/KG</span>
                      </p>
                      {simulatedRates[selectedPresetTrendId] !== undefined && (
                        <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5 mt-1 animate-pulse">
                          ● {lang === 'hi' ? 'सिम्युलेटेड दर सक्रिय' : 'Simulating Projection'}
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 border border-slate-200/50 dark:border-slate-800 rounded-2xl">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider block">
                        {lang === 'hi' ? 'ऐतिहासिक औसत (Avg)' : 'Historical Average'}
                      </span>
                      <p className="text-xl font-black font-mono tracking-tight text-slate-800 dark:text-white mt-1 flex items-baseline gap-1">
                        <span className="text-sm font-sans font-bold text-slate-400">{settings.preferredCurrency || '₹'}</span>
                        {avgRate.toFixed(settings.decimalPrecision)}
                        <span className="text-[9px] font-bold text-slate-400">/KG</span>
                      </p>
                      <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                        {hasRealData ? `Based on ${matchedLogs.length} real entries` : 'Sandbox benchmark baseline'}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 border border-slate-200/50 dark:border-slate-800 rounded-2xl">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-wider block">
                        {lang === 'hi' ? 'मूल्य विचलन' : 'Price Deviation'}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`text-xl font-black font-mono tracking-tight ${deviationPercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : deviationPercent < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                          {deviationPercent > 0 ? '+' : ''}{deviationPercent.toFixed(1)}%
                        </span>
                        {deviationPercent !== 0 && (
                          <span className={`w-2 h-2 rounded-full ${deviationPercent > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">
                        {deviationPercent > 0 
                          ? (lang === 'hi' ? 'औसत से अधिक की बिक्री' : 'Higher than average')
                          : deviationPercent < 0
                          ? (lang === 'hi' ? 'औसत से कम की बिक्री' : 'Lower than average')
                          : (lang === 'hi' ? 'औसत के बराबर बिक्री' : 'Inline with average')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-905/40 border border-slate-200/50 dark:border-slate-800 rounded-2xl text-[10px] text-slate-400 font-bold">
                    <span>PRODUCT BASKET SCATTER</span>
                    <span className="text-slate-500">{trendPresets.length} ACTIVE REGISTERED PRESETS</span>
                  </div>
                )}

                {/* Primary Chart Board */}
                <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850 p-4 rounded-3xl shadow-inner min-h-[310px]">
                  
                  {trendComparisonMode === 'timeline' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/40 dark:border-slate-800/40">
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
                            <ChartIcon className="w-4 h-4 text-emerald-500" />
                            {lang === 'hi' ? `${selPreset.nameHi || selPreset.name} मूल्य इतिहास` : `${selPreset.name} Rate Over Time`}
                          </h4>
                          <p className="text-[9px] font-bold text-slate-400">
                            {hasRealData ? 'Ledger price record log' : 'Demonstration pattern (save real entries from Tarazu scale to build trendline)'}
                          </p>
                        </div>
                        {!hasRealData && (
                          <span className="bg-amber-150 dark:bg-amber-950/40 border border-amber-250 dark:border-amber-900 text-amber-800 dark:text-amber-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" /> DEMO
                          </span>
                        )}
                      </div>

                      <div className="w-full h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings.darkMode ? '#1e293b' : '#f1f5f9'} />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                              domain={['auto', 'auto']}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: settings.darkMode ? '#0f172a' : '#ffffff',
                                borderColor: settings.darkMode ? '#334155' : '#e2e8f0',
                                color: settings.darkMode ? '#f8fafc' : '#0f172a',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '700',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                              }}
                            />
                            {/* Current Active Threshold Line */}
                            <ReferenceLine 
                              y={simRateVal} 
                              stroke="#eab308" 
                              strokeDasharray="4 4"
                              label={{ 
                                value: lang === 'hi' ? `वर्तमान: ${settings.preferredCurrency || '₹'}${simRateVal}` : `Active: ${settings.preferredCurrency || '₹'}${simRateVal}`, 
                                fill: '#eab308', 
                                position: 'top', 
                                fontSize: 8,
                                fontWeight: 805
                              }} 
                            />
                            {/* Historical Average rate ReferenceLine */}
                            <ReferenceLine 
                              y={avgRate} 
                              stroke="#06b6d4" 
                              strokeDasharray="4 4"
                              label={{ 
                                value: lang === 'hi' ? `औसत: ${settings.preferredCurrency || '₹'}${avgRate}` : `Avg: ${settings.preferredCurrency || '₹'}${avgRate}`, 
                                fill: '#06b6d4', 
                                position: 'bottom', 
                                fontSize: 8,
                                fontWeight: 805
                              }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="rate" 
                              stroke="#10b981" 
                              strokeWidth={3} 
                              dot={{ r: 4, strokeWidth: 2, fill: settings.darkMode ? '#0f172a' : '#fff' }}
                              activeDot={{ r: 6 }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/40 dark:border-slate-800/40">
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1">
                            <BarIcon className="w-4 h-4 text-emerald-500" />
                            {lang === 'hi' ? 'सभी उत्पादों की मूल्य तुलना' : 'All Products Benchmark Chart'}
                          </h4>
                          <p className="text-[9px] font-bold text-slate-400">
                            Current Active Rate vs Historical Ledger Average Rate per item
                          </p>
                        </div>
                      </div>

                      <div className="w-full h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={settings.darkMode ? '#1e293b' : '#f1f5f9'} vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: settings.darkMode ? '#0f172a' : '#ffffff',
                                borderColor: settings.darkMode ? '#334155' : '#e2e8f0',
                                color: settings.darkMode ? '#f8fafc' : '#0f172a',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '700',
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '9px', fontWeight: '800', marginTop: '5px' }} />
                            <Bar 
                              dataKey={lang === 'hi' ? 'वर्तमान दर' : 'Current Rate'} 
                              fill="#10b981" 
                              radius={[4, 4, 0, 0]} 
                            />
                            <Bar 
                              dataKey={lang === 'hi' ? 'इतिहास औसत' : 'History Avg'} 
                              fill="#06b6d4" 
                              radius={[4, 4, 0, 0]} 
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                </div>

                {/* Info guidance callout */}
                <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-start gap-2 text-left">
                  <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <h5 className="font-extrabold text-[10px] text-emerald-850 dark:text-emerald-400">
                      {lang === 'hi' ? 'स्मार्ट मूल्य रुझान क्या है?' : 'What is the Price Trends Visualizer?'}
                    </h5>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400/80 font-bold leading-normal">
                      {lang === 'hi' 
                        ? 'यह उपकरण आपको यह समझने में मदद करता है कि आपका वर्तमान बिक्री मूल्य आपके पिछले बिक्री इतिहास के औसत मूल्य से कितना विचलित है। यह आपको बाजार के उतार-चढ़ाव के अनुसार खुदरा कीमतें तय करने की उत्कृष्ट अंतर्दृष्टि देता है!'
                        : 'This tool visualizes markup trends by comparing your active preset rates directly counter to actual ledger transactions. Use simulated rates to study pricing shifts and protect retail margins.'}
                    </p>
                  </div>
                </div>

              </div>
            );
          })()}

        </div>

      </div>
    </div>
  );
}
