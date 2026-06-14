import React from 'react';
import { useSettings } from '../context/SettingsContext';

export interface ChannelMetrics {
  channel: 'whatsapp' | 'sms' | 'email' | 'rcs' | 'push';
  label: string;
  openRate: number;
  ctr: number;
  conversionRate: number;
  costPerMessage: number;
  confidence: number;
  whyExplanation: string;
}

interface ChannelIntelligenceProps {
  audienceSize: number;
  averageAOV: number;
  selectedChannel: 'whatsapp' | 'sms' | 'email' | 'rcs' | 'push';
  discount: number;
  onChannelChange: (channel: 'whatsapp' | 'sms' | 'email' | 'rcs' | 'push') => void;
  categoryFilter?: string;
  isVipSegment?: boolean;
}

export const getChannelMetricsList = (
  discount: number, 
  categoryFilter?: string, 
  isVipSegment?: boolean
): ChannelMetrics[] => {
  // Calibrate baseline metrics slightly based on segment indicators
  const vipMultiplier = isVipSegment ? 1.25 : 1.0;
  const coffeeMultiplier = categoryFilter === 'Coffee' ? 1.15 : 1.0;
  const fashionMultiplier = categoryFilter === 'Fashion' ? 1.20 : 1.0;

  return [
    {
      channel: 'whatsapp',
      label: 'WhatsApp Business',
      openRate: Math.min(0.98, 0.85 * vipMultiplier * coffeeMultiplier),
      ctr: Math.min(0.80, 0.22 * (1 + (discount / 100) * 1.5) * coffeeMultiplier),
      conversionRate: Math.min(0.50, 0.10 * (1 + (discount / 100) * 2.0) * vipMultiplier),
      costPerMessage: 0.05,
      confidence: 86,
      whyExplanation: 'WhatsApp is highly recommended because similar high-loyalty cohorts historically opened 82% of rich messages with a conversion rate of over 12%.'
    },
    {
      channel: 'push',
      label: 'Push Notifications',
      openRate: Math.min(0.95, 0.60 * vipMultiplier),
      ctr: Math.min(0.50, 0.10 * (1 + (discount / 100) * 1.2) * fashionMultiplier),
      conversionRate: Math.min(0.30, 0.04 * (1 + (discount / 100) * 1.5)),
      costPerMessage: 0.01,
      confidence: 78,
      whyExplanation: 'Push Notifications have near-zero delivery costs and high immediate visibility on mobile lockscreens.'
    },
    {
      channel: 'sms',
      label: 'SMS Text Carrier',
      openRate: Math.min(0.98, 0.90),
      ctr: Math.min(0.60, 0.12 * (1 + (discount / 100) * 1.0)),
      conversionRate: Math.min(0.35, 0.05 * (1 + (discount / 100) * 1.4)),
      costPerMessage: 0.02,
      confidence: 81,
      whyExplanation: 'SMS ensures 98% carrier-level delivery but has average click rates and no rich-media card features.'
    },
    {
      channel: 'email',
      label: 'Direct Email',
      openRate: Math.min(0.80, 0.25 * fashionMultiplier),
      ctr: Math.min(0.40, 0.05 * (1 + (discount / 100) * 1.8) * fashionMultiplier),
      conversionRate: Math.min(0.20, 0.02 * (1 + (discount / 100) * 2.2)),
      costPerMessage: 0.005,
      confidence: 88,
      whyExplanation: 'Email provides the highest ROI margin due to micro-delivery costs, especially for visual catalog content.'
    },
    {
      channel: 'rcs',
      label: 'RCS Messaging',
      openRate: Math.min(0.95, 0.80 * coffeeMultiplier),
      ctr: Math.min(0.70, 0.16 * (1 + (discount / 100) * 1.4)),
      conversionRate: Math.min(0.40, 0.08 * (1 + (discount / 100) * 1.8)),
      costPerMessage: 0.04,
      confidence: 82,
      whyExplanation: 'RCS supports visual product carousels but has limited delivery compatibility on non-Android devices.'
    }
  ];
};

export const ChannelIntelligence: React.FC<ChannelIntelligenceProps> = ({
  audienceSize,
  averageAOV,
  selectedChannel,
  discount,
  onChannelChange,
  categoryFilter,
  isVipSegment
}) => {
  const { formatCurrency } = useSettings();
  const rawAOV = averageAOV || 60;

  // Calculate projections for all channels
  const metricsList = getChannelMetricsList(discount, categoryFilter, isVipSegment);

  const projections = metricsList.map(m => {
    const totalSent = audienceSize;
    const estDelivered = totalSent * m.openRate; // using openRate as delivered proxy in UI
    const estClicks = estDelivered * m.ctr;
    const estConversions = estClicks * m.conversionRate;
    
    const grossRevenue = estConversions * rawAOV * (1 - discount / 100);
    const cost = totalSent * m.costPerMessage;
    const netProfit = Math.max(0, grossRevenue - cost);
    const roi = cost > 0 ? Math.round((netProfit / cost) * 100) : 0;

    return {
      ...m,
      grossRevenue,
      cost,
      netProfit,
      roi,
      estClicks,
      estConversions
    };
  });

  // Rank by Net Profit
  const rankedProjections = [...projections].sort((a, b) => b.netProfit - a.netProfit);
  const recommendedChannel = rankedProjections[0];

  const selectedProj = projections.find(p => p.channel === selectedChannel) || projections[0];
  const isRecommendedActive = selectedChannel === recommendedChannel.channel;

  const revenueLoss = recommendedChannel.netProfit - selectedProj.netProfit;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Ranked Channels List */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--panel-border)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Sparkles size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
            AI Channel Recommendations
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rankedProjections.map((p, idx) => {
            const isSelected = selectedChannel === p.channel;
            const isRec = p.channel === recommendedChannel.channel;
            return (
              <div 
                key={p.channel} 
                onClick={() => onChannelChange(p.channel)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '10px 14px', 
                  background: isSelected ? 'var(--bg-color)' : 'rgba(255,255,255,0.01)', 
                  border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--panel-border)',
                  borderRadius: '10px', 
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {p.label}
                      {isRec && (
                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: 'var(--primary)', color: '#fff', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          ⭐ Recommended
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      CTR: {(p.ctr * 100).toFixed(0)}% • Conv: {(p.conversionRate * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.netProfit)}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Net Profit</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Why this recommendation? explanation */}
        <div style={{ display: 'flex', gap: '10px', padding: '12px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '10px', marginTop: '12px' }}>
          <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>🧠</span>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Why {recommendedChannel.label}?</div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
              {recommendedChannel.whyExplanation} It yields a predicted net profit of <strong>{formatCurrency(recommendedChannel.netProfit)}</strong> with a confidence score of <strong>{recommendedChannel.confidence}%</strong>.
            </p>
          </div>
        </div>

        {/* Override Warning */}
        {!isRecommendedActive && revenueLoss > 0 && (
          <div style={{ display: 'flex', gap: '10px', padding: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1.5px solid var(--rose)', borderRadius: '10px', marginTop: '12px', animation: 'fade-in 0.2s ease-out' }}>
            <AlertTriangle size={16} style={{ color: 'var(--rose)', marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--rose)' }}>Channel Override Warning</div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                Switching outreach to <strong>{selectedProj.label}</strong> reduces the expected campaign revenue by <strong style={{ color: 'var(--rose)' }}>{formatCurrency(revenueLoss)}</strong> compared to the recommended {recommendedChannel.label}.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Visualizations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        
        {/* Revenue Comparison SVG Chart */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase' }}>Predicted Revenue</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projections.map(p => {
              const maxRev = Math.max(...projections.map(x => x.grossRevenue), 1);
              const percent = (p.grossRevenue / maxRev) * 100;
              const isSelected = p.channel === selectedChannel;
              return (
                <div key={p.channel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '2px' }}>
                    <span style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.label.split(' ')[0]}</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(p.grossRevenue)}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        background: isSelected ? 'var(--success)' : 'var(--primary)',
                        borderRadius: '3px' 
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ROI Comparison SVG Chart */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase' }}>Predicted ROI</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projections.map(p => {
              const maxROI = Math.max(...projections.map(x => x.roi), 1);
              const percent = (p.roi / maxROI) * 100;
              const isSelected = p.channel === selectedChannel;
              return (
                <div key={p.channel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '2px' }}>
                    <span style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p.label.split(' ')[0]}</span>
                    <span style={{ fontWeight: 600 }}>+{p.roi}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        background: isSelected ? 'var(--primary)' : 'var(--accent)',
                        borderRadius: '3px' 
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Confidence Score & Funnel Block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
        
        {/* Confidence meter */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', alignSelf: 'start', textTransform: 'uppercase' }}>Confidence Index</h4>
          
          <div style={{ position: 'relative', width: '90px', height: '50px', overflow: 'hidden', marginTop: '5px' }}>
            <svg width="90" height="50" viewBox="0 0 90 50">
              {/* background semi circle */}
              <path d="M 5,45 A 40,40 0 0,1 85,45" fill="none" stroke="var(--panel-border)" strokeWidth="8" strokeLinecap="round" />
              {/* active semi circle */}
              <path 
                d="M 5,45 A 40,40 0 0,1 85,45" 
                fill="none" 
                stroke="var(--primary)" 
                strokeWidth="8" 
                strokeLinecap="round"
                strokeDasharray="125.6"
                strokeDashoffset={125.6 * (1 - selectedProj.confidence / 100)}
              />
            </svg>
            <div style={{ position: 'absolute', bottom: '0', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedProj.confidence}%</span>
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
            Model Precision Index
          </span>
        </div>

        {/* Funnel chart */}
        <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)' }}>
          <h4 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>Conversion Funnel</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '70px', color: 'var(--text-secondary)' }}>Audience</div>
              <div style={{ flex: 1, background: 'var(--panel-border)', height: '16px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ background: 'var(--text-secondary)', opacity: 0.15, width: '100%', height: '100%' }} />
                <div style={{ position: 'absolute', top: 0, left: '8px', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 600 }}>{audienceSize}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '70px', color: 'var(--text-secondary)' }}>Delivered</div>
              <div style={{ flex: 1, background: 'var(--panel-border)', height: '16px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ background: 'var(--accent)', opacity: 0.4, width: `${selectedProj.openRate * 100}%`, height: '100%' }} />
                <div style={{ position: 'absolute', top: 0, left: '8px', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 600 }}>{Math.round(audienceSize * selectedProj.openRate)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '70px', color: 'var(--text-secondary)' }}>Clicked</div>
              <div style={{ flex: 1, background: 'var(--panel-border)', height: '16px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ background: 'var(--primary)', opacity: 0.6, width: `${(audienceSize * selectedProj.openRate * selectedProj.ctr / audienceSize) * 100}%`, height: '100%' }} />
                <div style={{ position: 'absolute', top: 0, left: '8px', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 600 }}>{Math.round(selectedProj.estClicks)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '70px', color: 'var(--text-secondary)' }}>Sales</div>
              <div style={{ flex: 1, background: 'var(--panel-border)', height: '16px', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ background: 'var(--success)', opacity: 0.8, width: `${(selectedProj.estConversions / audienceSize) * 100}%`, height: '100%' }} />
                <div style={{ position: 'absolute', top: 0, left: '8px', height: '100%', display: 'flex', alignItems: 'center', fontWeight: 600 }}>{Math.round(selectedProj.estConversions)}</div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
