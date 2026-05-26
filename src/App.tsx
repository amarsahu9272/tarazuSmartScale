/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Scale,
  RefreshCw,
  Calculator,
  TrendingUp,
  History,
  Settings,
  Globe,
  Moon,
  Sun,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from './types';
import { translate } from './i18n';
import { playClickSound, playSuccessSound } from './utils/audio';
import {
  getStoredSettings,
  saveStoredSettings,
  getStoredHistory,
  saveStoredHistory,
} from './utils/storage';

// Module Imports
import Dashboard from './components/Dashboard';
import TarazuModule from './components/TarazuModule';
import ConverterModule from './components/ConverterModule';
import CalculatorModule from './components/CalculatorModule';
import BusinessTools from './components/BusinessTools';
import HistoryModule from './components/HistoryModule';
import SettingsModule from './components/SettingsModule';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings());
  const [history, setHistory] = useState<HistoryItem[]>(getStoredHistory());
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const t = translate(settings.language);

  // Sync settings theme to document on load
  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  // Sync history changes
  useEffect(() => {
    saveStoredHistory(history);
  }, [history]);

  // Add history calculation record
  const handleAddHistoryItem = (newItem: HistoryItemInput) => {
    const item: HistoryItem = {
      ...newItem,
      id: Date.now().toString(),
      timestamp: Date.now(),
    } as HistoryItem;

    setHistory((prev) => [item, ...prev]);
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleUpdateSettings = (updated: AppSettings) => {
    setSettings(updated);
  };

  const handleResetData = () => {
    localStorage.clear();
    setSettings(getStoredSettings());
    setHistory([]);
    setActiveSection('dashboard');
    playSuccessSound(settings.soundEnabled);
  };

  const handleLangToggle = () => {
    const nextLang: Language = settings.language === 'en' ? 'hi' : 'en';
    playSuccessSound(settings.soundEnabled);
    setSettings((prev) => ({ ...prev, language: nextLang }));
  };

  const handleThemeToggle = () => {
    const nextDark = !settings.darkMode;
    playClickSound(settings.soundEnabled);
    setSettings((prev) => ({ ...prev, darkMode: nextDark }));
  };

  // Nav categories config
  const navItems = [
    { id: 'dashboard', label: t('dashboard'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'tarazu', label: t('tarazu'), icon: <Scale className="w-5 h-5 animate-none" /> },
    { id: 'converter', label: t('converter'), icon: <RefreshCw className="w-5 h-5" /> },
    { id: 'calculator', label: t('calculator'), icon: <Calculator className="w-5 h-5" /> },
    { id: 'business', label: t('businessTools'), icon: <TrendingUp className="w-5 h-5" /> },
    { id: 'history', label: t('history'), icon: <History className="w-5 h-5" /> },
    { id: 'settings', label: t('settings'), icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className={`min-h-screen font-sans antialiased text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 transition-colors duration-300 pb-20 md:pb-0`}>
      
      {/* Top action header */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-900/75 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between select-none">
        
        <div className="flex items-center gap-3">
          {/* Logo brand */}
          <div className="h-10 w-10 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/15 flex items-center justify-center text-white scale-95 leading-none">
            <Scale className="w-5.5 h-5.5 animate-none" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5 leading-tight">
              Tarazu
              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-100 text-[10px] tracking-wide font-extrabold uppercase px-1.5 py-0.5 rounded">
                Smart Scale
              </span>
            </h2>
            {settings.shopName && (
              <p className="text-[10px] text-slate-400 font-bold tracking-wider truncate max-w-[150px] uppercase">
                {settings.shopName}
              </p>
            )}
          </div>
        </div>

        {/* Global Toolbar buttons */}
        <div className="flex items-center gap-2">
          {/* Bilingual selection */}
          <button
            onClick={handleLangToggle}
            id="global-btn-lang"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border dark:border-slate-800 rounded-xl transition-all cursor-pointer"
            title="Switch Language / भाषा बदलें"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-sans text-[11px] font-bold">{settings.language === 'en' ? 'हिन्दी' : 'English'}</span>
          </button>

          {/* Theme custom toggler */}
          <button
            onClick={handleThemeToggle}
            id="global-btn-theme"
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 rounded-xl transition-all cursor-pointer"
            title={settings.darkMode ? 'Light Theme' : 'Dark Theme'}
          >
            {settings.darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

      </header>

      {/* Primary Layout wrapper */}
      <div className="max-w-7xl mx-auto flex">
        
        {/* Desktop Sidebar navigation */}
        <aside className="hidden md:block w-64 bg-white dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-800/80 h-[calc(100vh-65px)] sticky top-[65px] p-4 select-none">
          <ul className="space-y-1.5">
            {navItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      setActiveSection(item.id);
                    }}
                    id={`sidebar-nav-${item.id}`}
                    className={`
                      w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all cursor-pointer
                      ${
                        active
                          ? 'bg-emerald-600 text-white font-extrabold shadow-md shadow-emerald-600/10'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850/40 hover:text-slate-850'
                      }
                    `}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="absolute bottom-5 left-5 right-5 border-t border-slate-100 dark:border-slate-850 pt-4 text-center text-[10px] text-slate-450 dark:text-slate-550 font-semibold uppercase tracking-wider">
            Tarazu Scale Pro v1.2
          </div>
        </aside>

        {/* Primary Screen viewport content container */}
        <main id="applet-main-viewport" className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 max-w-4xl mx-auto">
          {activeSection === 'dashboard' && (
            <Dashboard
              lang={settings.language}
              settings={settings}
              history={history}
              onNavigate={setActiveSection}
              onDeleteHistoryItem={handleDeleteHistoryItem}
              onClearHistory={handleClearHistory}
            />
          )}

          {activeSection === 'tarazu' && (
            <TarazuModule
              lang={settings.language}
              settings={settings}
              onAddHistoryItem={handleAddHistoryItem}
            />
          )}

          {activeSection === 'converter' && (
            <ConverterModule
              lang={settings.language}
              settings={settings}
              onAddHistoryItem={handleAddHistoryItem}
            />
          )}

          {activeSection === 'calculator' && (
            <CalculatorModule
              lang={settings.language}
              settings={settings}
              onAddHistoryItem={handleAddHistoryItem}
            />
          )}

          {activeSection === 'business' && (
            <BusinessTools
              lang={settings.language}
              settings={settings}
              onAddHistoryItem={handleAddHistoryItem}
            />
          )}

          {activeSection === 'history' && (
            <HistoryModule
              lang={settings.language}
              settings={settings}
              history={history}
              onDeleteItem={handleDeleteHistoryItem}
              onClearAll={handleClearHistory}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsModule
              lang={settings.language}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onResetAllData={handleResetData}
            />
          )}
        </main>

      </div>

      {/* Mobile Bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/50 dark:border-slate-800/80 p-2 z-40 flex justify-around select-none shadow-sm pb-safe">
        {navItems.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                playClickSound(settings.soundEnabled);
                setActiveSection(item.id);
              }}
              id={`mobile-nav-${item.id}`}
              className={`
                flex flex-col items-center justify-center p-1.5 rounded-xl transition-all cursor-pointer
                ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400 font-extrabold scale-102'
                    : 'text-slate-450 dark:text-slate-500 hover:text-slate-850'
                }
              `}
            >
              <span className={`p-1 rounded-full ${active ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[9px] font-bold mt-1 tracking-wider">{item.label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}
