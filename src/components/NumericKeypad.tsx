import React from 'react';
import { Delete, CornerDownLeft } from 'lucide-react';
import { playClickSound } from '../utils/audio';

interface NumericKeypadProps {
  value: string;
  onChange: (newValue: string) => void;
  onEnter?: () => void;
  soundEnabled?: boolean;
}

export default function NumericKeypad({
  value,
  onChange,
  onEnter,
  soundEnabled = true,
}: NumericKeypadProps) {
  
  const handlePress = (key: string) => {
    playClickSound(soundEnabled);
    if (key === 'C') {
      onChange('');
    } else if (key === '⌫' || key === 'Backspace') {
      onChange(value.slice(0, -1));
    } else if (key === '.') {
      if (!value.includes('.')) {
        onChange(value === '' ? '0.' : value + '.');
      }
    } else {
      // Prevent multiple zeroes at start
      if (value === '0' && key === '0') return;
      // If value is 0 and we type a nonzero, overwrite
      if (value === '0') {
        onChange(key);
      } else {
        onChange(value + key);
      }
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-2.5 xs:p-3 shadow-sm select-none">
      <div className="grid grid-cols-3 gap-2 xs:gap-2.5">
        {keys.map((key) => {
          const isAction = key === '⌫';
          return (
            <button
              key={key}
              type="button"
              id={`keypad-btn-${key}`}
              onClick={() => handlePress(key)}
              className={`
                h-10 xs:h-11 sm:h-14 flex items-center justify-center rounded-lg text-lg font-semibold transition-all duration-100 active:scale-95 cursor-pointer
                ${
                  isAction
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:border-emerald-200'
                }
              `}
            >
              {key === '⌫' ? <Delete className="w-4 h-4" /> : key}
            </button>
          );
        })}
        
        {/* Quick clear and OK keys */}
        <button
          type="button"
          id="keypad-btn-clear"
          onClick={() => handlePress('C')}
          className="col-span-1 h-10 xs:h-11 sm:h-14 bg-rose-50 border border-rose-200/60 text-rose-700 font-semibold text-base rounded-lg hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-400 transition-all active:scale-95 cursor-pointer"
        >
          C
        </button>
        
        <button
          type="button"
          id="keypad-btn-ok"
          onClick={() => {
            playClickSound(soundEnabled);
            if (onEnter) onEnter();
          }}
          className="col-span-2 h-10 xs:h-11 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base rounded-lg shadow-md shadow-emerald-600/10 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
        >
          <CornerDownLeft className="w-4 h-4" /> OK
        </button>
      </div>
    </div>
  );
}
