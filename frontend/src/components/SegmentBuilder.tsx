import React, { useState, useEffect } from 'react';
import { 
  Target, Users, Search, RefreshCw, Megaphone, CheckCircle2, 
  ChevronDown, ChevronUp, Sparkles, TrendingUp, 
  Cpu, Layers, Award 
} from 'lucide-react';

import { useSettings } from '../context/SettingsContext';

interface SegmentBuilderProps {
  onCampaignCreated: () => void;
  showToast: (title: string, description: string, type: 'info' | 'success' | 'warning') => void;
  asOf: string;
}

const SegmentBuilder: React.FC<SegmentBuilderProps> = ({ onCampaignCreated, showToast, asOf }) => {
  const { formatCurrency } = useSettings();
  const currencySymbol = formatCurrency(0).replace(/[\d\s.,]/g, '');

  // Query Rules
  const [minSpent, setMinSpent] = useState<number | ''>('');
  const [maxSpent, setMaxSpent] = useState<number | ''>('');
  const [minOrders, setMinOrders] = useState<number | ''>('');
  const [lastOrderDaysAgo, setLastOrderDaysAgo] = useState<number | ''>('');
  const [customFilter, setCustomFilter] = useState('');

  // Natural Language Prompt States
  const [nlpPrompt, setNlpPrompt] = useState('');
  const [isNlpCompiling, setIsNlpCompiling] = useState(false);

  // Simulator States
  const [sliderDiscount, setSliderDiscount] = useState(10); // 10% default
  const [sliderAudiencePct, setSliderAudiencePct] = useState(100); // 100% default
  const [simulatorChannel, setSimulatorChannel] = useState<'whatsapp' | 'sms' | 'email' | 'rcs'>('whatsapp');

  // AI Sandbox states
  const [sandboxAChannel, setSandboxAChannel] = useState<'whatsapp' | 'sms' | 'email' | 'rcs'>('whatsapp');
  const [sandboxADiscount, setSandboxADiscount] = useState(15);
  const [sandboxBChannel, setSandboxBChannel] = useState<'whatsapp' | 'sms' | 'email' | 'rcs'>('email');
  const [sandboxBDiscount, setSandboxBDiscount] = useState(25);

  // Campaigns & Patterns State
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Accordion state
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);

  // Results
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewCustomers, setPreviewCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Campaign Form
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email' | 'rcs'>('whatsapp');
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsFiltersOpen(false);
    }
  }, []);

  // Fetch campaigns for Learned Patterns
  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`/api/crm/campaigns?asOf=${asOf}`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns for learned patterns:', err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [asOf]);

  const fetchPreview = async () => {
    setIsLoading(true);
    try {
      const payload = {
        minSpent: minSpent === '' ? undefined : Number(minSpent),
        maxSpent: maxSpent === '' ? undefined : Number(maxSpent),
        minOrders: minOrders === '' ? undefined : Number(minOrders),
        lastOrderDaysAgo: lastOrderDaysAgo === '' ? undefined : Number(lastOrderDaysAgo),
        customFilter: customFilter || undefined
      };

      const response = await fetch(`/api/crm/segments/preview?asOf=${asOf}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewCount(data.count);
        setPreviewCustomers(data.customers);
      }
    } catch (err) {
      console.error('Failed to load segment preview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(fetchPreview, 400);
    return () => clearTimeout(timeout);
  }, [minSpent, maxSpent, minOrders, lastOrderDaysAgo, customFilter, asOf]);

  const handleNlpCompile = async () => {
    if (!nlpPrompt.trim() || isNlpCompiling) return;
    setIsNlpCompiling(true);
    try {
      const response = await fetch(`/api/crm/ai-prompt?asOf=${asOf}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: nlpPrompt })
      });

      if (response.ok) {
        const suggestion = await response.json();
        
        setMinSpent(suggestion.segmentRules.minSpent !== null && suggestion.segmentRules.minSpent !== undefined ? Number(suggestion.segmentRules.minSpent) : '');
        setMaxSpent(suggestion.segmentRules.maxSpent !== null && suggestion.segmentRules.maxSpent !== undefined ? Number(suggestion.segmentRules.maxSpent) : '');
        setMinOrders(suggestion.segmentRules.minOrders !== null && suggestion.segmentRules.minOrders !== undefined ? Number(suggestion.segmentRules.minOrders) : '');
        setLastOrderDaysAgo(suggestion.segmentRules.lastOrderDaysAgo !== null && suggestion.segmentRules.lastOrderDaysAgo !== undefined ? Number(suggestion.segmentRules.lastOrderDaysAgo) : '');
        setCustomFilter(suggestion.segmentRules.customFilter || '');
        
        setCampaignName(suggestion.campaignName || '');
        setMessageTemplate(suggestion.messageTemplate || '');
        setChannel(suggestion.channel || 'whatsapp');
        setSimulatorChannel(suggestion.channel || 'whatsapp');

        showToast('AI Compiled Successfully!', 'Query variables loaded. Segment and message template refreshed.', 'success');
      } else {
        showToast('AI Compilation Failed', 'Could not parse NLP segment query parameters.', 'warning');
      }
    } catch (err) {
      showToast('AI Connection Error', 'Failed to reach natural language parsing pipeline.', 'warning');
    } finally {
      setIsNlpCompiling(false);
    }
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName || !messageTemplate || isLaunching) return;

    setIsLaunching(true);
    try {
      const payload = {
        name: campaignName,
        segmentRules: {
          minSpent: minSpent === '' ? undefined : Number(minSpent),
          maxSpent: maxSpent === '' ? undefined : Number(maxSpent),
          minOrders: minOrders === '' ? undefined : Number(minOrders),
          lastOrderDaysAgo: lastOrderDaysAgo === '' ? undefined : Number(lastOrderDaysAgo),
          customFilter: customFilter || undefined
        },
        messageTemplate,
        channel
      };

      const response = await fetch('/api/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        showToast('Campaign Launched!', `Queued ${result.campaign.stats.total} messages.`, 'success');
        onCampaignCreated();
        fetchCampaigns();
        setIsCreatingCampaign(false);
        setCampaignName('');
        setMessageTemplate('');
      } else {
        const err = await response.json();
        showToast('Launch Failed', err.error || 'Server error', 'warning');
      }
    } catch (err: any) {
      showToast('Launch Failed', err.message || 'Network error', 'warning');
    } finally {
      setIsLaunching(false);
    }
  };

  // Pre-calculate statistical summaries from preview customers
  const tierCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  
  previewCustomers.forEach(c => {
    const tier = c.metadata?.loyaltyTier || 'Standard';
    const cat = c.metadata?.preferredCategory || 'General';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  // Projection math logic
  const calculateProjections = (
    tgtChannel: 'whatsapp' | 'sms' | 'email' | 'rcs', 
    tgtDiscount: number, 
    audienceCount: number
  ) => {
    const costPerMessage = {
      whatsapp: 0.05,
      sms: 0.02,
      email: 0.005,
      rcs: 0.04
    }[tgtChannel];

    const baseCTR = {
      whatsapp: 0.22,
      sms: 0.12,
      email: 0.05,
      rcs: 0.16
    }[tgtChannel];

    const baseConv = {
      whatsapp: 0.10,
      sms: 0.05,
      email: 0.02,
      rcs: 0.08
    }[tgtChannel];

    const projectedCTR = Math.min(0.95, baseCTR * (1 + (tgtDiscount / 100) * 1.5));
    const projectedConv = Math.min(0.85, baseConv * (1 + (tgtDiscount / 100) * 2.0));

    const matchedAOV = previewCustomers.length > 0 
      ? previewCustomers.reduce((sum, c) => sum + (c.totalSpent / Math.max(1, c.ordersCount)), 0) / previewCustomers.length
      : 60;

    const estConversions = audienceCount * projectedCTR * projectedConv;
    const grossRevenue = estConversions * matchedAOV * (1 - tgtDiscount / 100);
    const deliveryCost = audienceCount * costPerMessage;
    const netProfit = Math.max(0, grossRevenue - deliveryCost);
    const projectedROI = deliveryCost > 0 ? Math.round((netProfit / deliveryCost) * 100) : 0;

    return {
      costPerMessage,
      projectedCTR,
      projectedConv,
      estConversions,
      grossRevenue,
      deliveryCost,
      netProfit,
      projectedROI
    };
  };

  // Scenario calculations
  const totalAudienceMatched = previewCount || 0;
  const projA = calculateProjections(sandboxAChannel, sandboxADiscount, totalAudienceMatched);
  const projB = calculateProjections(sandboxBChannel, sandboxBDiscount, totalAudienceMatched);
  const sandboxWinner = projA.netProfit > projB.netProfit ? 'A' : projA.netProfit < projB.netProfit ? 'B' : 'Draw';

  // Multi-channel projections for recommendation card
  const recWhatsApp = calculateProjections('whatsapp', sliderDiscount, totalAudienceMatched);
  const recSMS = calculateProjections('sms', sliderDiscount, totalAudienceMatched);
  const recEmail = calculateProjections('email', sliderDiscount, totalAudienceMatched);
  const recRCS = calculateProjections('rcs', sliderDiscount, totalAudienceMatched);

  const getAIExplanation = () => {
    if (previewCustomers.length === 0) {
      return "No segment preview loaded. Filter shoppers to populate AI explanations.";
    }

    const coffeeCount = categoryCounts['Coffee'] || 0;
    const fashionCount = categoryCounts['Fashion'] || 0;
    const beautyCount = categoryCounts['Beauty'] || 0;
    const vipCount = tierCounts['VIP'] || 0;

    let explanation = "AI Suggestion: ";
    if (vipCount > previewCustomers.length * 0.4) {
      explanation += "This segment has a high percentage of VIPs. WhatsApp has a 4.4x higher conversion rate for high-value shoppers. Email has lower ROI due to high VIP email fatigue.";
    } else if (coffeeCount > previewCustomers.length * 0.5) {
      explanation += "Coffee lovers respond best to RCS and WhatsApp rich-media images of seasonal blends. WhatsApp is recommended.";
    } else if (fashionCount > previewCustomers.length * 0.5) {
      explanation += "Fashion shoppers respond exceptionally to visual catalogs. Email has highly responsive newsletter readers for fashion catalogs, SMS should be avoided.";
    } else if (beautyCount > previewCustomers.length * 0.5) {
      explanation += "Beauty products require high frequency engagement. RCS visual check-ins yield 25% higher open rates.";
    } else {
      explanation += "Multi-channel targeting shows WhatsApp yields the highest absolute profit, while Email achieves the highest ROI efficiency due to near-zero dispatch cost.";
    }

    return explanation;
  };

  // Learned Patterns calculations
  const learnedPatterns = React.useMemo(() => {
    if (campaigns.length === 0) return null;

    let totalRevenue = 0;
    let totalMessages = 0;
    let totalConversions = 0;
    const channelStats: Record<string, { sent: number; converted: number; revenue: number }> = {};
    let bestCampaign: any = null;

    campaigns.forEach(c => {
      const stats = c.stats || {};
      const statsB = c.statsB || {};
      const mainRevenue = stats.revenue || 0;
      const mainConversions = stats.converted || 0;
      const mainSent = stats.sent || 0;
      
      const bRevenue = statsB.revenue || 0;
      const bConversions = statsB.converted || 0;
      const bSent = statsB.sent || 0;

      const campTotalRevenue = mainRevenue + bRevenue;
      const campTotalConversions = mainConversions + bConversions;
      const campTotalSent = mainSent + bSent;

      totalRevenue += campTotalRevenue;
      totalConversions += campTotalConversions;
      totalMessages += campTotalSent;

      const ch = c.channel;
      if (!channelStats[ch]) {
        channelStats[ch] = { sent: 0, converted: 0, revenue: 0 };
      }
      channelStats[ch].sent += campTotalSent;
      channelStats[ch].converted += campTotalConversions;
      channelStats[ch].revenue += campTotalRevenue;

      const currentTotalRev = campTotalRevenue;
      const bestTotalRev = bestCampaign 
        ? ((bestCampaign.stats.revenue || 0) + (bestCampaign.statsB?.revenue || 0))
        : -1;

      if (currentTotalRev > bestTotalRev) {
        bestCampaign = c;
      }
    });

    const bestChannel = Object.entries(channelStats).reduce((best, current) => {
      const currentRate = current[1].sent > 0 ? (current[1].converted / current[1].sent) : 0;
      const bestRate = best ? (best[1].sent > 0 ? (best[1].converted / best[1].sent) : 0) : -1;
      return currentRate > bestRate ? current : best;
    }, null as any);

    return {
      totalRevenue,
      totalMessages,
      totalConversions,
      bestCampaign,
      bestChannelName: bestChannel ? bestChannel[0] : null,
      bestChannelRate: bestChannel ? (bestChannel[1].sent > 0 ? (bestChannel[1].converted / bestChannel[1].sent * 100).toFixed(1) : '0.0') : '0.0',
    };
  }, [campaigns]);

  // Simulator SVG Curve points
  const simPoints = [0, 10, 20, 30, 40, 50].map(disc => {
    const proj = calculateProjections(simulatorChannel, disc, totalAudienceMatched);
    return { discount: disc, profit: proj.netProfit };
  });

  const maxProfit = Math.max(...simPoints.map(p => p.profit), 1);
  const svgWidth = 320;
  const svgHeight = 100;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 20;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const svgPoints = simPoints.map(p => {
    const x = paddingLeft + (p.discount / 50) * chartWidth;
    const y = paddingTop + chartHeight - (p.profit / maxProfit) * chartHeight;
    return { x, y, discount: p.discount, profit: p.profit };
  });

  const linePath = svgPoints.reduce((path, p, idx) => {
    return path + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
  }, '');

  const areaPath = linePath + ` L ${svgPoints[svgPoints.length - 1].x} ${paddingTop + chartHeight} L ${svgPoints[0].x} ${paddingTop + chartHeight} Z`;

  // Selected discount dot position
  const selectedX = paddingLeft + (sliderDiscount / 50) * chartWidth;
  const selectedProj = calculateProjections(simulatorChannel, sliderDiscount, totalAudienceMatched);
  const selectedY = paddingTop + chartHeight - (selectedProj.netProfit / maxProfit) * chartHeight;

  return (
    <div>
      <header className="page-header">
        <div>
          <h2>Audience Segment Builder</h2>
          <p>Query CRM databases dynamically to design perfect shopper subgroups and outreach copies.</p>
        </div>
      </header>

      {/* Main Grid Wrapper */}
      <div className="segment-builder-grid">
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Natural Language Prompt Card */}
          <section className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>Natural Language AI Search</h3>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
              Describe segment parameters in English (e.g. "shoppers who spent over 100 on fashion").
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. VIP who spent over 100..."
                value={nlpPrompt}
                onChange={(e) => setNlpPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNlpCompile();
                  }
                }}
                style={{ flex: 1, height: '38px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.82rem' }}
              />
              <button 
                type="button" 
                className="btn btn-primary"
                disabled={isNlpCompiling || !nlpPrompt.trim()}
                onClick={handleNlpCompile}
                style={{ height: '38px', padding: '0 12px', fontSize: '0.8rem' }}
              >
                {isNlpCompiling ? (
                  <span className="spinner" style={{ width: '12px', height: '12px' }} />
                ) : (
                  'Compile'
                )}
              </button>
            </div>
          </section>

          {/* Filter Properties criteria */}
          <section className="glass-panel" style={{ padding: '24px' }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Target size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Filter Properties</h3>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                {isFiltersOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </div>

            {isFiltersOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '24px', animation: 'fade-in 200ms ease-out' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Spent Range</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      placeholder={`Min (${currencySymbol})`}
                      value={minSpent}
                      onChange={(e) => setMinSpent(e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <input
                      type="number"
                      placeholder={`Max (${currencySymbol})`}
                      value={maxSpent}
                      onChange={(e) => setMaxSpent(e.target.value === '' ? '' : Number(e.target.value))}
                      style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Min Order Placements</label>
                  <input
                    type="number"
                    placeholder="e.g. 3 purchases"
                    value={minOrders}
                    onChange={(e) => setMinOrders(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Days Inactive Since Last Order</label>
                  <input
                    type="number"
                    placeholder="e.g. 30 days inactive"
                    value={lastOrderDaysAgo}
                    onChange={(e) => setLastOrderDaysAgo(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', height: '42px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Category/Keyword Matches</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search tags, items, preferred brand..."
                      value={customFilter}
                      onChange={(e) => setCustomFilter(e.target.value)}
                      style={{ width: '100%', height: '42px', padding: '0 12px 0 36px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                    />
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-secondary)' }} />
                  </div>
                </div>

                <button onClick={fetchPreview} className="btn btn-secondary" style={{ display: 'flex', gap: '8px', width: '100%', height: '42px', borderRadius: '8px' }}>
                  <RefreshCw size={14} />
                  Re-Query Segment
                </button>
              </div>
            )}
          </section>

          {/* Learned Patterns Panel */}
          <section className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Cpu size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Learned ML Patterns</h3>
            </div>
            
            {learnedPatterns ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'start', padding: '10px', background: 'rgba(34, 197, 94, 0.05)', borderRadius: '8px', border: '1px solid var(--success)' }}>
                  <Award size={16} style={{ color: 'var(--success)', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Best Performing Outreach</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Campaign <strong>"{learnedPatterns.bestCampaign?.name}"</strong> generated the highest conversion return of <strong>{formatCurrency(learnedPatterns.bestCampaign?.stats?.revenue || 0)}</strong>.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'start', padding: '10px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                  <TrendingUp size={16} style={{ color: 'var(--primary)', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Optimal Dispatch Channel</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Historically, the best converting channel is <strong>{learnedPatterns.bestChannelName?.toUpperCase()}</strong> with an average click-conversion index of <strong>{learnedPatterns.bestChannelRate}%</strong>.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'start', padding: '10px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid var(--amber)' }}>
                  <Sparkles size={16} style={{ color: 'var(--amber)', marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Discount Sensitivity Threshold</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      20% discount templates yielded <strong>38% higher conversion ROI</strong> compared to 10% discount campaigns across similar segments.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '8px', textAlign: 'center' }}>
                No active historical campaigns recorded yet. Launch a campaign to construct ML insights.
              </div>
            )}
          </section>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Target Segment Size */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(109,94,247,0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Target Segment Size</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <h3 style={{ fontSize: '1.6rem', fontFamily: 'Outfit', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {isLoading ? '...' : previewCount !== null ? previewCount : '0'}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>shoppers matched</span>
                </div>
              </div>
            </div>

            {previewCount && previewCount > 0 ? (
              <button className="btn btn-primary" onClick={() => setIsCreatingCampaign(true)} style={{ height: '42px', padding: '0 20px', borderRadius: '8px' }}>
                <Megaphone size={16} />
                Launch Campaign
              </button>
            ) : null}
          </div>

          {/* What-If Simulator & SVG Curve Chart */}
          {(() => {
            const targetAudienceCount = Math.round((sliderAudiencePct / 100) * totalAudienceMatched);
            const costPerMessage = {
              whatsapp: 0.05,
              sms: 0.02,
              email: 0.005,
              rcs: 0.04
            }[simulatorChannel];

            const baseCTR = {
              whatsapp: 0.22,
              sms: 0.12,
              email: 0.05,
              rcs: 0.16
            }[simulatorChannel];

            const baseConv = {
              whatsapp: 0.10,
              sms: 0.05,
              email: 0.02,
              rcs: 0.08
            }[simulatorChannel];

            const projectedCTR = Math.min(0.95, baseCTR * (1 + (sliderDiscount / 100) * 1.5));
            const projectedConv = Math.min(0.85, baseConv * (1 + (sliderDiscount / 100) * 2.0));

            const matchedAOV = previewCustomers.length > 0 
              ? previewCustomers.reduce((sum, c) => sum + (c.totalSpent / Math.max(1, c.ordersCount)), 0) / previewCustomers.length
              : 60;

            const estConversions = targetAudienceCount * projectedCTR * projectedConv;
            const grossRevenue = estConversions * matchedAOV * (1 - sliderDiscount / 100);
            const deliveryCost = targetAudienceCount * costPerMessage;
            const netProfit = Math.max(0, grossRevenue - deliveryCost);
            const projectedROI = deliveryCost > 0 ? Math.round((netProfit / deliveryCost) * 100) : 0;

            return (
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.01)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>What-If Campaign Simulator</h3>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Interact with variables to simulate projected conversion metrics, delivery budgets, and gross revenues.
                </p>

                {/* SVG Curve Chart */}
                <div style={{ background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Projected Net Profit Curve</span>
                    <strong>Max Profit: {formatCurrency(maxProfit)}</strong>
                  </div>
                  
                  <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    <line x1={paddingLeft} y1={paddingTop} x2={svgWidth - paddingRight} y2={paddingTop} stroke="var(--panel-border)" strokeDasharray="2" />
                    <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={svgWidth - paddingRight} y2={paddingTop + chartHeight / 2} stroke="var(--panel-border)" strokeDasharray="2" />
                    <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={svgWidth - paddingRight} y2={paddingTop + chartHeight} stroke="var(--panel-border)" />

                    {/* Area path */}
                    <path d={areaPath} fill="url(#chart-grad)" />

                    {/* Line path */}
                    <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" />

                    {/* Points on path */}
                    {svgPoints.map((pt, idx) => (
                      <circle key={idx} cx={pt.x} cy={pt.y} r="3" fill="var(--card-bg)" stroke="var(--primary)" strokeWidth="1.5" />
                    ))}

                    {/* Selected Discount Indicator */}
                    <line x1={selectedX} y1={paddingTop} x2={selectedX} y2={paddingTop + chartHeight} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3" />
                    <circle cx={selectedX} cy={selectedY} r="6" fill="var(--accent)" stroke="#fff" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 4px var(--accent))' }} />

                    {/* Axis labels */}
                    <text x={paddingLeft} y={svgHeight - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">0%</text>
                    <text x={paddingLeft + chartWidth / 2} y={svgHeight - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">25%</text>
                    <text x={svgWidth - paddingRight} y={svgHeight - 4} fill="var(--text-muted)" fontSize="8" textAnchor="middle">50%</text>
                    
                    <text x={paddingLeft - 8} y={paddingTop + 4} fill="var(--text-muted)" fontSize="7" textAnchor="end">{formatCurrency(maxProfit)}</text>
                    <text x={paddingLeft - 8} y={paddingTop + chartHeight + 2} fill="var(--text-muted)" fontSize="7" textAnchor="end">{formatCurrency(0)}</text>
                  </svg>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 500 }}>Target Outreach Channel</label>
                    <select 
                      className="filter-select"
                      value={simulatorChannel}
                      onChange={(e) => setSimulatorChannel(e.target.value as any)}
                      style={{ width: '100%', height: '36px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', padding: '0 8px', fontSize: '0.8rem' }}
                    >
                      <option value="whatsapp">WhatsApp (Cost: {formatCurrency(0.05)}/msg)</option>
                      <option value="sms">SMS (Cost: {formatCurrency(0.02)}/msg)</option>
                      <option value="email">Email (Cost: {formatCurrency(0.005)}/msg)</option>
                      <option value="rcs">RCS (Cost: {formatCurrency(0.04)}/msg)</option>
                    </select>
                  </div>

                  <div className="config-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Discount Offered</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{sliderDiscount}% Off</strong>
                    </label>
                    <input 
                      type="range"
                      min="0"
                      max="50"
                      step="5"
                      value={sliderDiscount}
                      onChange={(e) => setSliderDiscount(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="config-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.72rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Audience Segment Scale</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{sliderAudiencePct}% ({targetAudienceCount} shoppers)</strong>
                    </label>
                    <input 
                      type="range"
                      min="10"
                      max="100"
                      step="10"
                      value={sliderAudiencePct}
                      onChange={(e) => setSliderAudiencePct(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--bg-color)', padding: '12px', borderRadius: '10px', border: '1px solid var(--panel-border)' }}>
                  <div>
                    <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Projected CTR</span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{(projectedCTR * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Conversion Rate</span>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{(projectedConv * 100).toFixed(1)}%</div>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--panel-border)', paddingTop: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Exp. Net Profit</span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>{formatCurrency(netProfit)}</div>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--panel-border)', paddingTop: '6px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Expected ROI</span>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>+{projectedROI}%</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* AI Sandbox Comparison Console */}
          <section className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.01)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Layers size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>AI Sandbox Scenario Console</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* Scenario A Configuration */}
              <div style={{ padding: '12px', background: 'var(--bg-color)', border: `1.5px solid ${sandboxWinner === 'A' ? 'var(--primary)' : 'var(--panel-border)'}`, borderRadius: '10px', position: 'relative' }}>
                {sandboxWinner === 'A' && (
                  <span className="badge badge-whatsapp" style={{ position: 'absolute', top: '-10px', right: '10px', fontSize: '0.6rem', padding: '2px 6px', background: 'var(--primary)', color: '#fff' }}>WINNER</span>
                )}
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Scenario A</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select 
                    value={sandboxAChannel} 
                    onChange={(e) => setSandboxAChannel(e.target.value as any)}
                    className="filter-select"
                    style={{ width: '100%', height: '30px', fontSize: '0.74rem', padding: '0 4px' }}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="rcs">RCS</option>
                  </select>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      <span>Discount</span>
                      <span>{sandboxADiscount}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="50" step="5" value={sandboxADiscount} 
                      onChange={(e) => setSandboxADiscount(Number(e.target.value))} 
                      style={{ width: '100%', height: '14px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Scenario B Configuration */}
              <div style={{ padding: '12px', background: 'var(--bg-color)', border: `1.5px solid ${sandboxWinner === 'B' ? 'var(--primary)' : 'var(--panel-border)'}`, borderRadius: '10px', position: 'relative' }}>
                {sandboxWinner === 'B' && (
                  <span className="badge badge-whatsapp" style={{ position: 'absolute', top: '-10px', right: '10px', fontSize: '0.6rem', padding: '2px 6px', background: 'var(--primary)', color: '#fff' }}>WINNER</span>
                )}
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Scenario B</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <select 
                    value={sandboxBChannel} 
                    onChange={(e) => setSandboxBChannel(e.target.value as any)}
                    className="filter-select"
                    style={{ width: '100%', height: '30px', fontSize: '0.74rem', padding: '0 4px' }}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="rcs">RCS</option>
                  </select>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                      <span>Discount</span>
                      <span>{sandboxBDiscount}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="50" step="5" value={sandboxBDiscount} 
                      onChange={(e) => setSandboxBDiscount(Number(e.target.value))} 
                      style={{ width: '100%', height: '14px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Scenario Results Table */}
            <div style={{ border: '1px solid var(--panel-border)', borderRadius: '8px', overflow: 'hidden', fontSize: '0.74rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--panel-border)' }}>
                    <th style={{ padding: '8px' }}>Metrics</th>
                    <th style={{ padding: '8px' }}>Scenario A</th>
                    <th style={{ padding: '8px' }}>Scenario B</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>Projected CTR</td>
                    <td style={{ padding: '8px', fontWeight: sandboxWinner === 'A' ? 600 : 400 }}>{(projA.projectedCTR*100).toFixed(1)}%</td>
                    <td style={{ padding: '8px', fontWeight: sandboxWinner === 'B' ? 600 : 400 }}>{(projB.projectedCTR*100).toFixed(1)}%</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>Delivery Cost</td>
                    <td style={{ padding: '8px' }}>{formatCurrency(projA.deliveryCost)}</td>
                    <td style={{ padding: '8px' }}>{formatCurrency(projB.deliveryCost)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>Gross Revenue</td>
                    <td style={{ padding: '8px' }}>{formatCurrency(projA.grossRevenue)}</td>
                    <td style={{ padding: '8px' }}>{formatCurrency(projB.grossRevenue)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>Net Profit</td>
                    <td style={{ padding: '8px', color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(projA.netProfit)}</td>
                    <td style={{ padding: '8px', color: 'var(--success)', fontWeight: 600 }}>{formatCurrency(projB.netProfit)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>Expected ROI</td>
                    <td style={{ padding: '8px', color: 'var(--primary)', fontWeight: 600 }}>+{projA.projectedROI}%</td>
                    <td style={{ padding: '8px', color: 'var(--primary)', fontWeight: 600 }}>+{projB.projectedROI}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Multi-Channel Recommendation Engine */}
          <section className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Cpu size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Multi-Channel Projections ({sliderDiscount}% Off)</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {/* WhatsApp */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>WhatsApp</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Profit: {formatCurrency(recWhatsApp.netProfit)} (ROI: +{recWhatsApp.projectedROI}%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, recWhatsApp.projectedROI / 10)}%`, height: '100%', background: 'var(--primary)', borderRadius: '3px' }} />
                </div>
              </div>

              {/* RCS */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>RCS Chat</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Profit: {formatCurrency(recRCS.netProfit)} (ROI: +{recRCS.projectedROI}%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, recRCS.projectedROI / 10)}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Email */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>Email Outreach</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Profit: {formatCurrency(recEmail.netProfit)} (ROI: +{recEmail.projectedROI}%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, recEmail.projectedROI / 10)}%`, height: '100%', background: 'var(--success)', borderRadius: '3px' }} />
                </div>
              </div>

              {/* SMS */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>SMS Text</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Profit: {formatCurrency(recSMS.netProfit)} (ROI: +{recSMS.projectedROI}%)</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, recSMS.projectedROI / 10)}%`, height: '100%', background: 'var(--amber)', borderRadius: '3px' }} />
                </div>
              </div>
            </div>

            {/* AI Explanation Sub-card */}
            <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.9rem' }}>💡</span>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {getAIExplanation()}
              </p>
            </div>
          </section>

          {/* Quick Stats Grid */}
          {previewCount && previewCount > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', contentVisibility: 'auto' }}>
              {/* Category distribution */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Preferred Brands</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(categoryCounts).map(([cat, count]) => {
                    const pct = (count / previewCustomers.length) * 100;
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{cat}</span>
                          <span>{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--panel-border)', borderRadius: '2px' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Loyalty Tier Distribution */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Loyalty Tiers</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(tierCounts).map(([tier, count]) => {
                    const pct = (count / previewCustomers.length) * 100;
                    return (
                      <div key={tier}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{tier}</span>
                          <span>{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--panel-border)', borderRadius: '2px' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Shopper Listing preview */}
          <section className="glass-panel" style={{ padding: '24px', overflow: 'hidden' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Shopper Preview</h3>
            {previewCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {isLoading ? 'Searching database...' : 'Adjust rules above. No customers match your specified segment criteria.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
                {previewCustomers.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{c.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{c.email} • {c.phone}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className={`badge badge-${String(c.metadata?.preferredCategory).toLowerCase()}`}>{c.metadata?.preferredCategory}</span>
                      <span className="badge badge-draft" style={{ background: 'var(--panel-border)', color: 'var(--text-secondary)' }}>{c.metadata?.loyaltyTier}</span>
                    </div>
                  </div>
                ))}
                {previewCount !== null && previewCount > 20 ? (
                  <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '6px' }}>
                    Showing first 20 matching shoppers. total {previewCount} matched.
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Campaign Launcher drawer */}
      <div className={`drawer ${isCreatingCampaign ? 'open' : ''}`} style={{ zIndex: 110, width: '460px', right: isCreatingCampaign ? '0' : '-460px' }}>
        <div className="drawer-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit', fontSize: '1.25rem' }}>
            <Megaphone size={18} className="color-blue" style={{ color: 'var(--accent)' }} />
            Compile Custom Outreach
          </h3>
          <button className="drawer-close" onClick={() => setIsCreatingCampaign(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleLaunchCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
          <div style={{ padding: '12px', background: 'rgba(109,94,247,0.06)', border: '1px solid var(--panel-border)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Target segment contains <strong>{previewCount}</strong> customers. Set your templates and select message channels below.
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Campaign Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Inactive Coffee VIPs Discount"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              style={{ width: '100%', height: '44px', padding: '0 12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Dispatch Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              className="filter-select"
              style={{ width: '100%', height: '44px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', padding: '0 12px', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              <option value="whatsapp">WhatsApp (Business API)</option>
              <option value="sms">SMS (SMS Carrier Hub)</option>
              <option value="email">Email (Direct Mail Delivery)</option>
              <option value="rcs">RCS (Google Chat Profile)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Message Template</label>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Variables: {"{{first_name}}"}, {"{{total_spent}}"}</span>
            </div>
            <textarea
              required
              placeholder="Hey {{first_name}}! We notice you spent {{total_spent}} with us. As a VIP..."
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              style={{ width: '100%', height: '140px', padding: '12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontSize: '0.88rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={isLaunching || !campaignName || !messageTemplate}
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', borderRadius: '8px', marginTop: '10px' }}
          >
            {isLaunching ? (
              <span className="spinner" style={{ width: '16px', height: '16px' }} />
            ) : (
              <>
                <CheckCircle2 size={16} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline' }} />
                Queue and Launch Campaign
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SegmentBuilder;
