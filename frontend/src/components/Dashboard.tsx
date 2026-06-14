import React, { useState, useEffect } from 'react';
import { ShoppingBag, Target, ArrowUpRight, BarChart3, Database, ChevronRight, CheckCircle2, TrendingUp, X, AlertTriangle } from 'lucide-react';
import { CampaignData, QueueState, LiveEvent } from '../App';
import { useSettings } from '../context/SettingsContext';
const API = import.meta.env.VITE_API_URL;

interface DashboardProps {
  campaigns: CampaignData[];
  shoppersCount: number;
  queues: QueueState;
  onNavigate: (page: 'dashboard' | 'shoppers' | 'segments' | 'channel-hub' | 'opportunities' | 'settings') => void;
  fetchData: () => void;
  liveEvents: LiveEvent[];
  asOf: string;
}

const Dashboard: React.FC<DashboardProps> = ({ campaigns, shoppersCount, queues, onNavigate, fetchData, liveEvents, asOf }) => {
  const { formatCurrency, formatDate, formatTime } = useSettings();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [inspectorData, setInspectorData] = useState<{ campaign: CampaignData; messages: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [atRiskCount, setAtRiskCount] = useState(0);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | 'success' | 'errors' | 'conversions'>('all');
  const [activeVariantTab, setActiveVariantTab] = useState<'A' | 'B'>('A');

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const fetchCustomersAndAnalyze = async () => {
      try {
        const response = await fetch(`${API}/api/crm/customers?asOf=${asOf}`);
        if (response.ok) {
          const customers = await response.json();
          const ordersResponse = await fetch(`${API}/api/crm/orders?asOf=${asOf}`);
          if (ordersResponse.ok) {
            const orders = await ordersResponse.json();
            setOrdersList(orders);
            let count = 0;
            const nowTime = asOf ? new Date(asOf).getTime() : Date.now();
            customers.forEach((c: any) => {
              const cOrders = orders.filter((o: any) => o.customerId === c.id);
              let lastOrderDate = c.createdAt;
              if (cOrders.length > 0) {
                const sorted = [...cOrders].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                lastOrderDate = sorted[0].createdAt;
              }
              const msDiff = nowTime - new Date(lastOrderDate).getTime();
              const daysInactive = Math.floor(msDiff / (1000 * 60 * 60 * 24));
              if (daysInactive >= 20) {
                count++;
              }
            });
            setAtRiskCount(count);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchCustomersAndAnalyze();
  }, [shoppersCount, asOf]);

  useEffect(() => {
    // Simulate minor loading animation for visual SaaS aesthetics
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [campaigns]);

  // Campaign details inspector polling
  useEffect(() => {
    if (!selectedCampaignId) {
      setInspectorData(null);
      return;
    }

    const fetchDetail = async () => {
      try {
        const response = await fetch(`${API}/api/crm/campaigns/${selectedCampaignId}?asOf=${asOf}`);
        if (response.ok) {
          const data = await response.json();
          setInspectorData(data);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchDetail();
    const interval = setInterval(fetchDetail, 2000);
    return () => clearInterval(interval);
  }, [selectedCampaignId, asOf]);

  // Aggregate Stats
  const activeCampaigns = campaigns.filter(c => c.status === 'sending').length;
  const totalSent = campaigns.reduce((sum, c) => sum + c.stats.sent, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.stats.delivered, 0);
  const totalOpened = campaigns.reduce((sum, c) => sum + c.stats.opened, 0);
  const totalClicked = campaigns.reduce((sum, c) => sum + c.stats.clicked, 0);
  const totalConverted = campaigns.reduce((sum, c) => sum + c.stats.converted, 0);
  const totalRevenue = campaigns.reduce((sum, c) => sum + c.stats.revenue, 0);

  // Calculate percentages
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
  const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;
  const conversionRate = totalClicked > 0 ? (totalConverted / totalClicked) * 100 : 0;

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset the CRM database? This will clear all campaign data, webhook queues, and reset settings.')) {
      try {
        const response = await fetch(`${API}/api/crm/system/reset', { method: 'POST' });
        if (response.ok) {
          fetchData();
        }
      } catch (err) {
        console.error('Failed to reset system:', err);
      }
    }
  };

  // SVG Chart Dimensions & Computations
  const chartHeight = 140;
  const chartWidth = 500;
  const barWidth = 32;
  const gap = 48;
  const topCampaigns = [...campaigns]
    .filter(c => c.stats.revenue > 0)
    .sort((a, b) => b.stats.revenue - a.stats.revenue)
    .slice(0, 5);

  const maxRevenue = Math.max(...topCampaigns.map(c => c.stats.revenue), 100);

  // Calculate category revenues dynamically from the current orders list
  const getCategoryRevenue = (orders: any[]) => {
    const categories = {
      'Fashion & Apparel': 0,
      'Gourmet Coffee': 0,
      'Beauty & Wellness': 0,
      'General Merchandise': 0
    };
    orders.forEach(o => {
      const itemsStr = (o.items || []).join(' ').toLowerCase();
      if (itemsStr.includes('saree') || itemsStr.includes('kurta') || itemsStr.includes('ethnic') || itemsStr.includes('blouse') || itemsStr.includes('shirt') || itemsStr.includes('pants') || itemsStr.includes('trousers') || itemsStr.includes('fashion') || itemsStr.includes('sarees')) {
        categories['Fashion & Apparel'] += o.amount;
      } else if (itemsStr.includes('coffee') || itemsStr.includes('espresso') || itemsStr.includes('blend') || itemsStr.includes('beans') || itemsStr.includes('cup') || itemsStr.includes('mug')) {
        categories['Gourmet Coffee'] += o.amount;
      } else if (itemsStr.includes('makeup') || itemsStr.includes('beauty') || itemsStr.includes('skincare') || itemsStr.includes('lip') || itemsStr.includes('balm') || itemsStr.includes('cream')) {
        categories['Beauty & Wellness'] += o.amount;
      } else {
        categories['General Merchandise'] += o.amount;
      }
    });
    return categories;
  };

  // Get cohort data adjusted by Time Machine asOf value
  const getCohortData = () => {
    const cutoffTime = asOf ? new Date(asOf).getTime() : Date.now();
    const now = new Date();
    
    // Baseline sample cohort percentages
    const baseCohorts = [
      { name: 'Jan Cohort', size: 48, m1: 85, m2: 74, m3: 68 },
      { name: 'Feb Cohort', size: 36, m1: 80, m2: 72, m3: null },
      { name: 'Mar Cohort', size: 55, m1: 83, m2: null, m3: null }
    ];

    const daysDiff = (now.getTime() - cutoffTime) / (1000 * 60 * 60 * 24);
    if (daysDiff > 60) {
      // Show only Jan cohort as active, hide or scale down others
      return [
        { name: 'Jan Cohort', size: 24, m1: 75, m2: null, m3: null },
        { name: 'Feb Cohort', size: 0, m1: null, m2: null, m3: null },
        { name: 'Mar Cohort', size: 0, m1: null, m2: null, m3: null }
      ];
    } else if (daysDiff > 30) {
      // 30 days ago: hide March cohort, show January & February
      return [
        { name: 'Jan Cohort', size: 38, m1: 82, m2: 70, m3: null },
        { name: 'Feb Cohort', size: 22, m1: 78, m2: null, m3: null },
        { name: 'Mar Cohort', size: 0, m1: null, m2: null, m3: null }
      ];
    }
    return baseCohorts;
  };

  // Compute Smart Alerts
  const smartAlerts = (() => {
    const alerts = [];
    
    if (atRiskCount > 0) {
      alerts.push({
        id: 'churn_alert',
        type: 'warning',
        text: `At-risk shoppers count is ${atRiskCount}. Consider launching an AI-native VIP Winback campaign to minimize churn.`,
        actionLabel: 'View Shoppers',
        onAction: () => onNavigate('shoppers')
      });
    }

    if (totalSent > 0 && deliveryRate < 90) {
      alerts.push({
        id: 'delivery_alert',
        type: 'danger',
        text: `High delivery failure detected! Current success rate is ${deliveryRate.toFixed(1)}%. Inspect channel gateway latencies.`,
        actionLabel: 'Monitor Gateway',
        onAction: () => onNavigate('channel-hub')
      });
    }

    const completedAB = campaigns.filter(c => c.isABTest && c.statsB && c.status === 'completed');
    completedAB.forEach(c => {
      const sB = c.statsB!;
      const ctrA = c.stats.delivered > 0 ? (c.stats.clicked / c.stats.delivered) * 100 : 0;
      const ctrB = sB.delivered > 0 ? (sB.clicked / sB.delivered) * 100 : 0;
      const winner = ctrA > ctrB ? 'Variant A' : 'Variant B';
      const winRate = ctrA > ctrB ? ctrA : ctrB;
      alerts.push({
        id: `ab_winner_${c.id}`,
        type: 'success',
        text: `🏆 A/B Winner Declared: ${winner} won in '${c.name}' campaign with ${winRate.toFixed(1)}% click-through rate.`,
        actionLabel: 'Details',
        onAction: () => setSelectedCampaignId(c.id)
      });
    });

    return alerts;
  })();

  return (
    <div className="dashboard-grid">
      {/* Executive Brief Banner */}
      <section className="glass-panel" style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(109, 94, 247, 0.05) 100%)',
        borderLeft: '4px solid var(--primary)',
        marginBottom: '10px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            {getGreeting()}, Yuktha!
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            We've analyzed your customer directories. You have <strong style={{ color: 'var(--primary)', fontWeight: 600 }}>{activeCampaigns}</strong> active campaign{activeCampaigns !== 1 ? 's' : ''} running. 
            There are <strong style={{ color: 'var(--rose)', fontWeight: 600 }}>{atRiskCount}</strong> at-risk shoppers who could churn within the next 30 days.
          </p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span className="badge badge-whatsapp" style={{ padding: '1px 6px', fontSize: '0.68rem', fontWeight: 600 }}>AI Recommendation</span>
            <span>💡 Trigger a VIP Winback Campaign to re-engage inactive customers immediately.</span>
          </div>
        </div>
      </section>

      {/* Smart Alerts Section */}
      {smartAlerts.length > 0 && (
        <section className="smart-alerts-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {smartAlerts.map(alert => (
            <div 
              key={alert.id} 
              className={`glass-panel alert-item alert-${alert.type}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                borderRadius: '8px',
                borderLeft: `4px solid ${
                  alert.type === 'success' ? 'var(--success)' :
                  alert.type === 'warning' ? 'var(--amber)' :
                  'var(--rose)'
                }`,
                fontSize: '0.82rem',
                background: 'var(--card-bg)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                {alert.type === 'success' ? <CheckCircle2 size={16} style={{ color: 'var(--success)' }} /> : <AlertTriangle size={16} style={{ color: alert.type === 'warning' ? 'var(--amber)' : 'var(--rose)' }} />}
                <span>{alert.text}</span>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.75rem', height: '26px', borderRadius: '6px' }}
                onClick={alert.onAction}
              >
                {alert.actionLabel}
              </button>
            </div>
          ))}
        </section>
      )}

      <header className="page-header">
        <div>
          <h2>Dashboard Overview</h2>
          <p>Real-time campaign delivery tracking and AI conversion performance.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleReset}>
            <Database size={16} />
            Reset Database
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('channel-hub')}>
            Monitor Gateway
            <ArrowUpRight size={16} />
          </button>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <section className="kpi-grid">
        {/* Card 1 */}
        <div className="glass-panel kpi-card">
          <div>
            <span className="kpi-label">Total Shoppers</span>
            {isLoading ? (
              <div className="skeleton-block" style={{ width: '80px', height: '28px', borderRadius: '6px', marginTop: '8px' }} />
            ) : (
              <div className="kpi-value">{shoppersCount}</div>
            )}
          </div>
          <div className="kpi-icon icon-blue">
            <ShoppingBag size={20} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel kpi-card">
          <div>
            <span className="kpi-label">Active Campaigns</span>
            {isLoading ? (
              <div className="skeleton-block" style={{ width: '80px', height: '28px', borderRadius: '6px', marginTop: '8px' }} />
            ) : (
              <div className="kpi-value">{activeCampaigns}</div>
            )}
          </div>
          <div className="kpi-icon icon-slate">
            <Target size={20} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel kpi-card">
          <div>
            <span className="kpi-label">Total Revenue</span>
            {isLoading ? (
              <div className="skeleton-block" style={{ width: '100px', height: '28px', borderRadius: '6px', marginTop: '8px' }} />
            ) : (
              <div className="kpi-value">{formatCurrency(totalRevenue)}</div>
            )}
          </div>
          <div className="kpi-icon icon-emerald">
            <ArrowUpRight size={20} />
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel kpi-card">
          <div>
            <span className="kpi-label">Buffer Outbox Queue</span>
            {isLoading ? (
              <div className="skeleton-block" style={{ width: '80px', height: '28px', borderRadius: '6px', marginTop: '8px' }} />
            ) : (
              <div className="kpi-value">{queues.CRM_Outbox.size} <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>jobs</span></div>
            )}
          </div>
          <div className="kpi-icon icon-amber">
            <BarChart3 size={20} />
          </div>
        </div>
      </section>

      {/* Analytics Row: Funnel & Leaderboard Chart */}
      <div className="analytics-row" style={{ marginBottom: '24px' }}>
        {/* Campaign Funnel Visualization */}
        <section className="glass-panel funnel-container" style={{ marginBottom: 0 }}>
          <h3 className="funnel-title">Ecosystem Conversion Funnel</h3>
          {isLoading ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="funnel-step" style={{ border: 'none' }}>
                  <div className="skeleton-block" style={{ width: '100%', height: '56px', borderRadius: '8px' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="funnel-steps">
              <div className="funnel-step">
                <div className="funnel-num">{totalSent}</div>
                <div className="funnel-label">Sent</div>
              </div>
              <div className="funnel-step">
                <div className="funnel-num">{totalDelivered}</div>
                <div className="funnel-label">Delivered</div>
                <div className="funnel-pct">{deliveryRate.toFixed(1)}% delivery</div>
              </div>
              <div className="funnel-step">
                <div className="funnel-num">{totalOpened}</div>
                <div className="funnel-label">Opened / Read</div>
                <div className="funnel-pct">{openRate.toFixed(1)}% open</div>
              </div>
              <div className="funnel-step">
                <div className="funnel-num">{totalClicked}</div>
                <div className="funnel-label">Clicked</div>
                <div className="funnel-pct">{clickRate.toFixed(1)}% click</div>
              </div>
              <div className="funnel-step">
                <div className="funnel-num">{totalConverted}</div>
                <div className="funnel-label">Purchased</div>
                <div className="funnel-pct">{conversionRate.toFixed(1)}% purchase</div>
              </div>
            </div>
          )}
        </section>

        {/* Revenue SVG Bar Chart */}
        {!isLoading && topCampaigns.length > 0 ? (
          <section className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px' }}>
              <TrendingUp size={18} style={{ color: 'var(--success)' }} />
              Top Campaign Revenue Leaderboard
            </h3>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <svg width="100%" height={chartHeight + 40} viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} style={{ maxWidth: '600px' }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" />
                    <stop offset="100%" stopColor="var(--accent)" />
                  </linearGradient>
                </defs>
                {topCampaigns.map((c, i) => {
                  const barHeight = (c.stats.revenue / maxRevenue) * chartHeight;
                  const x = i * (barWidth + gap) + 40;
                  const y = chartHeight - barHeight + 15;
                  return (
                    <g key={c.id}>
                      {/* Bar */}
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        rx="4"
                        fill="url(#barGrad)"
                        opacity="0.85"
                        style={{ transition: 'all 0.5s ease' }}
                      />
                      {/* Revenue Label */}
                      <text
                        x={x + barWidth / 2}
                        y={y - 6}
                        textAnchor="middle"
                        fill="var(--text-primary)"
                        fontSize="10"
                        fontWeight="600"
                      >
                        {formatCurrency(c.stats.revenue)}
                      </text>
                      {/* Campaign Short Name */}
                      <text
                        x={x + barWidth / 2}
                        y={chartHeight + 30}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize="9"
                      >
                        {c.name.length > 12 ? c.name.substring(0, 10) + '...' : c.name}
                      </text>
                    </g>
                  );
                })}
                {/* Horizontal Baseline */}
                <line x1="20" y1={chartHeight + 15} x2={chartWidth - 20} y2={chartHeight + 15} stroke="var(--panel-border)" strokeWidth="1" />
              </svg>
            </div>
          </section>
        ) : (
          <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', minHeight: '220px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Revenue Leaderboard</h3>
            <p style={{ fontSize: '0.88rem', textAlign: 'center' }}>No campaign revenue recorded yet.</p>
          </section>
        )}
      </div>

      {/* Advanced Segment Analytics Row */}
      <div className="analytics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Category Revenue Heatmap */}
        {(() => {
          const categoryRevenues = getCategoryRevenue(ordersList);
          const maxCatVal = Math.max(...Object.values(categoryRevenues), 1);
          const leadingCategory = Object.keys(categoryRevenues).reduce((a, b) => categoryRevenues[a as keyof typeof categoryRevenues] > categoryRevenues[b as keyof typeof categoryRevenues] ? a : b, 'Fashion & Apparel');
          return (
            <section className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px' }}>
                <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
                Category Revenue Heatmap
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {Object.entries(categoryRevenues).map(([cat, val]) => {
                  const isLeader = cat === leadingCategory && val > 0;
                  const opacity = val > 0 ? Math.max(0.15, val / maxCatVal) : 0.05;
                  return (
                    <div 
                      key={cat} 
                      className="glass-panel" 
                      style={{ 
                        padding: '16px', 
                        background: `rgba(139, 92, 246, ${opacity * 0.15})`,
                        border: isLeader ? '2px solid var(--success)' : '1px solid var(--panel-border)',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative'
                      }}
                    >
                      {isLeader && (
                        <span 
                          className="badge badge-success" 
                          style={{ 
                            position: 'absolute', 
                            top: '8px', 
                            right: '8px', 
                            fontSize: '0.65rem',
                            padding: '2px 6px'
                          }}
                        >
                          Leading
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{cat}</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                        {formatCurrency(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* Cohort Retention Heatmap */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px' }}>
            <Database size={18} style={{ color: 'var(--primary)' }} />
            Cohort Retention Analysis
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px' }}>Cohort</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px' }}>Size</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px' }}>Month 0</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px' }}>Month 1</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px' }}>Month 2</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px' }}>Month 3</th>
                </tr>
              </thead>
              <tbody>
                {getCohortData().map((c) => (
                  <tr key={c.name} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ fontWeight: 600, padding: '12px 4px', color: 'var(--text-primary)' }}>{c.name}</td>
                    <td style={{ textAlign: 'center', padding: '12px 4px', color: 'var(--text-secondary)' }}>{c.size || '-'}</td>
                    <td style={{ 
                      textAlign: 'center', 
                      padding: '12px 4px', 
                      background: c.size > 0 ? 'rgba(109, 94, 247, 0.25)' : 'transparent',
                      color: c.size > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: 500
                    }}>
                      {c.size > 0 ? '100%' : '-'}
                    </td>
                    {[c.m1, c.m2, c.m3].map((val, idx) => {
                      const hasVal = val !== null && c.size > 0;
                      const opacity = hasVal ? (val / 100) * 0.4 : 0;
                      return (
                        <td 
                          key={idx}
                          style={{ 
                            textAlign: 'center', 
                            padding: '12px 4px', 
                            background: hasVal ? `rgba(139, 92, 246, ${opacity})` : 'transparent',
                            color: hasVal ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: hasVal ? 500 : 400
                          }}
                        >
                          {hasVal ? `${val}%` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Bottom Row: Campaign Activity & Attribution Stream */}
      <div className="bottom-row">
        {/* Campaign List */}
        <section>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '1.1rem', marginBottom: '16px', fontWeight: 600 }}>Campaign Activity</h3>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="glass-panel" style={{ padding: '20px', border: '1px solid var(--panel-border)' }}>
                  <div className="skeleton-block" style={{ width: '60%', height: '20px', borderRadius: '4px' }} />
                  <div className="skeleton-block" style={{ width: '40%', height: '14px', borderRadius: '4px', marginTop: '10px' }} />
                </div>
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No campaigns launched yet. Open the AI Copilot (bottom right) or navigate to the Segment Builder to start outreach!</p>
            </div>
          ) : (
            campaigns.map(c => {
              const pct = c.stats.total > 0 ? ((c.stats.delivered + c.stats.failed) / c.stats.total) * 100 : 0;
              return (
                <div 
                  key={c.id} 
                  className="glass-panel campaign-card" 
                  onClick={() => setSelectedCampaignId(c.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="campaign-info">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {c.name}
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </h3>
                    <div className="campaign-meta">
                      <span className={`badge badge-${c.channel}`}>{c.channel.toUpperCase()}</span>
                      <span className={`badge badge-${c.status}`}>{c.status.toUpperCase()}</span>
                      <span>Segment: {c.stats.total}</span>
                      <span>•</span>
                      <span>{formatDate(c.createdAt)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    {/* Progress bar */}
                    {c.status === 'sending' && (
                      <div style={{ width: '110px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          <span>Progress</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--panel-border)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )}

                    {/* Micro metric aggregates */}
                    <div className="camp-micro-stats">
                      <div>
                        <div className="camp-micro-stat-val" style={{ color: 'var(--accent)' }}>{c.stats.delivered}</div>
                        <div className="camp-micro-stat-lbl">Delivered</div>
                      </div>
                      <div>
                        <div className="camp-micro-stat-val" style={{ color: 'var(--success)' }}>{c.stats.opened}</div>
                        <div className="camp-micro-stat-lbl">Opened</div>
                      </div>
                      <div>
                        <div className="camp-micro-stat-val" style={{ color: 'var(--amber)' }}>{c.stats.clicked}</div>
                        <div className="camp-micro-stat-lbl">Clicked</div>
                      </div>
                      <div>
                        <div className="camp-micro-stat-val" style={{ color: 'var(--success)' }}>{c.stats.converted}</div>
                        <div className="camp-micro-stat-lbl">Sales</div>
                      </div>
                      <div>
                        <div className="camp-micro-stat-val" style={{ color: 'var(--text-primary)' }}>{formatCurrency(c.stats.revenue)}</div>
                        <div className="camp-micro-stat-lbl">Revenue</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Right Column: Real-time Campaign-Attributed Conversion Feed */}
        <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 'fit-content', maxHeight: '550px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            Live Event Stream
          </h3>
          
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
            Real-time tracking of message outbox actions and sale conversions.
          </p>

          {/* Event Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['all', 'success', 'errors', 'conversions'] as const).map(tab => (
              <button
                key={tab}
                className={`btn ${eventFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  borderRadius: '6px',
                  height: '28px',
                  textTransform: 'capitalize'
                }}
                onClick={() => setEventFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
 
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '360px', paddingRight: '4px' }}>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-panel" style={{ padding: '12px', border: '1px solid var(--panel-border)' }}>
                  <div className="skeleton-block" style={{ width: '80%', height: '14px', borderRadius: '4px' }} />
                  <div className="skeleton-block" style={{ width: '50%', height: '10px', borderRadius: '4px', marginTop: '8px' }} />
                </div>
              ))
            ) : (!liveEvents || liveEvents.length === 0) ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', padding: '20px' }}>
                No active outreach callbacks or purchase attributions recorded.
              </div>
            ) : (() => {
              const filteredEvents = liveEvents.filter(event => {
                if (eventFilter === 'all') return true;
                if (eventFilter === 'conversions') return event.type === 'conversion';
                if (eventFilter === 'errors') return event.type === 'message' && event.status === 'failed';
                if (eventFilter === 'success') return event.type === 'message' && event.status !== 'failed';
                return true;
              });

              if (filteredEvents.length === 0) {
                return (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', padding: '20px' }}>
                    No events match this filter.
                  </div>
                );
              }

              return filteredEvents.map(event => (
                <div 
                  key={event.id} 
                  className="live-ticker-item"
                  style={{ 
                    background: 'var(--bg-color)', 
                    border: '1px solid var(--panel-border)', 
                    borderRadius: '10px', 
                    padding: '12px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ 
                        fontWeight: 600, 
                        fontSize: '0.8rem', 
                        color: event.type === 'conversion' ? 'var(--success)' : 
                               event.status === 'failed' ? 'var(--rose)' : 'var(--accent)'
                      }}>
                        {event.type === 'conversion' ? '🎉 Purchase Attributed' : `💬 Outbox ${event.status?.toUpperCase()}`}
                      </span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {event.customerName}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{event.timestamp}</span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {event.type === 'conversion' ? (
                      <>
                        Bought: <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{event.items?.join(', ')}</span> for{' '}
                        <strong style={{ color: 'var(--success)' }}>{formatCurrency(event.amount || 0)}</strong>
                      </>
                    ) : (
                      <>
                        Dispatched outreach campaign: <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{event.campaignName}</span>
                      </>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </section>
      </div>

      {/* Campaign Details Inspector Side Drawer */}
      <div className={`drawer ${inspectorData ? 'open' : ''}`} style={{ zIndex: 100, width: '460px' }}>
        {inspectorData && (
          <>
            <div className="drawer-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Outfit', fontSize: '1.25rem' }}>
                <Target size={18} style={{ color: 'var(--primary)' }} />
                Campaign Performance
              </h3>
              <button className="drawer-close" onClick={() => setSelectedCampaignId(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-profile">
              <h3>{inspectorData.campaign.name}</h3>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <span className={`badge badge-${inspectorData.campaign.channel}`}>{inspectorData.campaign.channel.toUpperCase()}</span>
                <span className={`badge badge-${inspectorData.campaign.status}`}>{inspectorData.campaign.status.toUpperCase()}</span>
              </div>
              <div className="drawer-profile-info" style={{ fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 600, marginTop: '10px' }}>Segment Criteria:</div>
                <div className="ai-campaign-spec" style={{ fontSize: '0.78rem', background: 'var(--bg-color)', margin: '6px 0', border: '1px solid var(--panel-border)', padding: '8px', borderRadius: '6px' }}>
                  {inspectorData.campaign.segmentRules.minSpent && <div>- Spent &gt; {formatCurrency(inspectorData.campaign.segmentRules.minSpent)}</div>}
                  {inspectorData.campaign.segmentRules.maxSpent && <div>- Spent &lt; {formatCurrency(inspectorData.campaign.segmentRules.maxSpent)}</div>}
                  {inspectorData.campaign.segmentRules.minOrders && <div>- Orders &gt;= {inspectorData.campaign.segmentRules.minOrders}</div>}
                  {inspectorData.campaign.segmentRules.lastOrderDaysAgo && <div>- Inactive &gt; {inspectorData.campaign.segmentRules.lastOrderDaysAgo} days</div>}
                  {inspectorData.campaign.segmentRules.customFilter && <div>- Keyword: "{inspectorData.campaign.segmentRules.customFilter}"</div>}
                  {!inspectorData.campaign.segmentRules.minSpent && 
                   !inspectorData.campaign.segmentRules.maxSpent && 
                   !inspectorData.campaign.segmentRules.minOrders && 
                   !inspectorData.campaign.segmentRules.lastOrderDaysAgo && 
                   !inspectorData.campaign.segmentRules.customFilter && 
                   <div>- All customers</div>}
                </div>
                <div style={{ marginTop: '10px' }}>Created: {formatDate(inspectorData.campaign.createdAt)} {formatTime(inspectorData.campaign.createdAt)}</div>
              </div>
                
                {inspectorData.campaign.isABTest && inspectorData.campaign.statsB ? (
                  <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>A/B Split Test Performance</div>
                    {(() => {
                      const c = inspectorData.campaign;
                      const sA = c.stats;
                      const sB = c.statsB!;
                      const ctrA = sA.delivered > 0 ? (sA.clicked / sA.delivered) * 100 : 0;
                      const ctrB = sB.delivered > 0 ? (sB.clicked / sB.delivered) * 100 : 0;
                      const isTied = ctrA === ctrB;
                      const winnerVariant = ctrA > ctrB ? 'Variant A' : 'Variant B';
                      const winnerCtr = ctrA > ctrB ? ctrA : ctrB;
                      return (
                        <>
                          <div className="glass-panel" style={{ padding: '10px 14px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid var(--success)', borderRadius: '8px', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                              {isTied ? '📊 Performance Tied' : `🏆 Winner Declared: ${winnerVariant}`}
                            </span>
                            <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {isTied ? 'Both variants have identical click-through rates.' : `Winning variant outperforms with a CTR of ${winnerCtr.toFixed(1)}%.`}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '5px' }}>
                            <div className="glass-panel" style={{ padding: '10px', fontSize: '0.75rem' }}>
                              <div style={{ fontWeight: 600, borderBottom: '1px solid var(--panel-border)', paddingBottom: '4px', marginBottom: '6px', color: 'var(--accent)' }}>Variant A (Default)</div>
                              <div>Delivered: {sA.delivered}</div>
                              <div>Opened: {sA.opened}</div>
                              <div>Clicked: {sA.clicked}</div>
                              <div>Conversions: {sA.converted}</div>
                              <div>CTR: <strong>{ctrA.toFixed(1)}%</strong></div>
                              <div>Revenue: <strong style={{ color: 'var(--success)' }}>{formatCurrency(sA.revenue)}</strong></div>
                            </div>
                            <div className="glass-panel" style={{ padding: '10px', fontSize: '0.75rem' }}>
                              <div style={{ fontWeight: 600, borderBottom: '1px solid var(--panel-border)', paddingBottom: '4px', marginBottom: '6px', color: 'var(--primary)' }}>Variant B</div>
                              <div>Delivered: {sB.delivered}</div>
                              <div>Opened: {sB.opened}</div>
                              <div>Clicked: {sB.clicked}</div>
                              <div>Conversions: {sB.converted}</div>
                              <div>CTR: <strong>{ctrB.toFixed(1)}%</strong></div>
                              <div>Revenue: <strong style={{ color: 'var(--success)' }}>{formatCurrency(sB.revenue)}</strong></div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ marginTop: '10px' }}>Total Revenue: <strong style={{ color: 'var(--success)' }}>{formatCurrency(inspectorData.campaign.stats.revenue)}</strong></div>
                )}

                {inspectorData.campaign.isABTest ? (
                  <>
                    <div className="drawer-section-title" style={{ marginTop: '20px' }}>Message Templates</div>
                    <div className="ai-campaign-msg" style={{ background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderLeft: '3px solid var(--accent)', fontSize: '0.82rem', padding: '10px', marginBottom: '8px' }}>
                      {inspectorData.campaign.messageTemplate}
                    </div>
                    <div className="drawer-section-title">Message Template - Variant B</div>
                    <div className="ai-campaign-msg" style={{ background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderLeft: '3px solid var(--primary)', fontSize: '0.82rem', padding: '10px' }}>
                      {inspectorData.campaign.messageTemplateB || '(No Template B set)'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="drawer-section-title">Message Body Template</div>
                    <div className="ai-campaign-msg" style={{ background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderLeft: '3px solid var(--primary)', fontSize: '0.82rem', padding: '10px' }}>
                      {inspectorData.campaign.messageTemplate}
                    </div>
                  </>
                )}

                {/* Recipient Logs Tabs for A/B Testing */}
                {inspectorData.campaign.isABTest ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '6px' }}>
                    <span className="drawer-section-title" style={{ margin: 0 }}>Recipient Logs</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        className={`btn ${activeVariantTab === 'A' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', height: '24px', borderRadius: '4px' }}
                        onClick={() => setActiveVariantTab('A')}
                      >
                        Variant A
                      </button>
                      <button 
                        className={`btn ${activeVariantTab === 'B' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '2px 8px', fontSize: '0.7rem', height: '24px', borderRadius: '4px' }}
                        onClick={() => setActiveVariantTab('B')}
                      >
                        Variant B
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="drawer-section-title">Recipient Delivery Logs ({inspectorData.messages.length})</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {(() => {
                    const logsList = inspectorData.campaign.isABTest 
                      ? inspectorData.messages.filter(m => m.variant === activeVariantTab)
                      : inspectorData.messages;

                    if (logsList.length === 0) {
                      return <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No logs dispatched for this variant.</p>;
                    }

                    return logsList.map(m => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '0.82rem' }}>
                          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                            {m.recipient} {inspectorData.campaign.isABTest && <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>({m.variant})</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '220px' }}>
                            {m.content}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span 
                            className="badge" 
                            style={{ 
                              fontSize: '0.68rem', 
                              background: m.status === 'converted' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.05)', 
                              color: m.status === 'converted' ? 'var(--success)' : m.status === 'failed' ? 'var(--rose)' : 'var(--text-primary)' 
                            }}
                          >
                            {m.status.toUpperCase()}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {formatTime(m.updatedAt)}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </>
          )}
        </div>

    </div>
  );
};

export default Dashboard;