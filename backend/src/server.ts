import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { db, Customer, Order, Campaign, MessageLog, MessageStatus, ChannelType } from './db';
import { crmOutboxQueue, channelWebhookQueue, queueEvents } from './queue';
import { processAIPrompt } from './ai';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Helper to filter CRM lists relative to active Time Machine "asOf" date
function getFilteredCrmData(req: express.Request) {
  const asOf = req.query.asOf ? String(req.query.asOf) : null;
  
  let customers = db.getCustomers();
  let orders = db.getOrders();
  let campaigns = db.getCampaigns();
  let messages = db.getMessages();

  if (asOf) {
    const cutoffTime = new Date(asOf).getTime();
    if (!isNaN(cutoffTime)) {
      customers = customers.filter(c => new Date(c.createdAt).getTime() <= cutoffTime);
      orders = orders.filter(o => new Date(o.createdAt).getTime() <= cutoffTime);
      campaigns = campaigns.filter(c => new Date(c.createdAt).getTime() <= cutoffTime);
      messages = messages.filter(m => new Date(m.createdAt).getTime() <= cutoffTime);
    }
  }

  return { customers, orders, campaigns, messages };
}

// Helper to calculate campaign stats relative to the asOf messages list
function computeCampaignStats(campaign: Campaign, messages: MessageLog[], orders: Order[]) {
  const campaignMsgs = messages.filter(m => m.campaignId === campaign.id);
  
  const initialStats = () => ({
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    opened: 0,
    read: 0,
    clicked: 0,
    converted: 0,
    revenue: 0,
  });

  const stats = initialStats();
  const statsB = initialStats();

  campaignMsgs.forEach(m => {
    const isB = campaign.isABTest && m.variant === 'B';
    const targetStats = isB ? statsB : stats;
    
    targetStats.total++;

    if (m.status !== 'pending' && m.status !== 'sending') {
      if (m.status === 'failed') {
        targetStats.failed++;
      } else {
        targetStats.sent++;
      }
    }
    if (['delivered', 'opened', 'read', 'clicked', 'converted'].includes(m.status)) {
      targetStats.delivered++;
    }
    if (['opened', 'read', 'clicked', 'converted'].includes(m.status)) {
      targetStats.opened++;
    }
    if (['read', 'clicked', 'converted'].includes(m.status)) {
      targetStats.read++;
    }
    if (['clicked', 'converted'].includes(m.status)) {
      targetStats.clicked++;
    }
    if (m.status === 'converted') {
      targetStats.converted++;
    }
  });

  const campaignOrders = orders.filter(o => o.campaignId === campaign.id);
  campaignOrders.forEach(o => {
    const msg = campaignMsgs.find(m => m.customerId === o.customerId);
    const isB = campaign.isABTest && msg?.variant === 'B';
    if (isB) {
      statsB.revenue += o.amount;
    } else {
      stats.revenue += o.amount;
    }
  });

  return {
    ...campaign,
    stats,
    ...(campaign.isABTest ? { statsB } : {})
  };
}

// List of connected SSE clients
let sseClients: any[] = [];

// SSE Event broadcaster
function broadcastSSE(type: string, data: any) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => client.write(payload));
}

// Subscribe to queue changes
queueEvents.on('state_change', (state) => {
  broadcastSSE('queue_state', state);
});

// SSE Endpoint for frontend real-time tracking
app.get('/api/crm/events/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('data: {"connected":true}\n\n');
  sseClients.push(res);

  // Send current queue states immediately
  res.write(`event: queue_state\ndata: ${JSON.stringify({ queueName: 'CRM_Outbox', size: crmOutboxQueue.getQueueLength(), processing: crmOutboxQueue.getActiveProcessingCount() })}\n\n`);
  res.write(`event: queue_state\ndata: ${JSON.stringify({ queueName: 'Channel_Webhook', size: channelWebhookQueue.getQueueLength(), processing: channelWebhookQueue.getActiveProcessingCount() })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// ==========================================
// CRM APIs
// ==========================================

// Import Customers & Orders (Bulk)
app.post('/api/crm/customers/import', (req, res) => {
  const { customers, orders } = req.body;
  if (customers && Array.isArray(customers)) {
    db.bulkAddCustomers(customers);
  }
  if (orders && Array.isArray(orders)) {
    db.bulkAddOrders(orders);
  }
  res.json({ success: true, message: `Imported ${customers?.length || 0} customers and ${orders?.length || 0} orders.` });
});

// List Customers (Filters & Pagination)
app.get('/api/crm/customers', (req, res) => {
  const { search, minSpent, hasOrders } = req.query;
  const { customers: filteredCustomers, orders } = getFilteredCrmData(req);
  let customers = filteredCustomers;

  if (search) {
    const q = String(search).toLowerCase();
    customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q));
  }

  // Precompute spending & order counts for filters
  const customerStats = customers.map(c => {
    const custOrders = orders.filter(o => o.customerId === c.id);
    const totalSpent = custOrders.reduce((sum, o) => sum + o.amount, 0);
    return { customer: c, totalSpent, ordersCount: custOrders.length };
  });

  let filtered = customerStats;

  if (minSpent) {
    const min = parseFloat(String(minSpent));
    filtered = filtered.filter(f => f.totalSpent >= min);
  }

  if (hasOrders) {
    const minO = parseInt(String(hasOrders), 10);
    filtered = filtered.filter(f => f.ordersCount >= minO);
  }

  const result = filtered.map(f => ({
    ...f.customer,
    totalSpent: f.totalSpent,
    ordersCount: f.ordersCount,
  }));

  res.json(result);
});

// Get Orders list
app.get('/api/crm/orders', (req, res) => {
  const { orders } = getFilteredCrmData(req);
  res.json(orders);
});

// Get Single Customer details + purchase history + communication logs
app.get('/api/crm/customers/:id', (req, res) => {
  const { customers, orders, messages } = getFilteredCrmData(req);
  const customer = customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const custOrders = orders.filter(o => o.customerId === customer.id);
  const custMessages = messages.filter(m => m.customerId === customer.id);

  res.json({
    ...customer,
    orders: custOrders,
    messages: custMessages,
  });
});

// Segment Creation / Preview API
app.post('/api/crm/segments/preview', (req, res) => {
  const { minSpent, maxSpent, minOrders, lastOrderDaysAgo, customFilter } = req.body;
  const { customers, orders, messages } = getFilteredCrmData(req);

  const now = req.query.asOf ? new Date(String(req.query.asOf)).getTime() : Date.now();
  const matched = customers.filter(c => {
    const custOrders = orders.filter(o => o.customerId === c.id);
    const totalSpent = custOrders.reduce((sum, o) => sum + o.amount, 0);
    const ordersCount = custOrders.length;
    
    // Sort orders by date descending to find the last order
    const sortedOrders = [...custOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastOrder = sortedOrders[0];

    // Filter rules
    if (minSpent !== undefined && minSpent !== null && totalSpent < minSpent) return false;
    if (maxSpent !== undefined && maxSpent !== null && totalSpent > maxSpent) return false;
    if (minOrders !== undefined && minOrders !== null && ordersCount < minOrders) return false;
    
    if (lastOrderDaysAgo !== undefined && lastOrderDaysAgo !== null) {
      if (!lastOrder) return false; // No orders, so not matching days ago requirement
      const diffMs = now - new Date(lastOrder.createdAt).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < lastOrderDaysAgo) return false;
    }

    if (customFilter) {
      if (customFilter === 'opened_not_purchased') {
        const custMessages = messages.filter(m => m.customerId === c.id);
        const hasOpened = custMessages.some(m => ['opened', 'read', 'clicked', 'converted'].includes(m.status));
        if (!hasOpened || ordersCount > 0) return false;
      } else {
        const filterStr = customFilter.toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(filterStr);
        const metadataMatch = JSON.stringify(c.metadata).toLowerCase().includes(filterStr);
        const itemsMatch = custOrders.some(o => o.items.some(item => item.toLowerCase().includes(filterStr)));
        if (!nameMatch && !metadataMatch && !itemsMatch) return false;
      }
    }

    return true;
  });

  res.json({
    count: matched.length,
    customers: matched.slice(0, 20).map(c => {
      const custOrders = orders.filter(o => o.customerId === c.id);
      return {
        ...c,
        totalSpent: custOrders.reduce((sum, o) => sum + o.amount, 0),
        ordersCount: custOrders.length
      };
    })
  });
});

// Get Campaigns List
app.get('/api/crm/campaigns', (req, res) => {
  const { campaigns, messages, orders } = getFilteredCrmData(req);
  const computed = campaigns.map(c => computeCampaignStats(c, messages, orders));
  res.json(computed);
});

// Get Campaign details
app.get('/api/crm/campaigns/:id', (req, res) => {
  const { campaigns, messages, orders } = getFilteredCrmData(req);
  const campaign = campaigns.find(c => c.id === req.params.id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  const campaignMsgs = messages.filter(m => m.campaignId === campaign.id);
  const computedCampaign = computeCampaignStats(campaign, messages, orders);
  res.json({ campaign: computedCampaign, messages: campaignMsgs });
});

// Get Conversions (Attributed Orders) List
app.get('/api/crm/conversions', (req, res) => {
  const { orders, campaigns, customers } = getFilteredCrmData(req);

  const campaignDrivenOrders = orders
    .filter(o => o.campaignId)
    .map(o => {
      const customer = customers.find(c => c.id === o.customerId);
      const campaign = campaigns.find(c => c.id === o.campaignId);
      return {
        id: o.id,
        amount: o.amount,
        items: o.items,
        createdAt: o.createdAt,
        customerName: customer?.name || 'Unknown',
        campaignName: campaign?.name || 'Campaign'
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(campaignDrivenOrders);
});

// Launch Campaign
app.post('/api/crm/campaigns', async (req, res) => {
  const { name, segmentRules, messageTemplate, channel, isABTest, messageTemplateB } = req.body;

  // Create Campaign entry in Database
  const campaignId = uuidv4();
  const campaign: Campaign = {
    id: campaignId,
    name,
    segmentRules,
    messageTemplate,
    channel,
    status: 'sending',
    createdAt: new Date().toISOString(),
    stats: {
      total: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      read: 0,
      clicked: 0,
      converted: 0,
      revenue: 0
    },
    isABTest,
    messageTemplateB,
    ...(isABTest ? {
      statsB: {
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        opened: 0,
        read: 0,
        clicked: 0,
        converted: 0,
        revenue: 0
      }
    } : {})
  };

  // Find matching target shoppers
  const { customers, orders, messages } = getFilteredCrmData(req);
  const now = Date.now();

  const targetCustomers = customers.filter(c => {
    const custOrders = orders.filter(o => o.customerId === c.id);
    const totalSpent = custOrders.reduce((sum, o) => sum + o.amount, 0);
    const ordersCount = custOrders.length;
    const sortedOrders = [...custOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastOrder = sortedOrders[0];

    const { minSpent, maxSpent, minOrders, lastOrderDaysAgo, customFilter } = segmentRules;

    if (minSpent !== undefined && minSpent !== null && totalSpent < minSpent) return false;
    if (maxSpent !== undefined && maxSpent !== null && totalSpent > maxSpent) return false;
    if (minOrders !== undefined && minOrders !== null && ordersCount < minOrders) return false;
    
    if (lastOrderDaysAgo !== undefined && lastOrderDaysAgo !== null) {
      if (!lastOrder) return false;
      const diffMs = now - new Date(lastOrder.createdAt).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays < lastOrderDaysAgo) return false;
    }

    if (customFilter) {
      if (customFilter === 'opened_not_purchased') {
        const custMessages = messages.filter(m => m.customerId === c.id);
        const hasOpened = custMessages.some(m => ['opened', 'read', 'clicked', 'converted'].includes(m.status));
        if (!hasOpened || ordersCount > 0) return false;
      } else {
        const filterStr = customFilter.toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(filterStr);
        const metadataMatch = JSON.stringify(c.metadata).toLowerCase().includes(filterStr);
        const itemsMatch = custOrders.some(o => o.items.some(item => item.toLowerCase().includes(filterStr)));
        if (!nameMatch && !metadataMatch && !itemsMatch) return false;
      }
    }

    return true;
  });

  campaign.stats.total = targetCustomers.length;
  if (targetCustomers.length === 0) {
    campaign.status = 'completed';
    db.addCampaign(campaign);
    return res.json({ campaign, message: 'Campaign created but segment is empty.' });
  }

  db.addCampaign(campaign);
  broadcastSSE('campaign_started', { campaignId, total: targetCustomers.length });

  // Add messages to outbox queue
  targetCustomers.forEach((customer, index) => {
    const messageId = uuidv4();
    
    // Personalize template tags
    const variant = isABTest ? (index % 2 === 0 ? 'A' : 'B') : undefined;
    const activeTemplate = (variant === 'B') ? (messageTemplateB || messageTemplate) : messageTemplate;
    
    let content = activeTemplate
      .replace(/{{name}}/g, customer.name)
      .replace(/{{first_name}}/g, customer.name.split(' ')[0])
      .replace(/{{email}}/g, customer.email)
      .replace(/{{phone}}/g, customer.phone);

    // Relational attributes
    const custOrders = orders.filter(o => o.customerId === customer.id);
    const totalSpent = custOrders.reduce((sum, o) => sum + o.amount, 0);
    content = content.replace(/{{total_spent}}/g, `$${totalSpent.toFixed(2)}`);

    const recipient = channel === 'email' ? customer.email : customer.phone;

    // Create Message Log in pending state
    const msgLog: MessageLog = {
      id: messageId,
      campaignId,
      customerId: customer.id,
      channel,
      recipient,
      content,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [{ status: 'pending', timestamp: new Date().toISOString() }],
      variant
    };
    db.addMessage(msgLog);

    // Queue send job to the simulated Channel Service
    crmOutboxQueue.add({
      id: messageId,
      maxAttempts: 3,
      run: async () => {
        // Update state in db to sending
        db.updateMessageStatus(messageId, 'sending');
        broadcastSSE('message_updated', {
          messageId,
          status: 'sending',
          campaignId,
          customerId: customer.id,
          customerName: customer.name,
          campaignName: campaign.name,
          variant
        });

        // HTTP call to the Channel Service endpoint
        const response = await fetch(`http://localhost:${PORT}/api/channel/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            channel,
            recipient,
            content,
            callbackUrl: `http://localhost:${PORT}/api/crm/callback`
          })
        });

        if (!response.ok) {
          throw new Error(`Channel gateway responded with ${response.status}`);
        }
      },
      onFailure: (err) => {
        db.updateMessageStatus(messageId, 'failed', err.message);
        broadcastSSE('message_updated', {
          messageId,
          status: 'failed',
          campaignId,
          customerId: customer.id,
          customerName: customer.name,
          campaignName: campaign.name,
          variant,
          error: err.message
        });
      }
    });
  });

  res.json({ campaign, message: `Campaign launched. Queued ${targetCustomers.length} messages.` });
});

// CRM Webhook Receipt API
app.post('/api/crm/callback', (req, res) => {
  const { messageId, status, error } = req.body;
  
  if (!messageId || !status) {
    return res.status(400).json({ error: 'Missing messageId or status' });
  }

  const updatedMsg = db.updateMessageStatus(messageId, status as MessageStatus, error);
  if (updatedMsg) {
    const customer = db.getCustomerById(updatedMsg.customerId);
    const campaign = db.getCampaignById(updatedMsg.campaignId);
    broadcastSSE('message_updated', {
      messageId,
      status,
      campaignId: updatedMsg.campaignId,
      customerId: updatedMsg.customerId,
      customerName: customer?.name || 'Shopper',
      campaignName: campaign?.name || 'Outreach',
      variant: updatedMsg.variant,
      error
    });
    
    // Log in terminal/console
    console.log(`[CRM Webhook] Message ${messageId} status updated to: ${status} ${error ? `(Error: ${error})` : ''}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: `Message with ID ${messageId} not found` });
  }
});

// AI Copilot Integration
app.post('/api/crm/ai-prompt', async (req, res) => {
  const { prompt, brandName, currency, locale } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const suggestion = await processAIPrompt(prompt, brandName, currency, locale);
    res.json(suggestion);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI compilation failed' });
  }
});

// Simulated Conversion Endpoint
// Triggered by channel clicks to show conversion attribution
app.post('/api/crm/simulated-purchase', (req, res) => {
  const { customerId, campaignId } = req.body;
  if (!customerId || !campaignId) {
    return res.status(400).json({ error: 'Missing customerId or campaignId' });
  }

  const customer = db.getCustomerById(customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Generate a mock purchase
  const itemsPool = {
    Coffee: ['Premium Espresso Blend', 'Cold Brew Pack', 'Double Wall Glass Mug', 'Hand Grinder'],
    Fashion: ['Minimalist Linen Shirt', 'Denim Carpenter Pants', 'Ribbed Cotton Socks', 'Heavyweight Crewneck'],
    Beauty: ['Hydrating Face Serum', 'Mineral Sunscreen SPF50', 'Clay Purifying Mask', 'Balancing Toner'],
    General: ['Leather Card Holder', 'Insulated Travel Tumbler', 'Soy Wax Candle', 'Canvas Tote Bag']
  };

  const campaign = db.getCampaignById(campaignId);
  const filterTag = (campaign?.segmentRules.customFilter as keyof typeof itemsPool) || 'General';
  const pool = itemsPool[filterTag] || itemsPool['General'];
  const itemsCount = Math.floor(Math.random() * 2) + 1;
  const items = Array.from({ length: itemsCount }, () => pool[Math.floor(Math.random() * pool.length)]);

  const amount = parseFloat((Math.random() * 80 + 20).toFixed(2)); // $20 - $100

  const order: Order = {
    id: uuidv4(),
    customerId,
    amount,
    items,
    status: 'completed',
    createdAt: new Date().toISOString(),
    campaignId
  };

  db.addOrder(order);

  // Update message log to converted
  const messages = db.getMessagesByCustomerId(customerId);
  const campMsg = messages.find(m => m.campaignId === campaignId);
  if (campMsg && campMsg.status !== 'converted') {
    db.updateMessageStatus(campMsg.id, 'converted');
    broadcastSSE('message_updated', {
      messageId: campMsg.id,
      status: 'converted',
      campaignId,
      customerId,
      customerName: customer.name,
      campaignName: campaign?.name || 'Outreach'
    });
  }

  console.log(`[Attribution] Customer ${customer.name} converted! Purchase of $${amount} linked to Campaign ${campaignId}`);
  broadcastSSE('conversion_event', {
    customerId,
    customerName: customer.name,
    campaignId,
    campaignName: campaign?.name || 'Campaign',
    amount,
    items
  });

  res.json({ success: true, order });
});


// ==========================================
// STUBBED CHANNEL SERVICE
// ==========================================

// Helper delay simulator
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Channel Send Request
app.post('/api/channel/send', async (req, res) => {
  const { messageId, channel, recipient, content, callbackUrl } = req.body;

  if (!messageId || !channel || !recipient || !content || !callbackUrl) {
    return res.status(400).json({ error: 'Missing parameters in channel send payload' });
  }

  // Acknowledge receipt immediately
  res.status(202).json({ status: 'queued', messageId });

  // Retrieve current simulator probabilities
  const config = db.getChannelConfig();
  const latency = Math.floor(Math.random() * (config.latencyMax - config.latencyMin)) + config.latencyMin;

  // Process message asynchronously
  (async () => {
    // 1. Simulate gateway network delay
    await delay(latency);

    // 2. Decide if dispatching succeeds or fails
    const isSuccessfulSend = Math.random() <= config.successRate;

    if (!isSuccessfulSend) {
      // Dispatch webhook callback for failure
      queueWebhookCallback(callbackUrl, {
        messageId,
        status: 'failed',
        error: 'CARRIER_TIMEOUT: Throttled by downstream network node'
      });
      return;
    }

    // Success send -> callback 'sent'
    queueWebhookCallback(callbackUrl, { messageId, status: 'sent' });

    // 3. Schedule DELIVERY callback (after sent)
    await delay(1000 + Math.random() * 1000);
    queueWebhookCallback(callbackUrl, { messageId, status: 'delivered' });

    // 4. Schedule OPEN/READ callback (70% probability)
    const willOpen = Math.random() <= config.openRate;
    if (!willOpen) return;

    await delay(2000 + Math.random() * 4000);
    const readStatus = (channel === 'email') ? 'opened' : 'read';
    queueWebhookCallback(callbackUrl, { messageId, status: readStatus });

    // 5. Schedule CLICK callback (30% probability)
    const willClick = Math.random() <= config.clickRate;
    if (!willClick) return;

    await delay(3000 + Math.random() * 5000);
    queueWebhookCallback(callbackUrl, { messageId, status: 'clicked' });

    // 6. Schedule CONVERSION callback (15% probability)
    const willConvert = Math.random() <= config.conversionRate;
    if (!willConvert) return;

    await delay(2000 + Math.random() * 3000);
    // Send request to CRM to trigger purchase simulation
    try {
      const msg = db.getMessageById(messageId);
      if (msg) {
        await fetch(`http://localhost:${PORT}/api/crm/simulated-purchase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: msg.customerId,
            campaignId: msg.campaignId
          })
        });
      }
    } catch (err) {
      console.error('[Simulator] Failed to attribute simulated conversion:', err);
    }
  })();
});

// Queue helper to execute webhook callbacks back to CRM with retries and backoff
function queueWebhookCallback(callbackUrl: string, payload: { messageId: string; status: string; error?: string }) {
  channelWebhookQueue.add({
    id: `${payload.messageId}_${payload.status}`,
    maxAttempts: 5, // Retry up to 5 times if CRM server is down or returns error
    run: async (job) => {
      console.log(`[Simulator Gateway] Sending webhook callback to CRM: Message ${payload.messageId} -> ${payload.status} (Attempt ${job.attempts})`);

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`CRM server returned error ${response.status}`);
      }
    },
    onSuccess: () => {
      broadcastSSE('webhook_sent', {
        messageId: payload.messageId,
        status: payload.status,
        success: true
      });
    },
    onRetry: (err, delayMs) => {
      console.log(`[Simulator Gateway] Webhook callback failed: ${err.message}. Retrying in ${delayMs / 1000}s...`);
      broadcastSSE('webhook_sent', {
        messageId: payload.messageId,
        status: payload.status,
        success: false,
        retryIn: delayMs
      });
    },
    onFailure: (err) => {
      console.error(`[Simulator Gateway] Webhook callback permanently failed for message ${payload.messageId} -> ${payload.status}:`, err.message);
    }
  });
}

// Churn Prediction & Health Score calculations for Customer Details
app.get('/api/crm/customers/:id/analytics', (req, res) => {
  const { id } = req.params;
  const { customers, orders: filteredOrders, messages: filteredMessages } = getFilteredCrmData(req);
  const customer = customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const orders = filteredOrders.filter(o => o.customerId === id);
  const messages = filteredMessages.filter(m => m.customerId === id);

  // 1. Recency
  let lastOrderDate = customer.createdAt;
  if (orders.length > 0) {
    const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    lastOrderDate = sortedOrders[0].createdAt;
  }
  
  const nowTime = req.query.asOf ? new Date(String(req.query.asOf)).getTime() : Date.now();
  const msDiff = nowTime - new Date(lastOrderDate).getTime();
  const recencyDays = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));

  // 2. Frequency
  const frequency = orders.length;

  // 3. Monetary
  const totalSpent = orders.reduce((sum, o) => sum + o.amount, 0);

  // 4. Engagement (opened / clicked rates)
  const totalMessages = messages.length;
  const openedMessages = messages.filter(m => ['opened', 'read', 'clicked', 'converted'].includes(m.status)).length;
  const clickedMessages = messages.filter(m => ['clicked', 'converted'].includes(m.status)).length;

  const openRate = totalMessages > 0 ? openedMessages / totalMessages : 0;
  const clickRate = totalMessages > 0 ? clickedMessages / totalMessages : 0;

  // Churn calculations
  let churnProb = 10; // base churn
  churnProb += Math.min(50, Math.max(0, recencyDays - 15) * 1.5);
  churnProb -= Math.min(20, frequency * 4);
  churnProb -= Math.min(20, clickRate * 20);
  churnProb -= Math.min(10, openRate * 10);

  // Spend trend (negative trend increases churn)
  let spendTrend: 'up' | 'flat' | 'down' = 'flat';
  if (orders.length >= 2) {
    const half = Math.ceil(orders.length / 2);
    const sortedChronological = [...orders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const firstHalfAvg = sortedChronological.slice(0, half).reduce((sum, o) => sum + o.amount, 0) / half;
    const secondHalfAvg = sortedChronological.slice(half).reduce((sum, o) => sum + o.amount, 0) / (orders.length - half || 1);
    if (secondHalfAvg < firstHalfAvg * 0.9) {
      spendTrend = 'down';
      churnProb += 15;
    } else if (secondHalfAvg > firstHalfAvg * 1.1) {
      spendTrend = 'up';
    }
  }

  // Clamp churn probability
  churnProb = Math.round(Math.max(5, Math.min(95, churnProb)));

  // Churn status
  let churnStatus: 'Healthy' | 'At Risk' | 'Churning' = 'Healthy';
  if (churnProb > 70) {
    churnStatus = 'Churning';
  } else if (churnProb > 30) {
    churnStatus = 'At Risk';
  }

  // Churn reasoning & recommendation
  let churnReasoning = '';
  let churnRecommendation = '';

  if (churnStatus === 'Churning') {
    churnReasoning = `Shopper has been inactive for ${recencyDays} days with zero campaign engagement in recent touchpoints.`;
    churnRecommendation = 'Launch a winback campaign via SMS with a high-incentive discount code (e.g. 25% off).';
  } else if (churnStatus === 'At Risk') {
    churnReasoning = `Shopper is inactive for ${recencyDays} days despite high message open rates, indicating fading interest.`;
    churnRecommendation = 'Deliver a personalized WhatsApp recommendation featuring their preferred category.';
  } else {
    churnReasoning = 'High order frequency and steady click engagement indicate high product satisfaction.';
    churnRecommendation = 'Keep engaged with early access VIP previews and free shipping campaigns.';
  }

  // Health Score calculations
  const recencyScore = Math.max(0, 35 * (1 - recencyDays / 90));
  const frequencyScore = Math.min(25, frequency * 8);
  const monetaryScore = Math.min(20, (totalSpent / 150) * 20); // Relative to baseline $150
  const engagementScore = totalMessages > 0 ? (clickRate * 12 + openRate * 8) : 12; // Baseline 12 if no messages sent

  const healthScore = Math.round(Math.max(0, Math.min(100, recencyScore + frequencyScore + monetaryScore + engagementScore)));

  let healthReasoning = '';
  if (healthScore >= 80) {
    healthReasoning = 'Frequent transactions and active message responses sustain excellent shopper health.';
  } else if (healthScore >= 50) {
    healthReasoning = 'Solid purchase history is dampened by recent weeks of inactivity.';
  } else {
    healthReasoning = 'Prolonged purchase inactivity and lack of message replies have degraded shopper health.';
  }

  res.json({
    churnProbability: churnProb,
    churnStatus,
    churnReasoning,
    churnRecommendation,
    healthScore,
    healthReasoning,
    metrics: {
      recencyDays,
      frequency,
      totalSpent,
      openRate,
      clickRate,
      spendTrend
    }
  });
});

// GET dynamic CRM opportunities list
app.get('/api/crm/ai/opportunities', (req, res) => {
  const { customers, orders } = getFilteredCrmData(req);

  const opportunities: any[] = [];
  const avgOrderValue = orders.length > 0 
    ? orders.reduce((sum, o) => sum + o.amount, 0) / orders.length 
    : 80;

  // 1. Inactive VIPs
  const vips = customers.filter(c => c.metadata?.loyaltyTier === 'VIP');
  const inactiveVips = vips.filter(c => {
    const cOrders = orders.filter(o => o.customerId === c.id);
    let lastOrderDate = c.createdAt;
    if (cOrders.length > 0) {
      const sorted = [...cOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      lastOrderDate = sorted[0].createdAt;
    }
    const nowTime = req.query.asOf ? new Date(String(req.query.asOf)).getTime() : Date.now();
    const msDiff = nowTime - new Date(lastOrderDate).getTime();
    const daysInactive = Math.floor(msDiff / (1000 * 60 * 60 * 24));
    return daysInactive >= 30;
  });
  const vipCount = inactiveVips.length > 0 ? inactiveVips.length : 15;
  opportunities.push({
    id: 'opp_inactive_vips',
    type: 'warning',
    category: 'Inactive VIPs',
    title: '⚠️ VIP Re-engagement Opportunity',
    alert: `${vipCount} VIP customers inactive for 45 days.`,
    expectedRevenue: Math.round(vipCount * avgOrderValue * 0.12 * 1.5 * 10),
    expectedConversion: 12,
    recommendation: 'Launch 20% WhatsApp Winback Campaign.',
    confidence: 84,
    channel: 'whatsapp',
    discount: 20,
    roi: 180,
    segmentRules: { lastOrderDaysAgo: 45, customFilter: 'VIP' },
    messageTemplate: 'Hey {{first_name}}! We notice you haven\'t shopped with us in a while. As a VIP, here is an exclusive 20% off code: VIPWELCOME20. http://xeno.shop/vip',
    campaignName: 'VIP Inactivity Winback'
  });

  // 2. Cross-Sell Opportunities
  const ethnicWearLoverCount = customers.filter(c => String(c.metadata?.preferredCategory).toLowerCase() === 'ethnic wear' || String(c.metadata?.preferredCategory).toLowerCase() === 'fashion').length || 12;
  opportunities.push({
    id: 'opp_cross_sell',
    type: 'hot',
    category: 'Cross-Sell Opportunities',
    title: '🔥 Cross-Sell Opportunity: Matching Collections',
    alert: `${ethnicWearLoverCount} ethnic wear customers recently purchased sarees.`,
    expectedRevenue: 34000,
    expectedConversion: 15,
    recommendation: 'Promote premium blouse collection via Email.',
    confidence: 78,
    channel: 'email',
    discount: 10,
    roi: 240,
    segmentRules: { minOrders: 1, customFilter: 'Ethnic Wear' },
    messageTemplate: 'Hi {{first_name}}! Complete your saree look with our matching premium blouse collection. Get 10% off with code BLOUSE10. http://xeno.shop/blouses',
    campaignName: 'Saree Completer Cross-Sell'
  });

  // 3. Upsell Opportunities
  const highValueStandardCount = customers.filter(c => {
    const cOrders = orders.filter(o => o.customerId === c.id);
    const totalSpent = cOrders.reduce((sum, o) => sum + o.amount, 0);
    return (c.metadata?.loyaltyTier || 'Standard') !== 'VIP' && totalSpent > 50;
  }).length || 8;
  opportunities.push({
    id: 'opp_upsell',
    type: 'money',
    category: 'Upsell Opportunities',
    title: '💰 High-Value Loyalty Upsell',
    alert: `${highValueStandardCount} high-value shoppers close to VIP tier.`,
    expectedRevenue: 48000,
    expectedConversion: 20,
    recommendation: 'Launch premium early loyalty entry campaign.',
    confidence: 88,
    channel: 'whatsapp',
    discount: 15,
    roi: 310,
    segmentRules: { minSpent: 50, minOrders: 2 },
    messageTemplate: 'Hey {{first_name}}! You are close to unlocking VIP status. Complete one more purchase today and get 15% off using code UPGRADE15. http://xeno.shop/upgrade',
    campaignName: 'VIP Tier Accelerator'
  });

  // 4. Churn Risks
  const churnRiskCount = customers.filter(c => {
    const cOrders = orders.filter(o => o.customerId === c.id);
    return cOrders.length === 1;
  }).length || 18;
  opportunities.push({
    id: 'opp_churn_risks',
    type: 'warning',
    category: 'Churn Risks',
    title: '📉 High Churn Risk Prevention',
    alert: `${churnRiskCount} one-time buyers with no campaign interactions in 60 days.`,
    expectedRevenue: Math.round(churnRiskCount * avgOrderValue * 0.10 * 1.1 * 10),
    expectedConversion: 10,
    recommendation: 'Deliver high-incentive SMS Winback.',
    confidence: 72,
    channel: 'sms',
    discount: 25,
    roi: 120,
    segmentRules: { lastOrderDaysAgo: 60, minOrders: 1 },
    messageTemplate: 'Hey {{first_name}}! We\'d love to welcome you back. Here is 25% off your next purchase with code COMEBACK25. http://xeno.shop/winback',
    campaignName: 'DTC Churn Prevention Winback'
  });

  // 5. Revenue Opportunities
  opportunities.push({
    id: 'opp_revenue_opportunities',
    type: 'money',
    category: 'Revenue Opportunities',
    title: '📈 Seasonal Category Booster',
    alert: 'Coffee category interest peaks in morning hours.',
    expectedRevenue: 45000,
    expectedConversion: 18,
    recommendation: 'Launch 15% WhatsApp promotion on Premium Espresso Blends.',
    confidence: 85,
    channel: 'whatsapp',
    discount: 15,
    roi: 280,
    segmentRules: { customFilter: 'Coffee' },
    messageTemplate: 'Hey {{first_name}}! Start your day with our premium espresso blends. Get 15% off today only with code COFFEE15. http://xeno.shop/espresso',
    campaignName: 'Coffee Morning Rush Campaign'
  });

  // 6. Loyalty Opportunities
  const standardTierCount = customers.filter(c => (c.metadata?.loyaltyTier || 'Standard') === 'Standard').length || 22;
  opportunities.push({
    id: 'opp_loyalty_opportunities',
    type: 'hot',
    category: 'Loyalty Opportunities',
    title: '💎 Member Tier Conversion Campaign',
    alert: `${standardTierCount} unregistered standard tier shoppers are repeat buyers.`,
    expectedRevenue: Math.round(standardTierCount * avgOrderValue * 0.22 * 10),
    expectedConversion: 22,
    recommendation: 'Promote Member Perks program via WhatsApp.',
    confidence: 90,
    channel: 'whatsapp',
    discount: 10,
    roi: 290,
    segmentRules: { minOrders: 2, customFilter: 'Standard' },
    messageTemplate: 'Hey {{first_name}}! Upgrade to our Member Loyalty Tier for free shipping on all orders. Sign up here and get 10% off your next order: http://xeno.shop/loyalty',
    campaignName: 'Member Sign-up Conversion'
  });

  res.json(opportunities);
});

// Autopilot Campaign Planning & Prediction
app.post('/api/crm/ai/autopilot', async (req, res) => {
  const { goal, brandName, currency, locale } = req.body;
  if (!goal) {
    return res.status(400).json({ error: 'Goal description is required' });
  }

  try {
    const { customers, orders } = getFilteredCrmData(req);
    const suggestion = await processAIPrompt(`Autopilot goal: "${goal}"`, brandName, currency, locale);
    
    // Baseline channel values
    let openRate = 0.25;
    let ctr = 0.05;
    let conv = 0.02;

    if (suggestion.channel === 'whatsapp') {
      openRate = 0.85; ctr = 0.22; conv = 0.10;
    } else if (suggestion.channel === 'sms') {
      openRate = 0.90; ctr = 0.12; conv = 0.05;
    } else if (suggestion.channel === 'rcs') {
      openRate = 0.80; ctr = 0.16; conv = 0.08;
    } else if (suggestion.channel === 'push') {
      openRate = 0.60; ctr = 0.10; conv = 0.04;
    }

    const hasPersonalization = suggestion.messageTemplate.includes('{{');
    const hasPromo = /discount|off|%|promo|free/i.test(suggestion.messageTemplate);

    if (hasPersonalization) { openRate += 0.05; ctr += 0.02; conv += 0.01; }
    if (hasPromo) { ctr += 0.03; conv += 0.02; }

    openRate = Math.min(0.98, openRate);
    ctr = Math.min(0.80, ctr);
    conv = Math.min(0.50, conv);

    // estimate audience size
    let audienceSize = customers.length;
    if (suggestion.segmentRules) {
      const { minSpent, customFilter } = suggestion.segmentRules;
      let filtered = [...customers];
      if (minSpent) {
        filtered = filtered.filter(c => {
          const cOrders = orders.filter(o => o.customerId === c.id);
          const spend = cOrders.reduce((sum, o) => sum + o.amount, 0);
          return spend >= minSpent;
        });
      }
      if (customFilter) {
        filtered = filtered.filter(c => JSON.stringify(c.metadata || {}).toLowerCase().includes(customFilter.toLowerCase()));
      }
      audienceSize = Math.max(1, filtered.length);
    }

    const expectedConversions = Math.max(1, Math.round(audienceSize * conv));
    const avgSpendValue = orders.length > 0 ? orders.reduce((sum, o) => sum + o.amount, 0) / orders.length : 80;
    const expectedRevenue = Math.round(expectedConversions * avgSpendValue);

    const costPerMsg = suggestion.channel === 'whatsapp' ? 0.05 : suggestion.channel === 'sms' ? 0.02 : suggestion.channel === 'email' ? 0.005 : suggestion.channel === 'push' ? 0.01 : 0.03;
    const expectedCost = Math.max(0.50, audienceSize * costPerMsg);
    const roi = Math.round(((expectedRevenue - expectedCost) / expectedCost) * 100);

    const simulation = {
      openRate: Math.round(openRate * 100),
      ctr: Math.round(ctr * 100),
      conversionRate: Math.round(conv * 100),
      audienceSize,
      expectedRevenue,
      roi: isFinite(roi) ? roi : 200,
      confidenceScore: Math.min(95, Math.max(70, Math.round(75 + (hasPersonalization ? 5 : 0) + (hasPromo ? 5 : 0)))),
      reasoning: `Targeting segment users responsive to ${suggestion.channel.toUpperCase()} dispatch loops. Dynamic personalization templates boost expected reply rate, yielding strong predicted margins.`
    };

    res.json({
      ...suggestion,
      simulation
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI autopilot compilation failed' });
  }
});

// Config APIs for stubbed gateway
app.get('/api/channel/config', (req, res) => {
  res.json(db.getChannelConfig());
});

app.post('/api/channel/config', (req, res) => {
  db.updateChannelConfig(req.body);
  res.json({ success: true, config: db.getChannelConfig() });
});

// Clean slate database wipe
app.post('/api/crm/system/reset', (req, res) => {
  db.clearAll();
  crmOutboxQueue.clear();
  channelWebhookQueue.clear();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`XENO CRM Core running on http://localhost:${PORT}`);
  console.log(`Simulated Channel Gateway running on same port`);
  console.log(`===================================================`);
});
