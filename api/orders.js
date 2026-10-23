import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://plctcjxlyhzbufybpatq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_hrYtHIzuHF6SDuttKivmRw_YmZjPfI-';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // 1. Try to fetch from ohemaa_settings (key: store_orders)
      const { data: settingData } = await supabase
        .from('ohemaa_settings')
        .select('value')
        .eq('key', 'store_orders')
        .maybeSingle();

      if (settingData && Array.isArray(settingData.value)) {
        return res.status(200).json({ success: true, count: settingData.value.length, orders: settingData.value });
      }

      // 2. Fallback to ohemaa_orders table
      const { data: ordersData, error } = await supabase
        .from('ohemaa_orders')
        .select('*');

      if (error) throw error;
      return res.status(200).json({ success: true, count: (ordersData || []).length, orders: ordersData || [] });
    }

    if (req.method === 'POST') {
      const { order_id, customer_name, customer_phone, delivery_method, address, notes, items, total_amount, is_wholesale } = req.body;

      if (!customer_name || !customer_phone || !items) {
        return res.status(400).json({ success: false, error: 'Customer name, phone, and items are required' });
      }

      const generatedId = order_id || `OHE-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderSummary = `${customer_name} (${customer_phone}) - ${delivery_method === 'store-pickup' ? 'Store Pick-Up' : 'Friday Delivery'}`;

      // Insert minimal summary row into ohemaa_orders table
      await supabase.from('ohemaa_orders').insert([{
        id: generatedId,
        customer_name: orderSummary
      }]).select();

      // Persist rich JSON order into ohemaa_settings
      const fullOrder = {
        orderId: generatedId,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        timestamp: Date.now(),
        customer: {
          name: customer_name,
          phone: customer_phone,
          address: address || (delivery_method === 'store-pickup' ? 'Store Pick-Up' : 'Accra, Ghana'),
          notes: notes || ''
        },
        deliveryMethod: delivery_method || 'friday-delivery',
        isWholesale: Boolean(is_wholesale),
        items: items,
        totalAmount: total_amount ? parseFloat(total_amount) : null,
        status: 'Pending Confirmation'
      };

      const { data: currentSettings } = await supabase
        .from('ohemaa_settings')
        .select('value')
        .eq('key', 'store_orders')
        .maybeSingle();

      const existingOrders = currentSettings && Array.isArray(currentSettings.value) ? currentSettings.value : [];
      const updatedOrders = [fullOrder, ...existingOrders];

      await supabase.from('ohemaa_settings').upsert({
        key: 'store_orders',
        value: updatedOrders
      });

      return res.status(201).json({ success: true, order: fullOrder });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API orders error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
