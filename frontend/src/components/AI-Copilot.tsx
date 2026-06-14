
interface AISuggestion {
  segmentRules: {
    minSpent?: number;
    maxSpent?: number;
    minOrders?: number;
    lastOrderDaysAgo?: number;
    customFilter?: string;
  };
  messageTemplate: string;
  channel: 'whatsapp' | 'sms' | 'email' | 'rcs' | 'push';
  campaignName: string;
  explanation: string;
}

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, Terminal, CheckCircle2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
  showToast: (title: string, description: string, type: 'info' | 'success' | 'warning') => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  suggestion?: AISuggestion;
}

const AICopilot: React.FC<AICopilotProps> = ({ isOpen, onClose, onCampaignCreated, showToast }) => {
  const { brandName, currency, locale, formatCurrency } = useSettings();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I am your AI Marketing Copilot. Ask me to query shopper segments and draft campaign copy in natural language.\n\nTry clicking one of the suggested campaign strategies below or type your own criteria!"
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState<AISuggestion | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleQuickPrompt = (text: string) => {
    setPrompt(text);
  };

  const handleSendPrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userText = prompt;
    setPrompt('');
    
    // Add user message
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: 'user',
      text: userText
    }]);

    setIsLoading(true);

    try {
      const response = await fetch('/api/crm/ai-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          brandName,
          currency,
          locale
        })
      });

      if (!response.ok) throw new Error('AI Server compilation failure');
      
      const suggestion: AISuggestion = await response.json();
      
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: `Here is the campaign strategy I compiled based on your request. Let me know if you would like to edit or launch it:`,
        suggestion
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: `Sorry, I encountered an error: ${err.message || 'Unknown compilation failure'}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchCampaign = async (sug: AISuggestion) => {
    try {
      const response = await fetch('/api/crm/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sug.campaignName,
          segmentRules: sug.segmentRules,
          messageTemplate: sug.messageTemplate,
          channel: sug.channel
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Remove suggestions from active chat states so it cannot be double launched
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: 'ai',
          text: `🚀 Campaign "${sug.campaignName}" successfully compiled and queued! Target segment contains ${data.campaign.stats.total} shoppers. Tracking is now active in the main dashboard.`
        }]);

        onCampaignCreated();
        showToast('Campaign Launched!', `Queued ${data.campaign.stats.total} messages on ${sug.channel.toUpperCase()}`, 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error');
      }
    } catch (err: any) {
      showToast('Launch Failed', err.message || 'Failed to trigger campaign launch', 'warning');
    }
  };

  return (
    <div className={`copilot-container ${isOpen ? 'open' : ''}`}>
      <div className="copilot-header">
        <h3>
          <Sparkles size={18} className="color-blue" style={{ color: 'var(--accent)' }} />
          XENO AI Marketing Copilot
        </h3>
        <button 
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Chat bubbles container */}
      <div className="copilot-chat">
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div className={`copilot-bubble bubble-${msg.sender}`}>
              <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>

              {/* Renders campaign suggestion detail inline inside AI bubble */}
              {msg.suggestion && (
                <div className="ai-campaign-card">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Terminal size={14} />
                    {msg.suggestion.campaignName}
                  </h4>
                  
                  <div className="ai-campaign-spec">
                    <div>Channel: {msg.suggestion.channel.toUpperCase()}</div>
                    <div>Target Criteria:</div>
                    {msg.suggestion.segmentRules.minSpent && <div>- Spent &gt; {formatCurrency(msg.suggestion.segmentRules.minSpent)}</div>}
                    {msg.suggestion.segmentRules.minOrders && <div>- Orders &gt;= {msg.suggestion.segmentRules.minOrders}</div>}
                    {msg.suggestion.segmentRules.lastOrderDaysAgo && <div>- Inactive &gt; {msg.suggestion.segmentRules.lastOrderDaysAgo} days</div>}
                    {msg.suggestion.segmentRules.customFilter && <div>- Category: "{msg.suggestion.segmentRules.customFilter}"</div>}
                    {!msg.suggestion.segmentRules.minSpent && 
                     !msg.suggestion.segmentRules.minOrders && 
                     !msg.suggestion.segmentRules.lastOrderDaysAgo && 
                     !msg.suggestion.segmentRules.customFilter && 
                     <div>- All active shoppers</div>}
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '8px' }}>
                    Reasoning: {msg.suggestion.explanation}
                  </p>

                  <div className="ai-campaign-msg">
                    {msg.suggestion.messageTemplate}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '0.78rem', flex: 1 }}
                      onClick={() => handleLaunchCampaign(msg.suggestion!)}
                    >
                      <CheckCircle2 size={12} />
                      Launch Outreach
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                      onClick={() => setEditingSuggestion(msg.suggestion!)}
                    >
                      Tweak Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="copilot-bubble bubble-ai" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="spinner" style={{ width: '14px', height: '14px' }} />
            <span>AI Copilot is processing criteria...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips (Visible only when chat is idle) */}
      {!isLoading && !editingSuggestion && (
        <div style={{ padding: '0 20px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Suggested Prompts
          </span>
          <div className="quick-action-list">
            <button 
              className="quick-action-btn"
              onClick={() => handleQuickPrompt("Winback Coffee shoppers who haven't purchased in 30 days via WhatsApp")}
            >
              ☕ Winback Coffee Shoppers
            </button>
            <button 
              className="quick-action-btn"
              onClick={() => handleQuickPrompt(`Promo SMS for Fashion shoppers who spent more than ${formatCurrency(100)}`)}
            >
              👗 Fashion promo (Spent &gt; {formatCurrency(100)})
            </button>
            <button 
              className="quick-action-btn"
              onClick={() => handleQuickPrompt("VIP Beauty email offering 20% discount code BEAUTY20")}
            >
              ✨ Beauty VIP Offer
            </button>
            <button 
              className="quick-action-btn"
              onClick={() => handleQuickPrompt("Select all members and draft an engagement RCS message")}
            >
              📱 Broad Member Outreach
            </button>
          </div>
        </div>
      )}

      {/* Inline Composer Modifications Modal-like Drawer panel */}
      {editingSuggestion && (
        <div 
          className="glass-panel" 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            background: 'var(--card-bg)',
            borderTop: '1px solid var(--panel-border)',
            padding: '20px',
            zIndex: 110,
            animation: 'slide-up 0.25s ease-out'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ color: 'var(--primary)', fontWeight: 600 }}>Tweak Campaign Configurations</h4>
            <button 
              onClick={() => setEditingSuggestion(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Campaign Name</label>
              <input 
                type="text"
                style={{ width: '100%', padding: '10px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                value={editingSuggestion.campaignName}
                onChange={(e) => setEditingSuggestion({ ...editingSuggestion, campaignName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Message Template</label>
              <textarea 
                style={{ width: '100%', height: '100px', padding: '10px', background: 'var(--bg-color)', border: '1px solid var(--panel-border)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', resize: 'none', fontSize: '0.85rem' }}
                value={editingSuggestion.messageTemplate}
                onChange={(e) => setEditingSuggestion({ ...editingSuggestion, messageTemplate: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1, fontSize: '0.8rem' }}
                onClick={() => {
                  const sug = editingSuggestion;
                  setEditingSuggestion(null);
                  handleLaunchCampaign(sug);
                }}
              >
                Launch Compiled
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem' }}
                onClick={() => setEditingSuggestion(null)}
              >
                Back to Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="copilot-input-area">
        <form onSubmit={handleSendPrompt} className="copilot-form">
          <input 
            type="text" 
            placeholder="Type campaign prompt or click suggestion..." 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading || !!editingSuggestion}
          />
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ padding: '0 16px', borderRadius: '12px' }}
            disabled={isLoading || !prompt.trim() || !!editingSuggestion}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AICopilot;
