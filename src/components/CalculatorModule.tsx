import React, { useState, useEffect } from 'react';
import { Delete, Trash2, Copy, CheckCircle, Scale, Volume2 } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';

interface CalculatorModuleProps {
  lang: Language;
  settings: AppSettings;
  onAddHistoryItem: (item: HistoryItemInput) => void;
}

export default function CalculatorModule({
  lang,
  settings,
  onAddHistoryItem,
}: CalculatorModuleProps) {
  const t = translate(lang);
  
  const [expression, setExpression] = useState('');
  const [displayVal, setDisplayVal] = useState('0');
  const [isDone, setIsDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keyboard integration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is inside input elements
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
  }, [displayVal, expression, isDone]);

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
      label: `₹${val} + ${rateVal}% Business GST = ₹${totalStr}`,
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
      label: `₹${val} - ${rateVal}% GST Deducted = ₹${baseStr}`,
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
      label: `₹${val} - ${discVal}% Discount Coupon = ₹${finalStr}`,
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(displayVal);
    setCopied(true);
    playSuccessSound(settings.soundEnabled);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      
      {/* Calculator Core Outer Wrapper */}
      <div className="bg-slate-900 border border-slate-950 p-5 rounded-3xl shadow-xl space-y-5 relative overflow-hidden">
        
        {/* Subtle decorative grid background for physical calculator aesthetics */}
        <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none"></div>

        {/* LED Screen */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-right select-all font-mono shadow-inner relative z-10 select-none">
          <div className="text-emerald-700/80 text-[10px] uppercase font-bold tracking-widest absolute top-2 left-3">
            Digital LED Monitor
          </div>
          <div className="h-6 text-slate-500 font-semibold text-xs truncate pt-1 tracking-wider">
            {expression}
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono tracking-wide truncate mt-1">
            {displayVal}
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

      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-xl">💡</span>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <p className="font-bold uppercase tracking-wider">{lang === 'hi' ? 'कीबोर्ड सपोर्ट सक्रिय है!' : 'Physical Keyboard Enabled!'}</p>
          <p className="mt-0.5">Use on-screen buttons or type numbers directly. <kbd className="bg-white dark:bg-slate-800 border px-1 rounded shadow-sm text-slate-700 dark:text-slate-200 font-mono text-[10px]">Back</kbd> deletes, <kbd className="bg-white dark:bg-slate-800 border px-1 rounded shadow-sm text-slate-700 dark:text-slate-200 font-mono text-[10px]">Enter</kbd> solves, and <kbd className="bg-white dark:bg-slate-800 border px-1 rounded shadow-sm text-slate-700 dark:text-slate-200 font-mono text-[10px]">Esc</kbd> clears.</p>
        </div>
      </div>

    </div>
  );
}
