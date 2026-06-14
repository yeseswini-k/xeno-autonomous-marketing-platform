import React, { createContext, useContext, useState } from 'react';
const API = import.meta.env.VITE_API_URL;

export type CurrencyType = 'USD' | 'INR' | 'EUR' | 'GBP' | 'AED' | 'SGD';
export type LocaleType = 'en-US' | 'en-IN' | 'en-GB' | 'de-DE' | 'fr-FR';
export type DateFormatType = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

export interface Settings {
  brandName: string;
  industry: string;
  currency: CurrencyType;
  locale: LocaleType;
  timezone: string;
  dateFormat: DateFormatType;
}

interface SettingsContextProps extends Settings {
  updateSettings: (newSettings: Partial<Settings>) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (dateInput: string | Date) => string;
  formatTime: (dateInput: string | Date) => string;
}

const SettingsContext = createContext<SettingsContextProps | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [brandName, setBrandName] = useState(() => localStorage.getItem('xeno-brandName') || 'Xeno CRM');
  const [industry, setIndustry] = useState(() => localStorage.getItem('xeno-industry') || 'E-commerce');
  const [currency, setCurrency] = useState<CurrencyType>(() => (localStorage.getItem('xeno-currency') as CurrencyType) || 'USD');
  const [locale, setLocale] = useState<LocaleType>(() => (localStorage.getItem('xeno-locale') as LocaleType) || 'en-US');
  const [timezone, setTimezone] = useState(() => localStorage.getItem('xeno-timezone') || 'America/New_York');
  const [dateFormat, setDateFormat] = useState<DateFormatType>(() => (localStorage.getItem('xeno-dateFormat') as DateFormatType) || 'MM/DD/YYYY');

  const updateSettings = (newSettings: Partial<Settings>) => {
    if (newSettings.brandName !== undefined) {
      setBrandName(newSettings.brandName);
      localStorage.setItem('xeno-brandName', newSettings.brandName);
    }
    if (newSettings.industry !== undefined) {
      setIndustry(newSettings.industry);
      localStorage.setItem('xeno-industry', newSettings.industry);
    }
    if (newSettings.currency !== undefined) {
      setCurrency(newSettings.currency);
      localStorage.setItem('xeno-currency', newSettings.currency);
    }
    if (newSettings.locale !== undefined) {
      setLocale(newSettings.locale);
      localStorage.setItem('xeno-locale', newSettings.locale);
    }
    if (newSettings.timezone !== undefined) {
      setTimezone(newSettings.timezone);
      localStorage.setItem('xeno-timezone', newSettings.timezone);
    }
    if (newSettings.dateFormat !== undefined) {
      setDateFormat(newSettings.dateFormat);
      localStorage.setItem('xeno-dateFormat', newSettings.dateFormat);
    }
  };

  const formatCurrency = (amount: number) => {
    const value = typeof amount === 'number' ? amount : 0;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatDate = (dateInput: string | Date) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };

    const formatter = new Intl.DateTimeFormat(locale, options);
    const parts = formatter.formatToParts(date);

    const day = parts.find(p => p.type === 'day')?.value || '';
    const month = parts.find(p => p.type === 'month')?.value || '';
    const year = parts.find(p => p.type === 'year')?.value || '';

    if (dateFormat === 'DD/MM/YYYY') {
      return `${day}/${month}/${year}`;
    } else if (dateFormat === 'YYYY-MM-DD') {
      return `${year}-${month}-${day}`;
    } else {
      return `${month}/${day}/${year}`;
    }
  };

  const formatTime = (dateInput: string | Date) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };

    const timeStr = new Intl.DateTimeFormat(locale, options).format(date);

    let tzAbbr = '';
    try {
      const parts = new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        timeZoneName: 'short'
      }).formatToParts(date);
      tzAbbr = parts.find(p => p.type === 'timeZoneName')?.value || '';
    } catch (e) {
      // Fallback
    }

    return `${timeStr} ${tzAbbr}`.trim();
  };

  return (
    <SettingsContext.Provider value={{
      brandName,
      industry,
      currency,
      locale,
      timezone,
      dateFormat,
      updateSettings,
      formatCurrency,
      formatDate,
      formatTime
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};