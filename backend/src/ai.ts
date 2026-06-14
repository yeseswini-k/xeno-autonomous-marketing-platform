import * as dotenv from 'dotenv';
dotenv.config();

export interface AISuggestion {
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

const SYSTEM_PROMPT = `You are the AI Marketing Copilot for XENO CRM.
Your job is to parse the user's natural language request and return a structured JSON response to configure a marketing campaign.
Return ONLY valid JSON matching this schema:
{
  "segmentRules": {
    "minSpent": number or null,
    "maxSpent": number or null,
    "minOrders": number or null,
    "lastOrderDaysAgo": number or null,
    "customFilter": "string representing a category or tag to filter, or 'opened_not_purchased' (special tag for customers who opened messages but never purchased), or null"
  },
  "messageTemplate": "String message. Use tags like {{name}}, {{first_name}}, {{total_spent}} for personalization.",
  "channel": "whatsapp" | "sms" | "email" | "rcs" | "push",
  "campaignName": "A catchy, short name for this campaign",
  "explanation": "Brief reasoning for why these segment rules and message template were selected."
}

Do not include markdown tags, code blocks, or explanations outside the JSON structure.`;

export async function processAIPrompt(
  prompt: string,
  brandName?: string,
  currency?: string,
  locale?: string
): Promise<AISuggestion> {
  const apiKey = process.env.GEMINI_API_KEY;

  const getCurrencySymbol = (curr: string) => {
    switch (curr) {
      case 'INR': return '₹';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'AED': return 'AED ';
      case 'SGD': return 'S$';
      default: return '$';
    }
  };
  const symbol = getCurrencySymbol(currency || 'USD');

  const customSystemPrompt = `${SYSTEM_PROMPT}
Context:
- Brand Name: ${brandName || 'XENO CRM'}
- Target Currency: ${currency || 'USD'} (locale: ${locale || 'en-US'})
- Currency Symbol: ${symbol}

Please ensure the suggestions explanations, templates and campaigns use this brand name, currency symbol, and formatting guidelines. Do not draft templates referencing USD ($) if the target currency is different. Make sure segment rules numbers are simple numbers (do not format numbers in the JSON properties, e.g. minSpent must be an integer, not a currency string).`;

  if (apiKey) {
    try {
      console.log('[AI Engine] Querying Gemini API...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: customSystemPrompt },
                  { text: `User request: "${prompt}"` }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const result = (await response.json()) as any;
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Gemini');
      
      const parsed: AISuggestion = JSON.parse(rawText.trim());
      return parsed;
    } catch (err) {
      console.error('[AI Engine] Gemini API failed, falling back to local compiler:', err);
      // Fall through to local fallback
    }
  }

  // Local rule-based parser fallback (Offline / No API Key mode)
  console.log('[AI Engine] Running local pattern-matching NLP compiler...');
  
  // Default values
  let minSpent: number | undefined;
  let maxSpent: number | undefined;
  let minOrders: number | undefined;
  let lastOrderDaysAgo: number | undefined;
  let customFilter = '';
  let channel: 'whatsapp' | 'sms' | 'email' | 'rcs' | 'push' = 'whatsapp';
  let campaignName = 'AI Targeted Campaign';
  let template = '';
  let explanation = '';

  const cleanPrompt = prompt.toLowerCase();

  // Extract spent limit
  const spentMatch = cleanPrompt.match(/(?:spent|spent more than|greater than|\$|₹|€|£|rs\.?|spent over)\s*(\d+)/i);
  if (spentMatch) {
    minSpent = parseInt(spentMatch[1], 10);
  }

  // Extract order limit
  const orderMatch = cleanPrompt.match(/(?:orders|bought|purchased|purchases)\s*(?:more than|at least|>=|>)?\s*(\d+)/i);
  if (orderMatch) {
    minOrders = parseInt(orderMatch[1], 10);
  }

  // Extract inactive duration
  const daysMatch = cleanPrompt.match(/(?:last|past|not bought in|inactive for|days ago|not purchased in)\s*(\d+)\s*(?:days|weeks|months)/i);
  if (daysMatch) {
    let days = parseInt(daysMatch[1], 10);
    if (cleanPrompt.includes('week')) days *= 7;
    if (cleanPrompt.includes('month')) days *= 30;
    lastOrderDaysAgo = days;
  } else if (cleanPrompt.includes('30 days') || cleanPrompt.includes('1 month')) {
    lastOrderDaysAgo = 30;
  } else if (cleanPrompt.includes('45 days')) {
    lastOrderDaysAgo = 45;
  }

  // Channel detection
  if (cleanPrompt.includes('email') || cleanPrompt.includes('mail')) {
    channel = 'email';
  } else if (cleanPrompt.includes('sms') || cleanPrompt.includes('text')) {
    channel = 'sms';
  } else if (cleanPrompt.includes('rcs')) {
    channel = 'rcs';
  } else if (cleanPrompt.includes('push') || cleanPrompt.includes('notification')) {
    channel = 'push';
  } else {
    channel = 'whatsapp'; // Default channel
  }

  // Category/Tag detection
  if (cleanPrompt.includes('opened') && (cleanPrompt.includes('never purchased') || cleanPrompt.includes('never bought') || cleanPrompt.includes('not purchased') || cleanPrompt.includes('no purchase'))) {
    customFilter = 'opened_not_purchased';
    minOrders = 0;
    maxSpent = 0;
  } else if (cleanPrompt.includes('coffee') || cleanPrompt.includes('caffeine')) {
    customFilter = 'Coffee';
  } else if (cleanPrompt.includes('fashion') || cleanPrompt.includes('clothes') || cleanPrompt.includes('zara')) {
    customFilter = 'Fashion';
  } else if (cleanPrompt.includes('ethnic') || cleanPrompt.includes('ethnic wear') || cleanPrompt.includes('saree')) {
    customFilter = 'Ethnic Wear';
  } else if (cleanPrompt.includes('beauty') || cleanPrompt.includes('makeup') || cleanPrompt.includes('cosmetics')) {
    customFilter = 'Beauty';
  } else if (cleanPrompt.includes('vip')) {
    customFilter = 'VIP';
  } else if (cleanPrompt.includes('member')) {
    customFilter = 'Member';
  }

  if (cleanPrompt.includes('high spender') || cleanPrompt.includes('high spend') || cleanPrompt.includes('big spender') || cleanPrompt.includes('top spender')) {
    if (!minSpent) minSpent = 150;
  }

  // Draft Campaign Name and Message Template
  if (customFilter === 'opened_not_purchased') {
    campaignName = 'Opened But Never Purchased Re-engagement';
    template = `Hi {{name}}! We noticed you opened our last message but didn't have a chance to complete your order. Use code COMPLETE15 to get 15% off today! http://xeno.shop/complete`;
    explanation = 'Targeting high-intent shoppers who opened campaigns but did not complete purchases, utilizing a 15% discount code.';
  } else if (cleanPrompt.includes('winback') || cleanPrompt.includes('reengage') || lastOrderDaysAgo) {
    campaignName = `Winback ${customFilter || 'Shopper'} Campaign`;
    if (channel === 'email') {
      template = `Hi {{first_name}},\n\nWe haven't seen you in a while! To welcome you back, we've loaded a special 20% discount code WELCOME20 to your account. Your last purchase history shows you love our ${customFilter || 'products'}, and we've got exciting new items you'll adore.\n\nShop now: http://xeno.shop/reengage\n\nCheers,\nThe Team`;
    } else {
      template = `Hey {{first_name}}! We miss you. 🌟 Get 20% off your next order with code WELCOME20. Check out our latest ${customFilter || 'collection'} at http://xeno.shop/back`;
    }
    explanation = `Targeting inactive users (${lastOrderDaysAgo || 30} days inactive) with a winback discount via ${channel.toUpperCase()} to encourage repeat purchases.`;
  } else if (cleanPrompt.includes('discount') || cleanPrompt.includes('promo') || cleanPrompt.includes('offer')) {
    campaignName = `${customFilter || 'DTC'} Promotional Campaign`;
    template = `Hi {{first_name}}! Exclusive offer just for you: Get 15% off everything today with code SECRET15. Shop now: http://xeno.shop/promo`;
    explanation = `Selected high-intent users${minSpent ? ` with total spend > ${symbol}${minSpent}` : ''} for a premium promotional offer.`;
  } else {
    campaignName = `${customFilter || 'DTC'} VIP Engagement`;
    template = `Hey {{first_name}}! As one of our top shoppers, we wanted to share a sneak peek of our newest ${customFilter || 'items'} before they launch officially next week. Use code VIPACCESS for free express shipping. http://xeno.shop/vip`;
    explanation = `Broad customer engagement targeted for ${channel.toUpperCase()}-preferred users.`;
  }

  return {
    segmentRules: {
      minSpent,
      maxSpent,
      minOrders,
      lastOrderDaysAgo,
      customFilter: customFilter || undefined
    },
    messageTemplate: template,
    channel,
    campaignName,
    explanation
  };
}
