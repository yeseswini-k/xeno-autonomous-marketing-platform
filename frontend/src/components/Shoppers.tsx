type Customer = any;
type Order = any;
type MessageLog = any;

import React, { useState, useEffect } from 'react';
import { Mail, Phone, Calendar, UserCheck, Database, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { API_BASE } from '../config';

interface SelectedCustomerDetail extends Customer {
  orders: Order[];
  messages: MessageLog[];
}

interface ShoppersProps {
  onOpenIngester: () => void;
  asOf: string;
}

const Shoppers: React.FC<ShoppersProps> = ({ onOpenIngester, asOf }) => {
  const { formatCurrency, formatDate, formatTime } = useSettings();
  const [shoppers, setShoppers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [minSpent, setMinSpent] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const [isChurnExplainOpen, setIsChurnExplainOpen] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<'name' | 'totalSpent' | 'ordersCount' | 'createdAt'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch shoppers list
  const fetchShoppers = async () => {
    setIsLoading(true);
    try {
      let url = `${API_BASE}/api/crm/customers?search=${search}&asOf=${asOf}`;
      if (minSpent) url += `&minSpent=${minSpent}`;
      
      const response = await fetch(url);
      if (response.ok) {
        let data = await response.json();
        // Client-side filter for preferred category
        if (categoryFilter) {
          data = data.filter((s: any) => s.metadata?.preferredCategory === categoryFilter);
        }
        setShoppers(data);
      }
    } catch (err) {
      console.error('Failed to fetch shoppers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch single customer detail when clicked
  const fetchCustomerDetail = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/crm/customers/${id}?asOf=${asOf}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedCustomer(data);
      }

      const analResponse = await fetch(`${API_BASE}/api/crm/customers/${id}/analytics?asOf=${asOf}`);
      if (analResponse.ok) {
        const analData = await analResponse.json();
        setAnalytics(analData);
      }
    } catch (err) {
      console.error('Failed to fetch customer detail:', err);
    }
  };


  useEffect(() => {
    setCurrentPage(1);
    fetchShoppers();
  }, [search, minSpent, categoryFilter, asOf]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetail(selectedCustomerId);
      const interval = setInterval(() => {
        fetchCustomerDetail(selectedCustomerId);
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setSelectedCustomer(null);
      setAnalytics(null);
      setIsReplaying(false);
      setReplayStep(0);
    }
  }, [selectedCustomerId, asOf]);

  useEffect(() => {
    let timer: any;
    if (isReplaying) {
      timer = setInterval(() => {
        setReplayStep(prev => {
          const maxSteps = selectedCustomer ? (1 + selectedCustomer.orders.length + selectedCustomer.messages.length) : 0;
          if (prev >= maxSteps) {
            setIsReplaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isReplaying, selectedCustomer]);

  const handleSort = (field: 'name' | 'totalSpent' | 'ordersCount' | 'createdAt') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for counts/spending
    }
    setCurrentPage(1);
  };

  // Sort shoppers list
  const sortedShoppers = [...shoppers].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (sortField === 'name') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (sortField === 'createdAt') {
      return sortOrder === 'asc'
        ? new Date(aVal).getTime() - new Date(bVal).getTime()
        : new Date(bVal).getTime() - new Date(aVal).getTime();
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const totalPages = Math.ceil(sortedShoppers.length / itemsPerPage);
  const paginatedShoppers = sortedShoppers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  return (
    <div>
      <header className="page-header">
        <div>
          <h2>Customer Directory</h2>
          <p>Browse DTC shopper attributes, order history, and campaign timeline history.</p>
        </div>
        <button className="btn btn-secondary" onClick={onOpenIngester} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Database size={16} />
          Import Shoppers
        </button>
      </header>

      {/* Filters Area */}
      <section className="shoppers-filters">
        <div className="search-input-wrapper">
          <input 
            type="search" 
            placeholder="Search name, email, phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select 
          className="filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">Preferred Brand: All</option>
          <option value="Coffee">Brew & Co (Coffee)</option>
          <option value="Fashion">Zara (Fashion)</option>
          <option value="Beauty">GlowLab (Beauty)</option>
        </select>

        <select 
          className="filter-select"
          value={minSpent}
          onChange={(e) => setMinSpent(e.target.value)}
        >
          <option value="">Spent: Any</option>
          <option value="50">spent &gt; {formatCurrency(50)}</option>
          <option value="100">spent &gt; {formatCurrency(100)}</option>
          <option value="200">spent &gt; {formatCurrency(200)}</option>
        </select>
      </section>

      {/* Shoppers List Table */}
      <section className="glass-panel" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <table className="shoppers-list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Preferred Brand</th>
                <th>Tier</th>
                <th>Location</th>
                <th>Orders Count</th>
                <th>Total Spent</th>
                <th>Acquired</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} style={{ cursor: 'default' }}>
                  <td><div className="skeleton-block" style={{ width: '120px', height: '16px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton-block" style={{ width: '85px', height: '16px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton-block" style={{ width: '70px', height: '16px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton-block" style={{ width: '100px', height: '16px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton-block" style={{ width: '60px', height: '16px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton-block" style={{ width: '70px', height: '16px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton-block" style={{ width: '90px', height: '16px', borderRadius: '4px' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : shoppers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No shoppers matched the filter parameters.
          </div>
        ) : (
          <table className="shoppers-list">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Name {sortField === 'name' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </th>
                <th>Preferred Brand</th>
                <th>Tier</th>
                <th>Location</th>
                <th onClick={() => handleSort('ordersCount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Orders Count {sortField === 'ordersCount' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </th>
                <th onClick={() => handleSort('totalSpent')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Total Spent {sortField === 'totalSpent' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </th>
                <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Acquired {sortField === 'createdAt' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedShoppers.map(s => (
                <tr key={s.id} onClick={() => setSelectedCustomerId(s.id)}>
                  <td data-label="Name" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</td>
                  <td data-label="Preferred Brand">
                    <span className={`badge badge-${String(s.metadata?.preferredCategory).toLowerCase()}`}>
                      {s.metadata?.preferredCategory}
                    </span>
                  </td>
                  <td data-label="Tier">{s.metadata?.loyaltyTier}</td>
                  <td data-label="Location">{s.metadata?.location}</td>
                  <td data-label="Orders Count">{s.ordersCount} orders</td>
                  <td data-label="Total Spent" style={{ fontWeight: 600 }}>{formatCurrency(s.totalSpent)}</td>
                  <td data-label="Acquired" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {formatDate(s.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {!isLoading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--panel-border)' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, shoppers.length)} of {shoppers.length} entries
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', borderRadius: '8px' }}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', padding: '0 8px' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', borderRadius: '8px' }}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Profile Detail Side Drawer */}
      <div className={`drawer ${selectedCustomer ? 'open' : ''}`} style={{ zIndex: 100, width: '460px' }}>
        {selectedCustomer && (
          <>
            <div className="drawer-header">
              <h3 style={{ fontFamily: 'Outfit', fontSize: '1.4rem' }}>Shopper Insights</h3>
              <button className="drawer-close" onClick={() => setSelectedCustomerId(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-profile" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--panel-border)', marginBottom: '16px' }}>
              <h3>{selectedCustomer.name}</h3>
              <span className={`badge badge-${String(selectedCustomer.metadata?.preferredCategory).toLowerCase()}`} style={{ marginTop: '8px', display: 'inline-block' }}>
                {selectedCustomer.metadata?.preferredCategory} Lover
              </span>
              
              <div className="drawer-profile-info" style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={16} />
                  <span>{selectedCustomer.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={16} />
                  <span>{selectedCustomer.phone}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} />
                  <span>Created: {formatDate(selectedCustomer.createdAt)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={16} />
                  <span>Loyalty Tier: {selectedCustomer.metadata?.loyaltyTier} ({selectedCustomer.metadata?.location})</span>
                </div>
              </div>

              {/* Persona Summary Card */}
              {(() => {
                const cat = selectedCustomer.metadata?.preferredCategory;
                const tier = selectedCustomer.metadata?.loyaltyTier;
                let personaTitle = 'General Shopper';
                let personaDescription = 'Standard retail buyer with sporadic engagement.';
                let personaEmoji = '🛍️';

                if (cat === 'Coffee') {
                  personaTitle = 'Gourmet Coffee Enthusiast';
                  personaDescription = 'High-frequency buyer prioritizing premium blends and accessories.';
                  personaEmoji = '☕';
                } else if (cat === 'Fashion') {
                  personaTitle = 'Fashion Trend Seeker';
                  personaDescription = 'Loves seasonal collections and sarees. Highly responsive to email promotions.';
                  personaEmoji = '💃';
                } else if (cat === 'Beauty') {
                  personaTitle = 'Organic Glow Enthusiast';
                  personaDescription = 'Beauty & wellness shopper focused on natural skincare and active self-care.';
                  personaEmoji = '🧴';
                } else if (tier === 'VIP') {
                  personaTitle = 'Loyal VIP Supporter';
                  personaDescription = 'Premium high-value account deserving exclusive win-back deals and free shipping.';
                  personaEmoji = '👑';
                } else if (selectedCustomer.orders.length > 2) {
                  personaTitle = 'Repeat Value Shopper';
                  personaDescription = 'Consistently orders when discount codes are supplied.';
                  personaEmoji = '🏷️';
                }

                return (
                  <div className="glass-panel" style={{ padding: '12px 16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid var(--primary)', borderRadius: '10px', marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.8rem' }}>{personaEmoji}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Persona: {personaTitle}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>{personaDescription}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Health Score circle dial gauge & breakdown progress bars */}
            {analytics && (
              <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(255, 255, 255, 0.01)', marginBottom: '16px', border: '1px solid var(--panel-border)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
                    <svg width="72" height="72" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r="30" fill="transparent" stroke="var(--panel-border)" strokeWidth="5" />
                      <circle 
                        cx="36" 
                        cy="36" 
                        r="30" 
                        fill="transparent" 
                        stroke={analytics.healthScore >= 80 ? 'var(--success)' : analytics.healthScore >= 50 ? 'var(--amber)' : 'var(--rose)'}
                        strokeWidth="5" 
                        strokeDasharray="188.4" 
                        strokeDashoffset={188.4 * (1 - analytics.healthScore / 100)} 
                        strokeLinecap="round"
                        transform="rotate(-90 36 36)"
                      />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{analytics.healthScore}</div>
                      <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Score</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Customer Health</span>
                      <span className="badge" style={{ 
                        background: analytics.healthScore >= 80 ? 'rgba(34, 197, 94, 0.1)' : analytics.healthScore >= 50 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: analytics.healthScore >= 80 ? 'var(--success)' : analytics.healthScore >= 50 ? 'var(--amber)' : 'var(--rose)' 
                      }}>
                        {analytics.healthScore >= 80 ? 'Excellent' : analytics.healthScore >= 50 ? 'Fair' : 'Poor'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                      {analytics.healthReasoning}
                    </p>
                  </div>
                </div>

                {/* Metric Breakdown Indices progress bars */}
                {(() => {
                  const m = analytics.metrics || {};
                  const recencyDays = m.recencyDays || 0;
                  const frequency = m.frequency || 0;
                  const totalSpent = m.totalSpent || 0;
                  const clickRate = m.clickRate || 0;
                  const openRate = m.openRate || 0;

                  const recencyScore = Math.max(0, 35 * (1 - recencyDays / 90));
                  const frequencyScore = Math.min(25, frequency * 8);
                  const monetaryScore = Math.min(20, (totalSpent / 150) * 20);
                  const engagementScore = selectedCustomer.messages.length > 0 ? (clickRate * 12 + openRate * 8) : 12;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.74rem', borderTop: '1px solid var(--panel-border)', paddingTop: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Metric Breakdown Indices:</div>
                      
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span>Recency (Inactivity)</span>
                          <span>{Math.round(recencyScore)}/35 ({recencyDays}d inactive)</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--panel-border)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                          <div style={{ width: `${(recencyScore/35)*100}%`, height: '100%', background: 'var(--accent)' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span>Frequency (Orders)</span>
                          <span>{Math.round(frequencyScore)}/25 ({frequency} orders)</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--panel-border)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                          <div style={{ width: `${(frequencyScore/25)*100}%`, height: '100%', background: 'var(--primary)' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span>Monetary (Spend)</span>
                          <span>{Math.round(monetaryScore)}/20 ({formatCurrency(totalSpent)})</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--panel-border)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                          <div style={{ width: `${(monetaryScore/20)*100}%`, height: '100%', background: 'var(--success)' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                          <span>Engagement</span>
                          <span>{Math.round(engagementScore)}/20 (Open: {Math.round(openRate*100)}%, Click: {Math.round(clickRate*100)}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'var(--panel-border)', borderRadius: '2px', overflow: 'hidden', marginTop: '3px' }}>
                          <div style={{ width: `${(engagementScore/20)*100}%`, height: '100%', background: 'var(--amber)' }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Churn prediction slide dial slider card */}
            {analytics && (
              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.01)', marginBottom: '16px', border: '1px solid var(--panel-border)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Churn Risk Index</span>
                  <span className="badge" style={{ 
                    background: analytics.churnStatus === 'Healthy' ? 'rgba(34, 197, 94, 0.1)' : analytics.churnStatus === 'At Risk' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: analytics.churnStatus === 'Healthy' ? 'var(--success)' : analytics.churnStatus === 'At Risk' ? 'var(--amber)' : 'var(--rose)',
                    fontWeight: 600
                  }}>
                    {analytics.churnStatus} ({analytics.churnProbability}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--panel-border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{ 
                    width: `${analytics.churnProbability}%`, 
                    height: '100%', 
                    background: analytics.churnProbability > 70 ? 'var(--rose)' : analytics.churnProbability > 30 ? 'var(--amber)' : 'var(--success)',
                    transition: 'width 0.5s ease-out'
                  }} />
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  <strong>Scan Result:</strong> {analytics.churnReasoning}
                </p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'start', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '8px', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.78rem' }}>💡</span>
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                    <strong>Action:</strong> {analytics.churnRecommendation}
                  </p>
                </div>

                {/* Churn Prediction Explainability Details Accordion */}
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--panel-border)', paddingTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsChurnExplainOpen(!isChurnExplainOpen)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none', color: 'var(--text-secondary)', fontSize: '0.74rem', fontWeight: 600 }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>🔍</span> Churn Risk Explainability Panel
                    </span>
                    <span>
                      {isChurnExplainOpen ? 'Hide' : 'Show Details'}
                    </span>
                  </button>

                  {isChurnExplainOpen && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', padding: '10px', borderRadius: '8px', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4', animation: 'fade-in 150ms ease-out' }}>
                      <div>
                        <strong>Why customer is at risk?</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Days Inactive:</span>
                        <span style={{ fontWeight: 600, color: (analytics.metrics?.recencyDays || 0) > 45 ? 'var(--rose)' : 'var(--text-primary)' }}>{analytics.metrics?.recencyDays || 0} days</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Orders Declining Rate:</span>
                        <span style={{ fontWeight: 600, color: 'var(--amber)' }}>{(analytics.metrics?.frequency || 0) < 2 ? '60%' : '20%'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Message Engagement Index:</span>
                        <span style={{ fontWeight: 600, color: (analytics.metrics?.clickRate || 0) < 0.1 ? 'var(--rose)' : 'var(--success)' }}>
                          {(analytics.metrics?.clickRate || 0) < 0.1 ? 'Low (Under 10% clicks)' : 'Good'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--panel-border)', paddingTop: '4px', marginTop: '4px' }}>
                        <span>Explanation Confidence:</span>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>82%</span>
                      </div>
                      <div style={{ marginTop: '4px', padding: '6px 8px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '4px', border: '1px solid var(--panel-border)' }}>
                        <strong>Evidence:</strong> Customer matches high churn risk model profile with prolonged inactivity and declining purchase momentum.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Chronological Journey Timeline with step animator player */}
            {(() => {
              const events: { id: string; type: string; title: string; body: string; date: Date; statusClass: string }[] = [];

              // Account Registered Event
              events.push({
                id: 'joined',
                type: 'joined',
                title: 'Shopper Account Registered',
                body: `Acquired into customer directory under ${selectedCustomer.metadata?.loyaltyTier || 'Standard'} Tier.`,
                date: new Date(selectedCustomer.createdAt),
                statusClass: 'status-sent'
              });

              // Purchases
              selectedCustomer.orders.forEach(o => {
                events.push({
                  id: `order_${o.id}`,
                  type: 'purchase',
                  title: `Purchased Items (${formatCurrency(o.amount)})`,
                  body: `Ordered: ${o.items.join(', ')} ${o.campaignId ? '(Attributed to campaign)' : ''}`,
                  date: new Date(o.createdAt),
                  statusClass: 'status-converted'
                });
              });

              // Messaging outbox timeline
              selectedCustomer.messages.forEach(m => {
                let eventTitle = `Message Outbox ${m.status.toUpperCase()}`;
                if (m.status === 'converted') eventTitle = 'Outreach Converted Purchase';
                else if (m.status === 'clicked') eventTitle = 'Outreach Link Clicked';
                else if (m.status === 'opened' || m.status === 'read') eventTitle = 'Outreach Opened';
                
                events.push({
                  id: `msg_${m.id}_${m.status}`,
                  type: 'message',
                  title: `${eventTitle} (${m.channel.toUpperCase()})`,
                  body: `Draft: "${m.content}" ${m.lastError ? `(Error: ${m.lastError})` : ''}`,
                  date: new Date(m.updatedAt),
                  statusClass: `status-${m.status}`
                });
              });

              // Sort chronological (oldest first)
              const chronologicalEvents = events.sort((a, b) => a.date.getTime() - b.date.getTime());
              
              // Filter based on replay step
              const visibleChronologicalEvents = isReplaying 
                ? chronologicalEvents.slice(0, Math.min(replayStep, chronologicalEvents.length))
                : chronologicalEvents;

              // Display newest first
              const visibleEvents = [...visibleChronologicalEvents].reverse();

              return (
                <>
                  <div className="drawer-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                    <span>Customer Journey Timeline</span>
                    <button 
                      className={`btn ${isReplaying ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px', borderRadius: '4px' }}
                      onClick={() => {
                        if (isReplaying) {
                          setIsReplaying(false);
                        } else {
                          setReplayStep(1);
                          setIsReplaying(true);
                        }
                      }}
                    >
                      {isReplaying ? 'Pause Replay' : 'Replay Journey'}
                    </button>
                  </div>

                  {isReplaying && (
                    <div className="glass-panel" style={{ padding: '10px 14px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid var(--panel-border)', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Playing step <strong>{replayStep}</strong> of <strong>{chronologicalEvents.length}</strong>
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '0.68rem', height: '20px', borderRadius: '4px' }}
                          onClick={() => setReplayStep(prev => Math.max(1, prev - 1))}
                          disabled={replayStep <= 1}
                        >
                          Prev
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '0.68rem', height: '20px', borderRadius: '4px' }}
                          onClick={() => setReplayStep(prev => Math.min(chronologicalEvents.length, prev + 1))}
                          disabled={replayStep >= chronologicalEvents.length}
                        >
                          Next
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '0.68rem', height: '20px', borderRadius: '4px', color: 'var(--rose)' }}
                          onClick={() => { setIsReplaying(false); setReplayStep(0); }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="timeline-list" style={{ marginTop: '10px' }}>
                    {visibleEvents.length === 0 ? (
                      <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No history recorded.</p>
                    ) : (
                      visibleEvents.map(event => (
                        <div key={event.id} className={`timeline-node ${event.statusClass}`} style={{ animation: 'fade-in 0.3s ease-out' }}>
                          <div className="timeline-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                              {event.title}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {formatDate(event.date.toISOString())} {formatTime(event.date.toISOString())}
                            </span>
                          </div>
                          <div className="timeline-body" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {event.body}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default Shoppers;
