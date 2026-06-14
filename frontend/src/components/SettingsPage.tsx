import React, { useState } from 'react';
import { Palette, Briefcase, RefreshCw } from 'lucide-react';
import { useSettings, CurrencyType, LocaleType, DateFormatType } from '../context/SettingsContext';
import { PRESETS } from '../utils/presets';
const API = import.meta.env.VITE_API_URL;

interface SettingsPageProps {
  onImportSuccess: () => void;
  showToast: (title: string, description: string, type: 'info' | 'success' | 'warning') => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onImportSuccess, showToast }) => {
  const {
    brandName,
    industry,
    currency,
    locale,
    timezone,
    dateFormat,
    updateSettings
  } = useSettings();

  const [localBrandName, setLocalBrandName] = useState(brandName);
  const [localIndustry, setLocalIndustry] = useState(industry);
  const [localCurrency, setLocalCurrency] = useState<CurrencyType>(currency);
  const [localLocale, setLocalLocale] = useState<LocaleType>(locale);
  const [localTimezone, setLocalTimezone] = useState(timezone);
  const [localDateFormat, setLocalDateFormat] = useState<DateFormatType>(dateFormat);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingPreset, setIsApplyingPreset] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      updateSettings({
        brandName: localBrandName,
        industry: localIndustry,
        currency: localCurrency,
        locale: localLocale,
        timezone: localTimezone,
        dateFormat: localDateFormat
      });
      setIsSaving(false);
      showToast('Settings Saved', 'Business branding and preferences updated successfully.', 'success');
    }, 600);
  };

  const handleApplyPreset = (key: string) => {
    setShowConfirmModal(key);
  };

  const handleApplyPresetExecution = async (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;

    setIsApplyingPreset(key);
    try {
      // 1. Reset Database
      const resetRes = await fetch(`${API}/api/crm/system/reset', { method: 'POST' });
      if (!resetRes.ok) throw new Error('Database reset failed');

      // 2. Import preset seed data
      const importRes = await fetch(`${API}/api/crm/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset.data)
      });
      if (!importRes.ok) throw new Error('Database seeding failed');

      // 3. Update Global Context
      updateSettings({
        brandName: preset.brandName,
        industry: preset.industry,
        currency: preset.currency,
        locale: preset.locale,
        timezone: preset.timezone,
        dateFormat: preset.dateFormat
      });

      // 4. Update local form fields
      setLocalBrandName(preset.brandName);
      setLocalIndustry(preset.industry);
      setLocalCurrency(preset.currency);
      setLocalLocale(preset.locale);
      setLocalTimezone(preset.timezone);
      setLocalDateFormat(preset.dateFormat);

      // 5. Trigger reload
      onImportSuccess();
      showToast('Preset Applied', `Loaded template data and settings for "${preset.name}".`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast('Seeding Failed', err.message || 'Failed to fully load preset template', 'warning');
    } finally {
      setIsApplyingPreset(null);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>Business Settings</h2>
          <p>Configure brand metadata, standard localization parameters, and template database presets.</p>
        </div>
      </header>

      <div className="analytics-row" style={{ alignItems: 'start' }}>
        
        {/* Left Side: Brand Preferences form */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <Palette size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.10rem', fontWeight: 600 }}>Preferences & Branding</h3>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Brand Name</label>
              <input
                type="text"
                required
                value={localBrandName}
                onChange={(e) => setLocalBrandName(e.target.value)}
                style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Industry Segment</label>
              <input
                type="text"
                required
                value={localIndustry}
                onChange={(e) => setLocalIndustry(e.target.value)}
                style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Default Currency</label>
                <select
                  value={localCurrency}
                  onChange={(e) => setLocalCurrency(e.target.value as CurrencyType)}
                  style={{ width: '100%', height: '42px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0 12px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="USD">🇺🇸 USD ($)</option>
                  <option value="INR">🇮🇳 INR (₹)</option>
                  <option value="EUR">🇪🇺 EUR (€)</option>
                  <option value="GBP">🇬🇧 GBP (£)</option>
                  <option value="AED">🇦🇪 AED</option>
                  <option value="SGD">🇸🇬 SGD</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Locale Settings</label>
                <select
                  value={localLocale}
                  onChange={(e) => setLocalLocale(e.target.value as LocaleType)}
                  style={{ width: '100%', height: '42px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0 12px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="de-DE">Deutsch (Germany)</option>
                  <option value="fr-FR">Français (France)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Timezone</label>
                <select
                  value={localTimezone}
                  onChange={(e) => setLocalTimezone(e.target.value)}
                  style={{ width: '100%', height: '42px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0 12px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Date Format</label>
                <select
                  value={localDateFormat}
                  onChange={(e) => setLocalDateFormat(e.target.value as DateFormatType)}
                  style={{ width: '100%', height: '42px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '0 12px', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US style)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (UK/India style)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-primary"
              style={{ width: '100%', height: '44px', borderRadius: '8px', marginTop: '10px' }}
            >
              {isSaving ? (
                <span className="spinner" style={{ width: '16px', height: '16px' }} />
              ) : (
                'Save Changes'
              )}
            </button>
          </form>
        </section>

        {/* Right Side: Presets Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <Briefcase size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.10rem', fontWeight: 600 }}>Demo Industry Presets</h3>
            </div>
            
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
              Clicking a preset automatically configures timezone, currency, and locale preferences, and overrides the CRM database with relevant industry customers and orders.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(PRESETS).map(([key, preset]) => (
                <div 
                  key={key} 
                  className="glass-panel hover-border-accent" 
                  style={{ 
                    padding: '16px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    gap: '16px',
                    background: 'rgba(255,255,255,0.01)'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{preset.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>{preset.description}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <span className="badge badge-rcs" style={{ fontSize: '0.65rem' }}>{preset.currency}</span>
                      <span className="badge badge-whatsapp" style={{ fontSize: '0.65rem' }}>{preset.timezone}</span>
                      <span className="badge badge-sms" style={{ fontSize: '0.65rem' }}>{preset.locale}</span>
                    </div>
                  </div>

                  <button 
                    disabled={isApplyingPreset !== null}
                    onClick={() => handleApplyPreset(key)}
                    className="btn btn-secondary"
                    style={{ height: '38px', whiteSpace: 'nowrap', borderRadius: '6px', display: 'flex', gap: '6px' }}
                  >
                    {isApplyingPreset === key ? (
                      <span className="spinner" style={{ width: '14px', height: '14px' }} />
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        Apply
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>

      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 16, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          animation: 'fade-in 200ms ease-out'
        }}>
          <div className="glass-panel" style={{
            width: '420px',
            padding: '28px',
            background: 'var(--card-bg)',
            border: '1px solid var(--panel-border)',
            borderRadius: '16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--text-primary)' }}>Confirm Preset Application</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Are you sure you want to load this preset? Seeding will completely reset your active CRM campaign records, customers database, and background outbox queues.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, height: '40px', background: 'var(--rose)', border: 'none', color: 'white' }}
                onClick={() => {
                  const key = showConfirmModal;
                  setShowConfirmModal(null);
                  handleApplyPresetExecution(key);
                }}
              >
                Reset & Seed
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1, height: '40px' }}
                onClick={() => setShowConfirmModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;