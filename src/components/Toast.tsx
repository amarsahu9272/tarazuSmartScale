import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div
      id="toast-container"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none select-none"
    >
      {toasts.map((t) => {
        let bgColor = 'bg-blue-50 dark:bg-blue-950/90 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300';
        let Icon = Info;

        if (t.type === 'success') {
          bgColor = 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300';
          Icon = CheckCircle;
        } else if (t.type === 'error') {
          bgColor = 'bg-rose-50 dark:bg-rose-950/90 border-rose-100 dark:border-rose-900 text-rose-800 dark:text-rose-300';
          Icon = AlertCircle;
        } else if (t.type === 'warning') {
          bgColor = 'bg-amber-50 dark:bg-amber-955/90 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300';
          Icon = AlertTriangle;
        }

        return (
          <div
            key={t.id}
            id={`toast-${t.id}`}
            className={`flex items-center justify-between p-3.5 rounded-2xl border shadow-lg pointer-events-auto transition-all transform duration-300 ease-out animate-slide-in ${bgColor}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="w-5 h-5 shrink-0" />
              <p className="text-xs font-bold font-sans pr-1 leading-snug text-left">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer shrink-0 ml-1.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
