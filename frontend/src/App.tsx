import { useState, useEffect } from 'react';
import React from 'react';
import { LayoutDashboard, Users, Radio, BrainCircuit, X, Target, Sun, Moon, Menu, Settings as SettingsIcon, Sparkles, Command, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';
import Dashboard from './components/Dashboard';
import Shoppers from './components/Shoppers';
import ChannelHub from './components/ChannelHub';
import AICopilot from './components/AI-Copilot';
import SegmentBuilder from './components/SegmentBuilder';
import DataIngester from './components/DataIngester';
import SettingsPage from './components/SettingsPage';
import OpportunityCenter from './components/OpportunityCenter';
import { useSettings } from './context/SettingsContext';
import { API_BASE } from './config';

export interface CampaignData {
  id: string;
  name: string;
  segmentRules: any;
  messageTemplate: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'rcs' | 'push';
  status: 'draft' | 'sending' | 'completed' | 'failed';
  createdAt: string;
  isABTest?: boolean;
  messageTemplateB?: string;
  statsB?: CampaignData['stats'];
  stats: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    opened: number;
    read: number;
    clicked: number;
    converted: number;
    revenue: number;
  };
}

export interface QueueState {
  CRM_Outbox: { size: number; processing: number };
  Channel_Webhook: { size: number; processing: number };
}

export interface LiveEvent {
  id: string;
  timestamp: string;
  type: 'message' | 'conversion';
  customerName: string;
  campaignName: string;
  status?: string;
  amount?: number;
  items?: string[];
}

interface ToastMessage {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'warning';
}

function App() {
  const { brandName, formatCurrency, formatTime } = useSettings();
  const [activePage, setActivePage] = useState<'dashboard' | 'shoppers' | 'segments' | 'channel-hub' | 'settings' | 'opportunities'>('dashboard');
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isIngesterOpen, setIsIngesterOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Responsive sidebar toggles
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Theme Management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('xeno-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    localStorage.setItem('xeno-theme', theme);
    document.documentElement.className = `${theme}-theme`;
  }, [theme]);

  // Lock body scroll under mobile drawer
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.classList.add('scroll-lock');
    } else {
      document.body.classList.remove('scroll-lock');
    }
    return () => document.body.classList.remove('scroll-lock');
  }, [isMobileDrawerOpen]);

  const handleToggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setIsMobileDrawerOpen(prev => !prev);
    } else {
      setIsSidebarExpanded(prev => !prev);
    }
  };
  
  // Data State
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [shoppersCount, setShoppersCount] = useState(0);
  const [queues, setQueues] = useState<QueueState>({
    CRM_Outbox: { size: 0, processing: 0 },
    Channel_Webhook: { size: 0, processing: 0 }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [logs, setLogs] = useState<{ id: string; time: string; tag: 'crm' | 'webhook' | 'simulator'; text: string }[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);

  // Time Machine States
  const [timeMachineSelection, setTimeMachineSelection] = useState<'today' | '7d' | '30d' | '90d'>('today');
  const [asOf, setAsOf] = useState<string>(new Date().toISOString());

  // Command Palette State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  useEffect(() => {
    const now = new Date();
    if (timeMachineSelection === '7d') {
      setAsOf(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
    } else if (timeMachineSelection === '30d') {
      setAsOf(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
    } else if (timeMachineSelection === '90d') {
      setAsOf(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString());
    } else {
      setAsOf(now.toISOString());
    }
  }, [timeMachineSelection]);

  const triggerSimulatedPurchase = async () => {
    try {
      const campRes = await fetch(`${API_BASE}/api/crm/campaigns?asOf=${asOf}`);
      const shopRes = await fetch(`${API_BASE}/api/crm/customers?asOf=${asOf}`);
      if (campRes.ok && shopRes.ok) {
        const campaignsData: CampaignData[] = await campRes.json();
        const shoppersData: any[] = await shopRes.json();
        
        if (campaignsData.length === 0) {
          showToast('Simulation Cancelled', 'No campaigns launched yet. Please launch a campaign first.', 'warning');
          return;
        }
        
        const randomCampaign = campaignsData[Math.floor(Math.random() * campaignsData.length)];
        const randomShopper = shoppersData[Math.floor(Math.random() * shoppersData.length)];
        
        const response = await fetch(`${API_BASE}/api/crm/simulated-purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: randomShopper.id,
            campaignId: randomCampaign.id
          })
        });
        
        if (response.ok) {
          showToast('Simulated Purchase', `Triggered purchase simulation for ${randomShopper.name}!`, 'success');
        } else {
          showToast('Simulation Failed', 'Could not dispatch simulated purchase.', 'warning');
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Simulation Error', 'Failed to connect to simulator.', 'warning');
    }
  };

  const commands = [
    { id: 'nav_dashboard', category: 'Navigation', name: 'Go to Dashboard', shortcut: 'G D', action: () => { setActivePage('dashboard'); setIsCommandPaletteOpen(false); } },
    { id: 'nav_opportunities', category: 'Navigation', name: 'Go to AI Opportunity Center', shortcut: 'G O', action: () => { setActivePage('opportunities'); setIsCommandPaletteOpen(false); } },
    { id: 'nav_shoppers', category: 'Navigation', name: 'Go to Shoppers Directory', shortcut: 'G S', action: () => { setActivePage('shoppers'); setIsCommandPaletteOpen(false); } },
    { id: 'nav_segments', category: 'Navigation', name: 'Go to Segment Builder', shortcut: 'G B', action: () => { setActivePage('segments'); setIsCommandPaletteOpen(false); } },
    { id: 'nav_channel_hub', category: 'Navigation', name: 'Go to System Diagnostics (Channel Hub)', shortcut: 'G H', action: () => { setActivePage('channel-hub'); setIsCommandPaletteOpen(false); } },
    { id: 'nav_settings', category: 'Navigation', name: 'Go to Settings', shortcut: 'G P', action: () => { setActivePage('settings'); setIsCommandPaletteOpen(false); } },
    { id: 'action_theme', category: 'System', name: `Toggle Theme (${theme === 'light' ? 'Dark' : 'Light'} Mode)`, shortcut: 'T T', action: () => { toggleTheme(); setIsCommandPaletteOpen(false); } },
    { id: 'action_simulate', category: 'Simulation', name: 'Simulate Customer Purchase & Attribution', shortcut: 'S M', action: () => { triggerSimulatedPurchase(); setIsCommandPaletteOpen(false); } },
    { id: 'action_time_today', category: 'Time Machine', name: 'Set Time Machine to Today', shortcut: 'T 1', action: () => { setTimeMachineSelection('today'); setIsCommandPaletteOpen(false); } },
    { id: 'action_time_7d', category: 'Time Machine', name: 'Set Time Machine to 7 Days Ago', shortcut: 'T 7', action: () => { setTimeMachineSelection('7d'); setIsCommandPaletteOpen(false); } },
    { id: 'action_time_30d', category: 'Time Machine', name: 'Set Time Machine to 30 Days Ago', shortcut: 'T 3', action: () => { setTimeMachineSelection('30d'); setIsCommandPaletteOpen(false); } },
    { id: 'action_time_90d', category: 'Time Machine', name: 'Set Time Machine to 90 Days Ago', shortcut: 'T 9', action: () => { setTimeMachineSelection('90d'); setIsCommandPaletteOpen(false); } },
    { id: 'action_reset', category: 'Danger Zone', name: 'Reset CRM Database', action: () => { 
      setIsCommandPaletteOpen(false);
      if (confirm('Reset CRM database? This will clear all tables and webhooks.')) {
        fetch(`${API_BASE}/api/crm/system/reset`, { method: 'POST' }).then(() => fetchInitialData());
      }
    } }
  ];

  // Add a log helper
  const addLog = (tag: 'crm' | 'webhook' | 'simulator', text: string) => {
    setLogs(prev => [
      {
        id: Math.random().toString(),
        time: formatTime(new Date()),
        tag,
        text
      },
      ...prev.slice(0, 199) // Limit to 200 logs
    ]);
  };

  // Toast Helper
  const showToast = (title: string, description: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const fetchInitialData = async () => {
    try {
      const campRes = await fetch(`${API_BASE}/api/crm/campaigns?asOf=${asOf}`);
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData);
      }
      
      const shopRes = await fetch(`${API_BASE}/api/crm/customers?asOf=${asOf}`);
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        setShoppersCount(shopData.length);
      }

      // Fetch existing conversions to pre-populate liveEvents stream
      const convRes = await fetch(`${API_BASE}/api/crm/conversions?asOf=${asOf}`);
      if (convRes.ok) {
        const convData = await convRes.json();
        const initialConvs = convData.map((c: any) => ({
          id: c.id,
          timestamp: formatTime(c.createdAt),
          type: 'conversion' as const,
          customerName: c.customerName,
          campaignName: c.campaignName,
          amount: c.amount,
          items: c.items
        }));
        setLiveEvents(initialConvs.slice(0, 30));
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };


  // Global key listener for Command Palette (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => {
          if (!prev) {
            setCommandQuery('');
            setSelectedCommandIndex(0);
          }
          return !prev;
        });
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchInitialData();

    // Connect to SSE stream
    console.log('[SSE] Connecting to event stream...');
    const eventSource = new EventSource(`${API_BASE}/api/crm/events/stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
      addLog('crm', 'Connected to real-time event pipeline.');
    };

    eventSource.onerror = (e) => {
      console.error('[SSE] Connection lost:', e);
      setIsConnected(false);
      addLog('crm', 'Error: Real-time event pipeline disconnected.');
    };

    // Queue updates
    eventSource.addEventListener('queue_state', (e: any) => {
      const data = JSON.parse(e.data);
      setQueues(prev => ({
        ...prev,
        [data.queueName]: { size: data.size, processing: data.processing }
      }));
      addLog('simulator', `Queue ${data.queueName} status updated: size=${data.size}, processing=${data.processing}`);
    });

    // Message progress updates
    eventSource.addEventListener('message_updated', (e: any) => {
      const data = JSON.parse(e.data);
      
      // Update campaigns to trigger reactive dashboard rendering
      setCampaigns(prev => prev.map(c => {
        if (c.id === data.campaignId) {
          const updatedStats = { ...c.stats };
          if (data.status === 'failed') {
            updatedStats.failed++;
          }
          setTimeout(fetchInitialData, 100);
        }
        return c;
      }));

      // Pipe to liveEvents
      setLiveEvents(prev => {
        const newEv: LiveEvent = {
          id: `${data.messageId}_${data.status}_${Date.now()}`,
          timestamp: formatTime(new Date()),
          type: 'message',
          customerName: data.customerName,
          campaignName: data.campaignName,
          status: data.status
        };
        return [newEv, ...prev].slice(0, 50);
      });

      addLog('crm', `CRM processed delivery receipt: Message ${data.messageId} -> ${data.status.toUpperCase()}`);
    });

    // Webhook log update
    eventSource.addEventListener('webhook_sent', (e: any) => {
      const data = JSON.parse(e.data);
      if (data.success) {
        addLog('webhook', `[Webhook Success] Dispatched message callback: ${data.messageId} is ${data.status.toUpperCase()}`);
      } else {
        addLog('webhook', `[Webhook Failure] Failed to reach CRM receipt API for ${data.messageId} (${data.status}). Retrying in ${data.retryIn / 1000}s...`);
      }
    });

    // Campaign starts
    eventSource.addEventListener('campaign_started', (e: any) => {
      const data = JSON.parse(e.data);
      fetchInitialData();
      showToast('Campaign Started', `Processing segment queue for campaign...`, 'info');
      addLog('crm', `Campaign ${data.campaignId} started. Outbox queue generated.`);
    });

    // Conversions
    eventSource.addEventListener('conversion_event', (e: any) => {
      const data = JSON.parse(e.data);
      
      // Launch Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#a855f7', '#10b981']
      });

      // Show alert toast
      showToast(
        '🎉 Sale Converted!',
        `${data.customerName} made a ${formatCurrency(data.amount)} purchase via "${data.campaignName}"!`,
        'success'
      );

      // Pipe to liveEvents
      setLiveEvents(prev => {
        const newEv: LiveEvent = {
          id: `conv_${data.customerId}_${Date.now()}`,
          timestamp: formatTime(new Date()),
          type: 'conversion',
          customerName: data.customerName,
          campaignName: data.campaignName,
          amount: data.amount,
          items: data.items
        };
        return [newEv, ...prev].slice(0, 50);
      });

      addLog('crm', `[Attribution Link] Conversion tracked: ${data.customerName} ordered: ${data.items.join(', ')} (${formatCurrency(data.amount)})`);
      fetchInitialData();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [asOf]);

  return (
    <div className={`app-shell ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'} ${isMobileDrawerOpen ? 'drawer-open' : ''}`}>
      
      {/* Mobile drawer background blur overlay mask */}
      {isMobileDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setIsMobileDrawerOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className="app-sidebar">
        <div className="sidebar-logo-container">
          <a href="#" className="sidebar-logo" onClick={(e) => e.preventDefault()}>
            <div className="logo-badge">{brandName.substring(0, 1).toUpperCase()}</div>
            <h1>{brandName.toUpperCase()}</h1>
          </a>
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="sidebar-nav">
            <li className={`sidebar-item ${activePage === 'dashboard' ? 'active' : ''}`}>
              <button onClick={() => { setActivePage('dashboard'); setIsMobileDrawerOpen(false); }}>
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </button>
            </li>
            <li className={`sidebar-item ${activePage === 'opportunities' ? 'active' : ''}`}>
              <button onClick={() => { setActivePage('opportunities'); setIsMobileDrawerOpen(false); }}>
                <Sparkles size={18} />
                <span>AI Opportunities</span>
              </button>
            </li>
            <li className={`sidebar-item ${activePage === 'shoppers' ? 'active' : ''}`}>
              <button onClick={() => { setActivePage('shoppers'); setIsMobileDrawerOpen(false); }}>
                <Users size={18} />
                <span>Shoppers</span>
              </button>
            </li>
            <li className={`sidebar-item ${activePage === 'segments' ? 'active' : ''}`}>
              <button onClick={() => { setActivePage('segments'); setIsMobileDrawerOpen(false); }}>
                <Target size={18} />
                <span>Segment Builder</span>
              </button>
            </li>
            <li className={`sidebar-item ${activePage === 'channel-hub' ? 'active' : ''}`}>
              <button onClick={() => { setActivePage('channel-hub'); setIsMobileDrawerOpen(false); }}>
                <Radio size={18} />
                <span>Channel Hub</span>
              </button>
            </li>
            <li className={`sidebar-item ${activePage === 'settings' ? 'active' : ''}`}>
              <button onClick={() => { setActivePage('settings'); setIsMobileDrawerOpen(false); }}>
                <SettingsIcon size={18} />
                <span>Settings</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="connection-status" style={{ fontSize: '0.75rem' }}>
            <span className={`dot ${isConnected ? 'dot-green' : 'dot-red'}`} />
            <span>SSE Pipeline Connected</span>
          </div>
        </div>
      </aside>

      {/* Main View Container Wrapper */}
      <div className="main-wrapper">
        {/* Top Navbar */}
        <header className="app-navbar">
          <div className="navbar-left">
            <button className="menu-toggle" onClick={handleToggleSidebar} aria-label="Toggle Navigation Sidebar">
              <Menu size={20} />
            </button>
            <div className="navbar-title">
              {activePage === 'dashboard' && `${brandName} Dashboard`}
              {activePage === 'opportunities' && 'AI Opportunity Center'}
              {activePage === 'shoppers' && 'Customer Directory'}
              {activePage === 'segments' && 'Audience Segment Builder'}
              {activePage === 'channel-hub' && 'System Diagnostics'}
              {activePage === 'settings' && 'Business Settings'}
            </div>
          </div>
          
          <div className="navbar-right">
            <div className="time-machine-container" style={{ marginRight: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} style={{ color: 'var(--accent)' }} /> Time Machine:
              </span>
              <select
                className="select-input"
                style={{ padding: '4px 8px', fontSize: '0.8rem', height: '32px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)', cursor: 'pointer', outline: 'none' }}
                value={timeMachineSelection}
                onChange={(e) => setTimeMachineSelection(e.target.value as any)}
              >
                <option value="today">Today (Live)</option>
                <option value="7d">7 Days Ago</option>
                <option value="30d">30 Days Ago</option>
                <option value="90d">90 Days Ago</option>
              </select>
            </div>

            <div className="connection-status" style={{ fontSize: '0.78rem', marginRight: '10px', display: 'flex', alignItems: 'center' }}>
              <span className={`dot ${isConnected ? 'dot-green' : 'dot-red'}`} style={{ marginRight: '6px' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{isConnected ? 'Active Event Pipeline' : 'Disconnected'}</span>
            </div>
            
            <button 
              className="btn btn-secondary" 
              onClick={() => setIsCommandPaletteOpen(true)} 
              title="Open Command Palette (⌘K)"
              style={{ padding: '6px 12px', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', minWidth: 'fit-content' }}
            >
              <Command size={14} />
              <span>Cmd+K</span>
            </button>

            <button className="theme-switch" onClick={toggleTheme} aria-label="Toggle Color Theme" style={{ height: '36px', width: '36px' }}>
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="app-main">
          {activePage === 'dashboard' && (
            <Dashboard 
              campaigns={campaigns} 
              shoppersCount={shoppersCount} 
              queues={queues}
              onNavigate={setActivePage}
              fetchData={fetchInitialData}
              liveEvents={liveEvents}
              asOf={asOf}
            />
          )}
          
          {activePage === 'opportunities' && (
            <OpportunityCenter 
              onCampaignCreated={fetchInitialData}
              showToast={showToast}
              asOf={asOf}
            />
          )}
          
          {activePage === 'shoppers' && (
            <Shoppers onOpenIngester={() => setIsIngesterOpen(true)} asOf={asOf} />
          )}

          {activePage === 'segments' && (
            <SegmentBuilder 
              onCampaignCreated={fetchInitialData}
              showToast={showToast}
              asOf={asOf}
            />
          )}
          
          {activePage === 'channel-hub' && (
            <ChannelHub 
              logs={logs} 
              queues={queues} 
              clearLogs={() => setLogs([])}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPage 
              onImportSuccess={fetchInitialData}
              showToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Floating Copilot Button */}
      <button 
        className="copilot-sidebar-trigger"
        onClick={() => setIsCopilotOpen(!isCopilotOpen)}
        aria-label="Open AI Marketing Copilot"
      >
        <BrainCircuit size={28} />
      </button>

      {/* AI Copilot Slide Drawer */}
      <AICopilot 
        isOpen={isCopilotOpen} 
        onClose={() => setIsCopilotOpen(false)} 
        onCampaignCreated={fetchInitialData}
        showToast={showToast}
      />

      {/* Data Ingestion Wizard Drawer */}
      <DataIngester 
        isOpen={isIngesterOpen}
        onClose={() => setIsIngesterOpen(false)}
        onImportSuccess={fetchInitialData}
      />

      {/* Command Palette Modal Overlay */}
      {isCommandPaletteOpen && (
        <div 
          className="command-palette-overlay" 
          onClick={() => setIsCommandPaletteOpen(false)}
        >
          <div 
            className="command-palette-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="command-palette-input-wrapper">
              <Command size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                autoFocus
                placeholder="Type a command or search page..."
                className="command-palette-input"
                value={commandQuery}
                onChange={(e) => {
                  setCommandQuery(e.target.value);
                  setSelectedCommandIndex(0);
                }}
                onKeyDown={(e) => {
                  const filtered = commands.filter(cmd => 
                    cmd.name.toLowerCase().includes(commandQuery.toLowerCase()) ||
                    cmd.category.toLowerCase().includes(commandQuery.toLowerCase())
                  );
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedCommandIndex(prev => (prev + 1) % Math.max(1, filtered.length));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedCommandIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filtered[selectedCommandIndex]) {
                      filtered[selectedCommandIndex].action();
                    }
                  }
                }}
              />
              <span className="command-palette-kbd">ESC</span>
            </div>

            <div className="command-palette-results">
              {(() => {
                const filtered = commands.filter(cmd => 
                  cmd.name.toLowerCase().includes(commandQuery.toLowerCase()) ||
                  cmd.category.toLowerCase().includes(commandQuery.toLowerCase())
                );
                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No matching commands found.
                    </div>
                  );
                }
                let lastCategory = '';
                return filtered.map((cmd, idx) => {
                  const showCategory = cmd.category !== lastCategory;
                  lastCategory = cmd.category;
                  return (
                    <React.Fragment key={cmd.id}>
                      {showCategory && (
                        <div className="command-palette-category">{cmd.category}</div>
                      )}
                      <button
                        className={`command-palette-item ${idx === selectedCommandIndex ? 'selected' : ''}`}
                        onClick={cmd.action}
                      >
                        <span className="command-palette-item-name">
                          {cmd.category === 'Navigation' && <Target size={14} />}
                          {cmd.category === 'System' && <Sun size={14} />}
                          {cmd.category === 'Simulation' && <Radio size={14} />}
                          {cmd.category === 'Danger Zone' && <X size={14} style={{ color: 'var(--rose)' }} />}
                          {cmd.name}
                        </span>
                        {cmd.shortcut && (
                          <span className="command-palette-kbd">{cmd.shortcut}</span>
                        )}
                      </button>
                    </React.Fragment>
                  );
                });
              })()}
            </div>

            <div className="command-palette-footer">
              <span>
                Use <kbd>↑</kbd> <kbd>↓</kbd> arrows to navigate, and <kbd>Enter</kbd> to select.
              </span>
              <span>
                Close with <kbd>Esc</kbd>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Banners */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 200
      }}>
        {toasts.map(t => (
          <div 
            key={t.id}
            className="glass-panel"
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              borderLeft: `4px solid ${
                t.type === 'success' ? 'var(--success)' : 
                t.type === 'warning' ? 'var(--amber)' : 
                'var(--accent)'
              }`,
              width: '320px',
              position: 'relative',
              animation: 'slide-up 0.3s ease-out'
            }}
          >
            <button 
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{t.title}</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{t.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
