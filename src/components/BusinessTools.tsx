import React, { useState } from 'react';
import { DollarSign, Percent, TrendingUp, Calculator, Calendar, Landmark, CheckCircle, FileCheck } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';

interface BusinessToolsProps {
  lang: Language;
  settings: AppSettings;
  onAddHistoryItem: (item: HistoryItemInput) => void;
}

export default function BusinessTools({
  lang,
  settings,
  onAddHistoryItem,
}: BusinessToolsProps) {
  const t = translate(lang);

  // Tabs: 'profit_loss' | 'gst_splitter' | 'loan_emi'
  const [activeTab, setActiveTab] = useState<'profit_loss' | 'gst_splitter' | 'loan_emi'>('profit_loss');

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
    } else {
      const emiVal = emiAudit.emi.toFixed(settings.decimalPrecision);
      onAddHistoryItem({
        type: 'business',
        tool: 'emi',
        inputs: { loanPrincipal, loanRate, loanDuration },
        outputs: { monthlyEmi: emiAudit.emi, totalInterest: emiAudit.interest, totalPayable: emiAudit.payable },
        label: `Capital Loan: ₹${loanPrincipal} (${loanRate}% p.a.) → Monthly EMI: ₹${emiVal} x ${emiAudit.monthsCount} months`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Header Grid tabs for selection */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'profit_loss', label: t('profitCalc'), icon: <TrendingUp className="w-5 h-5" /> },
          { id: 'gst_splitter', label: t('gstCalc'), icon: <Calculator className="w-5 h-5" /> },
          { id: 'loan_emi', label: t('emiCalc'), icon: <Landmark className="w-5 h-5" /> },
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
                  <span className="bg-slate-50 border-r text-slate-500 font-bold px-3 py-2">₹</span>
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
                    <p className={`text-2xl font-black font-mono tracking-wide mt-1 ${audit.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                      ₹{absoluteAmt.toLocaleString(undefined, { maximumFractionDigits: settings.decimalPrecision })}
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
                    <p className="font-mono text-base font-extrabold text-slate-800 dark:text-white mt-1">₹{audit.base.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">CGST (Central)</p>
                    <p className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-450 mt-1">₹{audit.cgst.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400">SGST (State)</p>
                    <p className="font-mono text-base font-extrabold text-emerald-700 dark:text-emerald-450 mt-1">₹{audit.sgst.toFixed(2)}</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <p className="text-[10px] uppercase font-bold text-emerald-800">Total Bill</p>
                    <p className="font-mono text-base font-black text-emerald-900 mt-1">₹{audit.total.toFixed(2)}</p>
                  </div>
                </div>

                {/* State Split visual summary */}
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-dashed rounded-2xl text-xs space-y-2">
                  <p className="font-bold uppercase text-slate-400 tracking-wider">Receipt split breakdown</p>
                  <div className="flex justify-between items-center py-1">
                    <span>Base Value before GST:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">₹{audit.base.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-200/50">
                    <span>Central Central SGST (split 50% of {gstRate}%):</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{audit.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-t border-slate-200/50">
                    <span>State Central CGST (split 50% of {gstRate}%):</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{audit.sgst.toFixed(2)}</span>
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
                    <p className="font-mono text-lg font-black text-emerald-900 mt-1">₹{audit.emi.toFixed(0)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-450">Total Interest</p>
                    <p className="font-mono text-base font-bold text-rose-600 mt-1">₹{audit.interest.toFixed(0)}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-450">Total Payable</p>
                    <p className="font-mono text-base font-bold text-slate-800 dark:text-white mt-1">₹{audit.payable.toFixed(0)}</p>
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

        </div>

      </div>
    </div>
  );
}
