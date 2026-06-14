import * as fs from 'fs';
import * as path from 'path';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  metadata: Record<string, any>;
}

export interface Order {
  id: string;
  customerId: string;
  amount: number;
  items: string[];
  status: 'pending' | 'completed' | 'refunded';
  createdAt: string;
  campaignId?: string; // If this order was driven by a campaign
}

export type ChannelType = 'whatsapp' | 'sms' | 'email' | 'rcs' | 'push';

export interface Campaign {
  id: string;
  name: string;
  segmentRules: {
    minSpent?: number;
    maxSpent?: number;
    minOrders?: number;
    lastOrderDaysAgo?: number;
    excludeCampaignId?: string;
    customFilter?: string; // Search query for tags/metadata
  };
  messageTemplate: string;
  isABTest?: boolean;
  messageTemplateB?: string;
  channel: ChannelType;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  createdAt: string;
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
  statsB?: Campaign['stats'];
}

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'read' | 'clicked' | 'converted';

export interface MessageLog {
  id: string;
  campaignId: string;
  customerId: string;
  channel: ChannelType;
  recipient: string;
  content: string;
  status: MessageStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  timeline: { status: MessageStatus; timestamp: string }[];
  variant?: 'A' | 'B';
}

export interface DbSchema {
  customers: Customer[];
  orders: Order[];
  campaigns: Campaign[];
  messages: MessageLog[];
  channelConfig: {
    latencyMin: number;
    latencyMax: number;
    successRate: number; // 0.0 - 1.0
    openRate: number;    // 0.0 - 1.0
    clickRate: number;   // 0.0 - 1.0
    conversionRate: number; // 0.0 - 1.0
  };
}

class Database {
  private filePath: string;
  private data!: DbSchema;
  private isWriting = false;
  private writeQueue: (() => void)[] = [];

  constructor() {
    this.filePath = path.join(__dirname, '..', 'db.json');
    this.init();
  }

  private init() {
    if (fs.existsSync(this.filePath)) {
      try {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(fileContent);
      } catch (err) {
        console.error('Failed to parse db.json, resetting database:', err);
        this.reset();
      }
    } else {
      this.reset();
    }
  }

  private reset() {
    this.data = {
      customers: [],
      orders: [],
      campaigns: [],
      messages: [],
      channelConfig: {
        latencyMin: 500,  // ms
        latencyMax: 2000, // ms
        successRate: 0.95, // 95% send success
        openRate: 0.70,    // 70% open rate
        clickRate: 0.30,   // 30% click rate
        conversionRate: 0.15 // 15% conversion rate
      }
    };
    this.saveImmediate();
  }

  private async save() {
    if (this.isWriting) {
      return new Promise<void>((resolve) => {
        this.writeQueue.push(resolve);
      });
    }

    this.isWriting = true;
    try {
      await fs.promises.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    } finally {
      this.isWriting = false;
      if (this.writeQueue.length > 0) {
        const nextResolve = this.writeQueue.shift();
        if (nextResolve) {
          nextResolve();
          this.save();
        }
      }
    }
  }

  private saveImmediate() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file synchronously:', err);
    }
  }

  // Customers
  getCustomers(): Customer[] {
    return this.data.customers;
  }

  getCustomerById(id: string): Customer | undefined {
    return this.data.customers.find(c => c.id === id);
  }

  addCustomer(customer: Customer) {
    const existsIndex = this.data.customers.findIndex(c => c.id === customer.id);
    if (existsIndex > -1) {
      this.data.customers[existsIndex] = customer;
    } else {
      this.data.customers.push(customer);
    }
    this.save();
  }

  bulkAddCustomers(customers: Customer[]) {
    for (const customer of customers) {
      const existsIndex = this.data.customers.findIndex(c => c.id === customer.id);
      if (existsIndex > -1) {
        this.data.customers[existsIndex] = customer;
      } else {
        this.data.customers.push(customer);
      }
    }
    this.save();
  }

  // Orders
  getOrders(): Order[] {
    return this.data.orders;
  }

  getOrdersByCustomerId(customerId: string): Order[] {
    return this.data.orders.filter(o => o.customerId === customerId);
  }

  addOrder(order: Order) {
    this.data.orders.push(order);
    this.save();
  }

  bulkAddOrders(orders: Order[]) {
    this.data.orders.push(...orders);
    this.save();
  }

  // Campaigns
  getCampaigns(): Campaign[] {
    return this.data.campaigns;
  }

  getCampaignById(id: string): Campaign | undefined {
    return this.data.campaigns.find(c => c.id === id);
  }

  addCampaign(campaign: Campaign) {
    this.data.campaigns.push(campaign);
    this.save();
  }

  updateCampaign(campaignId: string, updates: Partial<Campaign>) {
    const index = this.data.campaigns.findIndex(c => c.id === campaignId);
    if (index > -1) {
      this.data.campaigns[index] = { ...this.data.campaigns[index], ...updates } as Campaign;
      this.save();
    }
  }

  // Message Logs
  getMessages(): MessageLog[] {
    return this.data.messages;
  }

  getMessageById(id: string): MessageLog | undefined {
    return this.data.messages.find(m => m.id === id);
  }

  getMessagesByCampaignId(campaignId: string): MessageLog[] {
    return this.data.messages.filter(m => m.campaignId === campaignId);
  }

  getMessagesByCustomerId(customerId: string): MessageLog[] {
    return this.data.messages.filter(m => m.customerId === customerId);
  }

  addMessage(message: MessageLog) {
    this.data.messages.push(message);
    this.save();
  }

  updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    error?: string
  ): MessageLog | undefined {
    const index = this.data.messages.findIndex(m => m.id === messageId);
    if (index > -1) {
      const msg = this.data.messages[index];
      msg.status = status;
      msg.updatedAt = new Date().toISOString();
      msg.timeline.push({ status, timestamp: msg.updatedAt });
      if (error) {
        msg.lastError = error;
      }
      this.data.messages[index] = msg;
      
      // Update campaign stats
      this.recalculateCampaignStats(msg.campaignId);
      
      this.save();
      return msg;
    }
    return undefined;
  }

  updateMessageRetry(messageId: string, retryCount: number, error: string) {
    const index = this.data.messages.findIndex(m => m.id === messageId);
    if (index > -1) {
      this.data.messages[index].retryCount = retryCount;
      this.data.messages[index].lastError = error;
      this.data.messages[index].updatedAt = new Date().toISOString();
      this.save();
    }
  }

  private recalculateCampaignStats(campaignId: string) {
    const campaign = this.getCampaignById(campaignId);
    if (!campaign) return;

    const campaignMsgs = this.getMessagesByCampaignId(campaignId);
    
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

      // Aggregate stats based on status transitions
      if (m.status !== 'pending' && m.status !== 'sending') {
        if (m.status === 'failed') {
          targetStats.failed++;
        } else {
          targetStats.sent++; // Any state beyond failed/pending/sending means it was sent
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

    // Calculate revenue driven by this campaign
    const campaignOrders = this.data.orders.filter(o => o.campaignId === campaignId);
    campaignOrders.forEach(o => {
      const msg = campaignMsgs.find(m => m.customerId === o.customerId);
      const isB = campaign.isABTest && msg?.variant === 'B';
      if (isB) {
        statsB.revenue += o.amount;
      } else {
        stats.revenue += o.amount;
      }
    });

    // If all messages are in terminal states, complete campaign
    let activeMessages = campaignMsgs.filter(m => ['pending', 'sending', 'sent', 'delivered', 'opened', 'read', 'clicked'].includes(m.status));
    // Check if campaign was running but is now finished processing
    let newStatus = campaign.status;
    if (campaign.status === 'sending' && activeMessages.length === 0) {
      newStatus = 'completed';
    }

    if (campaign.isABTest) {
      this.updateCampaign(campaignId, { stats, statsB, status: newStatus });
    } else {
      this.updateCampaign(campaignId, { stats, status: newStatus });
    }
  }

  // Channel Simulation Config
  getChannelConfig() {
    return this.data.channelConfig;
  }

  updateChannelConfig(updates: Partial<DbSchema['channelConfig']>) {
    this.data.channelConfig = { ...this.data.channelConfig, ...updates };
    this.save();
  }

  // Clear data
  clearAll() {
    this.reset();
  }
}

export const db = new Database();
