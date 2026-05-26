import React, { useState, useEffect } from 'react';
import { RefreshCw, MapPin, Scale, ChevronRight, DollarSign, Percent, Calculator, FileCheck, CheckCircle } from 'lucide-react';
import { Language, HistoryItem, AppSettings, HistoryItemInput } from '../types';
import { translate } from '../i18n';
import { playClickSound, playSuccessSound } from '../utils/audio';

interface ConverterModuleProps {
  lang: Language;
  settings: AppSettings;
  onAddHistoryItem: (item: HistoryItemInput) => void;
}

export default function ConverterModule({
  lang,
  settings,
  onAddHistoryItem,
}: ConverterModuleProps) {
  const t = translate(lang);
  
  // Tabs: 'weight' | 'length' | 'land' | 'volume' | 'business_tools'
  const [activeTab, setActiveTab] = useState<'weight' | 'length' | 'land' | 'volume' | 'business_tools'>('weight');

  // Input states
  const [inputValue, setInputValue] = useState('10');
  
  // Land states
  const [selectedState, setSelectedState] = useState<'bihar' | 'jharkhand' | 'up' | 'wb'>('bihar');
  const [landFromUnit, setLandFromUnit] = useState<string>('katha');
  
  // General conversions To/From selectors
  const [fromUnit, setFromUnit] = useState('kg');
  const [toUnit, setToUnit] = useState('g');

  // Business Sub-tools states
  const [bizTool, setBizTool] = useState<'discount' | 'gst' | 'price_qty'>('discount');
  
  // Discount states
  const [originalPrice, setOriginalPrice] = useState('1200');
  const [discountPercent, setDiscountPercent] = useState('15');
  
  // GST States
  const [gstBasePrice, setGstBasePrice] = useState('1000');
  const [gstPercent, setGstPercent] = useState('18');
  const [gstMode, setGstMode] = useState<'add' | 'remove'>('add');

  // Price & Quantity States
  const [unitPrice, setUnitPrice] = useState('45');
  const [quantity, setQuantity] = useState('12');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Conversion definitions (Standard weights relative to KG)
  const WEIGHT_MAP: Record<string, number> = {
    kg: 1,
    g: 0.001,
    mg: 0.000001,
    quintal: 100,
    ton: 1000,
    lb: 0.45359237,
    oz: 0.02834952,
  };

  const WEIGHT_LABELS_EN: Record<string, string> = {
    kg: 'Kilogram (KG)',
    g: 'Gram (G)',
    mg: 'Milligram (MG)',
    quintal: 'Quintal',
    ton: 'Metric Ton',
    lb: 'Pound (LB)',
    oz: 'Ounce (OZ)',
  };

  const WEIGHT_LABELS_HI: Record<string, string> = {
    kg: 'किलोग्राम (KG)',
    g: 'ग्राम (G)',
    mg: 'मिलीग्राम (MG)',
    quintal: 'क्विंटल',
    ton: 'मीट्रिक टन',
    lb: 'पाउंड (LB)',
    oz: 'औंस (OZ)',
  };

  // Length definitions relative to Meter
  const LENGTH_MAP: Record<string, number> = {
    m: 1,
    cm: 0.01,
    mm: 0.001,
    km: 1000,
    ft: 0.3048,
    inch: 0.0254,
    yard: 0.9144,
    mile: 1609.344,
  };

  const LENGTH_LABELS_EN: Record<string, string> = {
    m: 'Meter (m)',
    cm: 'Centimeter (cm)',
    mm: 'Millimeter (mm)',
    km: 'Kilometer (km)',
    ft: 'Foot (ft)',
    inch: 'Inch (in)',
    yard: 'Yard',
    mile: 'Mile',
  };

  // Land Conversions Engine
  // Factor details: values represent Square Feet equivalent of 1 unit
  const getLandFactors = (state: 'bihar' | 'jharkhand' | 'up' | 'wb') => {
    switch (state) {
      case 'bihar':
      case 'jharkhand':
        return {
          sqfeet: 1,
          sqmeter: 10.7639,
          sqyard: 9,
          acre: 43560,
          hectare: 107639,
          bigha: 27225,  // standard 5.5 laghi
          katha: 1361.25,
          dhur: 68.0625,
          decimal: 435.6,
        };
      case 'up':
        return {
          sqfeet: 1,
          sqmeter: 10.7639,
          sqyard: 9,
          acre: 43560,
          hectare: 107639,
          bigha: 27225,  // standard pucca bigha
          katha: 1361.25, // Biswa
          dhur: 68.0625,  // Biswansi
          decimal: 435.6,
        };
      case 'wb':
        return {
          sqfeet: 1,
          sqmeter: 10.7639,
          sqyard: 9,
          acre: 43560,
          hectare: 107639,
          bigha: 14400, // West Bengal standard bigha
          katha: 720,
          dhur: 36,
          decimal: 435.6,
        };
    }
  };

  const LAND_LABELS: Record<string, string> = {
    sqfeet: 'Sq. Feet',
    sqmeter: 'Sq. Meter',
    sqyard: 'Sq. Yard',
    acre: 'Acre',
    hectare: 'Hectare',
    bigha: 'Bigha (बीघा)',
    katha: 'Katha (कट्ठा / बिस्वा)',
    dhur: 'Dhur (धूर / बिस्वांसी)',
    decimal: 'Decimal (डिसमिल)',
  };

  // Volume definitions relative to Liter
  const VOLUME_MAP: Record<string, number> = {
    l: 1,
    ml: 0.001,
    gallon: 3.78541,
    cum: 1000,
  };

  const VOLUME_LABELS_EN: Record<string, string> = {
    l: 'Liter (L)',
    ml: 'Milliliter (ml)',
    gallon: 'Gallon (Gal)',
    cum: 'Cubic Meter (m³)',
  };

  // Run Calculations
  const performWeightConversions = () => {
    const val = parseFloat(inputValue) || 0;
    if (val <= 0) return [];
    
    // Convert input base standard to KG
    const toKgFactor = WEIGHT_MAP[fromUnit];
    const baseKgVal = val * toKgFactor;

    return Object.keys(WEIGHT_MAP).map((unit) => {
      const fromKgFactor = WEIGHT_MAP[unit];
      const resultVal = baseKgVal / fromKgFactor;
      return {
        unit,
        label: lang === 'hi' ? WEIGHT_LABELS_HI[unit] : WEIGHT_LABELS_EN[unit],
        value: resultVal,
      };
    });
  };

  const performLengthConversions = () => {
    const val = parseFloat(inputValue) || 0;
    if (val <= 0) return [];

    const toMeterFactor = LENGTH_MAP[fromUnit];
    const baseMeterVal = val * toMeterFactor;

    return Object.keys(LENGTH_MAP).map((unit) => {
      const fromMeterFactor = LENGTH_MAP[unit];
      const resultVal = baseMeterVal / fromMeterFactor;
      return {
        unit,
        label: LENGTH_LABELS_EN[unit],
        value: resultVal,
      };
    });
  };

  const performLandConversions = () => {
    const val = parseFloat(inputValue) || 0;
    if (val <= 0) return [];

    const factors = getLandFactors(selectedState);
    const toSqFeetFactor = factors[landFromUnit as keyof typeof factors];
    const baseSqFeetVal = val * toSqFeetFactor;

    return Object.keys(factors).map((unit) => {
      const divisor = factors[unit as keyof typeof factors];
      const resultVal = baseSqFeetVal / divisor;
      return {
        unit,
        label: LAND_LABELS[unit] || unit,
        value: resultVal,
      };
    });
  };

  const performVolumeConversions = () => {
    const val = parseFloat(inputValue) || 0;
    if (val <= 0) return [];

    const toLiterFactor = VOLUME_MAP[fromUnit];
    const baseLiterVal = val * toLiterFactor;

    return Object.keys(VOLUME_MAP).map((unit) => {
      const fromLiterFactor = VOLUME_MAP[unit];
      const resultVal = baseLiterVal / fromLiterFactor;
      return {
        unit,
        label: VOLUME_LABELS_EN[unit],
        value: resultVal,
      };
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    playSuccessSound(settings.soundEnabled);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const triggerSaveToHistory = (label: string) => {
    playSuccessSound(settings.soundEnabled);
    
    // Package description and inputs
    onAddHistoryItem({
      type: 'converter',
      category: activeTab,
      inputValue: parseFloat(inputValue) || 0,
      inputUnit: fromUnit,
      results: [],
      label: label,
    });
  };

  // Effect resets selectors on tab change to match unit lists
  useEffect(() => {
    if (activeTab === 'weight') {
      setFromUnit('kg');
      setToUnit('g');
    } else if (activeTab === 'length') {
      setFromUnit('m');
      setToUnit('cm');
    } else if (activeTab === 'volume') {
      setFromUnit('l');
      setToUnit('ml');
    } else if (activeTab === 'land') {
      setInputValue('1');
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Category Subtabs navigation */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl overflow-x-auto gap-1 scrollbar-none border border-slate-200 dark:border-slate-800">
        {[
          { id: 'weight', label: t('weightConv'), icon: '⚖️' },
          { id: 'length', label: t('lengthConv'), icon: '📏' },
          { id: 'land', label: t('areaConv'), icon: '🌾' },
          { id: 'volume', label: t('volumeConv'), icon: '🧪' },
          { id: 'business_tools', label: t('bizConv'), icon: '💼' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              playClickSound(settings.soundEnabled);
              setActiveTab(tab.id as any);
            }}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer
              ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Main Grid Converter layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left column: Inputs configuration */}
        <div className="md:col-span-5 space-y-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
          
          {/* Custom state selection for Land conversions */}
          {activeTab === 'land' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                {t('selectState')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'bihar', name: t('stateBihar') },
                  { id: 'jharkhand', name: t('stateJharkhand') },
                  { id: 'up', name: t('stateUP') },
                  { id: 'wb', name: t('stateWB') },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      setSelectedState(st.id as any);
                    }}
                    className={`
                      py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer
                      ${
                        selectedState === st.id
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 text-slate-600 dark:text-slate-400'
                      }
                    `}
                  >
                    {st.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Business tools options */}
          {activeTab === 'business_tools' ? (
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Select business quick-tool
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'discount', label: 'Discount %', icon: <Percent className="w-3.5 h-3.5" /> },
                  { id: 'gst', label: 'GST Calc', icon: <Calculator className="w-3.5 h-3.5" /> },
                  { id: 'price_qty', label: 'Qty × Price', icon: <DollarSign className="w-3.5 h-3.5" /> },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      playClickSound(settings.soundEnabled);
                      setBizTool(tool.id as any);
                    }}
                    className={`
                      py-3 px-1 rounded-xl text-[10px] font-bold border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer
                      ${
                        bizTool === tool.id
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 text-slate-600 dark:text-slate-400'
                      }
                    `}
                  >
                    {tool.icon}
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>

              {/* Sub components inside business tab */}
              {bizTool === 'discount' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Original Retail Price (₹)</label>
                    <input
                      type="number"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      className="w-full text-lg font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 dark:bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Discount Coupon (%)</label>
                    <input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="w-full text-lg font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 dark:bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900">
                    <div className="flex justify-between items-center text-sm font-semibold">
                      <span>Discount Saved:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        ₹{((parseFloat(originalPrice) || 0) * (parseFloat(discountPercent) || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-base font-bold mt-2 pt-2 border-t border-dashed border-emerald-200">
                      <span>Payable Price:</span>
                      <span className="font-mono text-emerald-800 dark:text-emerald-300 text-lg">
                        ₹{((parseFloat(originalPrice) || 0) - ((parseFloat(originalPrice) || 0) * (parseFloat(discountPercent) || 0) / 100)).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const finalVal = (parseFloat(originalPrice) || 0) - ((parseFloat(originalPrice) || 0) * (parseFloat(discountPercent) || 0) / 100);
                      triggerSaveToHistory(`Disc: ₹${originalPrice} - ${discountPercent}% = ₹${finalVal.toFixed(2)}`);
                    }}
                    className="w-full text-xs py-2 bg-slate-800 text-white rounded-lg font-bold"
                  >
                    Save Coupon to Ledger
                  </button>
                </div>
              )}

              {bizTool === 'gst' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="flex p-0.5 bg-slate-100 rounded-lg border">
                    <button
                      onClick={() => setGstMode('add')}
                      className={`flex-1 text-[11px] py-1.5 rounded font-bold ${gstMode === 'add' ? 'bg-white shadow' : 'text-slate-500'}`}
                    >
                      {t('addGst')}
                    </button>
                    <button
                      onClick={() => setGstMode('remove')}
                      className={`flex-1 text-[11px] py-1.5 rounded font-bold ${gstMode === 'remove' ? 'bg-white shadow' : 'text-slate-500'}`}
                    >
                      {t('removeGst')}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">{t('baseAmt')}</label>
                    <input
                      type="number"
                      value={gstBasePrice}
                      onChange={(e) => setGstBasePrice(e.target.value)}
                      className="w-full text-lg font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 dark:bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">{t('gstType')}</label>
                    <select
                      value={gstPercent}
                      onChange={(e) => setGstPercent(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 dark:bg-slate-900 rounded-lg font-bold text-sm"
                    >
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>

                  {(() => {
                    const price = parseFloat(gstBasePrice) || 0;
                    const gst = parseFloat(gstPercent) || 0;
                    let gstAmount = 0;
                    let finalPrice = 0;

                    if (gstMode === 'add') {
                      gstAmount = price * (gst / 100);
                      finalPrice = price + gstAmount;
                    } else {
                      finalPrice = price / (1 + gst / 100);
                      gstAmount = price - finalPrice;
                    }

                    return (
                      <div className="bg-slate-50 p-4 border rounded-xl space-y-2 dark:bg-slate-950/20">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Base Amount:</span>
                          <span>₹{gstMode === 'add' ? price.toFixed(2) : finalPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>CGST (50% Split):</span>
                          <span>₹{(gstAmount / 2).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>SGST (50% Split):</span>
                          <span>₹{(gstAmount / 2).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-slate-200/50">
                          <span>{t('totalPriceGst')}:</span>
                          <span>₹{gstMode === 'add' ? finalPrice.toFixed(2) : price.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => {
                      const price = parseFloat(gstBasePrice) || 0;
                      const gst = parseFloat(gstPercent) || 0;
                      const phrase = gstMode === 'add' ? `+${gst}% GST` : `-${gst}% GST`;
                      triggerSaveToHistory(`${phrase} on ₹${price} Audit Logged`);
                    }}
                    className="w-full text-xs py-2 bg-slate-800 text-white rounded-lg font-bold"
                  >
                    Save GST Record
                  </button>
                </div>
              )}

              {bizTool === 'price_qty' && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Rate / Unit Price (₹)</label>
                    <input
                      type="number"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      className="w-full text-lg font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 dark:bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Purchased Quantity / Piece (Qty)</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full text-lg font-mono font-bold p-2.5 bg-slate-50 border border-slate-200 dark:bg-slate-900 rounded-lg"
                    />
                  </div>

                  <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900">
                    <div className="flex justify-between items-center text-base font-bold text-slate-800 dark:text-slate-200">
                      <span>Total Invoice:</span>
                      <span className="font-mono text-emerald-800 dark:text-emerald-300 text-lg">
                        ₹{( (parseFloat(unitPrice) || 0) * (parseFloat(quantity) || 0) ).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const tot = (parseFloat(unitPrice) || 0) * (parseFloat(quantity) || 0);
                      triggerSaveToHistory(`${quantity} Pcs × ₹${unitPrice} = ₹${tot.toFixed(2)}`);
                    }}
                    className="w-full text-xs py-2 bg-slate-800 text-white rounded-lg font-bold animate-none"
                  >
                    Save Invoice to Ledger
                  </button>
                </div>
              )}

            </div>
          ) : (
            /* Custom values for non business conversions */
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  {t('value')}
                </label>
                <input
                  type="number"
                  step="any"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-lg font-bold rounded-xl"
                  placeholder="0.0"
                />
              </div>

              {activeTab !== 'land' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                      {t('fromUnit')}
                    </label>
                    <select
                      value={fromUnit}
                      onChange={(e) => setFromUnit(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold rounded-xl text-sm"
                    >
                      {activeTab === 'weight' &&
                        Object.keys(WEIGHT_MAP).map((u) => (
                          <option key={u} value={u}>
                            {lang === 'hi' ? WEIGHT_LABELS_HI[u] : WEIGHT_LABELS_EN[u]}
                          </option>
                        ))}
                      {activeTab === 'length' &&
                        Object.keys(LENGTH_MAP).map((u) => (
                          <option key={u} value={u}>
                            {LENGTH_LABELS_EN[u]}
                          </option>
                        ))}
                      {activeTab === 'volume' &&
                        Object.keys(VOLUME_MAP).map((u) => (
                          <option key={u} value={u}>
                            {VOLUME_LABELS_EN[u]}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                      {t('toUnit')}
                    </label>
                    <select
                      value={toUnit}
                      onChange={(e) => setToUnit(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold rounded-xl text-sm"
                    >
                      {activeTab === 'weight' &&
                        Object.keys(WEIGHT_MAP).map((u) => (
                          <option key={u} value={u}>
                            {lang === 'hi' ? WEIGHT_LABELS_HI[u] : WEIGHT_LABELS_EN[u]}
                          </option>
                        ))}
                      {activeTab === 'length' &&
                        Object.keys(LENGTH_MAP).map((u) => (
                          <option key={u} value={u}>
                            {LENGTH_LABELS_EN[u]}
                          </option>
                        ))}
                      {activeTab === 'volume' &&
                        Object.keys(VOLUME_MAP).map((u) => (
                          <option key={u} value={u}>
                            {VOLUME_LABELS_EN[u]}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'land' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                    {t('fromUnit')}
                  </label>
                  <select
                    value={landFromUnit}
                    onChange={(e) => setLandFromUnit(e.target.value)}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold rounded-xl text-sm"
                  >
                    {Object.keys(LAND_LABELS).map((u) => (
                      <option key={u} value={u}>
                        {LAND_LABELS[u]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab !== 'land' && (() => {
                const map = activeTab === 'weight' ? WEIGHT_MAP : activeTab === 'length' ? LENGTH_MAP : VOLUME_MAP;
                const labels = activeTab === 'weight' ? (lang === 'hi' ? WEIGHT_LABELS_HI : WEIGHT_LABELS_EN) : activeTab === 'length' ? LENGTH_LABELS_EN : VOLUME_LABELS_EN;
                
                const val = parseFloat(inputValue) || 0;
                const srcFactor = map[fromUnit];
                const destFactor = map[toUnit];
                const converted = (val * srcFactor) / destFactor;

                return (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900 flex justify-between items-center text-sm">
                    <span className="font-semibold text-emerald-800 dark:text-emerald-300">Quick Result:</span>
                    <span className="font-mono text-emerald-900 dark:text-white font-extrabold text-base">
                      {converted.toLocaleString(undefined, { maximumFractionDigits: settings.decimalPrecision })} {toUnit.toUpperCase()}
                    </span>
                  </div>
                );
              })()}

              <button
                onClick={() => {
                  if (activeTab === 'land') {
                    const factors = getLandFactors(selectedState);
                    const parsedInput = parseFloat(inputValue) || 0;
                    triggerSaveToHistory(
                      `Land: ${parsedInput} ${LAND_LABELS[landFromUnit]} (${selectedState.toUpperCase()}) Conversion`
                    );
                  } else {
                    const map = activeTab === 'weight' ? WEIGHT_MAP : activeTab === 'length' ? LENGTH_MAP : VOLUME_MAP;
                    const val = parseFloat(inputValue) || 0;
                    const resVal = (val * map[fromUnit]) / map[toUnit];
                    triggerSaveToHistory(
                      `Convert: ${val} ${fromUnit.toUpperCase()} = ${resVal.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${toUnit.toUpperCase()}`
                    );
                  }
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs uppercase"
              >
                <FileCheck className="w-4 h-4" /> Save Conversion to Ledger
              </button>
            </div>
          )}

        </div>

        {/* Right column: Results list grid */}
        <div className="md:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 animate-none" />
            {t('convertedAllUnits')}
          </h3>

          {activeTab === 'business_tools' ? (
            <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 border border-slate-100 border-dashed rounded-xl">
              <span className="text-4xl mb-3">📈</span>
              <p className="text-sm font-semibold">Business utilities generate individual invoice line items on save.</p>
              <p className="text-xs text-slate-500 mt-1">Audit logs can be exported anytime via settings.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-[420px] overflow-y-auto pr-1">
              {(() => {
                const results =
                  activeTab === 'weight'
                    ? performWeightConversions()
                    : activeTab === 'length'
                    ? performLengthConversions()
                    : activeTab === 'volume'
                    ? performVolumeConversions()
                    : performLandConversions();

                if (results.length === 0) {
                  return (
                    <div className="col-span-2 text-center text-slate-400 text-xs py-10">
                      Enter a positive value to start calculating!
                    </div>
                  );
                }

                return results.map((res) => {
                  const formattedValue = res.value.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  });

                  return (
                    <div
                      key={res.unit}
                      onClick={() => copyToClipboard(String(res.value), res.unit)}
                      className="p-3 bg-slate-50 dark:bg-slate-900 hover:bg-emerald-50/40 border border-slate-100 dark:border-slate-800 rounded-xl cursor-pointer transition-all flex flex-col justify-between group h-[76px]"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] uppercase font-bold text-slate-400 pr-2 truncate">
                          {res.label}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {copiedId === res.unit ? (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-450" />
                          )}
                        </span>
                      </div>
                      <p className="font-mono text-lg font-bold text-slate-800 dark:text-emerald-100 truncate mt-1">
                        {formattedValue}
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
