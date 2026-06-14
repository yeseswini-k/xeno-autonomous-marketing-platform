export interface PresetCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  metadata: {
    preferredCategory: string;
    loyaltyTier: 'VIP' | 'Member' | 'Standard';
    location: string;
    acquisitionChannel: string;
  };
}

export interface PresetOrder {
  id: string;
  customerId: string;
  amount: number;
  items: string[];
  status: 'completed' | 'processing' | 'pending';
  createdAt: string;
}

export interface PresetProfile {
  name: string;
  description: string;
  currency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'AED' | 'SGD';
  locale: 'en-US' | 'en-IN' | 'en-GB' | 'de-DE' | 'fr-FR';
  timezone: string;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  brandName: string;
  industry: string;
  data: {
    customers: PresetCustomer[];
    orders: PresetOrder[];
  };
}

const now = Date.now();

export const PRESETS: Record<string, PresetProfile> = {
  fashion_us: {
    name: '🇺🇸 Zara Style (US Fashion Brand)',
    description: 'US fashion retail profile. Curated with US locations, USD currency, and Eastern timezone.',
    currency: 'USD',
    locale: 'en-US',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    brandName: 'Zara Style',
    industry: 'Fashion',
    data: {
      customers: [
        {
          id: 'cust_fash_us_01',
          name: 'Sophia Smith',
          email: 'sophia.smith@zstyle-us.com',
          phone: '+1 (212) 555-0199',
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Fashion', loyaltyTier: 'VIP', location: 'New York', acquisitionChannel: 'Instagram' }
        },
        {
          id: 'cust_fash_us_02',
          name: 'Liam Garcia',
          email: 'liam.garcia@zstyle-us.com',
          phone: '+1 (310) 555-0244',
          createdAt: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Fashion', loyaltyTier: 'Member', location: 'Los Angeles', acquisitionChannel: 'Google Search' }
        },
        {
          id: 'cust_fash_us_03',
          name: 'Olivia Martinez',
          email: 'olivia.m@zstyle-us.com',
          phone: '+1 (312) 555-0312',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Fashion', loyaltyTier: 'Standard', location: 'Chicago', acquisitionChannel: 'Referral' }
        },
        {
          id: 'cust_fash_us_04',
          name: 'Noah Taylor',
          email: 'noah.taylor@zstyle-us.com',
          phone: '+1 (415) 555-0455',
          createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Fashion', loyaltyTier: 'VIP', location: 'San Francisco', acquisitionChannel: 'TikTok' }
        },
        {
          id: 'cust_fash_us_05',
          name: 'Emma Johnson',
          email: 'emma.j@zstyle-us.com',
          phone: '+1 (512) 555-0588',
          createdAt: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Fashion', loyaltyTier: 'Member', location: 'Austin', acquisitionChannel: 'Instagram' }
        }
      ],
      orders: [
        {
          id: 'ord_fash_us_101',
          customerId: 'cust_fash_us_01',
          amount: 143.00,
          items: ['Minimalist Linen Shirt', 'Denim Carpenter Pants'],
          status: 'completed',
          createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_fash_us_102',
          customerId: 'cust_fash_us_01',
          amount: 70.00,
          items: ['Heavyweight Crewneck'],
          status: 'completed',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_fash_us_103',
          customerId: 'cust_fash_us_02',
          amount: 85.50,
          items: ['Denim Carpenter Pants'],
          status: 'completed',
          createdAt: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_fash_us_104',
          customerId: 'cust_fash_us_03',
          amount: 24.00,
          items: ['Ribbed Cotton Socks'],
          status: 'completed',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_fash_us_105',
          customerId: 'cust_fash_us_04',
          amount: 213.00,
          items: ['Minimalist Linen Shirt', 'Denim Carpenter Pants', 'Heavyweight Crewneck'],
          status: 'completed',
          createdAt: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  },
  d2c_india: {
    name: '🇮🇳 Kalyan Textiles (Indian D2C Brand)',
    description: 'Indian ethnic wear profile. Pre-built with Indian metros, INR currency, and IST timezone.',
    currency: 'INR',
    locale: 'en-IN',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    brandName: 'Kalyan Textiles',
    industry: 'D2C Apparel',
    data: {
      customers: [
        {
          id: 'cust_d2c_in_01',
          name: 'Aarav Patel',
          email: 'aarav.patel@kalyan-d2c.in',
          phone: '+91 98765 43210',
          createdAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Ethnic Wear', loyaltyTier: 'VIP', location: 'Chennai', acquisitionChannel: 'Instagram' }
        },
        {
          id: 'cust_d2c_in_02',
          name: 'Vihaan Sharma',
          email: 'vihaan.s@kalyan-d2c.in',
          phone: '+91 99887 76655',
          createdAt: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Men Apparel', loyaltyTier: 'Member', location: 'Bangalore', acquisitionChannel: 'Google Search' }
        },
        {
          id: 'cust_d2c_in_03',
          name: 'Ananya Iyer',
          email: 'ananya.iyer@kalyan-d2c.in',
          phone: '+91 91234 56789',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Home Decor', loyaltyTier: 'Standard', location: 'Mumbai', acquisitionChannel: 'Referral' }
        },
        {
          id: 'cust_d2c_in_04',
          name: 'Sai Reddy',
          email: 'sai.reddy@kalyan-d2c.in',
          phone: '+91 88776 65544',
          createdAt: new Date(now - 55 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Organic Goods', loyaltyTier: 'VIP', location: 'Hyderabad', acquisitionChannel: 'TikTok' }
        },
        {
          id: 'cust_d2c_in_05',
          name: 'Diya Sen',
          email: 'diya.sen@kalyan-d2c.in',
          phone: '+91 98110 22334',
          createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Ethnic Wear', loyaltyTier: 'Member', location: 'Delhi', acquisitionChannel: 'Instagram' }
        }
      ],
      orders: [
        {
          id: 'ord_d2c_in_101',
          customerId: 'cust_d2c_in_01',
          amount: 12000.00,
          items: ['Handloom Silk Saree', 'Cotton Kurta'],
          status: 'completed',
          createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_d2c_in_102',
          customerId: 'cust_d2c_in_01',
          amount: 4500.00,
          items: ['Linen Nehru Jacket'],
          status: 'completed',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_d2c_in_103',
          customerId: 'cust_d2c_in_02',
          amount: 8900.00,
          items: ['Brass Puja Thali', 'Clay Diyas'],
          status: 'completed',
          createdAt: new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_d2c_in_104',
          customerId: 'cust_d2c_in_03',
          amount: 1200.00,
          items: ['Organic Spice Sampler'],
          status: 'completed',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_d2c_in_105',
          customerId: 'cust_d2c_in_04',
          amount: 15500.00,
          items: ['Handcrafted Leather Juttis', 'Embroidered Kashmiri Shawl'],
          status: 'completed',
          createdAt: new Date(now - 55 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  },
  eu_organic: {
    name: '🇪🇺 BioNatur (European Organic Brand)',
    description: 'European bio & organic shop. Loaded with EU locations, EUR currency, and Berlin timezone.',
    currency: 'EUR',
    locale: 'de-DE',
    timezone: 'Europe/Berlin',
    dateFormat: 'YYYY-MM-DD',
    brandName: 'BioNatur',
    industry: 'Bio Foods & Living',
    data: {
      customers: [
        {
          id: 'cust_eu_org_01',
          name: 'Lukas Weber',
          email: 'l.weber@bionatur.de',
          phone: '+49 30 5550119',
          createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Organic Wear', loyaltyTier: 'VIP', location: 'Berlin', acquisitionChannel: 'Instagram' }
        },
        {
          id: 'cust_eu_org_02',
          name: 'Chloé Dubois',
          email: 'chloe.dubois@bionatur.fr',
          phone: '+33 1 5550244',
          createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Cosmetics', loyaltyTier: 'Member', location: 'Paris', acquisitionChannel: 'Google Search' }
        },
        {
          id: 'cust_eu_org_03',
          name: 'Sven van der Berg',
          email: 'sven.vdb@bionatur.nl',
          phone: '+31 20 5550312',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Home Gear', loyaltyTier: 'Standard', location: 'Amsterdam', acquisitionChannel: 'Referral' }
        },
        {
          id: 'cust_eu_org_04',
          name: 'Emma Müller',
          email: 'e.mueller@bionatur.de',
          phone: '+49 30 5550455',
          createdAt: new Date(now - 50 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Organic Wear', loyaltyTier: 'VIP', location: 'Berlin', acquisitionChannel: 'TikTok' }
        },
        {
          id: 'cust_eu_org_05',
          name: 'Leon Lefevre',
          email: 'leon.lefevre@bionatur.fr',
          phone: '+33 1 5550588',
          createdAt: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { preferredCategory: 'Cosmetics', loyaltyTier: 'Member', location: 'Paris', acquisitionChannel: 'Instagram' }
        }
      ],
      orders: [
        {
          id: 'ord_eu_org_101',
          customerId: 'cust_eu_org_01',
          amount: 120.00,
          items: ['Organic Cotton Hoodie', 'Eco Wool Socks'],
          status: 'completed',
          createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_eu_org_102',
          customerId: 'cust_eu_org_02',
          amount: 75.00,
          items: ['Biodegradable Phone Case'],
          status: 'completed',
          createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_eu_org_103',
          customerId: 'cust_eu_org_03',
          amount: 210.00,
          items: ['Bamboo Bath Towels', 'Eco Yoga Mat'],
          status: 'completed',
          createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_eu_org_104',
          customerId: 'cust_eu_org_04',
          amount: 45.00,
          items: ['Reusable Bamboo Mug', 'Canvas Shopper'],
          status: 'completed',
          createdAt: new Date(now - 50 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'ord_eu_org_105',
          customerId: 'cust_eu_org_05',
          amount: 185.00,
          items: ['Organic Cotton Hoodie', 'Recycled Wool Beanie'],
          status: 'completed',
          createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  }
};
