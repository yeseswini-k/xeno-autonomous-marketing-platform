import React, { useState } from 'react';
import { Database, FileText, CheckCircle2, AlertCircle, Play, X } from 'lucide-react';
import { PRESETS } from '../utils/presets';
import { API_BASE } from '../config';

interface DataIngesterProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

const DataIngester: React.FC<DataIngesterProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [jsonText, setJsonText] = useState(JSON.stringify(PRESETS.fashion_us.data, null, 2));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionResult, setIngestionResult] = useState<string | null>(null);

  const handlePresetSelect = (key: keyof typeof PRESETS) => {
    const dataStr = JSON.stringify(PRESETS[key].data, null, 2);
    setJsonText(dataStr);
    validateJson(dataStr);
  };

  const validateJson = (text: string) => {
    try {
      if (!text.trim()) {
        setValidationError('Input cannot be empty');
        setIsValid(false);
        return false;
      }
      const parsed = JSON.parse(text);
      if (!parsed.customers || !Array.isArray(parsed.customers)) {
        setValidationError('Missing "customers" array in root');
        setIsValid(false);
        return false;
      }
      if (parsed.orders && !Array.isArray(parsed.orders)) {
        setValidationError('"orders" key must be an array');
        setIsValid(false);
        return false;
      }
      setValidationError(null);
      setIsValid(true);
      return parsed;
    } catch (err: any) {
      setValidationError(`Invalid JSON Syntax: ${err.message}`);
      setIsValid(false);
      return false;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonText(val);
    validateJson(val);
  };

  const handleIngest = async () => {
    const parsed = validateJson(jsonText);
    if (!parsed) return;

    setIsIngesting(true);
    setIngestionResult(null);

    try {
      const response = await fetch(`${API_BASE}/api/crm/customers/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });

      if (response.ok) {
        const result = await response.json();
        setIngestionResult(result.message || 'Ingestion completed successfully.');
        setTimeout(() => {
          onImportSuccess();
          onClose();
          setIngestionResult(null);
        }, 1500);
      } else {
        const errorData = await response.json();
        setValidationError(errorData.error || 'Server error during ingestion');
      }
    } catch (err: any) {
      setValidationError(`Network Error: ${err.message}`);
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className={`drawer ${isOpen ? 'open' : ''}`} style={{ zIndex: 120, width: '500px', right: isOpen ? '0' : '-500px' }}>
      <div className="drawer-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit', fontSize: '1.25rem' }}>
          <Database size={20} className="color-blue" style={{ color: 'var(--accent)' }} />
          Data Ingestion Wizard
        </h3>
        <button className="drawer-close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Ingest new batches of shoppers and their purchasing records into the CRM. Use custom JSON or click a pre-built campaign scenario below.
        </p>

        {/* Presets Grid */}
        <div>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>Preset Scenarios</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => handlePresetSelect(key as keyof typeof PRESETS)}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--panel-border)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  width: '100%'
                }}
                className="hover-border-accent"
              >
                <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} style={{ color: 'var(--accent-blue)' }} />
                  {p.name}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{p.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Text Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: '10px' }}>JSON Payload Editor</h4>
          <textarea
            value={jsonText}
            onChange={handleTextChange}
            style={{
              flex: 1,
              width: '100%',
              background: 'rgba(5, 5, 10, 0.7)',
              border: `1px solid ${isValid ? 'var(--panel-border)' : 'var(--accent-rose)'}`,
              borderRadius: '12px',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '0.78rem',
              color: '#fff',
              outline: 'none',
              resize: 'none'
            }}
          />
        </div>

        {/* Status indicator */}
        {validationError && (
          <div style={{ display: 'flex', gap: '8px', color: 'var(--accent-rose)', background: 'rgba(244, 63, 94, 0.05)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', alignItems: 'center' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{validationError}</span>
          </div>
        )}

        {ingestionResult && (
          <div style={{ display: 'flex', gap: '8px', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', alignItems: 'center' }}>
            <CheckCircle2 size={16} />
            <span>{ingestionResult}</span>
          </div>
        )}

        <button
          onClick={handleIngest}
          disabled={!isValid || isIngesting || !!ingestionResult}
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
        >
          {isIngesting ? (
            <span className="spinner" style={{ width: '16px', height: '16px' }} />
          ) : (
            <>
              <Play size={16} fill="white" />
              <span>Validate & Run Ingestion</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DataIngester;
