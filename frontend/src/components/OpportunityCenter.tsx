import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Play, AlertTriangle, Flame, DollarSign, 
  CheckCircle2, X, ChevronDown, ChevronUp, Cpu 
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { API_BASE } from '../config';

interface Opportunity {
  id: string;
  type: 'warning' | 'hot' | 'money';
  category: string;
  title: string;
  alert: string;
  expectedRevenue: number;
  expectedConversion: number;
  recommendation: string;
  confidence: number;
  channel: 'whatsapp' | 'sms' | 'email' | 'rcs';
  discount: number;
  roi?: number;
  segmentRules: {
    minSpent?: number;
    maxSpent?: number;
    minOrders?: number;
    lastOrderDaysAgo?: number;
    customFilter?: string;
  };
  messageTemplate: string;
  campaignName: string;
}

interface OpportunityCenterProps {
  onCampaignCreated: () => void;
  showToast: (title: string, description: string, type: 'info' | 'success' | 'warning') => void;
  asOf: string;
}

const OpportunityCenter: React.FC<OpportunityCenterProps> = ({ onCampaignCreated, showToast, asOf }) => {
  const { formatCurrency } = useSettings();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'opportunities' | 'autopilot'>('opportunities');

  // Launch modal & A/B State
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isABTest, setIsABTest] = useState(false);
  const [messageTemplateB, setMessageTemplateB] = useState('');

  // Autopilot goal & A/B State
  const [goalText, setGoalText] = useState('');
  const [isAutopilotPlanning, setIsAutopilotPlanning] = useState(false);
  const [plannedCampaign, setPlannedCampaign] = useState<any | null>(null);
  const [isAutopilotDeploying, setIsAutopilotDeploying] = useState(false);
  const [autopilotIsAB, setAutopilotIsAB] = useState(false);
  const [autopilotTemplateB, setAutopilotTemplateB] = useState('');

  // Track expanded cards
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/crm/ai/opportunities?asOf=${asOf}`);
      if (response.ok) {
        const data = await response.json();
        setOpportunities(data);
      }
    } catch (err) {
      console.error('Failed to fetch AI opportunities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [asOf]);

  const handleLaunchOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpportunity || isLaunching) return;

    setIsLaunching(true);
    try {
      const payload = {
        name: selectedOpportunity.campaignName,
        segmentRules: selectedOpportunity.segmentRules,
        messageTemplate: selectedOpportunity.messageTemplate,
        channel: selectedOpportunity.channel,
        isABTest,
        messageTemplateB: isABTest ? messageTemplateB : undefined
      };

      const response = await fetch(`${API_BASE}/api/crm/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        showToast('Campaign Launched!', `Proactive outbox generated: ${result.campaign.stats.total} messages queued.`, 'success');
        onCampaignCreated();
        setSelectedOpportunity(null);
        setIsABTest(false);
        setMessageTemplateB('');
      } else {
        const err = await response.json();
        showToast('Failed to Launch', err.error || 'Server error', 'warning');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Network error', 'warning');
    } finally {
      setIsLaunching(false);
    }
  };

  const handlePlanAutopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalText.trim() || isAutopilotPlanning) return;

    setIsAutopilotPlanning(true);
    setPlannedCampaign(null);
    setAutopilotIsAB(false);
    setAutopilotTemplateB('');

    try {
      const response = await fetch(`${API_BASE}/api/crm/ai/autopilot?asOf=${asOf}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalText })
      });

      if (response.ok) {
        const data = await response.json();
        setPlannedCampaign(data);
        setAutopilotTemplateB(data.messageTemplate); // Default B to same template
      } else {
        showToast('Planning Failed', 'AI model failed to parse request goal parameters.', 'warning');
      }
    } catch (err) {
      showToast('Network Error', 'Connection failed while querying autopilot planner.', 'warning');
    } finally {
      setIsAutopilotPlanning(false);
    }
  };

  const handleDeployAutopilot = async () => {
    if (!plannedCampaign || isAutopilotDeploying) return;

    setIsAutopilotDeploying(true);
    try {
      const payload = {
        name: plannedCampaign.campaignName,
        segmentRules: plannedCampaign.segmentRules,
        messageTemplate: plannedCampaign.messageTemplate,
        channel: plannedCampaign.channel,
        isABTest: autopilotIsAB,
        messageTemplateB: autopilotIsAB ? autopilotTemplateB : undefined
      };

      const response = await fetch(`${API_BASE}/api/crm/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        showToast('Autopilot Executed!', `Deployed campaign: ${result.campaign.stats.total} messages queued successfully.`, 'success');
        onCampaignCreated();
        setPlannedCampaign(null);
        setGoalText('');
        setAutopilotIsAB(false);
        setAutopilotTemplateB('');
      } else {
        const err = await response.json();
        showToast('Autopilot Failed', err.error || 'Failed to dispatch autopilot campaign.', 'warning');
      }
    } catch (err) {
      showToast('Autopilot Error', 'Failed to connect to queue dispatch pipeline.', 'warning');
    } finally {
      setIsAutopilotDeploying(false);
    }
  };

  const getOpportunityIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={22} style={{ color: 'var(--amber)' }} />;
      case 'hot': return <Flame size={22} style={{ color: 'var(--rose)' }} />;
      case 'money': return <DollarSign size={22} style={{ color: 'var(--success)' }} />;
      default: return <Sparkles size={22} style={{ color: 'var(--primary)' }} />;
    }
  };

  // Pre-open review modal and preset message template B
  const initiateReview = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setIsABTest(false);
    setMessageTemplateB(opp.messageTemplate + '\n\nVariant B details: http://xeno.shop/special');
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>AI Opportunity Center</h2>
          <p>Autonomous background scanners generating high-confidence outreach triggers and marketing presets.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${activeTab === 'opportunities' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('opportunities')}
          >
            Proactive Opportunities
          </button>
          <button 
            className={`btn ${activeTab === 'autopilot' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('autopilot')}
            style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
          >
            <Sparkles size={14} />
            AI Autopilot
          </button>
        </div>
      </header>

      {activeTab === 'opportunities' ? (
        <>
          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '24px', height: '280px' }}>
                  <div className="skeleton-block" style={{ width: '48px', height: '48px', borderRadius: '12px', marginBottom: '16px' }} />
                  <div className="skeleton-block" style={{ width: '80%', height: '20px', borderRadius: '4px', marginBottom: '12px' }} />
                  <div className="skeleton-block" style={{ width: '100%', height: '14px', borderRadius: '4px', marginBottom: '8px' }} />
                  <div className="skeleton-block" style={{ width: '60%', height: '14px', borderRadius: '4px', marginBottom: '20px' }} />
                  <div className="skeleton-block" style={{ width: '100%', height: '40px', borderRadius: '8px' }} />
                </div>
              ))}
            </div>
          ) : opportunities.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No marketing opportunities generated. Try seeding alternative demo data presets to scan customer directories.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
              {opportunities.map(opp => {
                const isExpanded = expandedOppId === opp.id;
                return (
                  <div key={opp.id} className="glass-panel hover-border-accent" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.015)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                        {getOpportunityIcon(opp.type)}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="badge badge-completed" style={{ background: 'rgba(139, 92, 246, 0.08)', color: 'var(--accent)', fontWeight: 600 }}>
                          {opp.confidence}% Confidence
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>{opp.title}</h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{opp.alert}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-color)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                      <div>
                        <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Expected Revenue</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{formatCurrency(opp.expectedRevenue)}</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Exp. Conversion</span>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{opp.expectedConversion}%</div>
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>AI Recommended Action:</span>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{opp.recommendation}</p>
                    </div>

                    {/* Collapsible Explainability Details */}
                    <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '10px' }}>
                      <button 
                        type="button"
                        onClick={() => setExpandedOppId(isExpanded ? null : opp.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 500 }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Cpu size={12} />
                          {isExpanded ? 'Hide AI Explainability Panel' : 'Show AI Explainability Panel'}
                        </span>
                        <span style={{ marginLeft: 'auto' }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>

                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', padding: '10px', borderRadius: '8px', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4', animation: 'fade-in 150ms ease-out' }}>
                          <div>
                            <strong>Channel Explainability:</strong> {opp.channel.toUpperCase()} was selected because it delivers a {opp.channel === 'whatsapp' ? '4.4x higher click rate (22%)' : opp.channel === 'email' ? 'highly efficient dispatch ROI' : '90%+ immediate delivery rate'} for this target subgroup.
                          </div>
                          <div>
                            <strong>Audience Target Logic:</strong> Built segment parameters (Spent, Inactivity, Category filters) targeting {opp.category} with calculated low risk indices.
                          </div>
                          <div>
                            <strong>Discount Strategy:</strong> Recommended {opp.discount}% discount code optimizes conversion yield against delivery margin dilution, aiming for {opp.roi || 200}% ROI.
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      className="btn btn-primary" 
                      onClick={() => initiateReview(opp)}
                      style={{ width: '100%', marginTop: 'auto', display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', height: '40px' }}
                    >
                      <Play size={14} fill="white" />
                      Review & Launch
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px', alignItems: 'start' }}>
          {/* Autopilot Console */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <Sparkles size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Campaign Autopilot Console</h3>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.4' }}>
              Type your high-level business goal. The AI marketing agent will analyze CRM database segment splits, draft copy templates, choose channels, and configure calculations.
            </p>

            <form onSubmit={handlePlanAutopilot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                placeholder="e.g., Increase repeat coffee purchases this month with a discount, or launch VIP campaign..."
                style={{ width: '100%', height: '110px', padding: '12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem', resize: 'none' }}
                required
              />
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', height: '42px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                disabled={isAutopilotPlanning || !goalText.trim()}
              >
                {isAutopilotPlanning ? (
                  <span className="spinner" style={{ width: '16px', height: '16px' }} />
                ) : (
                  <>
                    <Sparkles size={16} />
                    Plan Campaign
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Autopilot Output */}
          <section className="glass-panel" style={{ padding: '24px', minHeight: '350px' }}>
            {isAutopilotPlanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
                <span className="spinner" style={{ width: '30px', height: '30px', borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                <p style={{ fontSize: '0.85rem' }}>AI Agent is segmenting database & compiling copy...</p>
              </div>
            ) : plannedCampaign ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>Planned Campaign Draft</h3>
                  <span className="badge badge-completed">{plannedCampaign.simulation.confidenceScore}% Confidence</span>
                </div>

                <div style={{ background: 'var(--bg-color)', padding: '14px', borderRadius: '10px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <strong>Campaign Name:</strong> {plannedCampaign.campaignName}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <strong>Channel:</strong> {plannedCampaign.channel.toUpperCase()}
                  </div>
                </div>

                {/* Simulation Panel */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)', padding: '10px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Expected Revenue</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(plannedCampaign.simulation.expectedRevenue)}</div>
                  </div>
                  <div style={{ background: 'rgba(109, 94, 247, 0.05)', border: '1px solid rgba(109, 94, 247, 0.1)', padding: '10px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Expected ROI</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>+{plannedCampaign.simulation.roi}%</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-color)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)', lineHeight: '1.4' }}>
                  <strong>AI Explanation:</strong> {plannedCampaign.simulation.reasoning}
                </div>

                {/* Autopilot A/B split configuration */}
                <div style={{ border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '12px', background: 'rgba(255, 255, 255, 0.01)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', marginBottom: autopilotIsAB ? '12px' : 0 }}>
                    <input 
                      type="checkbox" 
                      checked={autopilotIsAB} 
                      onChange={(e) => setAutopilotIsAB(e.target.checked)} 
                    />
                    Enable Campaign A/B Split Testing
                  </label>

                  {autopilotIsAB && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fade-in 150ms ease-out' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        <strong>Variant A (Original):</strong> {plannedCampaign.messageTemplate}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Variant B Template Text</label>
                        <textarea
                          required
                          value={autopilotTemplateB}
                          onChange={(e) => setAutopilotTemplateB(e.target.value)}
                          style={{ width: '100%', height: '80px', padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontSize: '0.78rem' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {!autopilotIsAB && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Outreach Message Copy:</span>
                    <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                      {plannedCampaign.messageTemplate}
                    </div>
                  </div>
                )}

                <button 
                  className="btn btn-primary" 
                  onClick={handleDeployAutopilot}
                  style={{ width: '100%', height: '44px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '10px' }}
                  disabled={isAutopilotDeploying}
                >
                  {isAutopilotDeploying ? (
                    <span className="spinner" style={{ width: '16px', height: '16px' }} />
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Approve & Deploy Campaign
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
                <Sparkles size={36} style={{ strokeWidth: 1.2 }} />
                <p style={{ fontSize: '0.85rem' }}>Autopilot strategy blueprint will display here.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Campaign Review Modal */}
      {selectedOpportunity && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 7, 16, 0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '480px', padding: '28px', background: 'var(--card-bg)', border: '1px solid var(--panel-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontFamily: 'Outfit', fontWeight: 600 }}>Review AI Opportunity Campaign</h3>
              <button onClick={() => setSelectedOpportunity(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLaunchOpportunity} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Campaign Name</label>
                <input 
                  type="text"
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                  value={selectedOpportunity.campaignName}
                  onChange={(e) => setSelectedOpportunity({ ...selectedOpportunity, campaignName: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target Channel</label>
                  <select 
                    value={selectedOpportunity.channel}
                    onChange={(e) => setSelectedOpportunity({ ...selectedOpportunity, channel: e.target.value as any })}
                    style={{ width: '100%', height: '40px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="rcs">RCS</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Confidence Score</label>
                  <div style={{ height: '40px', display: 'flex', alignItems: 'center', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--accent)', fontWeight: 600 }}>
                    {selectedOpportunity.confidence}% Accuracy
                  </div>
                </div>
              </div>

              {/* A/B Test check toggle */}
              <div style={{ border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '12px', background: 'var(--bg-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isABTest} 
                    onChange={(e) => setIsABTest(e.target.checked)} 
                  />
                  Enable Campaign A/B Split Testing
                </label>

                {isABTest && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', animation: 'fade-in 150ms ease-out' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Variant A Message Template</label>
                      <textarea 
                        required
                        style={{ width: '100%', height: '70px', padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontSize: '0.78rem' }}
                        value={selectedOpportunity.messageTemplate}
                        onChange={(e) => setSelectedOpportunity({ ...selectedOpportunity, messageTemplate: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Variant B Message Template</label>
                      <textarea 
                        required
                        style={{ width: '100%', height: '70px', padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontSize: '0.78rem' }}
                        value={messageTemplateB}
                        onChange={(e) => setMessageTemplateB(e.target.value)}
                        placeholder="Hi {{first_name}}! Enter code..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {!isABTest && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Message Template</label>
                  <textarea 
                    required
                    style={{ width: '100%', height: '110px', padding: '12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontSize: '0.85rem' }}
                    value={selectedOpportunity.messageTemplate}
                    onChange={(e) => setSelectedOpportunity({ ...selectedOpportunity, messageTemplate: e.target.value })}
                  />
                </div>
              )}

              {/* Explainability Mini Panel in Modal */}
              <div style={{ display: 'flex', gap: '8px', padding: '10px', background: 'rgba(109, 94, 247, 0.05)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                <span style={{ fontSize: '0.82rem' }}>💡</span>
                <p style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  <strong>Target Insight:</strong> Re-engages {selectedOpportunity.alert}. Estimated conversions: {selectedOpportunity.expectedConversion}%. ROI is forecast at +{selectedOpportunity.roi || 200}%.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button 
                  type="submit" 
                  disabled={isLaunching}
                  className="btn btn-primary" 
                  style={{ flex: 1, display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}
                >
                  {isLaunching ? (
                    <span className="spinner" style={{ width: '16px', height: '16px' }} />
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Queue Outreach
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setSelectedOpportunity(null)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunityCenter;
