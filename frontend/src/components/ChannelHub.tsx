import React, { useState, useEffect } from 'react';
import { Sliders, Trash2 } from 'lucide-react';
import { QueueState } from '../App';

interface LogEntry {
  id: string;
  time: string;
  tag: 'crm' | 'webhook' | 'simulator';
  text: string;
}

interface ChannelHubProps {
  logs: LogEntry[];
  queues: QueueState;
  clearLogs: () => void;
}

const ChannelHub: React.FC<ChannelHubProps> = ({ logs, queues, clearLogs }) => {
  const [latencyMin, setLatencyMin] = useState(500);
  const [latencyMax, setLatencyMax] = useState(2000);
  const [successRate, setSuccessRate] = useState(0.95);
  const [openRate, setOpenRate] = useState(0.70);
  const [clickRate, setClickRate] = useState(0.30);
  const [conversionRate, setConversionRate] = useState(0.15);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current simulator config
  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/channel/config');
      if (response.ok) {
        const config = await response.json();
        setLatencyMin(config.latencyMin);
        setLatencyMax(config.latencyMax);
        setSuccessRate(config.successRate);
        setOpenRate(config.openRate);
        setClickRate(config.clickRate);
        setConversionRate(config.conversionRate);
      }
    } catch (err) {
      console.error('Failed to fetch simulator config:', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch('/api/channel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latencyMin,
          latencyMax: Math.max(latencyMin, latencyMax), // Max must be >= Min
          successRate,
          openRate,
          clickRate,
          conversionRate
        })
      });
      if (response.ok) {
        setIsSaving(false);
      }
    } catch (err) {
      console.error('Failed to update config:', err);
      setIsSaving(false);
    }
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'webhook': return 'tag-webhook';
      case 'crm': return 'tag-crm';
      case 'simulator': return 'tag-simulator';
      default: return '';
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>System Diagnostics</h2>
          <p>Tweak simulated SMS/WhatsApp channel latency, carrier failures, and trace webhook callback queues.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '30px', alignItems: 'start' }}>
        {/* Left Side: Simulator Controls */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <Sliders size={20} className="color-blue" style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Simulator Control Panel</h3>
          </div>

          <form onSubmit={handleSaveConfig}>
            {/* Latency sliders */}
            <div className="config-group">
              <label>
                <span>Min Dispatch Latency</span>
                <span>{latencyMin}ms</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="5000" 
                step="100"
                value={latencyMin} 
                onChange={(e) => setLatencyMin(Number(e.target.value))}
              />
            </div>

            <div className="config-group">
              <label>
                <span>Max Dispatch Latency</span>
                <span>{latencyMax}ms</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="10000" 
                step="100"
                value={latencyMax} 
                onChange={(e) => setLatencyMax(Number(e.target.value))}
              />
            </div>

            {/* Probability sliders */}
            <div className="config-group">
              <label>
                <span>Gateway Success Rate</span>
                <span>{(successRate * 100).toFixed(0)}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={successRate} 
                onChange={(e) => setSuccessRate(Number(e.target.value))}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Decrease to force network failures and trigger CRM outbox retries.
              </span>
            </div>

            <div className="config-group">
              <label>
                <span>Simulated Open Rate</span>
                <span>{(openRate * 100).toFixed(0)}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={openRate} 
                onChange={(e) => setOpenRate(Number(e.target.value))}
              />
            </div>

            <div className="config-group">
              <label>
                <span>Simulated Click Rate</span>
                <span>{(clickRate * 100).toFixed(0)}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={clickRate} 
                onChange={(e) => setClickRate(Number(e.target.value))}
              />
            </div>

            <div className="config-group">
              <label>
                <span>Conversion Attribution Rate</span>
                <span>{(conversionRate * 100).toFixed(0)}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01"
                value={conversionRate} 
                onChange={(e) => setConversionRate(Number(e.target.value))}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={isSaving}>
              {isSaving ? <span className="spinner" /> : 'Apply Parameters'}
            </button>
          </form>
        </section>

        {/* Right Side: Queues & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Queue Health panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>CRM Send Queue</span>
                <span className={`badge ${queues.CRM_Outbox.size > 0 ? 'badge-sending' : 'badge-completed'}`}>
                  {queues.CRM_Outbox.size > 0 ? 'Processing' : 'Idle'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '12px' }}>
                <h4 style={{ fontSize: '1.8rem', fontFamily: 'Outfit' }}>{queues.CRM_Outbox.size}</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>buffered jobs</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Active dispatch worker threads: {queues.CRM_Outbox.processing}
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Webhook Callback Queue</span>
                <span className={`badge ${queues.Channel_Webhook.size > 0 ? 'badge-sending' : 'badge-completed'}`}>
                  {queues.Channel_Webhook.size > 0 ? 'Retrying' : 'Idle'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '12px' }}>
                <h4 style={{ fontSize: '1.8rem', fontFamily: 'Outfit' }}>{queues.Channel_Webhook.size}</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>retries scheduled</span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Active network listener threads: {queues.Channel_Webhook.processing}
              </p>
            </div>
          </div>

          {/* Logging stream console */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Real-time Gateway Logs</h3>
              <button className="btn btn-ghost" onClick={clearLogs} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                <Trash2 size={14} />
                Clear
              </button>
            </div>

            <div className="log-container">
              {logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                  Pipeline idle. Webhook receipt logs will stream here.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="log-line">
                    <span className="log-line-time">[{log.time}]</span>
                    <span className={`log-line-tag ${getTagColor(log.tag)}`}>{log.tag.toUpperCase()}</span>
                    <span>{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ChannelHub;
