import { db, Customer, Order } from './db';
import { v4 as uuidv4 } from 'uuid';

console.log('Seeding simulated customer and order data...');

// Reset DB
db.clearAll();

const customers: Customer[] = [];
const orders: Order[] = [];

// Helper to generate dates relative to now
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const firstNames = ['Sophia', 'Liam', 'Olivia', 'Noah', 'Emma', 'Jackson', 'Ava', 'Aiden', 'Isabella', 'Lucas', 'Mia', 'Oliver', 'Amelia', 'Ethan', 'Harper', 'Wiley', 'Evelyn', 'Sam', 'Abigail', 'Alex', 'Emily', 'Leo', 'Elizabeth', 'Max', 'Aria'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

// Brand categories
const categories = ['Coffee', 'Fashion', 'Beauty'];

// Item pools
const itemsByCat = {
  Coffee: ['Premium Espresso Blend', 'Cold Brew Pack', 'Double Wall Glass Mug', 'Hand Grinder', 'Oat Milk Carton', 'Syrup Set'],
  Fashion: ['Minimalist Linen Shirt', 'Denim Carpenter Pants', 'Ribbed Cotton Socks', 'Heavyweight Crewneck', 'Canvas Tote Bag', 'Leather Belt'],
  Beauty: ['Hydrating Face Serum', 'Mineral Sunscreen SPF50', 'Clay Purifying Mask', 'Balancing Toner', 'Rosehip Oil', 'Lip Balm']
};

const itemsPrices: Record<string, number> = {
  'Premium Espresso Blend': 18.00,
  'Cold Brew Pack': 14.50,
  'Double Wall Glass Mug': 22.00,
  'Hand Grinder': 45.00,
  'Oat Milk Carton': 6.00,
  'Syrup Set': 12.00,
  'Minimalist Linen Shirt': 58.00,
  'Denim Carpenter Pants': 85.00,
  'Ribbed Cotton Socks': 12.00,
  'Heavyweight Crewneck': 70.00,
  'Canvas Tote Bag': 25.00,
  'Leather Belt': 38.00,
  'Hydrating Face Serum': 32.00,
  'Mineral Sunscreen SPF50': 26.00,
  'Clay Purifying Mask': 28.00,
  'Balancing Toner': 20.00,
  'Rosehip Oil': 24.00,
  'Lip Balm': 8.50
};

// Generate 45 Shoppers (15 per brand category to make testing easy)
let customerIndex = 0;
for (const cat of categories) {
  const itemsPool = itemsByCat[cat as keyof typeof itemsByCat];

  for (let i = 0; i < 15; i++) {
    const id = `cust_${uuidv4().substring(0, 8)}`;
    const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${fName} ${lName}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}@xeno-example.com`;
    // Format realistic phone
    const phone = `+1 (${Math.floor(Math.random() * 800) + 200}) 555-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const metadata = {
      preferredCategory: cat,
      loyaltyTier: i % 4 === 0 ? 'VIP' : i % 2 === 0 ? 'Member' : 'Standard',
      location: ['New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Austin', 'Seattle'][Math.floor(Math.random() * 6)],
      acquisitionChannel: ['Instagram', 'Google Search', 'Referral', 'TikTok'][Math.floor(Math.random() * 4)],
    };

    const customer: Customer = {
      id,
      name,
      email,
      phone,
      createdAt: daysAgo(Math.floor(Math.random() * 200) + 30),
      metadata,
    };
    customers.push(customer);

    // Create 1 to 5 orders for each customer
    // Make some customers inactive (last purchase > 40 days ago)
    // and others active (last purchase 1-10 days ago)
    const isInactive = i % 3 === 0;
    const numOrders = isInactive ? 1 : Math.floor(Math.random() * 4) + 1;

    for (let o = 0; o < numOrders; o++) {
      const orderId = `ord_${uuidv4().substring(0, 8)}`;
      // Choose items from the category
      const orderItemsCount = Math.floor(Math.random() * 3) + 1;
      const orderItems = Array.from({ length: orderItemsCount }, () => itemsPool[Math.floor(Math.random() * itemsPool.length)]);
      
      const amount = orderItems.reduce((sum, item) => sum + (itemsPrices[item] || 10), 0);
      
      // Determine purchase date
      let dateString: string;
      if (isInactive) {
        // Last purchased 40-90 days ago
        dateString = daysAgo(Math.floor(Math.random() * 50) + 40);
      } else {
        // Last purchased 1-25 days ago
        dateString = daysAgo(Math.floor(Math.random() * 24) + 1);
      }

      const order: Order = {
        id: orderId,
        customerId: id,
        amount: parseFloat(amount.toFixed(2)),
        items: orderItems,
        status: 'completed',
        createdAt: dateString,
      };
      orders.push(order);
    }
  }
}

db.bulkAddCustomers(customers);
db.bulkAddOrders(orders);

console.log(`Seeding complete:`);
console.log(`- Created ${customers.length} DTC Shoppers`);
console.log(`- Created ${orders.length} Attributed Purchase Orders`);
console.log(`Ready for campaign segmentation and delivery.`);
