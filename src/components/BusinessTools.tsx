import React, { useState } from 'react';
import { DollarSign, Percent, TrendingUp, Calculator, Calendar, Landmark, CheckCircle, FileCheck, Layers, Trash2, Plus, Minus, ArrowRight, Sparkles, Scale, Import } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';

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

  // Tabs: 'profit_loss' | 'gst_splitter' | 'loan_emi' | 'bulk_batch'
  const [activeTab, setActiveTab] = useState<'profit_loss' | 'gst_splitter' | 'loan_emi' | 'bulk_batch'>('profit_loss');

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
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Header Grid tabs for selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { id: 'profit_loss', label: t('profitCalc'), icon: <TrendingUp className="w-5 h-5" /> },
          { id: 'gst_splitter', label: t('gstCalc'), icon: <Calculator className="w-5 h-5" /> },
          { id: 'loan_emi', label: t('emiCalc'), icon: <Landmark className="w-5 h-5" /> },
          { id: 'bulk_batch', label: lang === 'hi' ? 'थोक बैच (Bulk)' : 'Bulk Batch', icon: <Layers className="w-5 h-5" /> },
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

        </div>

      </div>
    </div>
  );
}
